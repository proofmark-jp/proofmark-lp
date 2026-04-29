/**
 * GET /api/certificates/audit?certId=<uuid>&limit=50
 *
 * Returns the hash-chained audit trail for a single certificate.
 * Visibility is enforced by RLS on cert_audit_logs (owner / team / actor).
 *
 * Response:
 *   { logs: AuditRow[], chainOk: boolean, reqId }
 *
 * `chainOk` is computed server-side by re-hashing each row's canonical JSON
 * and verifying that row[N+1].prev_log_sha256 == row[N].row_sha256.
 * UI uses this flag to render a green ✓ / red ⚠ next to the audit drawer.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  HttpError, getUserClient, isAllowedOrigin, json, makeLogger, methodGuard, requireUser,
} from '../_lib/server';


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AuditRow {
  id: string;
  event_type: string;
  actor_id: string | null;
  actor_email: string | null;
  before_state: unknown;
  after_state: unknown;
  prev_log_sha256: string | null;
  row_sha256: string;
  created_at: string;
}


export default async function handler(req: VercelRequest, res: VercelResponse) {
  const log = makeLogger('certificates/audit');
  res.setHeader('x-request-id', log.ctx.reqId);
  if (!methodGuard(req, res, ['GET'])) return;

  const origin = (req.headers.origin as string | undefined) ?? '';
  if (origin && !isAllowedOrigin(origin)) {
    json(res, 403, { error: 'origin_not_allowed', reqId: log.ctx.reqId });
    return;
  }

  const certId = (req.query.certId as string | undefined) ?? '';
  if (!UUID_RE.test(certId)) {
    json(res, 400, { error: 'certId_invalid', reqId: log.ctx.reqId });
    return;
  }

  const limitRaw = Number(req.query.limit ?? 50);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.trunc(limitRaw))) : 50;

  try {
    const user = await requireUser(req);
    const sb = getUserClient(user.jwt);

    const { data, error } = await sb.rpc('fn_list_recent_audit', {
      p_certificate_id: certId,
      p_limit: limit,
    });
    if (error) {
      if ((error as { code?: string }).code === '42501') throw new HttpError(403, 'rls_denied');
      throw new HttpError(500, `audit_fetch_failed: ${error.message}`);
    }

    const rows = (data ?? []) as AuditRow[];
    // DB側でチェーンとデータ整合性を再計算して検証
    const { data: chainOkData, error: verifyError } = await sb.rpc('fn_verify_audit_chain', {
      p_certificate_id: certId,
    });
    if (verifyError) {
      log.error({ event: 'audit.verify_error', message: verifyError.message });
      // 検証エラー自体はシステムエラーとせず、chainOk = false として扱う
    }
    const chainOk = rows.length === 0 ? true : (chainOkData === true);

    res.setHeader('cache-control', 'private, no-store');
    json(res, 200, {
      logs: rows,
      chainOk,
      reqId: log.ctx.reqId,
      // Include a short hint to debug chain failures without leaking row data.
      ...(chainOk ? {} : { chainHint: 'audit_chain_mismatch' }),
    });
  } catch (err) {
    if (err instanceof HttpError) {
      json(res, err.status, { error: err.message, reqId: log.ctx.reqId });
      return;
    }
    log.error({ event: 'audit.error', message: String((err as Error)?.message ?? err) });
    json(res, 500, { error: 'internal_error', reqId: log.ctx.reqId });
  }
}



export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };
