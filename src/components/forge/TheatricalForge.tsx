/**
 * src/components/forge/TheatricalForge.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * ProofMark Theatrical Forge — サイバーUI / PoW演出 / Activation Bridge Share
 *
 * 絶対契約:
 *  1. PoW実行中は Framer Motion でサイバー演出 (テキストグリッチ / プログレス)
 *  2. 完了後は「タップして証拠をシェア」ボタンのみ。navigator.share 自動呼び出し禁止。
 *  3. share は Transient Activation (明示的タップ) でのみ発火。
 *  4. フォールバックは a[download] 禁止 — Web Share が使えなければ通知のみ。
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { nanoid } from 'nanoid';
import { ShieldCheck, Zap, AlertTriangle, Cpu, Share2 } from 'lucide-react';
import { computeFileHash, HashProgress } from '../../lib/crypto/hasher';
import {
    usePowMiner,
    useForgeQueue,
    ForgeJob,
    ForgeJobResult,
    MinerDisplayRefs,
} from '../../hooks/usePowMiner';
import { useShadowIdentity } from '../../hooks/useShadowIdentity';

// ── Constants ──────────────────────────────────────────────────────────────────

const DIFFICULTY = 4; // 先頭ゼロ数 (Edge と合わせる)
const MAX_FILE_SIZE_GB = 2;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_GB * 1024 ** 3;

// グリッチ演出用テキストセット
const GLITCH_PHRASES = [
    'COMPUTING SHA-256 PROOF',
    'MINING CRYPTOGRAPHIC NONCE',
    'FORGING EXISTENCE PROOF',
    'ANCHORING HASH TO LEDGER',
    'ZERO-KNOWLEDGE SEALING',
    'VERCEL EDGE VALIDATING',
    'IMMUTABLE TIMESTAMP LOCKED',
    'DECENTRALIZED NOTARIZATION',
];

// ── Types ──────────────────────────────────────────────────────────────────────

type ForgePhase =
    | 'idle'
    | 'hashing'
    | 'mining'
    | 'solved'
    | 'error'
    | 'sharing';

interface LocalForgeState {
    phase: ForgePhase;
    fileName: string;
    fileSize: number;
    tgtHash: string;
    hashProgress: number;
    currentJobId: string | null;
    result: ForgeJobResult | null;
    errorMsg: string | null;
    proofImage: File | null; // シェア用に錬成した証明画像
}

// ── Sub-components ─────────────────────────────────────────────────────────────

/** 走査線 + スキャンライン エフェクト */
const ScanlineOverlay: React.FC = () => (
    <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-inherit"
        style={{
            backgroundImage:
                'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,170,0.015) 2px, rgba(0,255,170,0.015) 4px)',
            zIndex: 10,
        }}
    />
);

/** グリッチテキストアニメーション */
const GlitchText: React.FC<{ text: string }> = ({ text }) => {
    const [displayText, setDisplayText] = useState(text);
    const [glitching, setGlitching] = useState(false);
    const chars = '!@#$%^&*ABCDEF0123456789';

    useEffect(() => {
        let frame = 0;
        let raf: number;
        const original = text;

        const glitch = () => {
            frame++;
            if (frame < 8) {
                setDisplayText(
                    original
                        .split('')
                        .map((c, i) =>
                            Math.random() < 0.3
                                ? chars[Math.floor(Math.random() * chars.length)]
                                : c,
                        )
                        .join(''),
                );
                raf = requestAnimationFrame(glitch);
            } else {
                setDisplayText(original);
                setGlitching(false);
            }
        };

        setGlitching(true);
        frame = 0;
        raf = requestAnimationFrame(glitch);

        return () => cancelAnimationFrame(raf);
    }, [text]);

    return (
        <span
            className="font-mono text-[#00FFB3] tracking-widest"
            style={{
                textShadow: glitching
                    ? '0 0 8px rgba(0,255,179,0.9), 2px 0 rgba(255,0,0,0.4), -2px 0 rgba(0,0,255,0.4)'
                    : '0 0 6px rgba(0,255,179,0.5)',
                transition: 'text-shadow 0.1s',
            }}
        >
            {displayText}
        </span>
    );
};

