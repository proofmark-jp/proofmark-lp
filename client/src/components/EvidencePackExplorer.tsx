/**
 * Evidence Pack Explorer
 * ----------------------------------------------------------------------------
 * ZipContentsShowcase.tsx の骨格を継承し、
 * 「ファイルの説明」から「ファイルの中身そのもの」へ進化させた最終兵器。
 *
 * 体験の核:
 *   IDLE → クリック → EXPLORING（6ファイルの実プレビュー）→
 *   「クライアントに渡す」→ SUCCESS（自作の軽量紙吹雪 + チェック）→ 3秒後 EXPLORING
 *
 * このコンポーネントの唯一の使命:
 *   クリエイターに「このZIPをクライアントに渡したときの圧倒的なプロフェッショナルさ」を疑似体験させること。
 * ----------------------------------------------------------------------------
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from 'framer-motion';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Cpu,
  Download,
  FileArchive,
  FileText,
  Folder,
  Loader2,
  Send,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

/* ───────────────────── Tokens ───────────────────── */

const PM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const C = {
  voidBlack: '#07061A',
  purple: '#6C3EF4',
  purpleSoft: 'rgba(108,62,244,0.10)',
  purpleRing: 'rgba(108,62,244,0.35)',
  teal: '#00D4AA',
  tealSoft: 'rgba(0,212,170,0.10)',
  gold: '#F0BB38',
  surface: '#0D0B24',
  surfaceLift: '#13112C',
  border: '#1C1A38',
  borderHi: '#26224A',
  textMain: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.72)',
  textSubtle: 'rgba(255,255,255,0.45)',
  textWhisper: 'rgba(255,255,255,0.22)',
} as const;

/* ───────────────────── Types ───────────────────── */

type ExplorerPhase = 'IDLE' | 'EXPLORING' | 'SUCCESS';

interface ExplorerState {
  phase: ExplorerPhase;
  activeFileId: string;
  isDownloading: boolean;
}

interface ZipEntry {
  id: string;
  icon: JSX.Element;
  iconColor: string;
  name: string;
  size: string;
}

const ENTRIES: ReadonlyArray<ZipEntry> = [
  {
    id: 'cert',
    icon: <FileText className="h-4 w-4" />,
    iconColor: C.teal,
    name: 'Certificate_of_Authenticity.pdf',
    size: '184 KB',
  },
  {
    id: 'cover',
    icon: <FileText className="h-4 w-4" />,
    iconColor: '#BC78FF',
    name: 'Cover_Letter.pdf',
    size: '92 KB',
  },
  {
    id: 'tsr',
    icon: <ShieldCheck className="h-4 w-4" />,
    iconColor: C.gold,
    name: 'TIMESTAMP.tsr',
    size: '3.2 KB',
  },
  {
    id: 'sh',
    icon: <Terminal className="h-4 w-4" />,
    iconColor: '#A8A0D8',
    name: 'verify.sh',
    size: '1.4 KB',
  },
  {
    id: 'py',
    icon: <Cpu className="h-4 w-4" />,
    iconColor: '#A8A0D8',
    name: 'verify.py',
    size: '2.8 KB',
  },
  {
    id: 'howto',
    icon: <FileText className="h-4 w-4" />,
    iconColor: '#A8A0D8',
    name: 'HOW_TO_VERIFY.txt',
    size: '1.1 KB',
  },
];

const SAMPLE_HASH =
  '7a3f8c2e91b5d4a0f6c8e7b394d2a15f8b6a17c84f9e3a02d1b4af3d2c6e8b71';
const SAMPLE_TIMESTAMP_JST = '2026/05/26 14:32:08 JST';
const SAMPLE_CERT_ID = 'A3F7-9E2B-4C81';

/* ───────────────────── Component ───────────────────── */

