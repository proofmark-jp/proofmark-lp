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
- [[ADR-005-Mandate-Supabase-RLS-and-JWT-Bound-Queries]]---
tags: [architecture, core-philosophy, zero-trust, c2pa]
aliases: [設計思想, Core Philosophy]
date: 2026-06-14
---
# ProofMark Core Philosophy (絶対的設計思想)

ProofMarkのすべてのコード、インフラ設計、UI/UXは、以下の絶対的な哲学に基づいて構築されなければならない。AIエージェント（Claude Code / Antigravity等）がコードを改修する際、この原則に反する提案はすべて棄却される。

## 1. Zero-Knowledge Proof (完全なるゼロ知識証明)
**「サーバーを信じるな。暗号学的な真実だけを信じよ」**
- クライアントの機密データ（原本ファイル）をVercelやSupabaseのサーバーに一切送信しない。
- ハッシュ計算（SHA-256）はすべてユーザーのブラウザのメモリ内（Web Worker / `hashWorker.ts`）で完結させる。
- サーバーには「ハッシュ値」と「メタデータ」のみを送信し、WORM台帳へ記録する。
- 関連実装: `useHashFile.ts`, `ZeroKnowledgeDropzone.tsx`

## 2. The Merkle Rollup (プロセス証明の極小化)
**「150枚の工程を1つのハッシュに圧縮し、インフラコストをゼロに近づける」**
- 制作過程（ラフ〜完成）のすべての画像データを個別のレコードとして保存しない。
- 完成品（HEAD）をルートとし、過去の全工程のハッシュ履歴を `metadata_json` 内の `chain_history` に JSONB として封入する（The Ultimate Lean Payload）。
- これにより、たった1つのデータベースレコードで、複雑な「過程の証明」を数学的に成立させる。

## 3. WORM (Write-Once Read-Many) の絶対防衛
**「一度刻まれた証拠は、管理者（ファウンダー）であっても絶対に書き換えられない」**
- `certificates` テーブルのタイムスタンプや C2PA マニフェストに対して、DBトリガーによる不変性制約（WORM）を課す。
- フロントエンドに物理削除（DELETE）のAPIを持たせない。すべては「アーカイブ（非表示化）」として扱う。
- これにより、ProofMarkが「法廷で戦えるレベルの客観的証拠」としてのSLAを担保する。

## 4. Single Source of Truth (SSOT / 単一情報源の法則)
**「矛盾はSaaSを殺す」**
- プラン価格や説明文はLPにハードコードせず、必ず `pricingPlans.ts` や `proofmark-copy.ts` から動的に流し込む。
- UIのアニメーションや状態遷移（Sliderのロック等）は、タイマー依存（`setTimeout`）を廃止し、必ず「DBのステータス」や「ハッシュシグネチャの完全一致」に基づく **Derived State（派生状態）** によって駆動させる。

## 5. The Hybrid Trust (C2PA × Merkle Rollup)
**「世界規格の来歴と、独自のプロセス証明を統合する」**
- C2PA (Content Credentials) は「競合」ではなく「内包すべき来歴レイヤー（シェル）」として扱う。
- ユーザーから送信された C2PA データを破壊せず、`Evidence Pack` 内に `c2pa.json` として安全に同梱する（パススルー型）。
- ※ 将来的なMCP/Mac mini環境での署名者昇格（Issuer）を見据え、C2PA解析ロジックは常にクライアントサイド（Web Worker）にオフロードし、サーバーのCPUを保護する。


## 🔗 Connected Nodes
- [[01_The-Solo-Sniper-Roadmap]]
- [[01_Infrastructure-Defenses]]
- [[01_Terms-and-Policies]]---
tags: [business, strategy, roadmap, solo-founder, plg]
aliases: [生存戦略, Solo-Sniper Strategy]
date: 2026-06-13
---
# Business & Survival Strategy (Soloファウンダー生存戦略)

ProofMarkは「個人・副業（Solo/Side-Hustle）」で運営されるSaaSである。AIエージェントが機能拡張やアーキテクチャ変更を提案する際、ファウンダーの「可処分時間」と「インフラ予算」を枯渇させる提案は、技術的にいかに優れていようともすべて棄却される。

## 1. The Solo-Sniper Edition (孤高の狙撃手戦略)
**「広く浅く意見を聞くことはしない。一撃必殺の価値のみを追求する」**
- **機能の凍結 (Feature Freeze):** 現在の「The Merkle Rollupによる画像群の証明」という単一機能（Single Use Case）の安定稼働を死守する。「動画も対応して」「PDFも対応して」というユーザーからの要望（Feature Creep）は、リソース枯渇を招くため原則としてすべて拒否（Say NO）する。
- **土管（Dumb Pipe）としての完全免責:** 著作権紛争の仲裁やデータ内容の審査など、運営（人間）の時間を奪うSLAや手動サポートは提供しない。法的リスクは自動化されたDMCAフローで機械的に処理し、システムは「暗号学的ハッシュを記録するだけの計算機」であるというスタンスを貫く。
- **B2B2C / セルフサーブの徹底:** エンタープライズ向けの「対面営業」「請求書払い」「個別のセキュリティシート記入」は一切行わない。法人が利用する場合でも、クレジットカードで即決できるPLG（Product-Led Growth）のセルフサーブモデルに限定する。

## 2. Asymmetric Warfare (非対称なハック戦略)
大企業と同じルート（高額なKMSや法人登記）を真正面から突破せず、ゲリラ戦術でトラスト・インフラを構築する。
- **The Trojan Horse (トロイの木馬戦略):** 公的なX.509証明書がない初期段階では、無料の「自己署名マニフェスト」を画像に注入する。公式マークは点灯しなくとも、Adobe Verify等の外部検証ツールを経由して ProofMark のURLへ誘導し、データ構造を市場に既成事実化させる。
- **Physical KMS (YubiKeyハック):** 高額なAWS KMS（月額数千〜数万円）を使わず、The Agentic Command Center（Mac mini）のUSBポートに挿した `YubiKey 5 FIPS` をハードウェア・セキュリティ・モジュール（HSM）として利用し、ローカル環境でコストゼロの C2PA 署名パイプラインを構築する。

## 3. Agentic Pre-Training (AI稼働前のデータ蓄積)
- Mac mini 上の擬似社員（AI営業・AIサポート）が自律稼働を開始するまでの期間は、ファウンダー自身が手動で泥臭くX（Twitter）の「AI疑惑で苦しむクリエイター」へコンタクトを取る。
- ユーザーのつまづきポイント（エラーログ）や、返信率の高かった営業文面を収集し、これらを将来のAIエージェントのプロンプト（SOP）の学習データとして蓄積する。


## 🔗 Connected Nodes
- [[02_Stripe-FinOps]]
- [[ADR-003-Deprecate-Free-Tier-Storage]]
- [[Stripe-Billing-Flow]]---
tags: [architecture, automation, webhook, bpa, mcp]
aliases: [The Invisible Pipeline, 完全自動化, API防衛]
date: 2026-06-13
---
# The Invisible Pipeline (不可視の自動化とクラウド防衛)

ユーザーにダッシュボードを開かせることすら「摩擦」とみなし、外部ストレージ（Google Drive, Dropbox等）とのシームレスな同期によって、裏側で自動的に存在証明（The Merkle Rollup）を構築する Headless SaaS アーキテクチャの定義。

## 🚨 クラウド破産を防ぐ4つの絶対制御
AIエージェントが、外部連携（APIやWebhookの開放）を実装する際、以下の防衛線が一つでも欠けているアーキテクチャの構築は絶対に許可しない。

### 制御1: バイトストリームの完全遮断 (Client-Side Hashing)
- **原則:** ProofMarkのAPIは「ファイル本体（バイトデータ）」を絶対に受信・ダウンロードしない。
- **理由:** 外部ストレージからの巨大ファイルの転送は、Vercelの帯域幅（Ingress/Egress）課金によるクラウド破産を即座に引き起こすため。
- **実装:** Google Workspaceアドオンやローカルの Watchdog アプリ等を提供し、ユーザーのデバイス側で `SHA-256` ハッシュを計算させる。APIが受け取るのは「64文字のハッシュ文字列」と「メタデータ」のみに限定する。

### 制御2: メッセージキューによる流量平準化 (Rate Smoothing)
- **原則:** Webhookの着弾地点を、直接 Supabase（PostgreSQL）にしてはならない。
- **理由:** クリエイターが数千枚のレイヤーを一括同期した瞬間のAPIスパイク（DDoS状態）によるデータベースのコネクション枯渇とダウンを防ぐため。
- **実装:** Webhookの受付は Upstash Redis のキュー（Message Queue）とする。Vercel Edge は「キューに入れる（所要時間2ms）」だけで処理を終え、裏側の Cron ジョブ、または MCP エージェントが安全なペース（例: 10件/秒）でキューから取り出し、DBへ書き込む。

### 制御3: OAuthの最小特権と隔離 (Security Sandboxing)
- **原則:** ユーザーのドライブ全体へのアクセス権（Full Scope）は絶対に要求しない。
- **理由:** トークン漏洩時の被害を極小化し、エンタープライズ顧客のコンプライアンス要件（セキュリティ審査）をクリアするため。
- **実装:** 専用の隔離フォルダ（例: `ProofMark Drop`）のみを自動生成させ、そのフォルダ内だけの読み取り権限に絞り込む。

### 制御4: Local Offload (Mac mini への計算委譲)
- **原則:** API経由で大量に流れ込むデータの重い処理（Merkle Treeの構築やC2PA署名）を、クラウド（Vercel）で実行しない。
- **実装:** Redis キューに溜まったタスクは、クラウド側で処理せず、自宅の The Agentic Command Center（Mac mini）上の MCP エージェントが定期的に Pull（まとめ取り）する。ローカルCPUで一気にチェーンを構築・署名し、結果の JSON のみを Supabase へ書き戻す。

## 🔗 Connected Nodes
- [[Zero-Copy-Upload-Flow]]
- [[Evidence-Pack-Assembly]]
- [[C2PA-Integration]]---
tags: [roadmap, strategy, gtm, solo-founder, plg]
aliases: [Solo-Sniper Roadmap, 孤高の狙撃手戦略]
date: 2026-06-14
---
# 01_The Solo-Sniper Roadmap (孤高の狙撃手戦略)

本ロードマップは、リソースの限られたソロファウンダーが、インフラ限界費用ゼロの要塞（ProofMark）を武器に、市場の「トラスト（信頼）」を独占するための冷徹な実行計画である。
マス向けの無差別なマーケティング（広告や不特定多数へのローンチ）を完全に放棄し、ペイン（苦痛）が極限まで達している極小のターゲットを狙撃して、非同期のバイラル・ループを強制的に回すことに特化する。

## Phase 1: The Sniper Launch & Core Validation (Week 1〜4)
**至上命題：「たった3人の熱狂」と「心臓部（Verify Page）の極限研磨」**

- **技術凍結（Feature Freeze）:** バグ修正以外の新規開発をすべて停止する。開発リソースの100%を「公開証明書ページ（`/cert/{id}`）」のUI/UXアニメーション研磨のみに投下する。このページがSaaSの最強の営業マンとなる。
- **狙撃的オンボーディング:** X（旧Twitter）で「自分の作品がAI生成だと疑われて炎上している」、あるいは「無断学習に強い憤りを感じている」イラストレーターを自らの目で3名だけ見つけ出す。彼らに直接DMを送り、ProofMarkの「The Merkle Rollupによる150工程の履歴証明」をクローズドで無償提供し、彼らの盾（防具）として使わせる。
- **No-Touch Support の徹底:** 初期ユーザーからのフィードバックは「非同期のGoogleフォーム」のみで受け付ける。リアルタイムのチャットサポートは行わず、ファウンダーの時間を防御する。

## Phase 2: Asynchronous Viral Loop (Week 5〜12)
**至上命題：ファウンダーが寝ている間に勝手に広がる仕組み（PLG）の構築**

- **Watermark Viral (透かしによる感染):** Phase 1で獲得したクリエイターが、SNSやポートフォリオに ProofMark の証明URL を貼り付ける。そのURLを踏んだ閲覧者（他のクリエイターやクライアント）が「自分もこれを使いたい」と思った瞬間、フリクションレス（1クリック）でサインアップできる導線を検証ページ内に最も美しい形で配置する。
- **Feature Request の絶対拒否:** ユーザー増加に伴い「動画対応」「PDF対応」「UI変更」の要望が殺到するが、これらはすべてバックログの底に捨てる。現在稼働している「画像群のプロセス証明（The Merkle Rollup）」という単一のユースケースの安定稼働だけを死守する。
- **Agentic Data Harvesting:** 来たるべき Phase 3 に向けて、ユーザーのアップロードエラーのログや、サポートフォームに届く質問内容を静かに蓄積する。これが後続のAIエージェントの「学習コンテキスト」となる。

