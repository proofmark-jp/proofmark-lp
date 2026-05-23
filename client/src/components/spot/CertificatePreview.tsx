/**
 * CertificatePreview.tsx
 * ─────────────────────────────────────────────────────────────
 *  Phase 1 完成版 — 感情のピーク
 *
 *  60% Framer Motion / Morphing:
 *    - IDLE → HASHING → PREVIEW → PAYING を LayoutGroup + layout で連続変形
 *    - PREVIEW 突入時に Teal パルスを 1 回走らせる (Notarize.com 級の儀式感)
 *    - スケルトン / シマー / ロック表現で未確定要素を美しく示唆
 *
 *  20% Stripe Philosophy / 認知的透明性:
 *    - getHashingStatusText(progress) で SHA-256 計算の段階を可視化
 *      「サンドボックスで展開 → シグネチャ生成 → ZK メタデータ構築 → 完了」
 *
 *  20% Canva Philosophy / 即時プロ品質:
 *    - 余白 / トラッキング / シャドウを書式に近い水準に微調整
 *    - 弁護士に提出できる重厚な「証書」フォーマットを 1 ドロップで完成
 *    - QR の中央に Lock アイコンを内包 (プレミアム・封印感)
 * ─────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useState } from 'react';
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
  useReducedMotion,
} from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  FileText,
  Layers,
  Lock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

/* ─────────────────────────────────────────────
 *  Types
 * ───────────────────────────────────────────── */

export type SpotState = 'IDLE' | 'HASHING' | 'PREVIEW' | 'PAYING' | 'ERROR';

export interface CertificatePreviewProps {
  state: SpotState;
  file: File | null;
  hash: string | null;
  hashProgress: number; // 0-100
  /** LP の右パネルなど、サイズを抑えたいときに true */
  compact?: boolean;
}

/* ─────────────────────────────────────────────
 *  Motion tokens
 * ───────────────────────────────────────────── */

const PM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const buildContainer = (reduce: boolean) => ({
  hidden: {},
  visible: {
    transition: reduce
      ? { duration: 0 }
      : { staggerChildren: 0.18, delayChildren: 0.05 },
  },
});

const buildItem = (reduce: boolean) => ({
  hidden: { opacity: 0, y: reduce ? 0 : 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: reduce ? 0 : 0.55, ease: PM_EASE },
  },
});

/* ─────────────────────────────────────────────
 *  Stripe philosophy — 進捗テキストの段階切替
 * ───────────────────────────────────────────── */

function getHashingStatusText(progress: number): string {
  if (progress < 20) return 'ファイルを安全なサンドボックスで展開中...';
  if (progress < 50) return 'SHA-256 暗号シグネチャを生成中...';
  if (progress < 85) return 'ゼロ知識証明のメタデータを構築中...';
  return 'ローカルでの暗号化処理を完了しています...';
}

function getHashingSubText(progress: number): string {
  if (progress < 20) return 'Mounting file into in-browser sandbox';
  if (progress < 50) return 'Computing SHA-256 with Web Crypto subtle';
  if (progress < 85) return 'Building zero-knowledge metadata payload';
  return 'Finalizing local cryptographic envelope';
}

/* ─────────────────────────────────────────────
 *  Component
 * ───────────────────────────────────────────── */

