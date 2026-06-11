/**
 * api/certificates/create.ts — The Bulletproof Nervous System (Array Multiplexer)
 *
 * - Bulk Operations (O(1) DB calls for verification & insertion)
 * - 44-Byte Encryption Overhead Forgiveness
 * - Strict Path Traversal & CPU Starvation Defense
 * - Vault Persistence for Private Proofs (Anti-CS Fire)
 */

// 🚨 Vercel / Next.js の 413 Payload Too Large エラーを回避するため、
// JSONボディの受信上限をデフォルトの 1MB から 10MB に引き上げる
export const config = {
  runtime: 'edge',
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

import { getAuthenticatedUserId, getOrigin, json, supabaseAdmin } from '../_shared.js';
import { resolveC2paForPersistence } from '../_lib/c2pa-validate.js';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

const MAX_CHAIN_LENGTH = 150; // 1リクエストの最大チェーン数
const MAX_JSON_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2MB (CPU Starvation Defense)
const ORIGINALS_BUCKET = 'proofmark-originals';
const PUBLIC_BUCKET = 'proofmark-public';
const QUARANTINE_PREFIX = 'quarantine';

type ProofMode = 'private' | 'shareable' | 'spot';
type Visibility = 'private' | 'unlisted' | 'public';

interface CertificateItem {
  quarantinePath: string;
  sha256: string;
  title: string;
  proofMode: ProofMode;
  visibility?: Visibility;
  file_name: string;
  file_size: number;
  mime_type?: string | null;
  metadataJson?: Record<string, unknown> | null;
  c2paManifest?: string | Record<string, unknown> | null;
  stepIndex?: number;
}

interface CreateBody {
  bundleId?: string;
  items?: CertificateItem[];
  quarantinePath?: string;
}

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function clampFileName(name: string): string {
  const stripped = (name ?? '').replace(/[\u0000-\u001f\u007f/\\]+/g, '_').trim();
  return stripped.length > 240 ? stripped.slice(0, 240) : stripped || 'untitled';
}

function safeExt(name: string): string {
  const ext = (name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  return ext || 'bin';
}

function assertSafeQuarantinePath(path: string, userId: string, mode: ProofMode): void {
  if (path.includes('..') || path.includes('./') || path.includes('//')) {
    throw new HttpError(400, 'Path traversal detected');
  }
  if (mode === 'spot') return;
  const parts = path.split('/');
  if (parts.length < 3 || parts[0] !== QUARANTINE_PREFIX || parts[1] !== userId) {
    throw new HttpError(403, 'Quarantine ownership mismatch');
  }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

  // 1. Edge Rate Limiting
  try {
    const redis = new Redis({
      url: process.env.KV_REST_API_URL || '',
      token: process.env.KV_REST_API_TOKEN || '',
    });
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '10 s'),
      analytics: true,
    });
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const { success } = await ratelimit.limit(`pm_create_${ip}`);
    if (!success) return json(429, { error: 'Too many requests.' });
  } catch (e) { console.warn('[RateLimit bypass]', e); }

  // 2. CPU Starvation Defense (巨大JSONによるEdgeフリーズ攻撃の遮断)
  let body: CreateBody;
  try {
    const rawText = await request.text();
    
    // 🚨 診断パッチ: 実際に送られてきたサイズをログに出力する
    console.log(`[Diagnostic] Received Payload Size: ${rawText.length} bytes`);

    // 🚨 一時的に自陣の制限を 10MB に引き上げて様子を見る
    if (rawText.length > 10 * 1024 * 1024) { 
      return json(413, { error: `Payload too large (JSON is ${rawText.length} bytes)` });
    }
    body = JSON.parse(rawText) as CreateBody;
  } catch (e) {
    return json(400, { error: 'Invalid JSON body' });
  }

  // 👑 Dashboard(単一) と Composer(複数) の両方のフォーマットを吸収する
  let items: CertificateItem[] = [];
  if (Array.isArray(body.items)) {
    items = body.items; // Composerからの配列
  } else if (body.quarantinePath) {
    items = [body as unknown as CertificateItem]; // Dashboardからの単一オブジェクトを配列に包む
  }

  // 🚨 エラーコードを 413 から 400 に修正（インフラエラーとの混同を防ぐ）
  if (items.length === 0 || items.length > MAX_CHAIN_LENGTH) {
    return json(400, { error: `Invalid payload or chain length (must be 1-${MAX_CHAIN_LENGTH})` });
  }

  const bundleId = body.bundleId || crypto.randomUUID();

  // 3. Auth
  let userId = '';
  const isSpot = items.some(i => i.proofMode === 'spot');
  if (!isSpot) {
    try {
      userId = await getAuthenticatedUserId(request);
    } catch (err) {
      return json(401, { error: 'Unauthorized' });
    }
  }

  const { data: profile } = await supabaseAdmin.from('profiles').select('plan_tier').eq('id', userId).maybeSingle();
  const planTier = profile?.plan_tier ?? 'free';

  try {
    // 4. O(1) Bulk Duplicate Check
    const shas = items.map(i => i.sha256);
    const { data: dupes } = await supabaseAdmin.from('certificates').select('sha256, certified_at').in('sha256', shas);
    if (dupes && dupes.length > 0) {
      throw new HttpError(409, `Duplicate certificate(s) exists for sha256: ${dupes.map(d => d.sha256).join(', ')}`);
    }

    // 5. 並列 Quarantine Stat & Promote
    const dbRecords: any[] = [];

    await Promise.all(items.map(async (item, index) => {
      const mode = item.proofMode === 'shareable' ? 'shareable' : (item.proofMode === 'spot' ? 'spot' : 'private');
      assertSafeQuarantinePath(item.quarantinePath, userId, mode);

      const nameToFetch = item.quarantinePath.split('/').pop()!;
      const parentDir = item.quarantinePath.slice(0, item.quarantinePath.lastIndexOf('/'));
      const { data: qData, error: qErr } = await supabaseAdmin.storage.from(ORIGINALS_BUCKET).list(parentDir, { search: nameToFetch, limit: 1 });
      
      if (qErr || !qData || qData.length === 0) throw new HttpError(404, `Quarantine object not found: ${nameToFetch}`);
      const entry = qData.find((e) => e.name === nameToFetch);
      if (!entry) throw new HttpError(404, 'Quarantine object not found (exact)');

      const statSize = (entry.metadata as any)?.size ?? 0;
      const statMime = (entry.metadata as any)?.mimetype ?? null;

      // 44-Byte Forgiveness (WebCrypto Overhead)
      if (mode === 'private' || mode === 'spot') {
        const diff = statSize - item.file_size;
        if (diff < 0 || diff > 128) {
          throw new HttpError(409, `Encrypted size differs wildly. Expected: ~${item.file_size}, Got: ${statSize}`);
        }
      } else {
        if (statSize !== item.file_size) throw new HttpError(409, 'Shareable proof size mismatch');
      }

      // C2PA 解析
      let c2paParsed = null;
      if (item.c2paManifest) {
        c2paParsed = typeof item.c2paManifest === 'string' ? JSON.parse(item.c2paManifest) : item.c2paManifest;
        const { value, gate } = resolveC2paForPersistence(c2paParsed, planTier);
        if (gate.kind !== 'reject') c2paParsed = value;
      }

      // Zero-Copy Promote
      const certId = crypto.randomUUID();
      const safeFileName = clampFileName(item.file_name);
      const ext = safeExt(safeFileName);
      let storagePath = null;
      let publicImageUrl = null;

      if (mode === 'shareable') {
        const publicPath = `certificates/${certId}.${ext}`;
        await supabaseAdmin.storage.from(ORIGINALS_BUCKET).copy(item.quarantinePath, publicPath, { destinationBucket: PUBLIC_BUCKET });
        storagePath = `${userId || 'spot'}/certificates/${certId}.${ext}`;
        await supabaseAdmin.storage.from(ORIGINALS_BUCKET).move(item.quarantinePath, storagePath);
        
        const { data: pubUrl } = supabaseAdmin.storage.from(PUBLIC_BUCKET).getPublicUrl(publicPath);
        publicImageUrl = pubUrl.publicUrl;
      } else {
        storagePath = `${userId || 'spot'}/vault/${certId}.${ext}`;
        await supabaseAdmin.storage.from(ORIGINALS_BUCKET).move(item.quarantinePath, storagePath);
      }

      dbRecords.push({
        id: certId,
        user_id: userId || null,
        bundle_id: bundleId,
        step_index: item.stepIndex ?? index,
        title: item.title,
        proof_mode: mode,
        visibility: mode === 'shareable' ? (item.visibility || 'public') : 'private',
        sha256: item.sha256,
        public_verify_token: crypto.randomUUID(),
        storage_path: storagePath,
        public_image_url: publicImageUrl,
        original_filename: safeFileName,
        mime_type: statMime || item.mime_type,
        file_size: statSize,
        c2pa_manifest: c2paParsed,
        metadata: {
          ...((item.metadataJson as any) || {}),
          upload_pipeline: 'quarantine-bulk.v3',
          bundle_id: bundleId,
          step_index: item.stepIndex ?? index
        },
        is_asset_purged: false
      });
    }));

    // 6. Bulk Insert
    const { data: insertedData, error: insertError } = await supabaseAdmin
      .from('certificates')
      .insert(dbRecords)
      .select('*');

    if (insertError) {
      if (insertError.code === '23505') throw new HttpError(409, 'Concurrent request conflict (UNIQUE violation).');
      console.error('[DB Insert Error]', insertError);
      throw new HttpError(500, 'Database transaction failed');
    }

    return json(200, {
      success: true,
      bundleId: bundleId,
      certificates: insertedData,
      verifyUrl: `${getOrigin(request)}/cert/${insertedData![insertedData!.length - 1].public_verify_token}`
    });

  } catch (err: any) {
    console.error('[Bulk Promote Error]', err);
    const status = err instanceof HttpError ? err.status : 500;
    return json(status, { error: err.message || 'Unknown error during promotion' });
  }
}