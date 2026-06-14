---
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
- **クォータのロールバック:** 商用TSA発行後、SupabaseのUpdate処理に失敗した場合、必ずUpstash Redisのクォータカウンターを `DECR` でロールバックさせる。