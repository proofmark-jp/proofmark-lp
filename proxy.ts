import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

// ─────────────────────────────────────────────────────────────────────────────
// proxy.ts — ProofMark Network Boundary Fortress
//
// 実行フロー（全リクエスト）:
//  1. 静的アセット → 即時バイパス（最速離脱）
//  2. /api/webhooks/ → Webhook 聖域（認証処理を絶対に通さない）
//  3. SPA ルート対象 → updateSession() 先行実行 → Rewrite + Cookie 移植
//     （/verify は noindex/nofollow ヘッダを付加）
//  4. その他 (API等) → updateSession() 結果をそのまま返す
// ─────────────────────────────────────────────────────────────────────────────
export async function proxy(request: NextRequest): Promise<NextResponse> {
  try {
    const pathname = request.nextUrl.pathname;

    // ─── §1. 静的アセット: The Optimistic Bypass (最速離脱) ─────────────────
    if (pathname.startsWith('/_next')) {
      return NextResponse.next();
    }

    if (pathname.match(/\.(svg|png|jpg|jpeg|webp|ico|css|js|woff|woff2|ttf)$/i)) {
      return NextResponse.next();
    }

    // ─── §2. The Webhook Sanctuary (絶対聖域) ────────────────────────────────
    // Stripe Webhook 通信に自社サーバーの Auth/DB 障害を巻き込むことを物理禁止。
    // updateSession() を一切通さず、メソッド確認のみ行い即座に next() を返す。
    if (pathname.startsWith('/api/webhooks/')) {
      if (request.method !== 'POST') {
        return new NextResponse('Method Not Allowed', {
          status: 405,
          headers: new Headers({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          }),
        });
      }
      // 認証処理を一切介在させず、最速で通過させる
      return NextResponse.next();
    }

    // 【Trap 1: The API Session Decay 解決】
    // 以前の /api/ や /_next/ の無条件バイパスを削除し、通常APIルートを確実に updateSession へ到達させる。

    // ─── §3. SPA ルート: Session Decay 根絶 + Cookie Porting Protocol ───────
    // updateSession() を "先に" 実行することでセッションリフレッシュを保証する。
    const isSpaRoute =
      pathname === '/' ||
      pathname.startsWith('/console') ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/auth') ||
      pathname.startsWith('/cert') ||
      pathname.startsWith('/u/') ||
      pathname.startsWith('/verify');

    if (isSpaRoute) {
      // Step A: セッション更新 + Cookie リフレッシュを先行実行
      const supabaseResponse = await updateSession(request);

      // updateSession() がリダイレクト（/console 未認証等）を返した場合はそのまま優先
      if (supabaseResponse.status >= 300 && supabaseResponse.status < 400) {
        return supabaseResponse;
      }

      // Step B: SPA index.html への Rewrite を生成
      const rewriteUrl = new URL('/spa/index.html', request.url);
      
      // 【Trap 4: The Query String Erasure 解決】
      // クエリパラメータが消滅する罠を塞ぎ、元のURLが持つクエリ文字列を完全移植する。
      rewriteUrl.search = request.nextUrl.search;
      
      const rewriteResponse = NextResponse.rewrite(rewriteUrl);

      // ─── §3-a. The Cookie Porting Protocol ────────────────────────────
      // 【Trap 2: The Cookie Options Erasure 解決】
      // cookie.name と cookie.value だけではなく、HttpOnly/Secure/Max-Age 等の
      // メタデータを含むクッキーオブジェクト全体を完全に移植する。
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        rewriteResponse.cookies.set(cookie);
      });

      // ─── §3-b. Noindex Enforcement (/verify 限定) ─────────────────────
      // Google ボットが /verify ページをインデックスすることを物理的に拒絶する。
      if (pathname.startsWith('/verify')) {
        rewriteResponse.headers.set('X-Robots-Tag', 'noindex, nofollow');
      }

      return rewriteResponse;
    }

    // ─── §4. それ以外の全ルート (API等): 通常の認証ガード ───────────────────────────
    return await updateSession(request);

  } catch (error) {
    // ─── §5. Fail-Closed Authentication Loop ────────────────────────────────
    // エラー発生時は /login へリダイレクト。
    // ただし /login 自身のリクエストでは無限ループを防ぐため next() で短絡。
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
        { status: 503, headers: errorHeaders },
      );
    }

    // 【Fail-Closed 短絡評価】/login への無限ループを物理遮断
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

// ─── 【Trap 3: The Matcher Leak 解決】 ──────────────────────────────────────────
// ハードコードされたパス配列を破棄し、静的ファイルを除外するネガティブルックアヘッド正規表現へ置換
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ],
};