/**
 * types.ts (v2)
 * -----------------------------------------------------------------------------
 * Evidence Pack PDF 生成への入力契約。
 *
 * v1 との互換性を保ちつつ、optional フィールドのみ追加。
 * 既存呼び出しコードはそのまま動作する。
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
  /** シール色の選択 (デフォルト teal) */
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
}
