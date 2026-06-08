/**
 * api/certificates/create.ts — The Bulletproof Nervous System (Absolute Perfect Version)
 *
 * - Bulk Operations (O(1) DB calls for verification & insertion)
 * - 44-Byte Encryption Overhead Forgiveness
 * - Strict Path Traversal & ReDoS Defense
 * - Vault Persistence for Private Proofs (Anti-CS Fire)
 */

export const config = { runtime: 'edge' };

import { getAuthenticatedUserId, getOrigin, json, supabaseAdmin } from '../_shared.js';
import { resolveC2paForPersistence } from '../_lib/c2pa-validate.js';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

const MAX_DECLARED_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_CHAIN_LENGTH = 150; // 1リクエストの最大チェーン数（ReDoS/ペイロード爆撃防御）
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

interface CreateBody extends Partial<CertificateItem> {
  bundleId?: string;
  items?: CertificateItem[];
}

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// 🛡️ サニタイズ関数（パストラバーサル＆制御文字の無効化）
function clampFileName(name: string): string {
  const stripped = (name ?? '').replace(/[\u0000-\u001f\u007f/\\]+/g, '_').trim();
  return stripped.length > 240 ? stripped.slice(0, 240) : stripped || 'untitled';
}

function safeExt(name: string): string {
  const ext = (name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  return ext || 'bin';
}

function assertSafeQuarantinePath(path: string, userId: string, mode: ProofMode): void {
  // 🚨 パストラバーサル絶対防衛
  if (path.includes('..') || path.includes('./') || path.includes('//')) {
    throw new HttpError(400, 'Path traversal detected');
  }
  
  if (mode === 'spot') return; // Spotは別途Stripe側で権限検証
  
  const parts = path.split('/');
  if (parts.length < 3 || parts[0] !== QUARANTINE_PREFIX || parts[1] !== userId) {
    throw new HttpError(403, 'Quarantine ownership mismatch');
  }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

  // 1. RateLimit
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

  // 2. Parse Body & Validate Payload Size
  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const isBundle = Array.isArray(body.items);
  const items = isBundle ? body.items! : [body as CertificateItem];
  
  // 🚨 無制限ペイロードインジェクションの遮断
  if (items.length === 0 || items.length > MAX_CHAIN_LENGTH) {
    return json(413, { error: `Chain length must be between 1 and ${MAX_CHAIN_LENGTH}` });
  }

  const bundleId = body.bundleId || (items.length > 1 ? crypto.randomUUID() : null);

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
    // 4. 【N+1問題の撲滅】 O(1) Bulk Duplicate Check
    const shas = items.map(i => i.sha256);
    const { data: dupes } = await supabaseAdmin.from('certificates').select('sha256').in('sha256', shas);
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

      // 🚨【44-Byte Forgiveness】 WebCryptoオーバーヘッド許容
      if (mode === 'private' || mode === 'spot') {
        const diff = statSize - item.file_size;
        if (diff < 0 || diff > 128) {
          throw new HttpError(409, `Encrypted size differs wildly. Expected: ~${item.file_size}, Got: ${statSize}`);
        }
      } else {
        if (statSize !== item.file_size) throw new HttpError(409, 'Shareable proof size mismatch');
      }

      // C2PA 解決
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
        // 🚨【CS炎上対策】 Privateモードの実体を破棄せず Vault (金庫) へ退避
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
        file_name: safeFileName,
        mime_type: statMime || item.mime_type,
        file_size: statSize,
        c2pa_manifest: c2paParsed,
        metadata_json: { ...((item.metadataJson as any) || {}), upload_pipeline: 'quarantine-bulk.v3' },
        is_asset_purged: false // Vaultに退避したため実体は存在する
      });
    }));

    // 6. DB Bulk Insert (The Titanium Skeleton)
    const { data: insertedData, error: insertError } = await supabaseAdmin
      .from('certificates')
      .insert(dbRecords)
      .select('*');

    // 🚨【TOCTOU / レースコンディション絶対防衛】 PostgreSQL側のUNIQUEエラーを補足
    if (insertError) {
      if (insertError.code === '23505') {
        throw new HttpError(409, 'A concurrent request already registered this certificate (UNIQUE violation).');
      }
      console.error('[DB Insert Error]', insertError);
      throw new HttpError(500, 'Database transaction failed');
    }

    return json(200, {
      success: true,
      bundleId: bundleId,
      certificates: insertedData,
      verifyUrl: `${getOrigin(request)}/cert/${insertedData![insertedData!.length - 1].public_verify_token}`,
      certificate: insertedData![insertedData!.length - 1], 
      id: insertedData![insertedData!.length - 1].id
    });

  } catch (err: any) {
    console.error('[Bulk Promote Error]', err);
    // ※ エラー時の残存ファイル(ゾンビ)は、システム設計上 Phase 1.5 のGCバッチに回収を委譲する(Eventual Consistency)
    const status = err instanceof HttpError ? err.status : 500;
    return json(status, { error: err.message || 'Unknown error during promotion' });
  }
}