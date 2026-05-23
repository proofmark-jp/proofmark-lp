/**
 * SpotDropZone.tsx — 左カラム (Spot Issue)
 * ─────────────────────────────────────────────────────────────
 *  IDLE / HASHING / PREVIEW / PAYING / ERROR の状態遷移を 1 つで表現。
 *
 *  Phase 1 完成仕様:
 *   ✔ ¥480 ボタンは PREVIEW のみ出現（IDLE / HASHING / PAYING で非表示 or ロック）
 *   ✔ CTA コピー完全統一: "¥480 で Evidence Pack を発行する"
 *   ✔ PAYING 状態 = Stripe Hosted Checkout への遷移 + Quarantine Upload 期間
 *      → ここを「魔の空白時間」にしないため、Stripe 風の細かい段階的
 *        ステータステキスト ＋ 弁護士印章のような認証スピナーで埋める
 *   ✔ Mobile Fixed Bottom Bar も同じ動的ステータスを反映
 * ─────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  Loader2,
  Lock,
  Share2,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { SpotState } from './CertificatePreview';

const PM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const MAX_BYTES = 50 * 1024 * 1024; // 50MB
const IMAGE_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
]);

/* ─────────────────────────────────────────────
 *  Stripe 風 PAYING ステータス段階表示
 *
 *  「ハッシュ計算 → Quarantine Upload → Stripe Redirect」の魔の空白を
 *  Stripe Checkout のリダイレクト体験と完全同質にする。
 * ───────────────────────────────────────────── */

interface PayingTick {
  /** この秒数を超えたら次のメッセージへ進む */
  thresholdMs: number;
  label: string;
  sublabel: string;
}

const PAYING_TICKS: ReadonlyArray<PayingTick> = [
  {
    thresholdMs: 0,
    label: '安全な決済セッションを初期化しています…',
    sublabel: 'Securing a private checkout session',
  },
  {
    thresholdMs: 900,
    label: '証拠ファイルを暗号化された隔離領域へ転送中…',
    sublabel: 'Uploading to encrypted quarantine vault',
  },
  {
    thresholdMs: 2200,
    label: 'Stripe の Hosted Checkout に接続しています…',
    sublabel: 'Establishing TLS handshake with Stripe',
  },
  {
    thresholdMs: 4200,
    label: '署名検証のため Stripe へリダイレクトします…',
    sublabel: 'Redirecting to Stripe',
  },
];

function usePayingStatus(active: boolean): { label: string; sublabel: string } {
  const [tick, setTick] = useState<PayingTick>(PAYING_TICKS[0]);
  const startedAt = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      setTick(PAYING_TICKS[0]);
      cancelAnimationFrame(rafRef.current);
      return;
    }
    startedAt.current = performance.now();

    const loop = (): void => {
      const elapsed = performance.now() - startedAt.current;
      let current = PAYING_TICKS[0];
      for (const t of PAYING_TICKS) {
        if (elapsed >= t.thresholdMs) current = t;
      }
      setTick((prev) => (prev.label === current.label ? prev : current));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  return tick;
}

/* ─────────────────────────────────────────────
 *  Props
 * ───────────────────────────────────────────── */

export interface SpotDropZoneProps {
  state: SpotState;
  file: File | null;
  hashProgress: number;
  onFile: (file: File) => void;
  onCheckout: () => void;
  onReset: () => void;
  busy?: boolean;
}

/* ─────────────────────────────────────────────
 *  Component
 * ───────────────────────────────────────────── */

