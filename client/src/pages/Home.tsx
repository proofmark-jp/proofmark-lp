import type React from 'react';
import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { toast } from 'sonner';
import {
  Lock,
  Shield,
  Share2,
  CheckCircle,
  ArrowRight,
  Minus,
  Star,
} from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';

import CertificateUpload from '@/components/CertificateUpload.c2pa-patch';
import { useAuth } from '@/hooks/useAuth';
import HeroMockup from '../components/HeroMockup';
import { FAQAccordion } from '@/components/FAQAccordion';
import { SupportedToolsSection } from '@/components/SupportedToolsSection';
import { DeveloperMessage } from '@/components/DeveloperMessage';
import { sendConfirmationEmail } from '@/lib/email';
import LearningSection from '@/components/LearningSection';
import { SchemaScript } from '@/components/SchemaScript';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabase';
import SEO from '@/components/SEO';
import TrustSignalRow from '@/components/TrustSignalRow';
import EvidencePackTeaser from '@/components/EvidencePackTeaser';
import EngineeringPillarsSection from '@/components/EngineeringPillarsSection';
import UseCasesSection from '@/components/UseCasesSection';
import { PROOFMARK_COPY } from '@/lib/proofmark-copy';
import { PRICING_PLANS, FOUNDER_OFFER } from '@/data/pricingPlans';
import founderBadge from '../assets/logo/badges/proofmark-badge-founder.svg';
import {
  slideInVariants,
  staggerContainer,
  buttonVariants,
} from '@/lib/animations';

/* ────────────────────────────────────────────
 * Reusable scroll-triggered wrapper
 * children を optional にして空ラッパーの誤検出（TS2741）を回避する
 * ──────────────────────────────────────────── */
const FadeInSection = ({
  children,
  delay = 0,
  className = '',
}: {
  children?: React.ReactNode;
  delay?: number;
  className?: string;
}) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-80px' }}
    transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);

/* ────────────────────────────────────────────
 * Hero glow orb decoration
 * ──────────────────────────────────────────── */
const GlowOrb = ({
  color,
  size,
  top,
  left,
  opacity = 0.15,
}: {
  color: string;
  size: number;
  top: string;
  left: string;
  opacity?: number;
}) => (
  <div
    className="absolute rounded-full pointer-events-none"
    style={{
      width: size,
      height: size,
      top,
      left,
      background: color,
      opacity,
      filter: `blur(${size * 0.55}px)`,
    }}
  />
);

