/**
 * api/certificates/create.ts — Phase Studio Repair
 *
 * 致命的な「400 Bad Request (file is required)」を修正。
 *
 * 設計方針:
 *   1. proofMode === 'private' (Zero-Knowledge) では `file` 実体を**絶対に**要求しない。
 *      クライアントが安全にハッシュだけを送ってくる正常フローを尊重する。
 *   2. proofMode === 'shareable' のときのみ multipart の `file` を必須にする。
 *      画像のみアップロード→公開可能 (既存仕様)。
 *   3. file_hash / file_name / file_size はボディから受け取り、形式と上限を検証する。
 *      file_hash は SHA-256 (16進64文字) を厳格に判定。改ざんされた長さ・記号は弾く。
 *   4. RateLimit / C2PA Gate / Edge runtime / 既存 INSERT 列は**1ミリも壊さない**。
 *
 * 影響範囲:
 *   - api/certificates/create.ts (本ファイル) のみ。
 *   - 同じテーブル列・同じ formData フィールド名・同じ JSON レスポンス Schema を維持。
 */

export const config = { runtime: 'edge' };

import { getAuthenticatedUserId, getOrigin, json, supabaseAdmin } from '../_shared.js';
import { resolveC2paForPersistence } from '../_lib/c2pa-validate.js';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// Vercel Edge body limit (4.5MB) よりやや安全側にマージン
const MAX_FILE_SIZE = 4 * 1024 * 1024;
// Private モードでクライアントが申告できるオリジナルサイズの理論上限 (500MB)
const MAX_DECLARED_SIZE = 500 * 1024 * 1024;
const SHA256_HEX = /^[a-f0-9]{64}$/i;

type ProofMode = 'private' | 'shareable';
type Visibility = 'private' | 'unlisted' | 'public';

