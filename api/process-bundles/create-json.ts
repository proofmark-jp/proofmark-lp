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
  revision?: number;
  items: Array<{
    id: string;
    isRoot: boolean;
    sha256: string;
    title: string;
    note: string;
    mimeType: string;
    fileSize: number;
    fileName?: string;
    originalFilename?: string;
    stepType?: string; 
    thumbnailPath?: string;
    previewUrl?: string;
  }>;
}

/* ─────────────────────────────────────────────
 * The Decoupled Proof Handler
 * ───────────────────────────────────────────── */
export async function POST(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const ip = getClientIpFromEdgeRequest(request);
    const allowed = await checkIpRateLimit(ip, 'create');
    if (!allowed) throw new HttpError(429, 'Too many requests. Please wait a few seconds.');

    const userId = await getAuthenticatedUserId(request);
    const body = (await request.json()) as CreateJsonBody;
    
    const { bundleId, title, description, isPublic, items } = body;
    if (!bundleId || !title || !items || !Array.isArray(items)) {
      throw new HttpError(400, 'Missing required fields');
    }
    if (items.length === 0 || items.length > MAX_CHAIN_LENGTH) {
      throw new HttpError(400, `Items array must be between 1 and ${MAX_CHAIN_LENGTH}`);
    }

    const newHashes = items.filter(i => !i.isRoot && SHA256_HEX.test(i.sha256)).map(i => i.sha256.toLowerCase());
    let existingCerts: any[] = [];

    if (newHashes.length > 0) {
      const { data: duplicates } = await supabaseAdmin
        .from('certificates')
        .select('id, sha256, process_bundle_id')
        .in('sha256', newHashes);
      
      if (duplicates && duplicates.length > 0) {
        existingCerts = duplicates;
        const trueDuplicates = duplicates.filter(d => d.process_bundle_id !== bundleId);
        if (trueDuplicates.length > 0) {
          throw new HttpError(409, 'Duplicate hash detected. This image is already used in another bundle.');
        }
      }
    }

    const { data: profile } = await supabaseAdmin.from('profiles').select('plan_tier').eq('id', userId).single();
    const planTier = (profile?.plan_tier ?? 'free') as string;
    const { value: c2paParsed } = resolveC2paForPersistence(null, planTier);

    // Bundleの更新（Wipe & Replace 準備）
    const { error: bundleErr } = await supabaseAdmin.from('process_bundles').upsert({
      id: bundleId,
      user_id: userId,
      certificate_id: body.certificateId ? body.certificateId.replace('root-', '') : null,
      title: title.trim(),
      description: description.trim(),
      is_public: isPublic,
      status: 'draft',
      evidence_mode: 'hash_chain_v1',
      root_step_id: null,
      chain_head_step_id: null,
    }, { onConflict: 'id' });
    if (bundleErr) throw new HttpError(500, `Bundle creation failed: ${bundleErr.message}`);

    const { error: deleteErr } = await supabaseAdmin.from('process_bundle_steps').delete().eq('bundle_id', bundleId);
    if (deleteErr) throw new HttpError(500, `Failed to clean up old steps: ${deleteErr.message}`);

    const certificateRecords: any[] = [];
    const stepRecords: any[] = [];

    let prevStepId: string | null = null;
    let prevChainSha256: string | null = null;
    let rootStepId: string | null = null;

    // 🚨 修正1: 既存証明書への「追加」なのか、「新規作成」なのかを明示的に判定
    const isNewBundle = !body.certificateId;
    const finalCertId = body.certificateId ? body.certificateId.replace('root-', '') : crypto.randomUUID();

    for (const [index, item] of items.entries()) {
      const stepId = item.id || crypto.randomUUID();
      if (index === 0) rootStepId = stepId;
      
      const hashData = String(item.sha256).trim().toLowerCase();
      if (!SHA256_HEX.test(hashData)) throw new HttpError(400, `Invalid SHA256 at step ${index}`);

      const declaredFileName = clampFileName(item.fileName || item.originalFilename);
      const declaredStepType = item.stepType || (item.isRoot ? 'other' : 'draft');
      const isHead = index === items.length - 1;

      // 🚨 修正2: 証明書(certificates)レコードを作るのは、「完全に新規作成」の「一番最後の画像（完成品）」のみ！
      if (!item.isRoot && isNewBundle && isHead) {
        certificateRecords.push({
          id: finalCertId,
          user_id: userId,
          process_bundle_id: bundleId,
          step_index: index,
          title: String(item.title).trim() || 'untitled',
          sha256: hashData,
          proof_mode: isPublic ? 'shareable' : 'private',
          visibility: isPublic ? 'public' : 'private',
          public_verify_token: crypto.randomUUID(),
          public_image_url: item.previewUrl || null,
          storage_path: null, 
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
        bundleId, stepIndex: index, stepType: declaredStepType, 
        title: String(item.title).trim(), description: item.note || '',
        sha256: hashData, originalFilename: declaredFileName,
        mimeType: item.mimeType || 'application/octet-stream', fileSize: item.fileSize || 0,
        prevStepId, prevChainSha256,
      });

      // 工程(Steps)は常にすべて作成する
      stepRecords.push({
        id: stepId, bundle_id: bundleId, user_id: userId, step_index: index,
        step_type: declaredStepType, title: String(item.title).trim(),
        description: item.note || '', sha256: hashData, original_filename: declaredFileName,
        mime_type: item.mimeType || 'application/octet-stream', file_size: item.fileSize || 0,
        storage_path: null,
        preview_url: item.isRoot ? undefined : item.previewUrl,
        prev_step_id: prevStepId, root_step_id: rootStepId,
        prev_chain_sha256: prevChainSha256, chain_sha256: chainSha256,
        chain_payload_json: chainPayload, issued_at: new Date().toISOString(),
      });

      prevStepId = stepId; prevChainSha256 = chainSha256;
    }

    if (certificateRecords.length > 0) {
      const { error: certErr } = await supabaseAdmin.from('certificates').insert(certificateRecords);
      if (certErr) throw new HttpError(500, `Certificates insert failed: ${certErr.message}`);
    }
    
    const { error: stepErr } = await supabaseAdmin.from('process_bundle_steps').insert(stepRecords);
    if (stepErr) throw new HttpError(500, `Steps insert failed: ${stepErr.message}`);

    const headRecord = stepRecords[stepRecords.length - 1];

    const { error: headErr } = await supabaseAdmin.from('process_bundles').update({
        status: 'issued',
        certificate_id: finalCertId,
        root_step_id: rootStepId,
        chain_head_step_id: headRecord.id,
        chain_head_sha256:  headRecord.chain_sha256,
        chain_depth:        stepRecords.length,
        chain_verification_status: 'verified',
        chain_verified_at:  new Date().toISOString(),
      }).eq('id', bundleId);
    if (headErr) throw new HttpError(500, `Bundle HEAD update failed: ${headErr.message}`);

    if (body.certificateId) {
      const certIdToUpdate = body.certificateId.replace('root-', '');
      const { data: existingCert } = await supabaseAdmin.from('certificates').select('metadata_json').eq('id', certIdToUpdate).single();
      const currentMeta = typeof existingCert?.metadata_json === 'object' && existingCert?.metadata_json !== null ? existingCert.metadata_json : {};
      
      await supabaseAdmin.from('certificates').update({ 
        process_bundle_id: bundleId,
        metadata_json: { ...currentMeta, revision: body.revision || 1 }
      }).eq('id', certIdToUpdate);
    }

    /* ── 9. TSA Sync (Vercel Firewall 突破) ── */
    // 新規作成時のみTSAを自動発火させる（既存追加時は手動、または不要）
    if (isNewBundle && certificateRecords.length > 0) {
      const lastCert = certificateRecords[0];
      const appOrigin = getOrigin(request);
      
      const tsaPromise = fetch(`${appOrigin}/api/timestamp`, { 
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${request.headers.get('authorization')?.replace('Bearer ', '')}`,
          // 🚨 修正3: Botと判定されないよう、ブラウザのUser-Agentを完全に継承してFirewallを突破する
          'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0 (ProofMark Internal)',
          'x-forwarded-for': request.headers.get('x-forwarded-for') || ''
        },
        body: JSON.stringify({ certId: lastCert.id, hash: lastCert.sha256 }),
        keepalive: true,
      })
      .then(async (res) => {
          if (!res.ok) {
              const errText = await res.text().catch(()=>'Unknown Error');
              console.error(`[create-json] TSA Sync returned error (${res.status}):`, errText);
          }
      })
      .catch(err => console.error('[create-json] TSA Sync fetch failed:', err));

      waitUntil(tsaPromise);
    }

    /* ── 10. Ignition ── */
    return json(200, {
      success: true, bundleId, chainDepth: stepRecords.length, chainHeadSha256: headRecord.chain_sha256,
      certificateId: finalCertId,
    });

  } catch (err: any) {
    console.error('[create-json] Error:', err);
    return json(err.status || 500, { error: err.message || 'Internal Server Error' });
  }
}