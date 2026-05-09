/**
 * HeroDemo.tsx — ProofMark トップページ用ヒーローデモ（ナレーション強化版）
 *
 * 改修のコアコンセプト:
 *   旧版の問題: 4200ms ループ中、何が起きているかを伝えるテキストが一行もなかった。
 *   技術的には傑作だが、初見ユーザーには「格好いい黒いカードが出てきた」にしか見えない。
 *
 *   新版の設計: 全フェーズに「ナレーション」を追加。4ステップの進行を日本語で追う。
 *   ─ ステップ1: SHA-256 ハッシュをブラウザ内で計算中...
 *   ─ ステップ2: RFC3161 でタイムスタンプを刻印しています
 *   ─ ステップ3: 証明書を生成しています
 *   ─ ステップ4: ✓ 証明完了
 *
 *   タイムラインを 4200ms → 7000ms に拡張し、各ステップに十分な「読み時間」を与える。
 *
 * 変更点サマリ（旧版との差分）:
 *   1. TL 定数を 7000ms ベースに全面改訂
 *   2. `step` state（1〜4）を useEffect + setTimeout で管理
 *   3. NarrationBanner コンポーネント追加（AnimatePresence でクロスフェード）
 *   4. StepDots コンポーネント追加（4ステップ進行インジケータ）
 *   5. PhaseLabel コンポーネント追加（アートワーク左下にフェーズ名を表示）
 *   6. 既存の全アニメーション・コンポーネント（Ripple, Crystallize, NumberRoll）は保持
 *   7. HeroDemoProps インターフェイスに破壊的変更なし
 */

import {
  motion,
  useReducedMotion,
  AnimatePresence,
} from "framer-motion";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";

/* ──────────────────────────────────────────────────────────────────────────
   タイムライン定数（7000ms ベース）
   旧版 4200ms から全体を拡張。各ナレーションに最低 900ms の読み時間を確保。
────────────────────────────────────────────────────────────────────────── */
const TL = {
  total: 7000,

  // Phase 1: アートワーク出現
  artworkIn: { start: 0, dur: 700 },

  // Phase 2: ボーダーアーム
  borderArm: { start: 700, dur: 400 },

  // Phase 3: シール落下 + リップル
  sealDrop: { start: 1100, dur: 220 },
  sealImpact: { start: 1320, dur: 280 },
  ripple: { start: 1100, dur: 1200 },

  // Phase 4: 背景シフト（Teal ティント）
  bgShift: { start: 1600, dur: 900 },

  // Phase 5: 証明書カード出現
  cardIn: { start: 2200, dur: 600 },
  dataIn: { start: 2600, dur: 600 },
  badgeIn: { start: 3000, dur: 400 },

  // Phase 6: カウンタ加算
  counterTick: { start: 3400, dur: 420 },

  // Phase 7: カード呼吸 → フェードアウト
  cardBreath: { start: 5000, dur: 1400 },
  fadeOut: { start: 6400, dur: 600 },

  // ナレーション遷移タイミング（step state の切替点）
  step1At: 0,
  step2At: 1000,  // シール落下開始の直前
  step3At: 2300,  // カード出現と同期
  step4At: 3200,  // badge 出現後、確定感を演出
} as const;

/* ──────────────────────────────────────────────────────────────────────────
   イージング
────────────────────────────────────────────────────────────────────────── */
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
const EASE_IN_OUT_QUART: [number, number, number, number] = [0.77, 0, 0.175, 1];

/* ──────────────────────────────────────────────────────────────────────────
   ナレーション定義（4ステップ）
   sub は「なぜそれが重要か」を伝えるサポートコピー。
────────────────────────────────────────────────────────────────────────── */
interface NarrationDef {
  step: number;
  label: string;   // ステップ名（StepDots に表示）
  main: string;    // メインナレーション
  sub: string;     // サブコピー
}

const NARRATIONS: NarrationDef[] = [
  {
    step: 1,
    label: "ハッシュ計算",
    main: "SHA-256 ハッシュをブラウザ内で計算中...",
    sub: "原画はあなたの端末から一切出ません",
  },
  {
    step: 2,
    label: "タイムスタンプ",
    main: "RFC3161 でタイムスタンプを刻印しています",
    sub: "国際標準の認定機関が「この瞬間」に署名します",
  },
  {
    step: 3,
    label: "証明書生成",
    main: "改ざん不可能な証明書を生成しています",
    sub: "SHA-256・タイムスタンプ・検証スクリプトを一括梱包",
  },
  {
    step: 4,
    label: "完了",
    main: "✓ 証明完了 — 法的証拠として有効です",
    sub: "OpenSSL だけで誰でも再検証できます。ProofMark が消えても",
  },
];



/* ──────────────────────────────────────────────────────────────────────────
   NarrationBanner — ステップに応じてクロスフェードするナレーション領域
   デモカードの上部に配置。AnimatePresence で step が変わるたびにテキストが切り替わる。
────────────────────────────────────────────────────────────────────────── */
function NarrationBanner({ step }: { step: number }) {
  const narration = NARRATIONS[step - 1] ?? NARRATIONS[0];

  return (
    <div
      style={{
        position: "relative",
        height: 56,
        marginBottom: 20,
        overflow: "hidden",
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
          style={{ position: "absolute", inset: 0 }}
        >
          {/* メインナレーション */}
          <p
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: step === 4 ? "#00D4AA" : "rgba(255,255,255,0.92)",
              letterSpacing: "0.01em",
              lineHeight: 1.4,
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {/* ステップ1〜3: スピナー / ステップ4: チェック済みアイコン */}
            {step < 4 ? (
              <SpinnerIcon />
            ) : (
              <CheckIcon />
            )}
            {narration.main}
          </p>
          {/* サブコピー */}
          <p
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.40)",
              margin: "4px 0 0 24px",
              letterSpacing: "0.01em",
            }}
          >
            {narration.sub}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   StepDots — 4ステップ進行インジケータ
────────────────────────────────────────────────────────────────────────── */
function StepDots({ current }: { current: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        marginBottom: 16,
      }}
    >
      {NARRATIONS.map((n, i) => {
        const idx = i + 1;
        const isActive = idx === current;
        const isDone = idx < current;
        const isLast = idx === NARRATIONS.length;

        return (
          <div key={idx} style={{ display: "flex", alignItems: "center", flex: isLast ? 0 : 1 }}>
            {/* ドット */}
            <motion.div
              animate={{
                background: isDone
                  ? "#00D4AA"
                  : isActive
                    ? "#6C3EF4"
                    : "rgba(255,255,255,0.15)",
                boxShadow: isActive
                  ? "0 0 12px rgba(108,62,244,0.65)"
                  : isDone
                    ? "0 0 8px rgba(0,212,170,0.40)"
                    : "none",
                scale: isActive ? 1.2 : 1,
              }}
              transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                flexShrink: 0,
              }}
            />
            {/* ラベル */}
            <motion.span
              animate={{
                color: isActive
                  ? "rgba(255,255,255,0.85)"
                  : isDone
                    ? "#00D4AA"
                    : "rgba(255,255,255,0.25)",
              }}
              transition={{ duration: 0.3 }}
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                marginLeft: 5,
                whiteSpace: "nowrap",
              }}
            >
              {n.label}
            </motion.span>
            {/* コネクタライン */}
            {!isLast && (
              <motion.div
                animate={{
                  background: isDone
                    ? "rgba(0,212,170,0.45)"
                    : "rgba(255,255,255,0.08)",
                }}
                transition={{ duration: 0.4 }}
                style={{
                  flex: 1,
                  height: 1,
                  marginLeft: 8,
                  marginRight: 8,
                  minWidth: 12,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   小アイコン
────────────────────────────────────────────────────────────────────────── */
function SpinnerIcon() {
  return (
    <motion.svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="rgba(108,62,244,0.85)"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
      animate={{ rotate: 360 }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
      style={{ flexShrink: 0 }}
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </motion.svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#00D4AA"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   PhaseLabel — アートワーク左下に現在フェーズ名を表示するオーバーレイ
   ステップ1〜2でのみ表示（カード出現後は不要）
────────────────────────────────────────────────────────────────────────── */
function PhaseLabel({ step }: { step: number }) {
  const show = step <= 2;
  const texts: Record<number, string> = {
    1: "SCANNING...",
    2: "TIMESTAMPING...",
  };
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            zIndex: 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 999,
            background: "rgba(13,11,36,0.80)",
            border: "1px solid rgba(108,62,244,0.40)",
            backdropFilter: "blur(8px)",
          }}
        >
          {/* 点滅インジケータ */}
          <motion.span
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.0, repeat: Infinity, ease: "easeInOut" }}
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "#6C3EF4",
              boxShadow: "0 0 8px rgba(108,62,244,0.8)",
              display: "block",
            }}
          />
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.65)",
              textTransform: "uppercase",
            }}
          >
            {texts[step] ?? ""}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   NumberRoll（オリジナルから変更なし）