/** サイバー進捗バー */
const CyberProgress: React.FC<{ value: number; color?: string }> = ({
    value,
    color = '#00FFB3',
}) => (
    <div className="relative h-2 w-full rounded-full bg-white/5 overflow-hidden">
        <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ backgroundColor: color }}
            initial={{ width: '0%' }}
            animate={{ width: `${Math.min(100, value * 100)}%` }}
            transition={{ ease: 'linear', duration: 0.3 }}
        />
        {/* スキャンライン shimmer */}
        <motion.div
            className="absolute inset-y-0 w-16 rounded-full"
            style={{
                background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)`,
                left: `calc(${value * 100}% - 32px)`,
            }}
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 0.8, repeat: Infinity }}
        />
    </div>
);

/** 完了シール */
const CompletionSeal: React.FC<{ result: ForgeJobResult }> = ({ result }) => (
    <motion.div
        initial={{ scale: 0, rotate: -15 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="flex flex-col items-center gap-3"
    >
        <div
            className="w-24 h-24 rounded-full flex items-center justify-center border-4 border-[#00FFB3]"
            style={{
                background: 'radial-gradient(circle, rgba(0,255,179,0.15) 0%, transparent 70%)',
                boxShadow: '0 0 40px rgba(0,255,179,0.4), 0 0 80px rgba(0,255,179,0.15)',
            }}
        >
            <ShieldCheck className="w-12 h-12 text-[#00FFB3]" />
        </div>
        <p className="text-[#00FFB3] font-mono text-xs tracking-widest uppercase">
            Proof Sealed
        </p>
        <div className="text-center space-y-1">
            <p className="font-mono text-[10px] text-white/40">
                Nonce: <span className="text-white/70">{result.nonce.toLocaleString()}</span>
            </p>
            <p className="font-mono text-[10px] text-white/40">
                Hash:{' '}
                <span className="text-[#00FFB3] break-all text-[9px]">
                    {result.hash.slice(0, 32)}…
                </span>
            </p>
            <p className="font-mono text-[10px] text-white/40">
                Tier: <span className="text-white/70 uppercase">{result.tier}</span>
                {'　'}
                Time:{' '}
                <span className="text-white/70">
                    {(result.elapsedMs / 1000).toFixed(2)}s
                </span>
            </p>
        </div>
    </motion.div>
);

// ── Main Component ─────────────────────────────────────────────────────────────

export const TheatricalForge: React.FC = () => {
    const identityStatus = useShadowIdentity();

    // DOM refs (useState 禁止 — RAF で直書き)
    const hashRateRef = useRef<HTMLSpanElement | null>(null);
    const triedRef = useRef<HTMLSpanElement | null>(null);
    const progressRef = useRef<HTMLSpanElement | null>(null);
    const tierRef = useRef<HTMLSpanElement | null>(null);

    const displayRefs: MinerDisplayRefs = useMemo(
        () => ({ hashRateRef, triedRef, progressRef, tierRef }),
        [],
    );

    const [state, setState] = useState<LocalForgeState>({
        phase: 'idle',
        fileName: '',
        fileSize: 0,
        tgtHash: '',
        hashProgress: 0,
        currentJobId: null,
        result: null,
        errorMsg: null,
        proofImage: null,
    });

    // グリッチフレーズのローテーション
    const [phraseIdx, setPhraseIdx] = useState(0);
    useEffect(() => {
        if (state.phase !== 'mining') return;
        const id = setInterval(() => {
            setPhraseIdx((i) => (i + 1) % GLITCH_PHRASES.length);
        }, 1200);
        return () => clearInterval(id);
    }, [state.phase]);

    // PoW 完了コールバック
    const handleSolved = useCallback((result: ForgeJobResult) => {
        setState((s) => ({ ...s, phase: 'solved', result }));
    }, []);

    // PoW 失敗コールバック
    const handleFailed = useCallback((id: string, error: string) => {
        setState((s) => ({ ...s, phase: 'error', errorMsg: error }));
    }, []);

    const { enqueueJob, cancelAll } = usePowMiner(displayRefs, {
        onSolved: handleSolved,
        onFailed: handleFailed,
    });

    // ファイルドロップ処理
    const processFile = useCallback(
        async (file: File) => {
            if (identityStatus.phase !== 'ready') return;

            setState({
                phase: 'hashing',
                fileName: file.name,
                fileSize: file.size,
                tgtHash: '',
                hashProgress: 0,
                currentJobId: null,
                result: null,
                errorMsg: null,
                proofImage: null,
            });

            try {
                const tgtHash = await computeFileHash(file, {
                    onProgress: (p: HashProgress) => {
                        setState((s) => ({ ...s, hashProgress: p.progress }));
                    },
                });

                const jobId = nanoid();
                const job: ForgeJob = {
                    id: jobId,
                    file,
                    tgtHash,
                    devicePub: identityStatus.identity.devicePub,
                    difficulty: DIFFICULTY,
                };

                setState((s) => ({
                    ...s,
                    phase: 'mining',
                    tgtHash,
                    currentJobId: jobId,
                }));

                enqueueJob(job);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : '不明なエラー';
                setState((s) => ({ ...s, phase: 'error', errorMsg: msg }));
            }
        },
        [identityStatus, enqueueJob],
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: (files) => {
            if (files[0]) {
                if (files[0].size > MAX_FILE_SIZE_BYTES) {
                    setState((s) => ({
                        ...s,
                        phase: 'error',
                        errorMsg: `ファイルサイズが ${MAX_FILE_SIZE_GB}GB を超えています。`,
                    }));
                    return;
                }
                processFile(files[0]);
            }
        },
        multiple: false,
        noClick: state.phase === 'mining' || state.phase === 'hashing',
        noDrag: state.phase === 'mining' || state.phase === 'hashing',
    });

    // ── Share Activation Bridge ────────────────────────────────────────────────
    // Transient Activation が必要なため、ここでは onClick ハンドラに閉じ込める。
    // navigator.share の自動呼び出しは絶対に行わない。
    const handleShareClick = useCallback(async () => {
        if (!state.result) return;

        setState((s) => ({ ...s, phase: 'sharing' }));

        try {
            const shareData: ShareData = {
                title: 'ProofMark 存在証明',
                text: `「${state.fileName}」の存在証明が完了しました。\nHash: ${state.result.hash.slice(0, 16)}…\nProofMark で真正性を暗号的に検証できます。`,
                url: 'https://proofmark.jp',
            };

            // ファイルがあればそれもシェア
            if (state.proofImage && navigator.canShare?.({ files: [state.proofImage] })) {
                Object.assign(shareData, { files: [state.proofImage] });
            }

            if (navigator.share && navigator.canShare?.(shareData)) {
                await navigator.share(shareData);
            } else {
                // Web Share API 非対応環境: クリップボードにコピー
                await navigator.clipboard.writeText(
                    `${shareData.text}\n${shareData.url}`,
                ).catch(() => {
                    // クリップボードも失敗した場合は最低限の通知
                    alert('シェア機能が使えない環境です。URLをコピーしてシェアしてください:\nhttps://proofmark.jp');
                });
            }
        } catch (e: unknown) {
            if (e instanceof DOMException && e.name === 'AbortError') {
                // ユーザーキャンセル — solved に戻す
            } else {
                console.warn('[Forge] Share failed:', e);
            }
        } finally {
            setState((s) => ({ ...s, phase: 'solved' }));
        }
    }, [state]);

    const handleReset = useCallback(() => {
        cancelAll();
        setState({
            phase: 'idle',
            fileName: '',
            fileSize: 0,
            tgtHash: '',
            hashProgress: 0,
            currentJobId: null,
            result: null,
            errorMsg: null,
            proofImage: null,
        });
    }, [cancelAll]);

    // ── Hard Block ─────────────────────────────────────────────────────────────
    if (identityStatus.phase === 'hard-block') {
        return (
            <div className="min-h-screen bg-[#07061A] flex flex-col items-center justify-center p-6 text-center">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="max-w-md w-full bg-red-950/30 border border-red-900/60 rounded-2xl p-8"
                >
                    <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-red-400 mb-3">
                        この環境では鍵を安全に保存できません
                    </h1>
                    <p className="text-sm text-red-300/70 leading-relaxed mb-4">
                        {identityStatus.reason}
                    </p>
                    <p className="text-xs text-white/40">
                        Safari プライベートモードや制限されたストレージ環境では ProofMark は動作できません。
                        通常モードでご利用ください。
                    </p>
                </motion.div>
            </div>
        );
    }

    // ── Main Render ────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] flex flex-col items-center justify-center p-4 relative overflow-hidden font-mono">

            {/* ── Ambient Background ── */}
            <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
                <motion.div
                    className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#6C3EF4] opacity-[0.08] blur-[150px]"
                    animate={{ opacity: [0.06, 0.12, 0.06], scale: [1, 1.05, 1] }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                    className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-[#00FFB3] opacity-[0.06] blur-[150px]"
                    animate={{ opacity: [0.04, 0.10, 0.04], scale: [1, 1.06, 1] }}
                    transition={{ duration: 10, delay: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                />
            </div>

            {/* ── Header ── */}
            <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mb-8 text-center"
            >
                <div className="flex items-center justify-center gap-2 mb-2">
                    <Cpu className="w-5 h-5 text-[#00FFB3]" />
                    <span className="text-[#00FFB3] text-xs tracking-[0.4em] uppercase">
                        ProofMark Forge
                    </span>
                </div>
                <h1 className="text-3xl font-extrabold text-white tracking-tighter">
                    暗号的存在証明を錬成する
                </h1>
                <p className="text-sm text-white/40 mt-2">
                    あなたのデバイスの GPU で、改ざん不能な証拠を生成します。
                </p>
            </motion.div>

            {/* ── Main Card ── */}
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="relative w-full max-w-lg rounded-3xl overflow-hidden"
                style={{
                    background:
                        'linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(7,6,26,0.9) 100%)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow:
                        '0 0 0 1px rgba(255,255,255,0.03) inset, 0 30px 80px -30px rgba(108,62,244,0.4)',
                }}
            >
                <ScanlineOverlay />

                {/* Rainbow top border */}
                <div
                    aria-hidden
                    className="absolute inset-x-8 top-0 h-px"
                    style={{
                        background:
                            'linear-gradient(90deg, transparent, rgba(108,62,244,0.9), rgba(0,255,179,0.9), transparent)',
                    }}
                />

                <div className="relative z-20 p-8">
                    <AnimatePresence mode="wait">

                        {/* ── IDLE: DropZone ── */}
                        {state.phase === 'idle' && (
                            <motion.div
                                key="idle"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                {...(getRootProps() as any)}
                                className={`relative border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors ${
                                    isDragActive
                                        ? 'border-[#00FFB3] bg-[#00FFB3]/5'
                                        : 'border-white/10 hover:border-white/25 hover:bg-white/5'
                                }`}
                            >
                                <input {...getInputProps()} />
                                <motion.div
                                    animate={{ scale: isDragActive ? 1.1 : 1 }}
                                    transition={{ type: 'spring', stiffness: 300 }}
                                    className="w-16 h-16 rounded-full bg-[#00FFB3]/10 border border-[#00FFB3]/30 flex items-center justify-center"
                                >
                                    <Zap className="w-8 h-8 text-[#00FFB3]" />
                                </motion.div>
                                <div className="text-center">
                                    <p className="text-white font-bold">
                                        ファイルをドロップ
                                    </p>
                                    <p className="text-white/40 text-sm mt-1">
                                        または クリックして選択 (最大 {MAX_FILE_SIZE_GB}GB)
                                    </p>
                                </div>
                                {identityStatus.phase === 'loading' && (
                                    <p className="text-[10px] text-white/30 tracking-widest uppercase animate-pulse">
                                        Device Key Initializing…
                                    </p>
                                )}
                            </motion.div>
                        )}

                        {/* ── HASHING ── */}
                        {state.phase === 'hashing' && (
                            <motion.div
                                key="hashing"
                                initial={{ opacity: 0, scale: 0.97 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.97 }}
                                className="space-y-6"
                            >
                                <div className="text-center">
                                    <p className="text-[10px] text-white/40 tracking-[0.35em] uppercase mb-2">
                                        Phase 1 / 2 · SHA-256 Computation
                                    </p>
                                    <GlitchText text="COMPUTING SHA-256 PROOF" />
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between text-xs text-white/40">
                                        <span className="truncate max-w-[200px]">{state.fileName}</span>
                                        <span>
                                            {(state.fileSize / 1024 ** 2).toFixed(1)} MB
                                        </span>
                                    </div>
                                    <CyberProgress value={state.hashProgress} />
                                    <div className="text-right text-xs text-[#00FFB3]">
                                        {(state.hashProgress * 100).toFixed(1)}%
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* ── MINING ── */}
                        {state.phase === 'mining' && (
                            <motion.div
                                key="mining"
                                initial={{ opacity: 0, scale: 0.97 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.97 }}
                                className="space-y-6"
                            >
                                {/* Glitch phrase */}
                                <div className="text-center">
                                    <motion.p
                                        className="text-[10px] text-white/40 tracking-[0.35em] uppercase mb-2"
                                        animate={{ opacity: [0.4, 0.8, 0.4] }}
                                        transition={{ duration: 1.2, repeat: Infinity }}
                                    >
                                        Phase 2 / 2 · Proof-of-Work Mining
                                    </motion.p>
                                    <GlitchText text={GLITCH_PHRASES[phraseIdx]} />
                                </div>

                                {/* GPU animation ring */}
                                <div className="flex justify-center">
                                    <div className="relative w-28 h-28">
                                        <motion.div
                                            className="absolute inset-0 rounded-full border-2 border-[#00FFB3]/30"
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                                        />
                                        <motion.div
                                            className="absolute inset-2 rounded-full border-2 border-[#6C3EF4]/40"
                                            animate={{ rotate: -360 }}
                                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                        />
                                        <motion.div
                                            className="absolute inset-4 rounded-full border-t-2 border-[#00FFB3]"
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Cpu className="w-8 h-8 text-[#00FFB3]" />
                                        </div>
                                        {/* Pulsing outer glow */}
                                        <motion.div
                                            className="absolute -inset-2 rounded-full"
                                            style={{
                                                background:
                                                    'radial-gradient(circle, rgba(0,255,179,0.15) 0%, transparent 70%)',
                                            }}
                                            animate={{ opacity: [0.5, 1, 0.5] }}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                        />
                                    </div>
                                </div>

                                {/* Live stats — DOM 直書き (useState 禁止) */}
                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div className="bg-white/5 rounded-xl p-3">
                                        <p className="text-[9px] text-white/30 tracking-widest uppercase mb-1">
                                            Hash Rate
                                        </p>
                                        <span
                                            ref={hashRateRef}
                                            className="text-sm font-bold text-[#00FFB3]"
                                        >
                                            —
                                        </span>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-3">
                                        <p className="text-[9px] text-white/30 tracking-widest uppercase mb-1">
                                            Tried
                                        </p>
                                        <span
                                            ref={triedRef}
                                            className="text-sm font-bold text-white"
                                        >
                                            0
                                        </span>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-3">
                                        <p className="text-[9px] text-white/30 tracking-widest uppercase mb-1">
                                            Tier
                                        </p>
                                        <span
                                            ref={tierRef}
                                            className="text-sm font-bold text-[#6C3EF4]"
                                        >
                                            —
                                        </span>
                                    </div>
                                </div>

                                <div className="text-center text-[10px] text-white/30 tracking-widest uppercase animate-pulse">
                                    あなたのデバイスの GPU で暗号証拠を錬成中…
                                </div>

                                <button
                                    onClick={handleReset}
                                    className="w-full py-2 rounded-xl text-xs text-white/30 hover:text-white/60 border border-white/10 hover:border-white/20 transition-colors"
                                >
                                    キャンセル
                                </button>
                            </motion.div>
                        )}

                        {/* ── SOLVED: Activation Bridge ── */}
                        {(state.phase === 'solved' || state.phase === 'sharing') &&
                            state.result && (
                                <motion.div
                                    key="solved"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ type: 'spring', stiffness: 180, damping: 18 }}
                                    className="space-y-6 text-center"
                                >
                                    <CompletionSeal result={state.result} />

                                    {/* 🚨 Activation Bridge: 自動shareは禁止。明示的タップのみ */}
                                    <motion.button
                                        initial={{ opacity: 0, y: 16 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.5 }}
                                        onClick={handleShareClick}
                                        disabled={state.phase === 'sharing'}
                                        className="relative w-full py-5 rounded-2xl font-bold text-lg text-[#07061A] overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
                                        style={{
                                            background:
                                                'linear-gradient(135deg, #00FFB3 0%, #00D4AA 50%, #6C3EF4 100%)',
                                            boxShadow:
                                                '0 0 40px rgba(0,255,179,0.35), 0 8px 32px rgba(0,212,170,0.25)',
                                        }}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <span className="relative z-10 flex items-center justify-center gap-2">
                                            <Share2 className="w-5 h-5" />
                                            {state.phase === 'sharing'
                                                ? 'シェアシートを開いています…'
                                                : '証明完了 ：タップして証拠をシェア'}
                                        </span>
                                        {/* Shimmer overlay */}
                                        <motion.div
                                            className="absolute inset-0"
                                            style={{
                                                background:
                                                    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)',
                                            }}
                                            animate={{ x: ['-100%', '200%'] }}
                                            transition={{
                                                duration: 2,
                                                repeat: Infinity,
                                                repeatDelay: 1,
                                                ease: 'easeInOut',
                                            }}
                                        />
                                    </motion.button>

                                    <button
                                        onClick={handleReset}
                                        className="w-full py-2 text-xs text-white/30 hover:text-white/60 border border-white/10 hover:border-white/20 rounded-xl transition-colors"
                                    >
                                        別のファイルを証明する
                                    </button>
                                </motion.div>
                            )}

                        {/* ── ERROR ── */}
                        {state.phase === 'error' && (
                            <motion.div
                                key="error"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="space-y-4 text-center"
                            >
                                <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
                                <p className="text-red-400 font-bold">証明に失敗しました</p>
                                <p className="text-sm text-white/40 break-words">
                                    {state.errorMsg}
                                </p>
                                <button
                                    onClick={handleReset}
                                    className="w-full py-3 rounded-xl text-sm font-bold text-white bg-white/10 hover:bg-white/15 border border-white/15 transition-colors"
                                >
                                    やり直す
                                </button>
                            </motion.div>
                        )}

                    </AnimatePresence>
                </div>
            </motion.div>

            {/* ── Difficulty indicator ── */}
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="mt-4 text-[10px] text-white/20 tracking-widest uppercase"
            >
                PoW Difficulty: {DIFFICULTY} · Ed25519 · SHA-256 · RFC3161
            </motion.p>
        </div>
    );
};

export default TheatricalForge;
