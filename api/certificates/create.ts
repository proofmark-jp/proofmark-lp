/**
 * api/certificates/create.ts — Zero-Copy Promote
 *
 * - FormData / file 本体は一切受け取らない (JSON only)
 * - クライアントは { quarantinePath, sha256, ... } のみ送信
 * - Supabase SDK の move/copy でメタのみ移動 (バイト本体はストリーミングされない)
 * - shareable: quarantine -> proofmark-public/certificates/{id}.ext
 * - private  : quarantine を最終領域 proofmark-originals/{userId}/{id}.ext へ昇格
 *              （※ Zero-Knowledge ポリシーで「保存しない」運用にする場合は remove のみ）
 *
 * runtime: edge (バイト本体を扱わないため Edge で問題なし)
 */

export const config = { runtime: 'edge' };

import { getAuthenticatedUserId, getOrigin, json, supabaseAdmin } from '../_shared.js';
import { resolveC2paForPersistence } from '../_lib/c2pa-validate.js';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

/* ─────────────────────────────────────────────
 *  Constants
 * ───────────────────────────────────────────── */

const SHA256_HEX = /^[a-f0-9]{64}$/i;
const MAX_DECLARED_SIZE = 500 * 1024 * 1024; // 500MB
const ORIGINALS_BUCKET = 'proofmark-originals';
const PUBLIC_BUCKET = 'proofmark-public';
const QUARANTINE_PREFIX = 'quarantine';
/** quarantine 内のオブジェクト存在を確認する許容ウィンドウ (ms) */
const QUARANTINE_FRESHNESS_MS = 30 * 60 * 1000; // 30 min

type ProofMode = 'private' | 'shareable';
type Visibility = 'private' | 'unlisted' | 'public';

interface CreateBody {
  /** 隔離パス: "quarantine/{userId}/{uuid}.ext" */
  quarantinePath: string;
  /** SHA-256 hex (64 chars) — クライアント側で hashWorker が出した値 */
  sha256: string;
  /** ユーザ表示用タイトル */
  title: string;
  /** モード */
  proofMode: ProofMode;
  /** 公開設定 */
  visibility?: Visibility;
  /** 元ファイル名 (UI 表示用) */
  file_name: string;
  /** バイト数 */
  file_size: number;
  /** MIME (申告値) */
  mime_type?: string | null;
  /** メタ JSON */
  metadataJson?: Record<string, unknown> | null;
  /** C2PA manifest (文字列 / null) */
  c2paManifest?: string | null;
}

/* ─────────────────────────────────────────────
 *  Helpers
 * ───────────────────────────────────────────── */

function clampFileName(name: string): string {
  const stripped = (name ?? '').replace(/[\u0000-\u001f\u007f/\\]+/g, '_').trim();
  return stripped.length > 240 ? stripped.slice(0, 240) : stripped || 'untitled';
}

