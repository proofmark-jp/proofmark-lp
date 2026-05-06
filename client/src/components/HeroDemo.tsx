/**
 * HeroDemo.tsx — ProofMark トップページ用ヒーローデモ
 *
 * 設計思想:
 *   1. ブラックボックス・ゼロ: MP4/WebM ラスター動画ではなく、Framer Motion で
 *      DOM / SVG を直接アニメーションさせる。背景 (#07061A) と完全シームレス。
 *   2. 1 コンポーネント完結: Total 4200ms ループ、Phase 1〜7 をすべて DOM 上で表現。
 *   3. ポータビリティ: 外部の Lottie / WebM に依存しない。Web フォントを焼き込まないので
 *      テキストの滲みもゼロ。Vercel / AWS / Cloudflare のどこへ移植しても挙動が同じ。
 *   4. フォールバック対応: prefers-reduced-motion / `disabled` / IntersectionObserver で
 *      停止と省エネを徹底。フレーム外では timeline を回さない。
 *   5. キレと重さの両立: ease-out-expo (cubic-bezier(0.16,1,0.3,1)) を基本。
 *      着地モーメントだけ spring を効かせ、Apple 製品的な物理感を演出。
 *
 * 依存:
 *   pnpm add framer-motion
 *
 * 使用例:
 *   import HeroDemo from "@/components/HeroDemo";
 *   <HeroDemo
 *     thumbnailSrc="/hero/fantasy_artwork_final.jpg"
 *     initialCount={12846}
 *   />
 */

import {
  motion,
  useAnimationControls,
  useReducedMotion,
  AnimatePresence,
} from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ──────────────────────────────────────────────────────────────────────────
   タイムライン定数（仕様書 §4 と 1:1 対応）
   すべての ms をここから引く ─ Single Source of Truth
────────────────────────────────────────────────────────────────────────── */
const TL = {
  total: 4200,

  artworkIn: { start: 0, dur: 600 },                  // Phase 1
  borderArm: { start: 600, dur: 300 },                // Phase 2
  sealDrop: { start: 900, dur: 180 },                 // Phase 3 (drop)
  sealImpact: { start: 1080, dur: 220 },              // Phase 3 (impact bounce)
  ripple: { start: 900, dur: 900 },                   // Phase 3 (ripple)
  bgShift: { start: 1100, dur: 800 },                 // Phase 4
  cardIn: { start: 1200, dur: 500 },                  // Phase 5 (card)
  dataIn: { start: 1440, dur: 500 },                  // Phase 5 (data)
  badgeIn: { start: 1700, dur: 360 },                 // Phase 5 (badge)
  counterTick: { start: 1900, dur: 420 },             // Phase 6
  cardBreath: { start: 3400, dur: 1200 },             // Phase 7 (glow)
  fadeOut: { start: 3600, dur: 600 },                 // Phase 7 (fade)
} as const;

/* ──────────────────────────────────────────────────────────────────────────
   イージング (cubic-bezier)
────────────────────────────────────────────────────────────────────────── */
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
const EASE_IN_OUT_QUART: [number, number, number, number] = [0.77, 0, 0.175, 1];

