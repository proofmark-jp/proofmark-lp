ADR-012: The FinOps & Security Baseline (クラウド破産防衛とゼロトラスト基準)
1. 思想 (Philosophy)
ProofMarkは個人開発SaaS（Bootstrap）としてスタートする。機能開発のスピードよりも、「クラウド破産（FinOps）」の完全回避と「データ破壊（Zero-Trust）」の物理的遮断を最優先のアーキテクチャ制約とする。

2. FinOps (支出上限の絶対ルール)
いかなるバズやDDoS攻撃を受けても、ファウンダーの生活費を脅かす青天井の課金を許容しない。

Vercel (フロントエンド/API):

Spend Management の On-Demand Budget は 「$20」 に設定する。

[CRITICAL] Pause Production Deployments は必ず 「ON」 にする。1TBの無料枠を超過し、かつ$20のバッファを使い切った瞬間にサイトを強制停止し、被害を最大約6,000円に固定する。

Supabase (データベース/ストレージ):

Free Planの Spend Cap を利用し、超過時の自動停止（Fail-safe）を担保する。

3. WAF & Bot Defense (最前線の壁)
Vercel Firewall Rules:

Bot Protection = Challenge (人間かどうかの判定を強制し、スクレイパーを無料で弾く)

AI Bots = Block (無駄な帯域を消費するクローラーを遮断)

※高度な BotID パッケージは現フェーズではオーバーエンジニアリングにつき未導入。

4. Zero-Trust Architecture (データベース防衛)
The Default Deny Rule (RLS警告の許容):

Supabase Security Advisor が cert_audit_logs や rate_limits 等のテーブルに対して出す「RLS Enabled No Policy (ポリシーなし)」という警告は、意図的な「Default Deny (全クライアントからのアクセス拒否)」 である。

将来の監査やメンバー追加時において、この警告を見て慌ててポリシーを追加してはならない。書き込みは Vercel API (Service Role Key) 経由のみに限定する。

5. Environment Variables (鍵の完全分離)
フロントエンドで参照する安全な鍵（VITE_SUPABASE_ANON_KEY 等）にのみ VITE_ プレフィックスを許容する。

神の鍵（SUPABASE_SERVICE_ROLE_KEY）や決済の要（STRIPE_SECRET_KEY）等には、絶対に VITE_ を付与してはならない。これらは Vercel のバックエンド環境に完全隔離する。