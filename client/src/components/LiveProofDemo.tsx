/**
 * LiveProofDemo.tsx — ProofMark LP Section 2 の核心
 * ─────────────────────────────────────────────────────────────
 *  「ファイルを投げると、証明書が生まれる」を体験させるインタラクティブデモ。
 *
 *  - 左カラム: DropZone + サンプル 3 ボタン
 *  - 右カラム: CertificatePreview がリアルタイムで「育っていく」
 *  - HASHING 完了の瞬間: Teal パルス + ✅ spring 出現 + 左カラムに ¥480 CTA
 *  - モバイル: HASHING 突入瞬間に scrollIntoView で右カラムへ自動スクロール
 *
 *  ビジュアル言語は client/src/pages/CertificatePage.tsx と完全同期:
 *    VERIFIED バッジ (Teal), FOUNDER (Gold + Purple glow),
 *    SHA-256 Teal パネル, RFC3161 chip, monospace hex.
 * ─────────────────────────────────────────────────────────────
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link } from 'wouter';
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
  useReducedMotion,
} from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  FileText,
  ImageIcon,
  Layers,
  Lock,
  Paintbrush,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';

/* ═════════════════════════════════════════════
 *  Shared utilities (re-export-friendly)
 * ═════════════════════════════════════════════ */

export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** NumberRoll — 発行件数カウンタ。digit ごとに縦スクロール。 */
export function NumberRoll({
  value,
  reduce = false,
}: {
  value: number;
  reduce?: boolean;
}): JSX.Element {
  const digits = useMemo(
    () => value.toLocaleString('en-US').split(''),
    [value],
  );

  return (
    <span className="inline-flex font-mono tracking-tight">
      {digits.map((d, i) => {
        if (!/\d/.test(d)) {
          return (
            <span key={`s-${i}`} className="px-[1px] opacity-60">
              {d}
            </span>
          );
        }
        return (
          <span
            key={`d-${i}-${value}`}
            className="relative inline-block overflow-hidden align-baseline"
            style={{ height: '1em', width: '0.6em' }}
            aria-hidden
          >
            <motion.span
              className="absolute inset-x-0 flex flex-col items-center"
              initial={false}
              animate={{ y: `-${Number(d)}em` }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { duration: 0.6, ease: EASE_OUT_EXPO }
              }
            >
              {Array.from({ length: 10 }, (_, n) => (
                <span key={n} style={{ height: '1em', lineHeight: '1em' }}>
                  {n}
                </span>
              ))}
            </motion.span>
          </span>
        );
      })}
    </span>
  );
}

/** DataRow — 証明書内の label + value 行（CertificatePage と同じ言語） */
export function DataRow({
  label,
  value,
  accent = 'muted',
  mono = false,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  accent?: 'muted' | 'teal' | 'gold';
  mono?: boolean;
  icon?: React.ReactNode;
}): JSX.Element {
  const labelColor =
    accent === 'teal'
      ? '#00D4AA'
      : accent === 'gold'
        ? '#F0BB38'
        : '#A8A0D8';
  return (
    <div>
      <p
        className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.22em] sm:text-[11px]"
        style={{ color: labelColor }}
      >
        {icon}
        {label}
      </p>
      <div
        className={[
          mono ? 'font-mono text-[11px] sm:text-xs' : 'text-sm sm:text-[15px]',
          'text-white',
        ].join(' ')}
        style={{ wordBreak: mono ? 'break-all' : 'normal' }}
      >
        {value}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════
 *  Types & sample assets
 * ═════════════════════════════════════════════ */

type DemoPhase = 'IDLE' | 'HASHING' | 'READY';

interface DemoState {
  phase: DemoPhase;
  fileName: string | null;
  fileSize: number | null;
  fileType: string | null;
  thumbnailUrl: string | null;
  hashProgress: number; // 0-100
  hash: string | null;
}

interface SampleDescriptor {
  id: 'illust' | 'pdf' | 'code';
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  fileName: string;
  fileSize: number;
  fileType: string;
  /** simulated final hash (64 char hex) */
  hash: string;
  /** image thumb URL (illust only) */
  thumbnailUrl?: string;
}

const SAMPLES: ReadonlyArray<SampleDescriptor> = [
  {
    id: 'illust',
    label: 'AIイラスト',
    sublabel: 'office_warrior_akiko.jpg',
    icon: <Paintbrush className="h-4 w-4" />,
    fileName: 'office_warrior_akiko.jpg',
    fileSize: 1_482_137,
    fileType: 'image/jpeg',
    hash: '90fb4a8ab8a3fedc59378b4f1c2e9d0a6b7f3e2a4d8c91b5a7f6e0c2d4b8a193',
    thumbnailUrl: '/sample/office_warrior_akiko.jpg',
  },
  {
    id: 'pdf',
    label: 'PDF文書',
    sublabel: 'contract_draft_v3.pdf',
    icon: <FileText className="h-4 w-4" />,
    fileName: 'contract_draft_v3.pdf',
    fileSize: 312_840,
    fileType: 'application/pdf',
    hash: '6fa1e2c84db3a907f5e62b1c8d49a370b5e8c1d4a7f2e3b9d6c0a8f5e1b4c293',
  },
  {
    id: 'code',
    label: 'コード',
    sublabel: 'proofmark_verify.py',
    icon: <Code2 className="h-4 w-4" />,
    fileName: 'proofmark_verify.py',
    fileSize: 4_217,
    fileType: 'text/x-python',
    hash: 'a7c93e1b8f2d6a4c0b5e7d1a9f3c8e2b6d4a0f7c1e9b5d3a8f2c6e0b4d7a9c12',
  },
];

const INITIAL_STATE: DemoState = {
  phase: 'IDLE',
  fileName: null,
  fileSize: null,
  fileType: null,
  thumbnailUrl: null,
  hashProgress: 0,
  hash: null,
};

const ISSUED_COUNT_BASE = 12_848;

/* ═════════════════════════════════════════════
 *  hash util — Web Crypto subtle.digest
 * ═════════════════════════════════════════════ */

async function realSha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buf);
  const arr = new Uint8Array(digest);
  let out = '';
  for (let i = 0; i < arr.length; i++) out += arr[i].toString(16).padStart(2, '0');
  return out;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/* ═════════════════════════════════════════════
 *  Main component
 * ═════════════════════════════════════════════ */

export default function LiveProofDemo(): JSX.Element {
  const reduce = useReducedMotion() ?? false;
  const [state, setState] = useState<DemoState>(INITIAL_STATE);
  const [count, setCount] = useState<number>(ISSUED_COUNT_BASE);
  const abortRef = useRef<AbortController | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  /* IntersectionObserver: viewport 内のときだけ counter を回す */
  const [visible, setVisible] = useState<boolean>(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.target === el) setVisible(e.isIntersecting);
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* counter slowly increments while visible (psychological motion) */
  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => {
      setCount((c) => c + Math.floor(Math.random() * 2));
    }, 2400);
    return () => window.clearInterval(id);
  }, [visible]);

  /* cleanup */
  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  /* ─────────────────────────────────────────────
   *  Mobile auto-scroll on HASHING transition
   * ───────────────────────────────────────────── */
  const scrollToPreviewOnMobile = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(min-width: 768px)').matches) return;
    window.requestAnimationFrame(() => {
      previewRef.current?.scrollIntoView({
        behavior: reduce ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  }, [reduce]);

  /* ─────────────────────────────────────────────
   *  Sample run: シミュレーション (1.6s)
   * ───────────────────────────────────────────── */
  const runSample = useCallback(
    async (sample: SampleDescriptor): Promise<void> => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      // revoke previous object url (sample doesn't create one, but defensive)
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      setState({
        phase: 'HASHING',
        fileName: sample.fileName,
        fileSize: sample.fileSize,
        fileType: sample.fileType,
        thumbnailUrl: sample.thumbnailUrl ?? null,
        hashProgress: 0,
        hash: null,
      });
      scrollToPreviewOnMobile();

      const steps = reduce ? [100] : [10, 24, 38, 52, 66, 78, 88, 95];
      for (const p of steps) {
        await new Promise((r) => window.setTimeout(r, reduce ? 0 : 165));
        if (ac.signal.aborted) return;
        setState((s) => ({ ...s, hashProgress: p }));
      }

      await new Promise((r) => window.setTimeout(r, reduce ? 0 : 180));
      if (ac.signal.aborted) return;

      setState((s) => ({
        ...s,
        phase: 'READY',
        hashProgress: 100,
        hash: sample.hash,
      }));
      setCount((c) => c + 1);
    },
    [reduce, scrollToPreviewOnMobile],
  );

  /* ─────────────────────────────────────────────
   *  Real file: Web Crypto subtle.digest
   * ───────────────────────────────────────────── */
  const runRealFile = useCallback(
    async (file: File): Promise<void> => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      let thumb: string | null = null;
      if (file.type.startsWith('image/')) {
        thumb = URL.createObjectURL(file);
        objectUrlRef.current = thumb;
      }

      setState({
        phase: 'HASHING',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        thumbnailUrl: thumb,
        hashProgress: 0,
        hash: null,
      });
      scrollToPreviewOnMobile();

      // simulate smooth progress (実 SHA-256 は瞬時で終わる)
      const steps = reduce ? [100] : [10, 22, 36, 50, 64, 76, 86, 94];
      for (const p of steps) {
        await new Promise((r) => window.setTimeout(r, reduce ? 0 : 130));
        if (ac.signal.aborted) return;
        setState((s) => ({ ...s, hashProgress: p }));
      }

      try {
        const hex = await realSha256Hex(file);
        if (ac.signal.aborted) return;
        setState((s) => ({
          ...s,
          phase: 'READY',
          hashProgress: 100,
          hash: hex,
        }));
        setCount((c) => c + 1);
      } catch (err) {
        console.error('[LiveProofDemo] hash failed', err);
        setState(INITIAL_STATE);
      }
    },
    [reduce, scrollToPreviewOnMobile],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setState(INITIAL_STATE);
  }, []);

  return (
    <MotionConfig transition={{ ease: EASE_OUT_EXPO }}>
      <div ref={rootRef} className="relative">
        {/* counter chip (top-right) */}
        <div className="mb-6 flex items-center justify-end">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold"
            style={{
              borderColor: 'rgba(0,212,170,0.28)',
              background: 'rgba(0,212,170,0.06)',
              color: '#00D4AA',
            }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: '#00D4AA',
                boxShadow: '0 0 10px #00D4AA',
              }}
            />
            <NumberRoll value={count} reduce={reduce} />
            <span className="opacity-80">件発行済み</span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:gap-8">
          <DropColumn
            state={state}
            onSample={runSample}
            onFile={runRealFile}
            onReset={reset}
          />
          <div ref={previewRef} className="scroll-mt-24 md:scroll-mt-0">
            <CertificatePreview state={state} reduce={reduce} />
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}

/* ═════════════════════════════════════════════
 *  LEFT — DropZone column
 * ═════════════════════════════════════════════ */

