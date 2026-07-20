"use client";

/**
 * src/components/console/ConsoleDropzoneClient.tsx
 * ─────────────────────────────────────────────────────────────────────────
 * Console 2.0 · The Video Dropzone (Apex Zero-Jank + Oracle Sync Edition)
 *
 * 🩸 Zero-Jank Doctrine:
 *   - Worker から届く 60ms 間隔の高頻度 PROGRESS は useState を一切前提としない。
 *   - useForge({ onProgressDirect }) から流れる percent を、
 *     useMotionValue → useMotionTemplate 経由で直接 CSS width にバインド。
 *   - Framer Motion の <motion.div style={{ width: … }} /> は
 *     Virtual DOM を再計算しない (transform/width はコンポジタで完結)。
 *   - 数値表示 (%, MB) は <motion.span> の onChange で innerText を
 *     直接ミューテーションし、React 経由の再レンダーをゼロに封殺。
 * 
 * 🔮 The Oracle Sync:
 *   - アップロード完了 (success) と同時に useOracleSync が起動。
 *   - Supabase Realtime (WebSocket) 経由で Mac mini のジョブステータスを監視。
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
} from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  Copy,
  Fingerprint,
  Film,
  Loader2,
  Lock,
  Rocket,
  Sparkles,
  ShieldCheck,
  UploadCloud,
  X,
  Zap,
  Server,
  Activity,
} from 'lucide-react';

import { useSafeReducedMotion } from '@/hooks/useSafeReducedMotion';
import { useForge, type ForgeStage } from '@/hooks/useForge';
import { useOracleSync } from '@/hooks/useOracleSync';

/* ══════════════════════════════════════════════════════════════
 *  Constants — The Physics
 * ══════════════════════════════════════════════════════════════ */

const ACCEPTED_MIME_PREFIX = 'video/';
const ACCEPTED_EXTS = ['.mp4', '.mov', '.m4v', '.webm'] as const;
const MAX_FILE_BYTES = 4 * 1024 * 1024 * 1024;
const SCRAMBLE_TICK_MS = 33;

/* ══════════════════════════════════════════════════════════════
 *  Types
 * ══════════════════════════════════════════════════════════════ */

type PhaseKey = 'idle' | 'dragging' | 'hashing' | 'decoding' | 'muxing' | 'uploading' | 'success' | 'error';

export interface ConsoleDropzoneClientProps {
  onCommit?: (info: { cid: string; certificateId: string | null; fileName: string; bytes: number }) => void;
  headline?: string;
  subheadline?: string;
  className?: string;
}

/* ══════════════════════════════════════════════════════════════
 *  Helpers
 * ══════════════════════════════════════════════════════════════ */

const HEX = '0123456789abcdef';
function randomHex(len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) out += HEX[(Math.random() * 16) | 0];
  return out;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / Math.pow(1024, idx);
  return `${v.toFixed(v >= 100 || idx === 0 ? 0 : v >= 10 ? 1 : 2)} ${units[idx]}`;
}

function pickAcceptedError(file: File): string | null {
  if (file.size <= 0) return 'ファイルが空です。動画データを含んでいるか確認してください。';
  if (file.size > MAX_FILE_BYTES) {
    return `4GB を超えるファイルはブラウザで安全にハッシュできません (${formatBytes(file.size)})。動画を分割してください。`;
  }
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const okMime = type.startsWith(ACCEPTED_MIME_PREFIX);
  const okExt = ACCEPTED_EXTS.some((ext) => name.endsWith(ext));
  if (!okMime && !okExt) return '対応形式は MP4 / MOV / M4V / WebM です。';
  return null;
}

function stageToPhase(stage: ForgeStage): PhaseKey {
  switch (stage) {
    case 'hashing': return 'hashing';
    case 'decoding': return 'decoding';
    case 'muxing': return 'muxing';
    case 'uploading': return 'uploading';
    case 'finalizing': return 'uploading';
    default: return 'idle';
  }
}

