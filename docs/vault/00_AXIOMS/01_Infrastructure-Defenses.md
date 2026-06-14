---
tags: [architecture, security, devops, vercel, supabase, oom-defense]
aliases: [インフラ防衛線, Infrastructure Defenses]
date: 2026-06-14
---
# Infrastructure Defenses (SaaS絶対防衛線)

ProofMarkのインフラは「悪意ある攻撃」と「バズによる異常トラフィック」、そして「外部インフラのダウンタイム」から、システムとファウンダーのクレジットカード（インフラ原価）、およびユーザーの体験を物理的に守り抜く設計となっている。

## 1. Zero-Trust API & IAM (絶対認証)
- **JWTによる身元証明:** フロントエンドから `x-supabase-url` や `apikey` を送信してはならない。バックエンドAPIは `Authorization: Bearer <JWT>` のみを受け取り、`auth.getUser()` でサーバー側から所有権を二重照合する。
- **Service Roleの隠蔽:** DBの更新や管理者権限（impersonation等）の実行には、Vercelの環境変数に隠蔽された `SUPABASE_SERVICE_ROLE_KEY` を用いる。フロントエンドへは決して露出させない。
- **RBACの確立:** 管理者判定は `user_metadata.plan_type` （フロントから改ざん可能）に依存せず、DB内の `admin_users` テーブルと RPC (`is_admin`) を用いた真のロールベースアクセス制御を行う。

## 2. Cloud Bankruptcy Defense (クラウド破産防衛)
- **Upstash Redis Rate Limit:** `create.ts` や `timestamp.ts` などの主要APIの先頭に、Upstash Redisを用いた Sliding Window アルゴリズム（例: 10秒間に5回まで）のレートリミットを配置。DDoS攻撃やBotによる書き込み課金の爆発を未然に防ぐ。
- **Fail-open設計:** Redisダウン時はエラーで落とさず、制限をオフにしてビジネス（証明書発行）を継続させる。
- **Edge CDN Caching:** 公開証明書ページ（`/cert/{id}`）やポートフォリオには `Cache-Control: public, s-maxage=300` 等を徹底。トラフィックの99%をVercel Edgeで捌き、DBへの Read リクエストをゼロに近づける。

## 3. Storage & Memory Optimization (OOMの回避)
- **Vercel Edgeの制限突破 (Zero-Copy Promote):** 巨大ファイルは Vercel サーバーを経由させない。フロントエンドから Supabase Storage の `quarantine` バケットへ直接 PUT（署名付きURLを使用）し、バックエンドへは「JSONメタデータのみ」を送信するアーキテクチャを厳守する。
- **In-Browser ZIP Assembly (Evidence Pack Engine):** サーバーで重いZIPやPDFを生成してはならない。APIは暗号部品（JSON）を渡すのみ。ブラウザのCPUとメモリ (`JSZip`, `@react-pdf/renderer`) を用いて、ローカルでアセンブルさせることで、インフラの限界費用をゼロ化する。
- **Socket Starvation Defense:** バックエンドでのストリーム処理時、クライアント切断（`res.on('close')`）を検知した場合は即座にストリームを破棄し、上流フェッチを `AbortController` で強制中断（Kill）する。

## 4. Egress Defense (帯域幅の防衛)
- **Image Transform APIの強制:** ユーザーに最高画質を見せるのは「自分の証明書」だけ。ダッシュボード（Bento Grid）等のプロファイル画像一覧表示では、Supabaseの Image Transform API を強制し（`getOptimizedImageUrl`）、`width=400`, `format=webp` 等の超軽量サムネイルへ動的圧縮することで、Egress（外向き転送量）コストを極小化する。

## 5. Data Breach Prevention (データ全件流出の物理的遮断)
- **RLS（Row Level Security）の絶対適用:** データベースへのアクセス制御をアプリケーションのロジックに依存してはならない。PostgreSQLのコアレベルでRLSを強制し、万が一APIの脆弱性を突かれて「全件取得」の悪意あるクエリが走っても、「そのJWTの持ち主のデータ以外はデータベース自体が返却を物理的に拒否する」構造を維持する。
- **Service Roleのダウングレード:** バックエンドにおいて、全権限を持つ Service Role Key を使ったデータの読み出し（`select`）を原則禁止する。ユーザーデータにアクセスする際は、必ず `supabase.auth.setSession` を用いて、リクエスト元のJWT権限レベルまで強制的にダウングレードしてからクエリを実行する。

## 6. UX Resilience & Absolute Response (絶対的レスポンス保証)
- **Optimistic UI（楽観的UI）とLocal-Firstの徹底:** 外部インフラ（Supabase/Vercel/TSA局）のダウンタイムやネットワーク遅延を、ユーザーの画面上の「フリーズ（待機ローディング）」として直結させてはならない。
- **非同期フォールバック:** ユーザーがアクション（Seal等）を起こした瞬間、フロントエンドのIndexedDB（ローカルDB）上で状態を確定させ、画面上は「即座に完了した」として描画する。実際のネットワーク通信や重い暗号処理は、バックグラウンドの Web Worker でリトライ（Exponential Backoff）付きで実行し、「いかなる回線状況でも一瞬で動作するSaaS」という極限のUXを強制する。


## 🔗 Connected Nodes
- [[ADR-001-Implement-Zero-Copy-Promotion]]
- [[ADR-004-Deploy-Upstash-Redis-Shock-Absorber]]
- [[ADR-005-Mandate-Supabase-RLS-and-JWT-Bound-Queries]]