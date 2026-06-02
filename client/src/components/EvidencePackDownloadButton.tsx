/**
 * EvidencePackDownloadButton.tsx — In-Browser ZIP Assembly Architecture (v6)
 * ─────────────────────────────────────────────────────────────────────────────
 * アーキテクチャ:
 *   1. APIから「暗号部品のJSON Payload」を取得 (GET)
 *   2. ブラウザで @react-pdf/renderer により PDF を生成
 *   3. Payload の files[] を JSZip でブラウザ内にアセンブル
 *   4. file-saver の saveAs() でZIPをダウンロード
 *
 * v6 の変更:
 *   - ダウンロードの全フローを純粋な非同期関数 `executeEvidencePackDownload`
 *     として切り出し、UI（コンポーネント）から完全分離。
 *   - Dashboard.studio.tsx など、ボタンUIを持たない呼び出し元が
 *     直接 `executeEvidencePackDownload` をインポートして使用できる。
 *   - コンポーネント本体は `executeEvidencePackDownload` の薄いラッパー。
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useState } from 'react';
import type { ReactElement } from 'react';
import { Download, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { generateCertificatePdfBlob, generateCoverLetterPdfBlob } from '@/lib/pdf/generator';
import { ensurePdfFontsRegistered } from '@/lib/pdf/fonts';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// ─────────────────────────────────────────────────────────
// Types (API Payload 契約)
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
// Download Params
// ─────────────────────────────────────────────────────────

export interface EvidencePackDownloadParams {
    certId?: string;
    /** Spot orderの場合: stripe session ID */
    spotSession?: string;
    /** Spot orderの場合: staging ID */
    stagingId?: string;
    /** 後方互換: 旧来のコードが渡す certId prop */
    apiData?: any;
}

// ─────────────────────────────────────────────────────────
// ★ Core: 純粋な非同期ダウンロード関数 (UI 非依存)
//    Dashboard.studio.tsx 等の呼び出し元から直接 import して使用可能。
// ─────────────────────────────────────────────────────────

/**
 * Evidence Pack のダウンロード全フローを実行する。
 *
 * - supabase セッション取得
 * - APIからJSON Payloadをfetch (GET)
 * - @react-pdf/renderer でPDF生成
 * - JSZip でブラウザ内ZIP組み立て
 * - file-saver の saveAs でダウンロード発火
 *
 * @param params    certId / spotSession / stagingId のいずれかを指定
 * @param onPhaseChange フェーズ変更通知コールバック (任意)
 * @throws エラー時は `Error` をスローする (呼び出し元でキャッチすること)
 */
export async function executeEvidencePackDownload(
    params: EvidencePackDownloadParams,
    onPhaseChange?: (phase: 'fetching' | 'generating' | 'downloading' | 'building') => void,
): Promise<void> {
    const resolvedCertId = params.certId ?? params.apiData?.id ?? '';
    const { spotSession, stagingId } = params;

    const toastKey = `evidence-${resolvedCertId || stagingId || 'pack'}`;

    // ── 1. セッション確認 ────────────────────────────────────
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        throw new Error('ログインセッションが切れました。再ログインしてください。');
    }

    // ── 2. フォントを先行登録 (PDF生成前に呼ぶことでクラッシュを防止) ──
    ensurePdfFontsRegistered();

    // ── 3. APIからJSON Payloadを取得 (GET) ───────────────────
    onPhaseChange?.('fetching');

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
        credentials: 'include',
    });

    if (!payloadRes.ok) {
        const j = await payloadRes.json().catch(() => ({})) as { error?: string };
        throw new Error(j.error ?? `サーバーエラーが発生しました (HTTP ${payloadRes.status})`);
    }

    const payload: EvidencePackPayload = await payloadRes.json();
    const { pdfMeta, files, filename } = payload;

    // ── 4. ブラウザ側でPDFを直列生成 ─────────────────────────
    onPhaseChange?.('generating');
    toast.loading('証明書 PDF を生成しています… (1/2)', { id: toastKey });

    const certBlob = await generateCertificatePdfBlob(pdfMeta.certInput);

    // スレッドを解放してGCとアニメーションに機会を与える
    await new Promise<void>((r) => setTimeout(r, 50));

    toast.loading('カバーレター PDF を生成しています… (2/2)', { id: toastKey });
    const coverBlob = await generateCoverLetterPdfBlob(pdfMeta.coverInput);

    await new Promise<void>((r) => setTimeout(r, 50));

    // ── 5. URL型ファイルを並列fetch ───────────────────────────
    onPhaseChange?.('downloading');
    toast.loading('アセットを取得中…', { id: toastKey });

    const zip = new JSZip();

    // 生成したPDF 2種を先に追加
    zip.file('Certificate_of_Authenticity.pdf', certBlob);
    zip.file('Cover_Letter.pdf', coverBlob);

    // text / base64 は同期追加、url は並列fetch
    const urlFetches: Promise<void>[] = [];

    for (const f of files) {
        if (f.type === 'text') {
            zip.file(f.name, f.content);
        } else if (f.type === 'base64') {
            zip.file(f.name, f.content, { base64: true });
        } else if (f.type === 'url') {
            urlFetches.push(
                fetch(f.url)
                    .then((r) => {
                        if (!r.ok) throw new Error(`HTTP ${r.status}`);
                        return r.blob();
                    })
                    .then((blob) => {
                        zip.file(f.name, blob);
                    })
                    .catch((err) => {
                        // fetch失敗でもZIP生成を続行し、プレースホルダを挿入
                        const msg = err instanceof Error ? err.message : String(err);
                        zip.file(`${f.name}.MISSING.txt`, `Could not fetch asset: ${msg}\n`);
                    }),
            );
        }
    }

    await Promise.all(urlFetches);

    // ── 6. JSZipでZIP構築 ────────────────────────────────────
    onPhaseChange?.('building');
    toast.loading('ZIP を構築中…', { id: toastKey });

    const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
    });

    // ── 7. ダウンロード発火 ───────────────────────────────────
    saveAs(zipBlob, filename);

    toast.success('Evidence Pack のダウンロードが完了しました', { id: toastKey });
}

// ─────────────────────────────────────────────────────────
// Component Props
// ─────────────────────────────────────────────────────────

interface Props extends EvidencePackDownloadParams {
    variant?: 'primary' | 'ghost';
    label?: string;
}

// ─────────────────────────────────────────────────────────
// Download Phases (UI 用ラベル)
// ─────────────────────────────────────────────────────────

type Phase =
    | 'idle'
    | 'fetching'
    | 'generating'
    | 'downloading'
    | 'building';

const PHASE_LABELS: Record<Phase, string> = {
    idle:        'Evidence Pack をダウンロード',
    fetching:    'データを取得中…',
    generating:  'PDF を生成中…',
    downloading: 'アセットを取得中…',
    building:    'ZIP を構築中…',
};

// ─────────────────────────────────────────────────────────
// Component — executeEvidencePackDownload の薄いUIラッパー
// ─────────────────────────────────────────────────────────

export default function EvidencePackDownloadButton({
    certId,
    spotSession,
    stagingId,
    apiData,
    variant = 'primary',
    label = 'Evidence Pack をダウンロード',
}: Props): ReactElement {
    const [phase, setPhase] = useState<Phase>('idle');
    const isProcessing = phase !== 'idle';

    const handleDownload = useCallback(async () => {
        if (isProcessing) return;
        setPhase('fetching');
        try {
            await executeEvidencePackDownload(
                { certId, spotSession, stagingId, apiData },
                (p) => setPhase(p),
            );
        } catch (e) {
            toast.error('ダウンロードに失敗しました', {
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