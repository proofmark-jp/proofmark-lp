export const config = {
  runtime: 'edge', // Vercel Edge Runtime による爆速起動
};

import { waitUntil } from '@vercel/functions';
import {
  getAuthenticatedUserId,
  getClientIpFromEdgeRequest,
  getOrigin,
  json,
  supabaseAdmin,
  buildEvidenceStep,
} from '../_shared.js';
import { resolveC2paForPersistence } from '../_lib/c2pa-validate.js';
import { checkIpRateLimit } from '../_lib/rate-limit.js';
// 🚨 注意: import crypto from 'node:crypto'; は Edgeでエラーになるため記述しません

/* ─────────────────────────────────────────────
 * Constants & Helpers
 * ───────────────────────────────────────────── */
const MAX_CHAIN_LENGTH = 150;
const SHA256_HEX = /^[a-f0-9]{64}$/i;

function clampFileName(name: string): string {
  const stripped = (name ?? '').replace(/[\u0000-\u001f\u007f/\\]+/g, '_').trim();
  return stripped.length > 240 ? stripped.slice(0, 240) : stripped || 'untitled';
}

class HttpError extends Error {
  constructor(public status: number, public message: string) { super(message); }
}

export interface CreateJsonBody {
  certificateId?: string; 
  bundleId: string;
  title: string;
  description: string;
  isPublic: boolean;
  items: Array<{
    isRoot: boolean;
    sha256: string;
    title: string;
    note: string;
    mimeType: string;
    fileSize: number;
    originalFilename: string;
    thumbnailPath?: string; // 🚨 軽量サムネイルのパスのみを受け取る
    previewUrl?: string;    // 🚨 サムネイルの公開URL
    // storagePath は哲学に基づき完全廃止
  }>;
}

/* ─────────────────────────────────────────────
 * The Decoupled Proof Handler
 * ───────────────────────────────────────────── */
