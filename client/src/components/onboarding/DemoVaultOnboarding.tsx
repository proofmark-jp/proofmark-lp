/**
 * DemoVaultOnboarding.tsx — The Pedestal of Aha
 * ─────────────────────────────────────────────────────────────────────────────
 * 「Empty State を殲滅し、所有欲を強制インストールする至宝の展示台」
 *
 * ProofMark に新規登録した直後、まだ証明書が 0 件のユーザーが最初に対峙する
 * ダッシュボード中央のヒーローブロック。三流の "ここにドロップしてください"
 * という空白ではなく、「もしあなたがドロップしたら、あなたの歴史はこう守られる」
 * という The Aha Moment の完成形を強制的に見せつける。
 *
 * 設計原則
 *  ① The Pedestal: 暗闇に Radial Gradient (#6C3EF4 × #00D4AA, opacity 0.03)
 *     をふんわり敷き、その中央にカードが浮遊しているように見せる
 *  ② The Ultimate Demonstration Card: 既存 BentoCard と寸分違わぬ造形で、
 *     中身を最高峰にセットアップしたモックを刻む
 *  ③ The Oracle Badge: モザイクの外れた Humanity Score: 100% (VERIFIED)
 *  ④ Kinetic Invitation: ホバーで useSpring の浮上 + GhostScrubIndicator の
 *     波打ちパルス。所有欲とドロップ衝動を極限まで増幅
 *
 * 不変条件
 *  - 独立コンポーネント (props 任意、追加依存なし) として完結
 *  - React + TypeScript + Tailwind + framer-motion のみで構成
 *  - 60fps 死守: will-change と GPU レイヤー化を徹底
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useMemo, useState } from 'react';
import {
  AnimatePresence,
  motion,
} from 'framer-motion';
import { GhostScrubIndicator } from '../GhostScrubIndicator';
import {
  Fingerprint,
  Layers3,
  Lock,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════════════════════ */

