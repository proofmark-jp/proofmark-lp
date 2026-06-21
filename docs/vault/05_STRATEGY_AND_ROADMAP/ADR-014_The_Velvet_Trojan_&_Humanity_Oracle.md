---
tags: [strategy, roadmap, widget, humanity-oracle, b2b, b2c]
aliases: [02_The-Velvet-Trojan-Roadmap, 次期戦略とロードマップ]
date: 2026-06-21
---
# ProofMark Strategy: The Velvet Trojan & Humanity Oracle

インフラが「実体と証明の分離（The Decoupled Architecture）」へ移行したことで、ProofMarkはストレージSaaSの重力から完全に解放された。
今後の戦略は、この「極限の軽量さ」と「暗号学的な信頼」を武器に、既存の巨大プラットフォームへ寄生・増殖していく非対称的アプローチをとる。

## Phase 1: The Velvet Trojan (美しいウィジェットによる寄生と増殖)
**「証明書ページで待つな。クリエイターの主戦場へ自ら出向け」**

ProofMarkのUIは極めて洗練されているが、SaaS内にユーザーを囲い込むWeb2的なアプローチは捨てる。
軽量なハッシュとサムネイルのみを束ねる新アーキテクチャの恩恵により、外部サイトへ埋め込んでも読み込み遅延（レイテンシ）はほぼゼロとなった。

* **Widget Network Effect Engine:**
    * `proofmark-api.ts` の `buildWidgetEmbedHtml` を拡張し、X（旧Twitter）、Notion、STUDIO、個人のポートフォリオサイト等に「インタラクティブな証明ウィジェット」として直接埋め込めるようにする。
    * **B2C向け（承認欲求と収益の刺激）:** 単なる「パクリ防止の盾」ではなく、「ラフから完成までのプロセスを美しく再生（Playback）できる魔法のショーケース」としてクリエイターに提供する。
    * **Skeb / 納品フローへの寄生:** クライアントへの納品時に「Evidence Packのダウンロードリンク付きウィジェット」を貼り付けさせることで、ProofMarkの認知度をバイラルに拡大させる。

## Phase 2: The B2B "Shadow Oracle" (エンタープライズ・コンプライアンス)
**「クリエイターには美しいUIを。企業には冷徹なスコアを。」**

B2Cでのトラフィックとデータ（ハッシュチェーン）が蓄積された後、高単価なマネタイズはB2B（ゲーム会社、出版社、プラットフォーマー）で回収する。

* **VLMによる Humanity Score の算出:**
    * クリエイターのUIにはAI判定のスコアを出さない（萎縮を防ぐため）。
    * 一方で、バックエンドの C2PA マニフェストの深部には、過程データの視覚的差分から導き出された「人間による制作である確率（Humanity Score）」を暗号化して注入する。
    * 企業側は、納品された画像（またはEvidence Pack）を検証する際、この Shadow Oracle のスコアをコンプライアンス（AI生成物排除）の基準として利用する。

## Phase 3: Mac mini Edge AI ＆ KMS 内製化 (究極のMoat構築)
**「クラウドの限界を、ローカルの物理ハードウェアで突破する」**

* **The Mac mini "Humanity Oracle" Pipeline:**
    * Phase 2の「Humanity Score」判定において、クラウド上のLLM（GPT-4oやClaude Opus）に全画像を投げればAPIコストで破産する。
    * ここで、オフィスに配備する **Mac mini + ローカルVLM（視覚言語モデル）** が稼働する。Vercel（クラウド）は軽量な「差分サムネイル」のみをMac miniへ送り、Mac miniのエージェントが無料で無限にスコアを算出してVercelへ返す。
    * ※原本をアップロードさせない「Decoupled Architecture」のおかげで、Mac miniが数GBのPSDをダウンロードして回線がパンクするリスクは完全に消滅した。
* **Autonomous KMS (自前署名インフラの確立):**
    * Numbers Protocol 等の外部API（繋ぎ）を卒業し、`SSL.com IV証明書 + YubiKey 5 FIPS + c2patool` を用いた完全内製・限界費用ゼロの C2PA 署名インフラを構築する。

## 結論 (The Cold Truth)
**ProofMarkは「重いデータを預かる倉庫」ではない。「文脈と信頼を編み込み、どこへでも持ち運べるようにする『軽量な殻（Shell）』」である。**
The Velvet Trojan（ウィジェット）をばらまき、Mac mini（Oracle）で知能を付与し、KMSで究極の信頼を刻む。これが我々の絶対的ロードマップである。