/**
 * /api/projects/[id]
 *
 *   GET    → fetch one project (RLS-filtered; 404 if not visible).
 *   PATCH  → update name / client_name / color / status / due_at / notes.
 *   DELETE → delete the project. Owner-only (enforced by RLS); the
 *            attached certificates' project_id is set to NULL automatically
 *            via ON DELETE SET NULL — no data loss.
 *
 * Audit trail: when a project is renamed or its status changes, every
 * certificate inside it inherits the change via the trg_cert_audit_on_change
 * trigger on certificates (project_id moves are captured row-by-row).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  HttpError, getUserClient, isAllowedOrigin, json, makeLogger, methodGuard, requireUser,
} from '../_lib/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const ALLOWED_STATUS = ['active', 'on_hold', 'delivered', 'archived'] as const;

interface PatchBody {
  name?: string;
  client_name?: string | null;
  color?: string;
  status?: typeof ALLOWED_STATUS[number];
  due_at?: string | null;
  notes?: string | null;
}

function parsePatch(body: unknown): PatchBody {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'invalid_body');
  const b = body as Record<string, unknown>;
  const out: PatchBody = {};

  if (b.name !== undefined) {
    if (typeof b.name !== 'string' || b.name.trim().length < 1 || b.name.trim().length > 80)
      throw new HttpError(400, 'name_invalid');
    out.name = b.name.trim();
  }
  if (b.client_name !== undefined) {
    if (b.client_name === null) out.client_name = null;
    else if (typeof b.client_name !== 'string' || b.client_name.length > 80)
      throw new HttpError(400, 'client_name_invalid');
    else out.client_name = b.client_name.trim() || null;
  }
  if (b.color !== undefined) {
    if (typeof b.color !== 'string' || !HEX_COLOR.test(b.color))
      throw new HttpError(400, 'color_invalid');
    out.color = b.color;
  }
  if (b.status !== undefined) {
    if (typeof b.status !== 'string' || !ALLOWED_STATUS.includes(b.status as never))
      throw new HttpError(400, 'status_invalid');
    out.status = b.status as PatchBody['status'];
  }
  if (b.due_at !== undefined) {
    if (b.due_at === null) out.due_at = null;
    else if (typeof b.due_at !== 'string' || Number.isNaN(Date.parse(b.due_at)))
      throw new HttpError(400, 'due_at_invalid');
    else out.due_at = new Date(b.due_at).toISOString();
  }
  if (b.notes !== undefined) {
    if (b.notes === null) out.notes = null;
    else if (typeof b.notes !== 'string' || b.notes.length > 2000)
      throw new HttpError(400, 'notes_invalid');
    else out.notes = b.notes;
  }
  if (Object.keys(out).length === 0) throw new HttpError(400, 'no_fields_to_update');
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const log = makeLogger('projects/[id]');
  res.setHeader('x-request-id', log.ctx.reqId);
  if (!methodGuard(req, res, ['GET', 'PATCH', 'DELETE'])) return;

  const origin = (req.headers.origin as string | undefined) ?? '';
  if (origin && !isAllowedOrigin(origin)) {
    json(res, 403, { error: 'origin_not_allowed', reqId: log.ctx.reqId });
    return;
  }

  const id = (req.query.id as string | undefined) ?? '';
  if (!UUID_RE.test(id)) {
    json(res, 400, { error: 'project_id_invalid', reqId: log.ctx.reqId });
    return;
  }

  try {
    const user = await requireUser(req);
    const sb = getUserClient(user.jwt);

    if (req.method === 'GET') {
      const { data, error } = await sb
        .from('projects')
        .select('id, owner_id, team_id, name, client_name, color, status, due_at, notes, created_at, updated_at')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new HttpError(500, `fetch_failed: ${error.message}`);
      if (!data) { json(res, 404, { error: 'not_found', reqId: log.ctx.reqId }); return; }
      json(res, 200, { project: data, reqId: log.ctx.reqId });
      return;
    }

    if (req.method === 'PATCH') {
      const patch = parsePatch(req.body);
      const { data, error } = await sb
        .from('projects')
        .update(patch)
        .eq('id', id)
        .select('id, owner_id, team_id, name, client_name, color, status, due_at, notes, created_at, updated_at')
        .maybeSingle();
      if (error) {
        if ((error as { code?: string }).code === '42501') throw new HttpError(403, 'rls_denied');
        throw new HttpError(400, `update_failed: ${error.message}`);
      }
      if (!data) { json(res, 404, { error: 'not_found', reqId: log.ctx.reqId }); return; }
      log.info({ event: 'project.updated', projectId: id, fields: Object.keys(patch) });
      json(res, 200, { project: data, reqId: log.ctx.reqId });
      return;
    }

    // DELETE — owner-only via RLS
    const { error } = await sb.from('projects').delete().eq('id', id);
    if (error) {
      if ((error as { code?: string }).code === '42501') throw new HttpError(403, 'rls_denied');
      throw new HttpError(400, `delete_failed: ${error.message}`);
    }
    log.info({ event: 'project.deleted', projectId: id });
    json(res, 200, { ok: true, reqId: log.ctx.reqId });
  } catch (err) {
    if (err instanceof HttpError) {
      json(res, err.status, { error: err.message, reqId: log.ctx.reqId });
      return;
    }
    log.error({ event: 'projects.id.error', message: String((err as Error)?.message ?? err) });
    json(res, 500, { error: 'internal_error', reqId: log.ctx.reqId });
  }
}

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };
