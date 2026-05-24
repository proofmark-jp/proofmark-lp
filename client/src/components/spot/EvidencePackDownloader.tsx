/**
 * EvidencePackDownloader.tsx
 * ─────────────────────────────────────────────────────────────
 *  ProofMark Evidence Pack の生成 UI。
 *
 *  3 段階の儀式感:
 *    1. IDLE  — 「証明書を、クライアントに渡せる形で生み出す」CTA
 *    2. GEN   — ステータステキストが滑らかに切替・プログレスバーが伸長
 *    3. DONE  — Teal パルス + ✅ スプリングで完成を祝う
 *
 *  デザイン言語は CertificatePage.tsx と完全同期 (#0D0B24 / Teal / Gold)。
 * ─────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo } from 'react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Layers,
  Loader2,
  Package,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react';

import {
  useEvidencePack,
  type SpotIssueApiResponse,
} from '@/hooks/useEvidencePack';

const PM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* ─────────────────────────────────────────────
 *  Props
 * ───────────────────────────────────────────── */

export interface EvidencePackDownloaderProps {
  /** SpotIssue / CertificatePage から渡される確定 API レスポンス */
  apiData: SpotIssueApiResponse;
  /** 画像なら DataURL (PDF サムネ用)。private なら undefined。 */
  thumbnailDataUrl?: string;
  /** 自動でダウンロードを発火させたい場合 true */
  autoStart?: boolean;
  /** SUCCESS / ERROR を親に通知 (任意) */
  onComplete?: (status: 'success' | 'error') => void;
}

/* ─────────────────────────────────────────────
 *  Component
 * ───────────────────────────────────────────── */

