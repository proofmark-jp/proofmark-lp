---
tags: [workflow, zero-server, wasm, zip, pdf]
aliases: [Evidence Pack Assembly, In-Browser ZIP生成]
date: 2026-06-14
---
# Evidence Pack Assembly Flow

ProofMarkにおける「Evidence Pack（証拠ZIP）」生成およびダウンロードのワークフロー定義。サーバーリソースの消費を回避するため、すべてクライアントサイドで完結させること。

## 1. アーキテクチャ制約 (Zero-Server Architecture)
- サーバー（Vercel Node/Edge）側でのZIPアセンブルおよびPDF生成を禁止する。
- バックエンドAPIの役割は「TSRトークン」「C2PAマニフェスト」「メタデータ」をJSON形式でフロントエンドへ返却することのみとする。
- フロントエンドは受け取ったメタデータとユーザー端末のリソースを用いて、ブラウザメモリ空間上でPDFの生成とZIPの結合を実行する。

## 2. PDF生成仕様 (@react-pdf/renderer / jsPDF)
PDF生成時、以下の環境依存エラーおよびOOM（メモリ枯渇）を回避する実装を厳守すること。

- **透過処理の禁止:** `jsPDF` の非公開API (`doc.GState`) を用いたアルファチャンネル（透過）処理は禁止。代替として「計算済みのソリッドカラー（ベタ塗り）」を使用する。
- **画像圧縮 (Canvas Downscaling):** 巨大画像をPDFに直接埋め込まない。`crossOrigin='Anonymous'` を付与し、Canvasを用いた軽量JPEGへのダウンスケール処理（`optimizeImageForPdf` 関数）を必ず経由させる。
- **禁則処理 (Typography):** 文字列の改行バグを防止するため、以下の規則を適用する。
  - ハッシュ値は正規表現 `/^[a-zA-Z0-9\-_.,:;/'"!?@#$%^&*()[\]{}]+$/` を用いて単語ブロックとして保護する。
  - 日本語文字列は1文字ずつ分割してレンダリングする。

## 3. ZIP結合仕様 (JSZip)
- **圧縮モード:** モバイル端末（iPhone等）でのRAMクラッシュを防ぐため、`JSZip` の圧縮モードは `DEFLATE` ではなく、無圧縮結合である `STORE` を強制する。
- **命名規則:** 解凍後のファイル順序をOSレベルで固定するため、ZIP内のファイル名にはプレフィックスとして強制的なナンバリング（例: `01_Cover_Letter.pdf`, `02_Certificate_...`）を付与する。

## 4. エッジケース対応 (In-App Browser)
- X（旧Twitter）やLINEなどのアプリ内ブラウザ（In-App Browser）環境下では、`Blob` オブジェクトのローカル保存（`a.download`）が機能しない。
- User-Agent判定で該当環境を検知した場合、ダウンロード処理を実行せず、Safariまたは外部Chromeブラウザで開くよう誘導するトースト（アラートUI）を表示する。