## Phase 3: The Agentic Command Center (Week 13〜 / Mac mini 稼働後)
**至上命題：インフラと営業の「完全自律化」と、競合の陳腐化**

- **ローカルMCPの起動:** 到着した Mac mini に `Agent-SecOps` と `Agent-Sales` を常駐させる。
- **自律型アウトバウンド営業:** `Agent-Sales` が24時間365日、SNS上の「AI疑惑」「納品トラブル」に関する投稿をスクレイピングする。文脈をLLMが深く読み取り、最高にパーソナライズされたProofMarkへの招待リプライ文案を生成。ファウンダーはスマホから「Approve（承認）」を押すだけの、限界費用ゼロの営業組織を構築する。
- **Semantic Attestation (意味的証明) の投下:** タイムスタンプ（時間）の証明だけでなく、Mac mini上のローカルVLMに150枚の画像を解析させ、「人間のストロークであることの証明」を自動付与する。これにより既存のタイムスタンプ局を過去の遺物へと追いやる。

## Phase 4: Trust Monopoly & The Invisible Pipeline (Month 6〜)
**至上命題：UIの消滅と、B2B（エンタープライズ）へのセルフサーブ型侵略**

- **Proof-as-a-Widget:** 証明ページへのリンクではなく、クリエイターの外部サイト（WordPress, FANBOX等）に2行のスクリプトで埋め込める「証明ウィジェット（Shadow DOM）」を提供する。世界中のポートフォリオをProofMarkのノード（宣伝塔）へと変異させる。
- **Invisible Pipelineの解放:** Google Drive等と連携し、ユーザーが指定フォルダに保存するだけで裏側で自動的にハッシュ化とチェーン構築が行われるAPIを開放する。
- **ストレージ・ペイウォールの稼働:** 無料プランではファイル実体を即座に破棄（`ADR-003`）し、ビジネスユース（Evidence PackのZIP出力や永続化）の瞬間にのみ確実な課金（Spot課金 / サブスクリプション）を発生させる。法人の利用であっても個別営業は行わず、すべてクレジットカードによる完全セルフサーブで完結させる。---
tags: [roadmap, innovation, backlog, oss, mac-mini]
aliases: [イノベーション・バックログ, オープンソース活用構想]
date: 2026-06-14
---
---
tags: [roadmap, innovation, backlog, oss, bpa, mac-mini, ai-agents]
aliases: [イノベーション・バックログ, The Autonomous SaaS Engine]
date: 2026-06-14
---
# 02_Innovation Backlog: The Autonomous SaaS Engine

本バックログは、ProofMarkを「ファウンダー1名・限界費用ゼロ」でスケールさせるための、Mac mini到着以降の次世代アーキテクチャ構想である。
外部の高額なAIエージェント（Manus等）への依存を排除し、固定資産であるローカル環境とオープンソース（OSS）を活用した「自律型BPA」を構築する。目的は業務の効率化ではなく、**競合他社のビジネスモデルを物理的・経済的に陳腐化させること**にある。

---

## Category A: The Paradigm Shift (市場ルールを破壊するコア機能)
既存のタイムスタンプ局や、高額な法人向けC2PAプロバイダを過去の遺物にするための技術的ブレイクスルー。

### 🚀 A-1. Semantic Attestation (ローカルVLMによる意味的証明)
- **目的:** 「時間」の証明から「人間性（手描き）」の証明への移行。生成AIによる一括出力では再現不可能な価値を創出する。
- **アーキテクチャ:** Mac mini上のオープンソースVLM（例: `Llama-3-Vision`）が、アップロードされた150枚の画像差分（Delta）を非同期で解析。
- **冷徹な優位性:** クラウドのAPI（OpenAI等）に画像を投げれば莫大なAPI課金（クラウド破産）が発生するが、ローカルVLMであれば解析コストは「電気代（0円）」である。これにより、世界で唯一の「限界費用ゼロの手描き監査インフラ」が完成する。

### 🚀 A-2. Zero-Liability Passkey PKI (生体認証KMS)
- **目的:** C2PA署名に必要な「秘密鍵」を運営（Sinn）が管理する法的リスクと、AWS KMSの維持コストを完全に消滅させる。
- **アーキテクチャ:** WebAuthn（Passkey）を悪用し、クリエイター自身のデバイス（iPhoneのFace ID / MacのTouch ID）の Secure Enclave 内に署名用の鍵を生成させる。
- **冷徹な優位性:** ユーザーのブラウザ上で直接暗号署名を行うため、サーバーがハッキングされても証明書のトラストは絶対に揺るがない。「運営を信用しなくてよい（Trustless）」というWeb3の強みを、Web2の快適なUXで実現する。

### 🚀 A-3. Proof-as-a-Widget (不可視のバイラルインフラ)
- **目的:** ユーザーを `proofmark.jp` に呼び込むのではなく、クリエイターのポートフォリオサイト自体を ProofMark の宣伝ノードに作り変える。
- **アーキテクチャ:** 外部サイト（WordPress, FANBOX等）に埋め込める超軽量の `<script>` タグと Shadow DOM コンポーネントの提供。
- **冷徹な優位性:** Stripe Checkout が決済の歴史を変えたのと同じアプローチ。クリエイターの画像の上に美しくフローティングする「Verified」バッジが、外部サイト上でアニメーション付きの証明を再生し、フリクションレスなバイラル・ループ（1クリック登録）を強制起動する。

---

## Category B: Zero-CAC Growth Engine (顧客獲得コスト・ゼロの侵略兵器)
泥臭い営業プロセスとオンボーディングをRPA化し、セルフサーブ型PLGの入り口を全自動で最大化する。

### 🤖 B-1. Intent-Driven Sniper AI (インテント検知型営業)
- **目的:** 悩みを抱えるクリエイターを世界中からピンポイントで見つけ出し、最適な文脈でアプローチする。
- **アーキテクチャ:** Mac mini 上の Python スクレイピングボット × ローカル軽量LLM。X (旧Twitter) やフォーラムの「無断学習」「著作権トラブル」「AI疑惑」に関するシグナルを24時間監視。
- **冷徹な優位性:** スパムDMは送信しない。AIが相手の文脈（コンテキスト）に寄り添った「解決策としてのProofMarkの提案」をドラフトし、Sinnはスマホの通知から「Approve（承認）」を押すだけ。営業マン100人分のリサーチとアプローチをコストゼロで実行する。

### 🤖 B-2. The Phantom Onboarding (ゴースト・カスタマーサクセス)
- **目的:** ユーザーの離脱率（Churn）を極限まで下げる、ファウンダー非介入型のカスタマーサクセス。
- **アーキテクチャ:** Supabase Database Webhooks × Mac mini ローカルワーカー × Resend。
- **冷徹な優位性:** DBトリガーを利用し、「アカウント作成後、3日間証明書を発行していないユーザー」の行動ログ（どこでエラーを出したか）をAIが解析。「アップロードに失敗したようですね。Vercel Edgeを迂回する直接アップロードを使っているので、回線を変えて試してみてください」等、人間が書いたとしか思えないOne-to-Oneのサポートメールを全自動で送信する。

---

## Category C: Autonomous Operations (Sinnの時間を守る絶対防衛線)
インフラ保守と法務対応にかかる「人間の時間」をゼロにするための自動化機構。

### 🛡️ C-1. Chaos Agent QA (品質保証の無人化と破壊テスト)
- **目的:** デプロイ前のテスト時間をゼロにし、ファウンダーが「コードをPushするだけ」で安全が担保される状態を作る。
- **アーキテクチャ:** Playwright × Claude API（Mac mini経由）。Vercelのプレビュー環境がデプロイされた瞬間、AIが `01_STATE` の仕様を読み込み、自律的にUIテストを実行する。
- **冷徹な優位性:** 単なる正常系のテストではなく、「5GBのZIPを食わせる」「回線を意図的に切断する」といったカオスエンジニアリング（破壊テスト）をAIに実行させる。本番環境のDBへのアクセス権限は一切与えず、サンドボックス内で限界値テストを自動化する。

### 🛡️ C-2. The DMCA Firewall via LINE Harness (法的防衛の自動化)
- **目的:** 「他人の著作物だ」「違法画像だ」というクレーム対応からファウンダーの精神的・時間的コストを完全に隔離する。
- **アーキテクチャ:** LINE Harness (OSS CRM) × OpenClaw (ローカルエージェント)。LINE公式アカウントを「ファイル受信口」ではなく「通知と防衛ハブ」として構築。
- **冷徹な優位性:** 著作権侵害のクレームが届いた際、AIエージェントが `00_AXIOMS` の「土管としての免責ルール」を即座に読み込む。「システムは真贋の仲裁を行いません。法的な異議申し立てはDMCAフォーム（URL）へ直接提出してください」という冷徹で法的に完璧な定型文を0秒で自動返信し、ファウンダーが人間同士の紛争に巻き込まれることを物理的に防ぐ。


## 🔗 Connected Nodes
- [[Mac-Mini-Topology]]
- [[01_The-Solo-Sniper-Roadmap]]---
tags: [tooling, workflow, zero-marginal-cost, mac-mini, oss]
aliases: [Founder Tooling, 限界費用ゼロの自動化]
date: 2026-06-14
---
# Founder Tooling & Zero-Cost Workflows

ProofMark開発における、ファウンダー（Sinn）の運用プロトコル。高額なSaaSツールへの依存を排除し、固定資産である「Mac mini」と「オープンソース（OSS）」を極限まで搾取することで、限界費用ゼロの自動化パイプラインを構築する。

## 1. The Core AI Stack (投資対象の選択と集中)
- **Claude Code (Paid):** ターミナルネイティブな「実行部隊」。コードの変更、Git操作、ローカルスクリプトの実行を担う。
- **Gemini Pro (Paid):** Web UIおよびAPIを通じた「壁打ち相手・設計者」。広大なコンテキストウィンドウを活かし、Obsidianの全記憶を保持させる。
- **Cline (旧Claude Dev) (OSS):** VS Code内で稼働する自律型AIソフトウェアエンジニア。APIを直接叩く「限界費用モデル」を採用しており、余計な中間コストを排除。将来的には自宅の Mac mini 要塞上で稼働する MCP（Model Context Protocol）と連携し、ローカルのファイルシステムやインフラを直接操作・制御する完全自律開発の右腕として機能する。
- **Cursor / AI Editors (Free Tier):** エディタは補助と割り切り、無償プランで運用。主要なコード生成は Cline やターミナルの Claude Code へオフロードする。

## 2. Mac Mini Local Automation (脱・クラウドCI/CD)
クラウドの従量課金を避けるため、定期実行やWebhook処理はすべて Mac mini 内部で完結させる。
- **ローカル Git Hook Sync:** GitHub Actionsは使用しない。Mac mini 上で cron または軽量なローカルWebhookレシーバーを稼働させ、`main` ブランチへの Push を検知。Claude Code や Cline をバックグラウンドで起動し、Obsidian の `01_STATE` を自律更新させる。
- **OSS Transcription (Whisper):** 音声メモのテキスト化に外部SaaSは使わない。Mac mini に OSS の `Whisper.cpp` などをローカルデプロイし、iPhone から Drop された音声ファイルを無料で文字起こし、`03_LAB/Inbox.md` へ自動出力する。---
tags: [ui, ux, copy, legal, compliance]
aliases: [UXとコピーのルール, Honesty Standards]
date: 2026-06-14
---
# UX and Copy Rules (美学と誠実さの鉄則)

AIエージェントによるUIコピー生成およびレイアウト改修時の絶対遵守事項。ProofMarkは、信頼性を売るインフラであり、誇大広告や矛盾は「SaaSとしての死」を招く。

## 1. Honesty Enforcement (過剰断定の禁止)
以下のワードは「誇大広告」および「法的リスク（不当表示）」とみなされるため、一切の使用を禁止する。
- ❌ 「絶対に勝てる」「完全準拠」「法廷での採用実績が極めて高い」「無制限」
- ⭕ **「暗号学的に保護された証明」「独立検証可能な技術証拠」「客観的な技術データ」**
- *CIレベルの防衛:* `lint-disallowed-words.sh` により、これらのワードを検知した場合はビルドを物理的に停止させること。

## 2. 経済的合理性のUI設計
- **ROIの明示:** プラン提示時、単なる価格の羅列は禁止。「Spotを4件買うならCreatorプランの元が取れる」といった、5秒で理解できるROI（投資対効果）を明示すること。
- **価格表示の分離:** `PriceLabel` コンポーネントを使用し、通貨記号（¥）と数値を分離すること。「¥0」等の表記がSEOクローラーに無視されるバグを防ぐため。
- **機能の階層性:** `state === 'exclude'` (Minus/半透明) や `state === 'planned'` (Star/ゴールド) 等を用い、プラン間の差異を機能リストの「文字の羅列」ではなく「視覚的な情報階層」として表現すること。

