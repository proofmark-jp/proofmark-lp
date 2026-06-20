export const config = { runtime: 'edge' };

import { getAuthenticatedUserId, getClientIpFromEdgeRequest, json, supabaseAdmin } from '../_shared.js';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { checkIpRateLimit } from '../_lib/rate-limit.js';
import crypto from 'crypto';

const PUBLIC_BUCKET = 'proofmark-public';

// 🚨 究極の防衛線：Trojan Horse と サムネイルの最適上限
const MAX_HEAD_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_THUMB_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_TOTAL_PAYLOAD = 200 * 1024 * 1024; // 200MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export interface UploadUrlBody {
  bundleId: string;
  proofMode?: string; // 🚨 Spot判定用
  files: Array<{
    fileName: string;
    mimeType: string;
    fileSize: number;
    isHead: boolean;
  }>;
}

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function POST(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

  // 1. IP Rate Limit (DDoS防衛)
  const ip = getClientIpFromEdgeRequest(request);
  const allowed = await checkIpRateLimit(ip, 'upload');
  if (!allowed) return json(429, { error: 'Too many requests' });

  // 2. Upstash Redis Spike Defense (フェイルオープン)
  try {
    const redis = new Redis({ url: process.env.KV_REST_API_URL || '', token: process.env.KV_REST_API_TOKEN || '' });
    const ratelimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '10 s'), analytics: false });
    const { success } = await ratelimit.limit(`pm_url_${ip}`);
    if (!success) return json(429, { error: 'Too many requests. Please wait.' });
  } catch (e) { console.warn('[RateLimit bypass]', e); }

  try {
    // 3. Body Parse
    const body = (await request.json()) as UploadUrlBody;
    const { bundleId, files, proofMode } = body;
    if (!bundleId || !files || !Array.isArray(files) || files.length === 0) throw new HttpError(400, 'Missing fields');
    if (files.length > 151) throw new HttpError(413, 'Too many files');

    const isSpot = proofMode === 'spot';

    // 4. Auth & Spot Guest Bypass
    let userId = '';
    try {
      userId = await getAuthenticatedUserId(request);
    } catch (err) {
      if (isSpot) userId = `guest_spot_${crypto.randomUUID()}`; // 🚨 Spotユーザーの救済
      else throw new HttpError(401, 'Unauthorized');
    }

    // 5. Pre-Quota Defense (🚨 復活: 原価防衛線。Spot以外はDBの枠を確認)
    if (!isSpot) {
      const { data: profile } = await supabaseAdmin.from('profiles').select('plan_tier').eq('id', userId).maybeSingle();
      const planTier = profile?.plan_tier ?? 'free';
      
      let limit = 3;
      if (planTier === 'admin') limit = 99999;
      else if (planTier === 'business') limit = 1000;
      else if (planTier === 'studio') limit = 150;
      else if (planTier === 'creator') limit = 30;

      const { count } = await supabaseAdmin
        .from('certificates').select('*', { count: 'exact', head: true })
        .eq('user_id', userId).neq('proof_mode', 'spot')
        .gte('created_at', new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })).toISOString().substring(0, 8) + '01T00:00:00Z');

      const used = count || 0;
      if (used + 1 > limit) { // バンドル全体で1カウントとみなす
        throw new HttpError(403, `Monthly limit exceeded. Plan: ${planTier}, Used: ${used}, Limit: ${limit}`);
      }
    }

    // 6. Payload & MIME Defense (200MB / 20MB / 2MB)
    let totalPayload = 0;
    for (const [index, file] of files.entries()) {
      if (!ALLOWED_MIME_TYPES.includes(file.mimeType)) {
        throw new HttpError(415, `Unsupported MIME type: ${file.mimeType}`);
      }
      const maxSize = file.isHead ? MAX_HEAD_SIZE : MAX_THUMB_SIZE;
      if (file.fileSize > maxSize) {
        throw new HttpError(413, `File ${file.fileName} exceeds size limit (${file.isHead ? '20MB' : '2MB'})`);
      }
      totalPayload += file.fileSize;
    }
    if (totalPayload > MAX_TOTAL_PAYLOAD) throw new HttpError(413, 'Total payload exceeds 200MB limit.');

    // 7. Generate Signed URLs (Publicバケット直通)
    const urls = await Promise.all(
      files.map(async (file) => {
        const ext = file.fileName.split('.').pop()?.toLowerCase() || 'bin';
        const safeExt = ext.replace(/[^a-z0-9]/g, '').slice(0, 8);
        const prefix = file.isHead ? 'head' : 'thumb';
        const storagePath = `${userId}/bundles/${bundleId}/${prefix}_${crypto.randomUUID()}.${safeExt}`;

        const { data, error } = await supabaseAdmin.storage.from(PUBLIC_BUCKET).createSignedUploadUrl(storagePath);
        if (error || !data) throw new HttpError(500, `Failed to sign URL for ${file.fileName}`);

        const supabaseBaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, "");
        return {
          originalFileName: file.fileName,
          signedUrl: data.signedUrl,
          storagePath: storagePath,
          publicUrl: `${supabaseBaseUrl}/storage/v1/object/public/${PUBLIC_BUCKET}/${storagePath}`,
          isHead: file.isHead
        };
      })
    );

    return json(200, { success: true, urls });
  } catch (err: any) {
    return json(err.status || 500, { error: err.message || 'Internal Server Error' });
  }
}