/* ──────────────────────────────────────────────────────────────────────────
   ProofMark Seal — 提供された SVG を 1:1 で内包（apple-touch-source 相当）
────────────────────────────────────────────────────────────────────────── */
const ProofMarkSeal = ({ size = 96 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="pp32-ri" x1="15%" y1="0%" x2="85%" y2="100%">
        <stop offset="0%" stopColor="#5830CC" />
        <stop offset="100%" stopColor="#00B896" />
      </linearGradient>
      <filter id="seal-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.4" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <rect width="100" height="100" rx="22" fill="#0D0B24" />
    <path
      d="M 50,4 L 10,27 L 10,73 L 50,96 L 90,73 L 90,27 L 87,25 L 82,29 L 76,18 Z"
      fill="none"
      stroke="url(#pp32-ri)"
      strokeWidth="3.8"
      strokeLinejoin="round"
      strokeLinecap="round"
      opacity=".85"
    />
    <polygon
      points="17,46 27,47 39,62 79,22 83,28 36,70 23,58"
      fill="#00D4AA"
      filter="url(#seal-glow)"
    />
  </svg>
);

/* ──────────────────────────────────────────────────────────────────────────
   Counter — 縦スクロールで数字が切り替わる（旧→新）
   Linear / Stripe で見られる column-roll パターンを Framer Motion で純実装
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
  // 桁ごとに分解。新旧の桁数が違ったら左ゼロパディングして揃える。
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
   Ripple — シール着地点から広がる Teal の同心円リング
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
   AnimatedBorder — 待機時の回転グラデーション・ボーダー（CSS レイヤ）
   Lottie に焼き込めない要素なので React/CSS で別管理する（仕様書 §5）
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
   HeroDemo — メインエクスポート
────────────────────────────────────────────────────────────────────────── */
export interface HeroDemoProps {
  /** 原画サムネイル（必須）。提供された fantasy_artwork_final.jpg を public 配下に置く */
  thumbnailSrc: string;
  /** ソーシャルプルーフカウンタの初期値 */
  initialCount?: number;
  /** 強制停止（A/B テスト・LCP 計測時など） */
  disabled?: boolean;
  /** 表示用の擬似ハッシュ（任意。指定なければデモ用固定値） */
  demoHash?: string;
  /** ラッパクラス */
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
  const [loopKey, setLoopKey] = useState(0); // ループのたびに +1 して残像をリセット
  const [counter, setCounter] = useState({ value: initialCount, prev: initialCount });

  const shouldRun = !disabled && !reduced && inView;

  /* IntersectionObserver — 画面外では timeline を回さない */
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

  /* タイムラインのループ管理 */
  const loopTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!shouldRun) return;
    const tick = () => {
      // カウンタは Phase 6 でだけ増分
      const counterAt = TL.counterTick.start;
      window.setTimeout(() => {
        setCounter((c) => ({ value: c.value + 1, prev: c.value }));
      }, counterAt);
      // loopKey を回してフェードアウト後に初期状態へ復帰
      loopTimerRef.current = window.setTimeout(() => {
        setLoopKey((k) => k + 1);
      }, TL.total);
    };
    tick();
    return () => {
      if (loopTimerRef.current) window.clearTimeout(loopTimerRef.current);
    };
    // shouldRun と loopKey の組合せで継続
  }, [shouldRun, loopKey]);

  /* Reduced Motion / disabled 時の静止表示用フラグ */
  const staticView = !shouldRun;

  /* ──────────────────────────────────────────────────
     Render
  ────────────────────────────────────────────────── */
  return (
    <div ref={containerRef} className={className} style={{ width: "100%" }}>
      <style>{animatedBorderCss}</style>

      {/* デモコンテナ（外枠） — 待機時の回転グラデーションボーダーは CSS レイヤ */}
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
                times: [0, TL.borderArm.start / TL.total, TL.bgShift.start / TL.total, (TL.bgShift.start + TL.bgShift.dur) / TL.total, 1],
                ease: EASE_IN_OUT_QUART,
              }
        }
        style={{
          position: "relative",
          padding: 28,
          overflow: "hidden",
          isolation: "isolate",
        }}
      >
        {/* ── Phase 7 全体フェードアウト用の opacity ラッパ ── */}
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
            gap: 24,
            alignItems: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* ────────────────────────────────────────────
              Left: Target Asset (原画) + Seal + Ripple
          ──────────────────────────────────────────── */}
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

            {/* Tealティント (Phase 4) */}
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

            {/* Ripple (Phase 3) */}
            <RippleAt loopKey={loopKey} run={shouldRun} />

            {/* Seal Drop + Impact (Phase 3) */}
            <motion.div
              key={`seal-${loopKey}`}
              initial={{ y: -64, opacity: 0, scale: 1 }}
              animate={
                staticView
                  ? { y: 0, opacity: 1, scale: 1 }
                  : {
                      y: [-64, -64, 0, 0, 0, 0],
                      opacity: [0, 0, 1, 1, 1, 1],
                      scale: [1, 1, 1, 0.92, 1.0, 1.0],
                    }
              }
              transition={
                staticView
                  ? { duration: 0.4, ease: EASE_OUT_EXPO }
                  : {
                      duration: TL.total / 1000,
                      times: [
                        0,
                        TL.sealDrop.start / TL.total,
                        TL.sealImpact.start / TL.total,
                        (TL.sealImpact.start + 90) / TL.total,
                        (TL.sealImpact.start + TL.sealImpact.dur) / TL.total,
                        1,
                      ],
                      ease: EASE_OUT_EXPO,
                    }
              }
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                marginLeft: -48,
                marginTop: -48,
                width: 96,
                height: 96,
                filter: "drop-shadow(0 12px 32px rgba(108,62,244,0.55))",
              }}
            >
              <ProofMarkSeal size={96} />
            </motion.div>
          </motion.div>

          {/* ────────────────────────────────────────────
              Right: Certificate Card (Phase 5)
          ──────────────────────────────────────────── */}
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
              padding: 22,
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
            {/* カードボーダーの呼吸 (Phase 7) */}
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
                marginBottom: 18,
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
              {/* Verified Badge (Phase 5 / 1700ms) */}
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

            {/* Crystallize: SHA-256 と日時を blur → 0 で出す (Phase 5 / 1440ms) */}
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

        {/* ────────────────────────────────────────────
            Counter (Phase 6) — カード外、右下
        ──────────────────────────────────────────── */}
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
          <span style={{ opacity: 0.65, marginLeft: 2 }}>certificates</span>
        </div>
      </motion.div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   小物コンポーネント
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
