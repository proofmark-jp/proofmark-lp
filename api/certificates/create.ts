export const config = { runtime: 'edge' };
import { getAuthenticatedUserId, getOrigin, json, supabaseAdmin } from '../_shared.js';
import { resolveC2paForPersistence } from '../_lib/c2pa-validate.js';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// Vercel Edgeの上限（4.5MB）より少し安全なマージンを取る（4MB = 4 * 1024 * 1024 bytes）
const MAX_FILE_SIZE = 4 * 1024 * 1024;

export default async function handler(request: Request) {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

  // 🛡️ 最終防衛線：Rate Limit（1つのIPにつき、10秒間に5回まで）
  try {
    const redis = new Redis({
      url: process.env.KV_REST_API_URL || '',
      token: process.env.KV_REST_API_TOKEN || '',
    });

    const ratelimit = new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(5, '10 s'),
      analytics: true,
    });

    // ユーザーのIPアドレスを取得（Edge環境の標準的な取り方）
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    
    // 判定
    const { success } = await ratelimit.limit(`ratelimit_${ip}`);
    if (!success) {
      console.warn(`[RateLimit] Blocked request from IP: ${ip}`);
      return json(429, { 
        error: 'Too many requests. Please wait a few seconds before trying again.' 
      });
    }
  } catch (error) {
    // Upstashの無料枠上限到達や接続エラー時は、システムを止めずに通過させる（フェイルセーフ）
    console.error('[RateLimit] Error or Limit Reached. Bypassing safely:', error);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    return json(400, { error: 'Invalid form data. File might be too large (Limit is 4MB).' });
  }

  const file = formData.get('file');
  const title = String(formData.get('title') || '').trim();
  const sha256 = String(formData.get('sha256') || '');
  const proofMode = String(formData.get('proofMode') || 'shareable');
  const visibility = String(formData.get('visibility') || 'public');
  const metadataJsonRaw = String(formData.get('metadataJson') || '{}');
  const c2paRaw = formData.get('c2paManifest');

  if (!file || typeof file === 'string' || !('name' in file)) return json(400, { error: 'file is required' });

  // 🛡️ ファイルサイズ制限のガード
  if (file.size > MAX_FILE_SIZE) {
    return json(413, { error: 'File size exceeds 4MB limit. Please compress the file.' });
  }

  if (!title) return json(400, { error: 'title is required' });
  if (!sha256) return json(400, { error: 'sha256 is required' });

  // 🛡️ JSONパースの安全な処理
  let parsedMetadata = {};
  try {
    parsedMetadata = JSON.parse(metadataJsonRaw);
  } catch (e) {
    return json(400, { error: 'Invalid metadataJson format' });
  }

  let userId = '';
  try {
    userId = await getAuthenticatedUserId(request);
  } catch (error) {
    return json(401, { error: error instanceof Error ? error.message : 'Unauthorized' });
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan_tier')
    .eq('id', userId)
    .single();
  const planTier = profile?.plan_tier ?? 'free';

  if (c2paRaw instanceof File) {
    console.warn({ event: 'c2pa.binary_field_ignored' });
  }
  const { value: c2paValue, gate } = resolveC2paForPersistence(c2paRaw instanceof File ? null : c2paRaw, planTier);
  if (gate.kind === 'reject') {
    console.warn({ event: 'c2pa.rejected', reason: gate.reason });
  }

  const duplicate = await supabaseAdmin
    .from('certificates')
    .select('id, public_verify_token, proven_at')
    .eq('sha256', sha256)
    .limit(1)
    .maybeSingle();

  if (duplicate.data) return json(409, { error: 'duplicate certificate exists', duplicate: true, certificate: duplicate.data });

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const certificateId = crypto.randomUUID();
  const storagePath = `${userId}/certificates/${certificateId}.${ext}`;
  let publicImageUrl: string | null = null;

  if (proofMode === 'shareable') {
    const publicPreviewPath = `certificates/${certificateId}.${ext}`;

    // 🏎️ パフォーマンス最適化：並列アップロード（Promise.all）でタイムアウトを防ぐ
    const [originalUpload, previewCopy] = await Promise.all([
      supabaseAdmin.storage.from('proofmark-originals').upload(storagePath, file, {
        upsert: false, contentType: file.type || 'application/octet-stream', cacheControl: '31536000',
      }),
      supabaseAdmin.storage.from('proofmark-public').upload(publicPreviewPath, file, {
        upsert: false, contentType: file.type || 'application/octet-stream', cacheControl: '31536000',
      })
    ]);

    if (originalUpload.error) return json(500, { error: originalUpload.error.message });
    if (previewCopy.error) return json(500, { error: previewCopy.error.message });

    const { data: previewPublicData } = supabaseAdmin.storage.from('proofmark-public').getPublicUrl(publicPreviewPath);
    publicImageUrl = previewPublicData.publicUrl;
  }

  const { data, error } = await supabaseAdmin
    .from('certificates')
    .insert({
      id: certificateId,
      user_id: userId,
      title,
      sha256,
      proof_mode: proofMode,
      visibility,
      public_verify_token: crypto.randomUUID(),
      public_image_url: publicImageUrl,
      storage_path: proofMode === 'shareable' ? storagePath : null,
      file_name: file.name,
      mime_type: file.type || null,
      file_size: file.size,
      metadata_json: {
        ...parsedMetadata,
        integrity_model: 'proofmark.chain-ready.v1',
      },
      c2pa_manifest: c2paValue,
    })
    .select('*')
    .single();

  if (error) return json(500, { error: error.message });

  return json(200, {
    certificate: data,
    verifyUrl: `${getOrigin(request)}/cert/${data.public_verify_token}`,
  });
}