function safeExt(name: string): string {
  const ext = (name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  return ext || 'bin';
}

function normalizeProofMode(raw: unknown): ProofMode {
  return raw === 'shareable' ? 'shareable' : 'private';
}

function normalizeVisibility(raw: unknown, mode: ProofMode): Visibility {
  if (mode === 'private') return 'private';
  if (raw === 'public' || raw === 'unlisted') return raw;
  return 'private';
}

/**
 * quarantine path が「期待される命名規約」かつ「呼び出し元 user のものか」を保証する。
 * `quarantine/{userId}/{anything}` 以外を一切受け入れない。
 */
function assertQuarantineOwnership(path: string, userId: string): void {
  const parts = path.split('/');
  if (parts.length < 3) throw new HttpError(400, 'invalid quarantine path');
  if (parts[0] !== QUARANTINE_PREFIX) throw new HttpError(400, 'path must start with quarantine/');
  if (parts[1] !== userId) throw new HttpError(403, 'quarantine ownership mismatch');
  if (parts.some((seg) => seg === '' || seg === '..' || seg === '.' || seg.includes('\\'))) {
    throw new HttpError(400, 'path traversal detected');
  }
}

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/* ─────────────────────────────────────────────
 *  Quarantine stat (SDK list with prefix)
 *  Supabase JS v2 は HEAD オブジェクトを直接サポートしないため、
 *  親 prefix を list して file 名一致と更新時刻を確認する。
 * ───────────────────────────────────────────── */

interface QuarantineStat {
  size: number;
  lastModified: Date;
  contentType: string | null;
}

async function statQuarantineObject(path: string): Promise<QuarantineStat> {
  const lastSlash = path.lastIndexOf('/');
  const parent = path.slice(0, lastSlash);
  const name = path.slice(lastSlash + 1);

  const { data, error } = await supabaseAdmin.storage
    .from(ORIGINALS_BUCKET)
    .list(parent, { search: name, limit: 1 });

  if (error || !data || data.length === 0) {
    throw new HttpError(404, 'quarantine object not found');
  }
  const entry = data.find((e) => e.name === name);
  if (!entry) throw new HttpError(404, 'quarantine object not found (exact)');

  const size = (entry.metadata as { size?: number } | null)?.size ?? 0;
  const lastModifiedRaw = entry.updated_at ?? entry.created_at ?? new Date().toISOString();
  const lastModified = new Date(lastModifiedRaw);
  const ageMs = Date.now() - lastModified.getTime();
  if (ageMs > QUARANTINE_FRESHNESS_MS) {
    throw new HttpError(410, 'quarantine object is too old (must be promoted within 30 min)');
  }

  const contentType = (entry.metadata as { mimetype?: string } | null)?.mimetype ?? null;
  return { size, lastModified, contentType };
}

/* ─────────────────────────────────────────────
 *  Zero-copy promote
 *
 *  Supabase Storage の copy/move はサーバサイドでメタのみ更新する S3 ライク API。
 *  Edge ランタイムにバイトを流さないため Vercel メモリは増えない。
 * ───────────────────────────────────────────── */

async function promoteFromQuarantine(args: {
  quarantinePath: string;
  certId: string;
  fileExt: string;
  proofMode: ProofMode;
  userId: string;
}): Promise<{
  storagePath: string | null;
  publicImageUrl: string | null;
}> {
  const { quarantinePath, certId, fileExt, proofMode, userId } = args;

  if (proofMode === 'shareable') {
    // shareable: public bucket へ copy → quarantine を remove
    const publicPath = `certificates/${certId}.${fileExt}`;
    const { error: copyErr } = await supabaseAdmin.storage
      .from(ORIGINALS_BUCKET)
      .copy(quarantinePath, publicPath, { destinationBucket: PUBLIC_BUCKET });
    if (copyErr) throw new HttpError(500, `copy failed: ${copyErr.message}`);

    // 同時に originals 側にも保管 (改ざん検証用バックアップ)
    const originalsLivePath = `${userId}/certificates/${certId}.${fileExt}`;
    const { error: moveErr } = await supabaseAdmin.storage
      .from(ORIGINALS_BUCKET)
      .move(quarantinePath, originalsLivePath);
    if (moveErr) {
      // public への copy は成功している。original 側だけ失敗してもユーザ操作は止めない。
      console.error('[promote] originals move failed (kept quarantine)', moveErr);
    }

    const { data: publicData } = supabaseAdmin.storage.from(PUBLIC_BUCKET).getPublicUrl(publicPath);
    return {
      storagePath: originalsLivePath,
      publicImageUrl: publicData.publicUrl,
    };
  }

  // private: Zero-Knowledge ポリシー
  //   現行仕様では原本サーバ保存を最小化したいので、quarantine は破棄する。
  //   将来「Private でも自分専用に保持」したい要件が来たら下の remove を move に差し替える。
  const { error: rmErr } = await supabaseAdmin.storage.from(ORIGINALS_BUCKET).remove([quarantinePath]);
  if (rmErr) console.error('[promote] quarantine remove failed (private mode)', rmErr);

  return { storagePath: null, publicImageUrl: null };
}

/* ─────────────────────────────────────────────
 *  Handler
 * ───────────────────────────────────────────── */

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

  /* ── Rate limit (best effort) ── */
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
    const { success } = await ratelimit.limit(`pm_create_${ip}`);
    if (!success) {
      return json(429, { error: 'Too many requests. Please wait a few seconds.' });
    }
  } catch (e) {
    console.error('[RateLimit] bypass', e);
  }

  /* ── JSON parse (ファイルは入っていない) ── */
  let body: CreateBody;
  try {
    const ctype = request.headers.get('content-type') || '';
    if (!ctype.includes('application/json')) {
      return json(400, { error: 'Content-Type must be application/json' });
    }
    body = (await request.json()) as CreateBody;
  } catch {
    return json(400, { error: 'invalid JSON body' });
  }

  /* ── 認証 ── */
  let userId = '';
  try {
    userId = await getAuthenticatedUserId(request);
  } catch (err) {
    return json(401, { error: err instanceof Error ? err.message : 'Unauthorized' });
  }

  /* ── 入力バリデーション ── */
  const proofMode = normalizeProofMode(body.proofMode);
  const visibility = normalizeVisibility(body.visibility, proofMode);
  const title = String(body.title ?? '').trim();
  const sha256 = String(body.sha256 ?? '').trim().toLowerCase();
  const declaredFileName = clampFileName(String(body.file_name ?? ''));
  const declaredSize = Number(body.file_size ?? 0);
  const declaredMime = String(body.mime_type ?? '').trim() || 'application/octet-stream';
  const quarantinePath = String(body.quarantinePath ?? '');
  const metadataJson = (body.metadataJson && typeof body.metadataJson === 'object')
    ? (body.metadataJson as Record<string, unknown>)
    : {};

  if (!title) return json(400, { error: 'title is required' });
  if (!SHA256_HEX.test(sha256)) return json(400, { error: 'sha256 must be 64 hex chars' });
  if (!declaredFileName) return json(400, { error: 'file_name is required' });
  if (!Number.isFinite(declaredSize) || declaredSize < 0 || declaredSize > MAX_DECLARED_SIZE) {
    return json(400, { error: 'file_size out of range' });
  }
  if (!quarantinePath) return json(400, { error: 'quarantinePath is required' });

  try {
    assertQuarantineOwnership(quarantinePath, userId);
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message });
    return json(400, { error: 'invalid quarantine path' });
  }

  /* ── プロファイル ── */
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan_tier')
    .eq('id', userId)
    .single();
  const planTier = (profile?.plan_tier ?? 'free') as string;

  /* ── 重複 SHA-256 ── */
  const duplicate = await supabaseAdmin
    .from('certificates')
    .select('id, public_verify_token, proven_at')
    .eq('sha256', sha256)
    .limit(1)
    .maybeSingle();
  if (duplicate.data) {
    // 失敗時は quarantine を残さない (孤立オブジェクト防止)
    await supabaseAdmin.storage.from(ORIGINALS_BUCKET).remove([quarantinePath]).catch(() => undefined);
    return json(409, {
      error: 'duplicate certificate exists',
      duplicate: true,
      certificate: duplicate.data,
    });
  }

  /* ── quarantine stat (改ざん検知 / 経過時間) ── */
  let stat: QuarantineStat;
  try {
    stat = await statQuarantineObject(quarantinePath);
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message });
    return json(500, { error: 'quarantine stat failed' });
  }

  // 申告サイズとの突合 (タンパー検知)
  if (stat.size !== declaredSize) {
    await supabaseAdmin.storage.from(ORIGINALS_BUCKET).remove([quarantinePath]).catch(() => undefined);
    return json(409, {
      error: 'declared_size mismatch with uploaded object',
      details: { declared: declaredSize, observed: stat.size },
    });
  }

  // shareable は画像のみ
  if (proofMode === 'shareable') {
    const liveMime = (stat.contentType || declaredMime).toLowerCase();
    if (!liveMime.startsWith('image/')) {
      await supabaseAdmin.storage.from(ORIGINALS_BUCKET).remove([quarantinePath]).catch(() => undefined);
      return json(400, { error: 'shareable proof requires an image file' });
    }
  }

  /* ── C2PA gate ── */
  const { value: c2paValue, gate } = resolveC2paForPersistence(
    typeof body.c2paManifest === 'string' ? body.c2paManifest : null,
    planTier,
  );
  if (gate.kind === 'reject') {
    console.warn({ event: 'c2pa.rejected', reason: gate.reason });
  }

  /* ── Promote: zero-copy ── */
  const certificateId = crypto.randomUUID();
  const fileExt = safeExt(declaredFileName);

  let promoteResult: { storagePath: string | null; publicImageUrl: string | null };
  try {
    promoteResult = await promoteFromQuarantine({
      quarantinePath,
      certId: certificateId,
      fileExt,
      proofMode,
      userId,
    });
  } catch (e) {
    return json(500, {
      error: 'promote failed',
      details: e instanceof Error ? e.message : 'unknown',
    });
  }

  /* ── INSERT ── */
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
      public_image_url: promoteResult.publicImageUrl,
      storage_path: promoteResult.storagePath,
      file_name: declaredFileName,
      mime_type: stat.contentType || declaredMime,
      file_size: stat.size,
      metadata_json: {
        ...metadataJson,
        integrity_model: 'proofmark.chain-ready.v1',
        upload_pipeline: 'quarantine-promote.v1',
        quarantine_path: quarantinePath,
      },
      c2pa_manifest: c2paValue,
    })
    .select('*')
    .single();

  if (error) {
    // INSERT に失敗したら、promote した本番ファイルも掃除して整合性を保つ
    if (promoteResult.storagePath) {
      await supabaseAdmin.storage.from(ORIGINALS_BUCKET).remove([promoteResult.storagePath]).catch(() => undefined);
    }
    if (proofMode === 'shareable') {
      await supabaseAdmin.storage.from(PUBLIC_BUCKET).remove([`certificates/${certificateId}.${fileExt}`]).catch(() => undefined);
    }
    return json(500, { error: error.message });
  }

  return json(200, {
    certificate: data,
    verifyUrl: `${getOrigin(request)}/cert/${data.public_verify_token}`,
  });
}