────────────────────────────────────────────────────────────────────────── */
function NumberRoll({
  value,
  prevValue,
  duration = 0.42,
}: {
  value: number;
  prevValue: number;
  duration?: number;
}) {
  const formatted = useMemo(() => value.toLocaleString("en-US"), [value]);
  const prevFormatted = useMemo(
    () => prevValue.toLocaleString("en-US").padStart(formatted.length, "0"),
    [prevValue, formatted.length]
  );
  const chars = useMemo(() => formatted.split(""), [formatted]);
  const prevChars = useMemo(() => prevFormatted.split(""), [prevFormatted]);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily:
          "ui-monospace, 'Geist Mono', 'SF Mono', Menlo, Consolas, monospace",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {chars.map((ch, i) => {
        const isDigit = /\d/.test(ch);
        if (!isDigit) {
          return (
            <span key={i} style={{ opacity: 0.65 }}>
              {ch}
            </span>
          );
        }
        const old = prevChars[i] ?? ch;
        const same = old === ch;
        return (
          <span
            key={i}
            style={{
              position: "relative",
              display: "inline-block",
              width: "0.62em",
              height: "1em",
              overflow: "hidden",
              lineHeight: 1,
            }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {!same && (
                <motion.span
                  key={`old-${i}-${old}`}
                  initial={{ y: 0 }}
                  animate={{ y: "-100%" }}
                  exit={{ y: "-100%" }}
                  transition={{ duration, ease: EASE_OUT_EXPO }}
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    textAlign: "center",
                  }}
                >
                  {old}
                </motion.span>
              )}
              <motion.span
                key={`new-${i}-${ch}`}
                initial={{ y: same ? 0 : "100%" }}
                animate={{ y: 0 }}
                transition={{ duration, ease: EASE_OUT_EXPO }}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  textAlign: "center",
                }}
              >
                {ch}
              </motion.span>
            </AnimatePresence>
          </span>
        );
      })}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Ripple（オリジナルから変更なし）
────────────────────────────────────────────────────────────────────────── */
function Ripple({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active &&
        [0, 140, 280].map((delay) => (
          <motion.span
            key={delay}
            initial={{ scale: 0, opacity: 0.45 }}
            animate={{ scale: 3, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.9,
              ease: EASE_OUT_EXPO,
              delay: delay / 1000,
            }}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 96,
              height: 96,
              marginLeft: -48,
              marginTop: -48,
              borderRadius: "50%",
              border: "2px solid #00D4AA",
              boxShadow: "0 0 24px rgba(0,212,170,0.55)",
              pointerEvents: "none",
              transformOrigin: "center",
            }}
          />
        ))}
    </AnimatePresence>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   AnimatedBorder CSS（オリジナルから変更なし）
────────────────────────────────────────────────────────────────────────── */
const animatedBorderCss = `
@keyframes pm-rotate-border {
  0%   { --pm-angle: 0deg; }
  100% { --pm-angle: 360deg; }
}
@property --pm-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}
.pm-hero-border {
  position: relative;
  border-radius: 24px;
  background: linear-gradient(rgba(255,255,255,0.02), rgba(255,255,255,0.02)) padding-box,
              conic-gradient(from var(--pm-angle, 0deg),
                rgba(108,62,244,0.0) 0deg,
                rgba(108,62,244,0.55) 60deg,
                rgba(0,212,170,0.55) 180deg,
                rgba(108,62,244,0.55) 300deg,
                rgba(108,62,244,0.0) 360deg) border-box;
  border: 1px solid transparent;
  animation: pm-rotate-border 9s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .pm-hero-border { animation: none; }
}
`;

