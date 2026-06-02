/**
 * EvidencePackDownloadButton.tsx — In-Browser ZIP Assembly Architecture (v5)
 * ─────────────────────────────────────────────────────────────────────────────
 * Figma・Figmaライクなアーキテクチャ:
 *   1. APIから「暗号部品のJSON Payload」を取得 (GET)
 *   2. ブラウザで @react-pdf/renderer により PDF を生成
 *   3. Payload の files[] を JSZip でブラウザ内にアセンブル
 *   4. file-saver の saveAs() でZIPをダウンロード
 *
 * サーバー側で archiver / ZIP ストリームは一切行わない。
 * タイムアウト・メモリリークのリスクをゼロに。
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useState } from 'react';
import { Download, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { generateCertificatePdfBlob, generateCoverLetterPdfBlob } from '@/lib/pdf/generator';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// ─────────────────────────────────────────────────────────
// Types (API Payload契約)
// ─────────────────────────────────────────────────────────

type FileEntry =
    | { name: string; type: 'text';   content: string }
    | { name: string; type: 'base64'; content: string }
    | { name: string; type: 'url';    url: string };

interface PdfMetaCertInput {
    certificateId: string;
    creatorDisplayName: string;
    fileName: string;
    fileSize: string;
    sha256: string;
    timestampJst: string;
    verificationUrl: string;
    sealVariant: 'teal' | 'gold';
    tsaProvider: string;
}

interface PdfMetaCoverInput extends PdfMetaCertInput {
    fileTree: ReadonlyArray<{ name: string; size: string; description?: string }>;
}

interface EvidencePackPayload {
    filename: string;
    pdfMeta: {
        certInput: PdfMetaCertInput;
        coverInput: PdfMetaCoverInput;
    };
    files: FileEntry[];
}

// ─────────────────────────────────────────────────────────
// Component Props
// ─────────────────────────────────────────────────────────

interface Props {
    certId?: string;
    /** Spot orderの場合: spot session ID */
    spotSession?: string;
    /** Spot orderの場合: staging ID */
    stagingId?: string;
    /** 後方互換: 旧来のコードが渡す certId prop */
    apiData?: any;
    variant?: 'primary' | 'ghost';
    label?: string;
}

// ─────────────────────────────────────────────────────────
// Download Phases
// ─────────────────────────────────────────────────────────

type Phase =
    | 'idle'
    | 'fetching'    // APIからJSONペイロード取得中
    | 'generating'  // PDF生成中
    | 'downloading' // URL型ファイルのfetch中
    | 'building';   // JSZipでZIP構築中

const PHASE_LABELS: Record<Phase, string> = {
    idle:        'Evidence Pack をダウンロード',
    fetching:    'データを取得中…',
    generating:  'PDF を生成中…',
    downloading: 'アセットを取得中…',
    building:    'ZIP を構築中…',
};

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

export default function EvidencePackDownloadButton({
    certId,
    spotSession,
    stagingId,
    apiData,
    variant = 'primary',
    label = 'Evidence Pack をダウンロード',
}: Props): JSX.Element {
    const [phase, setPhase] = useState<Phase>('idle');
    const isProcessing = phase !== 'idle';

    const handleDownload = useCallback(async () => {
        if (isProcessing) return;

        // certId は apiData.id からも補完可能
        const resolvedCertId = certId ?? apiData?.id ?? '';
        const toastId = toast.loading('データを取得中…', { id: `evidence-${resolvedCertId || stagingId}` });
        setPhase('fetching');

        try {
            // ── 1. セッション確認 ────────────────────────────────
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('ログインセッションが切れました。再ログインしてください。');

            // ── 2. APIからJSON Payloadを取得 (GET) ───────────────
            // Auth flow: ?cert=UUID
            // Spot flow: ?spot=sessionId&staging=uuid
            let apiUrl: string;
            if (resolvedCertId) {
                apiUrl = `/api/generate-evidence-pack?cert=${resolvedCertId}`;
            } else if (spotSession && stagingId) {
                apiUrl = `/api/generate-evidence-pack?spot=${spotSession}&staging=${stagingId}`;
            } else {
                throw new Error('ダウンロードに必要なパラメータが不足しています');
            }

            const payloadRes = await fetch(apiUrl, {
                method: 'GET',
                headers: { Authorization: `Bearer ${session.access_token}` },
                credentials: 'omit',
            });

            if (!payloadRes.ok) {
                const j = await payloadRes.json().catch(() => ({}));
                throw new Error(j.error ?? `サーバーエラーが発生しました (HTTP ${payloadRes.status})`);
            }

            const payload: EvidencePackPayload = await payloadRes.json();
            const { pdfMeta, files, filename } = payload;

            // ── 3. ブラウザ側でPDFを直列生成 ──────────────────────
            setPhase('generating');
            toast.loading('証明書 PDF を生成しています… (1/2)', { id: toastId });
            const certBlob = await generateCertificatePdfBlob(pdfMeta.certInput);

            toast.loading('カバーレター PDF を生成しています… (2/2)', { id: toastId });
            const coverBlob = await generateCoverLetterPdfBlob(pdfMeta.coverInput);

            // ── 4. URL型ファイルを並列fetch ───────────────────────
            setPhase('downloading');
            toast.loading('アセットを取得中…', { id: toastId });

            // まずZIPを初期化し、text/base64は先に追加
            const zip = new JSZip();

            // 生成したPDF2種を追加
            zip.file('Certificate_of_Authenticity.pdf', certBlob);
            zip.file('Cover_Letter.pdf', coverBlob);

            // URL型の並列fetch (Promise.all)
            const urlFetches: Promise<void>[] = [];

            for (const f of files) {
                if (f.type === 'text') {
                    zip.file(f.name, f.content);
                } else if (f.type === 'base64') {
                    zip.file(f.name, f.content, { base64: true });
                } else if (f.type === 'url') {
                    urlFetches.push(
                        fetch(f.url)
                            .then(r => {
                                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                                return r.blob();
                            })
                            .then(blob => {
                                zip.file(f.name, blob);
                            })
                            .catch(err => {
                                // fetchに失敗してもZIP生成は続行し、プレースホルダを挿入
                                const msg = err instanceof Error ? err.message : String(err);
                                zip.file(
                                    `${f.name}.MISSING.txt`,
                                    `Could not fetch asset: ${msg}\n`,
                                );
                            }),
                    );
                }
            }

            // 並列fetchが全て完了するのを待つ
            await Promise.all(urlFetches);

            // ── 5. JSZipでZIP構築 ────────────────────────────────
            setPhase('building');
            toast.loading('ZIP を構築中…', { id: toastId });

            const zipBlob = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 },
            });

            // ── 6. ダウンロード発火 ───────────────────────────────
            saveAs(zipBlob, filename);

            toast.success('Evidence Pack のダウンロードが完了しました', { id: toastId });
        } catch (e) {
            toast.error('ダウンロードに失敗しました', {
                id: toastId,
                description: e instanceof Error ? e.message : 'ネットワーク接続を確認してください。',
            });
        } finally {
            setPhase('idle');
        }
    }, [certId, spotSession, stagingId, apiData, isProcessing]);

    const currentLabel = phase === 'idle' ? label : PHASE_LABELS[phase];

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
                    {isProcessing
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Download className="w-4 h-4" />
                    }
                </span>
                <span className="flex flex-col items-start leading-tight">
                    <span className="text-[15px]">
                        {currentLabel}
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