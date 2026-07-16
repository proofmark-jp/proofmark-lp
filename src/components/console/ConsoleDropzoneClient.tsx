"use client";

/**
 * src/components/console/ConsoleDropzoneClient.tsx
 * ─────────────────────────────────────────────────────────────────────────
 * Console 2.0 · The Video Dropzone (Apex WASM + Direct-to-R2 Edition)
 *
 * クリエイターが数百MB〜数GBに及ぶタイムラプスMP4を投下し、
 * ブラウザ上でSHA-256マスターハッシュを計算して、そのまま
 * Cloudflare R2 へ Direct-to-R2 で流し込む「神聖なる入力儀式」の場。
 *
 * ⚡ Apex Refactor (Streaming WASM + Direct-to-R2):
 *  - Web Crypto API (メモリ全展開型) から hash-wasm へ完全移行
 *  - importScripts で CDN から WASM を注入 → Next.js の webpack 設定不要
 *  - 4MiB チャンクごとに hasher.update() → 定常メモリでスケール無限
 *  - Main-Thread フォールバックは 2GB 上限で防弾化 (Web Crypto の一括読込 OOM 対策)
 *  - モック setTimeout を撤廃し Server Actions + XHR Presigned PUT + commit へ完全換装
 *  - XHR upload.onprogress をリアルタイム State 反映 → Egress Meter で快感を可視化
 *  - useRef で XHR インスタンスを保持し、reset / unmount で abort() 発火 → ゾンビ通信を殺害
 *
 * 5つの絶対防衛線 (継承):
 *  ① Main-Thread Protection — インライン Worker (Blob URL) で SHA-256 をオフロード
 *  ② Labor Illusion — 16進スクランブラー + プログレスバー + チャンクカウンタ
 *  ③ Bento-Glassmorphism + Magnetic Snap — カーソル追従傾き、呼吸グロー
 *  ④ 厳密な State Machine — idle → dragging → hashing → uploading → success
 *  ⑤ Cockroach Cleanup — Worker / Blob URL / listener / timer / XHR 完全解放
 *
 * 依存: React 19 (Next.js 15) / framer-motion / lucide-react / tailwindcss
 *      + `@/hooks/useSafeReducedMotion`
 *      + `@/actions/upload` (Server Actions: getPresignedUrlAction, commitUploadAction)
 *      + hash-wasm (CDN 経由 · npm install 不要)
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
  useMotionValue,
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
} from 'lucide-react';

import { useSafeReducedMotion } from '@/hooks/useSafeReducedMotion';
import { useForge } from '@/hooks/useForge';
import { getPresignedUrlAction, commitUploadAction } from '@/actions/upload';

/* ══════════════════════════════════════════════════════════════
 *  Constants — The Physics
 * ══════════════════════════════════════════════════════════════ */

/** 受け付けるMIMEプレフィックス */
const ACCEPTED_MIME_PREFIX = 'video/';
/** MP4 拡張子ホワイトリスト (MIME を偽装する Safari 対策) */
const ACCEPTED_EXTS = ['.mp4', '.mov', '.m4v', '.webm'] as const;
/** ハードリミット: 4GB。これ以上はブラウザが不安定になる */
const MAX_FILE_BYTES = 4 * 1024 * 1024 * 1024;
/** メインスレッド・フォールバックが安全に処理できる上限: 2GB */
const FALLBACK_MAX_BYTES = 2 * 1024 * 1024 * 1024;
/** ストリーミング・チャンクサイズ (4MiB) */
const CHUNK_SIZE = 4 * 1024 * 1024;
/** hash-wasm CDN URL (pinned major) */
const HASH_WASM_CDN =
  'https://cdn.jsdelivr.net/npm/hash-wasm@4/dist/sha256.umd.min.js';
/** Labor Illusion のスクランブル周期 (ms) */
const SCRAMBLE_TICK_MS = 33;

/* ══════════════════════════════════════════════════════════════
 *  Types
 * ══════════════════════════════════════════════════════════════ */

type PhaseKey = 'idle' | 'dragging' | 'hashing' | 'uploading' | 'success' | 'error';

interface HashResult {
  sha256: string;
  bytes: number;
  ms: number;
  fileName: string;
  mimeType: string;
}

interface ProgressState {
  processed: number;
  total: number;
  chunks: number;
  totalChunks: number;
  startedAt: number;
}

/**
 * XHR で R2 へ直接 PUT 中の進捗を表す State。
 * uploadProgress は「送信済みバイト」「全バイト」「開始時刻」「即時速度」の 4 軸。
 */
interface UploadProgressState {
  sent: number;
  total: number;
  startedAt: number;
  bps: number;
}

export interface ConsoleDropzoneClientProps {
  /**
   * ハッシュ計算 & R2 アップロード & Supabase commit 完了時のコールバック。
   * 実接続時にサーバー側 API と結線する際のフックとして使用する。
   */
  onCommit?: (result: HashResult) => void;
  /** キャプション / 見出しを差し替えたい場合 */
  headline?: string;
  subheadline?: string;
  className?: string;
}

/* ══════════════════════════════════════════════════════════════
 *  Inline Worker Source — hash-wasm streaming SHA-256
 * ──────────────────────────────────────────────────────────────
 *  importScripts で hash-wasm を CDN から Worker へ直接ロードし、
 *  次に 4MiB チャンクを sequentially update() する。
 *  ArrayBuffer は都度 GC に返却され、メモリは定常 (≈ 4-8MiB 常時)。
 *  数GBの動画も iPhone SE クラスの端末で完走する。
 *
 *  Message protocol:
 *   → { id, file }
 *   ← { id, kind: 'progress', processed, total, chunks, totalChunks }
 *   ← { id, kind: 'success', sha256, bytes, ms }
 *   ← { id, kind: 'error', message }
 * ══════════════════════════════════════════════════════════════ */

