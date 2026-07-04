/**
 * index.ts (v2)
 * -----------------------------------------------------------------------------
 * Vector PDF Engine の公開エントリポイント。
 *
 * v2 で本番安全化 (textPath 撤去 / GeometricBackdrop 削除 / 直列生成 / etc.).
 * 公開 API は v1 と完全互換。既存呼び出しコードはそのまま動作する。
 * -----------------------------------------------------------------------------
 */

export { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from './fonts';
export {
  PDF_COLORS,
  PDF_LAYOUT,
  PDF_LEADING,
  PDF_TRACKING,
} from './tokens';

export { CertificateDocument } from './CertificateDocument';
export { CoverLetterDocument } from './CoverLetterDocument';

export {
  ProofMarkLogo,
  CornerOrnament,
  SealedStamp,
  DividerRule,
} from './Decorations';

export {
  generateCertificatePdfBlob,
  generateCoverLetterPdfBlob,
  generateEvidencePackPdfs,
} from './generator';

export type {
  CertificatePdfInput,
  CoverLetterPdfInput,
} from './types';
export type {
  EvidencePackPdfInput,
  EvidencePackPdfEntry,
} from './generator';
