import { type NextRequest } from 'next/server';
import { updateSession } from './src/utils/supabase/middleware';

// 【The Apex】Next.js 16 仕様への完全準拠
// 関数名を 'middleware' から 'proxy' へ厳格に変更
export async function proxy(request: NextRequest) {
  // Edgeネットワークに到達した瞬間にCookie同期と認証ガードを発動
  return await updateSession(request);
}

export const config = {
  // 【The Sniper Scope (FinOps & Speed Defense)】
  matcher: [
    '/console/:path*',
    '/login/:path*',
    '/api/:path*'
  ],
};