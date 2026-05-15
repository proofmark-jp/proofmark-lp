/**
 * GET /api/profiles/storefront?username=<username>&project=<uuid?>
 *
 * 公開 Storefront データを「ホワイトリスト列」だけで返す唯一の経路。
 * RLS は触らず、SECURITY DEFINER 関数 fn_storefront_* 経由で安全に集約する。
 *
 *   • 認証不要。CDN にも乗せられるよう Cache-Control を強める。
 *   • 1 リクエストで profile / kpi / projects / certificates を返す
 *     → クライアントの瀑布フェッチを排除し、LCP / TBT を抑える。
 *   • 大文字小文字 / 全角を含むユーザー名は事前に正規化。
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { getAdminClient, isAllowedOrigin, json, makeLogger, methodGuard } from '../_lib/server.js';

let ratelimit: Ratelimit | null = null;
try {
    const redis = new Redis({
        url: process.env.KV_REST_API_URL || '',
        token: process.env.KV_REST_API_TOKEN || '',
    });
    ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(15, '10 s'), // 10秒に15回まで
        analytics: true,
        prefix: 'ratelimit_storefront',
    });
} catch (error) {
    console.error('[RateLimit] Init failed:', error);
}

const USERNAME_RE = /^[a-zA-Z0-9_-]{1,32}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const log = makeLogger('profiles/storefront');
  res.setHeader('x-request-id', log.ctx.reqId);
  if (!methodGuard(req, res, ['GET'])) return;

  const origin = (req.headers.origin as string | undefined) ?? '';
  if (origin && !isAllowedOrigin(origin)) {
    json(res, 403, { error: 'origin_not_allowed', reqId: log.ctx.reqId });
    return;
  }

  if (ratelimit) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || '127.0.0.1';
    try {
        const { success } = await ratelimit.limit(ip);
        if (!success) return json(res, 429, { error: 'too_many_requests', reqId: log.ctx.reqId });
    } catch (e) {
        // Fail-open
    }
  }

  const usernameRaw = (req.query.username as string | undefined) ?? '';
  const username = usernameRaw.trim();
  if (!USERNAME_RE.test(username)) {
    json(res, 400, { error: 'username_invalid', reqId: log.ctx.reqId });
    return;
  }

  const projectId = (req.query.project as string | undefined) ?? null;
  if (projectId && !UUID_RE.test(projectId)) {
    json(res, 400, { error: 'project_id_invalid', reqId: log.ctx.reqId });
    return;
  }

  try {
    // service-role でも RPC は SECURITY DEFINER の中だけで動く（許可された列しか出ない）
    const admin = getAdminClient();

    const [profileRes, kpiRes, projectsRes, certsRes] = await Promise.all([
      admin.rpc('fn_storefront_profile', { p_username: username }),
      admin.rpc('fn_storefront_kpi', { p_username: username }),
      admin.rpc('fn_storefront_projects', { p_username: username }),
      admin.rpc('fn_storefront_certificates', {
        p_username: username,
        p_limit: 60,
        p_project_id: projectId,
      }),
    ]);

    if (profileRes.error) {
      log.error({ event: 'profile.rpc_error', message: profileRes.error.message });
      json(res, 500, { error: 'profile_fetch_failed', reqId: log.ctx.reqId });
      return;
    }
    const profile = (profileRes.data ?? [])[0] ?? null;
    if (!profile) {
      json(res, 404, { error: 'not_found', reqId: log.ctx.reqId });
      return;
    }

    const kpi = (kpiRes.data ?? [])[0] ?? null;
    const projects = projectsRes.data ?? [];
    const certificates = certsRes.data ?? [];

    // CDN 5min, browser 60s, stale-while-revalidate 1h
    res.setHeader(
      'cache-control',
      'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
    );
    res.setHeader('vary', 'Accept-Encoding, Accept');

    json(res, 200, {
      profile,
      kpi,
      projects,
      certificates,
      activeProjectId: projectId,
      reqId: log.ctx.reqId,
    });
  } catch (err) {
    log.error({ event: 'storefront.error', message: String((err as Error)?.message ?? err) });
    json(res, 500, { error: 'internal_error', reqId: log.ctx.reqId });
  }
}

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };
