/**
 * EvidencePackDownloadButton.tsx — Zero-Cost Architecture (v3)
 * -------------------------------------------------------------------
 * ブラウザ側で React-PDF を使い 2 つの PDF を Blob 生成し、
 * Base64 エンコードして /api/generate-evidence-pack に POST。
 * サーバー側はそれらを ZIP に同梱するだけ。
 * @react-pdf/renderer はサーバーには一切読み込まれない。
 * -------------------------------------------------------------------
 */

import { useCallback, useRef, useState } from 'react';
import { Download, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { generateCertificatePdfBlob, generateCoverLetterPdfBlob } from '@/lib/pdf/generator';
import type { CertificatePdfInput, CoverLetterPdfInput } from '@/lib/pdf/types';

interface Props {
    certId: string;
    /** PDF 生成に必要なメタデータ。渡されない場合は API から取得する */
    pdfMeta?: {
        certificateId: string;
        creatorDisplayName: string;
        fileName: string;
        fileSize: string;
        sha256: string;
        timestampJst: string;
        verificationUrl: string;
        sealVariant?: 'teal' | 'gold';
        tsaProvider?: string;
        // Cover Letter 専用
        fileTree?: ReadonlyArray<{ name: string; size: string; description?: string }>;
    };
    variant?: 'primary' | 'ghost';
    label?: string;
}

/** Blob → Base64 文字列 (データ URL のプレフィックスを除去) */
async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // "data:application/pdf;base64,XXXX" → "XXXX"
            const idx = result.indexOf(',');
            resolve(idx >= 0 ? result.slice(idx + 1) : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/** 隠し form を自動送信して ZIP をダウンロードさせる */
function submitDownloadForm(params: {
    certId: string;
    accessToken: string;
    coverLetterB64: string;
    certificateB64: string;
    filename: string;
}) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/api/generate-evidence-pack';
    // 別タブを使わず同タブでダウンロードさせる
    form.style.display = 'none';

    const addField = (name: string, value: string) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
    };

    addField('cert', params.certId);
    addField('access_token', params.accessToken);
    addField('cover_letter_b64', params.coverLetterB64);
    addField('certificate_b64', params.certificateB64);

    document.body.appendChild(form);
    form.submit();
    // DOM クリーンアップ（非同期）
    setTimeout(() => form.remove(), 5000);
}

