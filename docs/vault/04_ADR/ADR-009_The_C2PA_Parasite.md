# ADR-009: The C2PA Parasite (Portfolio Widget Strategy) - The Immutable Edition

## 1. Context & Architectural Goals
ProofMarkのコアバリューである「存在証明」と「AI/Humanの出自証明（C2PA）」を、ProofMarkプラットフォーム内部に留めておくのはGTM戦略として致命的な機会損失である。
本設計は、クリエイターの外部ポートフォリオサイト（Notion, WordPress, STUDIO, X等）へProofMarkの証明バッジを埋め込めるようにする「ウィジェット寄生戦略」の完全な実装仕様である。

以下の3つの絶対目標（The Triple Axioms）を遵守する。
1. **The Viral Parasitism (バイラルな寄生):** 外部サイトのトラフィックを利用し、ProofMarkの「VERIFIEDバッジ」を爆発的に拡散させる。
2. **Zero-Friction UX (摩擦ゼロの導入):** クリエイターのサイト表示速度（Core Web Vitals）を1ミリ秒も落とさず、コピペ一発で展開させる。
3. **Absolute Cloud Defense (クラウド破産の完全防衛):** 100万PVのバズが直撃しても、VercelのComputeとSupabaseのDBコネクションを一切消費しない「エッジキャッシュ・アーキテクチャ」を強制する。

---

## 2. Architectural Decisions (絶対仕様)

### Decision 1: The Isolation Layer (ウィジェット専用の軽量レイアウト)
メインアプリの巨大なJavaScriptペイロード（Auth Provider, Stripe, 重いフォント等）を外部サイトへ持ち込んではならない。
- **実装要件:** `app/embed/layout.tsx` (または `pages/embed/_app.tsx` 相当) というウィジェット専用の隔離レイアウトを新設する。
- **構成:** ユーザーセッション（Supabase Auth）の監視を完全に排除（Anonymous前提）し、Tailwind CSS と最低限の Framer Motion のみをロードする。目標レンダリング速度は100ms以内。

### Decision 2: Edge-Cached Immutable Endpoint (DDoS/破産防衛)
ウィジェットが埋め込まれたサイトがバズった際、Supabaseへの `SELECT` クエリが連打されることを物理的に防ぐ。
- **エンドポイント:** `app/embed/widget/[id]/page.tsx`
- **防御プロトコル:** Next.js の ISR (Incremental Static Regeneration) を適用し、`export const revalidate = 3600;` (1時間キャッシュ) を強制する。
- **セキュリティ:** `[id]` は必ず推測不可能な `public_verify_token` を使用し、内部UUIDによる列挙攻撃を無効化する。

### Decision 3: Secure Framing & Delivery (IframeとCORSの開放)
外部ドメインからの `iframe` 読み込みを許可しつつ、セキュリティを担保する。
- **設定ファイル:** `vercel.json` または `next.config.js` において、`/embed/(.*)` のパスに対してのみ以下のヘッダーを強制出力する。
  - `Content-Security-Policy: frame-ancestors *`
  - `X-Frame-Options: ALLOWALL`

### Decision 4: The Data Contract (C2PAシグナルのインターフェース)
DB内の `certificates.c2pa_manifest` (JSONB) から抽出したトラスト・シグナルを、UIへ注入するための型定義。

```typescript
export interface WidgetC2paSignal {
  hasC2pa: boolean;
  isAiGenerated: boolean;       // AIツール（Midjourney等）の使用履歴
  isHumanEdited: boolean;       // 人間由来のツール（Photoshop等）の使用履歴
  generatorName: string | null; // マニフェストから抽出した主要ツール名
  signatureValid: boolean;      // 署名が有効か
}

export interface WidgetCertificate {
  // ...既存のプロパティ
  c2paSignal?: WidgetC2paSignal; // 新規追加
}
Decision 5: Seamless Parasite Communication (Iframe Resizer)
外部サイトでウィジェットのスクロールバーが発生する醜悪なUXを防ぐため、PostMessageプロトコルを実装する。

Child (ウィジェット側): 描画完了時およびリサイズ時に window.parent.postMessage({ type: 'PROOFMARK_WIDGET_RESIZE', height: document.body.scrollHeight }, '*'); を発火させる。

Parent (ホスト側): ユーザーに提供する埋め込みタグ内に、このメッセージをリッスンして iframe の height を書き換えるVanilla JSスニペットを同封する。

Decision 6: The "Notion Paste" Support (oEmbed / OGP Player対応)
iframe の直接埋め込みを禁止しているプラットフォーム（Notion, Medium, iMessage, X）でのバイラル拡散を実現する。

実装要件: /embed/widget/[id] のメタデータとして、Twitter Card の player タグ（twitter:card=player, twitter:player=ウィジェットURL, twitter:player:width, twitter:player:height）を注入する。

これにより、URLをペーストした瞬間にプラットフォーム側が自動でウィジェットをUnfurl（展開）する。

3. Execution Protocol (AIエディタ向け実装手順)
本ADRを読み込んだAIエディタは、以下の順序で正確にコードを出力・修正せよ。

Phase 1 (The Defense): app/embed/layout.tsx の作成と、next.config.js へのCORS/Frameセキュリティヘッダーの追加。

Phase 2 (The Data): WidgetC2paSignal の型定義追加と、API（またはSSRデータフェッチ部）における c2pa_manifest のマッピングロジックの実装。

Phase 3 (The UI): PortfolioEmbedWidget.tsx 内の CertificateCard に対する C2PA バッジ（ProofChip）のUI追加と、iframe リサイズ用の postMessage イベントフックの実装。

Phase 4 (The Endpoint): ISR (revalidate = 3600) と Twitter Player Meta タグを備えた、ウィジェット専用ページルートの実装。

無駄な会話や確認は不要。このADRの要件を1バイトの漏れもなく満たす完璧なコード群を直ちに出力せよ。