export default function SpotDropZone(props: SpotDropZoneProps): JSX.Element {
  const { state, file, hashProgress, onFile, onCheckout, onReset, busy } =
    props;

  const reduce = useReducedMotion() ?? false;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const accept = useCallback((f: File): boolean => {
    if (f.size > MAX_BYTES) {
      setError('OVERSIZE');
      return false;
    }
    setError(null);
    return true;
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (!f) return;
      if (accept(f)) onFile(f);
    },
    [accept, onFile],
  );

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (!f) return;
      if (accept(f)) onFile(f);
    },
    [accept, onFile],
  );

  const mode = useMemo<'shareable' | 'private'>(() => {
    if (!file) return 'private';
    return IMAGE_TYPES.has(file.type) ? 'shareable' : 'private';
  }, [file]);

  const previewUrl = useMemo<string | null>(() => {
    if (!file || !file.type.startsWith('image/')) return null;
    return URL.createObjectURL(file);
  }, [file]);
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const isPaying = state === 'PAYING' || !!busy;
  const payingStatus = usePayingStatus(isPaying);

  /* ─────────────────────────────────────────────
   *  ERROR: 50MB 超過
   * ───────────────────────────────────────────── */
  if (error === 'OVERSIZE') {
    return (
      <div
        className="rounded-[28px] border p-6 sm:p-7"
        style={{
          background: '#0D0B24',
          borderColor: 'rgba(255,69,58,0.30)',
          boxShadow: '0 0 0 1px rgba(255,69,58,0.15) inset',
        }}
      >
        <div
          className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(255,69,58,0.10)' }}
        >
          <AlertTriangle className="h-6 w-6" style={{ color: '#FF453A' }} />
        </div>
        <h3 className="text-xl font-extrabold text-white">
          ファイルが大きすぎます
        </h3>
        <p
          className="mt-2 text-[13px]"
          style={{ color: 'rgba(255,255,255,0.62)' }}
        >
          Spot Issue では最大 50MB までのファイルに対応します。
          Private Proof であれば容量無制限です。
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            href="/auth?mode=signup"
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, #6C3EF4 0%, #8B61FF 100%)',
            }}
          >
            無料アカウントを作成する
            <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => {
              setError(null);
              onReset();
            }}
            className="rounded-2xl border px-5 py-3 text-sm font-bold"
            style={{
              borderColor: 'rgba(255,255,255,0.16)',
              color: '#FFFFFF',
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            別のファイルを選ぶ
          </button>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────
   *  IDLE
   * ───────────────────────────────────────────── */
  if (state === 'IDLE') {
    return (
      <DropZoneShell
        dragOver={dragOver}
        setDragOver={setDragOver}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          onChange={onPick}
        />
        <div
          className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl border"
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
            className="h-7 w-7"
            style={{ color: dragOver ? '#6C3EF4' : '#FFFFFF' }}
          />
        </div>
        <p className="text-[19px] font-bold text-white sm:text-[20px]">
          ファイルをドロップ
        </p>
        <p
          className="mt-2 text-[13px]"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          またはクリック / タップして選択
        </p>
        <p
          className="mt-1 text-[11.5px]"
          style={{ color: 'rgba(255,255,255,0.42)' }}
        >
          最大 50MB · 全ファイル形式対応
        </p>
        <TrustHint />
      </DropZoneShell>
    );
  }

  /* ─────────────────────────────────────────────
   *  HASHING
   * ───────────────────────────────────────────── */
  if (state === 'HASHING') {
    return (
      <ProgressShell>
        <FileRow file={file} previewUrl={previewUrl} />
        <div className="mt-5">
          <div
            className="h-2 w-full overflow-hidden rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <motion.div
              className="h-full"
              animate={{
                width: `${Math.max(3, Math.min(100, hashProgress))}%`,
              }}
              transition={{ duration: 0.3, ease: PM_EASE }}
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
            <span>SHA-256 をブラウザ内で計算しています…</span>
            <span className="font-mono">{Math.round(hashProgress)}%</span>
          </p>
          <p
            className="mt-2 text-[11px]"
            style={{ color: 'rgba(255,255,255,0.40)' }}
          >
            原本はこのデバイスから外に出ません
          </p>
        </div>
      </ProgressShell>
    );
  }

  /* ─────────────────────────────────────────────
   *  PREVIEW / PAYING
   *
   *  - PREVIEW: ¥480 CTA を出現させる
   *  - PAYING:  CTA をロックし、その上に Stripe 的ステータスを重ねる
   * ───────────────────────────────────────────── */
  return (
    <>
      <ProgressShell>
        <FileRow file={file} previewUrl={previewUrl} />

        <div
          className="mt-5 flex items-center gap-2 rounded-xl border px-3 py-2"
          style={{
            borderColor: 'rgba(0,212,170,0.30)',
            background: 'rgba(0,212,170,0.08)',
          }}
        >
          <ShieldCheck className="h-4 w-4" style={{ color: '#00D4AA' }} />
          <p
            className="text-[12.5px] font-semibold"
            style={{ color: '#00D4AA' }}
          >
            ハッシュ計算完了 — 改ざん不能な指紋を取得しました
          </p>
        </div>

        <div
          className="mt-5 border-t pt-5"
          style={{ borderColor: '#1C1A38' }}
        >
          <p
            className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.22em]"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            証明モード（自動判定）
          </p>
          {mode === 'shareable' ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.20em]"
              style={{
                background: 'rgba(0,212,170,0.10)',
                borderColor: 'rgba(0,212,170,0.40)',
                color: '#00D4AA',
              }}
            >
              <Share2 className="h-3.5 w-3.5" /> Shareable Proof（公開可能）
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.20em]"
              style={{
                background: 'rgba(108,62,244,0.10)',
                borderColor: 'rgba(108,62,244,0.40)',
                color: '#BC78FF',
              }}
            >
              <Lock className="h-3.5 w-3.5" /> Private Proof（ゼロ知識）
            </span>
          )}
        </div>

        {/* ── Desktop CTA / PAYING overlay ── */}
        <div className="relative mt-6 hidden flex-col gap-3 md:flex">
          <button
            type="button"
            onClick={onCheckout}
            disabled={isPaying}
            aria-busy={isPaying}
            className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl px-5 py-4 text-base font-bold text-white disabled:opacity-95"
            style={{
              background: isPaying
                ? 'linear-gradient(135deg, #2A1F5E 0%, #11473F 100%)'
                : 'linear-gradient(135deg, #6C3EF4 0%, #00D4AA 100%)',
              boxShadow: isPaying
                ? '0 0 0 1px rgba(255,255,255,0.04) inset'
                : '0 14px 32px rgba(108,62,244,0.42), 0 0 0 1px rgba(255,255,255,0.06) inset',
              transition: 'background 360ms cubic-bezier(0.16,1,0.3,1)',
              cursor: isPaying ? 'progress' : 'pointer',
            }}
          >
            {isPaying ? (
              <PayingButtonContent
                label={payingStatus.label}
                sublabel={payingStatus.sublabel}
                reduce={reduce}
              />
            ) : (
              <>
                ¥480 で Evidence Pack を発行する
                <ArrowRight className="h-4 w-4 transition-transform group-active:translate-x-0.5" />
              </>
            )}
          </button>

          {!isPaying ? (
            <Link
              href="/auth?mode=signup"
              className="text-center text-[12.5px] font-semibold underline-offset-4 hover:underline"
              style={{ color: 'rgba(255,255,255,0.65)' }}
            >
              無料アカウントを作って管理する →
            </Link>
          ) : null}

          {isPaying ? (
            <PayingProgressRail reduce={reduce} />
          ) : (
            <CheckoutTrustRow />
          )}
        </div>
      </ProgressShell>

      {/* ── Mobile Fixed Bottom CTA ── */}
      <MobileBottomCTA
        onCheckout={onCheckout}
        isPaying={isPaying}
        payingLabel={payingStatus.label}
        payingSub={payingStatus.sublabel}
        reduce={reduce}
      />
    </>
  );
}