const WORKER_SOURCE = /* js */ `
'use strict';

// hash-wasm を CDN から注入 (Next.js の bundler / next.config.js 設定を回避)
try {
  importScripts('${HASH_WASM_CDN}');
} catch (e) {
  // importScripts に失敗した場合はメインスレッドへ通知
  self.postMessage({
    kind: 'boot-error',
    message: 'hash-wasm CDN の読み込みに失敗しました: ' + ((e && e.message) || String(e))
  });
}

const CHUNK = ${CHUNK_SIZE};

self.onmessage = async (ev) => {
  const { id, file } = ev.data || {};
  if (!file) {
    self.postMessage({ id, kind: 'error', message: 'file missing' });
    return;
  }
  if (typeof self.hashwasm === 'undefined' || typeof self.hashwasm.createSHA256 !== 'function') {
    self.postMessage({ id, kind: 'error', message: 'hash-wasm ランタイムが未ロードです' });
    return;
  }

  const startedAt = performance.now();
  const total = file.size;
  const totalChunks = Math.max(1, Math.ceil(total / CHUNK));

  try {
    // ── ストリーミング SHA-256 (定常メモリ) ─────────────────────
    const hasher = await self.hashwasm.createSHA256();
    hasher.init();

    let processed = 0;
    let chunkCount = 0;

    for (let offset = 0; offset < total; offset += CHUNK) {
      const end = offset < total - CHUNK ? offset + CHUNK : total;
      const slice = file.slice(offset, end);
      const buffer = await slice.arrayBuffer();
      // Uint8Array ビューを作って hash-wasm に流し込む
      const view = new Uint8Array(buffer);
      hasher.update(view);

      processed += buffer.byteLength;
      chunkCount += 1;

      // 明示的に参照を切り、V8 に GC を促す
      // (buffer / view は次イテレーションで再バインドされる)
      self.postMessage({
        id: id,
        kind: 'progress',
        processed: processed,
        total: total,
        chunks: chunkCount,
        totalChunks: totalChunks,
      });
    }

    // 総処理量が 0 のとき (空ファイル) は明示的にエラー
    if (total === 0) {
      self.postMessage({ id: id, kind: 'error', message: 'empty file' });
      return;
    }

    const sha256 = hasher.digest();
    self.postMessage({
      id: id,
      kind: 'success',
      sha256: sha256,
      bytes: total,
      ms: performance.now() - startedAt,
    });
  } catch (err) {
    self.postMessage({
      id: id,
      kind: 'error',
      message: (err && err.message) || 'unknown worker error',
    });
  }
};
`;

/* ══════════════════════════════════════════════════════════════
 *  Helpers
 * ══════════════════════════════════════════════════════════════ */

const HEX = '0123456789abcdef';
function randomHex(len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += HEX[(Math.random() * 16) | 0];
  }
  return out;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / Math.pow(1024, idx);
  return `${v.toFixed(v >= 100 || idx === 0 ? 0 : v >= 10 ? 1 : 2)} ${units[idx]}`;
}