export default function EvidencePackDownloadButton({
    certId,
    pdfMeta,
    variant = 'primary',
    label = 'Evidence Pack をダウンロード',
}: Props): JSX.Element {
    const [phase, setPhase] = useState<'idle' | 'generating' | 'uploading'>('idle');
    const isProcessing = phase !== 'idle';

    const handleDownload = useCallback(async () => {
        if (isProcessing) return;

        const toastId = toast.loading('PDF を生成しています…', { id: `evidence-${certId}` });
        setPhase('generating');

        try {
            // ── 1. セッション確認 ──────────────────────────────────
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('ログインセッションが切れました。再ログインしてください。');

            // ── 2. PDF メタ取得 (pdfMeta が渡されていない場合はフォールバック) ──
            let certInput: CertificatePdfInput;
            let coverInput: CoverLetterPdfInput;

            if (pdfMeta) {
                certInput = {
                    certificateId: pdfMeta.certificateId,
                    creatorDisplayName: pdfMeta.creatorDisplayName,
                    fileName: pdfMeta.fileName,
                    fileSize: pdfMeta.fileSize,
                    sha256: pdfMeta.sha256,
                    timestampJst: pdfMeta.timestampJst,
                    verificationUrl: pdfMeta.verificationUrl,
                    sealVariant: pdfMeta.sealVariant,
                    tsaProvider: pdfMeta.tsaProvider,
                };
                coverInput = {
                    ...certInput,
                    fileTree: pdfMeta.fileTree,
                };
            } else {
                // フォールバック: API から最低限のメタを取得
                const metaRes = await fetch(`/api/generate-evidence-pack?cert=${certId}&meta_only=1`, {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });
                if (!metaRes.ok) throw new Error('証明書メタデータの取得に失敗しました');
                const meta = await metaRes.json();
                certInput = {
                    certificateId: meta.certificate_id ?? certId,
                    creatorDisplayName: meta.creator_display_name ?? 'ProofMark Creator',
                    fileName: meta.file_name ?? 'asset.bin',
                    fileSize: meta.file_size ?? '—',
                    sha256: meta.sha256 ?? '',
                    timestampJst: meta.timestamp_jst ?? '—',
                    verificationUrl: meta.verify_url ?? `https://proofmark.jp/cert/${certId}`,
                    sealVariant: meta.seal_variant ?? 'teal',
                    tsaProvider: meta.tsa_provider ?? 'FreeTSA',
                };
                coverInput = {
                    ...certInput,
                    fileTree: meta.file_tree,
                };
            }

            // ── 3. ブラウザ側で PDF を直列生成 ─────────────────────
            toast.loading('証明書 PDF を生成しています… (1/2)', { id: toastId });
            const certBlob = await generateCertificatePdfBlob(certInput);

            toast.loading('カバーレター PDF を生成しています… (2/2)', { id: toastId });
            const coverBlob = await generateCoverLetterPdfBlob(coverInput);

            // ── 4. Base64 変換 ────────────────────────────────────
            setPhase('uploading');
            toast.loading('ZIP を生成してダウンロードしています…', { id: toastId });

            const [certificateB64, coverLetterB64] = await Promise.all([
                blobToBase64(certBlob),
                blobToBase64(coverBlob),
            ]);

            // ── 5. ZIP ダウンロード (fetch POST → Blob) ─────────────
            const res = await fetch('/api/generate-evidence-pack', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    cert: certId,
                    certificate_b64: certificateB64,
                    cover_letter_b64: coverLetterB64,
                }),
                credentials: 'omit',
            });

            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error ?? `サーバーエラーが発生しました (HTTP ${res.status})`);
            }

            // ── 6. ファイル名抽出 & Blob ダウンロード ─────────────
            const cd = res.headers.get('content-disposition') || '';
            const m5987 = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cd);
            const mPlain = /filename\s*=\s*"?([^";]+)"?/i.exec(cd);
            const filename = m5987
                ? decodeURIComponent(m5987[1])
                : mPlain
                    ? mPlain[1]
                    : `proofmark-evidence-${certId.slice(0, 8)}.zip`;

            const blob = await res.blob();
            const href = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = href;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(href);

            toast.success('Evidence Pack のダウンロードが完了しました', { id: toastId });
        } catch (e) {
            toast.error('ダウンロードに失敗しました', {
                id: toastId,
                description: e instanceof Error ? e.message : 'ネットワーク接続を確認してください。',
            });
        } finally {
            setPhase('idle');
        }
    }, [certId, pdfMeta, isProcessing]);

    const phaseLabel =
        phase === 'generating' ? 'PDF を生成中…' :
        phase === 'uploading'  ? 'ZIP を生成中…' :
        label;

    const baseBtn = variant === 'primary'
        ? 'bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] text-white shadow-[0_12px_28px_rgba(108,62,244,0.4)]'
        : 'border border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08]';

    return (
        <button
            type="button"
            onClick={handleDownload}
            disabled={isProcessing}
            aria-busy={isProcessing}
            className={[
                'group flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-3.5',
                'font-bold transition-all active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C3EF4]',
                baseBtn,
                isProcessing ? 'opacity-70 cursor-not-allowed' : '',
            ].join(' ')}
        >
            <span className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/14 text-white">
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                </span>
                <span className="flex flex-col items-start leading-tight">
                    <span className="text-[15px]">
                        {phaseLabel}
                    </span>
                    <span className="text-[11px] font-medium text-white/72">
                        RFC3161 · SHA-256 · 同梱証明書 PDF
                    </span>
                </span>
            </span>
            <ShieldCheck className={`h-5 w-5 text-white/82 transition-transform ${isProcessing ? '' : 'group-hover:scale-110'}`} />
        </button>
    );
}