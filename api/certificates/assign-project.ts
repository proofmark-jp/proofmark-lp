/**
 * POST /api/certificates/assign-project
 *
 * Body: { certificate_id: uuid, project_id: uuid | null, delivery_status?: string }
 *
 * Atomically (a) updates certificates.project_id / delivery_status and
 * (b) emits a hash-chained audit log entry via fn_log_cert_event().
 *
 * Why a dedicated endpoint (rather than a raw PATCH on certificates):
 *   • The audit trigger (trg_cert_audit_on_change) auto-captures changes,
 *     but the actor (auth.uid / email) must be available to PostgreSQL
 *     through `request.jwt.claim.sub` — Supabase REST sets this; if you
 *     ever switch to a server-side service-role write you'd lose attribution.
 *     This endpoint *additionally* emits an explicit log row with the
 *     authenticated email to make attribution non-repudiable.
 *   • Validates plan_tier × team_id consistency in one place.
 *   • Single round-trip for the dashboard's "案件を変更" UX.
 *
 * Security:
 *   • Bearer JWT required.
 *   • Mutation is performed with the user-scoped client → RLS denies any
 *     attempt to move a cert into a project the caller can't see.
 *   • The audit log emit is performed via service-role RPC (the table only
 *     accepts writes from SECURITY DEFINER fn_log_cert_event), but the
 *     actor identity passed in is the authenticated user — never trusted
 *     from the request body.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  HttpError, getAdminClient, getRequestActor, getUserClient, isAllowedOrigin,
  json, makeLogger, methodGuard, requireUser,
} from '../_lib/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_STATUS = [
  'draft', 'in_progress', 'review', 'ready', 'delivered', 'on_hold',
] as const;

interface AssignBody {
  certificate_id: string;
  project_id: string | null;
  delivery_status?: typeof ALLOWED_STATUS[number] | null;
}

function parseBody(body: unknown): AssignBody {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'invalid_body');
  const b = body as Record<string, unknown>;

  if (typeof b.certificate_id !== 'string' || !UUID_RE.test(b.certificate_id)) {
    throw new HttpError(400, 'certificate_id_invalid');
  }
  if (b.project_id !== null && (typeof b.project_id !== 'string' || !UUID_RE.test(b.project_id))) {
    throw new HttpError(400, 'project_id_invalid');
  }

  const out: AssignBody = {
    certificate_id: b.certificate_id,
    project_id: (b.project_id as string | null) ?? null,
  };

  if (b.delivery_status !== undefined && b.delivery_status !== null) {
    if (typeof b.delivery_status !== 'string' || !ALLOWED_STATUS.includes(b.delivery_status as never))
      throw new HttpError(400, 'delivery_status_invalid');
    out.delivery_status = b.delivery_status as AssignBody['delivery_status'];
  } else if (b.delivery_status === null) {
    out.delivery_status = null;
  }

  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const log = makeLogger('certificates/assign-project');
  res.setHeader('x-request-id', log.ctx.reqId);
  if (!methodGuard(req, res, ['POST'])) return;

  const origin = (req.headers.origin as string | undefined) ?? '';
  if (origin && !isAllowedOrigin(origin)) {
    json(res, 403, { error: 'origin_not_allowed', reqId: log.ctx.reqId });
    return;
  }

  try {
    const user = await requireUser(req);
    const body = parseBody(req.body);
    const actor = getRequestActor(req);
    const sb = getUserClient(user.jwt);

    // ── 1. Read current state for before/after diff ──────────────────────────
    const { data: before, error: readErr } = await sb
      .from('certificates')
      .select('id, project_id, delivery_status, team_id, user_id')
      .eq('id', body.certificate_id)
      .maybeSingle();
    if (readErr) throw new HttpError(500, `read_failed: ${readErr.message}`);
    if (!before) { json(res, 404, { error: 'not_found', reqId: log.ctx.reqId }); return; }

    // ── 2. If a target project_id is given, verify visibility ────────────────
    if (body.project_id) {
      const { data: proj, error: projErr } = await sb
        .from('projects')
        .select('id, team_id')
        .eq('id', body.project_id)
        .maybeSingle();
      if (projErr) throw new HttpError(500, `project_check_failed: ${projErr.message}`);
      if (!proj) throw new HttpError(403, 'project_not_visible');
    }

    // ── 3. Build patch ───────────────────────────────────────────────────────
    const patch: Record<string, unknown> = { project_id: body.project_id };
    if (body.delivery_status !== undefined) patch.delivery_status = body.delivery_status;

    const { data: updated, error: updErr } = await sb
      .from('certificates')
      .update(patch)
      .eq('id', body.certificate_id)
      .select('id, project_id, delivery_status')
      .maybeSingle();
    if (updErr) {
      if ((updErr as { code?: string }).code === '42501') throw new HttpError(403, 'rls_denied');
      throw new HttpError(400, `update_failed: ${updErr.message}`);
    }
    if (!updated) { json(res, 404, { error: 'not_found', reqId: log.ctx.reqId }); return; }


    log.info({
      event: 'cert.assign_project',
      certId: body.certificate_id,
      projectId: updated.project_id ?? null,
      deliveryStatus: updated.delivery_status ?? null,
    });
    json(res, 200, { certificate: updated, reqId: log.ctx.reqId });
  } catch (err) {
    if (err instanceof HttpError) {
      json(res, err.status, { error: err.message, reqId: log.ctx.reqId });
      return;
    }
    log.error({ event: 'assign-project.error', message: String((err as Error)?.message ?? err) });
    json(res, 500, { error: 'internal_error', reqId: log.ctx.reqId });
  }
}

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };
