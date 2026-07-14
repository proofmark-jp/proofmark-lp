import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

// 【The Apex】Next.js 16 ネットワーク境界プロトコル
export async function proxy(request: NextRequest) {
  try {
    const pathname = request.nextUrl.pathname;

    // 🛡️ 防衛線 1: The Optimistic Bypass (高速離脱 & Webhookの聖域)
    if (pathname.startsWith('/_next')) {
      return NextResponse.next();
    }

    if (pathname.match(/\.(svg|png|jpg|jpeg|webp|ico|css|js|woff|woff2|ttf)$/i)) {
      return NextResponse.next();
    }

    if (pathname.startsWith('/api/webhooks/')) {
      if (request.method !== 'POST') {
        const errorHeaders = new Headers({
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        });
        return new NextResponse('Method Not Allowed', { status: 405, headers: errorHeaders });
      }
      return NextResponse.next();
    }

    // 👑 The Apex Fix 4 (追加): The Edge Interceptor (404バイパス)
    // Next.js (App Router) が404を吐く前に、ルート('/') および
    // Vite SPAが担当すべきパスへのアクセスを、物理的に /spa/index.html へ強制連行する。
    // ※ '/console', '/login' などはVite側で処理されるため、ここで横取りする。
    if (
      pathname === '/' || 
      pathname.startsWith('/console') || 
      pathname.startsWith('/login') ||
      pathname.startsWith('/auth') || 
      pathname.startsWith('/cert') ||
      pathname.startsWith('/verify') // SPAのその他の主要ルートがあればここに追加
    ) {
      // url を /spa/index.html に書き換えて返す（リダイレクトではなく裏側での Rewrite）
      return NextResponse.rewrite(new URL('/spa/index.html', request.url));
    }

    // 🛡️ 防衛線 2: 認証ガードとCookie同期の防弾化 (APIリクエスト等のための処理)
    // ※Vite SPAに流れた後も、Supabaseクライアントがセッションを確立できるようにする。
    return await updateSession(request);
    
  } catch (error) {
    console.error('[Proxy: Security Check Failed]', error);
    
    const pathname = request.nextUrl.pathname;
    const isApiRoute = pathname.startsWith('/api/');
    const isLoginRoute = pathname.startsWith('/login');

    const errorHeaders = new Headers({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });

    if (isApiRoute) {
      return NextResponse.json(
        { success: false, error: 'Authentication service is currently unavailable.' },
        { status: 503, headers: errorHeaders }
      );
    }

    if (isLoginRoute) {
      return NextResponse.next();
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('error', 'auth_service_down');
    
    const redirectResponse = NextResponse.redirect(loginUrl);
    errorHeaders.forEach((value, key) => redirectResponse.headers.set(key, value));
    
    return redirectResponse;
  }
}

// 🚨 matcher の更新: トップページ('/')と、SPAの主要ルートをすべて監視網に入れる
export const config = {
  matcher: [
    '/',
    '/console/:path*',
    '/login/:path*',
    '/auth/:path*',
    '/cert/:path*',
    '/api/:path*',
    '/verify/:path*' 
  ],
};