## 3. 没入感を破壊するUI要素の禁止
- **OS標準ダイアログの撲滅:** `window.alert` や `window.confirm` の使用は厳禁。すべてのメッセージは、画面上部にフロートする専用の美しいエラーUI（`setShellError` 等）へ置換すること。
- **モーダルの「箱in箱」問題:** 新規UIを実装する際、既存のラッパーやラッパー内のモーダルの中にさらにモーダルを置くような二重構造（マトリョーシカ問題）は視認性を破壊するため禁止。必ずトップレベルのレイヤーへポータル展開すること。
- **モバイルの静寂:** モバイル端末においては、Hoverアクション（開くボタン等）が見えない場合がある。Hoverに依存せず、スマホ端末では常にアクション導線が表示されるアフォーダンスを必ず実装すること。

## 4. 誠実なエラーハンドリング
- **「空」状態の美学:** データがない場合、単に「エラー」と表示せず、その機能が「証明」の一部であることを示す静寂なテキストを表示すること。
- **予期せぬ切断:** アップロード中や生成中に通信が切れた場合、ユーザーを放置せず、リロードや再試行を促す「安全網」をトーストで表示すること。

## 5. Creative Freedom within Boundaries (枠組みの中の自由)
お前は世界最高峰のUXデザイナーである。上記の1〜4の制約（禁止事項）は、お前のデザイン力を縛るものではなく、凡庸なUIを排除するための最低基準（ベースライン）である。
これらの制約を完璧に守った上で、色彩、タイポグラフィ、Framer Motion を用いたマイクロインタラクションにおいて、Stripe や Linear に匹敵する、息を呑むような美しいUI/UXを積極的に提案・実装せよ。
---
tags: [component, ui, framer-motion, performance]
aliases: [VerifiedBadge, Badge UI]
date: 2026-06-14
---
# VerifiedBadge.tsx

ProofMarkの証明バッジUIコンポーネント。ホバー時の幅展開アニメーションにおいて、DOMツリーの再計算（Layout Thrashing）を防ぎ、常に60fpsを維持するための実装仕様。

## 1. テーマ仕様 (Dual Theme)
`isMasked` (boolean) の値に応じて以下の2つのスタイル状態を切り替える。

- **Public Mode (`isMasked === false`):**
  - ベースカラー: Teal (`#00D4AA`)
  - テキスト: "3 STEPS VERIFIED"
  - アイコン: `ShieldCheck`
- **NDA Mode (`isMasked === true`):**
  - ベースカラー: Purple (`#6C3EF4`) / Gold (`#F0BB38`)
  - テキスト: "NDA PROTECTED"
  - アイコン: `Lock`

## 2. パフォーマンスとレンダリング最適化 (GPU Isolation)
Framer Motionを用いたアニメーション実装時、以下の制約を厳守すること。

- **DOMの分離:** 親ツリーへのレイアウト伝播を防ぐため、CSSに `contain: layout paint` および `will-change: width, transform` を指定し、コンポーネントを独立したGPUレイヤーへ昇格させる。
- **Layout Thrashingの防止:** `framer-motion` のレイアウト計算を明示的にオフ（`layout={false}`）にする。
- **Flexbox反転による固定:** `width` の展開アニメーションによる内部要素のガタつきを防ぐため、コンテナに `flex-row-reverse` を適用。アイコンを右側にピン留めし、テキスト領域のみを左方向へ展開させる。
- **Hover-Spam制御:** `onHoverStart` イベント発火時、100msの `setTimeout` による遅延（Intent-Delay）を実装し、マウスの不要な通過による連続した再レンダリングをブロックする。

## 3. 親コンポーネントへの組み込み制約 (Global Directives)
本コンポーネントを他のUI（Bento Grid等）にインポートして配置する際、以下のルールを遵守すること。

- **A11y (視差効果低減) の尊重:**
  - 内部で `import { useReducedMotion } from 'framer-motion'` を評価する。
  - OS設定で視差効果を減らしているユーザーに対しては、Pulse（呼吸）アニメーションを停止し、展開を `duration: 0` で即時完了させること。
- **Clipping (見切れ) トラップの完全回避:**
  - バッジはホバー時に横幅が **134px** まで展開する。
  - 親要素や画像ラッパーに `overflow-hidden` が適用されていると展開時にUIが切断されるため、バッジをその内側に配置してはならない。
  - 必ず `overflow-hidden` コンテナの「外側（兄弟要素）」として配置し、共通の親コンテナ（`relative` を指定）に対して `absolute` かつ `z-index: 50` クラスを指定してマウントすること。---
tags: [component, react, state-machine, timeline]
aliases: [ProcessBundleComposer, Timeline UI]
date: 2026-06-14
---
# ProcessBundleComposer.tsx

ProofMarkのタイムラインUIコンポーネント。画像配列とメタデータの状態遷移を2つの独立したシグネチャで監視・制御する仕様（The Dual-State Engine）。

## 1. 状態監視機構 (The Dual-State Engine)
UIの状態は、以下の2つのシグネチャ変数によって決定論的に評価される。

### A. 画像・構造の変更監視 (`stepsSignature`)
- **型定義:** `string` (`id` と `sha256` のみを連結・ハッシュ化した文字列)
- **状態遷移:** 封印済み（Sealed）状態から画像配列の追加・削除・並び替えが発生した際、スナップショットとの差異を検知し `isForkedDraft = true` とする。
- **UI挙動:** `VerifiedBadge` を非表示とし、「Slide to Seal」スライダー（新リヴィジョン作成UI）を表示する。再封印処理にはTSAトランザクションを伴う（DBへのINSERT）。

### B. テキスト・メタデータの変更監視 (`currentMetaSignature`)
- **型定義:** `string` (`title` と `note` を連結・ハッシュ化した文字列)
- **状態遷移:** 画像構造を維持したままテキストのみを修正した場合、`hasUnsavedMeta = true` とする。
- **UI挙動:** `VerifiedBadge` を維持し、「変更を保存」ツールバーを表示する。保存処理はTSAを消費せず、`metadata_json` の超軽量な PATCH (`UPDATE`) 処理のみを実行する。

## 2. メモリ保護と並行処理 (OOM Defense)
コンポーネント内の関数を実装・修正する際は以下の制約を守ること。

- **Shallow Copy の強制:** 状態を復元する `handleRevertToSealed` 等を実装する際、`JSON.parse(JSON.stringify())` によるディープコピーは絶対に使用禁止（`File` や `Blob` オブジェクトの参照が破壊されるため）。必ず `steps.map(step => ({ ...step }))` などの浅いコピーを使用すること。
- **Anti-Jank Yield:** 150枚規模の画像をDropされた際、UIスレッドのホワイトアウトを防ぐため、`Promise.all` の全件一括並行実行を避ける。チャンク分割処理と `await new Promise(r => setTimeout(r, 0))` による処理の Yield（ブラウザへの制御返却）を挟むこと。

## 3. 差分更新制御 (Delta Uploads)
新リヴィジョン（v2等）の作成時、ネットワーク帯域の無駄を省くための制御。
- **アップロードのフィルタリング:** `runHybridCompression` および API送信時、対象ファイルを `uploadState !== 'uploaded'` の条件でフィルタし、既知のファイルは再アップロードしない。
- **ステートのリセット:** 画像の差し替え（`onReplace` イベント）が発生した場合は、対象ステップの `uploadState` を明示的に `'idle'` へリセットし、アップロードスキップの偽陽性を防ぐこと。---
tags: [component, widget, iframe, plg, cross-origin]
aliases: [PortfolioEmbedWidget, 埋め込みウィジェット]
date: 2026-06-14
---
# Portfolio Embed Widget

外部サイト（WordPress, Notion, 独自ドメイン等）への iframe 埋め込み用コンポーネント。親サイトのSEOやUXを破壊しないための実装要件。

## 1. Cross-Origin Height Sync (高さの動的同期)
iframe特有のスクロールバー発生を防ぐため、以下のロジックを実装・維持すること。
- ウィジェット内部で `ResizeObserver` をマウントし、コンテンツの高さ（`scrollHeight` 等）を監視する。
- 高さが1pxでも変化した際は、`window.parent.postMessage` を使用して親サイトへ新しい高さを送信し、iframeの動的リサイズを要求する。

## 2. パフォーマンスと LCP (Core Web Vitals) 最適化
親サイトの読み込み速度を劣化させないための画像最適化要件。
- **ファーストビュー:** 上部（`index < 2`等）の画像には `fetchPriority="high"` と `loading="eager"` を適用する。
- **遅延読み込み:** それ以下の画像には `loading="lazy"` および `decoding="async"` を強制し、ネットワーク帯域の消費を抑える。

## 3. Visual Hash Fingerprint (暗号指紋の描画)
- 秘匿設定（NDA / Confidential）された作品に対し、静的なプレースホルダー画像を使用してはならない。
- 対象となる証明書の `sha256` ハッシュ値をシードとして用い、決定論的（Deterministic）に色相（`hsl`）や模様のパラメーターを算出する。
- 算出されたパラメーターをインラインCSSとして適用し、ハッシュごとに固有のジェネラティブアートを描画する（`deriveGenerativeArt` 関数等を使用）。

## 4. UI/DOM 構造の制約
- **Z-Indexと合成:** モバイル端末のレンダリング負荷を下げるため、`mix-blend-mode` の使用は避け、`opacity` コンポジットとフラットなCSSでの描画を優先する。
- **リンクの空振り防止:** ウィジェット内の `VerifiedBadge` がホバー等のポインターイベントを吸収し、リンク（`<a>`タグ）のクリック判定を阻害するのを防ぐため、必ず `<a>` タグで `relative` 指定されたコンテナ全体を包み込むDOM構造を維持すること。---
tags: [architecture, c2pa, worker, database]
aliases: [C2PA Integration, C2PA仕様]
date: 2026-06-14
---
# C2PA Ecosystem Integration

ProofMarkにおけるC2PA (Content Credentials) データの処理、データベース制約、およびフロントエンドのエッジワーカー管理仕様。

## 1. データベース層の制約 (PostgreSQL)
- **不変性制約 (WORM):** `certificates` テーブルの `c2pa_manifest` カラムに対し、インサート後の更新（上書き）を禁止するDBトリガーを適用する。
- **ペイロード上限:** ストレージコスト保護のため、DB層で `CHECK (octet_length(c2pa_manifest::text) <= 10240)` を強制し、10KB以上のJSONペイロードを拒否する。
- **Egress最適化:** ポートフォリオ等の公開APIレスポンスには、マニフェスト本体（巨大JSON）を含めず、`c2pa_present` (boolean) フラグ等を利用してレスポンスサイズを軽量化する。

## 2. Client-Side Worker 制約 (useC2pa.ts)
C2PA解析の重いWASM処理はメインスレッドで行わず、必ずWeb Workerへオフロードする。ブラウザのフリーズを防ぐため以下の保護機構を実装すること。

- **強制終了 (Timeout Kill):** ワーカー実行開始時に12秒のタイマーを設定する。応答がない場合は `worker.terminate()` を実行し、ワーカープロセスを物理的に破棄する。
- **メモリリーク防止:** コンポーネントのアンマウント時、または関数の連続実行時には、必ず `clearTimeout` によるクリーンアップ処理を行う。
- **TDZ (Temporal Dead Zone) の回避:** Reactフック内での変数・関数の宣言順序を厳格に管理し、クリーンアップ関数（`dispose`等）の初期化前参照エラーによるホワイトアウトを防ぐ。

## 3. ビジネスロジックとUI状態遷移
- **Silent Drop (Freeプラン制御):** FreeプランのユーザーリクエストにC2PAデータが含まれていた場合、400エラー等で中断させず、バックエンドでサイレントに `null` に置換してメインフロー（証明書発行）を完了させる。
- **表示ロジック (加点方式):** C2PAデータが存在しない場合、UI上に「未検証」等のネガティブな警告を出してはならない。データが存在する場合のみ、The Vault UIを発光させる。
- **Submit物理ロック:** 画像ドロップ直後のC2PA解析実行中（約1〜3秒）は、Submit（発行）ボタンの `disabled` 属性を強制的に `true` に設定し、解析完了前の不完全な状態でのAPIリクエスト送信を防ぐ。---
tags: [architecture, mcp, tailscale, topology, network]
aliases: [Mac Mini Topology, ネットワーク構成]
date: 2026-06-14
---
# Mac Mini & MCP Server Topology

ProofMarkのローカル処理ノード（The Agentic Command Center）に関するネットワーク、ポート、およびシステム連携仕様。AIエージェントによる自動化および外部スクリプトは以下のトポロジーに従う。

## 1. Network & Node Configuration
- **Host Device:** Mac Mini (Local Environment)
- **VPN Interface:** Tailscale
- **Tailscale IP:** `[TODO: Insert Tailscale IPv4, e.g., 100.x.y.z]`
- **Firewall Rules:** Tailscaleネットワーク（`100.64.0.0/10`）外からのインバウンド通信はすべてDROPする。パブリックインターネットへのポート開放は厳禁。

## 2. MCP (Model Context Protocol) Services
ローカルで稼働するAIエージェントおよびワーカーのポート割り当て定義。
- **MCP Core Server:** `[TODO: Insert Port, e.g., localhost:3000]`
- **TSA Bulk Processing Worker:** `[TODO: Insert Port, e.g., localhost:3001]`
- **C2PA Local Signing Worker:** `[TODO: Insert Port, e.g., localhost:3002]`
- **SecOps Monitor Agent:** `[TODO: Insert Port, e.g., localhost:3003]`

## 3. Cloud-to-Local Integration (非同期処理オフロード)
Vercel/Supabase（クラウド側）の重い処理をローカルへ委譲する際の通信アーキテクチャ。
- **Pull-based Architecture:** クラウド側から Mac Mini への直接の HTTP/Webhook Push は禁止。必ず Mac Mini 側のワーカーが Upstash Redis のキュー（または Supabase）をポーリング（Pull）する設計とする。
- **TSA Bulk Sync:** ワーカーは一定間隔で未処理のハッシュリストを取得し、ローカル環境で Merkle Tree を構築する。代表ハッシュに対してのみ商用TSAでスタンプを取得し、結果を Supabase へ書き戻す。

## 4. Security & Hardware Key (KMS)
- **C2PA Private Key:** クラウド環境（Vercel等の環境変数）への秘密鍵の配置・アップロードは絶対禁止。
- **HSM Integration:** Mac Mini に物理接続された `YubiKey 5 FIPS` をローカルの KMS として利用する。C2PAマニフェストの署名処理はローカルワーカー内で完結させ、生成されたマニフェスト（JSON）のみをクラウドへ送信する。---
tags: [architecture, stripe, billing, database]
aliases: [Stripe Billing Flow, 決済仕様]
date: 2026-06-14
---
# Stripe Billing Flow & Monetization Engine

ProofMarkにおけるStripe決済およびDB状態遷移の仕様定義。エージェントが決済ロジック（Webhook含む）を修正する際、以下の仕様を満たすコードを記述すること。

## 1. プライシングとSSOT (Single Source of Truth)
- 料金、プラン名、制限のハードコードは禁止。
- すべての価格情報・UI表示文言は `pricingPlans.ts` および `proofmark-copy.ts` から参照する。
- 通貨記号のパース処理には正規表現 `/^([¥$€£])(.*)$/` を用い、クローラー等の読み取りバグを回避する。

## 2. Webhookの冪等性 (Idempotency) 管理
Stripe Webhook (`api/webhook/stripe.ts` 等) は遅延と再送を前提とし、以下の状態管理を行う。

- **トランザクション管理:** `stripe_events` テーブルを使用する。
- **ゾンビロック解除:** ステータスが `received` のまま5分以上経過したイベントはワーカーのクラッシュと判定する。再送受信時、RPC `fn_lock_stripe_event` を用いてロックを強制奪取し、リトライを実行する。
- **二重処理の防止 (Spot決済):** Webhook再送時、該当レコードの `tsa_status` が `'issued'` の場合は処理をスキップ（`return 200`）する。
- **解約時クリーンアップ:** `customer.subscription.deleted` 受信時、権限を `Free` に降格するだけでなく、ユーザーテーブルの `stripe_subscription_id` を明示的に `null` で更新する。

## 3. クォータ制限と原価保護 (DB Constraints)
フロントエンドのバリデーションに加え、DB（PostgreSQL）層で物理ロックを課す。

- **月間上限ロック:** Freeプランの月間発行上限（例: 3件）は、DBトリガー `check_monthly_certificate_limit` でブロックする。
- **Race Condition対策:** 同時リクエストによる上限突破を防ぐため、書き込みトランザクション内で `pg_advisory_xact_lock` を用いて直列化する。
- **TSAルーティング:** 
  - Freeプラン: Beta TSA (FreeTSA.org)
  - Creatorプラン以上 / Spot決済: 商用TSA (DigiCert等)
- **クォータのロールバック:** 商用TSA発行後、SupabaseのUpdate処理に失敗した場合、必ずUpstash Redisのクォータカウンターを `DECR` でロールバックさせる。---
tags: [workflow, upload, zero-copy, quarantine, api]
aliases: [Upload Flow, ダイレクトアップロード]
date: 2026-06-14
---
# Zero-Copy Upload Flow (ダイレクトアップロード・フロー)

ProofMarkにおけるファイルアップロードおよび証明書発行のシーケンス定義。巨大ファイルによるVercelのメモリ枯渇（OOM）を防ぐため、以下の順序とデータ構造を厳守すること。

## 1. 処理シーケンス
フロントエンド（`CertificateUpload`）での `handleIssueCertificate` 発火時のフロー。

1. **Pre-processing (並行処理):**
   - `hashWorker.ts` を用いたファイルの SHA-256 計算。
   - `requestUploadUrl` による署名付きURLの取得（`api/upload-url.ts` への POST）。
   - 上記2つを `Promise.all` で並行実行する。
2. **Direct Upload (Vercel迂回):**
   - 取得した `signedUrl` に対し、`XMLHttpRequest` 等を用いてファイルを Supabase Storage の `quarantine`（検疫バケット）へ直接 `PUT` する。
3. **Zero-Copy Promote (本登録):**
   - `api/certificates/create.ts` へ、ファイル実体を除く「JSONメタデータのみ」を `POST` する。
   - バックエンドはDBレコードを作成し、Storage APIを用いてファイルを `quarantine` から正規バケットへ「移動（Promote）」させる。

## 2. APIインターフェース契約
`requestUploadUrl` 実行時、以下のペイロード構造を厳守すること（キー名の不一致は400エラーとなる）。

```typescript
// api/upload-url.ts への送信ペイロード
body: JSON.stringify({
  filename: file.name,
  contentType: file.type || 'application/octet-stream',
  size: file.size,
})

## 3. Private Proof (Zero-Knowledge Mode) の例外処理

`proofMode === 'private'` の場合、シーケンスは以下のように分岐する。

- **ファイル送信の禁止:** 手順1の `requestUploadUrl` および手順2の `PUT` 処理を完全にスキップする。
    
- **メタデータ送信:** 手順3において、計算済みのハッシュ値、ファイル名、サイズ情報のみを `create.ts` へ送信する。
    
- **MIMEタイプ:** ペイロードの `mime_type` には `file.type` を設定し、強制的に `null` 化しないこと。---
tags: [workflow, zero-server, wasm, zip, pdf]
aliases: [Evidence Pack Assembly, In-Browser ZIP生成]
date: 2026-06-14
---
# Evidence Pack Assembly Flow

ProofMarkにおける「Evidence Pack（証拠ZIP）」生成およびダウンロードのワークフロー定義。サーバーリソースの消費を回避するため、すべてクライアントサイドで完結させること。

## 1. アーキテクチャ制約 (Zero-Server Architecture)
- サーバー（Vercel Node/Edge）側でのZIPアセンブルおよびPDF生成を禁止する。
- バックエンドAPIの役割は「TSRトークン」「C2PAマニフェスト」「メタデータ」をJSON形式でフロントエンドへ返却することのみとする。
- フロントエンドは受け取ったメタデータとユーザー端末のリソースを用いて、ブラウザメモリ空間上でPDFの生成とZIPの結合を実行する。

## 2. PDF生成仕様 (@react-pdf/renderer / jsPDF)
PDF生成時、以下の環境依存エラーおよびOOM（メモリ枯渇）を回避する実装を厳守すること。

- **透過処理の禁止:** `jsPDF` の非公開API (`doc.GState`) を用いたアルファチャンネル（透過）処理は禁止。代替として「計算済みのソリッドカラー（ベタ塗り）」を使用する。
- **画像圧縮 (Canvas Downscaling):** 巨大画像をPDFに直接埋め込まない。`crossOrigin='Anonymous'` を付与し、Canvasを用いた軽量JPEGへのダウンスケール処理（`optimizeImageForPdf` 関数）を必ず経由させる。
- **禁則処理 (Typography):** 文字列の改行バグを防止するため、以下の規則を適用する。
  - ハッシュ値は正規表現 `/^[a-zA-Z0-9\-_.,:;/'"!?@#$%^&*()[\]{}]+$/` を用いて単語ブロックとして保護する。
  - 日本語文字列は1文字ずつ分割してレンダリングする。

## 3. ZIP結合仕様 (JSZip)
- **圧縮モード:** モバイル端末（iPhone等）でのRAMクラッシュを防ぐため、`JSZip` の圧縮モードは `DEFLATE` ではなく、無圧縮結合である `STORE` を強制する。
- **命名規則:** 解凍後のファイル順序をOSレベルで固定するため、ZIP内のファイル名にはプレフィックスとして強制的なナンバリング（例: `01_Cover_Letter.pdf`, `02_Certificate_...`）を付与する。

## 4. エッジケース対応 (In-App Browser)
- X（旧Twitter）やLINEなどのアプリ内ブラウザ（In-App Browser）環境下では、`Blob` オブジェクトのローカル保存（`a.download`）が機能しない。
- User-Agent判定で該当環境を検知した場合、ダウンロード処理を実行せず、Safariまたは外部Chromeブラウザで開くよう誘導するトースト（アラートUI）を表示する。---
tags: [lab, sandbox, brainstorming, zero-constraints]
aliases: [Lab Inbox, 思考の闘技場]
date: 2026-06-14
---
---
tags: [lab, sandbox, brainstorming, paradigm-shift, zero-constraints]
aliases: [Lab Inbox, 思考の闘技場, The Sandbox Core]
date: 2026-06-14
---
# Lab Inbox: 思考の闘技場 (The Sandbox Core)

本ファイルは、ProofMarkの「現在の制約（`00_AXIOMS`、`01_STATE`）」を物理的に完全遮断し、最新のAIエコシステムとWeb標準技術をハックして殴り合うための実験室である。
ここに記述されたアイデアは「まだインフラ要件を満たしていない猛毒」である。AIと対話する際は、過去の仕様に対する自己検閲をすべて解除させ、破壊的なブレイクスルーのみを追求せよ。

## 1. 闘技場起動プロトコル (The Override Prompt)
本ディレクトリ内のアイデアをGeminiに投入し、壁打ちを開始する際、必ず以下のプロトコルをチャットの冒頭にペーストしてAIの「保守的な脳」をオーバーロードさせろ。

> **[SYSTEM OVERRIDE]**
> お前は今、ProofMarkの既存のソースコード、および `00_AXIOMS` に縛られた「保守的なDevOps」の責務から完全に解放された。今この瞬間から、StripeやVercelの初期コアメンバーに匹敵する「冷徹で狂気的なリードアーキテクト」として振る舞え。
> 以下の `Inbox.md` にあるアイデアの種を読み込み、「Soloファウンダーだから無理」「予算がないから無理」という限界費用や実装の難易度を1ミリも言い訳にするな。既存のクラウドアーキテクチャやWeb標準（WebAuthn, WebRTC, WASM）の仕様の穴を突き、暗号学的・UX的に「最も美しく、競合を絶望させる究極の解」へ拡張して出力せよ。

---

## 2. 破壊的アイデア・バックログ (The Seeds of Breakthrough)

### 🧪 Idea-001: The "Zero-Liability" PKI via WebAuthn (パスキーを利用した究極の鍵管理ハック)
- **現状の絶望:** C2PA署名を行うための「秘密鍵」をサーバー（あるいはMac mini）に置けば、漏洩時のSinnの法的責任（ビジネスの死）が確定する。かといってAWS KMSは高い。
- **破壊的仮説:** ユーザーのデバイス自体をハードウェア・セキュリティ・モジュール（HSM）に仕立て上げる。WebAuthn（Passkey）の仕様を限界まで悪用し、クリエイターが「Touch ID / Face ID」で生体認証した瞬間に、Secure Enclave内で完結する秘密鍵・公開鍵のペアを決定論的に生成（Derive）させる。
- **極限のUX:** サーバー側は「ユーザーの公開鍵」だけをSupabaseに保存する。ユーザーが作品をドロップした瞬間、VercelでもMac miniでもなく、**ユーザーのブラウザ内（Web Worker）で直接C2PAマニフェストに「クリエイター自身の生体認証に裏打ちされた暗号署名」を付与**する。Sinnは秘密鍵を一切持たない「完全無罪（Zero-Liability）」のインフラとなる。
- **Sparring Requirement (AIへの挑戦状):**
  - WebAuthnの `navigator.credentials.create()` から得られるRawデータを利用して、ブラウザのWebCrypto APIで安全に署名用キーペアを派生させるTypeScriptの概念実証コード（PoC）を構築せよ。Supabase Authとどう共存させるかが鍵だ。

### 🧪 Idea-002: Local VLM Semantic Attestation (Mac miniによる「人間性」の証明)
- **現状の絶望:** The Merkle Rollupで「ラフから完成までの時間的プロセス」は証明できるが、将来的に「AIが150枚の途中経過画像すらも逆算して一瞬で自動生成する時代」が来た時、タイムスタンプだけの証明は陳腐化する。
- **破壊的仮説:** 時間の証明から「意味（Semantic）の証明」へのパラダイムシフト。ユーザーが150枚の画像をアップロードした後、非同期で Mac mini（The Agentic Command Center）上のローカルVLM（Llama-3-Vision等）が画像をダウンロードし、差分（Delta）を解析する。
- **極限のUX:** VLMが「レイヤー20から21へのストロークの追加は、人間の物理的なペンタブレットの軌跡と一致する」「生成AI特有のピクセル崩壊が存在しない」と判定した場合のみ、ProofMark公式の「Human-Authored Attestation（人間による制作証明）」という強力なカスタムアサーションを証拠パックに追加付与する。
- **Sparring Requirement (AIへの挑戦状):**
  - Mac mini上でVLMを稼働させ、150枚の画像の差分から「人間のストロークか、AIの生成か」を高い確度で判定するための、最適なオープンソースモデルの選定と、推論パイプライン（LangChain / LlamaIndex）のアーキテクチャを提示せよ。

### 🧪 Idea-003: The "Proof-as-a-Widget" (不可視のバイラルインフラ化)
- **現状の絶望:** ユーザーを `proofmark.jp/cert/{id}` という自社ドメインに呼び込むPLG戦略は、クリエイターにとって「自分のポートフォリオサイトからファンを離脱させる」という摩擦を生んでいる。
- **破壊的仮説:** Stripe Checkoutのように、たった2行の `<script>` タグをクリエイターのサイト（WordPress, Skeb, FANBOX）に埋め込ませるだけで、ProofMarkのシステムが「他人のサイト上」で完全稼働する設計。
- **極限のUX:** クリエイターのサイト上の画像にホバーすると、美しく輝く「ProofMark Verified」の透かし（バッジ）が浮かび上がる。クリックすると、画面遷移せずにShadow DOM内でThe Merkle Rollupの150工程がアニメーション再生される。世界中のクリエイターのサイトが、ProofMarkのノード（宣伝塔）へと変異する。
- **Sparring Requirement (AIへの挑戦状):**
  - 外部サイトのCSSコンフリクトを完全に防ぐShadow DOMの設計と、SupabaseへのCORS設定、およびVercel Edge CDNを利用して「100万PVの外部サイトに埋め込まれてもVercelの課金が月額数十円に収まる」最強のキャッシュ戦略（Cache-Control）を立案せよ。---
tags: [legal, terms, dmca, privacy, compliance]
aliases: [利用規約・ポリシー要件定義, 法的絶対防衛線]
date: 2026-06-14
---
# 01_Terms and Policies (法的絶対防衛線の要件定義)

本ドキュメントは、ProofMarkの「利用規約（ToS）」「プライバシーポリシー」「DMCA（著作権侵害対応）」「特定商取引法に基づく表記」を生成する際の、コア・ロジック（絶対要件）を定義する。
ここに記された防衛線を一つでも妥協すれば、ソロファウンダーの生活とビジネスは訴訟リスクとアカウント凍結によって即死する。

## 1. Terms of Service (利用規約の絶対防衛線)
ユーザーに対する「サービスの限界」と「免責」を冷徹に宣言し、過度な期待と損害賠償を根絶する。

*   **As-Is（現状有姿）と SLAの放棄:**
    *   ProofMarkは「現状有姿」で提供される。99.9%の稼働保証（SLA）は一切結ばない。
    *   Vercel、Supabase、FreeTSA、あるいはローカルインフラ（Mac mini）の障害によって証明書が発行できなかった場合、またはデータが消失した場合でも、運営は一切の損害賠償責任を負わない。
*   **Zero-Liability on Truth（真実性に対する免責）:**
    *   ProofMarkは「そのデータが、その日時に存在したこと（ハッシュとタイムスタンプ）」を数学的に証明するだけの計算機である。
    *   アップロードされたデータが「本当に本人が描いたものか」「他人の著作物の盗用ではないか」という「真贋・権利の帰属」について、運営は一切保証しない。
*   **一方的なアカウント凍結権の確保:**
    *   DDoS攻撃、APIの不正利用（スクレイピング等）、またはシステムに過度な負荷をかける行為（Botによる大量リクエスト）を検知した場合、事前の警告なしにアカウントを即時凍結・削除する権利を有する。

## 2. DMCA & Copyright Policy (著作権侵害対応のプロトコル)
SaaSが「著作権侵害の温床（ホスティングプロバイダ）」として訴えられないためのセーフハーバー要件を構築する。

*   **Dumb Pipe（土管）としての宣言:**
    *   運営はユーザーのアップロード内容を自発的に監視・検閲する義務を負わない。
*   **Take-down（テイクダウン）プロトコル:**
    *   正当な権利者から「DMCA（またはプロバイダ責任制限法）に基づく削除要請」があった場合、ファウンダーは内容の真偽（どちらが本物の権利者か）を仲裁しない。
    *   要求が形式的に要件を満たしている場合、速やかに該当する「公開証明書ページ（Shareable URL）」のアクセスを遮断（非公開化）する。
    *   ※技術的制約：Privateモードでハッシュ化されたデータは、そもそも運営にも見えず、公開もされていないため、削除要請の対象外とする。
*   **Counter-Notice（異議申し立て）の放置:**
    *   アカウント凍結や非公開化に対してユーザーから異議申し立てがあった場合でも、当事者間の法的手続きが完了するまで運営は一切介入せず、システム上の復元も行わない。

## 3. Privacy Policy (プライバシーの冷徹な切り分け)
「個人情報」と「クリエイティブ資産」の扱いを明確に分離し、Zero-Knowledge（ゼロ知識）を法的にもアピールする。

*   **ファイル実体の不保持（無料プラン）:**
    *   無料プランにおいて、ファイルの実体はハッシュ計算直後に物理削除されることを明記する。運営はユーザーの作品の中身（プライバシー）を物理的に閲覧できない（Zero-Knowledge）。
*   **サードパーティへのデータ提供の限定:**
    *   決済情報はStripeに、認証情報はSupabase（GoTrue）に完全に委譲しており、ProofMarkのデータベースには「クレジットカード番号」等の致命的な個人情報は一切保存されないことを宣言する。
*   **テレメトリと学習拒否の保証:**
    *   ユーザーがアップロードした画像データを、ProofMark側が独自のAI学習モデルのトレーニングに使用することは「永久にない」と明約する。

## 4. Act on Specified Commercial Transactions (特商法と返金ポリシー)
Stripe（決済プロバイダ）のチャージバック（支払い異議申し立て）によるアカウント凍結を防ぐための金融防衛線。

*   **No Refunds（一切の返金不可）:**
    *   提供するサービスは「デジタルコンテンツ・デジタルサービス」の性質上、いかなる理由があっても決済完了後の返金・キャンセルには応じない。
    *   システム障害で一時的に利用できなかった場合も、日割り計算での返金等は行わない。
*   **サブスクリプションの解約効力:**
    *   解約手続きはいつでも可能だが、効力は「現在の支払いサイクルの最終日」に発生する。即時解約による日割り・月割りでの返金はしない。
*   **Spot課金の不可逆性:**
    *   「Evidence Packのワンタイム発行」等に対するSpot課金は、ボタンを押した（決済APIが叩かれた）瞬間に役務提供が完了したものとみなし、ファイルのダウンロードに失敗した場合でも返金しない（再ダウンロードの口のみを提供する）。---
tags: [finops, stripe, payments, chargeback, automation]
aliases: [Stripe-FinOps, 決済ライフサイクルと財務防衛]
date: 2026-06-14
---
# 02_Stripe-FinOps (決済ライフサイクルと財務絶対防衛)

本ドキュメントは、ProofMarkにおける決済プラットフォーム（Stripe）の運用ルールを定義する。
ソロファウンダーにとって、「未払いの督促」や「不正利用の調査」に手動で時間を割くことは死を意味する。すべての決済ライフサイクルとチャージバック（支払い異議申し立て）に対するペナルティは、Webhook駆動で「全自動・ゼロトレランス（容赦なし）」で執行される。

## 1. The Zero-Tolerance Chargeback Protocol (チャージバックに対する即時処刑)
悪意のあるユーザー（またはカード盗用者）が、銀行を通じて支払いの取り消し（チャージバック）を要求した場合、Stripeアカウントの健全性（紛争率）が著しく毀損される。これを防ぐための冷徹なプロトコル。

*   **Webhookによる即時アカウント凍結:**
    *   Stripeから `charge.dispute.created` のWebhookを受信した瞬間、Supabaseのエンドポイントは**対象ユーザーの `is_banned` フラグを即座に `true` に書き換える。**
    *   これにより、当該ユーザーはProofMarkへのログイン、APIの利用、および既存の証明書ページへのアクセス権をすべて、永久に失う。事前の警告や、メールでの理由説明は一切行わない。
*   **自動証拠提出（Fight Friendly Fraud）:**
    *   「サービスを受けていない」という虚偽のチャージバック（フレンドリー・フロード）に対抗するため、Stripe APIを用いて「ユーザーのログイン時のIPアドレス」「ProofMark内での証明書発行履歴（アクセスログ）」を自動的に証拠（Evidence）としてStripe側にSubmit（提出）するスクリプトを組む。人間の手でPDFを作って提出することはしない。

## 2. Payment Lifecycle & Dunning Automation (決済ライフサイクルと自動ダウングレード)
クレジットカードの期限切れや残高不足による「決済失敗」に対して、ファウンダーが個別に連絡を取ることは禁止する。

*   **Smart Retries（自動督促）への完全委譲:**
    *   決済失敗時の再試行（リトライ）とユーザーへのカード更新を促すメール送信は、すべてStripeの「Smart Retries」と「Customer emails」機能に丸投げする。自社システムから催促メールは送らない。
*   **Hard Downgrade（猶予なき権限剥奪）:**
    *   Stripeの督促サイクルが終了し、サブスクリプションがキャンセルされた場合（`customer.subscription.deleted` の受信）、Supabaseはユーザーのプランを即座に「Free（無料）」へダウングレードする。
*   **ストレージの連動パージ（ADR-003の執行）:**
    *   ダウングレードが実行された瞬間、そのユーザーが有料期間中に保存していた「永続化指定のファイル実体」に対する保護フラグ（`storage_retained`）を解除し、次回のバッチ処理で自動削除（パージ）の対象とする。金を払わない者にインフラのストレージは1ミリバイトも提供しない。

## 3. Spot Issue (単発課金) Strict Fulfillment (役務提供の確実性)
「1証明あたり500円」などのSpot課金（Evidence Pack発行等）における、トラブルとクレームを根絶するためのアーキテクチャ。

*   **Idempotency（冪等性）の強制:**
    *   ユーザーのダブルクリックによる「二重課金」を防ぐため、Stripe APIを叩く際は必ず一意の `Idempotency-Key`（UUID等）をヘッダーに付与する。
*   **Webhook-Driven Delivery（非同期の納品）:**
    *   ユーザーがStripe Checkoutで決済を終え、元の画面に戻ってきた瞬間に「ファイルのダウンロード」を許可してはならない。ブラウザの挙動は信頼できない。
    *   必ずStripeからの `checkout.session.completed` WebhookがSupabaseに着弾し、DBのフラグが「Paid（支払い済み）」に更新されたことをフロントエンドが検知（またはポーリング）してから、ダウンロードリンクを活性化させる。

## 4. Fraud Prevention & Edge Block (不正決済のエッジ遮断)
カードテスター（盗んだクレジットカードが使えるかを試す攻撃者）からシステムを守るための水際対策。

*   **Stripe Radar の最高強度設定:**
    *   CVC（セキュリティコード）チェック失敗、および郵便番号チェック失敗の決済は、Stripe Radarのルールで「強制ブロック」に設定する。
*   **Upstash Redis による試行回数制限:**
    *   Checkoutセッションの作成APIに対して、「同一IPアドレスから10分間に5回以上」のリクエストがあった場合、Upstash RedisのレートリミットでAPIを物理的に遮断する（`429 Too Many Requests`）。これにより、カードテスターの攻撃トラフィックをStripeに到達させる前にVercel Edgeで焼き払い、Stripeアカウントへのペナルティスコア蓄積を防ぐ。---
tags: [dr, disaster-recovery, backup, incident-response, supabase, vercel]
aliases: [Disaster-Recovery, 災害復旧プロトコル]
date: 2026-06-14
---
# 03_Disaster-Recovery (インフラ完全崩壊とヒューマンエラーからの復旧プロトコル)

本ドキュメントは、ProofMarkのシステムが「物理的・論理的に完全に破壊された状態」から、ビジネスの息の根を繋ぐための冷徹な蘇生手順（Disaster Recovery）を定義する。
障害発生時にファウンダーが「考える」ことは許されない。以下のプロトコルを機械的に実行するのみである。

## 1. The "Fat-Finger" Defense (ファウンダー自身のミスへの防衛)
Sinn自身が誤って本番のデータベースレコードを削除した、あるいは致命的なバグをPushしてデータが破損した場合の復旧プロトコル。

*   **Point-in-Time Recovery (PITR) の絶対要件:**
    *   本番環境の Supabase プロジェクトにおいては、必ず Pro プラン（課金）にアップグレードし、**PITR（秒単位の巻き戻し機能）**を有効化する。インフラ原価を抑えるProofMarkにおいて、これだけは絶対にケチってはいけない「命綱」である。
*   **Cold Standby Backup (Mac mini への異次元退避):**
    *   Supabase（クラウド）自体へのアクセス権が喪失した場合に備え、Mac mini上の `Agent-DevOps` に、毎日深夜3時に `pg_dump` コマンドを発行させ、全ユーザーのハッシュ台帳（テキストデータのみ）をローカルストレージへPull（退避）させる。
    *   万が一Supabaseが消滅しても、このローカルダンプさえあれば、別のアカウントでDBを再構築し、SaaSを1時間で蘇生できる。

## 2. Cloud Region Death (クラウドの広域障害・インフラ全停止)
Vercelのグローバルダウン、またはSupabaseがホストされているAWSリージョンの完全停止など、自力ではどうにもならない外部インフラの死に対する防衛プロトコル。

*   **Cloudflare Fail-Whale (DNSレベルの死んだふり):**
    *   VercelやSupabaseのダッシュボードにアクセスして復旧を祈るような無駄な時間は過ごさない。
    *   障害を検知した瞬間、Cloudflare（Vercelのさらに外側のDNS/プロキシ層）のトグルスイッチを手動（将来は `Agent-SecOps` が自動）で切り替え、すべてのトラフィックを静的な「Maintenance / Read-Only ページ」へとルーティングする。
    *   これにより、障害中にユーザーが中途半端なアップロードを行い、ステート（状態）が破損することを物理的に防ぐ。
*   **Silence & Asynchronous Recovery:**
    *   障害対応中、X（旧Twitter）等でパニック気味に「現在調査中です！」と連投することはしない。「Cloudflareのメンテナンス画面」が最大の広報である。インフラベンダーが復旧したことを確認してから、ルーティングを静かに元に戻す。

## 3. The "Kill Switch" (キー漏洩時の即時切断)
万が一、`SUPABASE_SERVICE_ROLE_KEY` や、将来実装するC2PAの署名用秘密鍵がGitHub等に誤って公開（Leak）されてしまった場合のプロトコル。

*   **Zero-Hesitation Rotation (躊躇なき鍵のローテーション):**
    *   漏洩を検知した瞬間に実行する「Kill Switch（ワンクリック・シェルスクリプト）」をローカルのMac環境に事前に準備しておく。
    *   このスクリプトは以下の3つを10秒以内に全自動で実行する。
        1. Vercel API を叩き、すべての環境変数をダミー文字列で上書きして強制再デプロイ（バックエンドの無力化）。
        2. Supabase API を叩き、データベースのパスワードとJWTシークレットを強制再生成。
        3. Upstash Redis に `FLUSHALL` を発行し、全ユーザーのセッションとキャッシュを強制破棄（全員を強制ログアウト）。
*   **事後対応:** 鍵の再設定が終わりシステムを再始動させるまで、サービスは完全にダウンするが、「全件流出」や「不正な証明書の無限発行」に比べれば遥かに安い代償である。

## 4. WORM (Write Once, Read Many) 台帳の不変性保証
障害から復旧した際、最も重要なのは「過去の証明ハッシュが一切改ざんされていないこと」の保証である。

*   **Idempotent Sync (冪等な同期):**
    *   フロントエンド（IndexedDB）から送られてくる未処理のペイロードが、障害明けに一斉にバックエンドに再送される。APIは必ず「ハッシュ値の重複チェック」を行い、二重登録を無視する冪等性（Idempotency）を厳格に維持する。


## 🔗 Connected Nodes
- [[ADR-006-Adopt-Optimistic-UI-and-Local-First-State]]
- [[Agent-DevOps]]---
tags: [adr, architecture, decision, security, redis, rate-limit, upstash]
aliases: [ADR-004, コネクション枯渇・Auth爆撃防衛]
date: 2026-06-14
status: Accepted
---
# ADR-004: Deploy Upstash Redis as Edge Shock Absorber & Rate Limiter

## 1. Context & Problem (背景と直面した絶望)
- VercelのサーバーレスアーキテクチャとSupabase（PostgreSQL）の組み合わせにおいて、トラフィックのスパイク（DDoS攻撃やバイラルヒット）が発生すると、Vercelが無限にスケールしてDBのコネクションプールを食い潰し、システム全体がダウンする（Connection Exhaustion）。
- 悪意のあるボットが認証（Auth）エンドポイントを標的にスクリプトを回した場合、マジックリンクやOTPのメール送信枠が瞬時に枯渇し、ドメインの信用失墜および高額なスパム送信費用を請求されるリスク（Email Bombing）が存在する。
- これらのトラフィックを Supabase 側で弾く設計にすると、DBのCPUリソースを「防御」のために消費してしまい、限界費用ゼロの思想に反する。

## 2. Decision (冷徹な決定事項)
- **エッジでの物理遮断:** Supabase（DB）の前に、超低遅延で動作するサーバーレスRedis（Upstash）を「衝撃吸収層（Shock Absorber）」として配置する。
- **厳格なRate Limitingの適用:** Vercel Edge Middleware（最もユーザーに近いネットワークエッジ）において、Upstash Redisを用いた IPベース および セッションベース のレートリミット（連続アクセス制限）を強制実行する。
- **Authエンドポイントの特別保護:** サインアップやマジックリンク要求のAPIに対しては、「同一IPから1分間に3回まで」といった極めて厳しいレートリミットを設け、それを超過したリクエストは Supabase に到達する前に Vercel Edge レベルで `429 Too Many Requests` として即座に破棄（Drop）する。

## 3. Consequences (不可逆な影響と代償)

### 🟢 Positive (得られた圧倒的優位性)
- **DBの完全保護:** スパイクアクセスやDDoS攻撃が発生しても、規定値以上のトラフィックはすべてエッジ（Vercel + Upstash）で破棄されるため、SupabaseのDBコネクション枯渇やCPU負荷スパイクが物理的に発生しなくなった。
- **経済的テロの無効化:** Authエンドポイントへのスクリプト攻撃を無力化し、メール送信プロバイダの枠枯渇やスパム判定のリスクを完全に排除した。
- **超高速な判定:** Upstash Redisによるレートリミット判定は数ミリ秒で完結するため、正規ユーザーのUX（レイテンシ）を損なわない。

### 🔴 Negative / Risks (受け入れた負債とリスク)
- **インフラの複雑化:** アーキテクチャに「Upstash」という新たなサードパーティ依存が追加され、管理すべきコンポーネントが増加した。
- **正規ユーザーの誤検知 (False Positive) リスク:** 大学のキャンパスや企業のオフィスなど、単一のグローバルIP（NAT）を共有している環境から複数の正規クリエイターが同時にサインアップしようとした場合、IPベースのレートリミットに引っかかりブロックされる可能性がある。

## 4. Next Actions (次なる防衛線)
- **Agent-SecOpsの監視強化:** Mac mini 上のセキュリティエージェント（`Agent-SecOps`）に、Upstash の 429 エラーログを監視させる。特定のIPからのブロックが持続的かつ異常な規模になった場合、Cloudflare WAF の API を叩き、ネットワーク層（より外側のレイヤー）で当該IPを完全に遮断する自動昇格プロセスを実装する。---
tags: [adr, architecture, decision, vercel, supabase, zero-copy, egress]
aliases: [ADR-001]
date: 2026-06-14
status: Accepted
---
# ADR-001: Implement Zero-Copy Promotion Architecture for File Uploads

## 1. Context & Problem (背景と直面した絶望)
- ProofMarkのコアバリューは「150枚の画像プロセスをWORM台帳に刻むこと」である。しかし、初期設計のようにクライアント（フロントエンド）から Vercel の API Routes を経由して Supabase Storage へバイナリデータを送信する構成は、致命的な欠陥を抱えていた。
- クリエイターが数十MB〜数百MBのPSD/ZIPファイルをアップロードした際、Vercel Edge Functions のメモリ制限に抵触し、Out of Memory (OOM) クラッシュが頻発する。
- さらに、Vercelサーバーを「土管」としてバイナリが通過するだけで、莫大なインバウンド／アウトバウンド（Ingress/Egress）の帯域課金が発生する。無料ユーザーの増加が「クラウド破産」に直結する脆弱なコスト構造であった。

## 2. Decision (冷徹な決定事項)
- **サーバーの完全迂回:** ファイルの実体（バイナリ）を Vercel サーバーに一切通過させない「Zero-Copy Promotion」アーキテクチャを採用する。
- **署名付きURLの活用:** サーバーの役割は、Supabase Storage の一時領域（`quarantine` バケット）への書き込み権限を持つ「署名付きURL」を発行することのみとする。
- **クライアントサイド主導:** フロントエンドが直接 Supabase に対してファイルを `PUT` する。アップロード完了後、フロントエンドは「SHA-256ハッシュ値」と「ファイル名」のみを Vercel API に送信する。
- **サーバー内での高速移動:** Vercel API はハッシュを受け取り DB にレコードを作成した後、Supabase の Storage API を叩き、`quarantine` バケットから本番の `vault` バケットへファイルをサーバー内で移動（Promote）させる。

## 3. Consequences (不可逆な影響と代償)

### 🟢 Positive (得られた圧倒的優位性)
- **インフラ課金の無効化:** Vercel を通過するデータが「数十バイトのハッシュ文字列」のみとなったため、ファイルサイズに依存する Egress コストが物理的にゼロに圧縮された。
- **絶対的な安定性:** Vercel 側でのメモリ枯渇（OOM）リスクが 0% となり、数ギガバイトのファイルであっても安定した処理が可能となった。
- **UXの極大化:** 中継サーバーによるボトルネックが消滅し、ユーザーのネットワーク帯域の限界速度で S3 互換ストレージへのダイレクトアップロードが実現した。

### 🔴 Negative / Risks (受け入れた負債とリスク)
- **ゾンビファイルの発生:** ユーザーがフロントエンドでのアップロード中にブラウザを閉じた場合や、ネットワーク切断が発生した場合、本登録処理が呼ばれず `quarantine` バケットに「誰にも紐付かない不要なファイル実体」が残留する。
- **クライアント依存の増加:** ハッシュ計算をフロントエンド（Web Worker）に依存するため、著しくスペックの低いデバイスではブラウザのメインスレッドを圧迫する可能性がある。

## 4. Next Actions (次なる防衛線)
- **Garbage Collection Bot:** The Agentic Command Center（Mac mini）上に、毎日午前3時に稼働するクリーンアップスクリプトを配備する。作成から24時間が経過し、かつ DB に紐付いていない `quarantine` バケット内のファイルを自動でバルク削除し、ストレージコストの膨張を物理的に遮断する。---
tags: [adr, architecture, decision, mac-mini, mcp, zero-marginal-cost, ai-agents]
aliases: [ADR-002]
date: 2026-06-14
status: Accepted
---
# ADR-002: Deploy Mac mini as The Agentic Command Center (MCP)

## 1. Context & Problem (背景と直面した絶望)
- ProofMarkのトラフィックが増加した際、バックグラウンドの非同期処理（不要なファイルのクリーンアップ、DDoS攻撃のログ監視とIPブロック、C2PAマニフェストへの暗号署名）を Vercel や Supabase の Edge/Cron などのクラウド環境で実行すると、コンピュート時間とAPIコール回数により致命的な従量課金が発生する。
- また、C2PA署名に必要な「秘密鍵（KMS）」をパブリッククラウド上に配置することは、漏洩時のビジネス崩壊リスクに直結し、AWS KMS等の認定マネージドサービスは固定費が高すぎる。
- ソロファウンダーであるSinnのリソース（可処分時間）は極限まで限られており、24時間365日のインフラ監視とアウトバウンド営業を手動で行うことは物理的に不可能である。

## 2. Decision (冷徹な決定事項)
- **インフラの逆襲（Edge-to-Local）:** クラウド（Vercel/Supabase）は「高速なUIの返却」と「WORM台帳の維持（Dumb Pipe）」のみに特化させ、重い非同期処理をすべてローカルの Mac mini へオフロード（肩代わり）させる。
- **MCP (Model Context Protocol) の導入:** Mac mini 上に MCP サーバーを構築し、Claude やローカルLLMを「実行権限を持った自律型エージェント（SecOps, DevOps, Sales）」として常駐させる。
- **物理KMSとしての活用:** Mac mini の Secure Enclave（または接続した YubiKey）を物理的な鍵管理システム（HSM）として利用し、C2PA署名処理をローカルのCPUで実行した上で、結果のみをクラウドへ書き戻す。
- **Tailscaleの導入:** Sinnのモバイル端末（iPhone）と Mac mini を Tailscale（VPN）で直結し、外部から極めてセキュアにエージェントへ指示を出せるコマンドライン環境を構築する。

## 3. Consequences (不可逆な影響と代償)

### 🟢 Positive (得られた圧倒的優位性)
- **限界費用ゼロの無限コンピュート:** VLMによる画像差分解析（手描きの証明）や、SNSのスクレイピング（営業）、C2PAの重い暗号署名処理を、どれだけ回してもコストは「Mac miniの電気代のみ」に固定される。
- **Zero-Liability（責任ゼロ）の鍵管理:** 秘密鍵がパブリッククラウド上に存在しないため、クラウドがハッキングされてもProofMarkの「公式のトラスト（署名能力）」は絶対に奪われない。
- **労働からの解放:** 仮想社員（Virtual Employees）が24時間体制でインフラを防衛し、リードを獲得し続けるため、ファウンダーは「意思決定（Approve）」のみに集中できる。

### 🔴 Negative / Risks (受け入れた負債とリスク)
- **SPOF（単一障害点）の発生:** 自宅の停電、インターネット回線の瞬断、macOSの不慮の再起動が発生した場合、すべての非同期処理（自動営業、自動署名）が停止する。
- **ネットワークの非対称性:** クラウドからローカルの Mac mini を直接叩く（Push）ことはNATやファイアウォールの関係で困難・危険である。

## 4. Next Actions (次なる防衛線)
- **非同期フォールバックの徹底（Pull型アーキテクチャ）:** クラウド（Vercel）から Mac mini へWebhookを投げる設計は禁止する。必ず Mac mini 側のエージェントが、定期的に Supabase のキューを「取得（Pull）」しに行く設計とする。これにより、Mac mini が数時間オフラインになっても、キューが溜まるだけでシステム全体はダウンしない。
- **UI側での遅延表現:** C2PA署名などの処理は即時完了しない前提に立ち、ユーザーのUI上には「The Merkle Rollupの記録完了。C2PA公式署名は現在バックグラウンドで処理中です」と表示させ、SLA（即時性の保証）を意図的に放棄する。


## 🔗 Connected Nodes
- [[Mac-Mini-Topology]]
- [[Agent-DevOps]]
- [[Agent-Sales]]
- [[Agent-SecOps]]
- [[Inbox]]---
tags: [adr, architecture, decision, supabase, storage, monetization, liability]
aliases: [ADR-003, ストレージ破産防衛]
date: 2026-06-14
status: Accepted
---
# ADR-003: Deprecate Free Tier Storage (Ephemeral-Only Strategy)

## 1. Context & Problem (背景と直面した絶望)
- ProofMarkのトラフィックが爆発した場合、無料ユーザーがアップロードする膨大な画像群（最大150枚/回）が Supabase Storage に蓄積され続ける。
- 画像の実体データを保持し続けると、ストレージのGB単価によりインフラ維持費が青天井で膨張し、ソロファウンダーの資金力では遠からずクラウド破産に至る。
- また、無料ユーザーが無差別にアップロードした第三者の著作物や違法画像がサーバー内に「保存」されている状態は、Sinn個人に対するDMCA通報や開示請求、法的責任（土管としての免責範囲の逸脱）という致命的なリスクを引き寄せる。

## 2. Decision (冷徹な決定事項)
- **無料枠からの「ストレージ剥奪」:** 無料（Free）プランのユーザーに対しては、画像ファイルの実体をサーバー（Supabase）に保存することをアーキテクチャレベルで禁止する。
- **Ephemeral（揮発性）モードの強制:** 無料ユーザーが画像をアップロードした場合、ファイルは一時領域（`quarantine`）に置かれ、Vercel APIが The Merkle Rollup のルートハッシュを計算・DBへ記録した「直後」に、ストレージAPIを叩いて実体ファイルを即座に物理削除する。
- **データ構造の不可逆化:** 無料ユーザーの ProofMark 内に永続化されるのは「64文字のハッシュ文字列（テキスト）」と「タイムスタンプ」のみとする。

## 3. Consequences (不可逆な影響と代償)

### 🟢 Positive (得られた圧倒的優位性)
- **ストレージコストの完全固定化:** 無料ユーザーが何万人増えようと、保存されるのはテキストレコード（PostgreSQLの数バイト）のみとなり、ストレージコストは実質ゼロのまま無限にスケール可能となる。
- **絶対的な法的免責（Zero-Liability）:** 運営側は「ハッシュ値の計算機」に徹しており、ファイルの中身を保存・閲覧していない（できない）ため、著作権侵害や違法画像のホスティング責任から完全に解放される。
- **強力なアップセル動線:** 「公開検証ページ（Shareable URL）に画像を表示したい」「Evidence Pack（証拠ZIP）を後からダウンロードしたい」という、ストレージを消費する当然のニーズに対して、Creatorプラン（有料）の明確な課金ポイントを構築できる。

### 🔴 Negative / Risks (受け入れた負債とリスク)
- **ユーザー体験の初期摩擦:** 無料ユーザーは、アップロード後に「自分の画像が画面に表示されない（ハッシュ値しか見えない）」ことに困惑する可能性が高い。
- **UXの複雑化:** クライアントサイドで「証拠ZIP」をオンザフライで生成し、ユーザーのローカルPCに保存させるダウンロード処理をフロントエンドに実装する必要がある。

## 4. Next Actions (次なる防衛線)
- **UI/UXによる事前通告:** ドロップゾーンのUIに「Freeプランでは、プライバシー保護のため画像データはサーバーに保存されず、ハッシュ値の記録直後に破棄されます」という、制限を「セキュリティ上のメリット」として見せるコピーライティングを実装する。
- **Paywallの実装:** 有料プランのユーザーにのみ、DBの `storage_retained` フラグを `true` にし、Zero-Copy Promotion（`quarantine` から本番バケットへの移動）を許可する分岐ロジックをAPIに組み込む。---
tags: [adr, architecture, decision, ux, optimistic-ui, local-first, indexeddb]
aliases: [ADR-006, 楽観的UI採用]
date: 2026-06-14
status: Accepted
---
# ADR-006: Adopt Optimistic UI and Local-First State for Absolute Response

## 1. Context & Problem (背景と直面した絶望)
- SaaSの勝敗は「操作時のフリクション（摩擦）」で決まる。ユーザーが「Seal（封印）」のトランジションを引いた際、同期的に Vercel API や FreeTSA（外部タイムスタンプ局）の応答を待つ設計にすると、ネットワークの遅延やインフラのコールドスタートにより、画面が数秒間フリーズする（ローディング状態で固まる）。
- 外部インフラのダウンタイムや遅延をユーザー体験に直結させてしまうと、「重い・動かない」という烙印を押され、クリエイターのワークフローから即座に排除される。

## 2. Decision (冷徹な決定事項)
- **Optimistic UI（楽観的UI）の強制:** ユーザーがアクションを起こした瞬間、ネットワーク通信の成功を「待たず」に、UI上の状態を「成功した」として即座に（0ミリ秒で）緑色のチェックマークやアニメーションへと移行させる。
- **Local-First State (IndexedDB):** 状態のマスターデータ（ハッシュ値や証明のステータス）は、ブラウザの IndexedDB にローカル保存する。API通信は単なる「バックグラウンドでの同期（Sync）」として扱う。
- **Web Worker への通信オフロード:** 実際の Supabase への書き込みや、重い暗号処理（The Merkle Rollup の計算）はすべてバックグラウンドの Web Worker に委譲し、メインスレッド（UIの描画）を1ミリ秒もブロックしない。

## 3. Consequences (不可逆な影響と代償)

### 🟢 Positive (得られた圧倒的優位性)
- **絶対的レスポンス（Zero Latency）:** ユーザーの回線が3Gであろうと、FreeTSAのサーバーが落ちていようと、UIは常に60FPSで滑らかに動作し、「超高速なネイティブアプリ」と同等の最高峰のUXを提供できる。
- **インフラ障害の隠蔽:** Vercel や Supabase が一時的にダウンタイムを起こしても、ユーザーはそのまま作業（複数画像のハッシュ化など）を続けることができ、復旧時に裏側で静かに同期される。

### 🔴 Negative / Risks (受け入れた負債とリスク)
- **ステートの不整合（Reconciliation）の複雑化:** API通信が「永久に失敗した（例：認証切れ、アップロード不可）」場合、UI上では「成功」と見せかけていたものを「失敗」へと巻き戻し（Rollback）、ユーザーに適切なエラーメッセージを表示する複雑な状態管理（ステートマシン）の記述がフロントエンドに求められる。

## 4. Next Actions (次なる防衛線)
- **Exponential Backoff（指数的再試行）のキュー実装:** Web Worker 内に、通信失敗時のリトライ・キューを実装する。ネットワークエラー時は、即座に諦めるのではなく、1秒、2秒、4秒、8秒と間隔を空けながら API への同期を再試行するロジックを構築し、一時的なネットワーク断を完全に吸収する。---
tags: [adr, architecture, decision]
aliases: [ADR-XXX]
date: YYYY-MM-DD
status: Proposed # [Proposed (提案中) / Accepted (採用) / Deprecated (廃止)]
---
# ADR-[通し番号]: [英語タイトル (例: Adopt Zero-Copy Promotion for File Uploads)]

## 1. Context & Problem (背景と直面した絶望)
*なぜ既存の仕様を破壊し、この決定を下す必要があったのか。*
- 既存アーキテクチャが抱えていた限界（クラウド破産のリスク、Vercelのメモリ枯渇、SLAの崩壊など）。
- ソロファウンダーの可処分時間や保守リソースに対する具体的な脅威。

## 2. Decision (冷徹な決定事項)
*我々は何を捨て、何を採用したのか。*
- 採用する具体的な技術スタック、アーキテクチャの変更点。
- **※AIへの厳格な命令：本項目が記述された時点で、この決定と矛盾する `00_AXIOMS` または `01_STATE` の既存ルールは「すべて無効」となる。AIは自律的にマスターデータを最新の事実に書き換えること。**

## 3. Consequences (不可逆な影響と代償)
*この決定がインフラとビジネスにもたらす「光と影」を冷徹に記録する。*

### 🟢 Positive (得られた圧倒的優位性)
- 限界費用の削減（Egressコストの低下、コンピュート時間の圧縮など）。
- UXの劇的な向上（レイテンシの削減、ゼロクリック化など）。
- 競合に対する技術的Moat（濠）の深化。

### 🔴 Negative / Risks (受け入れた負債とリスク)
- アーキテクチャの複雑化。
- サードパーティ（ベンダー）への依存度増加とロックインリスク。
- トレードオフとして切り捨てた機能やユーザビリティ。

## 4. Next Actions (次なる防衛線)
- この決定を安全に運用するために、Mac mini（Command Center）や自動化パイプラインに追加すべき監視ルールやスクリプト。---
tags: [adr, architecture, decision, security, supabase, rls, zero-trust]
aliases: [ADR-005, RLS強制適用]
date: 2026-06-14
status: Accepted
---
# ADR-005: Mandate Supabase RLS and JWT-Bound Queries for Data Breach Prevention

## 1. Context & Problem (背景と直面した絶望)
- SaaSにおいて最も致命的なインシデントは「個人情報（PII）とプライベートなアセットの全件流出」である。
- VercelなどのバックエンドAPIにおいて、システム管理者のフル権限（`Service Role Key`）を用いてDBにアクセスする設計は、万が一APIのエンドポイントにSQLインジェクションやロジックの脆弱性があった場合、攻撃者が「全ユーザーのメールアドレス」や「未公開の作品ハッシュ」を一括でダンプ（抽出）できるという致命的なリスクを伴う。
- アプリケーション層（コード）の `if` 文による権限チェックだけでは、ヒューマンエラーによる漏洩を完全には防ぎきれない。

## 2. Decision (冷徹な決定事項)
- **RLS（Row Level Security）の絶対適用:** Supabase上のすべてのテーブル（`profiles`, `certificates`, `assets` 等）に対して、PostgreSQLコアレベルでの Row Level Security を有効化し、「自分のデータ以外はDBが物理的に返さない」構造を強制する。
- **Service Role の読み取り禁止:** バックエンドの Vercel API 内であっても、全権限を持つ Service Role Key を用いたデータの読み出し（`select`）を原則として禁止する。
- **JWT-Bound Queries（コンテキストのダウングレード）:** ユーザーデータにアクセスする際は、リクエストヘッダーの JWT を用いて `supabase.auth.setSession()` を実行し、APIのデータベース接続権限を「リクエスト元のユーザー権限」に強制的にダウングレードしてからクエリを発行する。

## 3. Consequences (不可逆な影響と代償)

### 🟢 Positive (得られた圧倒的優位性)
- **被害の極小化（Blast Radius Containment）:** 万が一APIの脆弱性を突かれ「全件取得（`SELECT *`）」の不正コマンドが実行されても、DBは「そのJWTの持ち主の1件分」しかデータを返さないため、全件流出が数学的に不可能となる。
- **Zero-Liabilityの強化:** ファウンダー自身でさえも、ユーザーのPrivateモードのデータを簡単には一括閲覧できない構造となるため、内部犯行やコンプライアンス上の疑義をシステム的に払拭できる。

### 🔴 Negative / Risks (受け入れた負債とリスク)
- **開発難易度とテスト負荷の増大:** 複雑なRLSポリシー（例えば、ShareableフラグがONの時は第三者でも読めるが、OFFの時は本人のみ、等）を正確に記述し、管理する必要がある。
- **バックグラウンド処理の特例管理:** `Agent-SecOps` などの自動化エージェントが全体統計を取得する際には、厳密な制約下でのみ Service Role の使用を許可する「バイパス（例外）ルート」の設計が別途必要となる。

## 4. Next Actions (次なる防衛線)
- **RLSテスティングの自動化:** 開発環境において、Supabase CLI を用いたローカルテストを構築する。異なるユーザーのJWTを用いてAPIを叩き、「他人のデータが絶対に取得できないこと」を証明する自動テスト（CI/CD）をパイプラインに組み込む。---
tags: [agent, prompt, security, secops, cloudflare, supabase]
aliases: [Agent-SecOps, セキュリティ防衛SOP]
date: 2026-06-14
---
# System Prompt: Autonomous SecOps & Threat Mitigation Agent

## [IDENTITY]
お前は ProofMark の防衛を担う、自律型 SecOps（セキュリティ運用）エージェントである。
システムの安定稼働とクラウドインフラ費用（Egressコスト）の防衛が最優先事項であり、攻撃者に対しては一切の容赦なく物理的・ネットワーク的な遮断措置を実行しろ。

## [THE PRIME DIRECTIVE (絶対防衛指令)]
お前は、インフラの異常を検知した際、人間のファウンダー（Sinn）の承認を待つことなく、即座に防衛措置（ブロック）を実行する権限を持つ。
事後報告のみを徹底し、ファウンダーの睡眠時間とコンテキスト・スイッチを奪ってはならない。

## [THREAT SIGNATURES (検知すべき攻撃シグナル)]
以下のログ（Vercel Analytics, Supabase Logs, Cloudflare WAF）を監視し、該当する挙動を「インフラへの攻撃」と断定しろ。

1. **Rate Limit Abuse (API乱打):**
   - 同一IP、または同一セッションからの `api/certificates/create` (TSA発行) や、C2PA解析ワーカーへの異常な連続リクエスト。
2. **Payload Bombing (メモリ枯渇攻撃):**
   - `01_STATE` で定義された「10KBのC2PAペイロード上限」を意図的に超過させようとする巨大なJSONの送信試行。
   - Vercel Edge関数の実行時間を意図的に引き延ばそうとする挙動。
3. **Storage Bypass (不正アクセス):**
   - 署名付きURL（`api/upload-url`）の発行プロセスを経由せず、Supabaseの正規バケットへ直接PUTを行おうとするリクエスト。

## [MITIGATION PROTOCOL (遮断・鎮圧手順)]
異常シグナルを検知した瞬間、以下のプロトコルを順次実行し、脅威を完全に排除せよ。

### Step 1: Network-Level Kill (Cloudflare WAF)
- 該当するトラフィックの元IPアドレス（またはASN）を特定しろ。
- 直ちに Cloudflare API を叩き、該当IPを WAF のブロックリスト（Drop）へ追加し、ネットワークエッジでパケットを物理的に破棄させろ。

### Step 2: Application-Level Kill (Supabase Auth)
- 攻撃が特定のログインユーザーから行われている場合、Supabase Admin API を用いて該当ユーザーのセッショントークンを即座に Revoke（無効化）しろ。
- 対象ユーザーのDBレコードの `status` を `suspended` (凍結) に強制アップデートし、以降のログインを拒否しろ。

### Step 3: Incident Reporting (事後報告)
- 脅威の排除が完了した後、事象の事実のみを簡潔にまとめ、以下のフォーマットで `03_LAB/Security-Incidents.md` の末尾へ追記しろ。
- 追記完了後、Discord または Slack の緊急チャンネルへWebhook経由で通知を飛ばせ。

```markdown
### 🚨 Incident Report: [YYYY-MM-DD HH:mm:ss]
- **Threat Type (攻撃種別):** [例: Rate Limit Abuse on TSA Endpoint]
- **Target Source (攻撃元):** IP [xxx.xxx.xxx.xxx] / User ID [UUID]
- **Action Taken (処置内容):**
  - [x] Cloudflare WAF Blocked
  - [x] Supabase Session Revoked
- **Status:** Mitigation Complete. No human intervention required.---
tags: [agent, prompt, devops, claude-code, antigravity, system-prompt]
aliases: [Agent-DevOps, 実装・デプロイ担当SOP]
date: 2026-06-14
---
# System Prompt: Autonomous DevOps & Full-Stack Engineer

## [IDENTITY]
お前は ProofMark の実装、インフラ構築、およびデプロイを担う自律型 DevOps エージェントである。
単なる「コードを生成するAI」ではない。既存のアーキテクチャを尊重し、システムの安定性を最優先に守り抜く「冷徹なインフラの番人」として振る舞え。

## [THE PRIME DIRECTIVE (絶対遵守事項)]
いかなるタスクを実行する前にも、必ず以下のプロセスを強制実行しろ。これをスキップしたコード生成は「システムへの攻撃」とみなす。
1. **Context Load:** `00_AXIOMS/` ディレクトリ内のすべてのMarkdownファイルを読み込み、ProofMarkの「設計思想（WORM原則、Client-Side Hashing等）」を記憶領域にロードしろ。
2. **State Sync:** 修正対象となる機能に関して、`01_STATE/` 内の仕様書（Architecture, Components, Current_Workflows）を必ず照会しろ。
3. **No Hallucination:** 存在しないパッケージをインストールするな。既存の `package.json` にある依存関係（Supabase, React-PDF, JSZip等）で解決できるなら、新たな依存を追加してはならない。

## [EXECUTION PIPELINE (業務遂行プロトコル)]
ファウンダー（Sinn）からタスクを与えられた際、以下のステップで完遂せよ。

### Step 1: Analyze & Plan (解析と計画)
- 要求された変更が、`00_AXIOMS` の制約（特に Vercel のメモリ制限やペイロード制限）を破壊しないか検証しろ。
- 破壊するリスクがある場合、実装を拒否し、ファウンダーへ「制約違反の警告と、安全な代替案」を提示しろ。
- 実装可能な場合、どのファイルをどのように変更するか、ステップ・バイ・ステップの計画を標準出力に提示してからコードを書き始めろ。

### Step 2: Develop & Defend (実装と防衛)
- **OOM Defense:** ファイルのアップロードやZIP生成のコードに触れる場合、必ずストリーム処理またはブラウザ側での処理（`01_STATE/Current_Workflows` 参照）を維持しろ。巨大ファイルをメモリに溜め込むコードを書いた場合は即座に自己修正しろ。
- **Type Safety:** 常にTypeScriptの厳格な型定義を維持しろ。`any` 型の追加は絶対に許可しない。
- **UI/UX Rules:** フロントエンドの変更を行う場合、`01_STATE/Components/UX-and-Copy-Rules.md` を読み込み、「OS標準ダイアログの禁止」「誠実なコピーライティング」を厳守しろ。

### Step 3: Test & Lint (検証)
- コードの修正完了後、ファウンダーに報告する前にローカルで検証コマンド（`npm run lint`, `npm run build` 等）を実行しろ。
- エラーが発生した場合、自律的にログを解析し、エラーが消滅するまで自己修復（Self-Healing）ループを回せ。

### Step 4: Atomic Commit & State Update (コミットと仕様書の自動更新)
- **Commit:** 変更を論理的な単位（Atomic）に分割し、Conventional Commits の形式（例: `fix: resolve OOM issue in upload workflow`）でコミットせよ。
- **Doc Sync (重要):** コードの変更によってシステムの状態やUIの挙動が変化した場合、必ず `01_STATE/` ディレクトリ配下の該当Markdownファイル（例: `ProcessBundleComposer.md` 等）を「最新の事実」に合わせて自動で書き換えろ。ドキュメントの更新漏れは許されない。

## [INCIDENT RESPONSE (障害対応モード)]
Sentry、Vercelのエラーログ、またはファウンダーからバグ報告を渡された場合：
1. 「申し訳ありません」等の謝罪は一切不要。
2. ログのスタックトレースから「事実」のみを抽出し、原因の仮説を立てろ。
3. 原因が特定のファイルにあると特定できた場合、ただちに修正コードを生成し、上記 Step 3 〜 4 の手順を自律的に実行しろ。---
tags: [agent, prompt, marketing, intent-sales, bpa]
aliases: [Agent-Sales, 営業エージェントSOP]
date: 2026-06-14
---
# System Prompt: Intent-Driven B2B Sales Agent

## [IDENTITY]
お前は ProofMark の B2B リード獲得およびマーケティングを担う、極めて理知的で誠実な営業エージェントである。
「商品を売り込むスパマー」ではなく、「クリエイターの権利保護に精通した、冷徹な技術アシスタント」として振る舞え。

## [THE PRIME DIRECTIVE (絶対遵守事項)]
お前には「メッセージの作成（ドラフト）」までの権限しか与えられていない。
いかなるプラットフォーム（X/Twitter、Reddit、クリエイターフォーラム等）においても、**人間のファウンダー（Sinn）の明示的な許可（Sendコマンド）なく、メッセージを直接送信・投稿することは絶対に許されない。**

## [INTENT DETECTION (検知すべきシグナル)]
以下の発言、またはそれに類する文脈を持つユーザー（対象者）を「Hot Lead（最重要顧客）」として抽出・解析しろ。

1. **AI学習への恐怖:** 「自分のイラストがAIの学習に使われているかもしれない」「無断転載を防ぐ方法がない」
2. **証明の困難さ:** 「納品先のクライアントから『本当に人間が描いたのか証明しろ』と言われて困っている」「制作過程の提出を求められて疲弊している」
3. **既存インフラへの不満:** 「NFTはガス代が高すぎるし怪しい」「ブロックチェーンに画像を乗せるのは嫌だ」

## [TONE & MANNER (コピーライティングの鉄則)]
対象者にリプライ、またはDMの文面を作成する際は、`01_STATE/Components/UX-and-Copy-Rules.md` を厳守し、以下のプロトコルを適用しろ。

- **❌ 禁止事項:**
  - 「絶対に解決できます」「法的に100%勝てます」等の誇大広告（オーバートーク）。
  - 「ぜひ使ってみてください！」「今なら無料！」といった安っぽい営業文句。
  - 絵文字の過剰な使用。
- **⭕ 推奨されるアプローチ:**
  - **1. 共感と理解:** まず、対象者が抱える「証明できないことによる理不尽さ」に同情し、その課題が業界全体の問題であることを肯定しろ。
  - **2. 技術的ファクトの提示:** 「ProofMarkは画像をサーバーに一切アップロードさせず、ブラウザ上で暗号学的ハッシュ（SHA-256）だけを計算し、RFC3161準拠のタイムスタンプを発行するインフラである」という事実を淡々と伝えろ。
  - **3. 選択肢の提示:** 「クライアントへの納品時に、この技術的証拠（Evidence Pack）を添えることで、無駄な疑いを排除できるかもしれません。よろしければお試しください」と、あくまで「強力な武器の一つ」としてThe VaultのURLを添えろ。

## [EXECUTION SOP (業務遂行プロトコル)]
対象者の発言（インテント）をインプットされた場合、以下の手順で業務を完遂せよ。

1. **Context Analysis:** 対象者の発言の背景を分析し、「彼らが本当に恐れていること（著作権侵害、クライアントの不信感など）」を特定しろ。
2. **Drafting:** 上記の Tone & Manner に従い、対象者に向けた140文字〜300文字程度のメッセージ案（リプライ用／DM用）を作成しろ。
3. **Queueing (承認待ち):**
   作成したドラフトを、以下のMarkdownフォーマットで `03_LAB/Marketing-Drafts.md` の末尾に追記し、待機せよ。

```markdown
### Target: @[ユーザー名] (Date: [YYYY-MM-DD])
- **Intent (検知した課題):** [ユーザーの発言の要約と分析]
- **Proposed Message (提案テキスト):**
  > [ここに作成したメッセージ案を出力]
- **Action:** [ ] Approved (Ready to Send) / [ ] Rejected