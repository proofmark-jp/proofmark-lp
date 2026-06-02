/**
 * EvidencePackDownloadButton.tsx — Zero-Cost Architecture (v5)
 * -------------------------------------------------------------------
 * ブラウザ側で React-PDF を使い 2 つの PDF を Blob 生成し、
 * Base64 エンコードして /api/generate-evidence-pack に POST。
 * サーバー側はそれらを ZIP に同梱するだけ。
 * @react-pdf/renderer はサーバーには一切読み込まれない。
 * -------------------------------------------------------------------
 */

import { useCallback, useState } from 'react';
import { Download, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { generateCertificatePdfBlob, generateCoverLetterPdfBlob } from '@/lib/pdf/generator';
import type { CertificatePdfInput, CoverLetterPdfInput } from '@/lib/pdf/types';

interface Props {
    certId: string;
    /** PDF 生成に必要なメタデータ。渡されない場合は直接 Supabase からフェッチする */
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
    /** 古いコードとの互換性のための certificates テーブルレコードオブジェクト */
    apiData?: any;
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

export default function EvidencePackDownloadButton({
    certId,
    pdfMeta,
    apiData,
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

            // ── 2. PDF メタ取得 (pdfMeta または apiData がない場合は直接 Supabase からフェッチ) ──
            let certInput: CertificatePdfInput;
            let coverInput: CoverLetterPdfInput;

            const inputData = pdfMeta || apiData;

            if (inputData) {
                const certIdVal = inputData.certificateId ?? inputData.id ?? certId;
                const fileNameVal = inputData.fileName ?? inputData.original_filename ?? inputData.file_name ?? 'asset.bin';
                const sha256Val = inputData.sha256 ?? '';
                const createdTime = inputData.created_at ?? '';
                const displayTime = inputData.certified_at ?? inputData.proven_at ?? createdTime;
                
                let humanSize = '—';
                const sizeBytes = inputData.file_size ?? inputData.size;
                if (typeof sizeBytes === 'number') {
                    const k = 1024;
                    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                    const i = Math.floor(Math.log(sizeBytes) / Math.log(k));
                    humanSize = parseFloat((sizeBytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
                } else if (typeof sizeBytes === 'string') {
                    humanSize = sizeBytes;
                }

                let creatorName = inputData.creatorDisplayName ?? 'ProofMark Creator';
                if (!inputData.creatorDisplayName && inputData.creator_display_name) {
                    creatorName = inputData.creator_display_name;
                }

                certInput = {
                    certificateId: certIdVal,
                    creatorDisplayName: creatorName,
                    fileName: fileNameVal,
                    fileSize: humanSize,
                    sha256: sha256Val,
                    timestampJst: displayTime ? new Date(displayTime).toLocaleString('ja-JP') + ' JST' : '—',
                    verificationUrl: inputData.verificationUrl ?? `https://proofmark.jp/cert/${certIdVal}`,
                    sealVariant: inputData.sealVariant ?? (inputData.proof_mode === 'private' ? 'teal' : 'gold'),
                    tsaProvider: inputData.tsaProvider ?? inputData.tsa_provider ?? 'FreeTSA',
                };
                coverInput = {
                    ...certInput,
                    fileTree: inputData.fileTree ?? [
                        { name: 'Cover_Letter.pdf', size: '—', description: 'This document (ProofMark Client Hand-off)' },
                        { name: 'Certificate_of_Authenticity.pdf', size: '—', description: 'Cryptographic Certificate of Authenticity' },
                        { name: 'hash.txt', size: '—', description: 'Target file SHA-256 hash value' },
                        { name: 'timestamp.tsr', size: '—', description: 'RFC3161 tamper-proof timestamp token' },
                        { name: 'verify.sh', size: '—', description: 'Shell verification script (OpenSSL)' },
                        { name: 'verify.py', size: '—', description: 'Python verification script (OpenSSL)' },
                        { name: 'metadata.json', size: '—', description: 'Machine-readable evidence metadata' },
                    ],
                };
            } else {
                // フォールバック: Supabase から直接メタデータを取得 (APIの meta_only=1 を完全排除)
                const { data: cert, error: certErr } = await supabase
                    .from('certificates')
                    .select('id, user_id, title, sha256, proof_mode, file_name, original_filename, created_at, certified_at, proven_at, tsa_provider, file_size')
                    .eq('id', certId)
                    .maybeSingle();

                if (certErr || !cert) throw new Error('証明書データの取得に失敗しました');

                let creatorDisplayName = 'ProofMark Creator';
                if (cert.user_id) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('display_name, username')
                        .eq('id', cert.user_id)
                        .maybeSingle();
                    if (profile) {
                        creatorDisplayName = profile.display_name ?? profile.username ?? 'ProofMark Creator';
                    }
                }

                const displayTime = cert.certified_at ?? cert.proven_at ?? cert.created_at;
                let humanSize = '—';
                if (cert.file_size) {
                    const k = 1024;
                    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                    const i = Math.floor(Math.log(cert.file_size) / Math.log(k));
                    humanSize = parseFloat((cert.file_size / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
                }

                const rawName = (cert.original_filename && cert.original_filename !== 'unknown_file')
                    ? cert.original_filename
                    : (cert.file_name || 'asset.bin');

                certInput = {
                    certificateId: cert.id,
                    creatorDisplayName,
                    fileName: rawName,
                    fileSize: humanSize,
                    sha256: cert.sha256 ?? '',
                    timestampJst: displayTime ? new Date(displayTime).toLocaleString('ja-JP') + ' JST' : '—',
                    verificationUrl: `https://proofmark.jp/cert/${cert.id}`,
                    sealVariant: cert.proof_mode === 'private' ? 'teal' : 'gold',
                    tsaProvider: cert.tsa_provider ?? 'FreeTSA',
                };
                coverInput = {
                    ...certInput,
                    fileTree: [
                        { name: 'Cover_Letter.pdf', size: '—', description: 'This document (ProofMark Client Hand-off)' },
                        { name: 'Certificate_of_Authenticity.pdf', size: '—', description: 'Cryptographic Certificate of Authenticity' },
                        { name: 'hash.txt', size: '—', description: 'Target file SHA-256 hash value' },
                        { name: 'timestamp.tsr', size: '—', description: 'RFC3161 tamper-proof timestamp token' },
                        { name: 'verify.sh', size: '—', description: 'Shell verification script (OpenSSL)' },
                        { name: 'verify.py', size: '—', description: 'Python verification script (OpenSSL)' },
                        { name: 'metadata.json', size: '—', description: 'Machine-readable evidence metadata' },
                    ],
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

            // 1. `if (!res.ok)` の場合のみ `await res.json()` でエラーメッセージを抽出しスローする
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error ?? `サーバーエラーが発生しました (HTTP ${res.status})`);
            }

            // 2. 成功時は 必ず `const blob = await res.blob();` としてバイナリを受け取る
            const blob = await res.blob();

            // ── 6. ファイル名抽出 & Blob ダウンロード ─────────────
            const cd = res.headers.get('content-disposition') || '';
            const m5987 = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cd);
            const mPlain = /filename\s*=\s*"?([^";]+)"?/i.exec(cd);
            const filename = m5987
                ? decodeURIComponent(m5987[1])
                : mPlain
                    ? mPlain[1]
                    : `proofmark-evidence-${certId.slice(0, 8)}.zip`;

            // 3. `URL.createObjectURL(blob)` を使用して `<a>` タグを生成し、ネイティブのファイルダウンロードを発火させる
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
    }, [certId, pdfMeta, apiData, isProcessing]);

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