function asProofMode(raw: string): ProofMode {
  return raw === 'shareable' ? 'shareable' : 'private';
}
function asVisibility(raw: string, mode: ProofMode): Visibility {
  if (mode === 'private') return 'private';
  if (raw === 'public' || raw === 'unlisted') return raw;
  return 'private';
}
function clampFileName(name: string): string {
  // 制御文字・パス区切り・改行を除去し、長さを 240 で切る (ストレージキー安全)
  const stripped = name.replace(/[\u0000-\u001f\u007f/\\]+/g, '_').trim();
  return stripped.length > 240 ? stripped.slice(0, 240) : stripped || 'untitled';
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

  /* ───────── Rate limit (既存) ───────── */
  try {
    const redis = new Redis({
      url: process.env.KV_REST_API_URL || '',
      token: process.env.KV_REST_API_TOKEN || '',
    });
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '10 s'),
      analytics: true,
    });
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const { success } = await ratelimit.limit(`ratelimit_${ip}`);
    if (!success) {
      console.warn(`[RateLimit] Blocked request from IP: ${ip}`);
      return json(429, { error: 'Too many requests. Please wait a few seconds.' });
    }
  } catch (error) {
    console.error('[RateLimit] Bypassing safely:', error);
  }

  /* ───────── multipart parse ───────── */
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json(400, { error: 'Invalid form data. File might be too large (Limit is 4MB).' });
  }

  // クライアントから来る共通フィールド
  const fileEntry = formData.get('file'); // private のときは null
  const title = String(formData.get('title') || '').trim();
  const sha256Raw = String(formData.get('sha256') || formData.get('file_hash') || '').trim().toLowerCase();
  const proofMode = asProofMode(String(formData.get('proofMode') || 'private'));
  const visibility = asVisibility(String(formData.get('visibility') || 'private'), proofMode);
  const metadataJsonRaw = String(formData.get('metadataJson') || '{}');
  const c2paRaw = formData.get('c2paManifest');

  // private モード用の追加フィールド (ファイル本体なしでも file_name / file_size を受ける)
  const declaredFileName = clampFileName(String(formData.get('file_name') || formData.get('original_filename') || ''));
  const declaredFileSizeRaw = String(formData.get('file_size') || formData.get('original_size') || '');

  /* ───────── 共通バリデーション ───────── */
  if (!title) return json(400, { error: 'title is required' });
  if (!sha256Raw) return json(400, { error: 'sha256 is required' });
  if (!SHA256_HEX.test(sha256Raw)) return json(400, { error: 'sha256 must be 64 hex chars (SHA-256)' });

  let parsedMetadata: Record<string, unknown> = {};
  try {
    parsedMetadata = JSON.parse(metadataJsonRaw);
    if (typeof parsedMetadata !== 'object' || parsedMetadata === null || Array.isArray(parsedMetadata)) {
      return json(400, { error: 'metadataJson must be a JSON object' });
    }
  } catch {
    return json(400, { error: 'Invalid metadataJson format' });
  }

  /* ───────── 認証 ───────── */
  let userId = '';
  try {
    userId = await getAuthenticatedUserId(request);
  } catch (error) {
    return json(401, { error: error instanceof Error ? error.message : 'Unauthorized' });
  }

  /* ───────── プロファイル / プラン ───────── */
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan_tier')
    .eq('id', userId)
    .single();
  const planTier = (profile?.plan_tier ?? 'free') as string;

  /* ───────── proofMode 別の入力解釈 ─────────
   *
   *   ① shareable: ファイル本体が必須 → これまでと同じパス
   *   ② private  : ファイル本体は不要 → file_name / file_size を文字列で受け取る
   */
  let resolvedFileName = '';
  let resolvedMime: string | null = null;
  let resolvedSize = 0;
  let shareableFile: File | null = null;

  if (proofMode === 'shareable') {
    if (!fileEntry || typeof fileEntry === 'string' || !('name' in fileEntry)) {
      return json(400, { error: 'file is required for shareable proof' });
    }
    if (fileEntry.size > MAX_FILE_SIZE) {
      return json(413, { error: 'File size exceeds 4MB limit. Please compress the file.' });
    }
    if (!fileEntry.type.startsWith('image/')) {
      return json(400, { error: 'shareable proof requires an image file' });
    }
    shareableFile = fileEntry;
    resolvedFileName = clampFileName(fileEntry.name);
    resolvedMime = fileEntry.type || null;
    resolvedSize = fileEntry.size;
  } else {
    // ── Zero-Knowledge: ファイル実体は受け取らない ──
    if (fileEntry && typeof fileEntry !== 'string' && 'size' in fileEntry) {
      // 互換: 旧クライアントが間違って実体を送ってきても private では捨てる
      console.warn({ event: 'private.file_body_ignored', size: (fileEntry as File).size });
    }
    if (!declaredFileName) {
      return json(400, { error: 'file_name is required (private mode)' });
    }
    const declaredSize = Number.parseInt(declaredFileSizeRaw, 10);
    if (!Number.isFinite(declaredSize) || declaredSize < 0 || declaredSize > MAX_DECLARED_SIZE) {
      return json(400, { error: 'file_size must be a non-negative integer ≤ 500MB' });
    }
    resolvedFileName = declaredFileName;
    resolvedMime = null; // private では mime を信頼しない
    resolvedSize = declaredSize;
  }

  /* ───────── C2PA Gate (差分は最小) ───────── */
  if (c2paRaw instanceof File) {
    console.warn({ event: 'c2pa.binary_field_ignored' });
  }
  const { value: c2paValue, gate } = resolveC2paForPersistence(
    c2paRaw instanceof File ? null : c2paRaw,
    planTier,
  );
  if (gate.kind === 'reject') {
    console.warn({ event: 'c2pa.rejected', reason: gate.reason });
  }

  /* ───────── 重複検出 (sha256 単位) ───────── */
  const duplicate = await supabaseAdmin
    .from('certificates')
    .select('id, public_verify_token, proven_at')
    .eq('sha256', sha256Raw)
    .limit(1)
    .maybeSingle();
  if (duplicate.data) {
    return json(409, {
      error: 'duplicate certificate exists',
      duplicate: true,
      certificate: duplicate.data,
    });
  }

  /* ───────── アップロード (shareable のみ) ───────── */
  const certificateId = crypto.randomUUID();
  const ext = resolvedFileName.split('.').pop()?.toLowerCase() || (proofMode === 'shareable' ? 'png' : 'bin');
  const storagePath = proofMode === 'shareable'
    ? `${userId}/certificates/${certificateId}.${ext}`
    : null;
  let publicImageUrl: string | null = null;

  if (proofMode === 'shareable' && shareableFile && storagePath) {
    const publicPreviewPath = `certificates/${certificateId}.${ext}`;
    const [originalUpload, previewCopy] = await Promise.all([
      supabaseAdmin.storage.from('proofmark-originals').upload(storagePath, shareableFile, {
        upsert: false,
        contentType: shareableFile.type || 'application/octet-stream',
        cacheControl: '31536000',
      }),
      supabaseAdmin.storage.from('proofmark-public').upload(publicPreviewPath, shareableFile, {
        upsert: false,
        contentType: shareableFile.type || 'application/octet-stream',
        cacheControl: '31536000',
      }),
    ]);
    if (originalUpload.error) return json(500, { error: originalUpload.error.message });
    if (previewCopy.error) return json(500, { error: previewCopy.error.message });

    const { data: previewPublicData } = supabaseAdmin.storage
      .from('proofmark-public')
      .getPublicUrl(publicPreviewPath);
    publicImageUrl = previewPublicData.publicUrl;
  }

  /* ───────── INSERT ───────── */
  const { data, error } = await supabaseAdmin
    .from('certificates')
    .insert({
      id: certificateId,
      user_id: userId,
      title,
      sha256: sha256Raw,
      proof_mode: proofMode,
      visibility,
      public_verify_token: crypto.randomUUID(),
      public_image_url: publicImageUrl,
      storage_path: storagePath,
      file_name: resolvedFileName,
      mime_type: resolvedMime,
      file_size: resolvedSize,
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