/* ══════════════════════════════════════════════════════════════
 *  Sub-Components
 * ══════════════════════════════════════════════════════════════ */

function ScramblingHash({ reduce }: { reduce: boolean }) {
  const [str, setStr] = useState<string>(() => randomHex(64));

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setStr(randomHex(64)), SCRAMBLE_TICK_MS);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <div className="mt-4 select-none">
      <p className="text-[10px] font-mono uppercase tracking-[0.36em] text-[#00D4AA]/80 mb-1.5">
        [ CALCULATING MASTER HASH... ]
      </p>
      <p
        className="font-mono text-[13px] sm:text-[14.5px] leading-relaxed break-all"
        style={{
          background: 'linear-gradient(90deg, #6C3EF4 0%, #00D4AA 55%, #BC78FF 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          filter: 'drop-shadow(0 0 8px rgba(0,212,170,0.25))',
        }}
      >
        {str}
      </p>
    </div>
  );
}

function DirectFlowMeter({
  reduce,
  percentMV,
  stageLabelMV,
  totalBytes,
  accent = 'purple',
}: {
  reduce: boolean;
  percentMV: ReturnType<typeof useMotionValue<number>>;
  stageLabelMV: ReturnType<typeof useMotionValue<string>>;
  totalBytes: number;
  accent?: 'purple' | 'teal';
}) {
  const pctRef = useRef<HTMLSpanElement | null>(null);
  const bytesRef = useRef<HTMLSpanElement | null>(null);
  const stageRef = useRef<HTMLSpanElement | null>(null);

  const clampedPercent = useTransform(percentMV, (v) => {
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(100, v));
  });
  const width = useMotionTemplate`${clampedPercent}%`;

  useMotionValueEvent(clampedPercent, 'change', (v) => {
    if (pctRef.current) pctRef.current.innerText = `${v.toFixed(1)}%`;
    if (bytesRef.current) {
      const sent = totalBytes > 0 ? Math.floor((v / 100) * totalBytes) : 0;
      bytesRef.current.innerText = `${formatBytes(sent)} / ${formatBytes(totalBytes)}`;
    }
  });
  useMotionValueEvent(stageLabelMV, 'change', (v) => {
    if (stageRef.current) stageRef.current.innerText = v;
  });

  const barGradient =
    accent === 'teal'
      ? 'linear-gradient(90deg, #00D4AA 0%, #6C3EF4 100%)'
      : 'linear-gradient(90deg, #6C3EF4 0%, #00D4AA 100%)';
  const barShadow =
    accent === 'teal'
      ? '0 0 18px rgba(0,212,170,0.75), 0 0 4px rgba(255,255,255,0.35) inset'
      : '0 0 14px rgba(0,212,170,0.55)';
  const borderClr =
    accent === 'teal' ? 'rgba(0,212,170,0.14)' : 'rgba(255,255,255,0.05)';
  const innerGlow =
    accent === 'teal'
      ? 'inset 0 0 12px rgba(0,212,170,0.10)'
      : 'inset 0 0 0 rgba(0,0,0,0)';

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-1.5">
        <span
          ref={stageRef}
          className="text-[10px] font-mono uppercase tracking-[0.28em] text-white/55"
        >
          {stageLabelMV.get()}
        </span>
        <span className="text-[10px] font-mono tabular-nums text-white/45">
          <span ref={bytesRef}>{formatBytes(0)} / {formatBytes(totalBytes)}</span>
        </span>
      </div>
      <div
        className="relative h-[8px] rounded-full overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${borderClr}`,
          boxShadow: innerGlow,
        }}
      >
        <motion.div
          className="absolute inset-y-0 left-0"
          style={{
            width,
            background: barGradient,
            boxShadow: barShadow,
            willChange: 'width',
          }}
        />
        {!reduce && (
          <motion.div
            aria-hidden
            className="absolute inset-y-0 w-20 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
              mixBlendMode: 'screen',
            }}
            animate={{ x: ['-80px', '110%'] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
          />
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono tabular-nums text-white/40">
        <span ref={pctRef} className="uppercase tracking-[0.22em]">0.0%</span>
        <span className="uppercase tracking-[0.22em] text-white/30">Direct-Flow · Zero-Render</span>
      </div>
    </div>
  );
}

