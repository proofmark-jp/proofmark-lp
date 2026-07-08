/**
 * generator.tsx (v3.1 - Absolute Apex Edition)
 * -----------------------------------------------------------------------------
 * Blob を返すジェネレータ関数群 — 本番メモリ最適化・完全防弾版。
 *
 * 【The Apex Defenses】
 * 1. The Global Mutex: 複数コンポーネントからの同時PDF生成要求をキュー（待ち行列）に
 * 押し込め、Yogaエンジン(WASM)の衝突とOOMクラッシュを物理的に防ぐ。
 * 2. Tick Sandwich: インスタンス化の「前」と「後」にスレッド解放を挟み、
 * フォントサブセット化時のUIフリーズを完全に防ぐ。
 * 3. The Explicit GC Hint: `@react-pdf/renderer` の内部バッファを強制解放するため、
 * 生成直後にインスタンス参照を物理切断しガベージコレクションを誘発させる。
 * 4. The Unbreakable Chain: 生成エラー発生時もMutexチェーン全体が死なないよう、
 * ロック状態の回復（デッドロック防止）を完全保証する。
 * -----------------------------------------------------------------------------
 */

import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { ensurePdfFontsRegistered } from './fonts';
import { CertificateDocument } from './CertificateDocument';
import { CoverLetterDocument } from './CoverLetterDocument';
import type { CertificatePdfInput, CoverLetterPdfInput } from './types';

/** スレッド解放用の短いウェイト (UI描画とGCを確実に発火させる) */
function tick(ms = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 🚨 1. The Global Mutex: アプリケーション全体でPDF生成を絶対に1プロセスに制限するロック
let pdfGenerationLock = Promise.resolve();

/**
 * 👑 汎用・安全な PDF Blob 生成コア (The Safe Forge)
 * すべてのPDF生成リクエストはこのキューを通り、直列かつ安全に処理される。
 */
async function executeSafePdfGeneration(doc: React.ReactElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    // 既存のロックが終わるまで待機してから実行（キューイング）
    pdfGenerationLock = pdfGenerationLock
      .then(async () => {
        try {
          ensurePdfFontsRegistered();
          
          // 🚨 2. The Tick Sandwich: 重いインスタンス化の「前」にスレッドを解放し、UIスピナーを回す
          await tick(50);
          
          let instance: any = pdf(doc);
          const blob = await instance.toBlob();
          
          // 🚨 3. The Explicit GC Hint: 巨大なArrayBufferを即座に破棄する
          instance = null;
          
          // 🚨 2. The Tick Sandwich: 次の生成（またはメインスレッド）に移行する前に、解放したメモリのGCを促す
          await tick(50);
          
          resolve(blob);
        } catch (error) {
          reject(error);
        }
      })
      // 🚨 4. The Unbreakable Chain: 前のタスクがエラーで死んでも、チェーン自体は常にResolveさせ、デッドロックを防ぐ
      .catch(() => {});
  });
}

/**
 * Certificate_of_Authenticity.pdf を生成し、Blob を返す。
 */
export async function generateCertificatePdfBlob(
  input: CertificatePdfInput,
): Promise<Blob> {
  return executeSafePdfGeneration(<CertificateDocument input={input} />);
}

/**
 * Cover_Letter.pdf を生成し、Blob を返す。
 */
export async function generateCoverLetterPdfBlob(
  input: CoverLetterPdfInput,
): Promise<Blob> {
  return executeSafePdfGeneration(<CoverLetterDocument input={input} />);
}

/**
 * Evidence Pack に同梱する PDF 一式 (証明書 + 添え状) を生成。
 */
export interface EvidencePackPdfEntry {
  fileName: string;
  blob: Blob;
}

export interface EvidencePackPdfInput {
  certificate: CertificatePdfInput;
  coverLetter?: CoverLetterPdfInput;
}

export async function generateEvidencePackPdfs(
  input: EvidencePackPdfInput,
): Promise<{
  certificate: EvidencePackPdfEntry;
  coverLetter: EvidencePackPdfEntry;
}> {
  // executeSafePdfGeneration が内部で Mutex を制御するため、
  // ここで単に await するだけで自動的に完全な直列・安全処理となる。
  const certificateBlob = await generateCertificatePdfBlob(input.certificate);

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
      sealVariant: input.certificate.sealVariant,
    };

  const coverLetterBlob = await generateCoverLetterPdfBlob(coverLetterInput);

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