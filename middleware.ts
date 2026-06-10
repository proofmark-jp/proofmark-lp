// middleware.ts
import { rewrite, next } from '@vercel/edge';

const BOT_AGENTS = /twitterbot|facebookexternalhit|whatsapp|linkedinbot|slackbot|discordbot|telegrambot|skypeuripreview/i;

export const config = {
  matcher: ['/u/:path*', '/cert/:path*'],
};

export default function middleware(req: Request) {
  const url = new URL(req.url);
  const userAgent = req.headers.get('user-agent') || '';

  // 人間ならSPAへ通す（速度低下ゼロ）
  if (!BOT_AGENTS.test(userAgent)) {
    return next();
  }

  // 🚨 Botの場合は、OGP生成用のEdge APIルートへリクエストを横流し(Rewrite)する。
  // これにより、APIルート側で設定したCache-ControlがVercelのCDNで有効になる。
  const targetPath = encodeURIComponent(url.pathname);
  return rewrite(new URL(`/api/ogp-proxy?target=${targetPath}`, req.url));
}