/* ─────────────────────────────────────────────
 *  Subcomponents
 * ───────────────────────────────────────────── */

function DropZoneShell({
  dragOver,
  setDragOver,
  onDrop,
  onClick,
  children,
}: {
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="flex min-h-[340px] cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed px-6 text-center"
      style={{
        borderColor: dragOver
          ? 'rgba(108,62,244,0.6)'
          : 'rgba(108,62,244,0.40)',
        background: dragOver ? 'rgba(108,62,244,0.06)' : '#0D0B24',
        boxShadow: dragOver
          ? '0 0 40px rgba(108,62,244,0.22), 0 0 0 1px rgba(108,62,244,0.45) inset'
          : 'inset 0 0 0 1px rgba(255,255,255,0.04)',
        transition: 'all 200ms cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {children}
    </div>
  );
}

function TrustHint(): JSX.Element {
  return (
    <p
      className="mt-6 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold"
      style={{
        borderColor: 'rgba(0,212,170,0.22)',
        background: 'rgba(0,212,170,0.06)',
        color: '#00D4AA',
      }}
    >
      <Lock className="h-3 w-3" />
      原本はサーバーに一切送信されません
    </p>
  );
}

function ProgressShell({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div
      className="rounded-[28px] border p-6 sm:p-7"
      style={{
        background: '#0D0B24',
        borderColor: '#1C1A38',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
      }}
    >
      {children}
    </div>
  );
}

function FileRow({
  file,
  previewUrl,
}: {
  file: File | null;
  previewUrl: string | null;
}): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border"
        style={{ borderColor: '#1C1A38', background: '#07061A' }}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={file?.name ?? ''}
            className="h-full w-full object-cover"
          />
        ) : (
          <FileText
            className="h-6 w-6"
            style={{ color: 'rgba(255,255,255,0.40)' }}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">
          {file?.name ?? '—'}
        </p>
        <p
          className="text-[11.5px]"
          style={{ color: 'rgba(255,255,255,0.50)' }}
        >
          {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ''}
          {file?.type ? ` · ${file.type}` : ''}
        </p>
      </div>
    </div>
  );
}