function PhaseBadge({ phase, reduce }: { phase: PhaseKey; reduce: boolean }) {
  const map: Record<PhaseKey, { label: string; icon: React.ReactNode; color: string; rgb: string }> = {
    idle: {
      label: 'READY · DROP THE TAPE',
      icon: <UploadCloud className="w-3.5 h-3.5" />,
      color: '#A8A0D8', rgb: '168,160,216',
    },
    dragging: {
      label: 'LOCK ACQUIRED · RELEASE TO SEAL',
      icon: <Zap className="w-3.5 h-3.5" />,
      color: '#00D4AA', rgb: '0,212,170',
    },
    hashing: {
      label: 'HASHING · WASM STREAM ONLINE',
      icon: <Fingerprint className="w-3.5 h-3.5" />,
      color: '#BC78FF', rgb: '188,120,255',
    },
    decoding: {
      label: 'DECODING · WEBCODECS GPU',
      icon: <Film className="w-3.5 h-3.5" />,
      color: '#BC78FF', rgb: '188,120,255',
    },
    muxing: {
      label: 'MUXING · ALL-INTRA MP4',
      icon: <Sparkles className="w-3.5 h-3.5" />,
      color: '#BC78FF', rgb: '188,120,255',
    },
    uploading: {
      label: 'BROADCASTING · SECURE CHANNEL',
      icon: <Rocket className="w-3.5 h-3.5" />,
      color: '#00D4AA', rgb: '0,212,170',
    },
    success: {
      label: 'SEALED · MASTER HASH LOCKED',
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
      color: '#00D4AA', rgb: '0,212,170',
    },
    error: {
      label: 'FAILED · RETRY THE SEQUENCE',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      color: '#FF6B6B', rgb: '255,107,107',
    },
  };
  const m = map[phase];
  return (
    <motion.span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.22em] whitespace-nowrap"
      style={{
        background: `rgba(${m.rgb}, 0.10)`,
        border: `1px solid rgba(${m.rgb}, 0.45)`,
        color: m.color,
      }}
      animate={
        reduce
          ? undefined
          : {
              boxShadow: [
                `0 0 0 0 rgba(${m.rgb}, 0.5)`,
                `0 0 0 6px rgba(${m.rgb}, 0)`,
                `0 0 0 0 rgba(${m.rgb}, 0.5)`,
              ],
            }
      }
      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
    >
      {m.icon}
      {m.label}
    </motion.span>
  );
}

/* ══════════════════════════════════════════════════════════════
 *  Main Component
 * ══════════════════════════════════════════════════════════════ */

