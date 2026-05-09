/**
 * GET /api/certificates/lookup-by-hash?sha256=<64hex>&username=<owner>
 *
 * Zero-Knowledge Dropzone の照合先。
 *   • サーバはハッシュだけを受け取る（ファイル本体は触らない）。
 *   • 該当する公開証明書が存在すれば、検証 URL と最小限のメタを返却する。
 *   • 'username' が指定された場合、その所有者の証明に絞る → 他者プロファイルでの
 *     照合事故を防ぐ（NDA 案件が誤って "match!" になることがない）。
 *   • 公開対象は visibility='public' / アーカイブ未済のものに限る。
 *   • 結果はキャッシュ可能（アクセスにより内容が変わる性質ではない）。
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminClient, isAllowedOrigin, json, makeLogger, methodGuard } from '../_lib/server.js';

const SHA256_RE = /^[0-9a-f]{64}$/i;
const USERNAME_RE = /^[a-zA-Z0-9_-]{1,32}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const log = makeLogger('certificates/lookup-by-hash');
  res.setHeader('x-request-id', log.ctx.reqId);
  if (!methodGuard(req, res, ['GET'])) return;

  const origin = (req.headers.origin as string | undefined) ?? '';
  if (origin && !isAllowedOrigin(origin)) {
    json(res, 403, { error: 'origin_not_allowed', reqId: log.ctx.reqId });
    return;
  }

  const sha256Raw = ((req.query.sha256 as string | undefined) ?? '').toLowerCase();
  if (!SHA256_RE.test(sha256Raw)) {
    json(res, 400, { error: 'sha256_invalid', reqId: log.ctx.reqId });
    return;
  }

  const usernameRaw = ((req.query.username as string | undefined) ?? '').trim();
  if (usernameRaw && !USERNAME_RE.test(usernameRaw)) {
    json(res, 400, { error: 'username_invalid', reqId: log.ctx.reqId });
    return;
  }

  try {
    const admin = getAdminClient();

    // 所有者を絞り込む場合のみ事前に user_id を解決する
    let ownerId: string | null = null;
    if (usernameRaw) {
      const { data, error } = await admin
        .from('profiles')
        .select('id, is_storefront_public')
        .ilike('username', usernameRaw)
        .maybeSingle();
      if (error) {
        log.error({ event: 'profile.lookup_failed', message: error.message });
      }
      if (!data || data.is_storefront_public === false) {
        // 該当 Storefront が無い／非公開 → 必ず "no_match" として扱う
        res.setHeader('cache-control', 'public, max-age=60, s-maxage=300');
        json(res, 200, { match: false, reqId: log.ctx.reqId });
        return;
      }
      ownerId = data.id;
    }

    let q = admin
      .from('certificates')
      .select(
        'id, user_id, title, original_filename, file_name, sha256, file_hash, ' +
        'proven_at, certified_at, tsa_provider, visibility, is_archived, badge_tier',
      )
      .or(`sha256.eq.${sha256Raw},file_hash.eq.${sha256Raw}`)
      .eq('visibility', 'public')
      .eq('is_archived', false)
      .order('proven_at', { ascending: false })
      .limit(5);

    if (ownerId) q = q.eq('user_id', ownerId);

    const { data, error } = await q;
    if (error) {
      log.error({ event: 'lookup.error', message: error.message });
      json(res, 500, { error: 'lookup_failed', reqId: log.ctx.reqId });
      return;
    }

    res.setHeader('cache-control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600');

    if (!data || data.length === 0) {
      json(res, 200, { match: false, reqId: log.ctx.reqId });
      return;
    }

    // 最も新しいもの 1 件を「主検証先」、残りを「同一ハッシュの再発行履歴」として返す
    const [primary, ...others] = data;

    // 実行時ガード: 空配列や不正データによるクラッシュを未然に防止
    if (!primary || !primary.id) {
      json(res, 200, { match: false, reqId: log.ctx.reqId });
      return;
    }

    const shape = (c: typeof primary) => ({
      certificate_id: c.id,
      title: c.title ?? c.original_filename ?? c.file_name ?? 'Untitled',
      proven_at: c.proven_at,
      certified_at: c.certified_at,
      tsa_provider: c.tsa_provider,
      verify_url: `/cert/${c.id}`,
      badge_tier: c.badge_tier ?? null,
    });

    json(res, 200, {
      match: true,
      primary: shape(primary),
      others: others.map(shape),
      reqId: log.ctx.reqId,
    });
  } catch (err) {
    log.error({ event: 'lookup.fatal', message: String((err as Error)?.message ?? err) });
    json(res, 500, { error: 'internal_error', reqId: log.ctx.reqId });
  }
}

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };
