import { type NextRequest } from 'next/server';
import { updateSession } from './src/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
  // The Apex: Edgeネットワークに到達した瞬間にCookie同期と認証ガードを発動
  return await updateSession(request);
}

export const config = {
  // 【The Sniper Scope (FinOps & Speed Defense)】
  // ViteのLPや静的アセット（画像/JS）へのアクセス時はミドルウェアを物理的に起動させず、課金をゼロにする。
  // Next.jsの心臓部（Console、Login、API）へのアクセスのみを狙撃して防衛線を張る。
  matcher: [
    '/console/:path*',
    '/login/:path*',
    '/api/:path*'
  ],
};