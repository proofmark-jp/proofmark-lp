/**
 * Home.tsx — ProofMark LP 完全再設計
 * ─────────────────────────────────────────────────────────────
 *  Section 1: HERO
 *  Section 2: THE MOMENT   ← LiveProofDemo
 *  Section 3: WHAT YOU GET ← EvidencePackExplorer
 *  Section 4: PROOF        ← TestimonialCarousel
 *  Section 5: PRICING
 *  Section 6: FINAL CTA
 *
 *  以下は完全削除:
 *    THE RISK / 4-step SOLUTION / TECHNOLOGY セクション /
 *    EvidencePackTeaser / C2paComparisonRow / WhoItsForSection /
 *    TrustSignalRow / 旧 HeroDemo
 * ─────────────────────────────────────────────────────────────
 */

import { Suspense, lazy, useState } from 'react';
import { Link } from 'wouter';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'framer-motion';
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  ShieldCheck,
  Sparkles,
  Globe,
} from 'lucide-react';

import Navbar from '@/components/Navbar';
import LoadingFallback from '@/components/LoadingFallback';
import HeroCertificateShowcase from '@/components/HeroCertificateShowcase';
import { useAuth } from '@/hooks/useAuth';
import { PRICING_PLANS } from '@/data/pricingPlans'; // 🚨 データソース（SSOT）をインポート

const LiveProofDemo = lazy(() => import('@/components/LiveProofDemo'));
const EvidencePackExplorer = lazy(() => import('@/components/EvidencePackExplorer'));
const NDAProofDemo = lazy(() => import('@/components/NDAProofDemo')); // 🚨 NDAデモの追加
const PortfolioEmbedWidgetDemo = lazy(() => import('@/components/PortfolioEmbedWidgetDemo')); // 👑 神のデモ追加
const TestimonialCarousel = lazy(() => import('@/components/TestimonialCarousel'));

const PM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const fadeInProps = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.7, delay, ease: PM_EASE },
});

const TRUST_SIGNALS: ReadonlyArray<string> = [
  'IETF標準 RFC3161準拠',
  'ハッシュ生成はブラウザ完結',
  'オープンベータ 先行公開中', 
  'OpenSSL等で独立検証可能',
];

/* ═════════════════════════════════════════════ */

export default function Home(): JSX.Element {
  const { user, signOut } = useAuth();

  return (
    <div style={{ background: '#07061A', minHeight: '100vh', color: '#FFFFFF' }}>
      <Navbar user={user} signOut={signOut} />

      <HeroSection />
      <MomentSection />
      <WhatYouGetSection />

      {/* 🚨 NDAデモ（遅延読み込み）を What You Get と Proof の間に配置 */}
      <Suspense fallback={<LoadingFallback variant="inline" label="nda-demo" />}>
        <NDAProofDemo />
      </Suspense>

      {/* 👑 Portfolio Embed Widget デモ（営業・魅せる体験） */}
      <section className="relative py-24 bg-[#07061A]">
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(108,62,244,0.05) 0%, transparent 70%)' }} />
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 relative z-10">
          <div className="mb-14 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.24em] mb-5 border" style={{ background: 'rgba(108,62,244,0.08)', borderColor: 'rgba(108,62,244,0.3)', color: '#BC78FF' }}>
              <Globe className="w-3.5 h-3.5" /> Public Portfolio
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-5 leading-tight">
              あなたの作品を、堂々と公開しよう。
            </h2>
            <p className="text-[#A8A0D8] text-[15px] leading-relaxed max-w-2xl">
              ProofMarkで証明された作品は、ただ守られるだけではありません。
              <br />専用のウィジェットをポートフォリオサイトやブログに1行で埋め込み,
              あなたの実績と信頼をクライアントに直接アピールできます。
            </p>
          </div>
          <Suspense fallback={<LoadingFallback variant="inline" label="widget-demo" />}>
            <PortfolioEmbedWidgetDemo />
          </Suspense>
        </div>
      </section>

      <ProofSection />
      <PricingSection />
      <FinalCtaSection />
    </div>
  );
}

