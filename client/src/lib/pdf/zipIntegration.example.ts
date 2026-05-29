/**
 * zipIntegration.example.ts (v2)
 * -----------------------------------------------------------------------------
 * EvidencePackExplorer.tsx 側の ZIP ビルダーへ組み込む際の参考実装。
 *
 * v2 の方針:
 *  - PDF 生成は generateEvidencePackPdfs() が内部で直列化 + Tick 解放するため、
 *    呼び出し側は単純な await で OK。
 *  - 進捗 UI と同期させたい場合は、各 step で onProgress コールバックを呼ぶ。
 * -----------------------------------------------------------------------------
 */

import JSZip from 'jszip';
import {
  ensurePdfFontsRegistered,
  generateEvidencePackPdfs,
  type CertificatePdfInput,
} from './index';

export interface BuildEvidenceZipInput {
  certificate: CertificatePdfInput;
  /** RFC 3161 タイムスタンプレスポンスの生バイト列 (.tsr) */
  tsrBytes: Uint8Array;
  /** Tsq, chain.json, verify スクリプト等 */
  extraEntries?: Array<{ name: string; data: Uint8Array | string | Blob }>;
  /** 進捗通知 (0.0 - 1.0) */
  onProgress?: (step: string, ratio: number) => void;
}

/**
 * Evidence Pack ZIP を構築して Blob を返す。
 * すべての処理がブラウザ完結 (Zero-Knowledge 設計)。
 */
export async function buildEvidenceZip(
  input: BuildEvidenceZipInput,
): Promise<Blob> {
  // 1) フォント warm up
  ensurePdfFontsRegistered();
  input.onProgress?.('Drafting Certificate', 0.05);

  const zip = new JSZip();

  // 2) PDF 2 種を直列生成 (内部で 50ms Tick 解放を挟む)
  const { certificate, coverLetter } = await generateEvidencePackPdfs({
    certificate: input.certificate,
  });
  input.onProgress?.('Composing Cover Letter', 0.55);

  zip.file(certificate.fileName, certificate.blob);
  zip.file(coverLetter.fileName, coverLetter.blob);

  // 3) RFC 3161 TSR 本体
  zip.file('TIMESTAMP.tsr', input.tsrBytes);

  // 4) 検証スクリプト等
  if (input.extraEntries) {
    for (const entry of input.extraEntries) {
      zip.file(entry.name, entry.data);
    }
  }
  input.onProgress?.('Sealing ZIP', 0.85);

  // 5) ZIP を Blob として出力
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  input.onProgress?.('Done', 1.0);
  return blob;
}