function DropColumn({
  state,
  onSample,
  onFile,
  onReset,
}: {
  state: DemoState;
  onSample: (s: SampleDescriptor) => void;
  onFile: (f: File) => void;
  onReset: () => void;
}): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) onFile(f);
    },
    [onFile],
  );

  if (state.phase === 'IDLE') {
    return (
      <div
        className="rounded-[28px] border p-5 sm:p-6"
        style={{
          background: '#0D0B24',
          borderColor: '#1C1A38',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        {/* dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="ファイルをドロップ"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className="flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-[22px] border border-dashed px-6 text-center"
          style={{
            borderColor: dragOver
              ? 'rgba(108,62,244,0.7)'
              : 'rgba(108,62,244,0.40)',
            background: dragOver ? 'rgba(108,62,244,0.06)' : 'rgba(255,255,255,0.02)',
            boxShadow: dragOver
              ? '0 0 36px rgba(108,62,244,0.22) inset, 0 0 0 1px rgba(108,62,244,0.45) inset'
              : 'none',
            transition: 'all 220ms cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) onFile(f);
            }}
          />
          <div
            className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border"
            style={{
              borderColor: dragOver
                ? 'rgba(108,62,244,0.50)'
                : 'rgba(255,255,255,0.10)',
              background: dragOver
                ? 'rgba(108,62,244,0.10)'
                : 'rgba(255,255,255,0.03)',
            }}
          >
            <Upload
              className="h-6 w-6"
              style={{ color: dragOver ? '#6C3EF4' : '#FFFFFF' }}
            />
          </div>
          <p className="text-[18px] font-bold text-white">ファイルをドロップ</p>
          <p
            className="mt-1.5 text-[13px]"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            またはクリックして選択
          </p>
          <p
            className="mt-1 text-[11px]"
            style={{ color: 'rgba(255,255,255,0.42)' }}
          >
            全形式・最大50MB対応
          </p>
        </div>

        {/* trust hint */}
        <p
          className="mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold"
          style={{
            borderColor: 'rgba(0,212,170,0.22)',
            background: 'rgba(0,212,170,0.06)',
            color: '#00D4AA',
          }}
        >
          <Lock className="h-3 w-3" />
          原本はこのブラウザから出ません
        </p>

        {/* divider */}
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <span
            className="text-[10px] font-bold uppercase tracking-[0.26em]"
            style={{ color: 'rgba(255,255,255,0.42)' }}
          >
            または サンプルで試す
          </span>
          <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
        </div>

        {/* sample buttons */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSample(s)}
              className="group inline-flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all hover:-translate-y-0.5"
              style={{
                borderColor: 'rgba(255,255,255,0.08)',
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))',
              }}
            >
              <span
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: 'rgba(108,62,244,0.12)',
                  color: '#BC78FF',
                  border: '1px solid rgba(108,62,244,0.28)',
                }}
              >
                {s.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-bold text-white">
                  {s.label}
                </span>
                <span
                  className="block truncate text-[10.5px]"
                  style={{ color: 'rgba(255,255,255,0.45)' }}
                >
                  {s.sublabel}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* HASHING / READY: file row + (progress | CTA) */
  return (
    <div
      className="rounded-[28px] border p-5 sm:p-6"
      style={{
        background: '#0D0B24',
        borderColor: '#1C1A38',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
      }}
    >
      <FileRow state={state} />

      {state.phase === 'HASHING' ? (
        <HashingProgress progress={state.hashProgress} />
      ) : (
        <ReadyCta onReset={onReset} />
      )}
    </div>
  );
}

function FileRow({ state }: { state: DemoState }): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border"
        style={{ borderColor: '#1C1A38', background: '#07061A' }}
      >
        {state.thumbnailUrl ? (
          <img
            src={state.thumbnailUrl}
            alt={state.fileName ?? 'preview'}
            className="h-full w-full object-cover"
          />
        ) : (
          <FileBadge fileType={state.fileType} fileName={state.fileName} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-white">
          {state.fileName ?? '—'}
        </p>
        <p
          className="text-[11.5px]"
          style={{ color: 'rgba(255,255,255,0.50)' }}
        >
          {state.fileSize ? formatBytes(state.fileSize) : ''}
          {state.fileType ? ` · ${state.fileType}` : ''}
        </p>
      </div>
    </div>
  );
}

function FileBadge({
  fileType,
  fileName,
}: {
  fileType: string | null;
  fileName: string | null;
}): JSX.Element {
  const ext = useMemo(() => {
    if (!fileName) return '—';
    const dot = fileName.lastIndexOf('.');
    return dot > -1 ? fileName.slice(dot + 1).slice(0, 5).toUpperCase() : 'BIN';
  }, [fileName]);
  const Icon = fileType?.startsWith('image/')
    ? ImageIcon
    : fileType?.includes('pdf')
      ? FileText
      : fileType?.includes('python') || fileType?.includes('javascript')
        ? Code2
        : FileText;
  return (
    <div className="flex flex-col items-center justify-center">
      <Icon className="h-5 w-5" style={{ color: '#BC78FF' }} />
      <span
        className="mt-1 text-[8.5px] font-bold tracking-[0.18em]"
        style={{ color: 'rgba(255,255,255,0.55)' }}
      >
        {ext}
      </span>
    </div>
  );
}

function HashingProgress({ progress }: { progress: number }): JSX.Element {
  return (
    <div className="mt-5">
      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <motion.div
          className="h-full"
          animate={{ width: `${Math.max(3, Math.min(100, progress))}%` }}
          transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
          style={{
            background: 'linear-gradient(90deg, #6C3EF4 0%, #00D4AA 100%)',
            boxShadow: '0 0 14px rgba(0,212,170,0.55)',
          }}
        />
      </div>
      <p
        className="mt-2 flex items-center justify-between text-[11.5px]"
        style={{ color: 'rgba(255,255,255,0.55)' }}
      >
        <span>SHA-256 をブラウザ内で計算中...</span>
        <span className="font-mono">{Math.round(progress)}%</span>
      </p>
      <p
        className="mt-1.5 text-[10.5px]"
        style={{ color: 'rgba(255,255,255,0.40)' }}
      >
        原本はこのデバイスから出ません
      </p>
    </div>
  );
}