/* ═════════════════════════════════════════════
 *  Section 1: HERO
 * ═════════════════════════════════════════════ */

function HeroSection(): JSX.Element {
  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      className="pm-section pt-12 sm:pt-16 lg:pt-20"
    >
      <div className="pm-container">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <motion.div {...fadeInProps()}>
            <span className="pm-label inline-block">
              PROOFMARK — THE DELIVERY TRUST INFRASTRUCTURE
            </span>
            <h1
              id="hero-title"
              className="pm-display mt-5"
              style={{ letterSpacing: '-0.025em' }}
            >
              プロの「納品」には、<br />
              反論不能な<br />
              <span className="pm-accent-text">証拠（エビデンス）</span>を添える。
            </h1>
            <p className="pm-body mt-6 max-w-xl">
              AI時代のクリエイティブに、もはや言い訳は不要です。<br className="hidden sm:inline" />
              ファイルを落とすだけで、あなたのプロンプトと試行錯誤のプロセスを、<br className="hidden sm:inline" />
              クライアントを圧倒する「暗号学的な証明書（ZIP）」へと変換します。
            </p>

            {/* CTAs */}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/spot-issue"
                className="group inline-flex h-[56px] items-center justify-center gap-2 rounded-2xl px-7 text-[15px] font-bold text-white"
                style={{
                  background:
                    'linear-gradient(135deg, #6C3EF4 0%, #00D4AA 100%)',
                  boxShadow:
                    '0 14px 32px rgba(108,62,244,0.42), 0 0 0 1px rgba(255,255,255,0.06) inset',
                }}
              >
                今すぐ1件試す（¥480・登録不要）
                <ArrowRight className="h-4 w-4 transition-transform group-active:translate-x-0.5" />
              </Link>
              <a
                href="#demo"
                className="inline-flex h-[56px] items-center justify-center gap-2 text-[14px] font-semibold underline-offset-4 hover:underline"
                style={{ color: 'rgba(255,255,255,0.78)' }}
              >
                デモを見る <ArrowDown className="h-4 w-4" />
              </a>
            </div>

            {/* Trust signals (1 line) */}
            <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2">
              {TRUST_SIGNALS.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold"
                  style={{ color: 'rgba(255,255,255,0.55)' }}
                >
                  <Check className="h-3 w-3" style={{ color: '#00D4AA' }} />
                  {t}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div {...fadeInProps(0.1)} className="w-full">
            <HeroCertificateShowcase />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ═════════════════════════════════════════════
 *  Section 2: THE MOMENT (LiveProofDemo)
 * ═════════════════════════════════════════════ */

function MomentSection(): JSX.Element {
  return (
    <section
      id="demo"
      aria-labelledby="demo-title"
      className="pm-section"
      style={{
        background: '#07061A',
        scrollMarginTop: 80,
      }}
    >
      <div className="pm-container">
        <motion.div className="mb-10 text-center" {...fadeInProps()}>
          <Eyebrow>TRY IT NOW</Eyebrow>
          <h2
            id="demo-title"
            className="pm-h2 mt-4"
            style={{ letterSpacing: '-0.02em' }}
          >
            ファイルを投げると、
            <br className="hidden md:inline" />
            <span className="pm-accent-text">証明書が生まれます。</span>
          </h2>
        </motion.div>

        <Suspense
          fallback={<LoadingFallback variant="inline" label="live-demo" />}
        >
          <LiveProofDemo />
        </Suspense>
      </div>
    </section>
  );
}

/* ═════════════════════════════════════════════
 *  Section 3: WHAT YOU GET
 * ═════════════════════════════════════════════ */

function WhatYouGetSection(): JSX.Element {
  return (
    <section
      id="evidence"
      aria-labelledby="evidence-title"
      className="pm-section"
    >
      <div className="pm-container">
        <motion.div className="mb-10 max-w-3xl" {...fadeInProps()}>
          <Eyebrow>THE FINAL DELIVERABLE</Eyebrow>
          <h2
            id="evidence-title"
            className="pm-h2 mt-4"
            style={{ letterSpacing: '-0.02em' }}
          >
            クライアントに渡すのは、<br className="hidden sm:inline" />
            このZIPファイル<span className="pm-accent-text">1つだけ。</span>
          </h2>
          <p className="pm-body mt-4 max-w-2xl">
            専用のPDF証明書、タイムスタンプ原本、検証用スクリプト。<br />
            プロの仕事として「疑う余地のない証拠一式」を、そのまま納品データに同梱できます。
          </p>
        </motion.div>

        <Suspense fallback={<LoadingFallback variant="inline" label="zip" />}>
          <EvidencePackExplorer />
        </Suspense>

        {/* technical trust row */}
        <motion.div
          className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3"
          {...fadeInProps(0.1)}
        >
          <TechChip emoji="#" label="SHA-256 / NIST準拠" />
          <TechChip emoji="🕐" label="RFC3161 / IETF標準" />
          <TechChip emoji="🔓" label="ProofMarkなしで独立検証可能" />
        </motion.div>

        <div className="mt-6 text-center">
          <Link
            href="/trust-center"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold underline-offset-4 hover:underline"
            style={{ color: '#00D4AA' }}
          >
            技術的な詳細 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function TechChip({
  emoji,
  label,
}: {
  emoji: string;
  label: string;
}): JSX.Element {
  return (
    <div
      className="inline-flex items-center gap-3 rounded-2xl border px-4 py-3.5"
      style={{
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.005))',
        borderColor: '#1C1A38',
      }}
    >
      <span className="text-[18px]">{emoji}</span>
      <span className="text-[13px] font-semibold text-white">{label}</span>
    </div>
  );
}

/* ═════════════════════════════════════════════
 *  Section 4: PROOF (Testimonials)
 * ═════════════════════════════════════════════ */

function ProofSection(): JSX.Element {
  return (
    <section
      id="stories"
      aria-labelledby="stories-title"
      className="pm-section"
    >
      <div className="pm-container">
        <motion.div className="mb-10 max-w-3xl" {...fadeInProps()}>
          <Eyebrow>CREATOR STORIES</Eyebrow>
          <h2
            id="stories-title"
            className="pm-h2 mt-4"
            style={{ letterSpacing: '-0.02em' }}
          >
            ProofMarkを
            <span className="pm-accent-text">選んだ人</span>
            たちの話。
          </h2>
        </motion.div>

        <Suspense
          fallback={<LoadingFallback variant="inline" label="stories" />}
        >
          <TestimonialCarousel />
        </Suspense>
      </div>
    </section>
  );
}

/* ═════════════════════════════════════════════
 *  Section 5: PRICING
 * ═════════════════════════════════════════════ */

function PricingSection(): JSX.Element {
  // 🚨 LPには Studio / Business プランを出さず、3カラムに絞る
  const visiblePlans = PRICING_PLANS.filter(p => ['free', 'spot', 'creator'].includes(p.id));

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-title"
      className="pm-section"
    >
      <div className="pm-container">
        <motion.div className="mb-10 max-w-3xl text-center sm:text-left" {...fadeInProps()}>
          <Eyebrow>PRICING</Eyebrow>
          <h2
            id="pricing-title"
            className="pm-h2 mt-4"
            style={{ letterSpacing: '-0.02em' }}
          >
            まず1件試す。
            <br className="hidden sm:inline" />
            気に入ったら<span className="pm-accent-text">続ける。</span>
          </h2>
          <p className="pm-body mt-4">
            クレジットカード登録不要で始められます。
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
          {visiblePlans.map((p) => (
            <PricingCard key={p.id} plan={p} />
          ))}
        </div>

        {/* Studio link only */}
        <div className="mt-7 text-center">
          <Link
            href="/business"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold underline-offset-4 hover:underline"
            style={{ color: '#A8A0D8' }}
          >
            チーム・スタジオ向けプランはこちら
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* FAQ */}
        <div className="mt-12">
          <PricingFaq />
          <div className="mt-5 text-center">
            <Link
              href="/trust-center"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold underline-offset-4 hover:underline"
              style={{ color: '#00D4AA' }}
            >
              詳細FAQ・法的有効性について
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingCard({ plan }: { plan: any }): JSX.Element {
  const isSpot = plan.id === 'spot';
  const isFree = plan.id === 'free';

  return (
    <motion.div
      {...fadeInProps()}
      className="relative flex flex-col rounded-[24px] border p-6 sm:p-7"
      style={{
        background: plan.recommended
          ? 'linear-gradient(160deg, rgba(108,62,244,0.18) 0%, rgba(0,212,170,0.06) 60%, rgba(13,11,36,0.92) 100%)'
          : '#0D0B24',
        borderColor: plan.recommended ? 'rgba(108,62,244,0.50)' : '#1C1A38',
        boxShadow: plan.recommended
          ? '0 30px 60px rgba(108,62,244,0.22), 0 0 0 1px rgba(108,62,244,0.18) inset'
          : 'inset 0 0 0 1px rgba(255,255,255,0.04)',
      }}
    >
      {plan.recommended ? (
        <span
          className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em]"
          style={{
            background: 'rgba(0,212,170,0.10)',
            borderColor: 'rgba(0,212,170,0.45)',
            color: '#00D4AA',
          }}
        >
          <Sparkles className="h-3 w-3" /> RECOMMENDED
        </span>
      ) : null}

      <span
        className="text-[11px] font-bold uppercase tracking-[0.26em]"
        style={{ color: 'rgba(255,255,255,0.55)' }}
      >
        {plan.name}
      </span>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span
          className="text-[36px] font-black text-white"
          style={{ letterSpacing: '-0.025em' }}
        >
          {plan.priceLabel}
        </span>
        {plan.priceUnit ? (
          <span
            className="text-[13px] font-semibold"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            {plan.priceUnit}
          </span>
        ) : null}
      </div>
      <p
        className="mt-2 text-[13px]"
        style={{ color: 'rgba(255,255,255,0.62)' }}
      >
        {plan.tagline}
      </p>

      <ul className="mt-5 flex flex-1 flex-col gap-2.5">
        {plan.features.map((f: any) => (
          <li key={f.label} className={`flex items-start gap-2 text-[13px] ${f.state === 'exclude' ? 'text-white/40' : 'text-white'}`}>
            <Check
              className="mt-[3px] h-3.5 w-3.5 flex-shrink-0"
              style={{ color: f.state === 'exclude' ? 'rgba(255,255,255,0.2)' : '#00D4AA' }}
            />
            <span>{f.label}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col gap-2">
        <Link
          href={plan.ctaHref.guest}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-[14px] font-bold"
          style={
            isSpot
              ? {
                  background:
                    'linear-gradient(135deg, #6C3EF4 0%, #00D4AA 100%)',
                  color: '#FFFFFF',
                  boxShadow: '0 12px 28px rgba(108,62,244,0.42)',
                }
              : isFree
                ? {
                    border: '1px solid rgba(255,255,255,0.16)',
                    background: 'rgba(255,255,255,0.04)',
                    color: '#FFFFFF',
                  }
                : {
                    background: 'rgba(108,62,244,0.18)',
                    color: '#FFFFFF',
                    border: '1px solid rgba(108,62,244,0.42)',
                  }
          }
        >
          {plan.ctaLabel.guest}
          <ArrowRight className="h-4 w-4" />
        </Link>

        {/* Stripe 文言は SPOT (有料即時) の直下にのみ配置 — 仕様厳守 */}
        {isSpot ? (
          <p
            className="text-center text-[10.5px]"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            Stripeによる安全な決済 · カード情報登録不要
          </p>
        ) : null}
      </div>
    </motion.div>
  );
}

/* ─── Pricing FAQ (3) ────────────────────────── */

const FAQS: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: '原画はサーバーに送られますか？',
    a: 'いいえ。SHA-256 ハッシュ計算はあなたのブラウザ内で完結し、ProofMark のサーバには「指紋」と最小限のメタデータしか到達しません。Shareable Proof を選んだ場合のみ、公開ページ表示用の画像が暗号化された隔離領域へ送られます。',
  },
  {
    q: '解約したら証明書は消えますか？',
    a: '消えません。RFC3161 タイムスタンプは IETF 標準のため、ProofMark のサービスが将来停止しても OpenSSL 等の標準ツールで独立検証可能です。Evidence Pack はクライアント側に永続的に残ります。',
  },
  {
    q: '法的な場面で使えますか？',
    a: 'RFC3161 タイムスタンプは多くの国・地域で「存在の事実」を立証する有力な技術的証拠として実績があります。最終的な採否は事案と法域に依存しますが、独立検証可能な暗号学的証拠は、抑止力としても交渉材料としても強力に機能します。',
  },
];

function PricingFaq(): JSX.Element {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return (
    <div className="mx-auto max-w-3xl">
      {FAQS.map((f, i) => {
        const open = openIndex === i;
        return (
          <div
            key={f.q}
            className="border-b"
            style={{ borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-4 py-4 text-left"
            >
              <span className="text-[14px] font-semibold text-white">
                {f.q}
              </span>
              <motion.span
                animate={{ rotate: open ? 180 : 0 }}
                transition={{ duration: 0.28, ease: PM_EASE }}
                aria-hidden
              >
                <ChevronDown
                  className="h-4 w-4"
                  style={{ color: 'rgba(255,255,255,0.62)' }}
                />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {open ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.32, ease: PM_EASE }}
                  className="overflow-hidden"
                >
                  <p
                    className="pb-5 text-[13px] leading-relaxed"
                    style={{ color: 'rgba(255,255,255,0.72)' }}
                  >
                    {f.a}
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/* ═════════════════════════════════════════════
 *  Section 6: FINAL CTA
 * ═════════════════════════════════════════════ */

function FinalCtaSection(): JSX.Element {
  return (
    <section
      id="final-cta"
      aria-labelledby="final-title"
      className="pm-section relative overflow-hidden"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 0%, rgba(108,62,244,0.20) 0%, rgba(108,62,244,0) 70%)',
        }}
      />
      <div className="pm-container relative z-10 text-center">
        <motion.div {...fadeInProps()}>
          <Eyebrow>READY TO DELIVER</Eyebrow>
          <h2
            id="final-title"
            className="pm-h2 mt-4"
            style={{ letterSpacing: '-0.02em' }}
          >
            あなたのクリエイティブを、<br className="hidden md:inline" />
            <span className="pm-accent-text">暗号と数学で守り抜く。</span>
          </h2>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/spot-issue"
              className="inline-flex h-[60px] items-center justify-center gap-2 rounded-2xl px-8 text-[15px] font-bold text-white"
              style={{
                background:
                  'linear-gradient(135deg, #6C3EF4 0%, #00D4AA 100%)',
                boxShadow:
                  '0 14px 32px rgba(108,62,244,0.42), 0 0 0 1px rgba(255,255,255,0.06) inset',
              }}
            >
              今すぐ1件試す（¥480・登録不要）
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-4">
            <Link
              href="/auth?mode=signup"
              className="text-[13px] font-semibold underline-offset-4 hover:underline"
              style={{ color: 'rgba(255,255,255,0.78)' }}
            >
              または、無料アカウントを作成する
            </Link>
          </div>

          <p
            className="mt-7 text-[11.5px]"
            style={{ color: 'rgba(255,255,255,0.45)' }}
          >
            <ShieldCheck className="-mt-0.5 mr-1 inline h-3 w-3" style={{ color: '#00D4AA' }} />
            Stripeによる安全な決済 · クレジットカード登録不要 · 24時間後データ削除
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* ═════════════════════════════════════════════
 *  Atoms
 * ═════════════════════════════════════════════ */

function Eyebrow({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <span
      className="inline-block text-[11px] font-bold uppercase tracking-[0.32em]"
      style={{ color: '#00D4AA' }}
    >
      {children}
    </span>
  );
}
