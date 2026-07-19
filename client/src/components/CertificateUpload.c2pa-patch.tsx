/**
 * CertificateUpload.c2pa-patch.tsx — Phase 10 + Magic Dropzone (改修版)
 *
 * 改修点 (Decoupled & Single Source of Truth 統合):
 * - 単一ファイル（1枚）ドロップ時も、複数ファイル（2枚以上）と同様に ProcessBundleComposer にルーティング。
 * - 旧API (/api/certificates/create) を叩く処理を完全に削除。
 * - 不要になった単一ファイル証明用のUIステート、DeliveryKitModal、usePromoteCertificate を削除。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2, UploadCloud, AlertTriangle, Layers3, X, Zap
} from 'lucide-react';

import { cn } from '../lib/utils';
import { PM, EASE, D } from './dashboard/obsidian-tokens';

import { useAuth } from '../hooks/useAuth';
import { useForge } from '@/hooks/useForge';
import { ProcessBundleComposer } from './proof/ProcessBundleComposer';
import { createPortal } from 'react-dom';

const PAID_TIERS = new Set(['creator', 'studio', 'business', 'light', 'admin']);

/* ─── Chain of Evidence プラン別ファイル上限 ─── */
const CHAIN_LIMIT_CREATOR = 10;   // creator / light
const CHAIN_LIMIT_STUDIO = 150;   // studio / business / admin

/** plan_tier 文字列から Chain of Evidence の最大枚数を導出する。 */
function chainLimitFor(planTier: string): number {
  const t = planTier.toLowerCase();
  if (t === 'studio' || t === 'business' || t === 'admin') return CHAIN_LIMIT_STUDIO;
  if (t === 'creator' || t === 'light') return CHAIN_LIMIT_CREATOR;
  return 0; // Free / Guest — 工程証明は使えない
}