function ReadyCta({ onReset }: { onReset: () => void }): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.2, ease: EASE_OUT_EXPO }}
      className="mt-5"
    >
      <div
        className="mb-4 flex items-center gap-2 rounded-xl border px-3 py-2"
        style={{
          borderColor: 'rgba(0,212,170,0.30)',
          background: 'rgba(0,212,170,0.08)',
        }}
      >
        <CheckCircle2 className="h-4 w-4" style={{ color: '#00D4AA' }} />
        <p
          className="text-[12.5px] font-semibold"
          style={{ color: '#00D4AA' }}
        >
          ハッシュ計算完了 — 改ざん不能な指紋を取得しました
        </p>
      </div>

      <Link
        href="/spot-issue"
        className="group flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold text-white"
        style={{
          background: 'linear-gradient(135deg, #6C3EF4 0%, #00D4AA 100%)',
          boxShadow:
            '0 14px 32px rgba(108,62,244,0.42), 0 0 0 1px rgba(255,255,255,0.06) inset',
        }}
      >
        ¥480 で証明書を正式発行する
        <ArrowRight className="h-4 w-4 transition-transform group-active:translate-x-0.5" />
      </Link>

      <div className="mt-3 flex items-center justify-between">
        <Link
          href="/auth?mode=signup"
          className="text-[12.5px] font-semibold underline-offset-4 hover:underline"
          style={{ color: 'rgba(255,255,255,0.65)' }}
        >
          無料アカウントで発行する →
        </Link>
        <button
          type="button"
          onClick={onReset}
          className="text-[11.5px] underline-offset-4 hover:underline"
          style={{ color: 'rgba(255,255,255,0.42)' }}
        >
          別のファイルを試す
        </button>
      </div>

      <p
        className="mt-3 text-[10.5px]"
        style={{ color: 'rgba(255,255,255,0.45)' }}
      >
        🔒 Stripeによる安全な決済 · カード情報登録不要
      </p>
    </motion.div>
  );
}

/* ═════════════════════════════════════════════
 *  RIGHT — Certificate preview (the heart)
 * ═════════════════════════════════════════════ */