export default function CertificatePreview({
  state,
  file,
  hash,
  hashProgress,
  compact = false,
}: CertificatePreviewProps): JSX.Element {
  const reduce = useReducedMotion() ?? false;

  // PREVIEW 遷移パルス（1 回だけ走らせる）
  const [pulseKey, setPulseKey] = useState<number>(0);
  useEffect(() => {
    if (state === 'PREVIEW') setPulseKey((n) => n + 1);
  }, [state]);

  const provisionalId = useMemo(() => makeProvisionalId(hash), [hash]);

  // 画像プレビュー URL
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const showSealed = state === 'PREVIEW' || state === 'PAYING';

  return (
    <MotionConfig transition={{ ease: PM_EASE }}>
      <LayoutGroup id="pm-cert-preview">
        <motion.div
          layout
          className={[
            'relative w-full overflow-hidden',
            'rounded-[32px] border print:bg-white',
            compact ? 'p-5 sm:p-6' : 'p-6 sm:p-9 md:p-11',
          ].join(' ')}
          style={{
            background: '#0D0B24',
            borderColor: showSealed
              ? 'rgba(108,62,244,0.42)'
              : '#1C1A38',
            transition: 'border-color 600ms cubic-bezier(0.16,1,0.3,1)',
            boxShadow: showSealed
              ? '0 0 60px rgba(108,62,244,0.20), 0 0 0 1px rgba(108,62,244,0.18) inset, 0 24px 60px rgba(0,0,0,0.55)'
              : '0 24px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04) inset',
          }}
        >
          {/* ── ambient blur orbs ── */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute -top-32 -left-32 h-96 w-96 rounded-full opacity-10 blur-[100px]"
              style={{ background: '#6C3EF4' }}
            />
            <div
              className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full opacity-10 blur-[100px]"
              style={{ background: '#00D4AA' }}
            />
          </div>

          {/* ── PREVIEW completion pulse ── */}
          <AnimatePresence>
            {state === 'PREVIEW' && !reduce ? (
              <motion.div
                key={`pulse-${pulseKey}`}
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-[32px]"
                initial={{ boxShadow: '0 0 0 0 rgba(0,212,170,0)' }}
                animate={{
                  boxShadow: [
                    '0 0 0 0 rgba(0,212,170,0)',
                    '0 0 70px rgba(0,212,170,0.38), 0 0 0 6px rgba(0,212,170,0.08) inset',
                    '0 0 0 0 rgba(0,212,170,0)',
                  ],
                }}
                exit={{ boxShadow: '0 0 0 0 rgba(0,212,170,0)' }}
                transition={{
                  duration: 0.95,
                  ease: PM_EASE,
                  times: [0, 0.5, 1],
                }}
              />
            ) : null}
          </AnimatePresence>

          {/* ── PREVIEW watermark ── */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
            style={{
              color: '#FFFFFF',
              opacity: showSealed ? 0.065 : 0,
              fontWeight: 900,
              fontSize: compact ? 64 : 104,
              letterSpacing: '0.20em',
              transform: 'rotate(-30deg)',
              transition: 'opacity 600ms cubic-bezier(0.16,1,0.3,1)',
              fontFamily:
                "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}
          >
            PREVIEW
          </span>

          {/* ── Header ── */}
          <motion.div
            layout="position"
            className="relative z-10 flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:pb-6"
            style={{ borderColor: '#1C1A38' }}
          >
            <div>
              <h2
                className={[
                  'font-extrabold tracking-tighter leading-[1.04] text-white',
                  compact
                    ? 'text-[22px] sm:text-2xl'
                    : 'text-2xl sm:text-3xl md:text-[40px]',
                ].join(' ')}
                style={{
                  fontFamily:
                    "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  letterSpacing: '-0.025em',
                }}
              >
                CERTIFICATE OF
                <br />
                AUTHENTICITY
              </h2>
              <p
                className="mt-2.5 text-[11px] font-bold uppercase tracking-[0.26em]"
                style={{ color: '#A8A0D8' }}
              >
                ProofMark Digital Existence Certificate
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusChip state={state} />
              <FounderChip />
            </div>
          </motion.div>

          {/* ── Body grid ── */}
          <motion.div
            layout
            className={[
              'relative z-10 mt-7 grid gap-7 sm:gap-9',
              compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-[2fr_3fr]',
            ].join(' ')}
          >
            {/* Left: artwork */}
            <motion.div layout="position" className="flex-shrink-0">
              <ArtworkSlab
                state={state}
                file={file}
                previewUrl={previewUrl}
                hashProgress={hashProgress}
                compact={compact}
              />
            </motion.div>

            {/* Right: data */}
            <motion.div
              key={`data-${state}`}
              layout="position"
              variants={buildContainer(reduce)}
              initial="hidden"
              animate="visible"
              className="flex flex-col justify-center gap-6"
            >
              {/* Certificate ID */}
              <motion.div variants={buildItem(reduce)}>
                <KvLabel>Certificate ID</KvLabel>
                {state === 'IDLE' ? (
                  <KvGhost mono />
                ) : state === 'HASHING' ? (
                  <ShimmerLine mono width="80%" />
                ) : (
                  <p
                    className="font-mono text-[11px] sm:text-xs text-white/85"
                    title="プレビュー段階の暫定 ID です。正式発行時に確定します。"
                  >
                    {provisionalId}{' '}
                    <span
                      className="ml-1 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] tracking-[0.22em]"
                      style={{
                        borderColor: 'rgba(255,255,255,0.16)',
                        color: 'rgba(255,255,255,0.55)',
                      }}
                    >
                      PROVISIONAL
                    </span>
                  </p>
                )}
              </motion.div>

              {/* Protected Asset */}
              <motion.div variants={buildItem(reduce)}>
                <KvLabel icon={<FileText className="h-3 w-3" />}>
                  Protected Asset
                </KvLabel>
                {file ? (
                  <p className="truncate text-sm font-medium text-white sm:text-[15px]">
                    {file.name}
                  </p>
                ) : (
                  <KvGhost />
                )}
              </motion.div>

              {/* SHA-256 panel */}
              <motion.div variants={buildItem(reduce)}>
                <div
                  className="rounded-2xl border p-4 sm:p-5"
                  style={{
                    borderColor: 'rgba(0,212,170,0.22)',
                    background:
                      'linear-gradient(90deg, rgba(0,212,170,0.10) 0%, rgba(0,212,170,0) 100%)',
                    boxShadow:
                      'inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 24px rgba(0,0,0,0.18)',
                  }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <CheckCircle2
                      className="h-4 w-4"
                      style={{ color: '#00D4AA' }}
                    />
                    <h3
                      className="text-[10px] font-bold uppercase tracking-[0.26em] sm:text-xs"
                      style={{ color: '#00D4AA' }}
                    >
                      SHA-256 Hash Signature
                    </h3>
                  </div>

                  {state === 'IDLE' ? (
                    <ShimmerLine mono width="95%" muted />
                  ) : state === 'HASHING' ? (
                    <HashShimmerLine progress={hashProgress} />
                  ) : (
                    <p
                      className="font-mono break-all text-[10px] leading-relaxed text-[#F0EFF8] sm:text-xs"
                      style={{ wordBreak: 'break-all' }}
                    >
                      {hash}
                    </p>
                  )}
                </div>
              </motion.div>

              {/* Timestamp + QR */}
              <motion.div
                variants={buildItem(reduce)}
                className="flex flex-row items-center justify-between gap-6 border-t pt-6"
                style={{ borderColor: '#1C1A38' }}
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <Clock className="h-4 w-4" style={{ color: '#F0BB38' }} />
                    <h3
                      className="text-[10px] font-bold uppercase tracking-[0.26em] sm:text-xs"
                      style={{ color: '#F0BB38' }}
                    >
                      Digital Timestamp (JST)
                    </h3>
                  </div>
                  <LiveTimestamp running={state !== 'IDLE'} />
                  <RfcChip live={showSealed} />
                  <p
                    className="mt-1.5 text-[10px] sm:text-[11px]"
                    style={{ color: '#A8A0D8' }}
                  >
                    改ざん不能な技術で真正性が担保されています
                  </p>
                </div>

                <QrSlab state={state} />
              </motion.div>

              {/* Preview disclaimer */}
              {showSealed && (
                <motion.p
                  variants={buildItem(reduce)}
                  className="border-t pt-4 text-[11px] leading-relaxed sm:text-xs"
                  style={{
                    borderColor: '#1C1A38',
                    color: 'rgba(255,255,255,0.55)',
                  }}
                >
                  ⚠ これはプレビューです。正式発行後に Certificate ID と QR
                  コードが確定します。
                </motion.p>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      </LayoutGroup>
    </MotionConfig>
  );
}

/* ─────────────────────────────────────────────
 *  Subcomponents
 * ───────────────────────────────────────────── */

function StatusChip({ state }: { state: SpotState }): JSX.Element {
  if (state === 'PREVIEW' || state === 'PAYING') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em]"
        style={{
          background: 'rgba(0,212,170,0.10)',
          borderColor: 'rgba(0,212,170,0.45)',
          color: '#00D4AA',
        }}
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        Verified · Preview
      </span>
    );
  }
  if (state === 'HASHING') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em]"
        style={{
          background: 'rgba(108,62,244,0.10)',
          borderColor: 'rgba(108,62,244,0.45)',
          color: '#BC78FF',
        }}
      >
        <Layers
          className="h-3.5 w-3.5 animate-spin"
          style={{ animationDuration: '2.4s' }}
        />
        Hashing
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em]"
      style={{
        background: 'rgba(255,255,255,0.04)',
        borderColor: 'rgba(255,255,255,0.10)',
        color: 'rgba(255,255,255,0.50)',
      }}
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      Awaiting File
    </span>
  );
}

function FounderChip(): JSX.Element {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em]"
      style={{
        background: 'rgba(240,187,56,0.06)',
        borderColor: 'rgba(240,187,56,0.45)',
        color: '#F0BB38',
        boxShadow: '0 0 12px rgba(240,187,56,0.18)',
      }}
    >
      <Sparkles className="h-3.5 w-3.5" />
      Founder
    </span>
  );
}

