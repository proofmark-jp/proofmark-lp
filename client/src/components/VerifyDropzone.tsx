/**
 * components/VerifyDropzone.tsx — God Mode "Optical Scanner"
 * ──────────────────────────────────────────────────────────────────
 *  Frosted-glass optical scanner inside the ProofMark dark universe.
 *  No more disruptive white background — this is a sealed instrument
 *  panel that lives natively in #07061A.
 *
 *  Colors: Proof Teal (#00D4AA), Identity Purple (#6C3EF4), Void Black.
 *  All verifier logic, hooks, states and props are 100% unchanged.
 * ──────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle, Check, FileArchive, Info, Lock, Scan, Upload,
} from 'lucide-react';
import { useVerifier } from '@/hooks/useVerifier';
import type { VerifierState } from '@/types/verifier';

const EASE = [0.16, 1, 0.3, 1] as const;

/* ─────────────────────────────────────────────
 *  Top-level component
 * ───────────────────────────────────────────── */

export default function VerifyDropzone(): JSX.Element {
  const { state, verify, reset, resumeWithOriginal } = useVerifier();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const reduceMotion = useReducedMotion();

  const handleFiles = useCallback(
    async (files: FileList | File[]): Promise<void> => {
      const arr = Array.from(files);
      if (arr.length === 0) return;

      if (state.kind === 'AWAITING_ORIGINAL') {
        await resumeWithOriginal(arr[0]);
        return;
      }

      const zip = arr.find((f) => f.name.endsWith('.zip') || f.type === 'application/zip');
      if (!zip) return;
      const other = arr.find((f) => f !== zip);
      await verify(zip, other);
    },
    [state.kind, verify, resumeWithOriginal],
  );

  const openPicker = useCallback((): void => {
    if (
      state.kind !== 'IDLE' &&
      state.kind !== 'ERROR' &&
      state.kind !== 'SUCCESS' &&
      state.kind !== 'AWAITING_ORIGINAL'
    ) return;
    inputRef.current?.click();
  }, [state.kind]);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>): void => {
      e.preventDefault();
      setDragOver(false);
      void handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

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
  const isAwaiting = state.kind === 'AWAITING_ORIGINAL';
  const isBusy =
    state.kind === 'UNZIPPING' ||
    state.kind === 'HASHING' ||
    state.kind === 'VERIFYING_SIGNATURE';

  return (
    <section
      className="relative mx-auto flex w-full max-w-3xl flex-col items-stretch"
      data-pm-verify-zone
    >
      {/* ─────── outer aura ─────── */}
      <div aria-hidden className="pointer-events-none absolute -inset-10 -z-10 overflow-hidden">
        <motion.div
          className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-[#00D4AA]/10 blur-[120px]"
          animate={reduceMotion ? undefined : { opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-24 -right-24 w-[420px] h-[420px] rounded-full bg-[#6C3EF4]/12 blur-[120px]"
          animate={reduceMotion ? undefined : { opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 7, delay: 0.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* ─────── Header ─────── */}
      <header className="mb-10 text-center">
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, ease: EASE }}
          className="inline-flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.32em] text-[#00D4AA]"
        >
          <Scan className="h-3 w-3" />
          Zero-Knowledge Web Verifier
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
          className="mt-4 text-[36px] sm:text-[48px] font-extrabold leading-[1.05] tracking-[-0.02em] text-white"
        >
          このブラウザだけで、
          <br className="hidden sm:block" />
          真正性を
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(90deg, #00D4AA 0%, #6C3EF4 100%)' }}
          >
            光学的に
          </span>
          確認する。
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
          className="mx-auto mt-5 max-w-xl text-[14.5px] leading-[1.75] text-[#A8A0D8]"
        >
          Evidence Pack (ZIP) をここにドロップしてください。ファイルはサーバーへ一切送信されません。
          展開・SHA-256 計算・RFC3161 署名検証は、すべてあなたのデバイス内の光学スキャナーで完結します。
        </motion.p>
      </header>

      {/* ─────── Optical Scanner Dropzone ─────── */}
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
          'group relative flex min-h-[360px] cursor-pointer select-none flex-col items-center justify-center',
          'overflow-hidden rounded-3xl px-8 text-center',
          'transition-[border-color,box-shadow,transform,background] duration-500 ease-out',
          isBusy ? 'cursor-progress' : '',
        ].join(' ')}
        style={{
          background:
            'linear-gradient(165deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.012) 55%, rgba(0,0,0,0.4) 100%)',
          border: `1px solid ${dragOver ? 'rgba(0,212,170,0.7)' : 'rgba(255,255,255,0.10)'}`,
          backdropFilter: 'blur(20px)',
          boxShadow: dragOver
            ? '0 0 0 1px rgba(0,212,170,0.55) inset, 0 0 60px rgba(0,212,170,0.35), 0 30px 80px -30px rgba(0,212,170,0.45)'
            : '0 0 0 1px rgba(255,255,255,0.04) inset, 0 30px 70px -40px rgba(0,0,0,0.8)',
          transform: dragOver ? 'translateY(-2px)' : 'translateY(0)',
        }}
      >
        {/* corner brackets */}
        <CornerBracket pos="tl" />
        <CornerBracket pos="tr" />
        <CornerBracket pos="bl" />
        <CornerBracket pos="br" />

        {/* scanline */}
        {!reduceMotion && (
          <motion.div
            aria-hidden
            className="absolute inset-x-0 h-24 pointer-events-none"
            style={{
              background:
                'linear-gradient(180deg, transparent 0%, rgba(0,212,170,0.18) 50%, transparent 100%)',
              filter: 'blur(2px)',
            }}
            initial={{ y: '-100%' }}
            animate={{ y: ['-100%', '420%'] }}
            transition={{
              duration: 3.4,
              repeat: Infinity,
              ease: 'linear',
              repeatDelay: 0.4,
            }}
          />
        )}

        {/* fine grid */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(0deg, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
          }}
        />

        {/* drag glow halo */}
        <AnimatePresence>
          {dragOver && !isBusy && (
            <motion.div
              aria-hidden
              key="drag-halo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 pointer-events-none rounded-3xl"
              style={{
                background:
                  'radial-gradient(circle at 50% 50%, rgba(0,212,170,0.22) 0%, transparent 65%)',
              }}
            />
          )}
        </AnimatePresence>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={state.kind === 'AWAITING_ORIGINAL' ? '*/*' : '.zip,application/zip'}
          className="sr-only"
          onChange={(e) => {
            const files = e.target.files;
            e.target.value = '';
            if (files && files.length > 0) void handleFiles(files);
          }}
        />

        <AnimatePresence mode="wait">
          {state.kind === 'IDLE' && !isBusy && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="flex flex-col items-center relative"
            >
              {/* Scanner aperture */}
              <motion.div
                className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-2xl"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(0,212,170,0.12), rgba(0,212,170,0.02))',
                  border: '1px solid rgba(0,212,170,0.35)',
                  boxShadow:
                    '0 0 0 1px rgba(255,255,255,0.04) inset, 0 12px 32px -8px rgba(0,212,170,0.45)',
                }}
                animate={
                  reduceMotion || dragOver
                    ? undefined
                    : {
                        boxShadow: [
                          '0 0 0 1px rgba(255,255,255,0.04) inset, 0 12px 32px -8px rgba(0,212,170,0.45)',
                          '0 0 0 1px rgba(255,255,255,0.06) inset, 0 16px 44px -8px rgba(0,212,170,0.65)',
                          '0 0 0 1px rgba(255,255,255,0.04) inset, 0 12px 32px -8px rgba(0,212,170,0.45)',
                        ],
                      }
                }
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                {/* rotating dashed orbit */}
                {!reduceMotion && (
                  <motion.div
                    aria-hidden
                    className="absolute -inset-2 rounded-2xl"
                    style={{ border: '1px dashed rgba(0,212,170,0.35)' }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                  />
                )}
                <Upload className="h-8 w-8 text-[#00D4AA]" strokeWidth={1.6} />
              </motion.div>

              <p className="text-[19px] font-semibold tracking-tight text-white">
                Evidence Pack と 原本ファイル をここにドロップ
              </p>
              <p className="mt-2 text-[12.5px] text-[#A8A0D8] font-mono uppercase tracking-[0.18em]">
                or tap to select — ZIP format
              </p>

              <div className="mt-7 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[10.5px] font-mono font-semibold tracking-[0.22em] text-[#00D4AA]"
                style={{
                  background: 'rgba(0,212,170,0.08)',
                  border: '1px solid rgba(0,212,170,0.30)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <Lock className="h-3 w-3" />
                NO UPLOAD · NO TELEMETRY
              </div>
            </motion.div>
          )}

          {isBusy && <BusyView key="busy" state={state} reduceMotion={!!reduceMotion} />}

          {isAwaiting && state.kind === 'AWAITING_ORIGINAL' && (
            <AwaitingOriginalView key="awaiting" archiveName={state.archiveName} reduceMotion={!!reduceMotion} />
          )}
        </AnimatePresence>

        {/* Bottom status rail */}
        <div
          className="absolute inset-x-0 bottom-0 flex items-center justify-between px-5 py-2 text-[9.5px] font-mono uppercase tracking-[0.22em]"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(0,0,0,0.18)',
            color: 'rgba(168,160,216,0.65)',
          }}
        >
          <span className="flex items-center gap-1.5">
            <motion.span
              className="inline-block h-1.5 w-1.5 rounded-full bg-[#00D4AA]"
              animate={reduceMotion ? undefined : { opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{ boxShadow: '0 0 8px #00D4AA' }}
            />
            scanner · ready
          </span>
          <span className="hidden sm:inline">sha-256 · rfc 3161 · pkijs</span>
        </div>
      </div>

      {/* ─────── Result overlay ─────── */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="fixed inset-0 z-50 flex items-center justify-center px-6"
            style={{
              background: 'rgba(7,6,26,0.78)',
              backdropFilter: 'blur(22px)',
            }}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              className="relative w-full max-w-xl rounded-3xl p-10 text-center"
              style={{
                background:
                  'linear-gradient(165deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.012) 60%, rgba(0,0,0,0.5) 100%)',
                border: '1px solid rgba(255,255,255,0.10)',
                boxShadow:
                  '0 40px 100px -30px rgba(0,212,170,0.45), 0 0 0 1px rgba(255,255,255,0.04) inset',
                backdropFilter: 'blur(20px)',
              }}
              initial={{ opacity: 0, y: 28, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.97 }}
              transition={{ duration: 0.5, ease: EASE }}
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

      <footer className="mt-8 flex items-center justify-center gap-2 text-[11px] text-[#A8A0D8] font-mono uppercase tracking-[0.22em]">
        <Info className="h-3.5 w-3.5 text-[#00D4AA]" />
        本検証はブラウザ内のみで完結 · 証明データは外部へ送信されません
      </footer>
    </section>
  );
}

function CornerBracket({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const base = 'absolute w-5 h-5 pointer-events-none';
  let cls = base;
  if (pos === 'tl') cls += ' top-3 left-3 border-t border-l';
  if (pos === 'tr') cls += ' top-3 right-3 border-t border-r';
  if (pos === 'bl') cls += ' bottom-9 left-3 border-b border-l';
  if (pos === 'br') cls += ' bottom-9 right-3 border-b border-r';
  return <div className={cls} style={{ borderColor: 'rgba(0,212,170,0.45)' }} />;
}

/* ─────────────────────────────────────────────
 *  Awaiting Original panel
 * ───────────────────────────────────────────── */

function AwaitingOriginalView({
  archiveName,
  reduceMotion,
}: {
  archiveName: string;
  reduceMotion: boolean;
}): JSX.Element {
  return (
    <motion.div
      key="awaiting"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="flex w-full max-w-sm flex-col items-center"
    >
      <motion.div
        className="relative flex h-20 w-20 items-center justify-center rounded-2xl"
        style={{
          background: 'linear-gradient(180deg, rgba(108,62,244,0.14), rgba(108,62,244,0.02))',
          border: '1px solid rgba(108,62,244,0.40)',
          boxShadow: '0 12px 32px -8px rgba(108,62,244,0.45)',
        }}
        animate={
          reduceMotion
            ? undefined
            : {
                boxShadow: [
                  '0 0 0 1px rgba(108,62,244,0.30), 0 12px 32px -8px rgba(108,62,244,0.45)',
                  '0 0 0 1px rgba(108,62,244,0.55), 0 18px 44px -8px rgba(108,62,244,0.70)',
                  '0 0 0 1px rgba(108,62,244,0.30), 0 12px 32px -8px rgba(108,62,244,0.45)',
                ],
              }
        }
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Lock className="h-8 w-8 text-[#BC78FF]" strokeWidth={1.5} />
      </motion.div>

      <p className="mt-6 text-[10.5px] font-mono font-semibold uppercase tracking-[0.32em] text-[#BC78FF]">
        Zero-Knowledge Package
      </p>
      <p className="mt-3 text-[18px] font-semibold leading-[1.35] tracking-tight text-white">
        Zero-Knowledge パッケージを展開しました
      </p>
      <p className="mt-3 text-[13px] leading-[1.7] text-[#A8A0D8]">
        このパックには原本ファイルが含まれていません。<br />
        検証を完了させるため、<strong className="text-white font-semibold">お手元の原本ファイル</strong>をここにドロップしてください。
      </p>

      <p className="mt-5 text-[10.5px] font-mono uppercase tracking-[0.22em] text-[#A8A0D8]/70">
        {archiveName} を展開済み — ファイルはサーバーへ送信されません
      </p>
    </motion.div>
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
      ? { label: 'パッケージを展開しています', sub: 'unzipping evidence pack...', progress: -1 }
      : state.kind === 'HASHING'
        ? { label: 'SHA-256 を計算しています', sub: `hashing ${state.fileName}`, progress: state.progress }
        : { label: '電子署名を検証しています', sub: 'verifying rfc3161 timestamp...', progress: state.progress };

  return (
    <motion.div
      key={state.kind}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="flex w-full max-w-md flex-col items-center"
    >
      <div
        className="relative flex h-20 w-20 items-center justify-center rounded-2xl"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,212,170,0.10), rgba(0,212,170,0.02))',
          border: '1px solid rgba(0,212,170,0.40)',
          boxShadow: '0 12px 32px -8px rgba(0,212,170,0.45)',
        }}
      >
        <FileArchive className="h-8 w-8 text-[#00D4AA]" />
        {!reduceMotion && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ boxShadow: 'inset 0 0 0 1px rgba(0,212,170,0.6)' }}
          />
        )}
      </div>

      <p className="mt-6 text-[18px] font-semibold tracking-tight text-white">
        {phase.label}
      </p>
      <p className="mt-1.5 text-[11px] font-mono uppercase tracking-[0.22em] text-[#00D4AA]/85">
        {phase.sub}
      </p>

      <div className="mt-6 h-[3px] w-full overflow-hidden rounded-full"
        style={{ background: 'rgba(255,255,255,0.08)' }}
      >
        {phase.progress < 0 ? (
          <motion.div
            className="h-full w-1/3 rounded-full"
            style={{
              background: 'linear-gradient(90deg, #00D4AA, #6C3EF4)',
              boxShadow: '0 0 12px rgba(0,212,170,0.6)',
            }}
            initial={{ x: '-100%' }}
            animate={{ x: '300%' }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : (
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #00D4AA, #6C3EF4)',
              boxShadow: '0 0 12px rgba(0,212,170,0.6)',
            }}
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
        className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full"
        style={{
          background: 'linear-gradient(180deg, rgba(0,212,170,0.20), rgba(0,212,170,0.04))',
          boxShadow: '0 0 0 1px rgba(0,212,170,0.45), 0 24px 60px rgba(0,212,170,0.4)',
        }}
        initial={{ scale: reduceMotion ? 1 : 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 360, damping: 18, delay: 0.05 }}
      >
        {!reduceMotion && (
          <>
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{ border: '2px solid rgba(0,212,170,0.6)' }}
              initial={{ scale: 1, opacity: 0.7 }}
              animate={{ scale: 1.9, opacity: 0 }}
              transition={{ duration: 0.95, delay: 0.15, ease: 'easeOut' }}
            />
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{ border: '2px solid rgba(0,212,170,0.4)' }}
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 2.6, opacity: 0 }}
              transition={{ duration: 1.2, delay: 0.3, ease: 'easeOut' }}
            />
          </>
        )}
        <motion.span
          initial={{ scale: reduceMotion ? 1 : 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.22 }}
        >
          <Check className="h-12 w-12 text-[#00D4AA]" strokeWidth={2.8} />
        </motion.span>
      </motion.div>

      <motion.p
        className="mt-7 text-[10.5px] font-mono font-bold uppercase tracking-[0.32em] text-[#00D4AA]"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.36 }}
      >
        ✓ Verified — Cryptographically Sealed
      </motion.p>

      <motion.h2
        className="mt-3 text-[24px] sm:text-[28px] font-bold leading-[1.25] tracking-[-0.01em] text-white"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE, delay: 0.42 }}
      >
        {isPrimary ? (
          <>
            ProofMark の内部台帳と一致しました。
            <br className="hidden sm:block" />
            <span className="text-[#00D4AA]">(現在、認定TSAの発行待ちです)</span>
          </>
        ) : (
          <>
            このファイルは {r.timestampJstHuman} から
            <br className="hidden sm:block" />
            <span className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(90deg, #00D4AA, #6C3EF4)' }}
            >
              1ビットも改ざんされていません。
            </span>
          </>
        )}
      </motion.h2>

      <motion.dl
        className="mx-auto mt-7 grid w-full max-w-md grid-cols-1 gap-2.5 text-left text-[12.5px]"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.5 }}
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
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
        className="mt-9 inline-flex items-center justify-center rounded-full px-8 py-3 text-[13px] font-semibold text-white"
        style={{
          background: 'linear-gradient(135deg, #00D4AA 0%, #6C3EF4 100%)',
          boxShadow: '0 14px 36px -10px rgba(0,212,170,0.6)',
        }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE, delay: 0.6 }}
      >
        別のパッケージを検証する
      </motion.button>

      <p className="mt-5 text-[10.5px] font-mono uppercase tracking-[0.22em] text-[#A8A0D8]/70">
        Verified in {r.durationMs} ms — fully offline
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
    <div
      className="flex items-center justify-between gap-4 rounded-2xl px-4 py-3"
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <dt className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-[#A8A0D8]">
        {label}
      </dt>
      <dd
        className={[
          'truncate text-right',
          mono ? 'font-mono text-[11.5px] text-[#00D4AA]' : 'text-[12.5px] text-white',
        ].join(' ')}
        style={{ fontVariantNumeric: 'tabular-nums' }}
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
          boxShadow: '0 0 0 1px rgba(255,69,58,0.40), 0 16px 40px rgba(255,69,58,0.25)',
        }}
      >
        <AlertTriangle className="h-10 w-10 text-[#FF7B7B]" strokeWidth={2} />
      </div>

      <p className="mt-7 text-[10.5px] font-mono font-bold uppercase tracking-[0.32em] text-[#FF7B7B]">
        Verification failed
      </p>
      <h2 className="mt-3 text-[22px] sm:text-[24px] font-bold leading-[1.3] tracking-[-0.01em] text-white">
        {state.message}
      </h2>
      {state.detail ? (
        <p className="mx-auto mt-4 max-w-md break-all text-left font-mono text-[11.5px] leading-relaxed text-[#A8A0D8]">
          {state.detail}
        </p>
      ) : null}

      <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
        <motion.button
          type="button"
          onClick={onClose}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          className="rounded-full px-7 py-3 text-[13px] font-semibold text-white"
          style={{
            background: 'linear-gradient(135deg, #00D4AA 0%, #6C3EF4 100%)',
            boxShadow: '0 12px 28px -8px rgba(0,212,170,0.5)',
          }}
        >
          別のパッケージを試す
        </motion.button>
        <a
          href="/legal-resources"
          className="text-[12.5px] font-semibold text-white/90 underline-offset-4 hover:underline"
        >
          失敗理由ガイドを開く
        </a>
      </div>

      <p className="mt-6 text-[10px] font-mono uppercase tracking-[0.28em] text-[#A8A0D8]/70">
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
