import React, { useState } from 'react';
import { Check, Minus, Tag, Loader2, Star } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import SEO from '../components/SEO';
import { toast } from 'sonner';
import {
  PRICING_PLANS,
  FOUNDER_OFFER,
  type PricingPlan,
} from '../data/pricingPlans';
import { PROOFMARK_COPY } from '../lib/proofmark-copy';

/* ────────────────────────────────────────────
 * Pricing Page
 *  - Home / FAQ / Pricing は PRICING_PLANS（SSOT）のみを参照する。
 *  - Business / API は別カードに分離し、メイン4枚の比較を綺麗にする。
 * ──────────────────────────────────────────── */

function FeatureRow({
  label,
  state,
  highlight,
}: PricingPlan['features'][number]) {
  if (state === 'exclude') {
    return (
      <li className="flex items-start gap-3 text-sm opacity-60">
        <Minus className="w-5 h-5 text-[#48456A] shrink-0" />
        <span className="text-[#A8A0D8]">{label}</span>
      </li>
    );
  }

  if (state === 'planned') {
    return (
      <li className="flex items-start gap-3 text-sm">
        <Star className="w-5 h-5 text-[#F0BB38] shrink-0" />
        <span className="text-[#F0EFF8]">
          {label}{' '}
          <span className="text-[#F0BB38]/80 text-[11px]">(対応予定)</span>
        </span>
      </li>
    );
  }

  const accent =
    highlight === 'accent'
      ? 'text-[#00D4AA]'
      : highlight === 'gold'
        ? 'text-[#F0BB38]'
        : highlight === 'primary'
          ? 'text-[#BC78FF]'
          : 'text-[#00D4AA]';

  return (
    <li className="flex items-start gap-3 text-sm">
      <Check className={`w-5 h-5 shrink-0 ${accent}`} />
      <span className="text-white">{label}</span>
    </li>
  );
}

function PlanCard({
  plan,
  index,
  authed,
  reserving,
  onReserveCreator,
}: {
  plan: PricingPlan;
  index: number;
  authed: boolean;
  reserving: boolean;
  onReserveCreator: (e: React.MouseEvent) => void;
}) {
  const ctaLabel = authed ? plan.ctaLabel.authed : plan.ctaLabel.guest;
  const ctaHref = authed ? plan.ctaHref.authed : plan.ctaHref.guest;
  const isRecommended = plan.recommended;

  const cardClass = isRecommended
    ? 'border-2 border-[#6C3EF4] shadow-[0_0_24px_rgba(108,62,244,0.3)] md:-translate-y-3'
    : 'border border-[#1C1A38] hover:border-[#6C3EF4]/30';

  const buttonClass = isRecommended
    ? 'bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] text-white hover:scale-[1.02] shadow-[0_0_20px_rgba(108,62,244,0.4)]'
    : plan.id === 'spot'
      ? 'bg-[#00D4AA] text-[#07061A] hover:bg-[#00ebd9] shadow-[0_0_15px_rgba(0,212,170,0.3)]'
      : 'border border-[#1C1A38] bg-[#151332]/50 text-white hover:bg-[#1C1A38]';

  const handleCtaClick = (e: React.MouseEvent) => {
    if (plan.id === 'creator' && authed) onReserveCreator(e);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.08 }}
      className={`relative flex flex-col bg-[#0D0B24] rounded-2xl p-8 transition-all duration-300 ${cardClass}`}
    >
      {plan.badge && (
        <div className="absolute top-0 right-8 transform -translate-y-1/2">
          <span className="inline-block px-4 py-1.5 rounded-full bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] text-white text-xs font-bold tracking-wider uppercase shadow-lg">
            {plan.badge}
          </span>
        </div>
      )}

      <div className={`mb-8 ${isRecommended ? 'mt-2' : ''}`}>
        <h3 className="text-xl font-black text-white tracking-wider mb-2 uppercase">
          {plan.name}
        </h3>
        <p className="text-[#A8A0D8] text-sm h-10">{plan.tagline}</p>
        <div className="mt-6 flex items-baseline">
          <span className="text-4xl font-extrabold text-white">
            {plan.priceLabel}
          </span>
          {plan.priceUnit && (
            <span className="text-[#A8A0D8] ml-2 font-medium">
              {plan.priceUnit}
            </span>
          )}
        </div>
        <p className="mt-3 text-xs text-[#A8A0D8]/80">対象: {plan.audience}</p>
      </div>

      <ul className="mb-10 space-y-4 flex-1">
        {plan.features.map((feature) => (
          <FeatureRow key={feature.label} {...feature} />
        ))}
      </ul>

      {plan.id === 'creator' && authed ? (
        <button
          onClick={handleCtaClick}
          disabled={reserving}
          className={`w-full py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${buttonClass}`}
        >
          {reserving ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {reserving ? '予約処理中...' : ctaLabel}
        </button>
      ) : (
        <Link href={ctaHref}>
          <button
            className={`w-full py-3.5 rounded-xl font-bold transition-all ${buttonClass}`}
          >
            {ctaLabel}
          </button>
        </Link>
      )}
    </motion.div>
  );
}