function ArtworkSlab({
  state,
  file,
  previewUrl,
  hashProgress,
  compact,
}: {
  state: SpotState;
  file: File | null;
  previewUrl: string | null;
  hashProgress: number;
  compact: boolean;
}): JSX.Element {
  const sealed = state === 'PREVIEW' || state === 'PAYING';
  return (
    <div
      className={[
        'relative aspect-square w-full overflow-hidden rounded-[20px] border',
        compact ? 'max-w-[260px]' : 'max-w-[360px]',
      ].join(' ')}
      style={{
        borderColor: '#1C1A38',
        background: '#07061A',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.04), 0 14px 28px rgba(0,0,0,0.42)',
      }}
    >
      {/* artwork or fallback */}
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={file?.name ?? 'preview'}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <GhostArtwork file={file} />
      )}

      {/* scan beam during hashing */}
      <AnimatePresence>
        {state === 'HASHING' ? (
          <>
            <motion.div
              key="beam"
              aria-hidden
              className="absolute inset-x-0 h-12"
              initial={{ y: -48 }}
              animate={{ y: ['-12%', '108%'] }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: 'linear',
              }}
              style={{
                background:
                  'linear-gradient(180deg, rgba(0,212,170,0) 0%, rgba(0,212,170,0.34) 50%, rgba(0,212,170,0) 100%)',
                filter: 'blur(4px)',
                mixBlendMode: 'screen',
              }}
            />
            <motion.div
              key="bar"
              aria-hidden
              className="absolute inset-x-3 bottom-3 h-1 overflow-hidden rounded-full"
              style={{ background: 'rgba(255,255,255,0.08)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="h-full"
                animate={{
                  width: `${Math.max(4, Math.min(100, hashProgress))}%`,
                }}
                transition={{ duration: 0.3, ease: PM_EASE }}
                style={{
                  background:
                    'linear-gradient(90deg, #6C3EF4 0%, #00D4AA 100%)',
                  boxShadow: '0 0 12px rgba(0,212,170,0.6)',
                }}
              />
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      {/* sealed badge on PREVIEW/PAYING */}
      <AnimatePresence>
        {sealed ? (
          <motion.div
            key="seal"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: PM_EASE }}
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em]"
            style={{
              background: 'rgba(0,212,170,0.16)',
              borderColor: 'rgba(0,212,170,0.45)',
              color: '#00D4AA',
              backdropFilter: 'blur(8px)',
            }}
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Sealed
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function GhostArtwork({ file }: { file: File | null }): JSX.Element {
  const ext = useMemo(() => {
    if (!file) return '—';
    const dot = file.name.lastIndexOf('.');
    return dot > -1 ? file.name.slice(dot + 1).toUpperCase() : 'BIN';
  }, [file]);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        className="flex flex-col items-center gap-3"
        style={{ color: 'rgba(255,255,255,0.18)' }}
      >
        <FileText className="h-12 w-12" />
        <span className="text-[10px] font-black tracking-[0.32em]">
          {file ? ext : 'AWAITING ASSET'}
        </span>
      </div>
    </div>
  );
}

function QrSlab({ state }: { state: SpotState }): JSX.Element {
  const ready = state === 'PREVIEW' || state === 'PAYING';
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="relative rounded-xl border bg-white p-2 shadow-lg sm:p-3"
        style={{
          borderColor: '#E5E5EA',
          boxShadow:
            '0 8px 16px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        <FakeQrCells />
        {!ready ? (
          <span
            aria-hidden
            className="absolute inset-0 rounded-xl"
            style={{
              backdropFilter: 'blur(5px)',
              background: 'rgba(255,255,255,0.55)',
            }}
          />
        ) : null}
      </div>
      <span
        className="text-[8px] font-bold uppercase tracking-[0.26em] sm:text-[10px]"
        style={{ color: ready ? '#00D4AA' : '#A8A0D8' }}
      >
        Scan to Verify
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────
 *  Premium QR — 中央に Lock アイコンを内包
 * ───────────────────────────────────────────── */
function FakeQrCells(): JSX.Element {
  const cells = useMemo<boolean[]>(() => {
    const out: boolean[] = [];
    let seed = 9876;
    for (let i = 0; i < 81; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      out.push(seed / 233280 > 0.5);
    }
    // 三隅のポジションマーカー
    const markers = [
      [0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2],
      [0, 6], [0, 7], [0, 8], [1, 6], [1, 8], [2, 6], [2, 7], [2, 8],
      [6, 0], [6, 1], [6, 2], [7, 0], [7, 2], [8, 0], [8, 1], [8, 2],
    ];
    for (const [r, c] of markers) out[r * 9 + c] = true;

    // 中央 3x3 を白抜き (Lock アイコン用)
    for (let r = 3; r <= 5; r++) {
      for (let c = 3; c <= 5; c++) {
        out[r * 9 + c] = false;
      }
    }
    return out;
  }, []);

  return (
    <div className="relative flex items-center justify-center">
      <div
        className="grid grid-cols-9 gap-[2px]"
        style={{ width: 70, height: 70 }}
      >
        {cells.map((on, i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              background: on ? '#000000' : '#FFFFFF',
              borderRadius: 1,
            }}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="flex items-center justify-center rounded-md border bg-white p-1 shadow-sm"
          style={{ borderColor: '#E5E5EA' }}
        >
          <Lock className="h-4 w-4 text-zinc-900" />
        </div>
      </div>
    </div>
  );
}

function KvLabel({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}): JSX.Element {
  return (
    <p
      className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.26em] sm:text-xs"
      style={{ color: '#A8A0D8' }}
    >
      {icon}
      {children}
    </p>
  );
}

function KvGhost({ mono = false }: { mono?: boolean }): JSX.Element {
  return (
    <div
      className={['h-4 w-[60%] rounded-md', mono ? 'font-mono' : ''].join(' ')}
      style={{ background: 'rgba(255,255,255,0.06)' }}
    />
  );
}

function ShimmerLine({
  width = '80%',
  mono = false,
  muted = false,
}: {
  width?: string;
  mono?: boolean;
  muted?: boolean;
}): JSX.Element {
  return (
    <div
      className={[
        'relative h-4 overflow-hidden rounded-md',
        mono ? 'font-mono' : '',
      ].join(' ')}
      style={{
        width,
        background: muted
          ? 'rgba(255,255,255,0.05)'
          : 'rgba(255,255,255,0.08)',
      }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)',
        }}
        initial={{ x: '-100%' }}
        animate={{ x: '100%' }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
 *  HashShimmer (Stripe philosophy で段階ステータス可視化)
 * ───────────────────────────────────────────── */
function HashShimmerLine({ progress }: { progress: number }): JSX.Element {
  const status = getHashingStatusText(progress);
  const sub = getHashingSubText(progress);

  return (
    <div className="space-y-2">
      <div
        className="relative h-3.5 overflow-hidden rounded-md font-mono"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <motion.div
          className="absolute inset-0"
          initial={{ backgroundPosition: '-200% center' }}
          animate={{ backgroundPosition: '200% center' }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
          style={{
            background:
              'linear-gradient(90deg, rgba(0,212,170,0.18) 0%, rgba(0,212,170,1) 50%, rgba(0,212,170,0.18) 100%)',
            backgroundSize: '200% auto',
            mixBlendMode: 'screen',
            opacity: 0.7,
          }}
        />
      </div>
      <div
        className="relative h-3.5 overflow-hidden rounded-md font-mono"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <motion.div
          className="absolute inset-0"
          initial={{ backgroundPosition: '-200% center' }}
          animate={{ backgroundPosition: '200% center' }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: 'linear',
            delay: 0.3,
          }}
          style={{
            background:
              'linear-gradient(90deg, rgba(0,212,170,0.18) 0%, rgba(0,212,170,1) 50%, rgba(0,212,170,0.18) 100%)',
            backgroundSize: '200% auto',
            mixBlendMode: 'screen',
            opacity: 0.6,
          }}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={status}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.28, ease: PM_EASE }}
          className="flex items-baseline justify-between gap-3"
        >
          <span
            className="text-[11px] font-semibold"
            style={{ color: 'rgba(255,255,255,0.78)' }}
          >
            {status}
          </span>
          <span
            className="font-mono text-[10px]"
            style={{ color: 'rgba(255,255,255,0.45)' }}
          >
            {Math.max(0, Math.min(100, Math.round(progress)))}%
          </span>
        </motion.div>
      </AnimatePresence>

      <p
        className="text-[10px] font-mono"
        style={{ color: 'rgba(255,255,255,0.35)' }}
      >
        {sub}
      </p>
    </div>
  );
}

function LiveTimestamp({ running }: { running: boolean }): JSX.Element {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  return (
    <p
      className="text-xl font-bold tracking-tight text-white sm:text-[26px]"
      style={{
        fontFamily:
          "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        letterSpacing: '-0.015em',
      }}
    >
      {running ? now.toLocaleString('ja-JP', { hour12: false }) : '— — — —'}
    </p>
  );
}

function RfcChip({ live }: { live: boolean }): JSX.Element {
  return (
    <div
      className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1"
      style={{
        background: live
          ? 'rgba(0,212,170,0.10)'
          : 'rgba(255,255,255,0.04)',
        borderColor: live
          ? 'rgba(0,212,170,0.30)'
          : 'rgba(255,255,255,0.08)',
        color: live ? '#00D4AA' : 'rgba(255,255,255,0.40)',
        transition: 'all 400ms cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      <span className="text-[10px] font-black uppercase tracking-[0.26em]">
        RFC3161 {live ? 'Verified · Preview' : 'Pending'}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────
 *  Helpers
 * ───────────────────────────────────────────── */

function makeProvisionalId(hash: string | null): string {
  if (!hash) return 'a3f7-8b2c-…-pending';
  const a = hash.slice(0, 4);
  const b = hash.slice(4, 8);
  const c = hash.slice(8, 16);
  const d = hash.slice(16, 24);
  return `${a}-${b}-${c}-${d}`;
}
