---
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
- [[Stripe-Billing-Flow]]