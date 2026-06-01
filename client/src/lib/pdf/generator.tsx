/**
 * generator.tsx (v2)
 * -----------------------------------------------------------------------------
 * Blob を返すジェネレータ関数群 — 本番メモリ最適化版。
 *
 * v1 からの致命的変更:
 *  - Promise.all を撤廃。完全な「直列生成」に切替。
 *  - 各 PDF 生成の間に setTimeout(50ms) で **メインスレッドを Tick 解放**。
 *    これにより:
 *      ・モバイル端末でのフリーズ防止
 *      ・GC による中間バッファの回収
 *      ・進捗 UI (Framer Motion) のアニメーション継続
 *
 * 公開 API は v1 と完全互換 (シグネチャ不変)。
 * -----------------------------------------------------------------------------
 */

import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { ensurePdfFontsRegistered } from './fonts';
import { CertificateDocument } from './CertificateDocument';
import { CoverLetterDocument } from './CoverLetterDocument';
import type { CertificatePdfInput, CoverLetterPdfInput } from './types';

/** スレッド解放用の短いウェイト (GC を促す副作用も期待) */
function tick(ms = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Certificate_of_Authenticity.pdf を生成し、Blob を返す。
 */
export async function generateCertificatePdfBlob(
  input: CertificatePdfInput,
): Promise<Blob> {
  ensurePdfFontsRegistered();
  const instance = pdf(<CertificateDocument input={input} />);
  return instance.toBlob();
}

/**
 * Cover_Letter.pdf を生成し、Blob を返す。
 */
export async function generateCoverLetterPdfBlob(
  input: CoverLetterPdfInput,
): Promise<Blob> {
  ensurePdfFontsRegistered();
  const instance = pdf(<CoverLetterDocument input={input} />);
  return instance.toBlob();
}

/**
 * Evidence Pack に同梱する PDF 一式 (証明書 + 添え状) を **直列で** 生成。
 *
 * 生成の間に setTimeout(50ms) を挟んで:
 *  - ブラウザのメインスレッドに描画/イベント処理の機会を渡す
 *  - 中間バッファのガベージコレクションを促す
 */
export interface EvidencePackPdfEntry {
  fileName: string;
  blob: Blob;
}

export interface EvidencePackPdfInput {
  certificate: CertificatePdfInput;
  /** 省略時は certificate のメタを流用 */
  coverLetter?: CoverLetterPdfInput;
}

export async function generateEvidencePackPdfs(
  input: EvidencePackPdfInput,
): Promise<{
  certificate: EvidencePackPdfEntry;
  coverLetter: EvidencePackPdfEntry;
}> {
  ensurePdfFontsRegistered();

  // 直列生成 — メインスレッドのフリーズを回避
  const certificateBlob = await generateCertificatePdfBlob(input.certificate);
  await tick(50);

  const coverLetterInput: CoverLetterPdfInput =
    input.coverLetter ?? {
      certificateId: input.certificate.certificateId,
      creatorDisplayName: input.certificate.creatorDisplayName,
      fileName: input.certificate.fileName,
      fileSize: input.certificate.fileSize,
      sha256: input.certificate.sha256,
      timestampJst: input.certificate.timestampJst,
      verificationUrl: input.certificate.verificationUrl,
      tsaProvider: input.certificate.tsaProvider,
    };

  const coverLetterBlob = await generateCoverLetterPdfBlob(coverLetterInput);
  await tick(50);

  return {
    certificate: {
      fileName: 'Certificate_of_Authenticity.pdf',
      blob: certificateBlob,
    },
    coverLetter: {
      fileName: 'Cover_Letter.pdf',
      blob: coverLetterBlob,
    },
  };
}

// --- Node.js Server-side PDF Buffer Generation Additions ---
import { renderToBuffer, Font } from '@react-pdf/renderer';

let serverFontsRegistered = false;
export function registerServerFonts(origin: string): void {
  if (serverFontsRegistered) return;
  try {
    Font.register({
      family: 'NotoSansJP',
      fonts: [
        { src: `${origin}/fonts/NotoSansJP-Regular.ttf`, fontWeight: 400 },
        { src: `${origin}/fonts/NotoSansJP-Medium.ttf`, fontWeight: 500 },
        { src: `${origin}/fonts/NotoSansJP-Bold.ttf`, fontWeight: 700 },
      ],
    });

    Font.register({
      family: 'JetBrainsMono',
      fonts: [
        { src: `${origin}/fonts/JetBrainsMono-Regular.ttf`, fontWeight: 400 },
        { src: `${origin}/fonts/JetBrainsMono-Bold.ttf`, fontWeight: 700 },
      ],
    });

    Font.registerHyphenationCallback((word) => {
      if (/^[a-zA-Z0-9\-_.,:;/'"!?@#$%^&*()[\]{}]+$/.test(word)) {
        return [word];
      }
      return Array.from(word);
    });
    serverFontsRegistered = true;
  } catch (e) {
    console.error('[React-PDF Server Fonts] Registration failed:', e);
  }
}

/**
 * Generate Certificate_of_Authenticity.pdf Buffer on the server side dynamically.
 */
export async function generateCertificatePdfBuffer(
  input: CertificatePdfInput,
  origin: string,
): Promise<Buffer> {
  registerServerFonts(origin);
  return renderToBuffer(<CertificateDocument input={input} />);
}

/**
 * Generate Cover_Letter.pdf Buffer on the server side dynamically.
 */
export async function generateCoverLetterPdfBuffer(
  input: CoverLetterPdfInput,
  origin: string,
): Promise<Buffer> {
  registerServerFonts(origin);
  return renderToBuffer(<CoverLetterDocument input={input} />);
}