/* ──────────────────────────────────────────────────────────────────────────
   小物コンポーネント（オリジナルから変更なし）
────────────────────────────────────────────────────────────────────────── */
function DataRow({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "9px 0",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: mono ? 11 : 12,
          fontWeight: 700,
          fontFamily: mono
            ? "ui-monospace, 'Geist Mono', 'SF Mono', Menlo, Consolas, monospace"
            : "inherit",
          color: accent ? "#00D4AA" : "#F0EFF8",
          letterSpacing: mono ? "0.02em" : 0,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Crystallize({
  loopKey,
  run,
  children,
}: {
  loopKey: number;
  run: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      key={`crystal-${loopKey}`}
      initial={{ filter: "blur(4px)", opacity: 0 }}
      animate={
        !run
          ? { filter: "blur(0px)", opacity: 1 }
          : {
            filter: ["blur(4px)", "blur(4px)", "blur(0px)", "blur(0px)", "blur(0px)"],
            opacity: [0, 0, 1, 1, 1],
          }
      }
      transition={
        !run
          ? { duration: 0.5, ease: EASE_OUT_EXPO }
          : {
            duration: TL.total / 1000,
            times: [
              0,
              TL.dataIn.start / TL.total,
              (TL.dataIn.start + TL.dataIn.dur) / TL.total,
              TL.fadeOut.start / TL.total,
              1,
            ],
            ease: EASE_OUT_EXPO,
          }
      }
    >
      {children}
    </motion.div>
  );
}

function RippleAt({ loopKey, run }: { loopKey: number; run: boolean }) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!run) return;
    const t1 = window.setTimeout(() => setActive(true), TL.ripple.start);
    const t2 = window.setTimeout(
      () => setActive(false),
      TL.ripple.start + TL.ripple.dur
    );
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [run, loopKey]);
  return <Ripple active={active} />;
}

function truncateHash(h: string) {
  if (h.length <= 18) return h;
  return `${h.slice(0, 8)}…${h.slice(-8)}`;
}

/* ──────────────────────────────────────────────────────────────────────────
   HeroDemo — メインエクスポート
────────────────────────────────────────────────────────────────────────── */
export interface HeroDemoProps {
  thumbnailSrc: string;
  initialCount?: number;
  disabled?: boolean;
  demoHash?: string;
  className?: string;
}

const DEFAULT_HASH =
  "1ab07c9e3d8f2a5c0b6e91d4f7a8c2b5e08d3f1a9c4e7b2d5a8f1c3e6b9d2a4f";

