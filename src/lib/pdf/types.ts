/**
 * types.ts (v5 — Final Commit)
 * -----------------------------------------------------------------------------
 * Evidence Pack PDF 生成への入力契約。
 *
 * v4 → v5 の変更点:
 *  - `CoverLetterPdfInput` に `qrCodeDataUrl?: string` を追加。
 *    HOW TO VERIFY セクションで URL と並べて QR コードをレンダリングするため。
 *    フロントエンドで生成した data URL (例: `data:image/png;base64,...`) を
 *    そのまま @react-pdf の <Image src={...} /> に渡せる構造。
 *  - 既存の `sealVariant` 等の後方互換フィールドは保持。
 *    本ドキュメント本体では SealedStamp が完全削除されたため未使用となるが、
 *    型としては残し、呼び出し元のリグレッションを防止する。
 * -----------------------------------------------------------------------------
 */

/** 証明書 PDF 生成の入力 */
export interface CertificatePdfInput {
  /** ProofMark 証明書 ID (例: A3F7-9E28-4CB1) */
  certificateId: string;
  /** クリエイターの表示名 */
  creatorDisplayName: string;
  /** 対象ファイル名 */
  fileName: string;
  /** ファイルサイズ (人間可読: "4.2 MB" / "184 KB" など) */
  fileSize: string;
  /** SHA-256 ハッシュ (16進64文字) */
  sha256: string;
  /** RFC3161 タイムスタンプ (JST 表記済み文字列) */
  timestampJst: string;
  /** 検証 URL */
  verificationUrl: string;
  /**
   * シール色の選択 (後方互換のため型としては残す)
   * @deprecated v5 以降、SealedStamp は廃止された。本フィールドは無視される。
   */
  sealVariant?: 'teal' | 'gold';
  /** TSA 提供者名 (例: 'FreeTSA'). フッタに掲載される. */
  tsaProvider?: string;
}

/** Cover Letter PDF 生成の入力 */
export interface CoverLetterPdfInput {
  certificateId: string;
  creatorDisplayName: string;
  fileName: string;
  fileSize: string;
  sha256: string;
  timestampJst: string;
  verificationUrl: string;
  /** TSA 提供者名 (verifyCard 内に出す). */
  tsaProvider?: string;
  /** 同梱ファイルツリーの簡易表示 */
  fileTree?: ReadonlyArray<{
    name: string;
    size: string;
    description?: string;
  }>;
  /**
   * 検証 URL の QR コード画像 (data URL 推奨)。
   * 例: `data:image/png;base64,iVBORw0KGgo...`
   *
   * フロントエンド側で `qrcode` 等のライブラリで生成し、本フィールドに
   * 渡すことで HOW TO VERIFY セクション右側にレンダリングされる。
   * undefined の場合は QR コード枠を非表示にし、URL のみを表示する。
   */
  qrCodeDataUrl?: string;
}