export default function ConsoleDropzoneClient({
  onCommit,
  headline = 'ChronoAnchor · Master Hash Ingest',
  subheadline = 'タイムラプス動画を投下し、ブラウザ内で SHA-256 マスターハッシュを封印します。',
  className,
}: ConsoleDropzoneClientProps) {
  const reduce = useSafeReducedMotion();

  const [phase, setPhase] = useState<PhaseKey>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [committedCid, setCommittedCid] = useState<string | null>(null);
  const [certificateId, setCertificateId] = useState<string | null>(null);

  const percentMV = useMotionValue(0);
  const stageLabelMV = useMotionValue<string>('READY');

  const dragCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const forgeOptions = useMemo(() => ({
    onProgressDirect: (percent: number, stage: 'hashing' | 'decoding' | 'muxing') => {
      percentMV.set(percent);
      const label =
        stage === 'hashing'
          ? 'SHA-256 · STREAM'
          : stage === 'decoding'
            ? 'WEBCODECS · DECODE'
            : 'ALL-INTRA · MUX';
      if (stageLabelMV.get() !== label) stageLabelMV.set(label);
    },
  }), []);

  const { state: forgeState, startForge, cancel: cancelForge } = useForge(forgeOptions);

  // 🔮 The Oracle Sync: DB打刻完了後に発行された certificateId を監視
  const { jobStatus: oracleStatus, jobError: oracleError } = useOracleSync(certificateId);

  useEffect(() => {
    if (forgeState.error) {
      setError(forgeState.error);
      setPhase('error');
      return;
    }
    if (!forgeState.isForging && forgeState.cid) {
      setCommittedCid(forgeState.cid);
      setCertificateId(forgeState.certificateId);
      percentMV.set(100);
      stageLabelMV.set('SEALED');
      setPhase('success');
      if (file) {
        onCommit?.({
          cid: forgeState.cid,
          certificateId: forgeState.certificateId,
          fileName: file.name,
          bytes: file.size,
        });
      }
      return;
    }
    if (forgeState.isForging) {
      setPhase(stageToPhase(forgeState.stage));
    }
  }, [forgeState.error, forgeState.isForging, forgeState.cid, forgeState.certificateId, forgeState.stage, file, onCommit, percentMV, stageLabelMV]);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const tiltX = useSpring(useTransform(my, [-1, 1], [3.5, -3.5]), { stiffness: 180, damping: 20 });
  const tiltY = useSpring(useTransform(mx, [-1, 1], [-3.5, 3.5]), { stiffness: 180, damping: 20 });

  useEffect(() => {
    return () => { try { cancelForge(); } catch { /* noop */ } };
  }, [cancelForge]);

  const isActive = phase === 'dragging';
  const isBusy =
    phase === 'hashing' || phase === 'decoding' || phase === 'muxing' || phase === 'uploading';

  const resetToIdle = useCallback(() => {
    cancelForge();
    dragCounter.current = 0;
    setFile(null);
    setError(null);
    setCopied(false);
    setCommittedCid(null);
    setCertificateId(null);
    percentMV.set(0);
    stageLabelMV.set('READY');
    setPhase('idle');
  }, [cancelForge, percentMV, stageLabelMV]);

  const beginForge = useCallback(
    (dropped: File) => {
      const problem = pickAcceptedError(dropped);
      if (problem) {
        setError(problem);
        setPhase('error');
        return;
      }
      setFile(dropped);
      setError(null);
      setCommittedCid(null);
      setCertificateId(null);
      percentMV.set(0);
      stageLabelMV.set('SHA-256 · STREAM');
      setPhase('hashing');
      startForge(dropped);
    },
    [percentMV, stageLabelMV, startForge],
  );

  const openPicker = useCallback(() => {
    if (isBusy) return;
    inputRef.current?.click();
  }, [isBusy]);

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      e.currentTarget.value = '';
      beginForge(f);
    },
    [beginForge],
  );

  const onDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (isBusy) return;
      if (!Array.from(e.dataTransfer.types).includes('Files')) return;
      e.preventDefault(); e.stopPropagation();
      dragCounter.current += 1;
      setPhase((p) => (p === 'idle' || p === 'dragging' ? 'dragging' : p));
    },
    [isBusy],
  );

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault(); e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setPhase((p) => (p === 'dragging' ? 'idle' : p));
  }, []);

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current = 0;
    if (isBusy) return;
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) { setPhase('idle'); return; }
    beginForge(dropped);
  }, [beginForge, isBusy]);

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const rx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ry = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      mx.set(rx); my.set(ry);
    },
    [mx, my],
  );
  const onPointerLeave = useCallback(() => { mx.set(0); my.set(0); }, [mx, my]);

  const copyHash = useCallback(async () => {
    if (!committedCid) return;
    try {
      await navigator.clipboard.writeText(committedCid);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  }, [committedCid]);

  const borderColor = useMemo(() => {
    switch (phase) {
      case 'dragging': return 'rgba(0,212,170,0.75)';
      case 'hashing':
      case 'decoding':
      case 'muxing':   return 'rgba(188,120,255,0.55)';
      case 'uploading':return 'rgba(0,212,170,0.60)';
      case 'success':  return 'rgba(0,212,170,0.75)';
      case 'error':    return 'rgba(255,107,107,0.55)';
      default:         return 'rgba(255,255,255,0.09)';
    }
  }, [phase]);

  const boxGlow = useMemo(() => {
    switch (phase) {
      case 'dragging':
        return '0 0 0 1px rgba(0,212,170,0.35), 0 40px 80px -30px rgba(0,212,170,0.45), 0 0 80px rgba(108,62,244,0.25) inset';
      case 'hashing':
      case 'decoding':
      case 'muxing':
        return '0 0 0 1px rgba(188,120,255,0.35), 0 40px 80px -30px rgba(108,62,244,0.55), 0 0 80px rgba(108,62,244,0.28) inset';
      case 'uploading':
      case 'success':
        return '0 0 0 1px rgba(0,212,170,0.35), 0 40px 80px -30px rgba(0,212,170,0.55), 0 0 80px rgba(0,212,170,0.20) inset';
      case 'error':
        return '0 0 0 1px rgba(255,107,107,0.35), 0 40px 80px -30px rgba(255,107,107,0.45)';
      default:
        return '0 30px 60px -30px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03) inset';
    }
  }, [phase]);

  const showProcessing =
    phase === 'hashing' || phase === 'decoding' || phase === 'muxing' || phase === 'uploading';

  return (
    <section
      className={['relative w-full max-w-3xl mx-auto', className ?? ''].join(' ')}
      aria-labelledby="console-dropzone-heading"
    >
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full opacity-[0.09] blur-[120px]" style={{ background: '#6C3EF4' }} />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 w-[420px] h-[420px] rounded-full opacity-[0.09] blur-[120px]" style={{ background: '#00D4AA' }} />

      <div className="relative mb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/40">
            Console 2.0 · Video Dropzone
          </p>
          <h2 id="console-dropzone-heading" className="mt-1 text-[20px] sm:text-[22px] font-black tracking-tight text-white">
            {headline}
          </h2>
          <p className="mt-1 text-[12.5px] text-white/55 max-w-xl leading-relaxed">
            {subheadline}
          </p>
        </div>
        <PhaseBadge phase={phase} reduce={reduce} />
      </div>

      <motion.div
        role="button"
        tabIndex={0}
        aria-label="タイムラプス動画をドロップまたは選択して SHA-256 マスターハッシュを計算する"
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); }
        }}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onPointerMove={reduce ? undefined : onPointerMove}
        onPointerLeave={reduce ? undefined : onPointerLeave}
        animate={reduce ? { scale: 1 } : { scale: isActive ? 1.012 : isBusy ? 1.006 : 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        style={{
          rotateX: reduce ? 0 : (tiltX as unknown as number),
          rotateY: reduce ? 0 : (tiltY as unknown as number),
          transformPerspective: 900,
        }}
        className={[
          'relative w-full min-h-[360px] cursor-pointer overflow-hidden rounded-3xl outline-none',
          'transition-colors duration-300',
          isBusy ? 'cursor-progress' : '',
        ].join(' ')}
      >
        <div
          aria-hidden
          className="absolute inset-0 rounded-3xl"
          style={{
            background: 'linear-gradient(165deg, rgba(15,12,32,0.96) 0%, rgba(7,6,26,0.98) 55%, rgba(11,7,38,0.98) 100%)',
            border: `1px solid ${borderColor}`,
            boxShadow: boxGlow,
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            transition: 'border-color 220ms ease, box-shadow 320ms ease',
          }}
        />

        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.08]"
          style={{
            backgroundImage: 'linear-gradient(rgba(0,212,170,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(108,62,244,0.35) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            maskImage: 'radial-gradient(ellipse at 50% 50%, black 50%, transparent 85%)',
            WebkitMaskImage: 'radial-gradient(ellipse at 50% 50%, black 50%, transparent 85%)',
          }}
        />

        {!reduce && (
          <motion.div
            aria-hidden
            className="absolute inset-0 pointer-events-none rounded-3xl"
            style={{
              background: 'radial-gradient(circle at 50% 45%, rgba(0,212,170,0.20), transparent 60%), radial-gradient(circle at 50% 55%, rgba(108,62,244,0.18), transparent 60%)',
              opacity: isActive ? 1 : 0,
              transition: 'opacity 300ms ease',
            }}
            animate={isActive ? { scale: [1, 1.04, 1], opacity: [0.85, 1, 0.85] } : { scale: 1, opacity: 0 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px rounded-t-3xl"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(108,62,244,0.8), rgba(0,212,170,0.8), transparent)' }}
        />

        <div className="relative z-10 flex flex-col items-center justify-center px-6 py-10 sm:py-12 min-h-[360px]">
          <AnimatePresence mode="wait" initial={false}>
            {(phase === 'idle' || phase === 'dragging' || phase === 'error') && (
              <motion.div
                key={`state-${phase}`}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="w-full text-center"
              >
                <motion.div
                  className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{
                    background: isActive
                      ? 'linear-gradient(135deg, #00D4AA 0%, #6C3EF4 100%)'
                      : 'linear-gradient(135deg, rgba(108,62,244,0.35) 0%, rgba(0,212,170,0.25) 100%)',
                    boxShadow: isActive
                      ? '0 20px 50px -18px rgba(0,212,170,0.65)'
                      : '0 20px 50px -18px rgba(108,62,244,0.45)',
                  }}
                  animate={
                    reduce ? undefined
                      : isActive ? { y: [-2, 2, -2] } : { y: [0, -3, 0] }
                  }
                  transition={{ duration: isActive ? 1.4 : 3.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {phase === 'error'
                    ? <AlertTriangle className="w-7 h-7 text-white" strokeWidth={2} />
                    : isActive
                      ? <CloudUpload className="w-7 h-7 text-white" strokeWidth={2} />
                      : <Film className="w-7 h-7 text-white" strokeWidth={2} />}
                </motion.div>

                <h3 className="text-white text-[17px] sm:text-[19px] font-black tracking-tight">
                  {phase === 'error' ? 'Sequence Aborted' : isActive ? 'RELEASE TO SEAL THE TAPE' : 'タイムラプスMP4をここに落とす'}
                </h3>
                <p className="mt-1.5 text-[12.5px] text-white/55 max-w-md mx-auto leading-relaxed">
                  {phase === 'error'
                    ? error ?? '不明なエラーが発生しました。'
                    : isActive
                      ? '磁場が捕捉しています。指を離すと即座にハッシュ計算が始まります。'
                      : 'MP4 / MOV / M4V / WebM · 最大 4GB。ハッシュ計算とMP4精製は端末内で完結し、動画はサーバーに送信されません。'}
                </p>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[10.5px] font-mono uppercase tracking-[0.2em] text-white/45">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-2.5 py-1">
                    <Lock className="w-3 h-3" /> Zero-Egress
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-2.5 py-1">
                    <Fingerprint className="w-3 h-3" /> SHA-256
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-2.5 py-1">
                    <Sparkles className="w-3 h-3" /> All-Intra MP4
                  </span>
                </div>

                {phase !== 'error' ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openPicker(); }}
                    className="mt-6 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12.5px] font-bold text-[#07061A] transition-transform hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: 'linear-gradient(135deg, #00D4AA 0%, #6C3EF4 100%)',
                      boxShadow: '0 12px 30px -10px rgba(0,212,170,0.6), 0 0 0 1px rgba(255,255,255,0.08) inset',
                    }}
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    ファイルを選択
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); resetToIdle(); }}
                    className="mt-6 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12.5px] font-semibold text-white border border-white/15 hover:bg-white/[0.05] transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    リセットして再試行
                  </button>
                )}
              </motion.div>
            )}

            {showProcessing && (
              <motion.div
                key="state-processing"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-xl"
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: phase === 'uploading'
                        ? 'linear-gradient(135deg, #00D4AA 0%, #6C3EF4 100%)'
                        : 'linear-gradient(135deg, #6C3EF4 0%, #BC78FF 100%)',
                      boxShadow: '0 12px 30px -10px rgba(108,62,244,0.6), 0 0 0 1px rgba(255,255,255,0.08) inset',
                    }}
                    animate={reduce ? undefined : { rotate: [0, 360] }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                  >
                    {phase === 'uploading'
                      ? <Rocket className="w-5 h-5 text-white" strokeWidth={2} />
                      : <Fingerprint className="w-5 h-5 text-white" strokeWidth={2} />}
                  </motion.div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-white font-bold text-[14px]">
                        {file?.name ?? 'unknown.mp4'}
                      </p>
                      <span className="shrink-0 text-[10px] font-mono text-white/45 tabular-nums">
                        {formatBytes(file?.size ?? 0)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-white/50">
                      {phase === 'uploading'
                        ? 'R2 Vault へ Direct-to-R2 で送信中… 台帳へ打刻します。'
                        : phase === 'muxing'
                          ? 'All-Intra MP4 を蒸留中… (≤ 1MB)'
                          : phase === 'decoding'
                            ? 'WebCodecs GPU デコード中… (Backpressure guard on)'
                            : '端末内で SHA-256 を封印しています · WASM Stream Online'}
                    </p>
                  </div>
                </div>

                <ScramblingHash reduce={reduce} />

                <DirectFlowMeter
                  reduce={reduce}
                  percentMV={percentMV}
                  stageLabelMV={stageLabelMV}
                  totalBytes={file?.size ?? 0}
                  accent={phase === 'uploading' ? 'teal' : 'purple'}
                />

                <div className="mt-6 flex items-center gap-2 text-[10.5px] font-mono uppercase tracking-[0.22em] text-white/40">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#BC78FF]" />
                  Merkle root を蒸留中… 動画はサーバーに送信されていません。
                </div>
              </motion.div>
            )}

            {phase === 'success' && committedCid && (
              <motion.div
                key="state-success"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-xl"
              >
                {oracleError ? (
                  <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[12px] font-bold text-red-400">Oracle Processing Failed</p>
                      <p className="mt-1 text-[11px] text-red-300/80">{oracleError}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                      style={{
                        background: oracleStatus === 'completed'
                          ? 'linear-gradient(135deg, #00D4AA 0%, #6C3EF4 100%)'
                          : 'linear-gradient(135deg, #2A2A35 0%, #1A1A24 100%)',
                        boxShadow: oracleStatus === 'completed'
                          ? '0 16px 36px -12px rgba(0,212,170,0.55), 0 0 0 1px rgba(255,255,255,0.08) inset'
                          : '0 0 0 1px rgba(255,255,255,0.05) inset',
                      }}
                      initial={reduce ? undefined : { scale: 0.6, rotate: -12 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 220, damping: 16 }}
                    >
                      {oracleStatus === 'completed' ? (
                        <CheckCircle2 className="w-6 h-6 text-white" strokeWidth={2.4} />
                      ) : oracleStatus === 'processing' ? (
                        <Activity className="w-6 h-6 text-[#00D4AA] animate-pulse" strokeWidth={2} />
                      ) : (
                        <Server className="w-6 h-6 text-white/40" strokeWidth={2} />
                      )}
                    </motion.div>
                    
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-[#00D4AA]">
                        {oracleStatus === 'completed' 
                          ? 'Sealed · Master Hash Locked'
                          : oracleStatus === 'processing'
                            ? 'Oracle Node · Processing...'
                            : 'Oracle Node · Pending...'}
                      </p>
                      <h3 className="mt-0.5 text-white font-black tracking-tight text-[17px] truncate">
                        {file?.name ?? 'unknown.mp4'}
                      </h3>
                      <p className="text-[11px] text-white/50 flex items-center gap-1.5">
                        {oracleStatus === 'processing' && <Loader2 className="w-3 h-3 animate-spin text-[#00D4AA]" />}
                        {oracleStatus === 'completed' 
                          ? `${formatBytes(file?.size ?? 0)} · Direct-to-R2 Sealed`
                          : 'Mac mini が AIメタデータ解析とC2PA署名を実行しています'}
                        {certificateId && oracleStatus === 'completed' ? <span className="text-white/40"> · #{certificateId.slice(0, 8)}</span> : null}
                      </p>
                    </div>
                  </div>
                )}

                <div
                  className="mt-4 rounded-2xl border p-4"
                  style={{
                    background: 'linear-gradient(160deg, rgba(0,212,170,0.10) 0%, rgba(108,62,244,0.08) 100%)',
                    borderColor: 'rgba(0,212,170,0.30)',
                    boxShadow: '0 24px 60px -30px rgba(0,212,170,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset',
                  }}
                >
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-[0.28em] text-white/60">
                      SHA-256 · MASTER HASH
                    </span>
                    <button
                      type="button"
                      disabled={oracleStatus !== 'completed'}
                      onClick={(e) => { e.stopPropagation(); void copyHash(); }}
                      className={`inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10.5px] font-mono uppercase tracking-[0.18em] transition-colors ${
                        oracleStatus === 'completed' 
                          ? 'bg-white/[0.03] text-white/75 hover:text-white hover:bg-white/[0.06] cursor-pointer' 
                          : 'bg-transparent text-white/20 cursor-not-allowed'
                      }`}
                    >
                      {copied
                        ? (<><CheckCircle2 className="w-3 h-3 text-[#00D4AA]" /> COPIED</>)
                        : (<><Copy className="w-3 h-3" /> COPY</>)}
                    </button>
                  </div>
                  <p
                    className="font-mono text-[13px] sm:text-[14px] break-all leading-relaxed"
                    style={{
                      background: 'linear-gradient(90deg, #00D4AA 0%, #6C3EF4 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      filter: 'drop-shadow(0 0 10px rgba(0,212,170,0.35))',
                      opacity: oracleStatus === 'completed' ? 1 : 0.4,
                      transition: 'opacity 300ms ease',
                    }}
                  >
                    {committedCid}
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2 justify-center">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); resetToIdle(); }}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-bold text-[#07061A]"
                    style={{
                      background: 'linear-gradient(135deg, #00D4AA 0%, #6C3EF4 100%)',
                      boxShadow: '0 14px 32px -12px rgba(0,212,170,0.55)',
                    }}
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    もう1本封印する
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-px pointer-events-none"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,170,0.55), rgba(108,62,244,0.55), transparent)' }}
          />
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={`${ACCEPTED_MIME_PREFIX}*,${ACCEPTED_EXTS.join(',')}`}
          className="hidden"
          onChange={handleFileInput}
          aria-hidden
          tabIndex={-1}
        />
      </motion.div>

      <div className="mt-3 flex items-center justify-between text-[10.5px] font-mono uppercase tracking-[0.24em] text-white/35 px-1">
        <span>PROOFMARK · CONSOLE 2.0</span>
        <span className="inline-flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-[#00D4AA]" />
          Oracle Node Sync Active
        </span>
      </div>

      <style jsx>{`
        @media (prefers-reduced-motion: reduce) {
          :global(*), :global(*::before), :global(*::after) {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </section>
  );
}