function CertificatePreview({
  state,
  reduce,
}: {
  state: DemoState;
  reduce: boolean;
}): JSX.Element {
  // 完成パルス
  const [pulseKey, setPulseKey] = useState<number>(0);
  useEffect(() => {
    if (state.phase === 'READY') setPulseKey((n) => n + 1);
  }, [state.phase]);

  // 時刻 (READY のみ固定。HASHING はチクタクで「今」感)
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    if (state.phase === 'IDLE') return;
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [state.phase]);

  const sealed = state.phase === 'READY';

  // stagger 親
  const container = {
    hidden: {},
    visible: {
      transition: reduce
        ? { duration: 0 }
        : { staggerChildren: 0.16, delayChildren: 0.08 },
    },
  };
  const item = {
    hidden: { opacity: 0, y: reduce ? 0 : 14 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: reduce ? 0 : 0.55, ease: EASE_OUT_EXPO },
    },
  };

  return (
    <LayoutGroup id="pm-live-cert">
      <motion.div
        layout
        className="relative w-full overflow-hidden rounded-[32px] border p-6 sm:p-8 md:p-9"
        style={{
          background: '#0D0B24',
          borderColor: sealed ? 'rgba(108,62,244,0.42)' : '#1C1A38',
          boxShadow: sealed
            ? '0 0 60px rgba(108,62,244,0.20), 0 0 0 1px rgba(108,62,244,0.20) inset, 0 24px 60px rgba(0,0,0,0.50)'
            : '0 24px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04) inset',
          transition: 'border-color 600ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* ambient orbs */}
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

        {/* READY pulse (1 回限り) */}
        <AnimatePresence>
          {sealed && !reduce ? (
            <motion.div
              key={`pulse-${pulseKey}`}
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[32px]"
              initial={{ boxShadow: '0 0 0 0 rgba(0,212,170,0)' }}
              animate={{
                boxShadow: [
                  '0 0 0 0 rgba(0,212,170,0)',
                  '0 0 70px rgba(0,212,170,0.40), 0 0 0 8px rgba(0,212,170,0.10) inset',
                  '0 0 0 0 rgba(0,212,170,0)',
                ],
              }}
              exit={{ boxShadow: '0 0 0 0 rgba(0,212,170,0)' }}
              transition={{ duration: 0.95, times: [0, 0.5, 1] }}
            />
          ) : null}
        </AnimatePresence>

        {/* PREVIEW watermark */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
          style={{
            color: '#FFFFFF',
            opacity: state.phase !== 'IDLE' ? 0.05 : 0,
            fontWeight: 900,
            fontSize: 88,
            letterSpacing: '0.20em',
            transform: 'rotate(-30deg)',
            transition: 'opacity 600ms cubic-bezier(0.16,1,0.3,1)',
            fontFamily:
              "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
        >
          PREVIEW
        </span>

        {/* IDLE — silhouette */}
        {state.phase === 'IDLE' ? (
          <IdleSilhouette />
        ) : (
          <motion.div
            key={state.phase}
            variants={container}
            initial="hidden"
            animate="visible"
            className="relative z-10"
          >
            {/* Header */}
            <motion.div
              variants={item}
              className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:pb-6"
              style={{ borderColor: '#1C1A38' }}
            >
              <div>
                <h3
                  className="text-2xl font-extrabold leading-[1.04] tracking-tighter text-white sm:text-[34px]"
                  style={{
                    fontFamily:
                      "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    letterSpacing: '-0.025em',
                  }}
                >
                  CERTIFICATE OF
                  <br />
                  AUTHENTICITY
                </h3>
                <p
                  className="mt-2 text-[10.5px] font-bold uppercase tracking-[0.26em]"
                  style={{ color: '#A8A0D8' }}
                >
                  ProofMark Digital Existence Certificate
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <AnimatePresence>
                  {sealed ? (
                    <motion.span
                      key="verified"
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={{
                        type: 'spring',
                        stiffness: 320,
                        damping: 20,
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em]"
                      style={{
                        background: 'rgba(0,212,170,0.10)',
                        borderColor: 'rgba(0,212,170,0.45)',
                        color: '#00D4AA',
                      }}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" /> Verified
                    </motion.span>
                  ) : null}
                </AnimatePresence>

                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em]"
                  style={{
                    background: 'rgba(240,187,56,0.06)',
                    borderColor: 'rgba(240,187,56,0.45)',
                    color: '#F0BB38',
                    boxShadow: '0 0 12px rgba(240,187,56,0.18)',
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Founder
                </span>
              </div>
            </motion.div>

            {/* Body grid */}
            <motion.div
              variants={item}
              className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[2fr_3fr] md:gap-8"
            >
              {/* Artwork slab */}
              <motion.div variants={item}>
                <ArtworkSlab state={state} />
              </motion.div>

              {/* Data column */}
              <motion.div variants={item} className="flex flex-col justify-center gap-6">
                <motion.div variants={item}>
                  <DataRow
                    label="Protected Asset"
                    icon={<FileText className="h-3 w-3" />}
                    value={state.fileName ?? '—'}
                  />
                </motion.div>

                {/* SHA-256 — シマー or 確定値 */}
                <motion.div variants={item}>
                  <HashPanel state={state} reduce={reduce} />
                </motion.div>

                {/* Timestamp + QR */}
                <motion.div
                  variants={item}
                  className="flex flex-row items-center justify-between gap-6 border-t pt-6"
                  style={{ borderColor: '#1C1A38' }}
                >
                  <div className="min-w-0 flex-1">
                    <DataRow
                      accent="gold"
                      icon={<Clock className="h-3 w-3" />}
                      label="Digital Timestamp (JST)"
                      value={
                        <p
                          className="text-xl font-bold tracking-tight text-white sm:text-[24px]"
                          style={{
                            fontFamily:
                              "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                            letterSpacing: '-0.015em',
                          }}
                        >
                          {now.toLocaleString('ja-JP', { hour12: false })}
                        </p>
                      }
                    />
                    <RfcChip live={sealed} />
                    <p
                      className="mt-1.5 text-[10.5px]"
                      style={{ color: '#A8A0D8' }}
                    >
                      改ざん不能な技術で真正性が担保されています
                    </p>
                  </div>

                  <QrSlab sealed={sealed} />
                </motion.div>

                {/* preview disclaimer */}
                <motion.p
                  variants={item}
                  className="border-t border-dashed pt-4 text-[11px] leading-relaxed sm:text-[11.5px]"
                  style={{
                    borderColor: 'rgba(255,255,255,0.16)',
                    color: 'rgba(255,255,255,0.55)',
                  }}
                >
                  ⚠ プレビューです。正式発行後に Certificate ID と QR が確定します。
                </motion.p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    </LayoutGroup>
  );
}

/* ─────────────────────────────────────────────
 *  Idle: 証明書シルエットゴースト
 * ───────────────────────────────────────────── */
function IdleSilhouette(): JSX.Element {
  return (
    <div className="relative z-10 flex min-h-[420px] flex-col items-center justify-center text-center">
      <Paintbrush
        className="h-14 w-14"
        style={{ color: 'rgba(255,255,255,0.18)' }}
      />
      <p className="mt-5 text-[14px] font-bold text-white">
        ファイルを投げると
      </p>
      <p
        className="mt-1 text-[14px]"
        style={{ color: 'rgba(255,255,255,0.55)' }}
      >
        ここに証明書が生まれます
      </p>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 select-none px-8 pb-2 text-center"
        style={{
          color: '#FFFFFF',
          opacity: 0.04,
          fontWeight: 900,
          fontSize: 26,
          letterSpacing: '0.10em',
          fontFamily:
            "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        CERTIFICATE OF AUTHENTICITY
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
 *  Artwork slab
 * ───────────────────────────────────────────── */
function ArtworkSlab({ state }: { state: DemoState }): JSX.Element {
  return (
    <div
      className="relative aspect-square w-full max-w-[320px] overflow-hidden rounded-[20px] border"
      style={{
        borderColor: '#1C1A38',
        background: '#07061A',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.04), 0 14px 28px rgba(0,0,0,0.42)',
      }}
    >
      {state.thumbnailUrl ? (
        <img
          src={state.thumbnailUrl}
          alt={state.fileName ?? 'preview'}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <SlabGhost state={state} />
      )}

      {/* scan beam */}
      <AnimatePresence>
        {state.phase === 'HASHING' ? (
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
        ) : null}
      </AnimatePresence>

      {/* sealed corner badge */}
      <AnimatePresence>
        {state.phase === 'READY' ? (
          <motion.div
            key="sealed"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9.5px] font-black uppercase tracking-[0.22em]"
            style={{
              background: 'rgba(0,212,170,0.18)',
              borderColor: 'rgba(0,212,170,0.45)',
              color: '#00D4AA',
              backdropFilter: 'blur(8px)',
            }}
          >
            <ShieldCheck className="h-3 w-3" /> Sealed
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SlabGhost({ state }: { state: DemoState }): JSX.Element {
  const ext = useMemo(() => {
    if (!state.fileName) return '—';
    const dot = state.fileName.lastIndexOf('.');
    return dot > -1
      ? state.fileName.slice(dot + 1).slice(0, 6).toUpperCase()
      : 'BIN';
  }, [state.fileName]);
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
      <FileText className="h-12 w-12" style={{ color: 'rgba(255,255,255,0.20)' }} />
      <span
        className="text-[10px] font-black tracking-[0.30em]"
        style={{ color: 'rgba(255,255,255,0.55)' }}
      >
        {ext}
      </span>
      <span
        className="mt-1 text-[9px] font-bold tracking-[0.22em]"
        style={{ color: 'rgba(0,212,170,0.55)' }}
      >
        ZERO-KNOWLEDGE
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────
 *  Hash panel
 * ───────────────────────────────────────────── */
function HashPanel({
  state,
  reduce,
}: {
  state: DemoState;
  reduce: boolean;
}): JSX.Element {
  const [copied, setCopied] = useState<boolean>(false);
  const onCopy = useCallback(() => {
    if (!state.hash) return;
    navigator.clipboard?.writeText(state.hash).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  }, [state.hash]);

  return (
    <div
      className="rounded-2xl border p-4 sm:p-5"
      style={{
        borderColor: 'rgba(0,212,170,0.22)',
        background:
          'linear-gradient(90deg, rgba(0,212,170,0.10) 0%, rgba(0,212,170,0) 100%)',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 22px rgba(0,0,0,0.18)',
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" style={{ color: '#00D4AA' }} />
          <h4
            className="text-[10px] font-bold uppercase tracking-[0.26em] sm:text-xs"
            style={{ color: '#00D4AA' }}
          >
            SHA-256 Hash Signature
          </h4>
        </div>
        {state.phase === 'READY' && state.hash ? (
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
            style={{
              background: 'rgba(0,212,170,0.10)',
              color: '#00D4AA',
            }}
            aria-label="ハッシュをコピー"
          >
            <Copy className="h-3 w-3" />
            {copied ? 'COPIED' : 'COPY'}
          </button>
        ) : null}
      </div>

      {state.phase === 'HASHING' || !state.hash ? (
        <HashShimmerLines reduce={reduce} />
      ) : (
        <p
          className="font-mono text-[10.5px] leading-relaxed text-[#F0EFF8] sm:text-xs"
          style={{ wordBreak: 'break-all' }}
        >
          <span>{state.hash.slice(0, 32)}</span>
          <br />
          <span>{state.hash.slice(32)}</span>
        </p>
      )}
    </div>
  );
}

function HashShimmerLines({ reduce }: { reduce: boolean }): JSX.Element {
  return (
    <div className="space-y-1.5">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="relative h-3.5 overflow-hidden rounded-md font-mono"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <motion.div
            className="absolute inset-0"
            initial={{ backgroundPosition: '-200% center' }}
            animate={{ backgroundPosition: '200% center' }}
            transition={
              reduce
                ? { duration: 0 }
                : {
                    duration: 2.4,
                    repeat: Infinity,
                    ease: 'linear',
                    delay: i * 0.3,
                  }
            }
            style={{
              background:
                'linear-gradient(90deg, rgba(0,212,170,0.18) 0%, rgba(0,212,170,1) 50%, rgba(0,212,170,0.18) 100%)',
              backgroundSize: '200% auto',
              mixBlendMode: 'screen',
              opacity: i === 0 ? 0.7 : 0.55,
            }}
          />
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
 *  RFC chip + QR
 * ───────────────────────────────────────────── */
function RfcChip({ live }: { live: boolean }): JSX.Element {
  return (
    <div
      className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1"
      style={{
        background: live ? 'rgba(0,212,170,0.10)' : 'rgba(255,255,255,0.04)',
        borderColor: live ? 'rgba(0,212,170,0.30)' : 'rgba(255,255,255,0.08)',
        color: live ? '#00D4AA' : 'rgba(255,255,255,0.40)',
        transition: 'all 400ms cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      <span className="text-[10px] font-black uppercase tracking-[0.26em]">
        RFC3161 {live ? 'Verified' : 'Pending'}
      </span>
    </div>
  );
}

function QrSlab({ sealed }: { sealed: boolean }): JSX.Element {
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
        {!sealed ? (
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
        className="text-[9px] font-bold uppercase tracking-[0.26em] sm:text-[10px]"
        style={{ color: sealed ? '#00D4AA' : '#A8A0D8' }}
      >
        Scan to Verify
      </span>
    </div>
  );
}

function FakeQrCells(): JSX.Element {
  const cells = useMemo<boolean[]>(() => {
    const out: boolean[] = [];
    let seed = 9876;
    for (let i = 0; i < 81; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      out.push(seed / 233280 > 0.5);
    }
    const markers = [
      [0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2],
      [0, 6], [0, 7], [0, 8], [1, 6], [1, 8], [2, 6], [2, 7], [2, 8],
      [6, 0], [6, 1], [6, 2], [7, 0], [7, 2], [8, 0], [8, 1], [8, 2],
    ];
    for (const [r, c] of markers) out[r * 9 + c] = true;
    for (let r = 3; r <= 5; r++) {
      for (let c = 3; c <= 5; c++) out[r * 9 + c] = false;
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
              background: on ? '#000' : '#FFF',
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
          <Layers className="h-4 w-4 text-zinc-900" />
        </div>
      </div>
    </div>
  );
}