export default function EvidencePackDownloader({
  apiData,
  thumbnailDataUrl,
  autoStart = false,
  onComplete,
}: EvidencePackDownloaderProps): JSX.Element {
  const { state, generatePack, reset, redownload } = useEvidencePack();
  const reduce = useReducedMotion() ?? false;

  /* autoStart */
  useEffect(() => {
    if (autoStart && state.status === 'idle') {
      void generatePack(apiData, thumbnailDataUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 完了通知 */
  useEffect(() => {
    if (state.status === 'success') onComplete?.('success');
    if (state.status === 'error') onComplete?.('error');
  }, [state.status, onComplete]);

  const stepIndex = useMemo<number>(() => {
    switch (state.status) {
      case 'generating_certificate':
        return 1;
      case 'generating_cover_letter':
        return 2;
      case 'packing_zip':
        return 3;
      default:
        return 0;
    }
  }, [state.status]);

  const isGenerating = stepIndex > 0;

  /* ─────────────────────────────────────────────
   *  IDLE
   * ───────────────────────────────────────────── */
  if (state.status === 'idle') {
    return (
      <Shell>
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{
              background: 'rgba(108,62,244,0.10)',
              border: '1px solid rgba(108,62,244,0.30)',
            }}
          >
            <Package className="h-6 w-6" style={{ color: '#BC78FF' }} />
          </div>
          <div className="min-w-0">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.26em]"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              Evidence Pack
            </p>
            <p className="text-base font-bold text-white">
              クライアントに渡せる、完全な証明パッケージ
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void generatePack(apiData, thumbnailDataUrl)}
          className="group mt-5 inline-flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 font-bold text-white"
          style={{
            background: 'linear-gradient(135deg, #6C3EF4 0%, #00D4AA 100%)',
            boxShadow:
              '0 14px 32px rgba(108,62,244,0.42), 0 0 0 1px rgba(255,255,255,0.06) inset',
          }}
        >
          <span className="flex flex-col text-left leading-tight">
            <span className="flex items-center gap-2 text-[15px]">
              <Download className="h-4 w-4" />
              Evidence Pack をダウンロード
            </span>
            <span className="text-[11px] font-medium text-white/72">
              証明書PDF · カバーレター · TSR · 検証スクリプト一式
            </span>
          </span>
          <Sparkles className="h-5 w-5" />
        </button>

        <ManifestRow muted />
      </Shell>
    );
  }

  /* ─────────────────────────────────────────────
   *  ERROR
   * ───────────────────────────────────────────── */
  if (state.status === 'error') {
    return (
      <Shell
        borderColor="rgba(255,69,58,0.32)"
        glow="0 0 36px rgba(255,69,58,0.16), 0 0 0 1px rgba(255,69,58,0.18) inset"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(255,69,58,0.10)' }}
          >
            <AlertTriangle className="h-6 w-6" style={{ color: '#FF453A' }} />
          </div>
          <div className="min-w-0">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.26em]"
              style={{ color: '#FF453A' }}
            >
              Generation Failed
            </p>
            <p className="text-base font-bold text-white">
              Evidence Pack を生成できませんでした
            </p>
            {state.errorMessage ? (
              <p
                className="mt-1 text-[12px]"
                style={{ color: 'rgba(255,255,255,0.55)' }}
              >
                {state.errorMessage}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              reset();
              void generatePack(apiData, thumbnailDataUrl);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, #6C3EF4 0%, #8B61FF 100%)',
            }}
          >
            <Loader2 className="h-4 w-4" />
            再試行する
          </button>
        </div>
      </Shell>
    );
  }

  /* ─────────────────────────────────────────────
   *  GENERATING
   * ───────────────────────────────────────────── */
  if (isGenerating) {
    return (
      <Shell>
        <div className="flex items-center gap-4">
          <motion.div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background: 'rgba(0,212,170,0.12)',
              border: '1px solid rgba(0,212,170,0.32)',
            }}
            animate={
              reduce ? {} : { rotate: 360 }
            }
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            <Layers className="h-6 w-6" style={{ color: '#00D4AA' }} />
          </motion.div>
          <div className="min-w-0 flex-1">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.26em]"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              Sealing in progress
            </p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={state.statusText}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: PM_EASE }}
                className="text-[16px] font-bold text-white"
              >
                {state.statusText}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* progress */}
        <div className="mt-6">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #6C3EF4 0%, #00D4AA 100%)',
                boxShadow: '0 0 16px rgba(0,212,170,0.55)',
              }}
              animate={{ width: `${state.progress}%` }}
              transition={{ duration: 0.6, ease: PM_EASE }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span
              className="text-[11.5px] font-semibold"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              ステップ {stepIndex} / 3
            </span>
            <span
              className="font-mono text-[11.5px]"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              {state.progress}%
            </span>
          </div>
        </div>

        {/* step rail */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          <StepDot active={stepIndex >= 1} done={stepIndex > 1} label="Certificate" />
          <StepDot active={stepIndex >= 2} done={stepIndex > 2} label="Cover Letter" />
          <StepDot active={stepIndex >= 3} done={false} label="Sealing ZIP" />
        </div>
      </Shell>
    );
  }

  /* ─────────────────────────────────────────────
   *  SUCCESS
   * ───────────────────────────────────────────── */
  return (
    <SuccessShell reduce={reduce}>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: 'spring',
          stiffness: 320,
          damping: 22,
          delay: 0.08,
        }}
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,212,170,0.18), rgba(0,212,170,0.06))',
          boxShadow:
            '0 0 0 1px rgba(0,212,170,0.42), 0 18px 38px rgba(0,212,170,0.24)',
        }}
      >
        <CheckCircle2
          className="h-8 w-8"
          style={{ color: '#00D4AA' }}
          strokeWidth={2.6}
        />
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.18, ease: PM_EASE }}
        className="mt-5 text-center text-[11px] font-bold uppercase tracking-[0.30em]"
        style={{ color: '#00D4AA' }}
      >
        Sealed & Delivered
      </motion.p>

      <motion.h3
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.24, ease: PM_EASE }}
        className="mt-2 text-center text-[20px] font-extrabold text-white sm:text-[22px]"
        style={{ letterSpacing: '-0.01em' }}
      >
        Evidence Pack が完成しました
      </motion.h3>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.32, ease: PM_EASE }}
        className="mx-auto mt-5 max-w-md rounded-2xl border p-4"
        style={{
          borderColor: 'rgba(255,255,255,0.10)',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <p
          className="mb-3 text-[10px] font-bold uppercase tracking-[0.26em]"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          同梱物
        </p>
        <ManifestList />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.42, ease: PM_EASE }}
        className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3"
      >
        <button
          type="button"
          onClick={() => {
            document.getElementById('verify-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold text-[#0D0B24] transition-transform hover:scale-[1.02]"
          style={{
            background: '#00D4AA',
            boxShadow: '0 8px 24px rgba(0,212,170,0.32)',
          }}
        >
          <ShieldCheck className="h-4 w-4" />
          クライアントの検証を体験する
        </button>

        <button
          type="button"
          onClick={redownload}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl border px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-white/[0.04]"
          style={{
            borderColor: 'rgba(255,255,255,0.16)',
            background: 'transparent',
          }}
        >
          <Download className="h-4 w-4" />
          再ダウンロード
        </button>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45, delay: 0.55 }}
        className="mt-4 text-center text-[11.5px]"
        style={{ color: 'rgba(255,255,255,0.55)' }}
      >
        クライアントにこのZIPをそのまま送付してください。<br />
        内容の説明は同梱の Cover_Letter.pdf に記載されています。
      </motion.p>
    </SuccessShell>
  );
}

/* ─────────────────────────────────────────────
 *  Shells
 * ───────────────────────────────────────────── */

