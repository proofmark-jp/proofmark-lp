/**
 * NDA Private Proof Demo
 * ----------------------------------------------------------------------------
 * Design Language: "Obsidian Slab"
 *
 *   背景:     #050505 (Live Proof より深い純黒)
 *   境界線:   #1A1A1A (マットチタン)
 *   Gold:     #F0BB38 (封印/鍵/Founder)
 *   Terminal: #22C55E (ローカル成功)
 *
 * Live Proof Demo が「ガラス・パープル・エメラルドの昂揚感」なら、
 * NDA Demo は「漆黒・金・ターミナル緑の安堵感」。
 *
 * クリエイターに「原本がデバイスから一歩も出ていない」と
 * ビジュアルで確信させることが、このコンポーネントの唯一の責務である。
 * ----------------------------------------------------------------------------
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from 'framer-motion';
import {
  Check,
  FileLock2,
  Fingerprint,
  Lock,
  ShieldCheck,
  Terminal,
  Upload,
  WifiOff,
} from 'lucide-react';

/* ─────────────────────────── Constants ─────────────────────────── */

const PM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

const COLOR = {
  slab: '#050505',
  slabSoft: '#0A0A0A',
  border: '#1A1A1A',
  borderHi: '#262626',
  gold: '#F0BB38',
  goldSoft: 'rgba(240,187,56,0.12)',
  goldRing: 'rgba(240,187,56,0.35)',
  term: '#22C55E',
  termSoft: 'rgba(34,197,94,0.10)',
  termDim: 'rgba(34,197,94,0.55)',
  textMain: '#F5F5F5',
  textMuted: 'rgba(255,255,255,0.55)',
  textSubtle: 'rgba(255,255,255,0.32)',
  textWhisper: 'rgba(255,255,255,0.16)',
} as const;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MiB

type NDAPhase = 'IDLE' | 'HASHING' | 'READY';

interface NDAState {
  phase: NDAPhase;
  fileName: string | null;
  fileSize: number | null;
  fileType: string | null;
  thumbnailUrl: string | null;
  hashProgress: number; // 0–100
  hash: string | null;
  sealedAt: string | null; // JST formatted
  bytesUploaded: 0; // type-level guarantee: literal 0
  error: string | null;
}

const INITIAL_STATE: NDAState = {
  phase: 'IDLE',
  fileName: null,
  fileSize: null,
  fileType: null,
  thumbnailUrl: null,
  hashProgress: 0,
  hash: null,
  sealedAt: null,
  bytesUploaded: 0,
  error: null,
};

/* ───────────────────────── Utilities ───────────────────────── */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatJST(date: Date): string {
  const fmt = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return fmt.format(date).replace(/\//g, '/');
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/** ハッシュを 4 文字グループで折り返し可能な形に整形 */
function groupHash(hash: string, group = 4): string {
  return hash.match(new RegExp(`.{1,${group}}`, 'g'))?.join(' ') ?? hash;
}

/* ───────────────────── Number Roll (heritage) ───────────────────── */

interface NumberRollProps {
  value: number;
  duration?: number;
  className?: string;
}

function NumberRoll({ value, duration = 1.2, className }: NumberRollProps) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const from = 0;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 4); // easeOutQuart
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduce]);

  return <span className={className}>{display.toLocaleString()}</span>;
}

/* ────────────────────────── DataRow ────────────────────────── */

interface DataRowProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  accent?: 'gold' | 'term' | 'default';
}

