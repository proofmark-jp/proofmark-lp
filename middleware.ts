import { type NextRequest } from 'next/server';
import { updateSession } from './src/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
  // Edgeネットワークに到達した瞬間にCookie同期と認証ガードを発動
  return await updateSession(request);
}

export const config = {
  // マッチャー（The Sniper Scope）
  // /console 等へのアクセス時のみミドルウェアを起動し、
  // 画像ファイルやNext.jsの内部キャッシュへのアクセス時は処理をスキップ（パフォーマンス極大化）
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};