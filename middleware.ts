@middleware.ts

【CTOからの厳命：セキュリティ完全対応＆PLG極大化 OGP Injector (v3)】

既存の `middleware.ts` を以下のコードで完全に上書きしてください。
URLインジェクション対策、UUID事前検証、404キャッシュ時間の最適化、そして「存在しないIDへのアクセスをバイラル化するOGPトラップ」を実装した世界最高峰のエッジミドルウェアです。

```typescript
import { next } from '@vercel/edge';

// 🚨 The Bot Radar
const BOT_AGENTS = /twitterbot|facebookexternalhit|whatsapp|linkedinbot|slackbot|discordbot|telegrambot|skypeuripreview/i;
// UUID事前検証用正規表現
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const config = {
  matcher: ['/u/:path*', '/cert/:path*'],
};

export default async function middleware(req: Request) {
  const url = new URL(req.url);
  const userAgent = req.headers.get('user-agent') || '';

  // 人間のアクセスは即座にSPAへ（速度低下ゼロ）
  if (!BOT_AGENTS.test(userAgent)) {
    return next();
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return next();

  const fetchOpts = {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  };

  try {
    // 👑 1. Storefront (/u/:username) の OGP生成 & 404トラップ
    const usernameMatch = url.pathname.match(/^\/u\/([^/]+)/);
    if (usernameMatch) {
      const username = usernameMatch[1].toLowerCase();
      // 🚨 URLインジェクション防衛: 必ず encodeURIComponent を通す
      const safeUsername = encodeURIComponent(username);
      
      const dbRes = await fetch(`${supabaseUrl}/rest/v1/profiles?username=eq.${safeUsername}&select=username,studio_name,studio_tagline,studio_bio,studio_logo_url,avatar_url`, fetchOpts);
      const profiles = await dbRes.json();
      
      if (Array.isArray(profiles) && profiles.length > 0) {
        // 【正常系】プロフィールが存在する場合
        const p = profiles[0];
        const titleName = p.studio_name ?? `@${p.username}`;
        const description = p.studio_tagline ?? p.studio_bio ?? `${titleName} — ProofMark Verified Studio. 暗号学的に検証可能な作品証明を公開しています。`;
        const ogImage = p.studio_logo_url ?? p.avatar_url ?? `https://proofmark.jp/api/og?title=${encodeURIComponent(titleName)}`;

        return generateOgpResponse(titleName, description, url.href, ogImage, '#6C3EF4', 86400); // 正常系は24hキャッシュ
      } else {
        // 👑 【PLGトラップ】存在しないIDへのアクセスをサインアップ誘導のOGPに変換する
        const trapTitle = `@${username} は現在取得可能です`;
        const trapDesc = `このクリエイターIDはまだ誰のものでもありません。ProofMarkで、あなたの創作を保護する最初のステップを踏み出しませんか？`;
        const trapImage = `https://proofmark.jp/api/og?title=${encodeURIComponent('ID AVAILABLE')}`;
        
        // 🚨 キャッシュは60秒（ユーザーがすぐに登録した場合の機会損失を防ぐ ＆ DDoSも防げる絶妙なライン）
        return generateOgpResponse(trapTitle, trapDesc, url.href, trapImage, '#00D4AA', 60);
      }
    }

    // 👑 2. Certificate (/cert/:id) の OGP生成
    const certMatch = url.pathname.match(/^\/cert\/([^/]+)/);
    if (certMatch) {
      const certId = certMatch[1];

      // 🚨 UUID型防衛: 不正な形式ならDBを叩かず即座に弾く
      if (!UUID_REGEX.test(certId)) {
        return generateNegativeCacheResponse();
      }

      const safeCertId = encodeURIComponent(certId);
      const dbRes = await fetch(`${supabaseUrl}/rest/v1/certificates?id=eq.${safeCertId}&select=id,title,original_filename,sha256,public_image_url,created_at,profiles(username)`, fetchOpts);
      const certs = await dbRes.json();

      if (Array.isArray(certs) && certs.length > 0) {
        const c = certs[0];
        const creatorName = c.profiles?.username ? `@${c.profiles.username}` : 'ProofMark Creator';
        const title = c.title ?? c.original_filename ?? 'Verified Digital Artwork';
        const description = `この作品の存在と制作日時は ProofMark によって暗号学的に証明されています。あなたも大切な作品を保護しませんか？ (SHA-256: ${c.sha256 ? c.sha256.slice(0,12) : ''}...)`;
        
        const encodedTitle = encodeURIComponent(title);
        const encodedCreator = encodeURIComponent(creatorName);
        const encodedThumb = encodeURIComponent(c.public_image_url || '');
        const ogImage = `https://proofmark.jp/api/og?id=${c.id}&title=${encodedTitle}&creator=${encodedCreator}&thumb=${encodedThumb}`;

        return generateOgpResponse(`証明書: ${title} | by ${creatorName}`, description, url.href, ogImage, '#00D4AA', 86400);
      } else {
        return generateNegativeCacheResponse();
      }
    }
  } catch (e) {
    console.error('OGP Injector Error:', e);
  }

  return next();
}

// ── ヘルパー関数 ──

function generateOgpResponse(title: string, description: string, url: string, imageUrl: string, themeColor: string, maxAge: number) {
  const html = `
    <!DOCTYPE html>
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <title>${title} | ProofMark</title>
        <meta name="description" content="${description}" />
        <meta name="theme-color" content="${themeColor}" />
        <meta property="og:title" content="${title} | ProofMark" />
        <meta property="og:description" content="${description}" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="${url}" />
        <meta property="og:image" content="${imageUrl}" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${title} | ProofMark" />
        <meta name="twitter:description" content="${description}" />
        <meta name="twitter:image" content="${imageUrl}" />
      </head>
      <body><h1>${title}</h1><p>${description}</p></body>
    </html>
  `;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=3600`,
    },
  });
}

function generateNegativeCacheResponse() {
  const html = `<!DOCTYPE html><html><head><meta name="robots" content="noindex"></head><body>Not Found</body></html>`;
  return new Response(html, {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      // DDoS防衛と復旧のバランスを取る60秒キャッシュ
      'Cache-Control': 'public, max-age=60, s-maxage=60',
    },
  });
}