export default function HeroDemo({
  thumbnailSrc,
  initialCount = 12846,
  disabled = false,
  demoHash = DEFAULT_HASH,
  className,
}: HeroDemoProps) {
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  const [loopKey, setLoopKey] = useState(0);
  const [counter, setCounter] = useState({ value: initialCount, prev: initialCount });

  // ★ 新規: 現在のナレーションステップ（1〜4）
  const [step, setStep] = useState(1);

  const shouldRun = !disabled && !reduced && inView;

  /* IntersectionObserver */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => setInView(e.isIntersecting)),
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* ★ 新規: ステップ管理 + 既存のループ管理を統合 */
  const loopTimerRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    loopTimerRef.current.forEach((t) => window.clearTimeout(t));
    loopTimerRef.current = [];
  }, []);

  useEffect(() => {
    if (!shouldRun) return;

    const push = (fn: () => void, ms: number) => {
      const t = window.setTimeout(fn, ms);
      loopTimerRef.current.push(t);
    };

    // ステップ遷移
    setStep(1);
    push(() => setStep(2), TL.step2At);
    push(() => setStep(3), TL.step3At);
    push(() => setStep(4), TL.step4At);

    // カウンタ加算（Phase 6）
    push(() => {
      setCounter((c) => ({ value: c.value + 1, prev: c.value }));
    }, TL.counterTick.start);

    // ループリセット
    push(() => {
      setStep(1);
      setLoopKey((k) => k + 1);
    }, TL.total);

    return clearTimers;
  }, [shouldRun, loopKey, clearTimers]);

  /* Reduced Motion / disabled 時 */
  const staticView = !shouldRun;
  const displayStep = staticView ? 4 : step;

  return (
    <div ref={containerRef} className={className} style={{ width: "100%" }}>
      <style>{animatedBorderCss}</style>

      <motion.div
        key={`bg-${loopKey}`}
        className="pm-hero-border"
        initial={{ backgroundColor: "rgba(108,62,244,0)" }}
        animate={
          staticView
            ? { backgroundColor: "rgba(0,212,170,0.03)" }
            : {
              backgroundColor: [
                "rgba(108,62,244,0)",
                "rgba(108,62,244,0)",
                "rgba(108,62,244,0.04)",
                "rgba(0,212,170,0.03)",
                "rgba(0,212,170,0.03)",
              ],
            }
        }
        transition={
          staticView
            ? { duration: 0 }
            : {
              duration: TL.total / 1000,
              times: [
                0,
                TL.borderArm.start / TL.total,
                TL.bgShift.start / TL.total,
                (TL.bgShift.start + TL.bgShift.dur) / TL.total,
                1,
              ],
              ease: EASE_IN_OUT_QUART,
            }
        }
        style={{
          position: "relative",
          padding: 24,
          overflow: "hidden",
          isolation: "isolate",
        }}
      >
        {/* ★ 新規: ステップインジケータ + ナレーションバナー */}
        <StepDots current={displayStep} />
        <NarrationBanner step={displayStep} />

        {/* 既存の全体フェードアウトラッパ */}
        <motion.div
          key={`fade-${loopKey}`}
          initial={{ opacity: 0 }}
          animate={
            staticView
              ? { opacity: 1 }
              : { opacity: [0, 1, 1, 0] }
          }
          transition={
            staticView
              ? { duration: 0.4, ease: EASE_OUT_EXPO }
              : {
                duration: TL.total / 1000,
                times: [
                  0,
                  TL.artworkIn.dur / TL.total,
                  TL.fadeOut.start / TL.total,
                  (TL.fadeOut.start + TL.fadeOut.dur) / TL.total,
                ],
                ease: EASE_OUT_EXPO,
              }
          }
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 0.95fr)",
            gap: 20,
            alignItems: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* ── Left: アートワーク + Seal + Ripple ── */}
          <motion.div
            key={`asset-wrap-${loopKey}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={
              staticView
                ? { opacity: 1, scale: 1 }
                : { opacity: 1, scale: [0.96, 1, 1, 0.98, 1.0] }
            }
            transition={
              staticView
                ? { duration: 0.5, ease: EASE_OUT_EXPO }
                : {
                  duration: TL.total / 1000,
                  times: [
                    0,
                    TL.artworkIn.dur / TL.total,
                    TL.sealImpact.start / TL.total,
                    (TL.sealImpact.start + 110) / TL.total,
                    (TL.sealImpact.start + TL.sealImpact.dur) / TL.total,
                  ],
                  ease: EASE_OUT_EXPO,
                }
            }
            style={{
              position: "relative",
              aspectRatio: "1 / 1",
              borderRadius: 20,
              overflow: "hidden",
              background:
                "linear-gradient(135deg, rgba(108,62,244,0.18), rgba(0,212,170,0.10))",
              boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
            }}
          >
            <img
              src={thumbnailSrc}
              alt="Verified artwork"
              draggable={false}
              loading="eager"
              fetchPriority="high"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                userSelect: "none",
                pointerEvents: "none",
              }}
            />

            {/* Teal ティント（Phase 4）*/}
            <motion.div
              key={`tint-${loopKey}`}
              initial={{ opacity: 0 }}
              animate={
                staticView
                  ? { opacity: 0.18 }
                  : { opacity: [0, 0, 0.18, 0.18, 0] }
              }
              transition={
                staticView
                  ? { duration: 0.4 }
                  : {
                    duration: TL.total / 1000,
                    times: [
                      0,
                      TL.bgShift.start / TL.total,
                      (TL.bgShift.start + TL.bgShift.dur) / TL.total,
                      TL.fadeOut.start / TL.total,
                      (TL.fadeOut.start + TL.fadeOut.dur) / TL.total,
                    ],
                    ease: EASE_IN_OUT_QUART,
                  }
              }
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(circle at 50% 60%, rgba(0,212,170,0.30), rgba(0,212,170,0) 60%)",
                mixBlendMode: "screen",
                pointerEvents: "none",
              }}
            />

            {/* Ripple（Phase 3）*/}
            <RippleAt loopKey={loopKey} run={shouldRun} />

            {/* ★ 新規: フェーズラベル（アートワーク左下）*/}
            <PhaseLabel step={displayStep} />

            {/* 削除したロゴの代わりに、暗号データの機能美を配置 */}
            <motion.div
              className="absolute left-[60%] top-[18%] z-20 -translate-x-1/2 rounded-[16px] border border-white/10 bg-black/40 px-4 py-2 backdrop-blur-md"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: [0, 1, 1, 0] }}
              transition={{
                duration: 7,
                times: [0, 0.2, 0.8, 1],
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <div className="text-[9px] uppercase tracking-widest text-white/50">Timestamp Signature</div>
              <div className="font-mono text-sm font-bold text-[#00D4AA]">VERIFIED SIGNATURE</div>
            </motion.div>
          </motion.div>

          {/* ── Right: 証明書カード（Phase 5）── */}
          <motion.div
            key={`card-${loopKey}`}
            initial={{ y: 24, opacity: 0 }}
            animate={
              staticView
                ? { y: 0, opacity: 1 }
                : { y: [24, 24, 0, 0, 0], opacity: [0, 0, 1, 1, 1] }
            }
            transition={
              staticView
                ? { duration: 0.5, ease: EASE_OUT_EXPO }
                : {
                  duration: TL.total / 1000,
                  times: [
                    0,
                    TL.cardIn.start / TL.total,
                    (TL.cardIn.start + TL.cardIn.dur) / TL.total,
                    TL.fadeOut.start / TL.total,
                    1,
                  ],
                  ease: EASE_OUT_EXPO,
                }
            }
            style={{
              position: "relative",
              padding: 20,
              borderRadius: 20,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              boxShadow:
                "0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
              overflow: "hidden",
            }}
          >
            {/* カードボーダーの呼吸（Phase 7）*/}
            <motion.div
              key={`breath-${loopKey}`}
              initial={{ boxShadow: "0 0 0 1px rgba(108,62,244,0.35)" }}
              animate={
                staticView
                  ? { boxShadow: "0 0 0 1px rgba(0,212,170,0.45)" }
                  : {
                    boxShadow: [
                      "0 0 0 1px rgba(108,62,244,0.35)",
                      "0 0 0 1px rgba(108,62,244,0.35)",
                      "0 0 0 1px rgba(0,212,170,0.55)",
                      "0 0 0 1px rgba(108,62,244,0.35)",
                      "0 0 0 1px rgba(108,62,244,0.35)",
                    ],
                  }
              }
              transition={
                staticView
                  ? { duration: 0.4 }
                  : {
                    duration: TL.total / 1000,
                    times: [
                      0,
                      TL.cardBreath.start / TL.total,
                      (TL.cardBreath.start + TL.cardBreath.dur / 2) / TL.total,
                      (TL.cardBreath.start + TL.cardBreath.dur) / TL.total,
                      1,
                    ],
                    ease: EASE_IN_OUT_QUART,
                  }
              }
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 20,
                pointerEvents: "none",
              }}
            />

            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#A8A0D8",
                }}
              >
                Certificate of Authenticity
              </span>

              {/* 証明済みバッジ（Phase 5 / badgeIn）*/}
              <motion.span
                key={`badge-${loopKey}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={
                  staticView
                    ? { scale: 1, opacity: 1 }
                    : { scale: [0, 0, 1.08, 1, 1, 1], opacity: [0, 0, 1, 1, 1, 1] }
                }
                transition={
                  staticView
                    ? { duration: 0.36, ease: EASE_OUT_EXPO }
                    : {
                      duration: TL.total / 1000,
                      times: [
                        0,
                        TL.badgeIn.start / TL.total,
                        (TL.badgeIn.start + 180) / TL.total,
                        (TL.badgeIn.start + TL.badgeIn.dur) / TL.total,
                        TL.fadeOut.start / TL.total,
                        1,
                      ],
                      ease: EASE_OUT_EXPO,
                    }
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 10px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#00D4AA",
                  background: "rgba(0,212,170,0.12)",
                  border: "1px solid rgba(0,212,170,0.4)",
                  whiteSpace: "nowrap",
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
                証明済み
              </motion.span>
            </header>

            {/* データ行（Crystallize）*/}
            <Crystallize loopKey={loopKey} run={shouldRun}>
              <DataRow label="SHA-256" mono value={truncateHash(demoHash)} />
              <DataRow
                label="Certified (UTC)"
                mono
                value="2026-04-25T15:42:18Z"
              />
              <DataRow label="Trust Tier" value="Trusted TSA · DigiCert" accent />
            </Crystallize>
          </motion.div>
        </motion.div>

        {/* カウンタ（右下）— オリジナルから変更なし */}
        <div
          style={{
            position: "absolute",
            right: 18,
            bottom: 14,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(13,11,36,0.7)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "#A8A0D8",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            zIndex: 2,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#00D4AA",
              boxShadow: "0 0 10px #00D4AA",
            }}
          />
          <NumberRoll value={counter.value} prevValue={counter.prev} />
          <span style={{ opacity: 0.65, marginLeft: 2 }}>certificates issued</span>
        </div>
      </motion.div>
    </div>
  );
}
