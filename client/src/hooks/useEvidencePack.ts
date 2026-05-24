/**
 * useEvidencePack.ts
 * ─────────────────────────────────────────────────────────────
 *  ZIP 生成オーケストレーション。
 *
 *  Flow:
 *    idle
 *      → generating_certificate (15→50)
 *      → generating_cover_letter (50→75)
 *      → packing_zip (75→95)
 *      → success (100)   /   error (0)
 *
 *  UI を絶対にブロックしないために、各ステップの間に
 *  await yieldToMain() を挟んで microtask に制御を返している。
 * ─────────────────────────────────────────────────────────────
 */

import { useCallback, useRef, useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

import {
  generateCertificatePDF,
  type PdfGeneratorInput,
} from '@/lib/pdfGenerator';
import { generateCoverLetterPDF } from '@/lib/coverLetterPdfGenerator';
import {
  generateHowToVerify,
  generateVerifyPy,
  generateVerifySh,
} from '@/lib/verifyScripts';

/* ─────────────────────────────────────────────
 *  Public types
 * ───────────────────────────────────────────── */

export interface SpotIssueApiResponse {
  certificate_id: string;
  original_file_name: string;
  original_file_size: number;
  sha256_hash: string;
  timestamp_jst: string;
  timestamp_iso: string;
  tsr_token_base64: string;
  verification_url: string;
  proof_mode: 'shareable' | 'private';
  thumbnail_data_url?: string;
  creator_display_name?: string;
  legal_name?: string;
  default_persona?: 'creator' | 'legal';
}

export type EvidencePackStatus =
  | 'idle'
  | 'generating_certificate'
  | 'generating_cover_letter'
  | 'packing_zip'
  | 'success'
  | 'error';

export interface EvidencePackState {
  status: EvidencePackStatus;
  progress: number;
  statusText: string;
  errorMessage?: string;
}

interface LastResult {
  blob: Blob;
  filename: string;
}

const initialState: EvidencePackState = {
  status: 'idle',
  progress: 0,
  statusText: '',
};

/* ─────────────────────────────────────────────
 *  Hook
 * ───────────────────────────────────────────── */

export function useEvidencePack() {
  const [state, setState] = useState<EvidencePackState>(initialState);
  const lastResult = useRef<LastResult | null>(null);

  const reset = useCallback(() => {
    lastResult.current = null;
    setState(initialState);
  }, []);

  const redownload = useCallback(() => {
    if (!lastResult.current) return;
    saveAs(lastResult.current.blob, lastResult.current.filename);
  }, []);

  const generatePack = useCallback(
    async (
      api: SpotIssueApiResponse,
      thumbnailDataUrl?: string,
    ): Promise<void> => {
      try {
        /* ── Step 1: Certificate PDF ──────────────────── */
        setState({
          status: 'generating_certificate',
          progress: 15,
          statusText: '証明書PDFを生成しています...',
        });
        await yieldToMain();

        const certInput: PdfGeneratorInput = {
          certificateId: api.certificate_id,
          originalFileName: api.original_file_name,
          originalFileSize: api.original_file_size,
          sha256Hash: api.sha256_hash,
          timestampJst: api.timestamp_jst,
          timestampIso: api.timestamp_iso,
          verificationUrl: api.verification_url,
          proofMode: api.proof_mode,
          thumbnailDataUrl: thumbnailDataUrl ?? api.thumbnail_data_url,
          creatorDisplayName: api.creator_display_name,
        };
        const certPdfBlob = await generateCertificatePDF(certInput);

        setState((s) => ({ ...s, progress: 50 }));
        await yieldToMain();

        /* ── Step 2: Cover Letter PDF ────────────────── */
        setState({
          status: 'generating_cover_letter',
          progress: 55,
          statusText: 'クライアント向けカバーレターを作成しています...',
        });
        await yieldToMain();

        const coverLetterBlob = await generateCoverLetterPDF({
          certificateId: api.certificate_id,
          timestampJst: api.timestamp_jst,
          verificationUrl: api.verification_url,
          creatorDisplayName:
            api.creator_display_name?.trim() || 'ProofMark Verified Creator',
        });

        setState((s) => ({ ...s, progress: 75 }));
        await yieldToMain();

        /* ── Step 3: ZIP packing ─────────────────────── */
        setState({
          status: 'packing_zip',
          progress: 80,
          statusText: 'Evidence Pack を暗号学的に封印しています...',
        });
        await yieldToMain();

        // .tsr バイナリ復元（exact: Base64 → Uint8Array）
        const tsrBinary = base64ToUint8Array(api.tsr_token_base64);

        const verifySh = generateVerifySh(api.sha256_hash, api.original_file_name);
        const verifyPy = generateVerifyPy(api.sha256_hash, api.original_file_name);
        const howTo = generateHowToVerify(
          api.verification_url,
          api.certificate_id,
        );

        const shortId =
          (api.certificate_id.split('-')[0] || api.certificate_id.slice(0, 8))
            .toUpperCase();
        const folderName = `ProofMark_Evidence_Pack_${shortId}`;

        const zip = new JSZip();
        const folder = zip.folder(folderName);
        if (!folder) throw new Error('Failed to create archive folder');

        // ファイルの mtime を timestamp_iso に固定（再現性）
        const mtime = new Date(api.timestamp_iso);
        const safeMtime = Number.isNaN(mtime.getTime()) ? new Date() : mtime;

        // 🚨 読ませる順番をファイル名で強制（アンボクシングUXのハック）
        folder.file('01_Cover_Letter.pdf', coverLetterBlob, { date: safeMtime });
        folder.file('02_Certificate_of_Authenticity.pdf', certPdfBlob, { date: safeMtime });
        folder.file('03_HOW_TO_VERIFY.txt', howTo, { date: safeMtime });
        folder.file('04_TIMESTAMP.tsr', tsrBinary, { binary: true, date: safeMtime });
        folder.file('05_verify.sh', verifySh, { date: safeMtime, unixPermissions: 0o755 });
        folder.file('06_verify.py', verifyPy, { date: safeMtime, unixPermissions: 0o755 });

        const zipBlob = await zip.generateAsync(
          {
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 },
            mimeType: 'application/zip',
          },
          (meta) => {
            // 80→95 の範囲で連続更新
            const progress = 80 + Math.round((meta.percent / 100) * 15);
            setState((s) =>
              s.status === 'packing_zip' ? { ...s, progress } : s,
            );
          },
        );

        setState((s) => ({ ...s, progress: 95 }));
        await yieldToMain();

        /* ── Step 4: ダウンロード発火 ─────────────── */
        const filename = `${folderName}.zip`;
        lastResult.current = { blob: zipBlob, filename };
        saveAs(zipBlob, filename);

        setState({
          status: 'success',
          progress: 100,
          statusText: 'Evidence Pack が完成しました',
        });
      } catch (err) {
        console.error('[useEvidencePack] failed', err);
        setState({
          status: 'error',
          progress: 0,
          statusText: '生成中にエラーが発生しました',
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [],
  );

  return { state, generatePack, reset, redownload };
}

/* ─────────────────────────────────────────────
 *  Utils
 * ───────────────────────────────────────────── */

function base64ToUint8Array(b64: string): Uint8Array {
  // 念のため URL-safe / 改行混入を浄化
  const clean = b64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = clean + '='.repeat((4 - (clean.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function yieldToMain(): Promise<void> {
  // requestAnimationFrame 相当の小休止。UI 描画を確実に挟む。
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      window.requestAnimationFrame(() => resolve());
    } else {
      setTimeout(() => resolve(), 0);
    }
  });
}
