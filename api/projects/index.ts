/**
 * /api/projects
 *
 *   GET   → list projects the caller can see (RLS-filtered).
 *   POST  → create a new project (Studio plan required when team_id is set).
 *
 * Project = "案件フォルダ" — first-class grouping above certificates.
 *
 * Security:
 *   • All operations require an authenticated user (Bearer JWT).
 *   • Reads use the **user-scoped** Supabase client → RLS enforces visibility
 *     (owner OR member of the linked team) without server-side trust.
 *   • Writes that target a team_id assert plan_tier ∈ {studio, business} via
 *     requireStudioPlan(); personal projects (team_id=null) are allowed on
 *     every plan, including free, so Creator-First UX never breaks.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  HttpError, getUserClient, isAllowedOrigin, json, makeLogger, methodGuard,
  requireStudioPlan, requireUser, getAdminClient,
} from '../_lib/server.js';

interface CreateBody {
  name: string;
  client_name?: string | null;
  color?: string;
  team_id?: string | null;
  due_at?: string | null;
  notes?: string | null;
}

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const UUID_RE  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseCreate(body: unknown): CreateBody {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'invalid_body');
  const b = body as Record<string, unknown>;
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (name.length < 1 || name.length > 80) throw new HttpError(400, 'name_invalid');

  const out: CreateBody = { name };

  if (b.client_name !== undefined && b.client_name !== null) {
    if (typeof b.client_name !== 'string' || b.client_name.length > 80)
      throw new HttpError(400, 'client_name_invalid');
    out.client_name = b.client_name.trim() || null;
  }

  if (b.color !== undefined) {
    if (typeof b.color !== 'string' || !HEX_COLOR.test(b.color))
      throw new HttpError(400, 'color_invalid');
    out.color = b.color;
  }

  if (b.team_id !== undefined && b.team_id !== null) {
    if (typeof b.team_id !== 'string' || !UUID_RE.test(b.team_id))
      throw new HttpError(400, 'team_id_invalid');
    out.team_id = b.team_id;
  }

  if (b.due_at !== undefined && b.due_at !== null) {
    if (typeof b.due_at !== 'string' || Number.isNaN(Date.parse(b.due_at)))
      throw new HttpError(400, 'due_at_invalid');
    out.due_at = new Date(b.due_at).toISOString();
  }

  if (b.notes !== undefined && b.notes !== null) {
    if (typeof b.notes !== 'string' || b.notes.length > 2000)
      throw new HttpError(400, 'notes_invalid');
    out.notes = b.notes;
  }

  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const log = makeLogger('projects/index');
  res.setHeader('x-request-id', log.ctx.reqId);
  if (!methodGuard(req, res, ['GET', 'POST'])) return;

  const origin = (req.headers.origin as string | undefined) ?? '';
  if (origin && !isAllowedOrigin(origin)) {
    json(res, 403, { error: 'origin_not_allowed', reqId: log.ctx.reqId });
    return;
  }

  try {
    const user = await requireUser(req);
    const sb = getUserClient(user.jwt);

    if (req.method === 'GET') {
      const { data, error } = await sb
        .from('projects')
        .select('id, owner_id, team_id, name, client_name, color, status, due_at, notes, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(500);

      if (error) throw new HttpError(500, `list_failed: ${error.message}`);
      json(res, 200, { projects: data ?? [], reqId: log.ctx.reqId });
      return;
    }

    // POST → create
    const body = parseCreate(req.body);

    if (body.team_id) {
      // チームのオーナーのプランをチェックする（ゲストもチームの恩恵を受けられるようにする）
      // IDOR修正: admin ではなく user-scoped な sb クライアントを使用することで、所属していないチームへの作成を RLS で阻止する
      const { data: teamData } = await sb
        .from('teams')
        .select('owner_id')
        .eq('id', body.team_id)
        .maybeSingle();
      
      if (!teamData) throw new HttpError(400, 'team_not_found');
      await requireStudioPlan(teamData.owner_id);
    }

    const { data, error } = await sb
      .from('projects')
      .insert({
        owner_id: user.id,
        team_id: body.team_id ?? null,
        name: body.name,
        client_name: body.client_name ?? null,
        color: body.color ?? '#6C3EF4',
        due_at: body.due_at ?? null,
        notes: body.notes ?? null,
      })
      .select('id, owner_id, team_id, name, client_name, color, status, due_at, notes, created_at, updated_at')
      .single();

    if (error) {
      // RLS denial → 403 / 409 depending on Postgres errcode
      if ((error as { code?: string }).code === '42501') {
        throw new HttpError(403, 'rls_denied');
      }
      throw new HttpError(400, `create_failed: ${error.message}`);
    }

    log.info({ event: 'project.created', projectId: data?.id, teamId: data?.team_id ?? null });
    json(res, 201, { project: data, reqId: log.ctx.reqId });
  } catch (err) {
    if (err instanceof HttpError) {
      json(res, err.status, { error: err.message, reqId: log.ctx.reqId });
      return;
    }
    log.error({ event: 'projects.error', message: String((err as Error)?.message ?? err) });
    json(res, 500, { error: 'internal_error', reqId: log.ctx.reqId });
  }
}

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };
