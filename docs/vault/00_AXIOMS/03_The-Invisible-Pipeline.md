---
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
- [[C2PA-Integration]]