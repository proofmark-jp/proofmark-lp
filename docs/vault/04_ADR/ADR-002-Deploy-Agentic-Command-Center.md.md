---
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