export interface DemoVaultOnboardingProps {
  /** ユーザーが「最初の作品をドロップ」する CTA を押した時のコールバック */
  onDropIntent?: () => void;
  /** カスタムサブテキスト（任意。未指定時はデフォルトコピー） */
  subtitle?: string;
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS — Demo Data (ハードコード固定)
   ═══════════════════════════════════════════════════════════════ */

const DEMO_TITLE = 'The Making of ProofMark — Conceptual Art';
const DEMO_HASH =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const DEMO_TIMESTAMP = '[RFC-3161] Just now';
const DEMO_STEP_COUNT = 150;

/** GhostScrubIndicator が描画するドット数 (パフォーマンスのため間引き) */
const SCRUB_DOT_COUNT = 56;

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function DemoVaultOnboarding({
  onDropIntent,
  subtitle,
}: DemoVaultOnboardingProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <section
      className="
        relative w-full overflow-hidden
        rounded-[28px]
        py-16 sm:py-20 lg:py-24
        px-4 sm:px-8
      "
      style={{
        backgroundColor: '#07070C',
      }}
      aria-label="ProofMark Vault のデモンストレーション"
    >
      {/* ─────────────────────────────────────────────────────────
         ① The Pedestal — 極薄の Radial Gradient で「浮遊」を演出
         ───────────────────────────────────────────────────────── */}
      <PedestalBackdrop />

      {/* ─────────────────────────────────────────────────────────
         上部タイポグラフィ — Stripe 的抑制と絶対的自信
         ───────────────────────────────────────────────────────── */}
      <header className="relative z-10 max-w-4xl mx-auto text-center mb-12 sm:mb-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="
            inline-flex items-center gap-2
            px-3 py-1.5 rounded-full
            border border-white/10
            bg-white/[0.03] backdrop-blur-md
            text-[10.5px] uppercase tracking-[0.22em]
            text-white/55 font-semibold
            mb-6
          "
          style={{ willChange: 'transform, opacity' }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: '#00D4AA',
              boxShadow: '0 0 8px rgba(0,212,170,0.8)',
            }}
          />
          ProofMark Vault · Preview
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="
            font-bold tracking-tight
            text-[28px] sm:text-[40px] lg:text-[52px]
            leading-[1.08]
            text-white
          "
          style={{
            fontFeatureSettings: '"ss01", "cv11"',
            letterSpacing: '-0.02em',
          }}
        >
          あなたの歴史をドロップし、
          <br className="hidden sm:block" />
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                'linear-gradient(110deg, #FFFFFF 0%, #B5A8FF 45%, #6FF0D2 100%)',
            }}
          >
            最初の防衛線を構築してください。
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="
            mt-5 max-w-2xl mx-auto
            text-[14.5px] sm:text-[15.5px] leading-[1.7]
            text-white/55 font-medium
          "
        >
          {subtitle ??
            'SHA-256 と RFC-3161 タイムスタンプによる第三者証明。下記はあなたの未来のカードのデモです。'}
        </motion.p>
      </header>

      {/* ─────────────────────────────────────────────────────────
         ② The Ultimate Demonstration Card — 神のモックアップ
         ───────────────────────────────────────────────────────── */}
      <style>{`
        .pm-demo-card {
          transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
          transform: translate3d(0, 0, 0) scale(1);
          will-change: transform, box-shadow;
          box-shadow: 0 40px 80px -20px rgba(108, 62, 244, 0.35), 0 20px 50px -10px rgba(0, 212, 170, 0.35), 0 0 0 1px rgba(255,255,255,0.06);
        }
        .pm-demo-card.is-hovered {
          transform: translate3d(0, -6px, 0) scale(1.02);
          box-shadow: 0 40px 80px -20px rgba(108, 62, 244, 0.55), 0 20px 50px -10px rgba(0, 212, 170, 0.55), 0 0 0 1px rgba(255,255,255,0.06);
        }
        .pm-demo-floor-shadow {
          transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
          will-change: opacity, width;
        }
        @keyframes pm-oracle-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,212,170,0); }
          50% { box-shadow: 0 0 22px 2px rgba(0,212,170,0.55); }
        }
        .pm-oracle-badge-gpu {
          animation: pm-oracle-pulse 2.6s ease-in-out infinite;
          will-change: box-shadow;
        }
        @keyframes pm-cta-sweep {
          0% { transform: translateX(-110%); }
          100% { transform: translateX(110%); }
        }
        .pm-cta-sweep-gpu {
          animation: pm-cta-sweep 2.6s ease-in-out infinite;
          animation-delay: 1.2s;
          will-change: transform;
        }
      `}</style>
      <div className="relative z-10 flex justify-center">
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          tabIndex={0}
          role="button"
          aria-label="あなたの未来の証明書カード（デモ）"
          onClick={onDropIntent}
          style={{
            transformOrigin: 'center center',
          }}
          className={`
            pm-demo-card ${hovered ? 'is-hovered' : ''}
            relative w-full max-w-[520px]
            rounded-[24px]
            cursor-pointer
            outline-none
            focus-visible:ring-2 focus-visible:ring-[#00D4AA]/60
          `}
        >
          {/* Bento Card 本体 */}
          <div
            className="
              relative overflow-hidden
              rounded-[24px]
              border border-white/10
              backdrop-blur-xl
            "
            style={{
              backgroundColor: 'rgba(14, 16, 36, 0.85)',
              backgroundImage:
                'linear-gradient(135deg, rgba(108,62,244,0.10) 0%, rgba(0,212,170,0.06) 100%)',
            }}
          >
            {/* 内側の極薄グラデーション帯 */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{
                backgroundImage:
                  'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
              }}
            />

            {/* ── Card Header ── */}
            <div className="flex items-start justify-between gap-3 px-6 pt-6">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="
                    inline-flex items-center justify-center
                    w-7 h-7 rounded-lg
                  "
                  style={{
                    backgroundColor: 'rgba(108,62,244,0.18)',
                    border: '1px solid rgba(108,62,244,0.4)',
                  }}
                >
                  <Layers3 size={14} className="text-[#B5A8FF]" />
                </span>
                <span className="text-[10.5px] tracking-[0.22em] uppercase font-semibold text-white/55">
                  Process Bundle
                </span>
              </div>

              <span
                className="
                  inline-flex items-center gap-1.5
                  px-2 py-0.5 rounded-full
                  text-[9.5px] tracking-[0.18em] uppercase font-bold
                "
                style={{
                  color: '#6FF0D2',
                  backgroundColor: 'rgba(0,212,170,0.10)',
                  border: '1px solid rgba(0,212,170,0.35)',
                }}
              >
                <Lock size={9} />
                Sealed
              </span>
            </div>

            {/* ── Card Title ── */}
            <div className="px-6 pt-4 pb-2">
              <h3
                className="
                  text-white font-bold
                  text-[17px] sm:text-[18.5px] leading-[1.35]
                  tracking-tight
                "
                style={{ letterSpacing: '-0.012em' }}
              >
                {DEMO_TITLE}
              </h3>
              <p className="mt-1.5 text-[11.5px] font-medium text-white/45 tracking-wide">
                {DEMO_TIMESTAMP}
              </p>
            </div>

            {/* ── Ghost Scrub Indicator (Mock) ── */}
            <div className="px-6 pt-3 pb-4">
              <GhostScrubIndicator chainDepth={DEMO_STEP_COUNT} forceActive={hovered} />
            </div>

            {/* ── Hash Card ── */}
            <div className="px-6 pb-5">
              <div
                className="
                  rounded-xl px-3.5 py-3
                  border
                "
                style={{
                  backgroundColor: 'rgba(8,10,22,0.7)',
                  borderColor: 'rgba(255,255,255,0.06)',
                }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Fingerprint size={11} className="text-[#6FF0D2]" />
                  <span className="text-[9.5px] tracking-[0.22em] uppercase font-bold text-white/55">
                    SHA-256 · Cryptographic Fingerprint
                  </span>
                </div>
                <code
                  className="
                    block text-[11px] leading-[1.55]
                    text-[#B5A8FF]
                    break-all
                    font-mono
                  "
                  style={{
                    fontFamily:
                      "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                    textShadow: '0 0 12px rgba(181,168,255,0.35)',
                  }}
                >
                  {DEMO_HASH}
                </code>
              </div>
            </div>

            {/* ── Footer: Oracle Badge + meta ── */}
            <div
              className="
                flex items-center justify-between
                px-6 py-4
                border-t border-white/[0.06]
              "
              style={{
                backgroundColor: 'rgba(255,255,255,0.015)',
              }}
            >
              <div className="flex flex-col">
                <span className="text-[9.5px] tracking-[0.22em] uppercase font-bold text-white/40">
                  Chain Depth
                </span>
                <span className="text-[13.5px] font-bold text-white/85 tracking-tight mt-0.5">
                  {DEMO_STEP_COUNT.toString().padStart(2, '0')} steps
                </span>
              </div>

              <OracleBadge />
            </div>

            {/* Hover Glow Overlay */}
            <AnimatePresence>
              {hovered && (
                <motion.div
                  key="hover-glow"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-[24px]"
                  style={{
                    backgroundImage:
                      'radial-gradient(ellipse at top, rgba(108,62,244,0.18) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(0,212,170,0.12) 0%, transparent 60%)',
                  }}
                />
              )}
            </AnimatePresence>
          </div>

          {/* ── Hover-Reactive Floor Shadow (extra depth) ── */}
          <div
            aria-hidden
            className="pm-demo-floor-shadow pointer-events-none absolute left-1/2 -bottom-6 -translate-x-1/2 rounded-full"
            style={{
              width: hovered ? '78%' : '64%',
              opacity: hovered ? 0.55 : 0.3,
              height: 28,
              filter: 'blur(20px)',
              backgroundImage:
                'radial-gradient(ellipse, rgba(108,62,244,0.55) 0%, transparent 70%)',
            }}
          />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────
         下部 CTA — Drop Intent (静かな招待)
         ───────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex justify-center mt-16">
        <motion.button
          type="button"
          onClick={onDropIntent}
          whileHover={{ scale: 1.025 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 26 }}
          className="
            group relative
            inline-flex items-center gap-3
            px-6 py-3.5 rounded-2xl
            font-bold text-[13.5px] tracking-tight
            text-[#0A0A0A]
            overflow-hidden
          "
          style={{
            backgroundImage:
              'linear-gradient(135deg, #00D4AA 0%, #00B894 50%, #6C3EF4 130%)',
            boxShadow:
              '0 18px 40px -10px rgba(0,212,170,0.45), 0 8px 20px -6px rgba(108,62,244,0.35)',
            willChange: 'transform',
          }}
        >
          <UploadCloud size={16} className="shrink-0" />
          最初の作品をドロップして、Vault を起動する
          <span
            aria-hidden
            className="pm-cta-sweep-gpu absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.45) 50%, transparent 70%)',
              mixBlendMode: 'overlay',
            }}
          />
        </motion.button>
      </div>

      {/* ─────────────────────────────────────────────────────────
         極小フットノート（信頼の補強）
         ───────────────────────────────────────────────────────── */}
      <p className="relative z-10 mt-6 text-center text-[10.5px] tracking-[0.18em] uppercase font-semibold text-white/30">
        SHA-256 · RFC-3161 · Independent Third-Party Verification
      </p>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ① PedestalBackdrop — Radial Gradient の薄霧
   ═══════════════════════════════════════════════════════════════ */

function PedestalBackdrop() {
  return (
    <>
      {/* 紫色の主光源 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 80% 55% at 50% 38%, rgba(108,62,244,0.16) 0%, transparent 60%)',
        }}
      />
      {/* シアンの副光源 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 60% 45% at 50% 75%, rgba(0,212,170,0.10) 0%, transparent 65%)',
        }}
      />
      {/* 中央の極薄混色（仕様: opacity ~ 0.03） */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(108,62,244,0.06) 0%, rgba(0,212,170,0.03) 35%, transparent 70%)',
        }}
      />
      {/* グレイン / ノイズ感 (微細な subpixel テクスチャ) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ② Oracle Badge — Humanity Score: 100% (VERIFIED)
   ═══════════════════════════════════════════════════════════════ */

function OracleBadge() {
  return (
    <div
      style={{
        backgroundImage:
          'linear-gradient(135deg, rgba(0,212,170,0.18) 0%, rgba(108,62,244,0.18) 100%)',
        border: '1px solid rgba(0,212,170,0.55)',
      }}
      className="
        pm-oracle-badge-gpu
        relative inline-flex items-center gap-2
        pl-2.5 pr-3 py-1.5 rounded-full
        backdrop-blur-md
      "
      aria-label="Humanity Score 100 percent verified"
    >
      <span
        className="
          inline-flex items-center justify-center
          w-5 h-5 rounded-full
        "
        style={{
          backgroundColor: '#00D4AA',
          boxShadow: '0 0 12px rgba(0,212,170,0.85)',
        }}
      >
        <ShieldCheck size={11} className="text-[#06120F]" strokeWidth={3} />
      </span>

      <div className="flex flex-col leading-none">
        <span className="text-[8.5px] tracking-[0.22em] uppercase font-bold text-white/55">
          Humanity Score
        </span>
        <span
          className="
            mt-0.5
            text-[12px] font-bold tracking-tight
          "
          style={{
            color: '#6FF0D2',
            textShadow: '0 0 10px rgba(0,212,170,0.55)',
          }}
        >
          100% · VERIFIED
        </span>
      </div>

      <Sparkles size={11} className="text-white/60 ml-0.5" />
    </div>
  );
}
