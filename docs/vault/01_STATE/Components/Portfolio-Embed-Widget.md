---
tags: [component, widget, iframe, plg, cross-origin]
aliases: [PortfolioEmbedWidget, 埋め込みウィジェット]
date: 2026-06-14
---
# Portfolio Embed Widget

外部サイト（WordPress, Notion, 独自ドメイン等）への iframe 埋め込み用コンポーネント。親サイトのSEOやUXを破壊しないための実装要件。

## 1. Cross-Origin Height Sync (高さの動的同期)
iframe特有のスクロールバー発生を防ぐため、以下のロジックを実装・維持すること。
- ウィジェット内部で `ResizeObserver` をマウントし、コンテンツの高さ（`scrollHeight` 等）を監視する。
- 高さが1pxでも変化した際は、`window.parent.postMessage` を使用して親サイトへ新しい高さを送信し、iframeの動的リサイズを要求する。

## 2. パフォーマンスと LCP (Core Web Vitals) 最適化
親サイトの読み込み速度を劣化させないための画像最適化要件。
- **ファーストビュー:** 上部（`index < 2`等）の画像には `fetchPriority="high"` と `loading="eager"` を適用する。
- **遅延読み込み:** それ以下の画像には `loading="lazy"` および `decoding="async"` を強制し、ネットワーク帯域の消費を抑える。

## 3. Visual Hash Fingerprint (暗号指紋の描画)
- 秘匿設定（NDA / Confidential）された作品に対し、静的なプレースホルダー画像を使用してはならない。
- 対象となる証明書の `sha256` ハッシュ値をシードとして用い、決定論的（Deterministic）に色相（`hsl`）や模様のパラメーターを算出する。
- 算出されたパラメーターをインラインCSSとして適用し、ハッシュごとに固有のジェネラティブアートを描画する（`deriveGenerativeArt` 関数等を使用）。

## 4. UI/DOM 構造の制約
- **Z-Indexと合成:** モバイル端末のレンダリング負荷を下げるため、`mix-blend-mode` の使用は避け、`opacity` コンポジットとフラットなCSSでの描画を優先する。
- **リンクの空振り防止:** ウィジェット内の `VerifiedBadge` がホバー等のポインターイベントを吸収し、リンク（`<a>`タグ）のクリック判定を阻害するのを防ぐため、必ず `<a>` タグで `relative` 指定されたコンテナ全体を包み込むDOM構造を維持すること。