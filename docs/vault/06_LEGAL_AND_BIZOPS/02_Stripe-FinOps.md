---
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
    *   Checkoutセッションの作成APIに対して、「同一IPアドレスから10分間に5回以上」のリクエストがあった場合、Upstash RedisのレートリミットでAPIを物理的に遮断する（`429 Too Many Requests`）。これにより、カードテスターの攻撃トラフィックをStripeに到達させる前にVercel Edgeで焼き払い、Stripeアカウントへのペナルティスコア蓄積を防ぐ。