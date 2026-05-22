/**
 * components/VerifyDropzone.tsx
 * ──────────────────────────────────────────────────────────────────
 *  ProofMark — Zero-Knowledge Web Verifier UI
 *
 *  Apple級の静謐さ。Tailwind + framer-motion で実装。
 *  色は #1d1d1f / #f5f5f7 / #ffffff / #00B896 (成功時の緑) のみ。
 *
 *  動作:
 *    - ファイルを dropzone に投げると useVerifier が走る
 *    - すべての処理はブラウザ内 (一切ネットワーク送信なし)
 *    - 成功時は中央にチェック + "VERIFIED" + 発行日時を fade-in
 * ──────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle, Check, FileArchive, Info, Lock, Upload,
} from 'lucide-react';
import { useVerifier } from '@/hooks/useVerifier';
import type { VerifierState } from '@/types/verifier';

const EASE = [0.16, 1, 0.3, 1] as const;

/* ─────────────────────────────────────────────
 *  Top-level component
 * ───────────────────────────────────────────── */

export default function VerifyDropzone(): JSX.Element {
  const { state, verify, reset } = useVerifier();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const reduceMotion = useReducedMotion();

  const handlePick = useCallback(
    async (file: File | null | undefined): Promise<void> => {
      if (!file) return;
      // 大きい ZIP は警告だけ出して継続
      await verify(file);
    },
    [verify],
  );

  /* ファイル選択ダイアログ */
  const openPicker = useCallback((): void => {
    if (state.kind !== 'IDLE' && state.kind !== 'ERROR' && state.kind !== 'SUCCESS') return;
    inputRef.current?.click();
  }, [state.kind]);

  /* drop handler */
  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>): void => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      void handlePick(file);
    },
    [handlePick],
  );

  /* paste 不可・URL 不可 (Zero-Knowledge の物理的保証) */
  useEffect(() => {
    const prevent = (e: ClipboardEvent): void => {
      if ((e.target as HTMLElement)?.closest?.('[data-pm-verify-zone]')) {
        e.preventDefault();
      }
    };
    window.addEventListener('paste', prevent);
    return () => window.removeEventListener('paste', prevent);
  }, []);

  const showOverlay = state.kind === 'SUCCESS' || state.kind === 'ERROR';
  const isBusy =
    state.kind === 'UNZIPPING' ||
    state.kind === 'HASHING' ||
    state.kind === 'VERIFYING_SIGNATURE';

  return (
    <section
      className="relative mx-auto flex w-full max-w-3xl flex-col items-stretch"
      data-pm-verify-zone
    >
      {/* ── Header (extreme minimalism) ── */}
      <header className="mb-10 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#86868b]">
          Zero-Knowledge Web Verifier
        </p>
        <h1 className="mt-3 text-[40px] font-bold leading-[1.05] tracking-[-0.02em] text-[#1d1d1f] sm:text-[52px]">
          このブラウザだけで、
          <br className="hidden sm:block" />
          真正性を確認する。
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-[1.7] text-[#6e6e73]">
          Evidence Pack (ZIP) をここにドロップしてください。ファイルはサーバーへ一切送信されません。
          展開・SHA-256 計算・RFC3161 署名検証はすべてあなたのデバイス内で完結します。
        </p>
      </header>

      {/* ── Dropzone ── */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!isBusy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={openPicker}
        role="button"
        tabIndex={0}
        aria-label="Evidence Pack を選択するドロップゾーン"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
        className={[
          'group relative flex min-h-[340px] cursor-pointer select-none flex-col items-center justify-center',
          'overflow-hidden rounded-3xl border bg-white px-8 text-center',
          'transition-[border-color,box-shadow,transform] duration-300 ease-out',
          dragOver
            ? 'border-[#1d1d1f] shadow-[0_30px_60px_rgba(29,29,31,0.12)] -translate-y-0.5'
            : 'border-[#d2d2d7] shadow-[0_18px_40px_rgba(29,29,31,0.06)]',
          isBusy ? 'cursor-progress' : '',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = ''; // 同一ファイル再選択を許可
            void handlePick(f);
          }}
        />

        {/* idle hero */}
        <AnimatePresence mode="wait">
          {state.kind === 'IDLE' && !isBusy && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="flex flex-col items-center"
            >
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f] transition-transform group-hover:-translate-y-0.5">
                <Upload className="h-7 w-7" />
              </div>
              <p className="text-[19px] font-semibold tracking-tight text-[#1d1d1f]">
                Evidence Pack をここにドロップ
              </p>
              <p className="mt-2 text-[13px] text-[#86868b]">
                またはタップしてファイルを選択 — ZIP 形式
              </p>

              <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-[#e5e5e7] bg-white/80 px-3 py-1.5 text-[11px] font-semibold tracking-[0.16em] text-[#6e6e73] backdrop-blur">
                <Lock className="h-3.5 w-3.5" />
                NO UPLOAD · NO TELEMETRY
              </div>
            </motion.div>
          )}

          {isBusy && <BusyView key="busy" state={state} reduceMotion={!!reduceMotion} />}
        </AnimatePresence>
      </div>

      {/* ── Result overlay (Success / Error) ── */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-white/85 px-6 backdrop-blur-xl"
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              className="relative w-full max-w-xl rounded-3xl border border-[#e5e5e7] bg-white p-10 text-center shadow-[0_30px_80px_rgba(29,29,31,0.18)]"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              {state.kind === 'SUCCESS' && (
                <SuccessPanel state={state} onClose={reset} reduceMotion={!!reduceMotion} />
              )}
              {state.kind === 'ERROR' && (
                <ErrorPanel state={state} onClose={reset} />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-8 flex items-center justify-center gap-2 text-[11px] text-[#86868b]">
        <Info className="h-3.5 w-3.5" />
        本検証はあなたのブラウザの中でのみ行われます。証明データは外部に送信されません。
      </footer>
    </section>
  );
}

/* ─────────────────────────────────────────────
 *  Busy state
 * ───────────────────────────────────────────── */

function BusyView({
  state,
  reduceMotion,
}: {
  state: Extract<VerifierState, { kind: 'UNZIPPING' | 'HASHING' | 'VERIFYING_SIGNATURE' }>;
  reduceMotion: boolean;
}): JSX.Element {
  const phase =
    state.kind === 'UNZIPPING'
      ? { label: 'パッケージを展開しています', sub: 'Unzipping evidence pack…', progress: -1 }
      : state.kind === 'HASHING'
        ? { label: 'SHA-256 を計算しています', sub: `Hashing ${state.fileName}`, progress: state.progress }
        : { label: '電子署名を検証しています', sub: 'Verifying RFC3161 timestamp…', progress: state.progress };

  return (
    <motion.div
      key={state.kind}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="flex w-full max-w-md flex-col items-center"
    >
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-[#e5e5e7] bg-[#f5f5f7]">
        <FileArchive className="h-7 w-7 text-[#1d1d1f]" />
        {!reduceMotion && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.0, 0.5, 0.0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ boxShadow: 'inset 0 0 0 1px rgba(29,29,31,0.18)' }}
          />
        )}
      </div>

      <p className="mt-6 text-[18px] font-semibold tracking-tight text-[#1d1d1f]">
        {phase.label}
      </p>
      <p className="mt-1.5 text-[12px] uppercase tracking-[0.18em] text-[#86868b]">
        {phase.sub}
      </p>

      <div className="mt-6 h-[3px] w-full overflow-hidden rounded-full bg-[#e5e5e7]">
        {phase.progress < 0 ? (
          // 不確定: indeterminate スライド
          <motion.div
            className="h-full w-1/3 rounded-full bg-[#1d1d1f]"
            initial={{ x: '-100%' }}
            animate={{ x: '300%' }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : (
          <motion.div
            className="h-full rounded-full bg-[#1d1d1f]"
            initial={false}
            animate={{ width: `${Math.round(phase.progress * 100)}%` }}
            transition={{ duration: 0.3, ease: EASE }}
          />
        )}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
 *  Success panel
 * ───────────────────────────────────────────── */

function SuccessPanel({
  state,
  onClose,
  reduceMotion,
}: {
  state: Extract<VerifierState, { kind: 'SUCCESS' }>;
  onClose: () => void;
  reduceMotion: boolean;
}): JSX.Element {
  const r = state.result;
  const isPrimary = !!r.isPrimaryProofOnly;

  return (
    <div>
      <motion.div
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-full"
        style={{
          background: 'linear-gradient(180deg, rgba(0,184,150,0.14), rgba(0,184,150,0.04))',
          boxShadow: '0 0 0 1px rgba(0,184,150,0.22), 0 24px 48px rgba(0,184,150,0.18)',
        }}
        initial={{ scale: reduceMotion ? 1 : 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.55, ease: EASE, delay: 0.05 }}
      >
        <motion.span
          initial={{ scale: reduceMotion ? 1 : 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.2 }}
        >
          <Check className="h-10 w-10 text-[#00B896]" strokeWidth={2.5} />
        </motion.span>
      </motion.div>

      <motion.p
        className="mt-7 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#00B896]"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.3 }}
      >
        Verified
      </motion.p>

      <motion.h2
        className="mt-3 text-[26px] font-bold leading-[1.2] tracking-[-0.01em] text-[#1d1d1f] sm:text-[30px]"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE, delay: 0.36 }}
      >
        {isPrimary ? (
          <>
            ProofMark の内部台帳と一致しました。
            <br className="hidden sm:block" />
            <span className="text-[#00B896]">(現在、認定TSAの発行待ちです)</span>
          </>
        ) : (
          <>
            このファイルは {r.timestampJstHuman} から
            <br className="hidden sm:block" />
            1ビットも改ざんされていません。
          </>
        )}
      </motion.h2>

      <motion.dl
        className="mx-auto mt-7 grid w-full max-w-md grid-cols-1 gap-3 text-left text-[12.5px] text-[#1d1d1f]"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE, delay: 0.44 }}
      >
        <KV label="ORIGINAL" value={`${r.originalFileName} · ${formatBytes(r.originalFileSize)}`} />
        <KV
          label="SHA-256"
          value={`${r.computedSha256Hex.slice(0, 32)}…${r.computedSha256Hex.slice(-8)}`}
          mono
        />
        <KV
          label="TSA"
          value={isPrimary ? '— (プロビジョニング中)' : (r.tsaSubject ?? '—')}
        />
        {!isPrimary && r.tsrSerialHex && (
          <KV label="TSR SERIAL" value={r.tsrSerialHex} mono />
        )}
      </motion.dl>

      <motion.button
        type="button"
        onClick={onClose}
        className="mt-9 inline-flex items-center justify-center rounded-full bg-[#1d1d1f] px-8 py-3 text-[13px] font-semibold text-white shadow-[0_12px_28px_rgba(29,29,31,0.18)] transition-transform active:scale-[0.98]"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.55 }}
      >
        別のパッケージを検証する
      </motion.button>

      <p className="mt-5 text-[11px] tracking-[0.04em] text-[#86868b]">
        Verified in {r.durationMs} ms — fully offline.
      </p>
    </div>
  );
}


