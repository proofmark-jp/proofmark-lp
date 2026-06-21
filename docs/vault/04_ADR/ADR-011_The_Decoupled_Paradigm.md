---
tags: [architecture, lessons-learned, state-sync, decoupled, adr]
aliases: [ADR-012, The Decoupled Paradigm, 状態同期の絶対原則]
date: 2026-06-21
---
# ADR-012: The Decoupled Paradigm と 状態同期の絶対原則

## 1. 背景と直面した危機 (The Crisis)
ProofMarkは当初、「最大150工程の画像をSupabaseに保存する」というWeb2的なストレージSaaSの延長線上で設計されていた。しかし、プロクリエイターの50MB〜500MBのPSDファイルをそのままアップロードさせる設計は、以下の致命的な崩壊（Crisis）をもたらすことが確定した。
- **UXの崩壊:** 巨大ファイルの直列/並列アップロードによるブラウザのメインスレッド窒息（UIフリーズ）。
- **FinOpsの崩壊:** Vercel/Supabaseの帯域幅（Egress）とストレージ容量の限界突破によるクラウド破産。
- **哲学の崩壊:** 「Zero-Knowledge Proof（完全なるゼロ知識証明）」を謳いながら、サーバーに機密の原本ファイルを送信しているという致死的な矛盾。

## 2. アーキテクチャの転換: The Decoupled Paradigm (実体と証明の分離)
これらを解決するため、システムの役割を「ファイルの預かり所」から**「証明特化のオーバーレイ（Proof Layer）」**へと完全に切り替える決断を下した。

- **クライアントサイド・ハッシング:** 原本はサーバーへ一切送らない。ブラウザ上のWeb Workerで数学的指紋（SHA-256）だけを計算する。
- **The Trojan Payload:** サーバーへ送るのは、視覚的証明となる「超軽量化されたWebPサムネイル（最大2MB）」と、SNS拡散の弾薬となる「HEAD画像（最大20MB）」のみとする。
- これにより、インフラ限界費用は極小化され、真のZero-Knowledgeが成立した。

## 3. 状態同期の絶対原則: Wipe & Replace と 差分Insert
フロントエンドとバックエンドの「配列（タイムライン）」の同期において、SaaS特有の「一意制約（Unique Constraint）のジレンマ」と「亡霊データ（Phantom Data）」に直面した。

- **教訓1: RDBにおける配列の部分更新は死を招く**
  既存のタイムラインに新しい画像が追加・並び替えられた際、それをバックエンドで「賢く差分アップデート」しようとすると、ステップの順序（Index）の衝突により確実に `500 Error`（Duplicate key value violates unique constraint）を引き起こす。
- **冷徹な最適解（The "Wipe & Replace" Patch）:**
  順序や構成のマスター（Single Source of Truth）は常にフロントエンドに持たせる。
  バックエンドは既存の `process_bundle_steps` を **「一旦すべてDELETE（Wipe）し、フロントエンドから送られてきた完全な配列を再INSERT（Replace）する」**。これが最もバグを生まず、冪等性（Idempotency）を担保する絶対解である。
- **教訓2: The Phantom Data（過去の遺物）への防衛**
  APIが途中でクラッシュした場合、DBに「証明書のガワ」だけが残る。この状態でもう一度保存しようとすると `409 Conflict`（重複エラー）で弾かれる。
  **「同じバンドル（プロジェクト）内でのハッシュ重複は『過去の自分の再試行』とみなし、エラーにせず許容してUpsertする」** という寛容な差分同期ロジックが必須である。

## 4. Single Source of Truth (単一パイプラインの法則)
- **「1枚の画像」と「150枚の画像」でパイプラインを分けない。**
- 単一の作品（Chain Depth: 1）であっても、必ず `ProcessBundleComposer` のUIと `create-json.ts` のAPIを通す。
- 特殊な分岐（If 1枚ならこっちのAPI）は技術的負債の温床となる。すべての発行プロセスを「The Merkle Rollupの生成」という単一のプロトコルに統合することで、システムの表面積を最小化した。

## 5. ファウンダーとしての冷徹な総括 (The Cold Truth)
**「複雑さをインフラに持ち込むな。クライアントの計算資源を信じ、サーバーは愚直な記録者に徹せよ。」**

ProofMarkのコアバリューはストレージではなく「証明」である。
重いデータは既存のクラウド（Google Drive等）に任せ、我々は最も美しく、最も速く「点と点を繋ぐハッシュの鎖」を織り上げることに全リソースを集中させる。この Decoupled Architecture こそが、巨大資本を持たないソロ・ファウンダーが非対称的優位性を確立するための絶対的生存戦略である。