export default function EvidencePackExplorer(): JSX.Element {
  const reduce = useReducedMotion() ?? false;
  const [state, setState] = useState<ExplorerState>({
    phase: 'IDLE',
    activeFileId: ENTRIES[0].id,
    isDownloading: false,
  });
  const [toast, setToast] = useState<string | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const successResetRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (successResetRef.current) window.clearTimeout(successResetRef.current);
    };
  }, []);

  const active = useMemo(
    () => ENTRIES.find((e) => e.id === state.activeFileId) ?? ENTRIES[0],
    [state.activeFileId],
  );

  const openExplorer = useCallback(() => {
    setState((s) => ({ ...s, phase: 'EXPLORING' }));
  }, []);

  const selectFile = useCallback((id: string) => {
    setState((s) => ({ ...s, activeFileId: id }));
  }, []);

  const handleDownload = useCallback(() => {
    setState((s) => ({ ...s, isDownloading: true }));
    window.setTimeout(() => {
      setState((s) => ({ ...s, isDownloading: false }));
      setToast('保存しました');
      window.setTimeout(() => setToast(null), 2400);
    }, 1000);
  }, []);

  const handleDeliver = useCallback(() => {
    setConfettiKey((k) => k + 1);
    setState((s) => ({ ...s, phase: 'SUCCESS' }));
    if (successResetRef.current) window.clearTimeout(successResetRef.current);
    successResetRef.current = window.setTimeout(() => {
      setState((s) => ({ ...s, phase: 'EXPLORING' }));
    }, 3000);
  }, []);

  return (
    <div
      className="relative w-full"
      style={{ color: C.textMain }}
    >
      <AnimatePresence mode="wait">
        {state.phase === 'IDLE' && (
          <IdleView key="idle" onOpen={openExplorer} reduce={reduce} />
        )}
        {(state.phase === 'EXPLORING' || state.phase === 'SUCCESS') && (
          <ExplorerView
            key="explorer"
            state={state}
            active={active}
            onSelect={selectFile}
            onDownload={handleDownload}
            onDeliver={handleDeliver}
            reduce={reduce}
          />
        )}
      </AnimatePresence>

      {/* Confetti layer (mounted alongside) */}
      <AnimatePresence>
        {state.phase === 'SUCCESS' && !reduce && (
          <LightweightConfetti key={confettiKey} />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.3, ease: PM_EASE }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-[13px] font-medium shadow-2xl"
            style={{
              background: C.surface,
              border: `1px solid ${C.tealSoft}`,
              color: C.teal,
              boxShadow: `0 0 30px ${C.tealSoft}, 0 12px 40px rgba(0,0,0,0.6)`,
            }}
          >
            <CheckCircle2 className="h-4 w-4" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────── IDLE View ─────────────────── */

function IdleView({
  onOpen,
  reduce,
}: {
  onOpen: () => void;
  reduce: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduce ? 0 : -12 }}
      transition={{ duration: reduce ? 0 : 0.55, ease: PM_EASE }}
      className="relative mx-auto flex max-w-[640px] flex-col items-center justify-center rounded-[28px] border px-6 py-16 sm:py-24 text-center overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 0%, rgba(108,62,244,0.10) 0%, transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.005))',
        borderColor: C.border,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
      }}
    >
      {/* Orbiting dots */}
      <div className="relative h-[180px] w-[180px] flex items-center justify-center mb-7">
        {/* central teal halo */}
        {!reduce && (
          <motion.div
            aria-hidden
            className="absolute inset-0 rounded-full blur-2xl"
            style={{ background: C.teal, opacity: 0.18 }}
            animate={{ opacity: [0.12, 0.24, 0.12] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {/* orbiting ring */}
        {!reduce && (
          <motion.div
            aria-hidden
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
          >
            {[0, 72, 144, 216, 288].map((deg, i) => (
              <span
                key={deg}
                className="absolute left-1/2 top-1/2 block h-1.5 w-1.5 rounded-full"
                style={{
                  background: i % 2 === 0 ? C.teal : C.purple,
                  boxShadow: `0 0 10px ${i % 2 === 0 ? C.teal : C.purple}`,
                  transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-86px)`,
                }}
              />
            ))}
          </motion.div>
        )}

        {/* inner counter-rotation */}
        {!reduce && (
          <motion.div
            aria-hidden
            className="absolute inset-6"
            animate={{ rotate: -360 }}
            transition={{ duration: 34, repeat: Infinity, ease: 'linear' }}
          >
            {[30, 150, 270].map((deg) => (
              <span
                key={deg}
                className="absolute left-1/2 top-1/2 block h-1 w-1 rounded-full"
                style={{
                  background: C.gold,
                  boxShadow: `0 0 8px ${C.gold}`,
                  transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-58px)`,
                }}
              />
            ))}
          </motion.div>
        )}

        {/* dashed orbit guides */}
        <div
          aria-hidden
          className="absolute inset-2 rounded-full"
          style={{ border: `1px dashed ${C.purpleRing}` }}
        />
        <div
          aria-hidden
          className="absolute inset-10 rounded-full"
          style={{ border: `1px dashed rgba(0,212,170,0.18)` }}
        />

        {/* central zip icon */}
        <motion.div
          className="relative flex h-[88px] w-[88px] items-center justify-center rounded-2xl"
          style={{
            background:
              'linear-gradient(180deg, rgba(0,212,170,0.18), rgba(0,212,170,0.04))',
            border: `1px solid ${C.tealSoft}`,
            boxShadow: `0 0 30px rgba(0,212,170,0.20), inset 0 0 0 1px rgba(255,255,255,0.04)`,
          }}
          animate={
            reduce
              ? undefined
              : { y: [0, -4, 0] }
          }
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <FileArchive className="h-9 w-9" style={{ color: C.teal }} strokeWidth={1.6} />
        </motion.div>
      </div>

      <p
        className="font-mono text-[12px] uppercase tracking-[0.22em]"
        style={{ color: C.teal }}
      >
        Evidence Pack · Ready
      </p>
      <h3
        className="mt-3 text-[24px] sm:text-[28px] font-extrabold leading-tight"
        style={{ letterSpacing: '-0.015em' }}
      >
        この1つのZIPの中身を、<br className="sm:hidden" />クライアント視点で開いてみる。
      </h3>
      <p
        className="mt-3 max-w-[42ch] text-[14px] leading-relaxed"
        style={{ color: C.textMuted }}
      >
        証明書PDF、カバーレター、検証スクリプト ── 全 6 ファイルの中身を、
        そのままプレビューできます。
      </p>

      <div
        className="mt-5 font-mono text-[12.5px] px-3 py-1.5 rounded-md"
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          color: C.textMuted,
        }}
      >
        ProofMark_Evidence_Pack_A3F7.zip
      </div>

      <motion.button
        type="button"
        onClick={onOpen}
        whileHover={reduce ? undefined : { scale: 1.02 }}
        whileTap={reduce ? undefined : { scale: 0.98 }}
        className="mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[14.5px] font-semibold"
        style={{
          background: `linear-gradient(135deg, ${C.purple} 0%, #8B61FF 100%)`,
          color: '#FFFFFF',
          boxShadow: `0 12px 32px -10px ${C.purpleRing}, inset 0 1px 0 rgba(255,255,255,0.18)`,
        }}
      >
        クリックして中身を確認する
        <ArrowRight className="h-4 w-4" />
      </motion.button>
    </motion.div>
  );
}