export default function CertificateUpload() {
  const [, setLocation] = useLocation();
  const { state, startForge } = useForge();

  // Obsidian Desk UI States
  const [windowDragActive, setWindowDragActive] = useState(false);
  const [shellError, setShellError] = useState<string | null>(null);

  /* ───────────────────────────────────────────────────────────────
     Magic Dropzone States (Chain of Evidence Routing)
     ─────────────────────────────────────────────────────────────── */
  const [bundleInitialFiles, setBundleInitialFiles] = useState<File[] | null>(null);
  const [chainUpsellOpen, setChainUpsellOpen] = useState(false);

  // グローバルドラッグ検知
  useEffect(() => {
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;
    const onEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) setWindowDragActive(true);
    };
    const onLeave = (e: DragEvent) => {
      if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        setWindowDragActive(false);
      }
    };
    const onDrop = () => setWindowDragActive(false);
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragover', (e) => e.preventDefault());
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const { user, profile } = useAuth();

  // plan_tier の解決順序: profiles.plan_tier を最優先, fallback で metadata.plan_type
  const planTier: string =
    (profile?.plan_tier as string | undefined)?.toLowerCase() ??
    String(user?.user_metadata?.plan_type ?? 'free').toLowerCase();
  const isPaidPlan = PAID_TIERS.has(planTier);
  const chainLimit = chainLimitFor(planTier);
  const canUseChain = !!user && chainLimit > 0;

  /* ═══════════════════════════════════════════════════════════════
     Magic Dropzone: 1枚以上はすべて ProcessBundleComposer へ
     ═══════════════════════════════════════════════════════════════ */
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return;

    // Check if there are accepted MP4/MOV videos to bypass legacy image validation
    const videoFiles = acceptedFiles.filter((f) => {
      const type = f.type.toLowerCase();
      const name = f.name.toLowerCase();
      const isMp4 = type === 'video/mp4' || name.endsWith('.mp4');
      const isMov = type === 'video/quicktime' || name.endsWith('.mov');
      return isMp4 || isMov;
    });

    if (videoFiles.length > 0) {
      // Trigger the Web Worker & WebCodecs pipeline immediately
      startForge(videoFiles[0]);
      return;
    }

    // すべて画像のみで構成する
    const imageOnly = acceptedFiles.filter((f) => f.type.startsWith('image/'));
    if (imageOnly.length === 0) {
      setShellError('証明ファイルは画像専用です。画像ファイルを選択してください。');
      setTimeout(() => setShellError(null), 5000);
      return;
    }
    if (imageOnly.length < acceptedFiles.length) {
      const dropped = acceptedFiles.length - imageOnly.length;
      setShellError(`非画像ファイル ${dropped} 件を除外して証明（工程）を開始します。`);
      setTimeout(() => setShellError(null), 4200);
    }

    // ─── Plan Guard: Free / 未ログインは Chain 不可 ────────────────
    if (!canUseChain) {
      setChainUpsellOpen(true);
      return;
    }

    // ─── Hard Cap: プラン上限を超えたら切り捨て + 警告 ─────────────
    let accepted = imageOnly;
    if (imageOnly.length > chainLimit) {
      accepted = imageOnly.slice(0, chainLimit);
      setShellError(
        `${planTier} プランの上限 ${chainLimit} 枚を超えたため、超過 ${imageOnly.length - chainLimit} 枚を切り捨てて開始します。`
      );
      setTimeout(() => setShellError(null), 6000);
    }

    // ─── Composer をフルスクリーンで起動 ───────────────────────────
    setBundleInitialFiles(accepted);
  }, [canUseChain, chainLimit, planTier, startForge]);

  /* ═══════════════════════════════════════════════════════════════
     useDropzone — Magic Dropzone (multiple: true)
     ═══════════════════════════════════════════════════════════════ */
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: {
      'image/*': [],
      'video/mp4': ['.mp4'],
      'video/quicktime': ['.mov'],
    },
    disabled: state.isForging,
  });

  const computedPhase = shellError ? 'error' : windowDragActive ? 'hover' : 'idle';

  /* ═══════════════════════════════════════════════════════════════
     Chain of Evidence フルスクリーン展開 (1枚以上で起動)
     ═══════════════════════════════════════════════════════════════ */
  if (bundleInitialFiles && bundleInitialFiles.length >= 1) {
    return (
      <ChainOverlay
        initialFiles={bundleInitialFiles}
        onClose={() => setBundleInitialFiles(null)}
      />
    );
  }

  return (
    <div className="relative w-full max-w-3xl mx-auto rounded-[32px] overflow-hidden" style={{ background: PM.surface }}>
      {/* Dimmer (hover時) */}
      <motion.div
        initial={false}
        animate={{ opacity: computedPhase === 'hover' ? 1 : 0 }}
        transition={{ duration: D.fast, ease: EASE }}
        className="pointer-events-none absolute inset-0 z-0 backdrop-blur-[2px]"
        style={{ background: 'rgba(7,6,26,0.55)' }}
      />
      {/* パルスボーダー (hover時) */}
      <motion.div
        initial={false}
        animate={{ opacity: computedPhase === 'hover' ? 1 : 0 }}
        transition={{ duration: D.base, ease: EASE, repeat: Infinity, repeatType: 'reverse' }}
        className="pointer-events-none absolute inset-0 z-0 rounded-[32px] border-[3px]"
        style={{ borderColor: PM.primary }}
      />
      {/* 枠発光 (error時) */}
      <motion.div
        initial={false}
        animate={{ opacity: computedPhase === 'error' ? 1 : 0 }}
        transition={{ duration: D.base, ease: EASE }}
        className="pointer-events-none absolute inset-0 z-0 rounded-[32px] border-2"
        style={{ borderColor: PM.error, boxShadow: `inset 0 0 40px ${PM.errorSoft}` }}
      />

      <div className="relative z-[1] p-6 sm:p-10">
        {shellError && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute top-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
            <div className="flex items-center gap-2 rounded-full px-4 py-2 shadow-2xl backdrop-blur-md" style={{ background: 'rgba(255,69,58,0.15)', border: `1px solid ${PM.errorRing}` }}>
              <AlertTriangle className="w-4 h-4" style={{ color: PM.error }} />
              <span className="text-[13px] font-bold tracking-wide text-white">{shellError}</span>
            </div>
          </motion.div>
        )}

        {/* Chain of Evidence Upsell (Free / 未ログインが複数ファイル投入時) */}
        <AnimatePresence>
          {chainUpsellOpen && (
            <ChainUpsell
              onUpgrade={() => setLocation('/pricing')}
              onDismiss={() => setChainUpsellOpen(false)}
            />
          )}
        </AnimatePresence>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-300 ${isDragActive
            ? 'border-[#00D4AA] bg-[#00D4AA]/10'
            : 'border-slate-700 hover:border-[#6C3EF4] hover:bg-[#15132D]'
            }`}
        >
          <input {...getInputProps()} />
          <IdleHero
            title="証明するファイルをドロップ"
            subtitle={
              canUseChain
                ? `1 枚 = デジタル存在証明 / 2 枚以上 = 工程証明 (最大 ${chainLimit} 枚)`
                : 'ファイルをドロップして証明を発行'
            }
          />
        </div>

        {/* Test Console UI */}
        {(state.isForging || state.cid || state.error || state.stage !== 'idle') && (
          <div className="mt-6 rounded-2xl border border-[#00D4AA]/30 bg-black/60 p-6 backdrop-blur-md shadow-[0_20px_50px_-20px_rgba(0,212,170,0.15)] text-left">
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
              <h4 className="text-sm font-mono font-bold tracking-[0.15em] text-[#00D4AA]">
                [ FORGE INTEGRATION TEST CONSOLE ]
              </h4>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                state.stage === 'uploading' ? 'bg-[#00D4AA]/10 text-[#00D4AA] border border-[#00D4AA]/30' :
                state.stage === 'decoding' ? 'bg-[#BC78FF]/10 text-[#BC78FF] border border-[#BC78FF]/30' :
                state.stage === 'hashing' ? 'bg-[#6C3EF4]/10 text-white border border-[#6C3EF4]/30' :
                'bg-white/5 text-white/40'
              }`}>
                STAGE: {state.stage}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-white/50">PROCESSING PIPELINE</span>
                <span className="text-[#00D4AA] font-bold">{state.progress}%</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-[#6C3EF4] via-[#BC78FF] to-[#00D4AA] transition-all duration-300"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
            </div>

            {/* SHA-256 CID */}
            {state.cid && (
              <div className="rounded-xl bg-[#00D4AA]/5 border border-[#00D4AA]/20 p-3 mb-3">
                <p className="text-[10px] font-mono text-[#00D4AA]/60 uppercase tracking-widest mb-1">
                  COMPUTED SHA-256 CID
                </p>
                <code className="text-xs font-mono text-white select-all break-all">
                  {state.cid}
                </code>
              </div>
            )}

            {/* Error Message */}
            {state.error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                <p className="text-[10px] font-mono text-red-400 uppercase tracking-widest mb-1">
                  RUNTIME ERROR
                </p>
                <p className="text-xs font-mono text-red-500">
                  {state.error}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ChainOverlay — Chain of Evidence をフルスクリーンで展開する薄いラッパ
   ═══════════════════════════════════════════════════════════════════ */

function ChainOverlay({
  initialFiles,
  onClose,
}: {
  initialFiles: File[];
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // SSR回避・Portal用のコンテンツ
  const overlayContent = (
    <div
      className="fixed inset-0 overflow-y-auto"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 2147483647,
        background: 'rgba(7,6,26,0.96)',
        backdropFilter: 'blur(16px)'
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="min-h-full px-4 py-8 md:px-8 md:py-12 relative z-10"
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-[#00D4AA]/10 border border-[#00D4AA]/30">
                <Layers3 className="w-5 h-5 text-[#00D4AA]" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#A8A0D8]/70 font-bold">Chain of Evidence Studio</p>
                <h2 className="text-lg md:text-xl font-black text-white tracking-tight">{initialFiles.length} 工程を時系列に連結する</h2>
              </div>
            </div>
            <button onClick={onClose} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-[#A8A0D8] hover:text-white border border-[#1C1A38] hover:border-[#6C3EF4]/40 rounded-xl transition-all">
              <X className="w-4 h-4" /> 閉じる
            </button>
          </div>
          <ProcessBundleComposer
            certificate={null}
            initialFiles={initialFiles}
            onComplete={() => {}}
          />
        </div>
      </motion.div>
    </div>
  );

  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(overlayContent, document.body);
}

/* ═══════════════════════════════════════════════════════════════════
   ChainUpsell — Free / 未ログイン状態で複数ファイル投入時の案内
   ═══════════════════════════════════════════════════════════════════ */

function ChainUpsell({
  onUpgrade,
  onDismiss,
}: {
  onUpgrade: () => void;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      style={{ background: 'rgba(7,6,26,0.85)', backdropFilter: 'blur(10px)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.22, ease: EASE }}
        className="w-full max-w-md rounded-3xl p-7"
        style={{
          background: '#0a0e27',
          border: `1px solid ${PM.border}`,
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(108,62,244,0.18)', border: '1px solid rgba(108,62,244,0.45)' }}
          >
            <Zap className="w-5 h-5" style={{ color: PM.primary }} />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#A8A0D8]">Creator+ Feature</p>
            <h3 className="text-lg font-black text-white tracking-tight">工程証明（Chain of Evidence）</h3>
          </div>
        </div>

        <p className="text-sm text-[#A8A0D8] leading-relaxed mb-5">
          ファイルのデジタル存在証明、および複数枚の制作工程を時系列に連結する「Chain of Evidence」は
          <strong className="text-white"> Creator プラン以上</strong> の限定機能です。
          AI生成への対抗・人間の制作プロセスそのものを証拠化できます。
        </p>

        <ul className="space-y-2 mb-6 text-xs text-[#A8A0D8]">
          {[
            'Creator: 最大 10 工程まで連結',
            'Studio / Business: 最大 150 工程まで連結',
            '途中工程は WebP 圧縮で容量最適化、完成品はオリジナル画質を保持',
          ].map((it) => (
            <li key={it} className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00D4AA] shrink-0 mt-0.5" />
              <span>{it}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <button
            onClick={onUpgrade}
            className="w-full py-3 rounded-xl font-bold text-sm text-white"
            style={{
              background: `linear-gradient(135deg, ${PM.primary}, ${PM.success})`,
              boxShadow: `0 8px 24px rgba(108,62,244,0.35)`,
            }}
          >
            プランをアップグレード
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-2.5 rounded-xl text-xs font-semibold text-[#A8A0D8] hover:text-white transition-colors"
          >
            キャンセル
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

export function IdleHero({
  title = '証明したいファイルをドロップ',
  subtitle,
  maxSizeMB = 15,
  isMobile = false,
}: {
  title?: string;
  subtitle?: string;
  maxSizeMB?: number;
  isMobile?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none flex flex-col items-center justify-center text-center',
        'rounded-2xl',
        'select-none',
      )}
      style={{ color: PM.textMuted }}
    >
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: D.slow / 1000, ease: EASE }}
        className="flex flex-col items-center gap-3"
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: PM.surface, border: `1px solid ${PM.border}` }}
        >
          <UploadCloud className="w-6 h-6" aria-hidden="true" style={{ color: PM.textMuted }} />
        </div>
        <p
          className={cn(
            'font-semibold tracking-tight',
            isMobile ? 'text-[17px]' : 'text-[18px]',
          )}
          style={{ color: PM.textMain }}
        >
          {title}
        </p>
        <p
          className="text-[12px] tracking-wider"
          style={{ color: PM.textSubtle, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
        >
          {subtitle || `SHA-256 / ${maxSizeMB}MB まで`}
        </p>
      </motion.div>
    </div>
  );
}