function KV({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#e5e5e7] bg-[#f5f5f7]/60 px-4 py-3">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#86868b]">
        {label}
      </dt>
      <dd
        className={[
          'truncate text-right',
          mono ? 'font-mono text-[11.5px] text-[#1d1d1f]' : 'text-[12.5px] text-[#1d1d1f]',
        ].join(' ')}
      >
        {value}
      </dd>
    </div>
  );
}

/* ─────────────────────────────────────────────
 *  Error panel
 * ───────────────────────────────────────────── */

function ErrorPanel({
  state,
  onClose,
}: {
  state: Extract<VerifierState, { kind: 'ERROR' }>;
  onClose: () => void;
}): JSX.Element {
  return (
    <div>
      <div
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-full"
        style={{
          background: 'rgba(255,69,58,0.10)',
          boxShadow: '0 0 0 1px rgba(255,69,58,0.22)',
        }}
      >
        <AlertTriangle className="h-10 w-10 text-[#D70015]" strokeWidth={2} />
      </div>

      <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#D70015]">
        Verification failed
      </p>
      <h2 className="mt-3 text-[24px] font-bold leading-[1.25] tracking-[-0.01em] text-[#1d1d1f]">
        {state.message}
      </h2>
      {state.detail ? (
        <p className="mx-auto mt-4 max-w-md break-all text-left font-mono text-[11.5px] leading-relaxed text-[#6e6e73]">
          {state.detail}
        </p>
      ) : null}

      <div className="mt-8 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-[#1d1d1f] px-7 py-3 text-[13px] font-semibold text-white shadow-[0_12px_28px_rgba(29,29,31,0.18)] active:scale-[0.98]"
        >
          別のパッケージを試す
        </button>
        <a
          href="/legal-resources"
          className="text-[12.5px] font-semibold text-[#1d1d1f] underline-offset-4 hover:underline"
        >
          失敗理由ガイドを開く
        </a>
      </div>

      <p className="mt-6 text-[10.5px] uppercase tracking-[0.28em] text-[#86868b]">
        REASON: {state.reason}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────
 *  Helpers
 * ───────────────────────────────────────────── */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