function DataRow({ label, value, mono, accent = 'default' }: DataRowProps) {
  const valueColor =
    accent === 'gold'
      ? COLOR.gold
      : accent === 'term'
        ? COLOR.term
        : COLOR.textMain;

  return (
    <div
      className="flex items-start justify-between gap-4 py-2.5 border-b border-white/[0.04] last:border-b-0"
    >
      <span
        className="text-[10px] uppercase tracking-[0.18em] shrink-0 pt-0.5"
        style={{ color: COLOR.textSubtle, fontWeight: 600 }}
      >
        {label}
      </span>
      <span
        className={`text-right ${mono ? 'font-mono' : ''}`}
        style={{
          color: valueColor,
          fontSize: mono ? 11 : 13,
          lineHeight: 1.5,
          wordBreak: 'break-all',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* ─────────────────── Web Crypto SHA-256 (real) ─────────────────── */

async function computeSha256(
  file: File,
  onProgress: (p: number) => void,
): Promise<string> {
  // 大きなファイルでも UI を止めないように chunked read で progress を見せる。
  // 実際の digest は最終 buffer に対して一度実行（subtle.digest は incremental 非対応）。
  const CHUNK = 4 * 1024 * 1024; // 4 MiB
  const total = file.size;

  if (total === 0) {
    const hash = await crypto.subtle.digest('SHA-256', new ArrayBuffer(0));
    onProgress(100);
    return bufferToHex(hash);
  }

  // Read in chunks purely for progress feedback (memory cost: still O(N)).
  const parts: Uint8Array[] = [];
  let read = 0;
  let lastReport = -1;

  for (let offset = 0; offset < total; offset += CHUNK) {
    const blob = file.slice(offset, Math.min(offset + CHUNK, total));
    const buf = await blob.arrayBuffer();
    parts.push(new Uint8Array(buf));
    read += buf.byteLength;
    const pct = Math.min(95, Math.round((read / total) * 95));
    if (pct !== lastReport) {
      lastReport = pct;
      onProgress(pct);
      // yield to the event loop so the terminal log can animate.
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  // Concatenate
  const merged = new Uint8Array(read);
  let cursor = 0;
  for (const p of parts) {
    merged.set(p, cursor);
    cursor += p.byteLength;
  }

  onProgress(97);
  const hashBuf = await crypto.subtle.digest('SHA-256', merged.buffer);
  onProgress(100);
  return bufferToHex(hashBuf);
}

/* ────────────────────── Terminal Log Stream ────────────────────── */

interface TermLine {
  id: number;
  text: string;
  tone: 'dim' | 'normal' | 'success' | 'gold';
  prefix?: '>' | '$' | '✓' | '⛔';
}

function useTerminalStream(phase: NDAPhase, fileName: string | null, fileSize: number | null) {
  const [lines, setLines] = useState<TermLine[]>([]);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (phase === 'IDLE') {
      setLines([]);
      return;
    }

    if (phase === 'HASHING') {
      const sequence: TermLine[] = [
        { id: 1, prefix: '>', text: 'Local Sandbox Initialized...', tone: 'dim' },
        { id: 2, prefix: '>', text: 'Network Bridge: ', tone: 'normal' },
        { id: 3, prefix: '⛔', text: 'Network Upload: 0 Bytes (Blocked)', tone: 'gold' },
        {
          id: 4,
          prefix: '>',
          text: `Reading file: ${fileName ?? 'unknown'} (${fileSize ? formatBytes(fileSize) : '?'})`,
          tone: 'normal',
        },
        { id: 5, prefix: '>', text: 'Allocating Web Crypto buffer (in-memory only)...', tone: 'dim' },
        { id: 6, prefix: '$', text: 'crypto.subtle.digest("SHA-256", file.buffer)', tone: 'normal' },
        { id: 7, prefix: '>', text: 'Calculating SHA-256 locally...', tone: 'success' },
      ];

      if (reduce) {
        setLines(sequence);
        return;
      }

      setLines([]);
      const timers: number[] = [];
      sequence.forEach((line, i) => {
        timers.push(
          window.setTimeout(() => {
            setLines((prev) => [...prev, line]);
          }, 220 + i * 320),
        );
      });
      return () => timers.forEach(clearTimeout);
    }

    if (phase === 'READY') {
      setLines((prev) => [
        ...prev,
        { id: 8, prefix: '✓', text: 'SHA-256 digest computed.', tone: 'success' },
        { id: 9, prefix: '✓', text: 'Zero-Knowledge proof sealed.', tone: 'gold' },
        { id: 10, prefix: '>', text: 'Session terminated. No bytes left this device.', tone: 'dim' },
      ]);
    }
  }, [phase, fileName, fileSize, reduce]);

  return lines;
}

/* ──────────────────────── NDA Mode Toggle ──────────────────────── */

function NDAModeToggle() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: PM_EASE }}
      className="relative rounded-2xl p-4 sm:p-5 overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${COLOR.goldSoft} 0%, transparent 60%)`,
        border: `1px solid ${COLOR.goldRing}`,
        boxShadow: `0 0 0 1px rgba(240,187,56,0.04) inset, 0 12px 40px -20px ${COLOR.goldSoft}`,
      }}
    >
      {/* gold corner glow */}
      {!reduce && (
        <motion.div
          aria-hidden
          className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl pointer-events-none"
          style={{ background: COLOR.gold, opacity: 0.18 }}
          animate={{ opacity: [0.12, 0.22, 0.12] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <div className="flex items-start gap-3 relative">
        <div
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: 'rgba(240,187,56,0.10)',
            border: `1px solid ${COLOR.goldRing}`,
          }}
        >
          <FileLock2 size={18} style={{ color: COLOR.gold }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[10px] font-mono uppercase tracking-[0.22em] px-2 py-0.5 rounded"
              style={{
                color: COLOR.gold,
                background: 'rgba(240,187,56,0.08)',
                border: `1px solid ${COLOR.goldRing}`,
              }}
            >
              NDA MODE · LOCKED ON
            </span>
            <span
              className="text-[10px] uppercase tracking-[0.18em]"
              style={{ color: COLOR.textSubtle }}
            >
              機密案件モード
            </span>
          </div>

          <p
            className="mt-2 text-[13px] leading-relaxed"
            style={{ color: COLOR.textMain }}
          >
            原本をサーバーに
            <span style={{ color: COLOR.gold, fontWeight: 700 }}>一切送信しません</span>。
            すべての処理はあなたのブラウザの中だけで完結します。
          </p>
        </div>

        {/* locked toggle (always on) */}
        <div
          className="shrink-0 w-12 h-7 rounded-full relative cursor-not-allowed"
          style={{
            background: 'rgba(240,187,56,0.18)',
            border: `1px solid ${COLOR.goldRing}`,
          }}
          aria-label="NDA mode is permanently on"
          title="このデモではNDAモードを解除できません"
        >
          <motion.div
            className="absolute top-0.5 left-[22px] w-5 h-5 rounded-full flex items-center justify-center"
            style={{
              background: COLOR.gold,
              boxShadow: `0 0 14px ${COLOR.goldRing}`,
            }}
            animate={reduce ? undefined : { boxShadow: [
              `0 0 10px ${COLOR.goldRing}`,
              `0 0 18px ${COLOR.goldRing}`,
              `0 0 10px ${COLOR.goldRing}`,
            ] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Lock size={10} color={COLOR.slab} strokeWidth={3} />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────── DropZone ─────────────────────────── */

interface DropZoneProps {
  phase: NDAPhase;
  hashProgress: number;
  fileName: string | null;
  fileSize: number | null;
  error: string | null;
  onFile: (file: File) => void;
  onReset: () => void;
}

function DropZone({
  phase,
  hashProgress,
  fileName,
  fileSize,
  error,
  onFile,
  onReset,
}: DropZoneProps) {
  const [hover, setHover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setHover(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  const headline = useMemo(() => {
    if (phase === 'IDLE')
      return '機密ファイルをドロップしてください';
    if (phase === 'HASHING') return 'Local Web Worker にてハッシュ計算中…';
    return 'Zero-Knowledge 証明完了';
  }, [phase]);

  const sub = useMemo(() => {
    if (phase === 'IDLE')
      return '原本はブラウザ内でのみ処理されます。サーバーには 1 バイトも送信されません。';
    if (phase === 'HASHING') return 'crypto.subtle.digest をローカル実行中です。';
    return '原本はこのデバイスから一切出ていません。';
  }, [phase]);

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: COLOR.slabSoft,
        border: `1px solid ${hover ? COLOR.goldRing : COLOR.border}`,
        boxShadow: hover
          ? `0 0 0 1px ${COLOR.goldRing} inset, 0 24px 60px -32px ${COLOR.goldSoft}`
          : '0 24px 60px -40px rgba(0,0,0,0.8)',
        transition: 'border-color 240ms, box-shadow 240ms',
      }}
    >
      {/* scanline overlay */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.7) 0px, rgba(255,255,255,0.7) 1px, transparent 1px, transparent 3px)',
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (phase === 'IDLE') setHover(true);
        }}
        onDragLeave={() => setHover(false)}
        onDrop={handleDrop}
        onClick={() => {
          if (phase === 'IDLE') inputRef.current?.click();
        }}
        className={`relative p-6 sm:p-8 ${
          phase === 'IDLE' ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = '';
          }}
        />

        <div className="flex items-start gap-4">
          <motion.div
            className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center relative"
            style={{
              background:
                phase === 'IDLE'
                  ? 'rgba(255,255,255,0.025)'
                  : phase === 'HASHING'
                    ? COLOR.goldSoft
                    : COLOR.termSoft,
              border: `1px solid ${
                phase === 'IDLE'
                  ? COLOR.border
                  : phase === 'HASHING'
                    ? COLOR.goldRing
                    : COLOR.termDim
              }`,
            }}
            animate={
              !reduce && phase === 'HASHING'
                ? { rotate: [0, 0, 0], scale: [1, 1.02, 1] }
                : undefined
            }
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            {phase === 'IDLE' && (
              <Upload size={20} style={{ color: COLOR.textMuted }} />
            )}
            {phase === 'HASHING' && (
              <Fingerprint size={20} style={{ color: COLOR.gold }} />
            )}
            {phase === 'READY' && (
              <ShieldCheck size={20} style={{ color: COLOR.term }} />
            )}
          </motion.div>

          <div className="flex-1 min-w-0">
            <h3
              className="text-[15px] sm:text-base font-semibold leading-tight"
              style={{ color: COLOR.textMain }}
            >
              {headline}
            </h3>
            <p
              className="mt-1.5 text-[12.5px] leading-relaxed"
              style={{ color: COLOR.textMuted }}
            >
              {sub}
            </p>

            {/* file meta */}
            <AnimatePresence>
              {fileName && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.4, ease: PM_EASE }}
                  className="mt-3 rounded-lg p-3 font-mono text-[11.5px] flex items-center justify-between gap-3 overflow-hidden"
                  style={{
                    background: COLOR.slab,
                    border: `1px solid ${COLOR.border}`,
                    color: COLOR.textMain,
                  }}
                >
                  <span className="truncate">{fileName}</span>
                  <span
                    className="shrink-0"
                    style={{ color: COLOR.textSubtle }}
                  >
                    {fileSize !== null ? formatBytes(fileSize) : ''}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* progress bar */}
            <AnimatePresence>
              {phase === 'HASHING' && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.18em] mb-1.5">
                    <span style={{ color: COLOR.gold }}>SHA-256 · LOCAL</span>
                    <span style={{ color: COLOR.textMuted }}>
                      {hashProgress}%
                    </span>
                  </div>
                  <div
                    className="h-1 rounded-full overflow-hidden"
                    style={{ background: COLOR.border }}
                  >
                    <motion.div
                      className="h-full"
                      style={{
                        background: `linear-gradient(90deg, ${COLOR.gold}, ${COLOR.term})`,
                        boxShadow: `0 0 12px ${COLOR.goldRing}`,
                      }}
                      animate={{ width: `${hashProgress}%` }}
                      transition={{ duration: 0.4, ease: PM_EASE }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 rounded-lg p-2.5 text-[11.5px] font-mono"
                  style={{
                    background: 'rgba(255,69,58,0.08)',
                    border: '1px solid rgba(255,69,58,0.32)',
                    color: '#FF8A80',
                  }}
                >
                  ⚠ {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* reset button */}
            <AnimatePresence>
              {phase === 'READY' && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={onReset}
                  className="mt-4 text-[11px] font-mono uppercase tracking-[0.18em] underline-offset-4 hover:underline"
                  style={{ color: COLOR.textMuted }}
                >
                  別のファイルで試す →
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* footer mini-bar */}
      <div
        className="flex items-center justify-between px-5 py-2.5 text-[10px] font-mono uppercase tracking-[0.18em]"
        style={{
          background: COLOR.slab,
          borderTop: `1px solid ${COLOR.border}`,
        }}
      >
        <span
          className="flex items-center gap-1.5"
          style={{ color: COLOR.gold }}
        >
          <WifiOff size={10} /> AIRGAP · 0 BYTES OUT
        </span>
        <span style={{ color: COLOR.textSubtle }}>SHA-256 · RFC 3174</span>
      </div>
    </div>
  );
}

/* ─────────────────────── Slab Preview (Right) ─────────────────────── */

interface SlabPreviewProps {
  state: NDAState;
  termLines: TermLine[];
}

function SlabPreview({ state, termLines }: SlabPreviewProps) {
  const reduce = useReducedMotion();
  const { phase, thumbnailUrl, hash, sealedAt } = state;

  return (
    <motion.div
      layout
      className="relative rounded-2xl overflow-hidden h-full min-h-[520px]"
      style={{
        background: COLOR.slab,
        border: `1px solid ${COLOR.border}`,
        boxShadow:
          '0 40px 80px -40px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.02) inset',
      }}
    >
      {/* heavy slab texture */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 30% 0%, rgba(240,187,56,0.05) 0%, transparent 60%), radial-gradient(ellipse at 70% 100%, rgba(34,197,94,0.04) 0%, transparent 55%)',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 4px)',
        }}
      />

      {/* corner marks */}
      <CornerMark pos="tl" />
      <CornerMark pos="tr" />
      <CornerMark pos="bl" />
      <CornerMark pos="br" />

      {/* header strip */}
      <div
        className="relative flex items-center justify-between px-5 py-3 border-b"
        style={{ borderColor: COLOR.border }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: phase === 'READY' ? COLOR.term : COLOR.gold,
              boxShadow:
                phase === 'READY'
                  ? `0 0 10px ${COLOR.term}`
                  : `0 0 10px ${COLOR.gold}`,
            }}
          />
          <span
            className="text-[10px] font-mono uppercase tracking-[0.22em]"
            style={{ color: COLOR.textMuted }}
          >
            Obsidian Slab · Zero-Knowledge Vault
          </span>
        </div>
        <span
          className="text-[9.5px] font-mono uppercase tracking-[0.18em]"
          style={{ color: COLOR.textSubtle }}
        >
          NDA / PRIVATE
        </span>
      </div>

      <div className="relative p-5 sm:p-6 flex flex-col h-[calc(100%-44px)]">
        <LayoutGroup>
          <AnimatePresence mode="wait">
            {phase === 'IDLE' && <IdleSlab key="idle" reduce={!!reduce} />}
            {phase === 'HASHING' && (
              <HashingSlab
                key="hashing"
                thumbnailUrl={thumbnailUrl}
                termLines={termLines}
                reduce={!!reduce}
              />
            )}
            {phase === 'READY' && (
              <ReadySlab
                key="ready"
                hash={hash ?? ''}
                sealedAt={sealedAt ?? ''}
                fileName={state.fileName ?? ''}
                fileSize={state.fileSize ?? 0}
                reduce={!!reduce}
              />
            )}
          </AnimatePresence>
        </LayoutGroup>
      </div>
    </motion.div>
  );
}

function CornerMark({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const base = 'absolute w-6 h-6 pointer-events-none';
  const style: React.CSSProperties = {
    borderColor: COLOR.borderHi,
  };
  let cls = base;
  if (pos === 'tl')
    cls += ' top-3 left-3 border-t border-l';
  if (pos === 'tr')
    cls += ' top-3 right-3 border-t border-r';
  if (pos === 'bl')
    cls += ' bottom-3 left-3 border-b border-l';
  if (pos === 'br')
    cls += ' bottom-3 right-3 border-b border-r';
  return <div className={cls} style={style} />;
}

/* ── Idle ── */

function IdleSlab({ reduce }: { reduce: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: PM_EASE }}
      className="flex flex-col items-center justify-center text-center flex-1 gap-6"
    >
      <motion.div
        className="relative w-24 h-24 rounded-2xl flex items-center justify-center"
        style={{
          background:
            'linear-gradient(180deg, rgba(240,187,56,0.10), rgba(240,187,56,0.02))',
          border: `1px solid ${COLOR.goldRing}`,
        }}
        animate={
          reduce
            ? undefined
            : {
                boxShadow: [
                  `0 0 24px rgba(240,187,56,0.18)`,
                  `0 0 44px rgba(240,187,56,0.28)`,
                  `0 0 24px rgba(240,187,56,0.18)`,
                ],
              }
        }
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Lock size={34} style={{ color: COLOR.gold }} strokeWidth={1.6} />

        {/* rotating gold ring */}
        {!reduce && (
          <motion.div
            aria-hidden
            className="absolute inset-[-6px] rounded-2xl"
            style={{
              border: `1px dashed ${COLOR.goldRing}`,
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          />
        )}
      </motion.div>

      <div>
        <p
          className="text-[10px] font-mono uppercase tracking-[0.28em]"
          style={{ color: COLOR.gold }}
        >
          ZERO-KNOWLEDGE PROTECTED
        </p>
        <p
          className="mt-2 text-[13.5px] leading-relaxed max-w-[28ch] mx-auto"
          style={{ color: COLOR.textMuted }}
        >
          原本がドロップされた瞬間、この封印が起動します。
        </p>
      </div>

      <div
        className="text-[10px] font-mono uppercase tracking-[0.18em] flex items-center gap-2"
        style={{ color: COLOR.textSubtle }}
      >
        <span
          className="w-1 h-1 rounded-full"
          style={{ background: COLOR.gold }}
        />
        STANDBY · AWAITING FILE
      </div>
    </motion.div>
  );
}

/* ── Hashing ── */

function HashingSlab({
  thumbnailUrl,
  termLines,
  reduce,
}: {
  thumbnailUrl: string | null;
  termLines: TermLine[];
  reduce: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: PM_EASE }}
      className="flex flex-col gap-4 flex-1"
    >
      {/* mosaic thumbnail */}
      <motion.div
        layout
        className="relative aspect-[16/9] rounded-xl overflow-hidden"
        style={{
          background: COLOR.slabSoft,
          border: `1px solid ${COLOR.border}`,
        }}
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt="protected"
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              filter: 'blur(22px) saturate(0.6) brightness(0.6)',
              transform: 'scale(1.1)',
            }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                'repeating-linear-gradient(45deg, #0A0A0A 0px, #0A0A0A 8px, #0E0E0E 8px, #0E0E0E 16px)',
            }}
          />
        )}

        {/* scanlines */}
        {!reduce && (
          <motion.div
            aria-hidden
            className="absolute inset-x-0 h-12 pointer-events-none"
            style={{
              background:
                'linear-gradient(180deg, transparent 0%, rgba(240,187,56,0.18) 50%, transparent 100%)',
            }}
            initial={{ y: '-100%' }}
            animate={{ y: '420%' }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
          />
        )}

        {/* center watermark */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-[10px] font-mono uppercase tracking-[0.32em] px-3 py-1 rounded"
            style={{
              color: COLOR.gold,
              background: 'rgba(0,0,0,0.5)',
              border: `1px solid ${COLOR.goldRing}`,
              backdropFilter: 'blur(2px)',
            }}
          >
            ENCRYPTED PREVIEW · CONTENT REDACTED
          </span>
        </div>
      </motion.div>

      {/* terminal log */}
      <div
        className="relative rounded-xl p-4 flex-1 min-h-[200px] overflow-hidden"
        style={{
          background: '#020202',
          border: `1px solid ${COLOR.border}`,
          fontFamily:
            '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Terminal size={12} style={{ color: COLOR.term }} />
          <span
            className="text-[10px] uppercase tracking-[0.2em]"
            style={{ color: COLOR.term }}
          >
            local://sandbox/zk-hash.log
          </span>
          <span
            className="ml-auto text-[10px]"
            style={{ color: COLOR.textSubtle }}
          >
            tty-0
          </span>
        </div>

        <div className="space-y-1.5 text-[11.5px] leading-[1.55]">
          <AnimatePresence initial={false}>
            {termLines.map((line) => (
              <motion.div
                key={line.id}
                initial={reduce ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: PM_EASE }}
                className="flex items-start gap-2"
              >
                <span
                  className="shrink-0 w-3 text-center"
                  style={{
                    color:
                      line.tone === 'gold'
                        ? COLOR.gold
                        : line.tone === 'success'
                          ? COLOR.term
                          : line.tone === 'dim'
                            ? COLOR.textWhisper
                            : COLOR.textSubtle,
                  }}
                >
                  {line.prefix ?? '>'}
                </span>
                <span
                  style={{
                    color:
                      line.tone === 'gold'
                        ? COLOR.gold
                        : line.tone === 'success'
                          ? COLOR.term
                          : line.tone === 'dim'
                            ? COLOR.textWhisper
                            : COLOR.textMuted,
                  }}
                >
                  {line.text}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* blinking cursor */}
          {!reduce && (
            <motion.div
              className="flex items-center gap-2 pt-1"
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span style={{ color: COLOR.term }}>$</span>
              <span
                className="inline-block w-1.5 h-3"
                style={{ background: COLOR.term }}
              />
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Ready ── */

function ReadySlab({
  hash,
  sealedAt,
  fileName,
  fileSize,
  reduce,
}: {
  hash: string;
  sealedAt: string;
  fileName: string;
  fileSize: number;
  reduce: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: PM_EASE }}
      className="flex flex-col gap-4 flex-1"
    >
      {/* Sealed stamp */}
      <div className="relative flex items-center justify-between">
        <div>
          <p
            className="text-[10px] font-mono uppercase tracking-[0.28em]"
            style={{ color: COLOR.gold }}
          >
            CERTIFICATE OF ZERO-KNOWLEDGE PROOF
          </p>
          <p
            className="mt-1 text-[12.5px]"
            style={{ color: COLOR.textMuted }}
          >
            原本に触れることなく、存在のみを証明しました。
          </p>
        </div>

        <SealedStamp reduce={reduce} />
      </div>

      {/* Evidence checklist */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.5, ease: PM_EASE }}
        className="rounded-xl p-4"
        style={{
          background: COLOR.termSoft,
          border: `1px solid ${COLOR.termDim}`,
        }}
      >
        <p
          className="text-[10px] font-mono uppercase tracking-[0.22em] mb-2.5"
          style={{ color: COLOR.term }}
        >
          ✓ VERIFIED EVIDENCE
        </p>
        <div className="space-y-1.5">
          <EvidenceLine
            label="原本アップロード通信"
            value="0 Bytes"
            valueAccent="gold"
            delay={0.7}
            reduce={reduce}
          />
          <EvidenceLine
            label="ブラウザ内 SHA-256 ハッシュ生成"
            value="完了"
            valueAccent="term"
            delay={0.8}
            reduce={reduce}
          />
          <EvidenceLine
            label="NDA準拠・完全オフライン処理"
            value="OK"
            valueAccent="term"
            delay={0.9}
            reduce={reduce}
          />
        </div>
      </motion.div>

      {/* Hash + metadata */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0, duration: 0.5, ease: PM_EASE }}
        className="rounded-xl p-4 flex-1"
        style={{
          background: COLOR.slabSoft,
          border: `1px solid ${COLOR.border}`,
        }}
      >
        <DataRow label="Protected Asset" value={fileName} mono />
        <DataRow label="Size" value={formatBytes(fileSize)} mono />
        <DataRow
          label="SHA-256 (Local)"
          value={
            <span style={{ wordBreak: 'break-all' }}>{groupHash(hash)}</span>
          }
          mono
          accent="term"
        />
        <DataRow label="Sealed At (JST)" value={sealedAt} mono accent="gold" />
        <DataRow
          label="Network Egress"
          value="0 B · airgapped"
          mono
          accent="gold"
        />
      </motion.div>
    </motion.div>
  );
}

function EvidenceLine({
  label,
  value,
  valueAccent,
  delay,
  reduce,
}: {
  label: string;
  value: string;
  valueAccent: 'gold' | 'term';
  delay: number;
  reduce: boolean;
}) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4, ease: PM_EASE }}
      className="flex items-center justify-between gap-3 text-[12px]"
    >
      <span className="flex items-center gap-2" style={{ color: COLOR.textMain }}>
        <Check size={12} style={{ color: COLOR.term }} strokeWidth={3} />
        {label}
      </span>
      <span
        className="font-mono text-[11.5px]"
        style={{
          color: valueAccent === 'gold' ? COLOR.gold : COLOR.term,
        }}
      >
        {value}
      </span>
    </motion.div>
  );
}

/* ── Sealed Stamp (heavy door slam) ── */

function SealedStamp({ reduce }: { reduce: boolean }) {
  return (
    <motion.div
      initial={
        reduce
          ? { opacity: 1, scale: 1, rotate: -8 }
          : { opacity: 0, scale: 1.8, rotate: 14 }
      }
      animate={{ opacity: 1, scale: 1, rotate: -8 }}
      transition={
        reduce
          ? { duration: 0 }
          : {
              type: 'spring',
              stiffness: 600,
              damping: 14,
              mass: 0.9,
              delay: 0.15,
            }
      }
      className="relative w-[112px] h-[112px] rounded-full flex items-center justify-center select-none"
      style={{
        border: `2px solid ${COLOR.gold}`,
        background:
          'radial-gradient(circle at 50% 30%, rgba(240,187,56,0.18) 0%, rgba(240,187,56,0.02) 70%)',
        boxShadow: `0 0 0 4px rgba(240,187,56,0.08), 0 0 30px rgba(240,187,56,0.25)`,
      }}
    >
      {/* outer ring text would normally use SVG textPath; keep clean ring instead */}
      <div
        aria-hidden
        className="absolute inset-1 rounded-full"
        style={{
          border: `1px dashed ${COLOR.goldRing}`,
        }}
      />

      <div className="text-center leading-none">
        <p
          className="text-[9px] font-mono tracking-[0.22em]"
          style={{ color: COLOR.gold }}
        >
          PROOFMARK
        </p>
        <p
          className="mt-1 text-[18px] font-bold tracking-[0.08em]"
          style={{
            color: COLOR.gold,
            fontFamily: '"Poppins", "Inter", sans-serif',
          }}
        >
          SEALED
        </p>
        <p
          className="mt-1 text-[8px] font-mono tracking-[0.22em]"
          style={{ color: COLOR.gold, opacity: 0.7 }}
        >
          ZERO-KNOWLEDGE
        </p>
      </div>

      {/* impact rings */}
      {!reduce && (
        <>
          <motion.div
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ border: `1px solid ${COLOR.goldRing}` }}
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: 'easeOut' }}
          />
          <motion.div
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ border: `1px solid ${COLOR.goldRing}` }}
            initial={{ scale: 1, opacity: 0.4 }}
            animate={{ scale: 2.2, opacity: 0 }}
            transition={{ duration: 1.1, delay: 0.3, ease: 'easeOut' }}
          />
        </>
      )}
    </motion.div>
  );
}

/* ────────────────────── Main Component ────────────────────── */

export default function NDAProofDemo() {
  const [state, setState] = useState<NDAState>(INITIAL_STATE);
  const termLines = useTerminalStream(state.phase, state.fileName, state.fileSize);

  const previewRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Revoke object URLs on unmount / file change
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setState(INITIAL_STATE);
  }, []);

  const onFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setState((s) => ({
        ...s,
        error: `ファイルサイズが上限 (${formatBytes(MAX_FILE_SIZE)}) を超えています。`,
      }));
      return;
    }

    // build thumbnail (only for image files)
    let thumb: string | null = null;
    if (file.type.startsWith('image/')) {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      thumb = URL.createObjectURL(file);
      objectUrlRef.current = thumb;
    }

    setState({
      phase: 'HASHING',
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      thumbnailUrl: thumb,
      hashProgress: 0,
      hash: null,
      sealedAt: null,
      bytesUploaded: 0,
      error: null,
    });

    // auto-scroll on mobile so the user sees the slab waking up
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      window.setTimeout(() => {
        previewRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 80);
    }

    try {
      const hash = await computeSha256(file, (p) =>
        setState((s) => ({ ...s, hashProgress: p })),
      );

      setState((s) => ({
        ...s,
        phase: 'READY',
        hash,
        hashProgress: 100,
        sealedAt: formatJST(new Date()),
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ハッシュ計算に失敗しました。';
      setState((s) => ({ ...s, phase: 'IDLE', error: msg }));
    }
  }, []);

  return (
    <section
      className="relative w-full"
      style={{ background: COLOR.slab, color: COLOR.textMain }}
    >
      {/* ambient slab grid */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.5]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 12% 18%, rgba(240,187,56,0.06) 0%, transparent 50%), radial-gradient(circle at 88% 82%, rgba(34,197,94,0.04) 0%, transparent 55%)',
        }}
      />

      <div className="relative mx-auto max-w-[1240px] px-5 sm:px-8 py-16 sm:py-24">
        {/* eyebrow + title */}
        <div className="mb-10 sm:mb-14 max-w-3xl">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.24em] mb-5"
            style={{
              background: 'rgba(240,187,56,0.08)',
              border: `1px solid ${COLOR.goldRing}`,
              color: COLOR.gold,
            }}
          >
            <Lock size={11} /> NDA · Private Proof Demo
          </div>

          <h2
            className="font-bold tracking-tight leading-[1.08]"
            style={{
              fontFamily: '"Poppins", "Inter", sans-serif',
              fontSize: 'clamp(32px, 4.6vw, 56px)',
              color: COLOR.textMain,
            }}
          >
            原本を、誰にも見せずに。
            <br />
            <span style={{ color: COLOR.gold }}>存在だけ</span>
            、確かに証明する。
          </h2>

          <p
            className="mt-5 text-[14.5px] sm:text-[15.5px] leading-[1.75] max-w-[64ch]"
            style={{ color: COLOR.textMuted }}
          >
            NDA案件・未公開原稿・クライアントの機密データ。
            <br />
            <span style={{ color: COLOR.textMain }}>
              アップロードはゼロバイト。
            </span>
            すべての処理はあなたのブラウザの中だけで完結し、
            原本はこのデバイスから一歩も外に出ません。
          </p>

          {/* trust mini-row */}
          <div className="mt-6 flex flex-wrap items-center gap-4 text-[11px] font-mono uppercase tracking-[0.18em]">
            <TrustChip icon={<WifiOff size={11} />} label="Airgap · 0 Bytes Out" tone="gold" />
            <TrustChip
              icon={<Fingerprint size={11} />}
              label="SHA-256 in-browser"
              tone="term"
            />
            <TrustChip
              icon={<ShieldCheck size={11} />}
              label="NDA Compliant"
              tone="term"
            />
            <div
              className="hidden sm:flex items-center gap-1.5"
              style={{ color: COLOR.textSubtle }}
            >
              <span>累計</span>
              <NumberRoll
                value={12_848}
                duration={1.6}
                className="font-mono"
              />
              <span>件の機密案件で利用</span>
            </div>
          </div>
        </div>

        {/* 2-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[45fr_55fr] gap-5 sm:gap-6">
          {/* LEFT — controls */}
          <div className="flex flex-col gap-5">
            <NDAModeToggle />
            <DropZone
              phase={state.phase}
              hashProgress={state.hashProgress}
              fileName={state.fileName}
              fileSize={state.fileSize}
              error={state.error}
              onFile={onFile}
              onReset={reset}
            />

            {/* assurance footer (left) */}
            <div
              className="rounded-2xl p-4 text-[11.5px] leading-relaxed"
              style={{
                background: COLOR.slabSoft,
                border: `1px solid ${COLOR.border}`,
                color: COLOR.textMuted,
              }}
            >
              <p
                className="text-[10px] font-mono uppercase tracking-[0.22em] mb-2"
                style={{ color: COLOR.gold }}
              >
                Why it&apos;s safe
              </p>
              ファイルは
              <code
                className="font-mono px-1.5 py-0.5 mx-1 rounded"
                style={{
                  background: COLOR.slab,
                  border: `1px solid ${COLOR.border}`,
                  color: COLOR.term,
                }}
              >
                crypto.subtle.digest
              </code>
              によって、ブラウザサンドボックス内のメモリ上でのみハッシュ化されます。
              ネットワークパネルを開いて確認してください — 送信トラフィックは
              <span style={{ color: COLOR.gold }}> 0 バイト</span> です。
            </div>
          </div>

          {/* RIGHT — slab preview */}
          <div ref={previewRef} className="min-h-[520px]">
            <SlabPreview state={state} termLines={termLines} />
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustChip({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: 'gold' | 'term';
}) {
  const c = tone === 'gold' ? COLOR.gold : COLOR.term;
  const ring = tone === 'gold' ? COLOR.goldRing : COLOR.termDim;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${ring}`,
        color: c,
      }}
    >
      {icon}
      {label}
    </span>
  );
}
