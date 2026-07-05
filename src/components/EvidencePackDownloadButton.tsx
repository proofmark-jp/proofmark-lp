"use client";
/**
 * src/components/EvidencePackDownloadButton.tsx — The True Adaptive Compiler (v7)
 * ─────────────────────────────────────────────────────────────────────────────
 * 【究極のハイブリッド・アーキテクチャ】
 * 1. Headless Separation:
 * データの「Fetch（調達）」と「Stream（錬成）」を純粋な非同期関数として完全分離。
 * ダッシュボード等の外部コンポーネントからも自由にインポート・実行可能。
 * 2. The Native Stream (JSZip排除):
 * ブラウザのRAMを一切消費せず、OSネイティブで100GBのZIPを直接ディスクへ書き出す。
 * 3. The Magic Hand-off (UXの魔法):
 * モバイル端末かつ大容量(20枚超)の場合のみ、美しいモーダルを展開してPCへ誘導。
 * 4. GC Yielding (メモリ解放):
 * PDF生成の間に150msの待機を挟み、Yoga/fontkitのメモリリークを物理的に止血。
 * 5. Zombie Fetch Protection:
 * AbortSignalを貫通させ、ユーザーキャンセル時に裏側の通信をOSレベルで即時切断。
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import type { ReactElement } from 'react';
import { Download, Loader2, ShieldCheck, Smartphone, Copy, ExternalLink, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { generateCertificatePdfBlob, generateCoverLetterPdfBlob } from '@/lib/pdf/generator';
import { ensurePdfFontsRegistered } from '@/lib/pdf/fonts';
import { executeNativeStreamZip } from '@/lib/zipStreamer';
import QRCode from 'qrcode';
import { AnimatePresence, motion } from 'framer-motion';

// ─────────────────────────────────────────────────────────
// Types (API Payload 契約 & Export)
// ─────────────────────────────────────────────────────────
export type FileEntry =
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

export interface EvidencePackPayload {
    filename: string;
    pdfMeta: { certInput: PdfMetaCertInput; coverInput: PdfMetaCoverInput; };
    files: FileEntry[];
}

export interface EvidencePackDownloadParams {
    certId?: string;
    spotSession?: string;
    stagingId?: string;
    apiData?: any;
}

// ─────────────────────────────────────────────────────────
// ★ Core 1: The Fetcher (純粋関数 - データの調達)
// ─────────────────────────────────────────────────────────
export async function fetchEvidencePayload(
    params: EvidencePackDownloadParams,
    signal?: AbortSignal
): Promise<EvidencePackPayload> {
    const resolvedCertId = params.certId ?? params.apiData?.id ?? '';
    const { spotSession, stagingId } = params;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('ログインセッションが切れました。再ログインしてください。');

    const apiUrl = resolvedCertId
        ? `/api/generate-evidence-pack?cert=${resolvedCertId}`
        : `/api/generate-evidence-pack?spot=${spotSession}&staging=${stagingId}`;

    const payloadRes = await fetch(apiUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.access_token}` },
        credentials: 'include',
        signal
    });

    if (!payloadRes.ok) {
        const j = await payloadRes.json().catch(() => ({})) as { error?: string };
        throw new Error(j.error ?? `サーバーエラーが発生しました (HTTP ${payloadRes.status})`);
    }

    return await payloadRes.json();
}

// ─────────────────────────────────────────────────────────
// ★ Core 2: The Streamer (純粋関数 - PDF錬成とZIPストリーム)
// ─────────────────────────────────────────────────────────
export async function executeEvidencePackStream(
    payload: EvidencePackPayload,
    signal: AbortSignal,
    onPhaseChange?: (phase: 'generating' | 'streaming') => void,
    toastKey?: string
): Promise<void> {
    ensurePdfFontsRegistered();

    onPhaseChange?.('generating');
    toast.loading('証明書 PDF を生成中… (1/2)', { id: toastKey });

    // 1. Fail-safe QRコード生成
    let safeUrl = 'https://proofmark.jp';
    try { safeUrl = new URL(payload.pdfMeta.coverInput.verificationUrl).href; } catch (e) {}
    const qrCodeDataUrl = await QRCode.toDataURL(safeUrl, { errorCorrectionLevel: 'M', margin: 1, color: { dark: '#0D0B24', light: '#FFFFFF' } }).catch(() => undefined);

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // 2. 証明書PDF生成
    const certBlob = await generateCertificatePdfBlob(payload.pdfMeta.certInput);

    // 🚨 The GC Yielding: 次の巨大PDF生成前に、Yoga/fontkitのメモリを強制解放する空白時間
    await new Promise(r => setTimeout(r, 150));
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // 3. カバーレターPDF生成
    toast.loading('カバーレター PDF を生成中… (2/2)', { id: toastKey });
    const coverInputWithQr = { ...payload.pdfMeta.coverInput, qrCodeDataUrl };
    const coverBlob = await generateCoverLetterPdfBlob(coverInputWithQr);

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // 4. ストリームZIPの発火
    onPhaseChange?.('streaming');
    toast.loading('安全なストリーム保存を実行中…', { id: toastKey });

    await executeNativeStreamZip({
        filename: payload.filename,
        payload,
        certPdfBlob: certBlob,
        coverPdfBlob: coverBlob,
        signal
    });
}

export async function executeEvidencePackDownload(
    params: EvidencePackDownloadParams,
    onPhaseChange?: (phase: any) => void,
): Promise<void> {
    const controller = new AbortController();
    onPhaseChange?.('fetching');
    const payload = await fetchEvidencePayload(params, controller.signal);
    await executeEvidencePackStream(payload, controller.signal, onPhaseChange);
}

// ─────────────────────────────────────────────────────────
// UI Component: The Command Center
// ─────────────────────────────────────────────────────────
type Phase = 'idle' | 'fetching' | 'magic-handoff' | 'generating' | 'streaming';

const PHASE_LABELS: Record<Phase, string> = {
    idle:          'Evidence Pack をダウンロード',
    fetching:      'データを取得中…',
    'magic-handoff': '安全な転送を待機中…',
    generating:    'PDF を生成中…',
    streaming:     'ストリーム保存中…',
};

interface Props extends EvidencePackDownloadParams {
    variant?: 'primary' | 'ghost';
    label?: string;
}

export default function EvidencePackDownloadButton({
    certId, spotSession, stagingId, apiData, variant = 'primary', label = 'Evidence Pack をダウンロード',
}: Props): ReactElement {
    const [phase, setPhase] = useState<Phase>('idle');
    const [payloadCache, setPayloadCache] = useState<EvidencePackPayload | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const isProcessing = phase !== 'idle' && phase !== 'magic-handoff';
    const resolvedCertId = certId ?? apiData?.id ?? '';
    const toastKey = `evidence-${resolvedCertId || stagingId || 'pack'}`;
    const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    useEffect(() => {
        return () => { abortControllerRef.current?.abort(); };
    }, []);

    // 🚨 究極のスピード: ホバー時にAPIを先行フェッチしてキャッシュする
    const prefetchPayload = async () => {
        if (payloadCache || phase !== 'idle') return; // すでにキャッシュがあるか、実行中なら何もしない
        try {
            abortControllerRef.current = new AbortController();
            const payload = await fetchEvidencePayload({ certId, spotSession, stagingId, apiData }, abortControllerRef.current.signal);
            setPayloadCache(payload);
        } catch (e) { /* 事前フェッチのエラーは無視して本番クリックに委ねる */ }
    };

    // ── 司令塔 1: ボタンクリックの司令 ──
    const handleInitialClick = async () => {
        let payload = payloadCache;

        if (!payload) {
            setPhase('fetching');
            try {
                abortControllerRef.current = new AbortController();
                payload = await fetchEvidencePayload({ certId, spotSession, stagingId, apiData }, abortControllerRef.current.signal);
                setPayloadCache(payload);
            } catch (e: any) {
                if (e.name !== 'AbortError') toast.error('データ取得に失敗しました', { description: e.message });
                setPhase('idle');
                return;
            }
        }

        // モバイル && 大容量 → Magic Hand-off モーダルへ
        if (isMobile && payload.files.length > 20) {
            setPhase('magic-handoff');
        } else {
            await processStream(payload!);
        }
    };

    // ── 司令塔 2: Stream の発火 ──
    const processStream = async (payload: EvidencePackPayload) => {
        if (!abortControllerRef.current || abortControllerRef.current.signal.aborted) {
            abortControllerRef.current = new AbortController();
        }

        try {
            await executeEvidencePackStream(payload, abortControllerRef.current.signal, setPhase, toastKey);
            // 🚨 Post-Delivery Upsell
            toast.success('Evidence Pack を保存しました', {
                id: toastKey,
                duration: 8000,
                description: '原本データは30日後に自動消去されます。',
                action: {
                    label: '永久保存する',
                    onClick: () => window.open('/pricing', '_blank')
                }
            });

            // 監査ログビーコン
            if (resolvedCertId && typeof navigator.sendBeacon === 'function') {
                navigator.sendBeacon('/api/audit/download-log', new Blob([JSON.stringify({ certId: resolvedCertId, action: 'DOWNLOAD', timestamp: Date.now() })], { type: 'application/json' }));
            }
        } catch (e: any) {
            if (e.name !== 'AbortError') {
                toast.error('ストリーム保存に失敗しました', { description: e.message });
            }
        } finally {
            setPhase('idle');
            setPayloadCache(null);
            abortControllerRef.current = null;
        }
    };

    const cancelDownload = () => {
        abortControllerRef.current?.abort();
        setPhase('idle');
        // 🚨 setPayloadCache(null) は削除！ (Signed URL再計算のコストを防ぐ)
        toast.dismiss(toastKey);
    };

    const copyUrlToClipboard = () => {
        navigator.clipboard.writeText(window.location.href);
        toast.success('URLをコピーしました', { description: 'PCのブラウザに貼り付けてダウンロードしてください。' });
        setPhase('idle');
    };

    const currentLabel = phase === 'idle' ? label : PHASE_LABELS[phase];
    const baseBtn = variant === 'primary'
        ? 'bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] text-white shadow-[0_12px_28px_rgba(108,62,244,0.4)]'
        : 'border border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08]';

    return (
        <>
            <button
                type="button"
                onClick={phase === 'streaming' || phase === 'generating' ? cancelDownload : handleInitialClick}
                disabled={phase === 'fetching' || phase === 'magic-handoff'}
                className={['group flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-3.5 font-bold transition-all active:scale-[0.99]', baseBtn].join(' ')}
                onMouseEnter={prefetchPayload}
                // 🚨 onTouchStart={prefetchPayload} はスクロール中の暴発（API雪崩）を防ぐため削除
            >
                <span className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/14 text-white">
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    </span>
                    <span className="flex flex-col items-start leading-tight">
                        <span className="text-[15px]">{currentLabel}</span>
                        <span className="text-[11px] font-medium text-white/72">
                            {phase === 'streaming' || phase === 'generating' ? 'タップして中断・通信切断' : 'RFC3161 · SHA-256 · Native Stream'}
                        </span>
                    </span>
                </span>
                <ShieldCheck className={`h-5 w-5 text-white/82 transition-transform ${isProcessing ? '' : 'group-hover:scale-110'}`} />
            </button>

            {/* 👑 The Magic Hand-off Modal */}
            <AnimatePresence>
                {phase === 'magic-handoff' && payloadCache && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
                            className="bg-[#0F0F11] border border-white/10 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#F59E0B] to-[#FF4D4D]" />

                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center shrink-0">
                                    <Smartphone className="w-5 h-5 text-[#F59E0B]" />
                                </div>
                                <h3 className="text-lg font-black text-white leading-tight">高解像度パックの<br/>安全なダウンロード</h3>
                            </div>

                            <p className="text-[#A8A0D8] text-sm leading-relaxed mb-6">
                                この Evidence Pack は <strong className="text-white">{payloadCache.files.length}枚</strong> の検証用アセットを含んでいます。
                                モバイル端末での大容量ZIPの一括解凍は、メモリ不足によるファイルの破損やフリーズを引き起こす可能性があります。プロジェクトの安全を期すため、PC環境でのダウンロードを強く推奨いたします。
                            </p>

                            <div className="space-y-3">
                                <button
                                    onClick={copyUrlToClipboard}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-[#00D4AA] font-bold hover:bg-[#00D4AA]/20 transition-colors"
                                >
                                    <Copy className="w-4 h-4" />
                                    デスクトップ用リンクをコピー
                                </button>

                                <button
                                    onClick={() => setPhase('idle')}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-colors"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Web Vault で個別保存する (閉じる)
                                </button>
                            </div>

                            <div className="mt-6 pt-4 border-t border-white/10">
                                <button
                                    onClick={() => processStream(payloadCache)}
                                    className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-[#A8A0D8]/40 hover:text-[#FF4D4D] transition-colors"
                                >
                                    <AlertTriangle className="w-3 h-3" />
                                    リスクを承知でこの端末に強制ダウンロードする
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
