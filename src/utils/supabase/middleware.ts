import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // リクエストのCookieを更新（ミドルウェア内での即時反映用）
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          
          // レスポンスオブジェクトを再生成してブラウザへCookieを書き戻す
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // ここでセッションの有効性を確認し、必要ならCookieを自動リフレッシュする
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 【絶対防衛ロジック】
  // /console 配下へのアクセスであり、かつユーザーが存在しない場合はトップページへ物理遮断（リダイレクト）
  if (request.nextUrl.pathname.startsWith('/console') && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // 認証済みの場合は、Cookieが同期されたクリーンなレスポンスを返す
  return supabaseResponse;
}