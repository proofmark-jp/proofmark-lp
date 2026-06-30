import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// 【防衛線 1: Upstash Redisによるグローバル・レートリミットの初期化】
// Vercel Edge環境で最速で動作する分散インメモリDB（Upstash）をフック。
// 同一IPからの異常な連続リクエストを、アプリケーション（Next.js）本体に到達する前にエッジで検知・遮断します。
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

const ratelimit = new Ratelimit({
  redis: redis,
  // 1つのIPアドレスあたり「10秒間に30リクエスト」まで許容（通常の人間では突破不可能な厳格なしきい値）
  limiter: Ratelimit.slidingWindow(30, '10 s'),
  analytics: true,
  prefix: 'proofmark_edge_limiter',
});

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  
  // 静的アセット、画像、APIルート、各種メタファイルはレートリミットの対象外とし、
  // クローラーの巡回や通常のメディア読み込みのパフォーマンス（UX）を最優先する
  const isStaticAsset = 
    pathname.startsWith('/_next/') || 
    pathname.startsWith('/api/') || 
    pathname.match(/\.(png|jpg|jpeg|gif|webp|avif|ico|svg|mp4|json|xml|txt|pdf)$/);

  if (!isStaticAsset) {
    // クライアントの真のIPアドレスを特定（Vercelのエッジヘッダーから抽出）
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const { success, limit, reset, remaining } = await ratelimit.limit(ip);

    // 【防衛線 2: DDoS / ボットスクレイピングの瞬殺】
    // 規定回数を超えたアクセスには、即座に HTTP 429 (Too Many Requests) を返却。
    // レートリミットの状態をヘッダーに刻み、攻撃ボットに冷徹に通告します。
    if (!success) {
      return new NextResponse(
        JSON.stringify({
          error: 'Too Many Requests',
          message: 'ProofMarkの絶対防衛線によりアクセスが制限されました。時間を置いて再試行してください。'
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
          },
        }
      );
    }
  }

  // 【防衛線 3: The Cache-Buster Extermination (URL強制正規化)】
  // 公開検証ページ（`/verify/[id]`）を執拗に狙う、ランダムクエリを用いたキャッシュ貫通攻撃を防御。
  if (pathname.startsWith('/verify/')) {
    const hasSearchParams = searchParams.toString().length > 0;
    
    // URLに何らかのクエリパラメータ（?v=123等）が付与されている場合、エッジで強制介入
    if (hasSearchParams) {
      const url = request.nextUrl.clone();
      // クエリパラメータを1文字残らず「完全消去」
      url.search = '';
      // パラメータを削ったクリーンな正規URL（費用ゼロのCDNキャッシュに確実にヒットするURL）へ、HTTP 301（永久移動）で強制リダイレクト
      return NextResponse.redirect(url, { status: 301 });
    }
  }

  // すべてのチェックを通過した安全なリクエストのみ、次のレンダリングレイヤーへパス
  return NextResponse.next();
}

// ミドルウェアを実行するスコープの厳格な定義
// 不要なアセットへの関与を減らし、エッジ関数の実行時間（Vercelのインフラコスト）をミリ秒単位で削減する
export const config = {
  matcher: [
    /*
     * 以下のパスを除くすべてのリクエストパスにマッチさせる:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};