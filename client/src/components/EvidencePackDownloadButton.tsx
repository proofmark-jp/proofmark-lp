/**
 * client/src/components/EvidencePackDownloadButton.tsx
 *
 * - useEvidencePack の state を 1 つの美しい UI に翻訳する
 * - CertificatePage.tsx / Dashboard.tsx から差し替え可能
 * - 失敗/再試行/中断 を 1 ボタンで管理（モーダル不要）
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle, CheckCircle2, Download, FileArchive,
    Loader2, ShieldCheck, X,
} from 'lucide-react';
import { useEvidencePack, type EvidencePackPhase } from '@/hooks/useEvidencePack';

interface Props {
    certId: string;
    /** 任意: 既存のスタイルに合わせるなら sm を指定 */
    variant?: 'primary' | 'ghost';
    /** ボタン上のラベル (default: "Evidence Pack をダウンロード") */
    label?: string;
}

const PHASE_ICON: Record<EvidencePackPhase, JSX.Element> = {
    idle: <Download className="w-4 h-4" />,
    fetching_payload: <Loader2 className="w-4 h-4 animate-spin" />,
    downloading_assets: <Loader2 className="w-4 h-4 animate-spin" />,
    generating_certificate: <Loader2 className="w-4 h-4 animate-spin" />,
    packing_archive: <FileArchive className="w-4 h-4 animate-pulse" />,
    saving: <Loader2 className="w-4 h-4 animate-spin" />,
    done: <CheckCircle2 className="w-4 h-4" />,
    error: <AlertCircle className="w-4 h-4" />,
};

const PHASE_ORDER: ReadonlyArray<EvidencePackPhase> = [
    'fetching_payload',
    'downloading_assets',
    'generating_certificate',
    'packing_archive',
    'saving',
];

export default function EvidencePackDownloadButton({
    certId,
    variant = 'primary',
    label = 'Evidence Pack をダウンロード',
}: Props): JSX.Element {
    const { state, download, cancel, reset } = useEvidencePack();
    const [expanded, setExpanded] = useState(false);
    const [theme, setTheme] = useState<'color' | 'mono'>('color');

    // 完了 / エラーは 3 秒後に自動 idle へ
    useEffect(() => {
        if (state.phase !== 'done' && state.phase !== 'error') return;
        const t = window.setTimeout(() => reset(), 4000);
        return () => window.clearTimeout(t);
    }, [state.phase, reset]);

    // 進行中は詳細パネルを開いておく
    useEffect(() => {
        if (state.phase === 'idle') setExpanded(false);
        else setExpanded(true);
    }, [state.phase]);

    const isBusy = useMemo(
        () => !(state.phase === 'idle' || state.phase === 'done' || state.phase === 'error'),
        [state.phase],
    );

    const handleClick = useCallback((): void => {
        if (isBusy) {
            cancel();
            return;
        }
        void download(certId, theme);
    }, [isBusy, cancel, download, certId, theme]);

    const baseBtn =
        variant === 'primary'
            ? 'bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] text-white shadow-[0_12px_28px_rgba(108,62,244,0.4)]'
            : 'border border-white/12 bg-white/[0.04] text-white';

    return (
        <div className="w-full flex flex-col gap-4">
            <div className="flex w-full rounded-xl bg-white/5 p-1">
                <button
                    type="button"
                    onClick={() => setTheme('color')}
                    className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${theme === 'color' ? 'bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] text-white shadow-sm' : 'text-white/60 hover:text-white/80'}`}
                >
                    クリエイター向け (Color)
                </button>
                <button
                    type="button"
                    onClick={() => setTheme('mono')}
                    className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${theme === 'mono' ? 'bg-white/20 text-white shadow-sm' : 'text-white/60 hover:text-white/80'}`}
                >
                    法人・法務向け (Mono)
                </button>
            </div>

            <button
                type="button"
                onClick={handleClick}
                disabled={state.phase === 'done'}
                aria-busy={isBusy}
                className={[
                    'group flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-3.5',
                    'font-bold transition-transform active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C3EF4]',
                    baseBtn,
                    state.phase === 'done' ? 'opacity-90' : '',
                ].join(' ')}
            >
                <span className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/14 text-white">
                        {PHASE_ICON[state.phase]}
                    </span>
                    <span className="flex flex-col items-start leading-tight">
                        <span className="text-[15px]">
                            {state.phase === 'done'
                                ? '保存しました'
                                : state.phase === 'error'
                                    ? '再試行する'
                                    : isBusy
                                        ? '中断する'
                                        : label}
                        </span>
                        <span className="text-[11px] font-medium text-white/72">
                            {isBusy ? state.message : 'RFC3161 · SHA-256 · 同梱証明書 PDF つき'}
                        </span>
                    </span>
                </span>

                {isBusy ? (
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-white/80">
                        <X className="h-3.5 w-3.5" />
                        <span>cancel</span>
                    </span>
                ) : (
                    <ShieldCheck className="h-5 w-5 text-white/82 group-hover:scale-110 transition-transform" />
                )}
            </button>

            {/* ── Progress panel ──────────────────────────────── */}
            {expanded ? (
                <div
                    className="mt-3 rounded-2xl border p-4"
                    style={{ borderColor: 'rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.025)' }}
                    role="status"
                    aria-live="polite"
                >
                    {/* Progress bar */}
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                            className="absolute inset-y-0 left-0 transition-[width] duration-300 ease-out"
                            style={{
                                width: `${Math.round(state.progress * 100)}%`,
                                background:
                                    state.phase === 'error'
                                        ? '#FF453A'
                                        : state.phase === 'done'
                                            ? '#00D4AA'
                                            : 'linear-gradient(90deg, #6C3EF4, #00D4AA)',
                                boxShadow: state.phase === 'done' ? '0 0 18px rgba(0,212,170,0.45)' : 'none',
                            }}
                        />
                    </div>

                    {/* Step tracker */}
                    <div className="mt-4 grid grid-cols-5 gap-2">
                        {PHASE_ORDER.map((phase) => {
                            const isActive = state.phase === phase;
                            const isPast = PHASE_ORDER.indexOf(state.phase) > PHASE_ORDER.indexOf(phase);
                            const dotColor =
                                isPast ? '#00D4AA' : isActive ? '#6C3EF4' : 'rgba(255,255,255,0.20)';
                            return (
                                <div key={phase} className="flex flex-col items-start gap-1">
                                    <div
                                        className="h-1.5 w-full rounded-full"
                                        style={{
                                            background: dotColor,
                                            boxShadow: isActive ? '0 0 14px rgba(108,62,244,0.6)' : 'none',
                                            transition: 'background 0.2s, box-shadow 0.2s',
                                        }}
                                    />
                                    <span
                                        className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                                        style={{
                                            color: isPast || isActive ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.32)',
                                        }}
                                    >
                                        {STEP_LABELS[phase]}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Status line */}
                    <div className="mt-4 flex items-center justify-between gap-3 text-[12px]">
                        <span className="text-white/70">
                            {state.phase === 'error'
                                ? state.error
                                : state.phase === 'done'
                                    ? 'ダウンロードを完了しました。'
                                    : state.message}
                        </span>
                        <span className="font-mono text-white/55">
                            {Math.round(state.progress * 100)}%
                        </span>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

const STEP_LABELS: Record<EvidencePackPhase, string> = {
    idle: '',
    fetching_payload: 'Keys',
    downloading_assets: 'Fetch',
    generating_certificate: 'PDF',
    packing_archive: 'Pack',
    saving: 'Save',
    done: '',
    error: '',
};
