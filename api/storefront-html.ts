import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminClient, makeLogger } from './_lib/server.js';

// XSS対策：OGPタグへのインジェクションを防ぐ
function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const log = makeLogger('storefront-html-bff');

  // 1. 環境変数のフォールバック (Hostヘッダーへの依存を完全排除)
  const appUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL 
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` 
    : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://proofmark.jp');

  let rawHtml = '';
  try {
    // 👑 【真のVercelネイティブ】
    // ローカルディスク(fs)を完全に破棄し、VercelのエッジCDNから最速でフロントエンドのindex.htmlを取得する
    const htmlRes = await fetch(`${appUrl}/`);
    if (!htmlRes.ok) throw new Error(`CDN fetch failed with status: ${htmlRes.status}`);
    rawHtml = await htmlRes.text();
  } catch (e) {
    log.error({ event: 'html_fetch_failed', message: String(e) });
    return res.status(500).send('Internal Server Error: Unable to render ProofMark Storefront');
  }

  // 2. ユーザー名のバリデーション
  const username = (req.query.username as string)?.trim();
  if (!username || !/^[a-zA-Z0-9_-]{1,32}$/.test(username)) {
    // 不正なユーザー名の場合は、OGP置換を行わず素のHTMLを返す
    return res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(rawHtml);
  }

  // 3. データベース（Supabase）からの動的プロフィール取得
  try {
    const admin = getAdminClient();
    const { data, error } = await admin.rpc('fn_storefront_profile', { p_username: username });

    if (error || !data || data.length === 0) {
      return res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(rawHtml);
    }

    const p = data[0];
    const isStudio = p.plan_tier === 'studio' || p.plan_tier === 'business';
    const titleName = isStudio && p.studio_name ? p.studio_name : `@${p.username}`;

    // 4. メタデータの生成とエスケープ
    const title = escapeHtml(`${titleName} | ProofMark Studio`);
    const desc = escapeHtml(p.studio_tagline || p.studio_bio || `${titleName} — ProofMark Verified Studio. 暗号学的に検証可能な作品証明を公開しています。`);
    const image = escapeHtml(p.studio_logo_url || `${appUrl}/api/og?username=${p.username}`);

    const ogpTags = `
    <!-- BFF Injected Storefront OGP -->
    <title>${title}</title>
    <meta name="description" content="${desc}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:type" content="profile" />
    <meta property="og:url" content="${appUrl}/u/${p.username}" />
    <meta name="twitter:card" content="summary_large_image" />
    `;

    // 5. HTML文字列の置換
    const modifiedHtml = rawHtml
      .replace(/<title>.*?<\/title>/is, '')
      .replace('</head>', `${ogpTags}\n</head>`);

    // 6. レスポンス（エッジキャッシュの最強設定）
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(modifiedHtml);

  } catch (err) {
    log.error({ event: 'ogp_injection_error', message: String(err) });
    // 万が一DBエラー等が起きても画面を落とさず、フォールバックとして素のHTMLを返す
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(rawHtml);
  }
}