export default function Home() {
  const [heroEmail, setHeroEmail] = useState('');
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [isHeroSubmitting, setIsHeroSubmitting] = useState(false);
  const [isWaitlistSubmitting, setIsWaitlistSubmitting] = useState(false);

  const { user, signOut } = useAuth();
  SchemaScript();

  /**
   * 公開数バッジ。件数が少ない間は逆効果のため、
   * 一定閾値（DISPLAY_THRESHOLD）未満は "β版公開中" 表示に切り替える。
   */
  const DISPLAY_THRESHOLD = 1000;
  const [totalCerts, setTotalCerts] = useState<number | null>(null);

  useEffect(() => {
    async function fetchTotalCerts() {
      try {
        const { count } = await supabase
          .from('certificates')
          .select('*', { count: 'exact', head: true });
        if (count !== null) setTotalCerts(count);
      } catch (err) {
        console.error('Failed to fetch cert count:', err);
      }
    }
    fetchTotalCerts();
  }, []);

  const heroEyebrowLabel =
    totalCerts !== null && totalCerts >= DISPLAY_THRESHOLD
      ? `${PROOFMARK_COPY.hero.eyebrow} · ${totalCerts.toLocaleString()} verified`
      : `${PROOFMARK_COPY.hero.eyebrow} · β版公開中`;

  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -60]);

  const handleHeroSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!heroEmail) return;
    setIsHeroSubmitting(true);

    const { error: dbError } = await supabase
      .from('waitlist')
      .insert([{ email: heroEmail }]);

    if (dbError && dbError.code === '23505') {
      toast.info(
        'このメールアドレスは既に先行登録されています。ご期待いただきありがとうございます！',
      );
      setIsHeroSubmitting(false);
      return;
    }

    const emailResult = await sendConfirmationEmail(heroEmail);
    if (emailResult.success) {
      toast.success('登録完了！確認メールをお送りしました。');
      setHeroEmail('');
    } else {
      toast.error(emailResult.error || '登録に失敗しました');
    }
    setIsHeroSubmitting(false);
  };

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail) return;
    setIsWaitlistSubmitting(true);

    const { error: dbError } = await supabase
      .from('waitlist')
      .insert([{ email: waitlistEmail }]);

    if (dbError && dbError.code === '23505') {
      toast.info(
        'このメールアドレスは既に先行登録されています。ご期待いただきありがとうございます！',
      );
      setIsWaitlistSubmitting(false);
      return;
    }

    const emailResult = await sendConfirmationEmail(waitlistEmail);
    if (emailResult.success) {
      toast.success('ウェイティングリストに追加されました！');
      setWaitlistEmail('');
    } else {
      toast.error(emailResult.error || '登録に失敗しました');
    }
    setIsWaitlistSubmitting(false);
  };

  return (
    <>
      <SEO
        title="ProofMark | AI時代の納品信頼インフラ"
        description={PROOFMARK_COPY.metaDescription}
        url="https://proofmark.jp/"
        type="website"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          url: 'https://proofmark.jp/',
          name: 'ProofMark',
          description: PROOFMARK_COPY.metaDescription,
          publisher: {
            '@type': 'Organization',
            name: 'ProofMark',
            logo: {
              '@type': 'ImageObject',
              url: 'https://proofmark.jp/ogp-image.png',
            },
          },
        }}
      />
      <div
        id="top"
        className="min-h-screen bg-background text-foreground overflow-clip"
      >
        <Navbar user={user} signOut={signOut} />

        {/* ─────────────────────────────────
         * Hero
         * ───────────────────────────────── */}
        <section className="relative min-h-[92vh] flex items-center overflow-hidden">
          <GlowOrb color="#6c3ef4" size={520} top="-10%" left="-8%" opacity={0.18} />
          <GlowOrb color="#00d4aa" size={380} top="50%" left="60%" opacity={0.12} />
          <GlowOrb color="#6c3ef4" size={260} top="70%" left="10%" opacity={0.1} />

          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(rgba(108,62,244,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(108,62,244,0.04) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />

          <div className="absolute inset-0 opacity-20">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663365821234/UaD7q9pZxZRGqrDfYC425T/proofmark-hero-bg-JMfzwFshajssXPcJshrNUg.webp"
              alt=""
              className="w-full h-full object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </div>

          <motion.div
            className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24"
            style={{ y: heroY }}
          >
            {/* --- 置き換え後 --- */}
            <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
              {/* Eyebrow */}
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-[#00D4AA] text-[11px] sm:text-xs font-bold tracking-widest uppercase mb-8"
              >
                {heroEyebrowLabel}
              </motion.div>

              {/* H1 */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
                className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-white tracking-tight mb-6 leading-[1.08]"
              >
                {PROOFMARK_COPY.hero.title1}
                <br className="hidden sm:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00D4AA] to-[#BC78FF] whitespace-nowrap">
                  {PROOFMARK_COPY.hero.title2}
                </span>
              </motion.h1>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
                className="text-[#A8A0D8] text-base sm:text-lg max-w-2xl mx-auto mb-8 leading-relaxed"
              >
                {PROOFMARK_COPY.hero.subtitle}
              </motion.p>

              {/* Badges */}
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
                className="flex flex-wrap items-center justify-center gap-2 mb-10"
              >
                {PROOFMARK_COPY.hero.badges.map((b) => (
                  <span key={b} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-[#D4D0F4] backdrop-blur-md">
                    <CheckCircle className="h-3 w-3 text-[#00D4AA]" />
                    {b}
                  </span>
                ))}
              </motion.div>

              {/* CTA Area */}
              <div className="w-full max-w-md mx-auto z-20 relative">
                {user ? (
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4 }}>
                    <Link href="/dashboard">
                      <button className="w-full px-10 py-5 rounded-full bg-primary text-white font-black text-lg hover:scale-105 transition-all shadow-[0_0_40px_rgba(108,62,244,0.4)]">
                        管理画面へ進む (Go to Dashboard) ➔
                      </button>
                    </Link>
                  </motion.div>
                ) : (
                  <>
                    <motion.form
                      onSubmit={handleHeroSubmit}
                      className="flex flex-col sm:flex-row gap-3 mb-4 w-full"
                      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4 }}
                    >
                      <label htmlFor="hero-email" className="sr-only">メールアドレス</label>
                      <input
                        id="hero-email" type="email" placeholder="your@email.com" value={heroEmail}
                        onChange={(e) => setHeroEmail(e.target.value)} disabled={isHeroSubmitting}
                        className="flex-1 px-6 py-4 rounded-full border transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
                        style={{ background: 'rgba(21,29,47,0.85)', borderColor: 'rgba(42,42,78,0.8)', backdropFilter: 'blur(8px)' }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(108,62,244,0.7)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(108,62,244,0.15)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(42,42,78,0.8)'; e.currentTarget.style.boxShadow = 'none'; }}
                        required aria-label="先行登録用のメールアドレス"
                      />
                      <motion.button
                        type="submit" disabled={isHeroSubmitting}
                        className="px-8 py-4 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-70 disabled:cursor-wait"
                        style={{ boxShadow: '0 0 20px rgba(108,62,244,0.4)' }}
                        variants={buttonVariants} initial="rest" whileHover="hover" whileTap="tap"
                      >
                        {isHeroSubmitting ? '暗号化通信中...' : '無料で試す ➔'}
                      </motion.button>
                    </motion.form>

                    <div className="flex justify-center w-full">
                      <Link href={PROOFMARK_COPY.hero.secondaryCta.href}>
                        <button className="inline-flex items-center gap-2 text-sm font-bold text-[#A8A0D8] hover:text-white transition-colors mb-6">
                          {PROOFMARK_COPY.hero.secondaryCta.label} <ArrowRight className="h-4 w-4" />
                        </button>
                      </Link>
                    </div>

                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                      className="text-center text-[14px] text-[#A8A0D8] mt-2 leading-relaxed"
                    >
                      <p className="text-xs text-muted flex items-center justify-center gap-2 mb-3">
                        <Lock className="w-4 h-4 text-accent" /> メールアドレスはSSL/TLSで保護されます
                      </p>
                      <p>
                        <span className="text-[#ffd966] font-bold">🎁 先着100名限定</span>
                        ：β版優先招待 + Creator 3ヶ月無料 + 創設者バッジ<br />クレジットカード不要・いつでも解除OK
                      </p>
                    </motion.div>
                  </>
                )}
              </div>

              {/* Morphing Trust Core (HeroMockup) を中央直下に配置 */}
              <motion.div
                initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.5 }}
                className="w-full relative z-10 mt-16 sm:mt-24 pointer-events-none"
              >
                <HeroMockup />
              </motion.div>
            </div>
          </motion.div>
        </section>

        {/* 信頼整合性の最重要セクション：ヒーロー直下に固定表示 */}
        <TrustSignalRow />

        {/* Evidence Pack（差別化のコア） */}
        <EvidencePackTeaser />

        {/* ─────────────────────────────────
         * Pain Points（営業文脈）
         * ───────────────────────────────── */}
        <section
          aria-labelledby="pain-heading"
          className="py-24 relative overflow-hidden"
          style={{ background: 'rgba(15,22,41,0.6)' }}
        >
          <GlowOrb color="#00d4aa" size={360} top="10%" left="-8%" opacity={0.07} />
          <GlowOrb color="#6c3ef4" size={300} top="60%" left="75%" opacity={0.07} />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <FadeInSection className="text-center mb-16">
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold text-primary mb-4"
                style={{
                  background: 'rgba(108,62,244,0.1)',
                  border: '1px solid rgba(108,62,244,0.25)',
                }}
              >
                <Shield className="w-3 h-3" /> Pain Points
              </div>
              <h2
                id="pain-heading"
                className="text-3xl sm:text-4xl font-black mb-4"
              >
                {PROOFMARK_COPY.pains.heading}
              </h2>
              <p className="text-muted max-w-2xl mx-auto">
                {PROOFMARK_COPY.pains.subheading}
              </p>
            </FadeInSection>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
            >
              {PROOFMARK_COPY.pains.items.map((pain, i) => (
                <motion.div
                  key={i}
                  className="p-8 rounded-2xl border relative overflow-hidden group"
                  style={{
                    background: 'rgba(21,29,47,0.75)',
                    backdropFilter: 'blur(12px)',
                    borderColor: 'rgba(42,42,78,0.7)',
                  }}
                  variants={slideInVariants}
                  whileHover={{
                    borderColor: 'rgba(108,62,244,0.4)',
                    boxShadow: '0 8px 32px rgba(108,62,244,0.12)',
                    y: -4,
                  }}
                  transition={{ duration: 0.25 }}
                >
                  <span
                    className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-4"
                    style={{
                      background: 'rgba(108,62,244,0.15)',
                      color: '#6c3ef4',
                      border: '1px solid rgba(108,62,244,0.2)',
                    }}
                  >
                    {pain.tag}
                  </span>
                  <div className="text-4xl mb-4">{pain.emoji}</div>
                  <h3 className="text-lg font-bold mb-3 leading-snug">
                    {pain.title}
                  </h3>
                  <p className="text-muted text-sm leading-relaxed">
                    {pain.desc}
                  </p>
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: 'linear-gradient(90deg, #6c3ef4, #00d4aa)' }}
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Two modes（Private / Shareable） */}
        <section
          aria-labelledby="modes-heading"
          className="py-24 px-6 sm:px-12 bg-[#0D0B24] border-y border-[#1C1A38]"
        >
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2
                id="modes-heading"
                className="text-3xl sm:text-4xl font-bold text-white mb-4"
              >
                {PROOFMARK_COPY.modes.heading}
              </h2>
              <p className="text-[#A8A0D8]">
                {PROOFMARK_COPY.modes.subheading}
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              {/* Private */}
              <div className="bg-[#07061A] border border-[#1C1A38] rounded-3xl p-8 sm:p-10 relative overflow-hidden group hover:border-[#00D4AA]/50 transition-colors">
                <Shield className="w-12 h-12 text-[#00D4AA] mb-6" />
                <h3 className="text-2xl font-bold text-white mb-1">
                  {PROOFMARK_COPY.modes.private.name}
                </h3>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00D4AA] mb-3">
                  {PROOFMARK_COPY.modes.private.tagline}
                </p>
                <p className="text-[#A8A0D8] mb-6 leading-relaxed">
                  {PROOFMARK_COPY.modes.private.description}
                </p>
                <ul className="space-y-3">
                  {PROOFMARK_COPY.modes.private.points.map((p) => (
                    <li
                      key={p}
                      className="flex items-center gap-3 text-sm text-slate-300"
                    >
                      <CheckCircle className="w-5 h-5 text-[#00D4AA]" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Shareable */}
              <div className="bg-[#07061A] border border-[#1C1A38] rounded-3xl p-8 sm:p-10 relative overflow-hidden group hover:border-[#6C3EF4]/50 transition-colors">
                <Share2 className="w-12 h-12 text-[#6C3EF4] mb-6" />
                <h3 className="text-2xl font-bold text-white mb-1">
                  {PROOFMARK_COPY.modes.shareable.name}
                </h3>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#6C3EF4] mb-3">
                  {PROOFMARK_COPY.modes.shareable.tagline}
                </p>
                <p className="text-[#A8A0D8] mb-6 leading-relaxed">
                  {PROOFMARK_COPY.modes.shareable.description}
                </p>
                <ul className="space-y-3">
                  {PROOFMARK_COPY.modes.shareable.points.map((p) => (
                    <li
                      key={p}
                      className="flex items-center gap-3 text-sm text-slate-300"
                    >
                      <CheckCircle className="w-5 h-5 text-[#6C3EF4]" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Engineering Pillars（信頼の裏付け） */}
        <EngineeringPillarsSection />

        {/* Quick try / Upload */}
        <FadeInSection delay={0.1}>
          <div style={{ padding: '64px 20px', background: '#07061A' }}>
            <div
              style={{
                maxWidth: '720px',
                margin: '0 auto',
                textAlign: 'center',
              }}
            >
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold text-primary mb-3"
                style={{
                  background: 'rgba(108,62,244,0.1)',
                  border: '1px solid rgba(108,62,244,0.25)',
                }}
              >
                ⬡ 1分で試す
              </div>
              <h3 className="text-2xl font-black mb-2">
                作品をアップロードして証明を開始
              </h3>
              <p className="text-muted text-sm max-w-lg mx-auto mb-8">
                ハッシュ計算はブラウザ内で完結します。ログイン不要でSHA-256計算とタイムスタンプを即時確認できます。
              </p>
              <div className="max-w-2xl mx-auto">
                <CertificateUpload />
              </div>
            </div>
          </div>
        </FadeInSection>

        {/* Use Cases（誰の・どこで） */}
        <UseCasesSection />

        {/* ─────────────────────────────────
         * Pricing (mini, SSOT-driven)
         * ───────────────────────────────── */}
        <section
          id="pricing"
          aria-labelledby="pricing-heading"
          className="py-24 relative overflow-hidden"
        >
          <GlowOrb color="#6c3ef4" size={500} top="20%" left="45%" opacity={0.07} />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <FadeInSection className="text-center mb-16">
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-4"
                style={{
                  background: 'rgba(255,217,102,0.1)',
                  border: '1px solid rgba(255,217,102,0.25)',
                  color: '#ffd966',
                }}
              >
                Pricing
              </div>
              <h2
                id="pricing-heading"
                className="text-3xl sm:text-4xl font-black mb-4"
              >
                “証明回数”ではなく、納品で使える価値に課金します。
              </h2>
              <p className="text-muted max-w-xl mx-auto">
                Free で月30件まで試せます。本番運用は Creator、チームは Studio で。
              </p>
            </FadeInSection>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-8"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {PRICING_PLANS.filter((p) => p.id !== 'business').map((plan) => {
                const ctaLabel = user ? plan.ctaLabel.authed : plan.ctaLabel.guest;
                const ctaHref = user ? plan.ctaHref.authed : plan.ctaHref.guest;
                const isRecommended = plan.recommended;
                return (
                  <motion.div
                    key={plan.id}
                    className="p-7 rounded-2xl border relative overflow-hidden flex flex-col"
                    style={{
                      background: isRecommended
                        ? 'linear-gradient(135deg, rgba(108,62,244,0.2) 0%, rgba(21,29,47,0.95) 60%)'
                        : 'rgba(21,29,47,0.8)',
                      backdropFilter: 'blur(12px)',
                      borderColor: isRecommended
                        ? 'rgba(108,62,244,0.5)'
                        : 'rgba(42,42,78,0.7)',
                      borderWidth: isRecommended ? 2 : 1,
                      boxShadow: isRecommended
                        ? '0 0 30px rgba(108,62,244,0.18)'
                        : undefined,
                    }}
                    variants={slideInVariants}
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.25 }}
                  >
                    {plan.badge ? (
                      <div
                        className="absolute top-4 right-4 text-xs font-black px-3 py-1 rounded-full"
                        style={{
                          background:
                            'linear-gradient(135deg, #6c3ef4, #00d4aa)',
                          color: '#f0f0fa',
                        }}
                      >
                        {plan.badge}
                      </div>
                    ) : null}
                    <div className="text-xs font-bold text-muted uppercase tracking-widest mb-2">
                      {plan.name}
                    </div>
                    <div className="text-3xl font-black mb-1">
                      {plan.priceLabel}
                      {plan.priceUnit ? (
                        <span className="text-base text-muted font-normal">
                          {plan.priceUnit}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted mb-5">{plan.tagline}</p>
                    <ul className="space-y-2.5 mb-6 flex-1">
                      {plan.features.map((feature) => (
                        <li
                          key={feature.label}
                          className={
                            'flex items-start gap-2 text-sm ' +
                            (feature.state === 'exclude' ? 'opacity-60' : '')
                          }
                        >
                          {feature.state === 'exclude' ? (
                            <Minus className="w-4 h-4 text-[#48456A] shrink-0 mt-0.5" />
                          ) : feature.state === 'planned' ? (
                            <Star className="w-4 h-4 text-[#F0BB38] shrink-0 mt-0.5" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-[#00D4AA] flex-shrink-0 mt-0.5" />
                          )}
                          <span className={feature.state === 'exclude' ? 'text-[#A8A0D8]' : 'text-white'}>
                            {feature.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={ctaHref}
                      className="block w-full px-6 py-3 rounded-full font-bold text-sm text-center mt-auto"
                      style={
                        isRecommended
                          ? {
                            background:
                              'linear-gradient(135deg, #6C3EF4, #8B61FF)',
                            color: '#f0f0fa',
                            boxShadow: '0 0 20px rgba(108,62,244,0.4)',
                          }
                          : {
                            borderColor: 'rgba(108,62,244,0.4)',
                            color: '#6c3ef4',
                            border: '1px solid rgba(108,62,244,0.4)',
                          }
                      }
                    >
                      {ctaLabel}
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>

            <FadeInSection>
              <div className="text-center">
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 text-sm font-bold text-[#00D4AA] hover:text-white transition-colors"
                >
                  すべてのプランを比較する →
                </Link>
              </div>
              <p
                className="text-center text-sm font-bold mt-6"
                style={{ color: FOUNDER_OFFER.highlight }}
              >
                {FOUNDER_OFFER.text}
              </p>
            </FadeInSection>
          </div>
        </section>

        <SupportedToolsSection />

        <div id="learning">
          <LearningSection
            onRegisterClick={() => {
              const el = document.getElementById('waitlist-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        </div>

        <FAQAccordion />

        <DeveloperMessage />

        {/* ─────────────────────────────────
         * Final CTA / Waitlist
         * ───────────────────────────────── */}
        {!user && (
          <section
            id="waitlist-section"
            className="py-24 relative overflow-hidden border-t border-b border-border/50"
            style={{ background: 'rgba(15,22,41,0.5)' }}
          >
            <GlowOrb color="#6c3ef4" size={600} top="50%" left="50%" opacity={0.08} />
            <GlowOrb color="#00d4aa" size={300} top="10%" left="10%" opacity={0.06} />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(108,62,244,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(108,62,244,0.03) 1px, transparent 1px)',
                backgroundSize: '60px 60px',
              }}
            />

            <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <FadeInSection>
                <motion.div
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border mb-8"
                  style={{
                    background: 'rgba(108,62,244,0.12)',
                    borderColor: 'rgba(108,62,244,0.35)',
                    boxShadow: '0 0 16px rgba(108,62,244,0.15)',
                  }}
                  animate={{
                    boxShadow: [
                      '0 0 16px rgba(108,62,244,0.15)',
                      '0 0 28px rgba(108,62,244,0.3)',
                      '0 0 16px rgba(108,62,244,0.15)',
                    ],
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <span className="text-lg">🚀</span>
                  <span className="text-sm font-bold text-primary">
                    β版アーリーアクセス受付中
                  </span>
                </motion.div>

                <h2 className="text-3xl sm:text-4xl font-black mb-4">
                  {PROOFMARK_COPY.finalCta.title}
                </h2>
                <p className="text-muted mb-2">
                  {PROOFMARK_COPY.finalCta.subtitle}
                </p>
                <p className="text-muted mb-8 text-sm">
                  スパムなし・クレカ不要。いつでも解除できます。
                </p>
              </FadeInSection>

              <FadeInSection delay={0.1}>
                <motion.div
                  className="flex flex-wrap justify-center gap-3 mb-8"
                  variants={staggerContainer}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                >
                  {[
                    { emoji: '🚀', text: 'β版優先招待' },
                    { emoji: '🎁', text: 'Creator 3ヶ月無料' },
                  ].map((badge, i) => (
                    <motion.div
                      key={i}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold"
                      style={{
                        background: 'rgba(21,29,47,0.7)',
                        borderColor: 'rgba(42,42,78,0.7)',
                        backdropFilter: 'blur(8px)',
                      }}
                      variants={slideInVariants}
                      whileHover={{
                        scale: 1.05,
                        borderColor: 'rgba(108,62,244,0.5)',
                      }}
                    >
                      <span>{badge.emoji}</span>
                      {badge.text}
                    </motion.div>
                  ))}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'rgba(108, 62, 244, 0.1)',
                      padding: '8px 16px',
                      borderRadius: '100px',
                      border: '1px solid rgba(108, 62, 244, 0.5)',
                      boxShadow: '0 0 12px rgba(108, 62, 244, 0.4)',
                    }}
                  >
                    <img
                      src={founderBadge}
                      alt="Founder Badge"
                      style={{ height: '16px', width: '16px' }}
                    />
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#BC78FF',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Founderバッジ
                    </span>
                  </div>
                </motion.div>
              </FadeInSection>

              <FadeInSection delay={0.15}>
                <form
                  onSubmit={handleWaitlistSubmit}
                  className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
                >
                  <label htmlFor="waitlist-email" className="sr-only">
                    メールアドレス
                  </label>
                  <input
                    id="waitlist-email"
                    type="email"
                    placeholder="your@email.com"
                    value={waitlistEmail}
                    onChange={(e) => setWaitlistEmail(e.target.value)}
                    disabled={isWaitlistSubmitting}
                    className="flex-1 px-6 py-4 rounded-full border transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
                    style={{
                      background: 'rgba(21,29,47,0.85)',
                      borderColor: 'rgba(42,42,78,0.8)',
                      backdropFilter: 'blur(8px)',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(108,62,244,0.7)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(108,62,244,0.15)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(42,42,78,0.8)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    required
                    aria-label="ウェイティングリスト登録用のメールアドレス"
                  />
                  <motion.button
                    type="submit"
                    disabled={isWaitlistSubmitting}
                    className="px-8 py-4 rounded-full text-primary-foreground font-bold flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-70 disabled:cursor-wait"
                    style={{
                      background:
                        'linear-gradient(135deg, #6c3ef4, rgba(108,62,244,0.85))',
                      boxShadow: '0 0 20px rgba(108,62,244,0.4)',
                    }}
                    variants={buttonVariants}
                    initial="rest"
                    whileHover="hover"
                    whileTap="tap"
                  >
                    {isWaitlistSubmitting ? (
                      <>
                        <svg
                          className="animate-spin h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        暗号化通信中...
                      </>
                    ) : (
                      '登録する'
                    )}
                  </motion.button>
                </form>
                <p className="text-xs text-muted flex items-center justify-center gap-2 mt-3">
                  <Lock className="w-4 h-4 text-accent" />
                  メールアドレスはSSL/TLSで保護されます
                </p>
              </FadeInSection>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
