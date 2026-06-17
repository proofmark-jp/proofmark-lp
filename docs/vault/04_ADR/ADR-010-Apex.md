---
type: ADR
id: ADR-010-Apex
title: ProofMark 次世代アーキテクチャとハイブリッド・マネタイズ戦略（完全版）
date: 2026-06-17
status: Approved
---

# 1. 繋ぎのインフラ：Numbers Protocol 統合の完全仕様
* **アーキテクチャ:** The Merkle Rollup で生成した「ルートハッシュ」のみを抽出し、Numbers Capture API へ送信する。
* **Zero-copyの徹底:** 150枚の画像本体は絶対に送らない。APIには `asset_hash`（SHA-256）とメタデータのみをJSONで送信し、返却された署名済み C2PA Credential を手元で画像に注入（Inject）する。
* **離脱条件:** 12週間後、Mac mini の稼働テストが完了した瞬間、外部API依存を完全に断ち切り、YubiKey 5 FIPS + `c2patool` による完全内製化（物理KMS）へ移行する。

# 2. The Velvet Trojan（ベルベットのトロイの木馬戦略）
B2Cには極上のエンタメを提供し、B2Bには不可視の冷徹な暗号証明を提供するハイブリッド配管。

* **UIハック（Interactive Playback）:** 
  * ウィジェットを単なるバッジではなく「触れるメイキング映像」にする。シークバーを実装し、150工程の画像をパラパラ漫画のように再生可能にする。クリエイターの「努力を見せびらかしたい承認欲求」を直接ハックする。
* **Workflowハック（Skeb専用 納品スニペット）:**
  * ダッシュボードに「Skeb/FANBOX用 納品テキストをコピー」ボタンを設置。クリエイターが納品時にウィジェットURLをコピペするだけで、クライアントの満足度を上げる「無料の付加価値ツール」としてワークフローに寄生する。
* **Dataハック（Shadow Oracle - 不可視のAI監査）:**
  * ローカルVLM（Mac mini）による「人間性スコア」は、クリエイター側のUIには一切表示せず、生理的嫌悪感を回避する。スコアはC2PAマニフェストの深部にカスタムアサーションとして暗号化・不可視状態で注入する。

# 3. コアMoat：Humanity Oracle のデータスキーマ
* **実装構造:** C2PA v2.4 の標準仕様に則り、マニフェスト内に以下のJSONスキーマを `com.proofmark.humanity-oracle` としてハードコードする（上述のShadow Oracleとして機能）。
```json
  {
    "oracle_version": "1.0",
    "vlm_model": "LLaVA-1.5-13b-mac-mini",
    "human_probability_score": 98.5,
    "analyzed_layers": 150,
    "heuristics": ["stroke_velocity_variance", "layer_entropy_check"],
    "attestation": "Human-driven layer progression detected. Zero generative noise patterns."
  }
Human-in-the-loop (HITL) の閾値設定:

Score 95%以上: 自動 Seal（Mac mini が即時署名）

Score 80-94%: 非同期レビューへ回し、Sinn（管理者）がダッシュボードで目視承認するまで Pending 扱い。

Score 79%以下: Reject（AI生成の疑いとして弾く）。

4. 非対称マネタイズ：EU AI Act とオープンコア
B2B法務サブスクリプション:

アニメスタジオやゲーム会社に対し、「納品されたイラストがAI生成物（著作権汚染）でないことを証明するコンプライアンス・ゲートウェイ」として、月額高額プランで提供。Shadow Oracleの不可視データをB2B向けダッシュボードでのみ復号・可視化する。

Open Provenance Protocol (OPP):

マークルツリー構築ロジックを proofmark-core-sdk としてOSS化。競合のインセンティブを破壊してデファクト化し、収益化は前述の「Oracle API」に一本化する。

Invisible Pipeline（ネイティブ・プラグイン）:

Clip Studio Paint, Figma等のプラグインとして提供し、ユーザーが Cmd+S（保存）を押すたびにバックグラウンドでハッシュをVercel APIのRedisキューへ投げる。画面のロードやポップアップを一切出さない完全な摩擦ゼロを実現する。