export async function POST(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    /* ── 1. IP Rate Limit ── */
    const ip = getClientIpFromEdgeRequest(request);
    const allowed = await checkIpRateLimit(ip, 'create');
    if (!allowed) throw new HttpError(429, 'Too many requests. Please wait a few seconds.');

    /* ── 2. Auth & Body Parse ── */
    const userId = await getAuthenticatedUserId(request);
    const body = (await request.json()) as CreateJsonBody;
    
    const { bundleId, title, description, isPublic, items } = body;
    if (!bundleId || !title || !items || !Array.isArray(items)) {
      throw new HttpError(400, 'Missing required fields');
    }
    if (items.length === 0 || items.length > MAX_CHAIN_LENGTH) {
      throw new HttpError(400, `Items array must be between 1 and ${MAX_CHAIN_LENGTH}`);
    }

    /* ── 3. 事前重複チェック (The Orphan Defense) ── */
    const newHashes = items.filter(i => !i.isRoot && SHA256_HEX.test(i.sha256)).map(i => i.sha256.toLowerCase());
    if (newHashes.length > 0) {
      const { data: duplicates } = await supabaseAdmin
        .from('certificates')
        .select('sha256')
        .in('sha256', newHashes)
        .limit(1);
      
      if (duplicates && duplicates.length > 0) {
        throw new HttpError(409, 'Duplicate hash detected. One or more files are already registered.');
      }
    }

    /* ── 4. C2PA Gate ── */
    const { data: profile } = await supabaseAdmin.from('profiles').select('plan_tier').eq('id', userId).single();
    const planTier = (profile?.plan_tier ?? 'free') as string;
    const { value: c2paParsed, gate } = resolveC2paForPersistence(null, planTier);

    /* ── 5. Bundle Draft 作成 ── */
    const { error: bundleErr } = await supabaseAdmin.from('process_bundles').upsert({
      id: bundleId,
      user_id: userId,
      certificate_id: body.certificateId ? body.certificateId.replace('root-', '') : null,
      title: title.trim(),
      description: description.trim(),
      is_public: isPublic,
      status: 'draft',
      evidence_mode: 'hash_chain_v1',
    }, { onConflict: 'id' });
    if (bundleErr) throw new HttpError(500, `Bundle creation failed`);

    const certificateRecords: any[] = [];
    const stepRecords: any[] = [];

    let prevStepId: string | null = null;
    let prevChainSha256: string | null = null;
    let rootStepId: string | null = null;

    /* ── 6. インメモリ暗号連鎖計算 (Zero-Knowledge) ── */
    for (const [index, item] of items.entries()) {
      // Edge 環境のグローバル API として crypto.randomUUID() を使用
      const stepId = crypto.randomUUID();
      if (index === 0) rootStepId = stepId;
      
      const certId = item.isRoot && body.certificateId 
        ? body.certificateId.replace('root-', '') 
        : crypto.randomUUID();
        
      const hashData = String(item.sha256).trim().toLowerCase();
      if (!SHA256_HEX.test(hashData)) throw new HttpError(400, `Invalid SHA256 at step ${index}`);

      const declaredFileName = clampFileName(item.originalFilename);

      if (!item.isRoot) {
        if (item.thumbnailPath && (item.thumbnailPath.includes('..') || item.thumbnailPath.split('/')[0] !== userId)) {
          throw new HttpError(403, `Invalid thumbnail path ownership at step ${index}`);
        }

        certificateRecords.push({
          id: certId,
          user_id: userId,
          process_bundle_id: bundleId,
          step_index: index,
          title: String(item.title).trim() || 'untitled',
          sha256: hashData,
          proof_mode: isPublic ? 'shareable' : 'private',
          visibility: isPublic ? 'public' : 'private',
          public_verify_token: crypto.randomUUID(),
          public_image_url: item.previewUrl || null,
          storage_path: null, // 🚨 原本はクラウドに存在しない
          file_name: declaredFileName,
          mime_type: item.mimeType || 'application/octet-stream',
          file_size: item.fileSize || 0,
          c2pa_manifest: c2paParsed,
          metadata_json: {
            upload_pipeline: 'decoupled-proof.v1',
            bundle_id: bundleId,
            step_index: index,
            integrity_model: 'proofmark.chain-ready.v1'
          },
          is_asset_purged: false
        });
      }

      const { payload: chainPayload, chainSha256 } = await buildEvidenceStep({
        bundleId, stepIndex: index, stepType: item.isRoot ? 'other' : 'draft', 
        title: String(item.title).trim(), description: item.note || '',
        sha256: hashData, originalFilename: declaredFileName,
        mimeType: item.mimeType || 'application/octet-stream', fileSize: item.fileSize || 0,
        prevStepId, prevChainSha256,
      });

      stepRecords.push({
        id: stepId, bundle_id: bundleId, user_id: userId, step_index: index,
        step_type: item.isRoot ? 'other' : 'draft', title: String(item.title).trim(),
        description: item.note || '', sha256: hashData, original_filename: declaredFileName,
        mime_type: item.mimeType || 'application/octet-stream', file_size: item.fileSize || 0,
        storage_path: null, // 🚨 原本なし
        preview_url: item.isRoot ? undefined : item.previewUrl,
        prev_step_id: prevStepId, root_step_id: rootStepId,
        prev_chain_sha256: prevChainSha256, chain_sha256: chainSha256,
        chain_payload_json: chainPayload, issued_at: new Date().toISOString(),
      });

      prevStepId = stepId; prevChainSha256 = chainSha256;
    }

    /* ── 7. Bulk DB Insert ── */
    if (certificateRecords.length > 0) {
      const { error: certErr } = await supabaseAdmin.from('certificates').insert(certificateRecords);
      if (certErr) throw new HttpError(500, `Certificates insert failed`);
    }
    const { error: stepErr } = await supabaseAdmin.from('process_bundle_steps').insert(stepRecords);
    if (stepErr) throw new HttpError(500, `Steps insert failed`);

    /* ── 8. Bundle HEAD の確定 ── */
    const headRecord = stepRecords[stepRecords.length - 1];
    const { error: headErr } = await supabaseAdmin.from('process_bundles').update({
        status: 'issued',
        certificate_id: body.certificateId ? body.certificateId.replace('root-', '') : certificateRecords[certificateRecords.length - 1]?.id,
        root_step_id: rootStepId,
        chain_head_step_id: headRecord.id,
        chain_head_sha256:  headRecord.chain_sha256,
        chain_depth:        stepRecords.length,
        chain_verification_status: 'verified',
        chain_verified_at:  new Date().toISOString(),
      }).eq('id', bundleId);
    if (headErr) throw new HttpError(500, `Bundle HEAD update failed`);

    if (body.certificateId) {
      await supabaseAdmin.from('certificates').update({ process_bundle_id: bundleId }).eq('id', body.certificateId.replace('root-', ''));
    }

    /* ── 9. TSA Sync (The Zero-Latency Ignition) ── */
    const appOrigin = getOrigin(request);
    const tsaPromise = fetch(`${appOrigin}/api/timestamp`, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${request.headers.get('authorization')?.replace('Bearer ', '')}` },
      body: JSON.stringify({ 
        certId: certificateRecords[certificateRecords.length - 1]?.id || body.certificateId?.replace('root-', ''), 
        hash: headRecord.chain_sha256 
      }),
      keepalive: true,
    })
    .then(res => res.json())
    .catch(err => console.error('[create-json] TSA Sync failed:', err));

    waitUntil(tsaPromise);

    /* ── 10. Ignition ── */
    return json(200, {
      success: true, bundleId, chainDepth: stepRecords.length, chainHeadSha256: headRecord.chain_sha256,
      certificateId: body.certificateId ? body.certificateId.replace('root-', '') : certificateRecords[certificateRecords.length - 1]?.id,
    });

  } catch (err: any) {
    console.error('[create-json] Error:', err);
    return json(err.status || 500, { error: err.message || 'Internal Server Error' });
  }
}