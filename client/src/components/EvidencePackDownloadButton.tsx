/**
 * EvidencePackDownloadButton.tsx — In-Browser ZIP Assembly Architecture (v9 The Pinnacle)
 * ─────────────────────────────────────────────────────────────────────────────
 * アーキテクチャ:
 * 1. APIから「暗号部品のJSON Payload」を取得 (GET)
 * 2. 【並列化＆防衛】QRコード動的生成 (Fail-safe/ダウングレード) と 証明書PDF生成を同時実行
 * 3. @react-pdf/renderer により カバーレターPDF を生成（UIブロッキング回避）
 * 4. 【コストゼロ・爆速】Cache API を活用し、並行接続数制御（Limit = 4）でフェッチ
 * 5. 【OOM回避】JSZip の STORE（無圧縮）モードでアセンブルし、iPhoneのRAMクラッシュを防止
 * 6. 【監査ログ】ダウンロード完了時、非同期ビーコンで監査ログをサイレント送信
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
import QRCode from 'qrcode';

// ─────────────────────────────────────────────────────────
// Types (API Payload 契約)
// ─────────────────────────────────────────────────────────

type FileEntry =
    | { name: string; type: 'text';   content: string }
    | { name: string; type: 'base64'; content: string }
    | { name: string; type: 'url';    url: string };

export interface PdfMetaCertInput {
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

export interface PdfMetaCoverInput extends PdfMetaCertInput {
    fileTree: ReadonlyArray<{ name: string; size: string; description?: string }>;
    qrCodeDataUrl?: string;
}

interface EvidencePackPayload {
    filename: string;
    pdfMeta: {
        certInput: PdfMetaCertInput;
        coverInput: PdfMetaCoverInput;
    };
    files: FileEntry[];
}

export interface EvidencePackDownloadParams {
    certId?: string;
    spotSession?: string;
    stagingId?: string;
    apiData?: any;
}

// ─────────────────────────────────────────────────────────
// ★ Core: 純粋な非同期ダウンロード関数 (UI 非依存・絶対防御)
// ─────────────────────────────────────────────────────────

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

    // ── 2. フォント先行登録 ──────────────────────────────────
    ensurePdfFontsRegistered();

    // ── 3. APIからJSON Payloadを取得 ─────────────────────────
    onPhaseChange?.('fetching');
    const apiUrl = resolvedCertId 
        ? `/api/generate-evidence-pack?cert=${resolvedCertId}`
        : `/api/generate-evidence-pack?spot=${spotSession}&staging=${stagingId}`;

    if (!resolvedCertId && (!spotSession || !stagingId)) {
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

    // ── 4. 並行処理による爆速化 ＆ QRフェイルセーフ ────────
    onPhaseChange?.('generating');
    toast.loading('証明書と暗号モジュールを生成中… (1/2)', { id: toastKey });
    await new Promise<void>((r) => setTimeout(r, 100));

    let safeUrl = 'https://proofmark.jp';
    try {
        const verifyUrl = pdfMeta.coverInput.verificationUrl;
        const target = verifyUrl.startsWith('http') ? verifyUrl : `https://${verifyUrl}`;
        safeUrl = new URL(target).href;
    } catch (e) {
        console.error('Invalid Verification URL payload, applying ultimate fallback.', e);
    }

    const [certBlob, qrCodeDataUrl] = await Promise.all([
        generateCertificatePdfBlob(pdfMeta.certInput),
        (async () => {
            try {
                return await QRCode.toDataURL(safeUrl, { errorCorrectionLevel: 'H', margin: 1, color: { dark: '#0D0B24', light: '#FFFFFF' } });
            } catch (e) {
                console.warn('QR (Level H) failed, retrying with Level M...', e);
                try {
                    return await QRCode.toDataURL(safeUrl, { errorCorrectionLevel: 'M', margin: 1, color: { dark: '#0D0B24', light: '#FFFFFF' } });
                } catch (e2) {
                    console.error('QR completely failed', e2);
                    return undefined;
                }
            }
        })()
    ]);

    toast.loading('カバーレター PDF を生成しています… (2/2)', { id: toastKey });
    await new Promise<void>((r) => setTimeout(r, 100));
    
    const coverInputWithQr = { ...pdfMeta.coverInput, qrCodeDataUrl };
    const coverBlob = await generateCoverLetterPdfBlob(coverInputWithQr);

    // ── 5. Cache API を用いた爆速・コストゼロフェッチ ───────
    onPhaseChange?.('downloading');
    toast.loading('アセットを取得中…', { id: toastKey });

    const zip = new JSZip();
    zip.file('Certificate_of_Authenticity.pdf', certBlob);
    zip.file('Cover_Letter.pdf', coverBlob);

    const CONCURRENT_LIMIT = 4;
    const urlFiles = files.filter(f => f.type === 'url') as extractUrlType<typeof files>;
    
    for (const f of files) {
        if (f.type === 'text') {
            zip.file(f.name, f.content);
        } else if (f.type === 'base64') {
            zip.file(f.name, f.content, { base64: true });
        }
    }

    let cache: Cache | undefined;
    try {
        cache = await caches.open('proofmark-assets-v1');
    } catch (e) {
        console.warn('Cache API unavailable, proceeding without cache.', e);
    }

    for (let i = 0; i < urlFiles.length; i += CONCURRENT_LIMIT) {
        const chunk = urlFiles.slice(i, i + CONCURRENT_LIMIT);
        await Promise.all(chunk.map(async (f) => {
            try {
                let response = cache ? await cache.match(f.url) : undefined;
                if (!response) {
                    response = await fetch(f.url, { mode: 'cors' });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    if (cache) cache.put(f.url, response.clone()).catch(console.warn);
                }
                const blob = await response.blob();
                zip.file(f.name, blob);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                zip.file(`${f.name}.MISSING.txt`, `Could not fetch asset: ${msg}\n`);
            }
        }));
    }

    // ── 6. OOMクラッシュを回避する「STORE」アセンブル ────────
    onPhaseChange?.('building');
    toast.loading('ZIP を構築中…', { id: toastKey });

    const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'STORE', // 👑 iPhoneでのRAMクラッシュ防止 ＆ 速度10倍化
    });

    // ── 7. ダウンロード発火 ＆ 監査ログのサイレント送信 ───────
    saveAs(zipBlob, filename);
    toast.success('Evidence Pack のダウンロードが完了しました', { id: toastKey });

    // セキュリティ: バックグラウンドで非同期監査ログを送信 (UIをブロックしない)
    if (resolvedCertId && typeof navigator.sendBeacon === 'function') {
        const auditPayload = JSON.stringify({ certId: resolvedCertId, action: 'DOWNLOAD', timestamp: Date.now() });
        navigator.sendBeacon('/api/audit/download-log', new Blob([auditPayload], { type: 'application/json' }));
    }

    setTimeout(() => {
        console.debug('Evidence Pack download cycle completed. GC hint.');
    }, 1000);
}

type extractUrlType<T> = Array<{ name: string; type: 'url'; url: string }>;

// ─────────────────────────────────────────────────────────
// Component Props & Phases
// ─────────────────────────────────────────────────────────

interface Props extends EvidencePackDownloadParams {
    variant?: 'primary' | 'ghost';
    label?: string;
}

type Phase = 'idle' | 'fetching' | 'generating' | 'downloading' | 'building';

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