/* ─────────────────── EXPLORING View ─────────────────── */

function ExplorerView({
  state,
  active,
  onSelect,
  onDownload,
  onDeliver,
  reduce,
}: {
  state: ExplorerState;
  active: ZipEntry;
  onSelect: (id: string) => void;
  onDownload: () => void;
  onDeliver: () => void;
  reduce: boolean;
}) {
  const listStagger: Transition = reduce
    ? { duration: 0 }
    : { delayChildren: 0.18, staggerChildren: 0.05 };

  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.55, ease: PM_EASE }}
      className="w-full"
    >
      {/* Top bar: zip header (layout from IDLE → compact) */}
      <motion.div
        layout
        className="mb-5 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
        style={{
          background: C.surface,
          borderColor: C.border,
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <motion.div
            layout
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: 'rgba(0,212,170,0.12)',
              border: `1px solid ${C.tealSoft}`,
            }}
          >
            <FileArchive className="h-4 w-4" style={{ color: C.teal }} />
          </motion.div>
          <div className="min-w-0">
            <div className="font-mono text-[12.5px] truncate" style={{ color: C.textMain }}>
              ProofMark_Evidence_Pack_A3F7.zip
            </div>
            <div className="text-[10.5px] font-mono uppercase tracking-[0.18em]" style={{ color: C.textSubtle }}>
              6 files · 284.5 KB · sealed at {SAMPLE_TIMESTAMP_JST}
            </div>
          </div>
        </div>
        <span
          className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em]"
          style={{
            color: C.teal,
            background: C.tealSoft,
            border: `1px solid ${C.tealSoft}`,
          }}
        >
          <ShieldCheck className="h-3 w-3" /> verified
        </span>
      </motion.div>

      {/* 2-col layout */}
      <div className="grid gap-5 lg:grid-cols-[35fr_65fr] lg:gap-6">
        {/* LEFT — file tree (desktop) / horizontal tabs (mobile) */}
        <div
          className="rounded-[20px] border p-4 sm:p-5"
          style={{
            background: C.surface,
            borderColor: C.border,
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
          }}
        >
          <div
            className="mb-3 hidden lg:flex items-center gap-2 text-[12px] font-bold"
            style={{ color: C.textMain }}
          >
            <Folder className="h-4 w-4" style={{ color: '#BC78FF' }} />
            File Tree
          </div>

          {/* Mobile: horizontal scrollable tabs */}
          <div
            className="lg:hidden -mx-1 flex gap-2 overflow-x-auto pb-1"
            style={{ scrollbarWidth: 'none' }}
          >
            {ENTRIES.map((e) => {
              const isActive = e.id === state.activeFileId;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onSelect(e.id)}
                  className="shrink-0 flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-mono"
                  style={{
                    background: isActive ? C.purpleSoft : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isActive ? C.purpleRing : C.border}`,
                    color: isActive ? C.textMain : C.textMuted,
                  }}
                >
                  <span style={{ color: e.iconColor }}>{e.icon}</span>
                  {e.name.split('.')[0]}
                </button>
              );
            })}
          </div>

          {/* Desktop: vertical tree */}
          <motion.ul
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: {} }}
            transition={listStagger}
            className="hidden lg:block ml-1 border-l pl-2"
            style={{ borderColor: C.border }}
          >
            {ENTRIES.map((e, i) => {
              const isActive = e.id === state.activeFileId;
              return (
                <motion.li
                  key={e.id}
                  initial={reduce ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: reduce ? 0 : 0.45,
                    delay: reduce ? 0 : 0.18 + i * 0.05,
                    ease: PM_EASE,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(e.id)}
                    onMouseEnter={() => onSelect(e.id)}
                    className="group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left"
                    style={{
                      background: isActive ? C.purpleSoft : 'transparent',
                      borderLeft: `2px solid ${isActive ? C.purple : 'transparent'}`,
                      transition: 'background 200ms, border-color 200ms',
                    }}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        color: e.iconColor,
                      }}
                    >
                      {e.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate font-mono text-[12.5px]"
                        style={{
                          color: isActive ? C.textMain : 'rgba(255,255,255,0.78)',
                        }}
                      >
                        {e.name}
                      </span>
                      <span
                        className="block font-mono text-[10px] uppercase tracking-[0.16em] mt-0.5"
                        style={{ color: C.textSubtle }}
                      >
                        {e.size}
                      </span>
                    </span>
                    <ArrowRight
                      className="h-3.5 w-3.5"
                      style={{
                        color: e.iconColor,
                        opacity: isActive ? 1 : 0,
                        transition: 'opacity 200ms',
                      }}
                    />
                  </button>
                </motion.li>
              );
            })}
          </motion.ul>
        </div>

        {/* RIGHT — preview pane */}
        <div
          className="relative overflow-hidden rounded-[20px] border flex flex-col"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.022), rgba(255,255,255,0.004))',
            borderColor: C.border,
            minHeight: 480,
          }}
        >
          {/* preview header */}
          <div
            className="flex items-center justify-between gap-3 border-b px-5 py-3"
            style={{ borderColor: C.border }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span style={{ color: active.iconColor }}>{active.icon}</span>
              <span
                className="font-mono text-[12px] truncate"
                style={{ color: C.textMuted }}
              >
                {active.name}
              </span>
            </div>
            <span
              className="hidden sm:block font-mono text-[10.5px] uppercase tracking-[0.18em]"
              style={{ color: C.textSubtle }}
            >
              Preview
            </span>
          </div>

          {/* preview body */}
          <div className="relative flex-1 p-5 sm:p-6" style={{ minHeight: 400 }}>
            <AnimatePresence mode="wait">
              {state.phase === 'EXPLORING' && (
                <motion.div
                  key={active.id}
                  initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduce ? 0 : -8 }}
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 320, damping: 28 }
                  }
                  className="h-full"
                >
                  {active.id === 'cert' && <CertPreview />}
                  {active.id === 'cover' && <CoverLetterPreview />}
                  {active.id === 'tsr' && <TsrHexPreview />}
                  {active.id === 'sh' && <VerifyShPreview />}
                  {active.id === 'py' && <VerifyPyPreview />}
                  {active.id === 'howto' && <HowToVerifyPreview />}
                </motion.div>
              )}

              {state.phase === 'SUCCESS' && (
                <SuccessPanel key="success" reduce={reduce} />
              )}
            </AnimatePresence>
          </div>

          {/* action bar */}
          <div
            className="flex items-center justify-end gap-3 border-t px-5 py-4"
            style={{
              borderColor: C.border,
              background: 'rgba(0,0,0,0.18)',
            }}
          >
            <button
              type="button"
              onClick={onDownload}
              disabled={state.isDownloading || state.phase === 'SUCCESS'}
              className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium disabled:opacity-50"
              style={{
                background: 'transparent',
                border: `1px solid ${C.borderHi}`,
                color: C.textMain,
              }}
            >
              {state.isDownloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              ダウンロード
            </button>

            <motion.button
              type="button"
              onClick={onDeliver}
              disabled={state.phase === 'SUCCESS'}
              whileHover={reduce ? undefined : { scale: 1.02 }}
              whileTap={reduce ? undefined : { scale: 0.98 }}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold disabled:opacity-60"
              style={{
                background: `linear-gradient(135deg, ${C.purple} 0%, #8B61FF 100%)`,
                color: '#FFFFFF',
                boxShadow: `0 8px 24px -8px ${C.purpleRing}`,
              }}
            >
              クライアントに渡す
              <Send className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────── Previews ─────────────────── */

/** ① Certificate_of_Authenticity.pdf */
function CertPreview() {
  return (
    <div
      className="h-full flex flex-col rounded-2xl p-5 sm:p-6 relative overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))',
        border: `1px solid ${C.borderHi}`,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03)',
      }}
    >
      {/* corner accents */}
      <div className="absolute top-3 left-3 h-4 w-4 border-t border-l" style={{ borderColor: C.tealSoft }} />
      <div className="absolute top-3 right-3 h-4 w-4 border-t border-r" style={{ borderColor: C.tealSoft }} />
      <div className="absolute bottom-3 left-3 h-4 w-4 border-b border-l" style={{ borderColor: C.tealSoft }} />
      <div className="absolute bottom-3 right-3 h-4 w-4 border-b border-r" style={{ borderColor: C.tealSoft }} />

      <div className="flex items-start justify-between mb-4">
        <div className="flex flex-col gap-1.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.2em] w-fit"
            style={{
              background: C.tealSoft,
              color: C.teal,
              border: `1px solid ${C.tealSoft}`,
            }}
          >
            <ShieldCheck className="h-3 w-3" /> VERIFIED
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.2em] w-fit"
            style={{
              background: 'rgba(240,187,56,0.10)',
              color: C.gold,
              border: '1px solid rgba(240,187,56,0.35)',
            }}
          >
            ✦ FOUNDER
          </span>
        </div>
        <div className="text-right">
          <p className="text-[9.5px] font-mono uppercase tracking-[0.24em]" style={{ color: C.textSubtle }}>
            ProofMark
          </p>
          <p className="text-[10px] font-mono mt-0.5" style={{ color: C.textWhisper }}>
            #{SAMPLE_CERT_ID}
          </p>
        </div>
      </div>

      <h4
        className="text-[14px] font-extrabold tracking-[0.06em] uppercase"
        style={{
          color: C.textMain,
          fontFamily: '"Poppins", "Inter", sans-serif',
        }}
      >
        Certificate of Authenticity
      </h4>
      <p
        className="text-[10.5px] font-mono uppercase tracking-[0.18em] mt-0.5"
        style={{ color: C.textSubtle }}
      >
        ProofMark Digital Existence Certificate
      </p>

      {/* generative artwork thumbnail (pure CSS, no external image) */}
      <div
        className="mt-4 aspect-[16/9] w-full rounded-xl relative overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse at 18% 28%, rgba(108,62,244,0.55) 0%, transparent 55%),
            radial-gradient(ellipse at 78% 72%, rgba(0,212,170,0.42) 0%, transparent 50%),
            radial-gradient(circle at 52% 50%, rgba(240,187,56,0.18) 0%, transparent 45%),
            linear-gradient(135deg, #07061A 0%, #15123A 60%, #0A0820 100%)
          `,
          border: `1px solid ${C.borderHi}`,
        }}
      >
        {/* fine grid */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage:
              'linear-gradient(0deg, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        {/* center sigil */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(0,0,0,0.32)',
              border: `1px solid ${C.tealSoft}`,
              backdropFilter: 'blur(6px)',
              boxShadow: `0 0 30px rgba(0,212,170,0.30)`,
            }}
          >
            <ShieldCheck className="h-7 w-7" style={{ color: C.teal }} strokeWidth={1.6} />
          </div>
        </div>
        <p
          className="absolute bottom-2 right-3 font-mono text-[9px] uppercase tracking-[0.22em]"
          style={{ color: 'rgba(255,255,255,0.42)' }}
        >
          Protected Asset Preview
        </p>
      </div>

      {/* meta grid */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <CertMetaCell
          label="SHA-256"
          value={`${SAMPLE_HASH.slice(0, 8)}…${SAMPLE_HASH.slice(-8)}`}
          accent={C.teal}
        />
        <CertMetaCell
          label="Sealed at (JST)"
          value={SAMPLE_TIMESTAMP_JST}
          accent={C.gold}
        />
      </div>

      <div
        className="mt-auto pt-4 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.18em]"
        style={{ color: C.textSubtle }}
      >
        <span>RFC 3161 · SHA-256 · Independent Verifiable</span>
        <span style={{ color: C.teal }}>✓ Bound</span>
      </div>
    </div>
  );
}

function CertMetaCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{
        background: 'rgba(0,0,0,0.28)',
        border: `1px solid ${C.border}`,
      }}
    >
      <p
        className="text-[9.5px] font-mono uppercase tracking-[0.2em]"
        style={{ color: C.textSubtle }}
      >
        {label}
      </p>
      <p
        className="mt-1 font-mono text-[11.5px] truncate"
        style={{ color: accent, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </p>
    </div>
  );
}

/** ② Cover_Letter.pdf — 紙の手紙 */
function CoverLetterPreview() {
  return (
    <div
      className="h-full flex flex-col rounded-2xl p-6 sm:p-7 relative overflow-hidden"
      style={{
        background: '#FAFAF5',
        color: '#1A1A1A',
        boxShadow:
          '0 30px 60px -30px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(0,0,0,0.04)',
      }}
    >
      {/* purple top accent */}
      <div
        className="absolute top-0 left-0 right-0 h-1.5"
        style={{ background: `linear-gradient(90deg, ${C.purple}, ${C.teal})` }}
      />

      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.22em]" style={{ color: '#5A5A5A' }}>
        <span>ProofMark · Cover Letter</span>
        <span>{SAMPLE_TIMESTAMP_JST}</span>
      </div>

      <h4
        className="mt-4 text-[15px] font-bold leading-tight"
        style={{
          fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
          color: '#0F0F0F',
        }}
      >
        納品物の真正性証明について
      </h4>

      <div
        className="mt-3 text-[12px] leading-[1.85] space-y-2"
        style={{
          fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
          color: '#222',
        }}
      >
        <p>
          このたびは制作物をお受け取りいただき、誠にありがとうございます。
        </p>
        <p>
          同梱の証明書に記載された SHA-256 ハッシュ値、および RFC3161 準拠の
          タイムスタンプは、本納品物が <strong>{SAMPLE_TIMESTAMP_JST}</strong>{' '}
          時点で確かに存在し、その後 1 ビットも改ざんされていないことを、
          第三者機関の暗号学的署名により独立して証明するものです。
        </p>
        <p>
          検証手順は同梱の <span className="font-mono" style={{ color: '#3A2BA3' }}>HOW_TO_VERIFY.txt</span>{' '}
          をご参照ください。ProofMark のサーバーに依存することなく、貴社内のみで完結する検証が可能です。
        </p>
      </div>

      <div className="mt-auto pt-5 flex items-end justify-between">
        <div>
          <p
            className="italic text-[12.5px]"
            style={{
              fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
              color: '#0F0F0F',
            }}
          >
            ProofMark Verified Creator
          </p>
          <p className="text-[10px] font-mono mt-1" style={{ color: '#5A5A5A' }}>
            Certificate #{SAMPLE_CERT_ID}
          </p>
        </div>
        <div
          className="h-12 w-12 rounded-full flex items-center justify-center"
          style={{
            border: `1.5px solid ${C.purple}`,
            color: C.purple,
            background: 'rgba(108,62,244,0.06)',
          }}
        >
          <ShieldCheck className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

/** ③ TIMESTAMP.tsr — HEX dump */
function TsrHexPreview() {
  // Generate stable mock hex
  const rows = useMemo(() => {
    const seed = [
      0x30, 0x82, 0x0c, 0xa1, 0x06, 0x09, 0x2a, 0x86,
      0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02, 0xa0,
      0x82, 0x0c, 0x92, 0x30, 0x82, 0x0c, 0x8e, 0x02,
      0x01, 0x03, 0x31, 0x0f, 0x30, 0x0d, 0x06, 0x09,
      0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02,
      0x01, 0x05, 0x00, 0x30, 0x82, 0x01, 0x6b, 0x06,
      0x0b, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01,
      0x09, 0x10, 0x01, 0x04, 0xa0, 0x82, 0x01, 0x5a,
      0x04, 0x82, 0x01, 0x56, 0x30, 0x82, 0x01, 0x52,
      0x02, 0x01, 0x01, 0x06, 0x09, 0x2b, 0x06, 0x01,
      0x04, 0x01, 0x82, 0x37, 0x02, 0x01, 0x0f, 0x30,
      0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65,
    ];
    const out: Array<{ offset: string; bytes: string[]; ascii: string }> = [];
    for (let i = 0; i < seed.length; i += 8) {
      const slice = seed.slice(i, i + 8);
      out.push({
        offset: i.toString(16).padStart(8, '0'),
        bytes: slice.map((b) => b.toString(16).padStart(2, '0')),
        ascii: slice
          .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.'))
          .join(''),
      });
    }
    return out;
  }, []);

  // Bytes that should glow teal (mimicking interesting header bytes)
  const tealOffsets = new Set([0, 1, 5, 6, 16, 17, 64, 65]);

  return (
    <div
      className="h-full flex flex-col rounded-2xl overflow-hidden"
      style={{
        background: '#0D0B24',
        border: `1px solid ${C.borderHi}`,
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{ borderColor: C.border, background: 'rgba(0,0,0,0.3)' }}
      >
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5" style={{ color: C.gold }} />
          <span
            className="font-mono text-[10.5px] uppercase tracking-[0.18em]"
            style={{ color: C.gold }}
          >
            TIMESTAMP.tsr · ASN.1 DER · 3,212 bytes
          </span>
        </div>
        <span
          className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.16em]"
          style={{ color: C.textSubtle }}
        >
          RFC 3161 Token
        </span>
      </div>

      <div
        className="flex-1 overflow-auto font-mono text-[11px] leading-[1.65] py-2"
        style={{ color: 'rgba(255,255,255,0.78)' }}
      >
        {rows.map((row, ri) => {
          let absoluteIndex = ri * 8;
          return (
            <div
              key={row.offset}
              className="flex items-center gap-4 px-4 py-0.5"
              style={{
                background:
                  ri % 2 === 1 ? 'rgba(255,255,255,0.025)' : 'transparent',
              }}
            >
              <span style={{ color: C.textWhisper, width: 80 }}>
                {row.offset}
              </span>
              <span className="flex gap-1.5 flex-wrap" style={{ width: 220 }}>
                {row.bytes.map((b, bi) => {
                  const idx = absoluteIndex + bi;
                  const isTeal = tealOffsets.has(idx);
                  return (
                    <span
                      key={bi}
                      style={{
                        color: isTeal ? C.teal : 'rgba(255,255,255,0.72)',
                        textShadow: isTeal
                          ? `0 0 8px rgba(0,212,170,0.45)`
                          : undefined,
                      }}
                    >
                      {b}
                    </span>
                  );
                })}
              </span>
              <span
                style={{ color: C.textSubtle, fontVariantLigatures: 'none' }}
              >
                {row.ascii}
              </span>
            </div>
          );
        })}
        <div className="px-4 py-2 text-[10px]" style={{ color: C.textWhisper }}>
          … 3,116 more bytes
        </div>
      </div>

      <div
        className="px-4 py-2 border-t flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em]"
        style={{ borderColor: C.border, color: C.textSubtle }}
      >
        <span>Issued by · FreeTSA.org</span>
        <span style={{ color: C.gold }}>SHA-256 hash imprint</span>
      </div>
    </div>
  );
}

/** ④ verify.sh */
function VerifyShPreview() {
  return (
    <CodePreview
      lang="bash"
      filename="verify.sh"
      lines={[
        { tag: 'c', text: '#!/usr/bin/env bash' },
        { tag: 'c', text: '# ProofMark Evidence Pack — local verification script' },
        { tag: 'c', text: '# Requires: openssl (>= 1.1.1), shasum' },
        { tag: 't', text: '' },
        { tag: 'k', text: 'set', sp: ' -euo pipefail' },
        { tag: 't', text: '' },
        {
          tag: 'k',
          text: 'EXPECTED_HASH',
          sp: '=',
          str: `"${SAMPLE_HASH}"`,
        },
        { tag: 'k', text: 'TARGET', sp: '=', str: '"$1"' },
        { tag: 't', text: '' },
        {
          tag: 'c',
          text: '# 1. Recompute SHA-256 of the delivered file',
        },
        {
          tag: 'k',
          text: 'ACTUAL_HASH',
          sp: '=$(',
          fn: 'shasum',
          spAfter: ' -a 256 "$TARGET" | awk \'{print $1}\')',
        },
        { tag: 't', text: '' },
        {
          tag: 'k',
          text: 'if',
          sp: ' [[ "$ACTUAL_HASH" != "$EXPECTED_HASH" ]]; ',
          k2: 'then',
        },
        {
          tag: 'plain',
          text: '  echo "✗ Hash mismatch — file has been modified"; exit 1',
        },
        { tag: 'k', text: 'fi' },
        { tag: 't', text: '' },
        {
          tag: 'c',
          text: '# 2. Verify RFC3161 timestamp token against the hash',
        },
        {
          tag: 'fn',
          text: 'openssl',
          sp: ' ts -verify -data "$TARGET" -in TIMESTAMP.tsr \\',
        },
        { tag: 'plain', text: '   -CAfile freetsa-cacert.pem -untrusted freetsa-tsa.crt' },
        { tag: 't', text: '' },
        {
          tag: 'plain',
          text: 'echo "✓ Verified: file is authentic and sealed at the certified time."',
        },
      ]}
    />
  );
}

/** ⑤ verify.py */
function VerifyPyPreview() {
  return (
    <CodePreview
      lang="python"
      filename="verify.py"
      lines={[
        { tag: 'c', text: '"""ProofMark Evidence Pack — Python verifier (stdlib only)."""' },
        { tag: 'k', text: 'import', sp: ' hashlib, subprocess, sys' },
        { tag: 't', text: '' },
        { tag: 'k', text: 'EXPECTED', sp: ' = ', str: `"${SAMPLE_HASH}"` },
        { tag: 't', text: '' },
        { tag: 'k', text: 'def', sp: ' ', fn: 'sha256_of', spAfter: '(path: str) -> str:' },
        { tag: 'plain', text: '    h = hashlib.sha256()' },
        { tag: 'k', text: '    with', sp: ' ', fn: 'open', spAfter: '(path, "rb") as f:' },
        { tag: 'k', text: '        for', sp: ' chunk in ', fn: 'iter', spAfter: '(lambda: f.read(1 << 16), b""):' },
        { tag: 'plain', text: '            h.update(chunk)' },
        { tag: 'k', text: '    return', sp: ' h.', fn: 'hexdigest', spAfter: '()' },
        { tag: 't', text: '' },
        { tag: 'k', text: 'if', sp: ' __name__ == ', str: '"__main__"', sp2: ':' },
        { tag: 'plain', text: '    target = sys.argv[1]' },
        { tag: 'k', text: '    assert', sp: ' ', fn: 'sha256_of', spAfter: '(target) == EXPECTED, "Hash mismatch"' },
        { tag: 'plain', text: '    subprocess.check_call([' },
        { tag: 'plain', text: '        "openssl", "ts", "-verify", "-data", target,' },
        { tag: 'plain', text: '        "-in", "TIMESTAMP.tsr",' },
        { tag: 'plain', text: '        "-CAfile", "freetsa-cacert.pem",' },
        { tag: 'plain', text: '        "-untrusted", "freetsa-tsa.crt",' },
        { tag: 'plain', text: '    ])' },
        { tag: 'k', text: '    print', sp: '(', str: '"\\u2713 Verified"', sp2: ')' },
      ]}
    />
  );
}

/** ⑥ HOW_TO_VERIFY.txt */
function HowToVerifyPreview() {
  const sections = [
    {
      n: '1',
      title: 'ブラウザで検証する（最速）',
      body: [
        'ProofMark の証明書 URL を開き、納品ファイルをドラッグ＆ドロップしてください。',
        '15 秒以内に「VERIFIED」と表示されれば、ファイルは改ざんされていません。',
      ],
    },
    {
      n: '2',
      title: 'Mac / Linux ターミナルで検証する',
      body: [
        '$ bash verify.sh path/to/delivered_file',
        '→ 「✓ Verified」と出力されれば成功です。',
      ],
    },
    {
      n: '3',
      title: 'Python で検証する',
      body: [
        '$ python3 verify.py path/to/delivered_file',
        '社内のサーバー等、OpenSSL があれば動作します。',
      ],
    },
    {
      n: '4',
      title: 'OpenSSL のみで生の検証を行う',
      body: [
        '$ openssl ts -verify -data <file> -in TIMESTAMP.tsr \\',
        '    -CAfile freetsa-cacert.pem -untrusted freetsa-tsa.crt',
      ],
    },
  ];

  return (
    <div
      className="h-full flex flex-col rounded-2xl p-5 sm:p-6 font-mono"
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: `1px solid ${C.border}`,
        color: 'rgba(255,255,255,0.85)',
      }}
    >
      <div className="flex items-center justify-between border-b pb-2.5 mb-3" style={{ borderColor: C.border }}>
        <span className="text-[10.5px] uppercase tracking-[0.22em]" style={{ color: C.textSubtle }}>
          HOW_TO_VERIFY.txt · plain text
        </span>
        <span className="text-[10.5px] uppercase tracking-[0.18em]" style={{ color: C.teal }}>
          4 methods
        </span>
      </div>

      <div className="flex-1 overflow-auto text-[12px] leading-[1.75] space-y-4">
        <p style={{ color: C.textMuted }}>
          このフォルダには、納品物の真正性を独立検証するための 4 通りの方法が同梱されています。
          ProofMark のサーバーに依存することなく、いずれの方法でも検証が完結します。
        </p>
        {sections.map((s) => (
          <div key={s.n}>
            <p style={{ color: C.teal }}>
              [{s.n}] {s.title}
            </p>
            {s.body.map((line, i) => (
              <p key={i} className="pl-4" style={{ color: 'rgba(255,255,255,0.78)' }}>
                {line}
              </p>
            ))}
          </div>
        ))}

        <p className="pt-2 border-t" style={{ borderColor: C.border, color: C.textSubtle }}>
          — ProofMark · sealed at {SAMPLE_TIMESTAMP_JST}
        </p>
      </div>
    </div>
  );
}

/* ─────────── Code Preview (verify.sh / verify.py) ─────────── */

interface CodeLine {
  tag: 'c' | 'k' | 'fn' | 'str' | 't' | 'plain';
  text: string;
  sp?: string;
  spAfter?: string;
  fn?: string;
  str?: string;
  k2?: string;
  sp2?: string;
}

function CodePreview({
  lang,
  filename,
  lines,
}: {
  lang: 'bash' | 'python';
  filename: string;
  lines: ReadonlyArray<CodeLine>;
}) {
  return (
    <div
      className="h-full flex flex-col rounded-2xl overflow-hidden"
      style={{
        background: '#0A0820',
        border: `1px solid ${C.borderHi}`,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.02)',
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{ borderColor: C.border, background: 'rgba(0,0,0,0.3)' }}
      >
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#FF5F57' }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#FEBC2E' }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#28C840' }} />
          </div>
          <span
            className="ml-2 font-mono text-[11px]"
            style={{ color: C.textMuted }}
          >
            {filename}
          </span>
        </div>
        <span
          className="font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: C.textSubtle }}
        >
          {lang}
        </span>
      </div>

      <pre
        className="flex-1 overflow-auto px-5 py-4 font-mono text-[12px] leading-[1.75] m-0"
        style={{ color: 'rgba(255,255,255,0.82)' }}
      >
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span
              className="select-none pr-4 text-right shrink-0"
              style={{ color: C.textWhisper, width: 28 }}
            >
              {i + 1}
            </span>
            <span className="whitespace-pre-wrap break-all">
              {renderCodeLine(line)}
            </span>
          </div>
        ))}
      </pre>
    </div>
  );
}

function renderCodeLine(line: CodeLine): React.ReactNode {
  switch (line.tag) {
    case 'c':
      return <span style={{ color: C.textSubtle, fontStyle: 'italic' }}>{line.text}</span>;
    case 't':
      return <span>&nbsp;</span>;
    case 'plain':
      return <span style={{ color: 'rgba(255,255,255,0.82)' }}>{line.text}</span>;
    case 'k':
      return (
        <>
          <span style={{ color: '#BC78FF' }}>{line.text}</span>
          {line.sp && <span>{line.sp}</span>}
          {line.fn && <span style={{ color: C.teal }}>{line.fn}</span>}
          {line.spAfter && <span>{line.spAfter}</span>}
          {line.str && <span style={{ color: '#86EFAC' }}>{line.str}</span>}
          {line.k2 && <span style={{ color: '#BC78FF' }}>{line.k2}</span>}
          {line.sp2 && <span>{line.sp2}</span>}
        </>
      );
    case 'fn':
      return (
        <>
          <span style={{ color: C.teal }}>{line.text}</span>
          {line.sp && <span>{line.sp}</span>}
        </>
      );
    case 'str':
      return <span style={{ color: '#86EFAC' }}>{line.text}</span>;
    default:
      return <span>{line.text}</span>;
  }
}

/* ─────────────────── SUCCESS Panel ─────────────────── */

function SuccessPanel({ reduce }: { reduce: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: PM_EASE }}
      className="h-full flex flex-col items-center justify-center text-center px-6"
    >
      <motion.div
        initial={
          reduce
            ? { scale: 1, opacity: 1 }
            : { scale: 0.3, opacity: 0 }
        }
        animate={{ scale: 1, opacity: 1 }}
        transition={
          reduce
            ? { duration: 0 }
            : { type: 'spring', stiffness: 480, damping: 16 }
        }
        className="relative flex h-24 w-24 items-center justify-center rounded-full"
        style={{
          background: 'rgba(0,212,170,0.14)',
          border: `2px solid ${C.teal}`,
          boxShadow: `0 0 60px rgba(0,212,170,0.45)`,
        }}
      >
        <Check className="h-12 w-12" style={{ color: C.teal }} strokeWidth={3} />
        {!reduce && (
          <>
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{ border: `2px solid ${C.teal}` }}
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 1.8, opacity: 0 }}
              transition={{ duration: 0.9, delay: 0.1, ease: 'easeOut' }}
            />
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{ border: `2px solid ${C.teal}` }}
              initial={{ scale: 1, opacity: 0.4 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 1.1, delay: 0.25, ease: 'easeOut' }}
            />
          </>
        )}
      </motion.div>

      <motion.h4
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5, ease: PM_EASE }}
        className="mt-6 text-[22px] font-extrabold tracking-tight"
      >
        納品が完了しました。
      </motion.h4>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5, ease: PM_EASE }}
        className="mt-3 max-w-[44ch] text-[14px] leading-relaxed"
        style={{ color: C.textMuted }}
      >
        この 1 つの ZIP を渡すだけで、あなたの作品の真正性とプロフェッショナルさを、
        クライアントに強く印象づけられます。
      </motion.p>
    </motion.div>
  );
}

/* ─────────────────── Lightweight Confetti ─────────────────── */
/**
 * 外部ライブラリゼロの自作紙吹雪。
 * 18 個の div を Framer Motion で散らすだけ。負荷は無視できるレベル。
 */
function LightweightConfetti() {
  const pieces = useMemo(() => {
    const palette = [C.teal, C.purple, C.gold, '#FFFFFF', '#BC78FF'];
    return Array.from({ length: 18 }, (_, i) => {
      // deterministic-ish but spread
      const seed = i * 1.61803398875;
      const rand = (k: number) => {
        const v = Math.sin(seed * k) * 10000;
        return v - Math.floor(v);
      };
      return {
        id: i,
        left: 10 + rand(1) * 80, // percent
        color: palette[i % palette.length],
        size: 6 + rand(2) * 6,
        delay: rand(3) * 0.25,
        duration: 1.6 + rand(4) * 1.2,
        rotate: rand(5) * 540 - 270,
        drift: rand(6) * 80 - 40,
        shape: i % 3 === 0 ? 'rect' : 'square',
      };
    });
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      {pieces.map((p) => {
        const style: CSSProperties = {
          position: 'absolute',
          top: '-24px',
          left: `${p.left}%`,
          width: p.shape === 'rect' ? p.size : p.size * 0.6,
          height: p.size,
          background: p.color,
          borderRadius: p.shape === 'rect' ? 1 : 2,
          boxShadow: `0 0 6px ${p.color}55`,
        };
        return (
          <motion.div
            key={p.id}
            style={style}
            initial={{ y: -40, x: 0, rotate: 0, opacity: 0 }}
            animate={{
              y: typeof window !== 'undefined' ? window.innerHeight + 60 : 800,
              x: p.drift,
              rotate: p.rotate,
              opacity: [0, 1, 1, 0.9, 0],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              ease: [0.22, 0.61, 0.36, 1],
              times: [0, 0.1, 0.7, 0.9, 1],
            }}
          />
        );
      })}
    </div>
  );
}
