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

    // 🚨 The Apex Fix 1: '.includes'の罠を破棄。静的アセットの拡張子のみを厳格にバイパスし、
    // APIパラメータにドット(メールアドレス等)が含まれた際の認証スルー脆弱性を物理遮断。
    if (pathname.match(/\.(svg|png|jpg|jpeg|webp|ico|css|js|woff|woff2|ttf)$/i)) {
      return NextResponse.next();
    }

    // 👑 The Apex Fix 2: Stripe等のWebhook通信はプロキシの干渉を一切受けず直接APIへ流す
    if (pathname.startsWith('/api/webhooks/')) {
      // メソッド検証をプロキシ境界層で強制。POST以外(GET等)のクローラー攻撃を
      // APIコンテナに到達する前にエッジで0.1msで射殺し、Compute課金を防衛。
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

    // 🛡️ 防衛線 2: 認証ガードとCookie同期の防弾化
    return await updateSession(request);
    
  } catch (error) {
    console.error('[Proxy: Security Check Failed]', error);
    
    const pathname = request.nextUrl.pathname;
    const isApiRoute = pathname.startsWith('/api/');
    const isLoginRoute = pathname.startsWith('/login');

    // 🚨 The Apex Fix 3: キャッシュポイズニング防衛
    // エラー時のレスポンスがVercel Edgeでキャッシュされ、復旧後もアクセス不能になるインシデントを根絶
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
    
    // リダイレクトにもキャッシュ無効化ヘッダーを強制付与
    const redirectResponse = NextResponse.redirect(loginUrl);
    errorHeaders.forEach((value, key) => redirectResponse.headers.set(key, value));
    
    return redirectResponse;
  }
}

export const config = {
  matcher: [
    '/console/:path*',
    '/login/:path*',
    '/api/:path*'
  ],
};