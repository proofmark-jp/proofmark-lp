---
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
- **Agent-SecOpsの監視強化:** Mac mini 上のセキュリティエージェント（`Agent-SecOps`）に、Upstash の 429 エラーログを監視させる。特定のIPからのブロックが持続的かつ異常な規模になった場合、Cloudflare WAF の API を叩き、ネットワーク層（より外側のレイヤー）で当該IPを完全に遮断する自動昇格プロセスを実装する。