function CheckoutTrustRow(): JSX.Element {
  return (
    <div
      className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10.5px]"
      style={{ color: 'rgba(255,255,255,0.45)' }}
    >
      <span className="inline-flex items-center gap-1">
        🔒 Stripe による安全な決済
      </span>
      <span className="inline-flex items-center gap-1">
        📋 アカウント登録不要
      </span>
      <span className="inline-flex items-center gap-1">
        🗑 24時間後にデータ物理削除
      </span>
    </div>
  );
}

/* ── PAYING content: 弁護士印章 + Stripe 風段階テキスト ── */
function PayingButtonContent({
  label,
  sublabel,
  reduce,
}: {
  label: string;
  sublabel: string;
  reduce: boolean;
}): JSX.Element {
  return (
    <span className="flex w-full items-center gap-3">
      <span
        className="relative inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
        style={{
          background: 'rgba(0,212,170,0.16)',
          boxShadow: '0 0 0 1px rgba(0,212,170,0.45) inset',
        }}
      >
        <Loader2
          className={`h-4 w-4 ${reduce ? '' : 'animate-spin'}`}
          style={{ color: '#00D4AA' }}
        />
      </span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.32, ease: PM_EASE }}
          className="flex flex-col text-left leading-tight"
        >
          <span className="text-[14px] font-bold text-white">{label}</span>
          <span
            className="text-[10.5px] font-medium tracking-wide"
            style={{ color: 'rgba(255,255,255,0.62)' }}
          >
            {sublabel}
          </span>
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function PayingProgressRail({ reduce }: { reduce: boolean }): JSX.Element {
  return (
    <div className="mt-1 flex flex-col items-center gap-1.5">
      <div
        className="relative h-[3px] w-full overflow-hidden rounded-full"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <motion.div
          className="absolute inset-y-0 w-1/2 rounded-full"
          animate={reduce ? {} : { x: ['-60%', '160%'] }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            background:
              'linear-gradient(90deg, rgba(108,62,244,0) 0%, rgba(0,212,170,0.85) 50%, rgba(108,62,244,0) 100%)',
            filter: 'blur(0.5px)',
          }}
        />
      </div>
      <p
        className="text-[10.5px]"
        style={{ color: 'rgba(255,255,255,0.45)' }}
      >
        🔒 Stripe の TLS セッションを確立しています…
      </p>
    </div>
  );
}

function MobileBottomCTA({
  onCheckout,
  isPaying,
  payingLabel,
  payingSub,
  reduce,
}: {
  onCheckout: () => void;
  isPaying: boolean;
  payingLabel: string;
  payingSub: string;
  reduce: boolean;
}): JSX.Element {
  return (
    <AnimatePresence>
      <motion.div
        key="mobile-cta"
        className="fixed inset-x-0 bottom-0 z-50 md:hidden"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ duration: 0.35, ease: PM_EASE }}
      >
        <div
          className="px-3"
          style={{
            paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
            paddingTop: 10,
            background: 'rgba(13,11,36,0.82)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 -10px 30px rgba(0,0,0,0.4)',
          }}
        >
          <button
            type="button"
            onClick={onCheckout}
            disabled={isPaying}
            aria-busy={isPaying}
            className="flex h-14 w-full items-center justify-between gap-3 rounded-2xl px-4 font-bold text-white active:scale-[0.99]"
            style={{
              background: isPaying
                ? 'linear-gradient(135deg, #2A1F5E 0%, #11473F 100%)'
                : 'linear-gradient(135deg, #6C3EF4 0%, #00D4AA 100%)',
              boxShadow: isPaying
                ? '0 0 0 1px rgba(255,255,255,0.05) inset'
                : '0 12px 28px rgba(108,62,244,0.42)',
              transition: 'background 360ms cubic-bezier(0.16,1,0.3,1)',
              cursor: isPaying ? 'progress' : 'pointer',
            }}
          >
            {isPaying ? (
              <PayingButtonContent
                label={payingLabel}
                sublabel={payingSub}
                reduce={reduce}
              />
            ) : (
              <>
                <span className="flex flex-col text-left leading-tight">
                  <span className="text-[15px]">
                    ¥480 で Evidence Pack を発行する
                  </span>
                  <span className="text-[10.5px] font-medium text-white/72">
                    Stripe · 登録不要 · 30秒以内
                  </span>
                </span>
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