function Shell({
  children,
  borderColor,
  glow,
}: {
  children: React.ReactNode;
  borderColor?: string;
  glow?: string;
}): JSX.Element {
  return (
    <div
      className="relative w-full rounded-[28px] border p-6 sm:p-7"
      style={{
        background: '#0D0B24',
        borderColor: borderColor ?? '#1C1A38',
        boxShadow:
          glow ??
          '0 0 0 1px rgba(255,255,255,0.04) inset, 0 24px 60px rgba(0,0,0,0.42)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
        <div
          className="absolute -top-24 -left-24 h-72 w-72 rounded-full opacity-10 blur-[80px]"
          style={{ background: '#6C3EF4' }}
        />
        <div
          className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full opacity-10 blur-[80px]"
          style={{ background: '#00D4AA' }}
        />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function SuccessShell({
  children,
  reduce,
}: {
  children: React.ReactNode;
  reduce: boolean;
}): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={
        reduce
          ? { opacity: 1, y: 0 }
          : {
              opacity: 1,
              y: 0,
              boxShadow: [
                '0 0 0 0 rgba(0,212,170,0)',
                '0 0 0 22px rgba(0,212,170,0.22)',
                '0 0 0 44px rgba(0,212,170,0)',
              ],
            }
      }
      transition={{
        opacity: { duration: 0.35, ease: PM_EASE },
        y: { duration: 0.45, ease: PM_EASE },
        boxShadow: { duration: 1.1, ease: PM_EASE, delay: 0.12 },
      }}
      className="relative w-full rounded-[28px] border p-6 sm:p-8"
      style={{
        background: '#0D0B24',
        borderColor: 'rgba(0,212,170,0.32)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
        <div
          className="absolute -top-24 -left-24 h-72 w-72 rounded-full opacity-10 blur-[80px]"
          style={{ background: '#6C3EF4' }}
        />
        <div
          className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full opacity-12 blur-[90px]"
          style={{ background: '#00D4AA' }}
        />
      </div>
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
 *  Pieces
 * ───────────────────────────────────────────── */

function StepDot({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}): JSX.Element {
  const color = done ? '#00D4AA' : active ? '#BC78FF' : 'rgba(255,255,255,0.22)';
  return (
    <div className="flex flex-col items-start gap-1.5">
      <div
        className="h-1.5 w-full rounded-full"
        style={{
          background: color,
          boxShadow: active && !done ? '0 0 14px rgba(108,62,244,0.55)' : 'none',
          transition: 'background 240ms, box-shadow 240ms',
        }}
      />
      <span
        className="text-[10px] font-bold uppercase tracking-[0.22em]"
        style={{ color: done || active ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.32)' }}
      >
        {label}
      </span>
    </div>
  );
}

function ManifestRow({ muted = false }: { muted?: boolean }): JSX.Element {
  return (
    <div
      className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px]"
      style={{ color: muted ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.62)' }}
    >
      <span className="inline-flex items-center gap-1.5">
        <FileText className="h-3.5 w-3.5" style={{ color: '#00D4AA' }} />
        Certificate.pdf
      </span>
      <span className="inline-flex items-center gap-1.5">
        <FileText className="h-3.5 w-3.5" style={{ color: '#BC78FF' }} />
        Cover Letter.pdf
      </span>
      <span className="inline-flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5" style={{ color: '#F0BB38' }} />
        TIMESTAMP.tsr
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Terminal className="h-3.5 w-3.5" style={{ color: 'rgba(255,255,255,0.62)' }} />
        verify.sh / .py
      </span>
      <span className="inline-flex items-center gap-1.5">
        <FileText className="h-3.5 w-3.5" style={{ color: 'rgba(255,255,255,0.62)' }} />
        HOW_TO_VERIFY.txt
      </span>
    </div>
  );
}

function ManifestList(): JSX.Element {
  const rows: ReadonlyArray<{
    icon: React.ReactNode;
    title: string;
    note: string;
  }> = [
    {
      icon: <FileText className="h-4 w-4" style={{ color: '#BC78FF' }} />,
      title: '01_Cover_Letter.pdf',
      note: 'クライアントへの説明書 (受領時の安心)',
    },
    {
      icon: <FileText className="h-4 w-4" style={{ color: '#00D4AA' }} />,
      title: '02_Certificate_of_Authenticity.pdf',
      note: '美術品レベルの真正証明書 (印刷・提出用)',
    },
    {
      icon: <FileText className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.78)' }} />,
      title: '03_HOW_TO_VERIFY.txt',
      note: '検証手順書 (クライアント向け1分ガイド)',
    },
    {
      icon: <ShieldCheck className="h-4 w-4" style={{ color: '#F0BB38' }} />,
      title: '04_TIMESTAMP.tsr',
      note: 'RFC3161 タイムスタンプ生バイナリ',
    },
    {
      icon: <Terminal className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.78)' }} />,
      title: '05_verify.sh / 06_verify.py',
      note: 'OpenSSL ベースの独立検証スクリプト',
    },
  ];

  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li
          key={r.title}
          className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
          style={{
            borderColor: 'rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <span
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            {r.icon}
          </span>
          <div className="min-w-0">
            <p className="truncate font-mono text-[12.5px] font-semibold text-white">
              {r.title}
            </p>
            <p
              className="text-[11px]"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              {r.note}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
