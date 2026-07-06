import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

// 【The Apex】Next.js 16 ネットワーク境界プロトコル
export async function proxy(request: NextRequest) {
  try {
    const pathname = request.nextUrl.pathname;

    // 🛡️ 防衛線 1: The Optimistic Bypass (高速離脱 & Webhookの聖域)
    if (
      pathname.startsWith('/_next') ||
      pathname.includes('.') ||
      pathname.startsWith('/api/webhooks/') // 👑 The Apex Fix: Stripe等のWebhook通信はプロキシの干渉を一切受けず直接APIへ流す
    ) {
      return NextResponse.next();
    }

    // 🛡️ 防衛線 2: 認証ガードとCookie同期の防弾化
    return await updateSession(request);
    
  } catch (error) {
    console.error('[Proxy: Security Check Failed]', error);
    
    const pathname = request.nextUrl.pathname;
    const isApiRoute = pathname.startsWith('/api/');
    const isLoginRoute = pathname.startsWith('/login');

    if (isApiRoute) {
      return NextResponse.json(
        { success: false, error: 'Authentication service is currently unavailable.' },
        { status: 503 }
      );
    }

    if (isLoginRoute) {
      return NextResponse.next();
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('error', 'auth_service_down');
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    '/console/:path*',
    '/login/:path*',
    '/api/:path*'
  ],
};