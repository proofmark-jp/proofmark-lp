// api/ogp-proxy.ts
import { generateSignedOgpUrlEdge, type OgPayload } from './_lib/og-signer-edge.js';

export const config = { runtime: 'edge' };
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const targetPath = url.searchParams.get('target');
  if (!targetPath) return generateNegativeCacheResponse();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return generateNegativeCacheResponse();

  const fetchOpts = { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } };

  try {
    // 👑 1. Storefront (/u/:username)
    const usernameMatch = targetPath.match(/^\/u\/([^/]+)/);
    if (usernameMatch) {
      const username = usernameMatch[1].toLowerCase();
      const safeUsername = encodeURIComponent(username);
      const dbRes = await fetch(`${supabaseUrl}/rest/v1/profiles?username=eq.${safeUsername}&select=username,studio_name,studio_tagline,studio_bio,studio_logo_url,avatar_url`, fetchOpts);
      const profiles = await dbRes.json();
      
      if (Array.isArray(profiles) && profiles.length > 0) {
        const p = profiles[0];
        const titleName = p.studio_name ?? `@${p.username}`;
        const description = p.studio_tagline ?? p.studio_bio ?? `${titleName} — ProofMark Verified Studio. 暗号学的に検証可能な作品証明を公開しています。`;
        const ogImage = p.studio_logo_url ?? p.avatar_url ?? `https://proofmark.jp/api/og?title=${encodeURIComponent(titleName)}`;
        return generateOgpResponse(titleName, description, new URL(targetPath, url.origin).href, ogImage, '#6C3EF4', 86400);
      } else {
        const trapTitle = `@${username} は現在取得可能です`;
        const trapDesc = `このクリエイターIDはまだ誰のものでもありません。ProofMarkで、あなたの創作を保護する最初のステップを踏み出しませんか？`;
        const trapImage = `https://proofmark.jp/api/og?title=${encodeURIComponent('ID AVAILABLE')}`;
        return generateOgpResponse(trapTitle, trapDesc, new URL(targetPath, url.origin).href, trapImage, '#00D4AA', 60);
      }
    }

    // 👑 2. Certificate (/cert/:id)
    const certMatch = targetPath.match(/^\/cert\/([^/]+)/);
    if (certMatch) {
      const certId = certMatch[1];
      if (!UUID_REGEX.test(certId)) return generateNegativeCacheResponse();

      const safeCertId = encodeURIComponent(certId);
      // 🛡️ 修正: metadata_json と display_name を追加取得
      const dbRes = await fetch(`${supabaseUrl}/rest/v1/certificates?id=eq.${safeCertId}&select=id,title,original_filename,sha256,public_image_url,created_at,metadata_json,profiles(username,display_name)`, fetchOpts);
      const certs = await dbRes.json();

      if (Array.isArray(certs) && certs.length > 0) {
        const c = certs[0];
        const author = c.profiles?.display_name || c.profiles?.username || 'Anonymous';
        const title = c.title ?? c.original_filename ?? 'Verified Digital Artwork';
        const hash = c.sha256 || '';
        
        // 🛡️ 3-Node のためのデータ算出（プロキシ側で全部やる）
        const meta = c.metadata_json || {};
        const history = Array.isArray(meta.chain_history) ? meta.chain_history : [];
        const depth = history.length > 0 ? history.length + 1 : 1;
        const headUrl = c.public_image_url || '';
        let originUrl = headUrl;
        let midUrl = headUrl;

        if (history.length > 0) {
          originUrl = history[0].preview_url || history[0].previewUrl || headUrl;
          const midIndex = Math.floor(history.length / 2);
          midUrl = history[midIndex].preview_url || history[midIndex].previewUrl || headUrl;
        }

        // 👑 1行ディフェンスパッチ：URLからクエリパラメータを完全にパージし、Satoriのデコード失敗を封殺
        const purgeQuery = (u: string) => u ? u.split('?')[0] : '';
        const safeOrigin = purgeQuery(originUrl);
        const safeMid = purgeQuery(midUrl);
        const safeHead = purgeQuery(headUrl);

        const mockHours = Math.floor((depth * 25) / 60);
        const mockMins = (depth * 25) % 60;
        const timeSpan = meta.duration_str || (depth > 1 ? `${mockHours}h ${mockMins}m` : '0h 0m');

        const ogPayload: OgPayload = {
            id: c.id, title, hash, author: `@${author}`,
            depth, timeSpan, origin: safeOrigin, mid: safeMid, head: safeHead
        };
        
        const ogImage = await generateSignedOgpUrlEdge(ogPayload);
        const description = `この作品の存在と制作日時は ProofMark によって暗号学的に証明されています。あなたも大切な作品を保護しませんか？ (SHA-256: ${hash.slice(0,12)}...)`;

        return generateOgpResponse(`証明書: ${title} | by @${c.profiles?.username || 'Anonymous'}`, description, new URL(targetPath, url.origin).href, ogImage, '#00D4AA', 86400);
      } else {
        return generateNegativeCacheResponse();
      }
    }
  } catch (e) {
    console.error('OGP Proxy Error:', e);
  }
  return generateNegativeCacheResponse();
}

function generateOgpResponse(title: string, description: string, url: string, imageUrl: string, themeColor: string, maxAge: number) {
  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8" /><title>${title} | ProofMark</title><meta name="description" content="${description}" /><meta name="theme-color" content="${themeColor}" /><meta property="og:title" content="${title} | ProofMark" /><meta property="og:description" content="${description}" /><meta property="og:type" content="website" /><meta property="og:url" content="${url}" /><meta property="og:image" content="${imageUrl}" /><meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="${title} | ProofMark" /><meta name="twitter:description" content="${description}" /><meta name="twitter:image" content="${imageUrl}" /></head><body><h1>${title}</h1><p>${description}</p></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=3600` } });
}

function generateNegativeCacheResponse() {
  const html = `<!DOCTYPE html><html><head><meta name="robots" content="noindex"></head><body>Not Found</body></html>`;
  return new Response(html, { status: 404, headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'public, max-age=60, s-maxage=60' } });
}