export default function Pricing() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [reserving, setReserving] = useState(false);

  const handleReserveCreator = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) {
      setLocation('/auth?mode=signup&plan=creator');
      return;
    }

    if (
      window.confirm(
        'Creatorプラン3ヶ月無料 + 創設者バッジを予約しますか？\n※現在料金は発生しません。',
      )
    ) {
      try {
        setReserving(true);
        const { error: authError } = await supabase.auth.updateUser({
          data: { is_founder: true },
        });
        if (authError) throw authError;
        await supabase
          .from('profiles')
          .update({ is_founder: true })
          .eq('id', user.id);

        toast.success('先行特典の予約が完了しました！', {
          description: '創設者バッジがアカウントに付与されました。',
        });
        setTimeout(() => window.location.reload(), 1500);
      } catch (err: any) {
        toast.error('エラーが発生しました', { description: err.message });
      } finally {
        setReserving(false);
      }
    }
  };

  const visiblePlans = PRICING_PLANS.filter((p) => p.id !== 'business');

  return (
    <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] font-sans selection:bg-[#6C3EF4]/30">
      <SEO
        title="料金プラン | ProofMark"
        description={`${PROOFMARK_COPY.brandShort}の料金プラン。Free(月30件)、Spot(¥480/件)、Creator(¥1,480/月)、Studio(¥4,980/月)。Evidence Pack 納品形式・案件単位整理・WORM監査ログまで、納品信頼の運用に必要な機能を段階的に提供します。`}
        url="https://proofmark.jp/pricing"
      />
      <div className="max-w-7xl mx-auto pt-32 pb-24 px-4 sm:px-6 lg:px-8">
        {/* ── Header ───────────────────────── */}
        <div className="text-center mb-16 flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-[#00D4AA] text-xs sm:text-sm font-bold tracking-widest uppercase mb-6"
          >
            <Tag className="w-4 h-4" />
            PRICING
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight mb-6 leading-tight"
          >
            “証明回数”ではなく、<br className="sm:hidden" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00D4AA] to-[#BC78FF]">
              納品で使える価値
            </span>
            に課金します。
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-[#A8A0D8] text-base sm:text-lg max-w-2xl mx-auto leading-relaxed"
          >
            まずはFreeで月30件まで試せます。本番運用は<span className="text-white">Creator</span>、
            <br className="hidden md:block" />
            チーム運用は<span className="text-white">Studio</span>、API/SLAが必要な制作会社向けは<span className="text-white">Business</span>へ。
          </motion.p>
        </div>

        {/* ── Plan Grid ───────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-stretch max-w-7xl mx-auto">
          {visiblePlans.map((plan, idx) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              index={idx}
              authed={!!user}
              reserving={reserving}
              onReserveCreator={handleReserveCreator}
            />
          ))}
        </div>

        {/* ── Footer Cards: Business / Trust ─ */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          <Link href="/contact">
            <div className="group rounded-2xl border border-[#1C1A38] bg-[#0D0B24]/80 p-6 transition-all hover:border-[#00D4AA]/30 cursor-pointer">
              <div className="text-xs font-bold tracking-widest uppercase text-[#00D4AA] mb-2">
                Business / API
              </div>
              <p className="text-sm text-[#A8A0D8] leading-relaxed">
                API・Webhook・SLA・商用TSA・DPAが必要な制作会社/出版社/プラットフォーム向け。導入支援・監査証跡まで個別対応します。
              </p>
              <span className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-white group-hover:text-[#00D4AA]">
                相談する →
              </span>
            </div>
          </Link>
          <Link href="/trust-center#s4">
            <div className="group rounded-2xl border border-[#1C1A38] bg-[#0D0B24]/80 p-6 transition-all hover:border-[#6C3EF4]/30 cursor-pointer">
              <div className="text-xs font-bold tracking-widest uppercase text-[#BC78FF] mb-2">
                Trust & TSA Status
              </div>
              <p className="text-sm text-[#A8A0D8] leading-relaxed">
                現在運用中のTSA構成・最終更新日・商用TSAへの切替条件は Trust Center に常時公開しています。
              </p>
              <span className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-white group-hover:text-[#BC78FF]">
                Trust Center を開く →
              </span>
            </div>
          </Link>
        </div>

        {/* ── Founder Offer ──────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-12 text-center"
        >
          <p
            className="text-sm font-bold inline-block px-6 py-3 rounded-xl border"
            style={{
              color: FOUNDER_OFFER.highlight,
              background: 'rgba(188,120,255,0.08)',
              borderColor: 'rgba(188,120,255,0.25)',
            }}
          >
            {FOUNDER_OFFER.text}
          </p>
        </motion.div>

        {/* ── FAQ短答（Pricingに重要な疑問だけ） ── */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h3 className="text-center text-sm font-bold uppercase tracking-[0.24em] text-[#A8A0D8] mb-6">
            Pricing FAQ
          </h3>
          <div className="space-y-3">
            <div className="rounded-xl border border-[#1C1A38] bg-[#0D0B24]/70 p-5">
              <p className="font-bold text-white text-sm mb-1.5">
                Q. なぜ Creator は ¥1,480 ですか？
              </p>
              <p className="text-sm text-[#A8A0D8] leading-relaxed">
                ProofMarkは「節約ツール」ではなく「信頼補助ツール」だからです。重要な証拠インフラを安すぎる価格で提供すると、逆に「本当に仕事で使って大丈夫なのか」という不信を生みます。本ページのCreatorは、無制限PDF・Evidence Pack・案件単位整理・NDA表示モードまで含む“納品で使える完全形”を価格に正直に反映しています。
              </p>
            </div>
            <div className="rounded-xl border border-[#1C1A38] bg-[#0D0B24]/70 p-5">
              <p className="font-bold text-white text-sm mb-1.5">
                Q. 月額は嫌だが、特定の案件だけ使いたい
              </p>
              <p className="text-sm text-[#A8A0D8] leading-relaxed">
                その場合は{' '}
                <strong className="text-[#00D4AA]">
                  Spot {PRICING_PLANS.find((p) => p.id === 'spot')?.priceLabel}/件
                </strong>{' '}
                をお使いください。アカウント登録不要で、1案件分の Evidence Pack が即時発行されます。
              </p>
            </div>
            <div className="rounded-xl border border-[#1C1A38] bg-[#0D0B24]/70 p-5">
              <p className="font-bold text-white text-sm mb-1.5">
                Q. 運営が終了したら証明書は無効になりますか？
              </p>
              <p className="text-sm text-[#A8A0D8] leading-relaxed">
                いいえ。発行されるタイムスタンプトークン（TST）はRFC3161の国際標準であり、ProofMarkの存続に依存しません。
                <Link href="/trust-center#s7">
                  <span className="text-[#00D4AA] underline hover:no-underline">Trust Center §7</span>
                </Link>
                に独立検証の手順を、<a href="https://github.com/proofmark-jp/verify" target="_blank" rel="noopener noreferrer" className="text-[#00D4AA] underline hover:no-underline">公開リポジトリ</a>に検証スクリプトを公開しています。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
