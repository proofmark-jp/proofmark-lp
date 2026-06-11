/**
 * api/upload-url.ts — The Titanium Gate (Phase 2.6)
 *
 * - Aggregate Payload Bomb Defense (Total Batch Size Limit)
 * - Spot Guest VIP Route (Unauthenticated Checkout Bypass)
 * - Edge Runtime / Array Multiplexer / Pre-Quota Check
 */

export const config = { runtime: 'edge' };

import { getAuthenticatedUserId, json, supabaseAdmin } from './_shared.js';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

const BUCKET = 'proofmark-originals';
const QUARANTINE_PREFIX = 'quarantine';
const SIGNED_URL_TTL_SEC = 60 * 15; // 15 min
const MAX_DECLARED_SIZE = 500 * 1024 * 1024; // 1ファイルの最大 (500MB)
const MAX_BATCH_SIZE = 150; // 1リクエストの最大枚数
const MAX_TOTAL_BATCH_BYTES = 2 * 1024 * 1024 * 1024; // 🚨 防衛線: 1リクエストの合計最大 (2GB)

const ALLOWED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic', 'heif',
  'pdf', 'zip', 'mp4', 'webm', 'bin'
]);

interface FileRequest {
  fileName: string;
  mimeType: string;
  fileSize: number;
}

interface UploadUrlBody {
  items?: FileRequest[];
  proofMode?: string; // 🚨 Spot判定用に追加
  // 後方互換用
  fileName?: string; filename?: string;
  mimeType?: string; contentType?: string;
  fileSize?: number; size?: number;
}

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function getSafeExtension(filename: string): string {
  const parts = (filename || '').split('.');
  if (parts.length < 2) return 'bin';
  const ext = parts.pop()!.toLowerCase().replace(/[^a-z0-9]/g, '');
  return ALLOWED_EXTENSIONS.has(ext) ? ext : 'bin';
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

  // 1. Edge Rate Limiting (IPベースのスパム防衛)
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
    const { success } = await ratelimit.limit(`pm_url_${ip}`);
    if (!success) return json(429, { error: 'Too many requests. Please wait.' });
  } catch (e) { console.warn('[RateLimit bypass]', e); }

  try {
    // 2. Body Parsing & Normalization
    const body = (await request.json()) as UploadUrlBody;
    const items: FileRequest[] = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      const singleName = body.fileName || body.filename;
      const singleMime = body.mimeType || body.contentType;
      const singleSize = body.fileSize ?? body.size ?? 0;
      if (singleName && singleMime) {
        items.push({ fileName: singleName.toString(), mimeType: singleMime.toString(), fileSize: Number(singleSize) });
      }
    }

    if (items.length === 0) throw new HttpError(400, 'No valid files requested');
    if (items.length > MAX_BATCH_SIZE) throw new HttpError(413, `Cannot request more than ${MAX_BATCH_SIZE} URLs at once`);

    const isSpot = body.proofMode === 'spot';

    // 3. Auth & Spot Guest Bypass
    let userId = '';
    try {
      userId = await getAuthenticatedUserId(request);
    } catch (err) {
      // 🚨 ファウンダー防衛: ゲストSpotの場合は認証エラーを許容し、一時的な匿名IDを付与する
      if (isSpot) {
        userId = `guest_spot_${crypto.randomUUID()}`;
      } else {
        throw new HttpError(401, 'Unauthorized to upload');
      }
    }

    // 4. Pre-Quota Defense (Spot以外の場合のみ残機チェック)
    if (!isSpot) {
      const { data: profile } = await supabaseAdmin.from('profiles').select('plan_tier').eq('id', userId).maybeSingle();
      const planTier = profile?.plan_tier ?? 'free';
      
      let limit = 3;
      if (planTier === 'admin') limit = 99999;
      else if (planTier === 'business') limit = 1000;
      else if (planTier === 'studio') limit = 150;
      else if (planTier === 'creator') limit = 30;

      const { count } = await supabaseAdmin
        .from('certificates')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .neq('proof_mode', 'spot')
        .gte('created_at', new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })).toISOString().substring(0, 8) + '01T00:00:00Z');

      const used = count || 0;
      if (used + items.length > limit) {
        throw new HttpError(403, `Monthly limit exceeded. Plan: ${planTier}, Used: ${used}, Requested: ${items.length}, Limit: ${limit}`);
      }
    }

    // 5. Aggregate Size Defense (The 75GB Bomb Defusal)
    let totalBatchSize = 0;
    const results = await Promise.all(items.map(async (item) => {
      if (item.fileSize < 0 || item.fileSize > MAX_DECLARED_SIZE) {
        throw new HttpError(413, `File size out of bounds for ${item.fileName}`);
      }
      
      // 🚨 合計サイズストッパー (2GBを超えたら即死)
      totalBatchSize += item.fileSize;
      if (totalBatchSize > MAX_TOTAL_BATCH_BYTES) {
        throw new HttpError(413, `Total batch size exceeds the 2GB maximum limit.`);
      }

      const ext = getSafeExtension(item.fileName);
      const uuid = crypto.randomUUID();
      const quarantinePath = `${QUARANTINE_PREFIX}/${userId}/${uuid}.${ext}`;

      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUploadUrl(quarantinePath);

      if (error || !data) throw new HttpError(500, `Failed to sign URL for ${item.fileName}`);

      return {
        fileName: item.fileName,
        signedUrl: data.signedUrl,
        quarantinePath,
        bucket: BUCKET
      };
    }));

    return json(200, {
      success: true,
      ttlSeconds: SIGNED_URL_TTL_SEC,
      urls: results,
      // 旧式UI後方互換用
      signedUrl: results[0].signedUrl,
      quarantinePath: results[0].quarantinePath,
      bucket: results[0].bucket
    });

  } catch (err: any) {
    const status = err instanceof HttpError ? err.status : 500;
    return json(status, { error: err.message || 'Internal Server Error' });
  }
}