function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0.0s';
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}m ${r}s`;
}

/**
 * 転送レート表示: bytes/sec を人間可読な文字列へ整形。
 * Egress Meter の「速度感」を演出するための Labor Illusion 補助。
 */
function formatRate(bps: number): string {
  if (!Number.isFinite(bps) || bps <= 0) return '— /s';
  return `${formatBytes(bps)}/s`;
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
  if (!okMime && !okExt) {
    return '対応形式は MP4 / MOV / M4V / WebM です。';
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════
 *  Fallback (main-thread) chunked hasher
 * ──────────────────────────────────────────────────────────────
 *  Web Worker が使用不能な環境用のフォールバック。
 *  Web Crypto API はインクリメンタルAPIを持たないため、
 *  ここでは 2GB 上限で防弾化する:
 *   - 2GB 超: DOMException を throw して UI エラー状態へ安全に逃がす
 *   - 2GB 以下: 従来通り一括 digest (メインスレッドで yield を挟みつつ)
 *  hash-wasm を メインスレッド側でも読み込みたい場合は将来
 *  dynamic import に切り替える余地を残している。
 * ══════════════════════════════════════════════════════════════ */

async function chunkedHash(
  file: File,
  onProgress: (p: ProgressState) => void,
  signal: AbortSignal,
): Promise<HashResult> {
  const total = file.size;

  // 🛡️ 防弾化: Worker が居ない環境で 2GB 超は物理的に安全に処理できない
  if (total > FALLBACK_MAX_BYTES) {
    throw new DOMException(
      `2GB を超えるファイルはブラウザの制限により Worker なしでは処理できません (${formatBytes(total)})。ページを再読み込みして Worker 対応環境で再試行してください。`,
      'NotSupportedError',
    );
  }

  const totalChunks = Math.max(1, Math.ceil(total / CHUNK_SIZE));
  const startedAt = performance.now();

  const buffer = new Uint8Array(total);
  let processed = 0;
  let chunkCount = 0;

  for (let offset = 0; offset < total; offset += CHUNK_SIZE) {
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');
    const end = Math.min(offset + CHUNK_SIZE, total);
    const chunk = file.slice(offset, end);
    const ab = await chunk.arrayBuffer();
    buffer.set(new Uint8Array(ab), offset);
    processed += ab.byteLength;
    chunkCount += 1;
    onProgress({ processed, total, chunks: chunkCount, totalChunks, startedAt });
    // 明示的な Yield で 60fps を確保
    await new Promise<void>((r) => setTimeout(r, 0));
  }

  if (signal.aborted) throw new DOMException('aborted', 'AbortError');

  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer.buffer);
  const bytes = new Uint8Array(hashBuffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += HEX[(bytes[i] >> 4) & 0xf] + HEX[bytes[i] & 0xf];
  }

  return {
    sha256: hex,
    bytes: total,
    ms: performance.now() - startedAt,
    fileName: file.name,
    mimeType: file.type || 'video/mp4',
  };
}

/* ══════════════════════════════════════════════════════════════
 *  Sub-Components
 * ══════════════════════════════════════════════════════════════ */

function ScramblingHash({ reduce }: { reduce: boolean }) {
  const [str, setStr] = useState<string>(() => randomHex(64));

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setStr(randomHex(64));
    }, SCRAMBLE_TICK_MS);
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

function ChunkStreamMeter({
  progress,
  reduce,
}: {
  progress: ProgressState | null;
  reduce: boolean;
}) {
  const total = progress?.total ?? 0;
  const processed = progress?.processed ?? 0;
  const pct = total > 0 ? Math.min(1, processed / total) : 0;
  const elapsed = progress ? performance.now() - progress.startedAt : 0;

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-mono uppercase tracking-[0.28em] text-white/45">
          MERKLE INGEST · {progress ? `${progress.chunks}/${progress.totalChunks}` : '—'}
        </span>
        <span className="text-[10px] font-mono tabular-nums text-white/45">
          {formatBytes(processed)} / {formatBytes(total)} · {formatMs(elapsed)}
        </span>
      </div>
      <div
        className="relative h-[6px] rounded-full overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <motion.div
          className="absolute inset-y-0 left-0"
          style={{
            background:
              'linear-gradient(90deg, #6C3EF4 0%, #00D4AA 100%)',
            boxShadow: '0 0 14px rgba(0,212,170,0.55)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${pct * 100}%` }}
          transition={
            reduce
              ? { duration: 0 }
              : { type: 'spring', stiffness: 200, damping: 34, mass: 0.6 }
          }
        />
        {!reduce && (
          <motion.div
            aria-hidden
            className="absolute inset-y-0 w-16 pointer-events-none"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
              mixBlendMode: 'overlay',
            }}
            animate={{ x: ['-64px', '110%'] }}
            transition={{
              duration: 1.6,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * The Egress Meter — Direct-to-R2 の官能的アップロード進捗UI。
 * ChunkStreamMeter の Visual DNA (Teal 発光 + spring 幅拡張 + 白サーチライト) を
 * 完全継承しつつ、送信済みバイト・全バイト・即時速度・経過時間の4軸で
 * 「Vault へ吸い込まれている」感覚を可視化する。
 */
function EgressMeter({
  progress,
  reduce,
}: {
  progress: UploadProgressState | null;
  reduce: boolean;
}) {
  const total = progress?.total ?? 0;
  const sent = progress?.sent ?? 0;
  const pct = total > 0 ? Math.min(1, sent / total) : 0;
  const elapsed = progress ? performance.now() - progress.startedAt : 0;
  const rate = progress?.bps ?? 0;
  const eta =
    rate > 0 && total > sent
      ? ((total - sent) / rate) * 1000
      : 0;

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-mono uppercase tracking-[0.28em] text-[#00D4AA]/85">
          R2 EGRESS · SECURE CHANNEL
        </span>
        <span className="text-[10px] font-mono tabular-nums text-white/45">
          {formatBytes(sent)} / {formatBytes(total)} · {formatRate(rate)}
        </span>
      </div>
      <div
        className="relative h-[8px] rounded-full overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(0,212,170,0.14)',
          boxShadow: 'inset 0 0 12px rgba(0,212,170,0.10)',
        }}
      >
        <motion.div
          className="absolute inset-y-0 left-0"
          style={{
            background:
              'linear-gradient(90deg, #00D4AA 0%, #6C3EF4 100%)',
            boxShadow:
              '0 0 18px rgba(0,212,170,0.75), 0 0 4px rgba(255,255,255,0.35) inset',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${pct * 100}%` }}
          transition={
            reduce
              ? { duration: 0 }
              : { type: 'spring', stiffness: 220, damping: 32, mass: 0.55 }
          }
        />
        {!reduce && (
          <motion.div
            aria-hidden
            className="absolute inset-y-0 w-20 pointer-events-none"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(0,212,170,0.55), transparent)',
              mixBlendMode: 'screen',
            }}
            animate={{ x: ['-80px', '110%'] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono tabular-nums text-white/40">
        <span className="uppercase tracking-[0.22em]">
          {(pct * 100).toFixed(1)}%
        </span>
        <span>
          {formatMs(elapsed)}
          {eta > 0 ? <span className="text-white/30"> · ETA {formatMs(eta)}</span> : null}
        </span>
      </div>
    </div>
  );
}

function PhaseBadge({
  phase,
  reduce,
}: {
  phase: PhaseKey;
  reduce: boolean;
}) {
  const map: Record<
    PhaseKey,
    { label: string; icon: React.ReactNode; color: string; rgb: string }
  > = {
    idle: {
      label: 'READY · DROP THE TAPE',
      icon: <UploadCloud className="w-3.5 h-3.5" />,
      color: '#A8A0D8',
      rgb: '168,160,216',
    },
    dragging: {
      label: 'LOCK ACQUIRED · RELEASE TO SEAL',
      icon: <Zap className="w-3.5 h-3.5" />,
      color: '#00D4AA',
      rgb: '0,212,170',
    },
    hashing: {
      label: 'HASHING · WASM STREAM ONLINE',
      icon: <Fingerprint className="w-3.5 h-3.5" />,
      color: '#BC78FF',
      rgb: '188,120,255',
    },
    uploading: {
      label: 'BROADCASTING · SECURE CHANNEL',
      icon: <Rocket className="w-3.5 h-3.5" />,
      color: '#00D4AA',
      rgb: '0,212,170',
    },
    success: {
      label: 'SEALED · MASTER HASH LOCKED',
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
      color: '#00D4AA',
      rgb: '0,212,170',
    },
    error: {
      label: 'FAILED · RETRY THE SEQUENCE',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      color: '#FF6B6B',
      rgb: '255,107,107',
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
  const { state, startForge } = useForge();

  const [phase, setPhase] = useState<PhaseKey>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null);
  const [result, setResult] = useState<HashResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const displayPhase = useMemo<PhaseKey>(() => {
    if (state.error) return 'error';
    if (state.cid) return 'success';
    if (state.isForging) {
      if (state.stage === 'uploading') return 'uploading';
      return 'hashing';
    }
    return phase;
  }, [phase, state]);

  const isActive = displayPhase === 'dragging';
  const isBusy = displayPhase === 'hashing' || displayPhase === 'uploading' || state.isForging;

  const dragCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const workerUrlRef = useRef<string | null>(null);
  const workerJobIdRef = useRef<number>(0);
  const abortRef = useRef<AbortController | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const isMountedRef = useRef<boolean>(true);

  /* ─── Magnetic Snap: pointer-driven subtle tilt ─── */
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const tiltX = useSpring(useTransform(my, [-1, 1], [3.5, -3.5]), {
    stiffness: 180,
    damping: 20,
  });
  const tiltY = useSpring(useTransform(mx, [-1, 1], [-3.5, 3.5]), {
    stiffness: 180,
    damping: 20,
  });

  /* ─── Mount / Cleanup ─── */
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      try { workerRef.current?.terminate(); } catch { /* noop */ }
      workerRef.current = null;
      if (workerUrlRef.current) {
        try { URL.revokeObjectURL(workerUrlRef.current); } catch { /* noop */ }
        workerUrlRef.current = null;
      }
      // 🩸 XHR ゾンビ通信の物理的殺害 (unmount)
      if (xhrRef.current) {
        try { xhrRef.current.abort(); } catch { /* noop */ }
        xhrRef.current = null;
      }
      abortRef.current?.abort();
    };
  }, []);

  /* ─── Worker factory (inline Blob-URL) ─── */
  const buildWorker = useCallback((): Worker | null => {
    if (typeof window === 'undefined') return null;
    if (typeof Worker === 'undefined' || typeof Blob === 'undefined') return null;
    try {
      const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const w = new Worker(url);
      workerUrlRef.current = url;
      return w;
    } catch {
      return null;
    }
  }, []);

  /* ─── Phase transitions ─── */
  const resetToIdle = useCallback(() => {
    if (workerRef.current) {
      try { workerRef.current.terminate(); } catch { /* noop */ }
      workerRef.current = null;
    }
    if (workerUrlRef.current) {
      try { URL.revokeObjectURL(workerUrlRef.current); } catch { /* noop */ }
      workerUrlRef.current = null;
    }
    // 🩸 XHR ゾンビ通信の物理的殺害 (reset)
    if (xhrRef.current) {
      try { xhrRef.current.abort(); } catch { /* noop */ }
      xhrRef.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
    dragCounter.current = 0;
    setFile(null);
    setProgress(null);
    setUploadProgress(null);
    setResult(null);
    setError(null);
    setCopied(false);
    setPhase('idle');
  }, []);

  /* ─── Direct-to-R2 pipeline ───────────────────────────────────
   *  ① getPresignedUrlAction() で PUT URL + objectKey を取得
   *  ② XHR PUT で R2 バケットへ直接送信 (upload.onprogress でメーター更新)
   *  ③ commitUploadAction() で Supabase 台帳へ打刻
   *  ④ setPhase('success') + onCommit(finalResult) 発火
   *
   *  失敗時はいずれのステップでも setPhase('error') + setError で
   *  UI をエラー面へ滑らかに逃がす。
   *  途中で resetToIdle / unmount が発火した場合は xhr.abort() で確実に殺す。
   * ─────────────────────────────────────────────────────────── */
  const runDirectToR2 = useCallback(
    async (dropped: File, finalResult: HashResult) => {
      // Phase 遷移: hashing → uploading
      setUploadProgress({
        sent: 0,
        total: finalResult.bytes,
        startedAt: performance.now(),
        bps: 0,
      });
      setPhase('uploading');

      // ── ① Presigned URL 取得 ───────────────────────────────
      let presigned: { url: string; objectKey: string } | null = null;
      try {
        const res = await getPresignedUrlAction(
          dropped.name,
          dropped.type || 'video/mp4',
          finalResult.sha256,
        );
        // 👑 修正: Server Action の success フラグとエラーメッセージを厳格に評価
        if (!res || !res.success || typeof res.url !== 'string' || typeof res.objectKey !== 'string') {
          throw new Error(res?.error || '署名付きURLの発行に失敗しました');
        }
        presigned = { url: res.url, objectKey: res.objectKey };
      } catch (err) {
        if (!isMountedRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : '署名付きURLの発行に失敗しました',
        );
        setPhase('error');
        return;
      }

      // ── ② XHR PUT for Direct-to-R2 ─────────────────────────
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      const putPromise = new Promise<void>((resolve, reject) => {
        xhr.open('PUT', presigned!.url, true);
        // Content-Type は Presigned URL 署名の前提と合わせる
        xhr.setRequestHeader('Content-Type', dropped.type || 'video/mp4');

        xhr.upload.onprogress = (evt: ProgressEvent) => {
          if (!isMountedRef.current) return;
          if (!evt.lengthComputable) return;

          setUploadProgress((prev) => {
            const startedAt = prev?.startedAt ?? performance.now();
            const elapsed = performance.now() - startedAt;
            const bps = elapsed > 0 ? (evt.loaded / elapsed) * 1000 : 0;
            return {
              sent: evt.loaded,
              total: evt.total,
              startedAt,
              bps,
            };
          });
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(
              new Error(
                `R2 へのアップロードに失敗しました (HTTP ${xhr.status})`,
              ),
            );
          }
        };

        xhr.onerror = () => {
          reject(new Error('ネットワークエラーによりアップロードが中断されました'));
        };

        xhr.onabort = () => {
          reject(new DOMException('aborted', 'AbortError'));
        };

        xhr.ontimeout = () => {
          reject(new Error('アップロードがタイムアウトしました'));
        };

        try {
          xhr.send(dropped);
        } catch (err) {
          reject(
            err instanceof Error
              ? err
              : new Error('XHR 送信の初期化に失敗しました'),
          );
        }
      });

      try {
        await putPromise;
      } catch (err) {
        // AbortError は静かに握り潰す (ユーザーが reset した場合)
        if ((err as DOMException)?.name === 'AbortError') {
          xhrRef.current = null;
          return;
        }
        if (!isMountedRef.current) {
          xhrRef.current = null;
          return;
        }
        xhrRef.current = null;
        setError(
          err instanceof Error
            ? err.message
            : 'アップロードに失敗しました',
        );
        setPhase('error');
        return;
      }

      // ── ③ Supabase 台帳へ commit ───────────────────────────
      try {
        const commitRes = await commitUploadAction(
          finalResult.sha256,
          presigned!.objectKey,
          dropped.name,
          finalResult.bytes,
          finalResult.ms,
        );
        // 👑 修正: 打刻失敗時（success: false）は確実に例外を投げ、エラーフェーズへ落とす
        if (!commitRes || !commitRes.success) {
          throw new Error(commitRes?.error || '台帳への打刻に失敗しました');
        }
      } catch (err) {
        if (!isMountedRef.current) {
          xhrRef.current = null;
          return;
        }
        xhrRef.current = null;
        setError(
          err instanceof Error
            ? err.message
            : '台帳への打刻に失敗しました',
        );
        setPhase('error');
        return;
      }

      // ── ④ success 遷移 & 進捗を 100% に固定 ────────────────
      if (!isMountedRef.current) {
        xhrRef.current = null;
        return;
      }

      setUploadProgress({
        sent: finalResult.bytes,
        total: finalResult.bytes,
        startedAt: performance.now(),
        bps: 0,
      });
      xhrRef.current = null;
      setPhase('success');
      onCommit?.(finalResult);
    },
    [onCommit],
  );

  /* ─── Fallback runner (main-thread) ─── */
  const runFallback = useCallback(
    async (dropped: File) => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const r = await chunkedHash(
          dropped,
          (p) => setProgress(p),
          controller.signal,
        );
        setResult(r);
        // モック setTimeout を完全撤廃 → 本番 Direct-to-R2 パイプラインへ結線
        await runDirectToR2(dropped, r);
      } catch (err) {
        if ((err as DOMException)?.name === 'AbortError') return;
        setError(
          err instanceof Error
            ? err.message
            : 'ブラウザ内でのハッシュ計算に失敗しました',
        );
        setPhase('error');
      }
    },
    [runDirectToR2],
  );

  /* ─── Core: begin hashing ─── */
  const beginHash = useCallback(
    async (dropped: File) => {
      const problem = pickAcceptedError(dropped);
      if (problem) {
        setError(problem);
        setPhase('error');
        return;
      }

      // Check if it's an MP4 file, if so route to useForge worker pipeline
      if (dropped.name.toLowerCase().endsWith('.mp4')) {
        setFile(dropped);
        startForge(dropped);
        return;
      }

      setFile(dropped);
      setError(null);
      setResult(null);
      setUploadProgress(null);
      setProgress({
        processed: 0,
        total: dropped.size,
        chunks: 0,
        totalChunks: Math.max(1, Math.ceil(dropped.size / CHUNK_SIZE)),
        startedAt: performance.now(),
      });
      setPhase('hashing');

      // Try Worker first (streaming WASM SHA-256)
      const worker = buildWorker();
      if (worker) {
        workerRef.current = worker;
        const jobId = ++workerJobIdRef.current;

        worker.onmessage = (ev: MessageEvent) => {
          const data = ev.data as
            | { kind: 'boot-error'; message: string }
            | { id: number; kind: 'progress'; processed: number; total: number; chunks: number; totalChunks: number }
            | { id: number; kind: 'success'; sha256: string; bytes: number; ms: number }
            | { id: number; kind: 'error'; message: string };
          if (!data) return;

          // Boot-error は CDN 到達不能 → メインスレッドフォールバックへ降下
          if ((data as { kind?: string }).kind === 'boot-error') {
            try { worker.terminate(); } catch { /* noop */ }
            workerRef.current = null;
            void runFallback(dropped);
            return;
          }

          const jobData = data as
            | { id: number; kind: 'progress'; processed: number; total: number; chunks: number; totalChunks: number }
            | { id: number; kind: 'success'; sha256: string; bytes: number; ms: number }
            | { id: number; kind: 'error'; message: string };

          if (jobData.id !== jobId) return;

          if (jobData.kind === 'progress') {
            setProgress((prev) => ({
              processed: jobData.processed,
              total: jobData.total,
              chunks: jobData.chunks,
              totalChunks: jobData.totalChunks,
              startedAt: prev?.startedAt ?? performance.now(),
            }));
          } else if (jobData.kind === 'success') {
            const finalResult: HashResult = {
              sha256: jobData.sha256,
              bytes: jobData.bytes,
              ms: jobData.ms,
              fileName: dropped.name,
              mimeType: dropped.type || 'video/mp4',
            };
            setResult(finalResult);
            // モック setTimeout を完全撤廃 → 本番 Direct-to-R2 パイプラインへ結線
            void runDirectToR2(dropped, finalResult);
          } else {
            setError(jobData.message || 'Worker でハッシュ計算に失敗しました');
            setPhase('error');
          }
        };
        worker.onerror = (e) => {
          setError(e.message || 'Worker ランタイムエラー');
          setPhase('error');
        };

        worker.postMessage({ id: jobId, file: dropped });
        return;
      }

      // Fallback: main-thread chunked hasher (2GB 上限で防弾化済み)
      await runFallback(dropped);
    },
    [buildWorker, runDirectToR2, runFallback, startForge],
  );

  /* ─── Drop / file input handlers ─── */
  const openPicker = useCallback(() => {
    if (isBusy) return;
    inputRef.current?.click();
  }, [isBusy]);

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      e.currentTarget.value = '';
      void beginHash(f);
    },
    [beginHash],
  );

  const onDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (isBusy) return;
      if (!Array.from(e.dataTransfer.types).includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current += 1;
      setPhase((p) => (p === 'idle' || p === 'dragging' ? 'dragging' : p));
    },
    [isBusy],
  );

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = Math.max(0, dragCounter.current - 1);
      if (dragCounter.current === 0) {
        setPhase((p) => (p === 'dragging' ? 'idle' : p));
      }
    },
    [],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      if (isBusy) return;
      const dropped = e.dataTransfer.files?.[0];
      if (!dropped) {
        setPhase('idle');
        return;
      }
      void beginHash(dropped);
    },
    [beginHash, isBusy],
  );

  /* ─── Magnetic pointer ─── */
  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const rx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ry = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      mx.set(rx);
      my.set(ry);
    },
    [mx, my],
  );

  const onPointerLeave = useCallback(() => {
    mx.set(0);
    my.set(0);
  }, [mx, my]);

  /* ─── Copy hash ─── */
  const copyHash = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.sha256);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }, [result]);

  /* ─── Derived styles ─── */
  const borderColor = useMemo(() => {
    switch (displayPhase) {
      case 'dragging': return 'rgba(0,212,170,0.75)';
      case 'hashing': return 'rgba(188,120,255,0.55)';
      case 'uploading': return 'rgba(0,212,170,0.60)';
      case 'success': return 'rgba(0,212,170,0.75)';
      case 'error': return 'rgba(255,107,107,0.55)';
      default: return 'rgba(255,255,255,0.09)';
    }
  }, [displayPhase]);

  const boxGlow = useMemo(() => {
    switch (displayPhase) {
      case 'dragging':
        return '0 0 0 1px rgba(0,212,170,0.35), 0 40px 80px -30px rgba(0,212,170,0.45), 0 0 80px rgba(108,62,244,0.25) inset';
      case 'hashing':
        return '0 0 0 1px rgba(188,120,255,0.35), 0 40px 80px -30px rgba(108,62,244,0.55), 0 0 80px rgba(108,62,244,0.28) inset';
      case 'uploading':
      case 'success':
        return '0 0 0 1px rgba(0,212,170,0.35), 0 40px 80px -30px rgba(0,212,170,0.55), 0 0 80px rgba(0,212,170,0.20) inset';
      case 'error':
        return '0 0 0 1px rgba(255,107,107,0.35), 0 40px 80px -30px rgba(255,107,107,0.45)';
      default:
        return '0 30px 60px -30px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03) inset';
    }
  }, [displayPhase]);

  /* ══════════════════════════════════════════════════════════════
   *  Render
   * ══════════════════════════════════════════════════════════════ */

  return (
    <section
      className={[
        'relative w-full max-w-3xl mx-auto',
        className ?? '',
      ].join(' ')}
      aria-labelledby="console-dropzone-heading"
    >
      {/* Ambient auras */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full opacity-[0.09] blur-[120px]"
        style={{ background: '#6C3EF4' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-24 w-[420px] h-[420px] rounded-full opacity-[0.09] blur-[120px]"
        style={{ background: '#00D4AA' }}
      />

      {/* Header row */}
      <div className="relative mb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/40">
            Console 2.0 · Video Dropzone
          </p>
          <h2
            id="console-dropzone-heading"
            className="mt-1 text-[20px] sm:text-[22px] font-black tracking-tight text-white"
          >
            {headline}
          </h2>
          <p className="mt-1 text-[12.5px] text-white/55 max-w-xl leading-relaxed">
            {subheadline}
          </p>
        </div>
        <PhaseBadge phase={displayPhase} reduce={reduce} />
      </div>

      {/* The Dropzone */}
      <motion.div
        role="button"
        tabIndex={0}
        aria-label="タイムラプス動画をドロップまたは選択して SHA-256 マスターハッシュを計算する"
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onPointerMove={reduce ? undefined : onPointerMove}
        onPointerLeave={reduce ? undefined : onPointerLeave}
        animate={
          reduce
            ? { scale: 1 }
            : {
                scale: isActive ? 1.012 : isBusy ? 1.006 : 1,
              }
        }
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
        {/* Layer: base surface */}
        <div
          aria-hidden
          className="absolute inset-0 rounded-3xl"
          style={{
            background:
              'linear-gradient(165deg, rgba(15,12,32,0.96) 0%, rgba(7,6,26,0.98) 55%, rgba(11,7,38,0.98) 100%)',
            border: `1px solid ${borderColor}`,
            boxShadow: boxGlow,
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            transition: 'border-color 220ms ease, box-shadow 320ms ease',
          }}
        />

        {/* Layer: cyber grid */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.08]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(0,212,170,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(108,62,244,0.35) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            maskImage:
              'radial-gradient(ellipse at 50% 50%, black 50%, transparent 85%)',
            WebkitMaskImage:
              'radial-gradient(ellipse at 50% 50%, black 50%, transparent 85%)',
          }}
        />

        {/* Layer: breathing halo when dragging */}
        {!reduce && (
          <motion.div
            aria-hidden
            className="absolute inset-0 pointer-events-none rounded-3xl"
            style={{
              background:
                'radial-gradient(circle at 50% 45%, rgba(0,212,170,0.20), transparent 60%), radial-gradient(circle at 50% 55%, rgba(108,62,244,0.18), transparent 60%)',
              opacity: isActive ? 1 : 0,
              transition: 'opacity 300ms ease',
            }}
            animate={
              isActive
                ? { scale: [1, 1.04, 1], opacity: [0.85, 1, 0.85] }
                : { scale: 1, opacity: 0 }
            }
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {/* Layer: top hairline */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px rounded-t-3xl"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(108,62,244,0.8), rgba(0,212,170,0.8), transparent)',
          }}
        />

        {/* Content */}
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
                    background:
                      isActive
                        ? 'linear-gradient(135deg, #00D4AA 0%, #6C3EF4 100%)'
                        : 'linear-gradient(135deg, rgba(108,62,244,0.35) 0%, rgba(0,212,170,0.25) 100%)',
                    boxShadow: isActive
                      ? '0 20px 50px -18px rgba(0,212,170,0.65)'
                      : '0 20px 50px -18px rgba(108,62,244,0.45)',
                  }}
                  animate={
                    reduce
                      ? undefined
                      : isActive
                        ? { y: [-2, 2, -2] }
                        : { y: [0, -3, 0] }
                  }
                  transition={{
                    duration: isActive ? 1.4 : 3.4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  {phase === 'error' ? (
                    <AlertTriangle className="w-7 h-7 text-white" strokeWidth={2} />
                  ) : isActive ? (
                    <CloudUpload className="w-7 h-7 text-white" strokeWidth={2} />
                  ) : (
                    <Film className="w-7 h-7 text-white" strokeWidth={2} />
                  )}
                </motion.div>

                <h3 className="text-white text-[17px] sm:text-[19px] font-black tracking-tight">
                  {phase === 'error'
                    ? 'Sequence Aborted'
                    : isActive
                      ? 'RELEASE TO SEAL THE TAPE'
                      : 'タイムラプスMP4をここに落とす'}
                </h3>
                <p className="mt-1.5 text-[12.5px] text-white/55 max-w-md mx-auto leading-relaxed">
                  {phase === 'error'
                    ? error ?? '不明なエラーが発生しました。'
                    : isActive
                      ? '磁場が捕捉しています。指を離すと即座にハッシュ計算が始まります。'
                      : 'MP4 / MOV / M4V / WebM · 最大 4GB。ハッシュ計算は端末内で完結し、動画は署名付きURLで直接R2へ送信されます。'}
                </p>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[10.5px] font-mono uppercase tracking-[0.2em] text-white/45">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-2.5 py-1">
                    <Lock className="w-3 h-3" /> Zero-Egress
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-2.5 py-1">
                    <Fingerprint className="w-3 h-3" /> SHA-256
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-2.5 py-1">
                    <Sparkles className="w-3 h-3" /> On-Device
                  </span>
                </div>

                {phase !== 'error' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openPicker();
                    }}
                    className="mt-6 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12.5px] font-bold text-[#07061A] transition-transform hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background:
                        'linear-gradient(135deg, #00D4AA 0%, #6C3EF4 100%)',
                      boxShadow:
                        '0 12px 30px -10px rgba(0,212,170,0.6), 0 0 0 1px rgba(255,255,255,0.08) inset',
                    }}
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    ファイルを選択
                  </button>
                )}

                {phase === 'error' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetToIdle();
                    }}
                    className="mt-6 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12.5px] font-semibold text-white border border-white/15 hover:bg-white/[0.05] transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    リセットして再試行
                  </button>
                )}
              </motion.div>
            )}

            {phase === 'hashing' && (
              <motion.div
                key="state-hashing"
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
                      background:
                        'linear-gradient(135deg, #6C3EF4 0%, #BC78FF 100%)',
                      boxShadow:
                        '0 12px 30px -10px rgba(108,62,244,0.6), 0 0 0 1px rgba(255,255,255,0.08) inset',
                    }}
                    animate={
                      reduce ? undefined : { rotate: [0, 360] }
                    }
                    transition={{
                      duration: 6,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                  >
                    <Fingerprint className="w-5 h-5 text-white" strokeWidth={2} />
                  </motion.div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-white font-bold text-[14px]">
                        {file?.name ?? 'unknown.mp4'}
                      </p>
                      <span className="shrink-0 text-[10px] font-mono text-white/40 tabular-nums">
                        {formatBytes(file?.size ?? 0)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-white/50">
                      端末内で SHA-256 を封印しています · WASM Stream Online
                    </p>
                  </div>
                </div>

                <ScramblingHash reduce={reduce} />
                <ChunkStreamMeter progress={progress} reduce={reduce} />

                <div className="mt-6 flex items-center gap-2 text-[10.5px] font-mono uppercase tracking-[0.22em] text-white/40">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#BC78FF]" />
                  Merkle root を蒸留中… 動画はサーバーに送信されていません。
                </div>
              </motion.div>
            )}

            {phase === 'uploading' && result && (
              <motion.div
                key="state-uploading"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-xl text-center"
              >
                <motion.div
                  className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{
                    background:
                      'linear-gradient(135deg, #00D4AA 0%, #6C3EF4 100%)',
                    boxShadow:
                      '0 20px 50px -18px rgba(0,212,170,0.65), 0 0 0 1px rgba(255,255,255,0.08) inset',
                  }}
                  animate={
                    reduce
                      ? undefined
                      : { rotate: [0, 6, -6, 0], y: [0, -2, 0] }
                  }
                  transition={{
                    duration: 1.6,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <Rocket className="w-7 h-7 text-white" strokeWidth={2} />
                </motion.div>
                <h3 className="text-white text-[17px] font-black tracking-tight">
                  Broadcasting to the Vault
                </h3>
                <p className="mt-1.5 text-[12.5px] text-white/55 max-w-md mx-auto leading-relaxed">
                  マスターハッシュを署名付きURLで直接Cloudflare R2へ送信しています。台帳への打刻まで、あと数秒で封印が完了します。
                </p>

                <div
                  className="mt-5 mx-auto max-w-md rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left"
                >
                  <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/40 mb-1">
                    Preliminary SHA-256
                  </p>
                  <p
                    className="font-mono text-[12px] break-all"
                    style={{
                      background:
                        'linear-gradient(90deg, #6C3EF4 0%, #00D4AA 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    {result.sha256}
                  </p>
                </div>

                {/* The Egress Meter — 官能的なアップロード進捗UI */}
                <div className="mx-auto max-w-md text-left">
                  <EgressMeter progress={uploadProgress} reduce={reduce} />
                </div>

                <div className="mt-4 flex items-center justify-center gap-2 text-[10.5px] font-mono uppercase tracking-[0.22em] text-white/50">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00D4AA]" />
                  {uploadProgress && uploadProgress.total > 0
                    ? `Sealing… ${((uploadProgress.sent / uploadProgress.total) * 100).toFixed(1)}% · ${formatBytes(uploadProgress.sent)} / ${formatBytes(uploadProgress.total)}`
                    : 'Sealing…'}
                </div>
              </motion.div>
            )}

            {phase === 'success' && result && (
              <motion.div
                key="state-success"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-xl"
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                    style={{
                      background:
                        'linear-gradient(135deg, #00D4AA 0%, #6C3EF4 100%)',
                      boxShadow:
                        '0 16px 36px -12px rgba(0,212,170,0.55), 0 0 0 1px rgba(255,255,255,0.08) inset',
                    }}
                    initial={reduce ? undefined : { scale: 0.6, rotate: -12 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 16 }}
                  >
                    <CheckCircle2 className="w-6 h-6 text-white" strokeWidth={2.4} />
                  </motion.div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-[#00D4AA]">
                      Sealed · Master Hash Locked
                    </p>
                    <h3 className="mt-0.5 text-white font-black tracking-tight text-[17px] truncate">
                      {result.fileName}
                    </h3>
                    <p className="text-[11px] text-white/50">
                      {formatBytes(result.bytes)} · {formatMs(result.ms)} で完了
                    </p>
                  </div>
                </div>

                <div
                  className="mt-4 rounded-2xl border p-4"
                  style={{
                    background:
                      'linear-gradient(160deg, rgba(0,212,170,0.10) 0%, rgba(108,62,244,0.08) 100%)',
                    borderColor: 'rgba(0,212,170,0.30)',
                    boxShadow:
                      '0 24px 60px -30px rgba(0,212,170,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset',
                  }}
                >
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-[0.28em] text-white/60">
                      SHA-256 · MASTER HASH
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void copyHash();
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[10.5px] font-mono uppercase tracking-[0.18em] text-white/75 hover:text-white hover:bg-white/[0.06] transition-colors"
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-[#00D4AA]" /> COPIED
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> COPY
                        </>
                      )}
                    </button>
                  </div>
                  <p
                    className="font-mono text-[13px] sm:text-[14px] break-all leading-relaxed"
                    style={{
                      background:
                        'linear-gradient(90deg, #00D4AA 0%, #6C3EF4 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      filter: 'drop-shadow(0 0 10px rgba(0,212,170,0.35))',
                    }}
                  >
                    {result.sha256}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] font-mono">
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                    <p className="text-white/40 uppercase tracking-[0.22em]">Bytes</p>
                    <p className="mt-0.5 text-white/85 tabular-nums">{formatBytes(result.bytes)}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                    <p className="text-white/40 uppercase tracking-[0.22em]">Duration</p>
                    <p className="mt-0.5 text-white/85 tabular-nums">{formatMs(result.ms)}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                    <p className="text-white/40 uppercase tracking-[0.22em]">Egress</p>
                    <p className="mt-0.5 text-[#00D4AA]">Direct · R2 Vault</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2 justify-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetToIdle();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-bold text-[#07061A]"
                    style={{
                      background:
                        'linear-gradient(135deg, #00D4AA 0%, #6C3EF4 100%)',
                      boxShadow:
                        '0 14px 32px -12px rgba(0,212,170,0.55)',
                    }}
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    もう1本封印する
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void copyHash();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-semibold text-white/85 border border-white/10 hover:bg-white/[0.05] transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    ハッシュをコピー
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom hairline */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-px pointer-events-none"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(0,212,170,0.55), rgba(108,62,244,0.55), transparent)',
            }}
          />
        </div>

        {/* Hidden file input */}
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

      {/* Footer copy */}
      <div className="mt-3 flex items-center justify-between text-[10.5px] font-mono uppercase tracking-[0.24em] text-white/35 px-1">
        <span>PROOFMARK · CONSOLE 2.0</span>
        <span className="inline-flex items-center gap-1.5">
          <Lock className="w-3 h-3" />
          Direct-to-R2 · Signed Channel
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
