import React, { useState } from 'react';
import {
  Check,
  Minus,
  Tag,
  Loader2,
  Star,
  Sparkles,
  Zap,
  Crown,
  Users,
  ArrowRight,
} from 'lucide-react';
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
import { startCheckout } from '../lib/checkout';

/* ────────────────────────────────────────────
 * Pricing Page
 * Phase 11.A — ROI Navigation + ¥0 SEO/A11y Fix
 *  - Home / FAQ / Pricing は PRICING_PLANS（SSOT）のみを参照する。
 *  - 価格表示の SEO/A11y バグを修正：
 *      <p className="text-4xl">{plan.priceLabel}</p>
 *    の中で priceLabel が空文字や undefined になるとレンダリングが消失するため、
 *    Free（'¥0'）を含めて全プランで明示的に "数値部" と "通貨記号" を分離して
 *    aria-label を付与する。
 *  - プランカードの直上に ROI ナビゲーション（4ユースケース・マッピング）を追加。
 *    認知負荷5秒以内で「自分はどのプランか」を判断できる導線を構築する。
 * ──────────────────────────────────────────── */

/* ────────────────────────────────────────────
 * Price renderer
 *   "¥0" や "¥1,480" のような文字列を、
 *   currency symbol + amount に分離して描画する。
 *   Free プランの ¥0 が DOM 上に確実に出力されることを保証する。
 * ──────────────────────────────────────────── */
function PriceLabel({ priceLabel, priceUnit }: { priceLabel: string; priceUnit: string }) {
  // 「¥1,480」「¥480」「¥0」「お問い合わせ」のいずれにも耐える
  const m = priceLabel.match(/^([¥$€£])(.+)$/);

  if (!m) {
    // "お問い合わせ" 等の純文字列
    return (
      <span
        className="text-4xl font-extrabold text-white"
        aria-label={priceLabel + (priceUnit ? ` ${priceUnit}` : '')}
        data-testid="price-label"
      >
        {priceLabel}
      </span>
    );
  }

  const [, symbol, amount] = m;
  // ¥0 を含めて確実に描画されるよう、空文字列の混入を排除
  const safeAmount = amount && amount.length > 0 ? amount : '0';

  return (
    <span
      className="inline-flex items-baseline gap-0.5"
      aria-label={`${symbol}${safeAmount}${priceUnit ? ` ${priceUnit}` : ''}`}
      data-testid="price-label"
    >
      <span className="text-2xl font-bold text-white/85 leading-none">{symbol}</span>
      <span className="text-4xl font-extrabold text-white leading-none">
        {safeAmount}
      </span>
      {priceUnit && (
        <span className="ml-1 text-base font-medium text-[#A8A0D8]">{priceUnit}</span>
      )}
    </span>
  );
}

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
    <motion.article
      id={`plan-${plan.id}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.08 }}
      className={`relative flex flex-col bg-[#0D0B24] rounded-2xl p-8 transition-all duration-300 ${cardClass}`}
      aria-labelledby={`plan-${plan.id}-name`}
    >
      {plan.badge && (
        <div className="absolute top-0 right-8 transform -translate-y-1/2">
          <span className="inline-block px-4 py-1.5 rounded-full bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] text-white text-xs font-bold tracking-wider uppercase shadow-lg">
            {plan.badge}
          </span>
        </div>
      )}

      <div className={`mb-8 ${isRecommended ? 'mt-2' : ''}`}>
        <h3
          id={`plan-${plan.id}-name`}
          className="text-xl font-black text-white tracking-wider mb-2 uppercase"
        >
          {plan.name}
        </h3>
        <p className="text-[#A8A0D8] text-sm h-10">{plan.tagline}</p>
        <div className="mt-6 flex items-baseline">
          <PriceLabel priceLabel={plan.priceLabel} priceUnit={plan.priceUnit} />
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
    </motion.article>
  );
}

/* ────────────────────────────────────────────
 * ROI Navigation
 *   ユースケース → プランへの 5秒マッピング。
 *   Spot 4件 = Creator 1ヶ月 という ROI 計算をマイクロコピーで明示。
 * ──────────────────────────────────────────── */
interface RoiNavItem {
  icon: typeof Sparkles;
  label: string;
  plan: string;
  planId: string;
  micro: string;
  accent: string;
  recommended?: boolean;
}

const ROI_NAV: RoiNavItem[] = [
  {
    icon: Sparkles,
    label: 'とりあえず試したい',
    plan: 'Free',
    planId: 'free',
    micro: '月30件まで無料でWeb証明',
    accent: '#A8A0D8',
  },
  {
    icon: Zap,
    label: '1案件だけ重要',
    plan: 'Spot',
    planId: 'spot',
    micro: '登録不要 / Evidence Pack 即発行',
    accent: '#00D4AA',
  },
  {
    icon: Crown,
    label: '月3件以上発行する',
    plan: 'Creator',
    planId: 'creator',
    micro: 'Spot約3件分の価格で月30件の完全証明',
    accent: '#BC78FF',
    recommended: true,
  },
  {
    icon: Users,
    label: '2人以上で運用',
    plan: 'Studio',
    planId: 'studio',
    micro: 'WORM監査ログ + チーム席',
    accent: '#F0BB38',
  },
];

function RoiNavigation() {
  return (
    <section
      aria-label="プラン選択ガイド"
      className="mx-auto max-w-6xl mb-12"
    >
      <div className="text-center mb-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-[#A8A0D8]">
          5-Second ROI
        </span>
        <h2 className="mt-3 text-xl sm:text-2xl font-black text-white">
          あなたに合うプランを、5秒で。
        </h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {ROI_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.planId}
              href={`#plan-${item.planId}`}
              className={`group relative rounded-2xl border bg-[#0D0B24]/85 p-4 backdrop-blur-md transition-all hover:-translate-y-0.5 ${item.recommended
                  ? 'border-[#6C3EF4]/50 shadow-[0_0_18px_rgba(108,62,244,0.18)]'
                  : 'border-[#1C1A38] hover:border-white/20'
                }`}
            >
              {item.recommended && (
                <span className="absolute -top-2 left-4 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
                  おすすめ
                </span>
              )}
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4" style={{ color: item.accent }} />
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: item.accent }}
                >
                  {item.plan}
                </span>
              </div>
              <p className="text-sm font-bold text-white leading-snug mb-1.5">
                {item.label}
              </p>
              <p className="text-[11px] leading-relaxed text-[#A8A0D8]">
                {item.micro}
              </p>
              <div className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-white/60 group-hover:text-white">
                プランを見る <ArrowRight className="h-3 w-3" />
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

export default function Pricing() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [reserving, setReserving] = useState(false);

  const handleCheckout = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) {
      setLocation('/auth?mode=signup&plan=creator');
      return;
    }
    try {
      setReserving(true);
      await startCheckout({ plan: 'creator' });
    } catch (err: any) {
      toast.error('決済画面への遷移に失敗しました', { description: err.message });
      setReserving(false);
    }
  };

  const visiblePlans = PRICING_PLANS.filter((p) => p.id !== 'business');

  return (
    <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] font-sans selection:bg-[#6C3EF4]/30">
      <SEO
        title="料金プラン | ProofMark"
        description={`${PROOFMARK_COPY.brandShort}の料金プラン。Free(¥0/月、月30件)、Spot(¥480/件)、Creator(¥1,480/月)、Studio(¥4,980/月)。Evidence Pack 納品形式・案件単位整理・WORM監査ログまで、納品信頼の運用に必要な機能を段階的に提供します。`}
        url="https://proofmark.jp/pricing"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: 'ProofMark',
          description: 'AI Delivery Trust Infrastructure',
          offers: visiblePlans.map((p) => ({
            '@type': 'Offer',
            name: p.name,
            // SEO 上 ¥0 を確実に伝えるため、Free は "0" を明示
            price:
              p.id === 'free'
                ? '0'
                : (p.priceLabel.match(/[\d,]+/)?.[0] ?? '').replace(/,/g, ''),
            priceCurrency: 'JPY',
            availability: 'https://schema.org/InStock',
          })),
        }}
      />

      <div className="max-w-7xl mx-auto pt-32 pb-24 px-4 sm:px-6 lg:px-8">
        {/* ── Header ───────────────────────── */}
        <div className="text-center mb-12 flex flex-col items-center">
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
            まずは Free で月30件まで試せます。本番運用は{' '}
            <span className="text-white">Creator</span>、
            <br className="hidden md:block" />
            チーム運用は <span className="text-white">Studio</span>、API/SLAが必要な制作会社向けは{' '}
            <span className="text-white">Business</span> へ。
          </motion.p>
        </div>

        {/* ── ROI Navigation（5-Second ROI Map） ── */}
        <RoiNavigation />

        {/* ── Plan Grid ───────────────────── */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-stretch max-w-7xl mx-auto"
          role="list"
        >
          {visiblePlans.map((plan, idx) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              index={idx}
              authed={!!user}
              reserving={reserving}
              onReserveCreator={handleCheckout}
            />
          ))}
        </div>

        {/* ── Fair Use Cap Note ── */}
        <div className="mt-8 max-w-4xl mx-auto px-4 text-center">
          <p className="text-xs leading-relaxed text-[#A8A0D8]/80 bg-white/5 border border-white/10 rounded-xl py-3 px-6 inline-block">
            ※発行枠（Fair Use Cap）について：ProofMarkは高価な商用TSAインフラを全てのユーザーに持続的に提供するため、各プランに月間の適正利用枠を設けています。Creatorプラン以上では、この枠内で正式な証拠ファイル（PDF/ZIP）を発行可能です。
          </p>
        </div>

        {/* ── Footer Cards: Business / Trust ─ */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          <Link href="/business">
            <div className="group rounded-2xl border border-[#1C1A38] bg-[#0D0B24]/80 p-6 transition-all hover:border-[#00D4AA]/30 cursor-pointer">
              <div className="text-xs font-bold tracking-widest uppercase text-[#00D4AA] mb-2">
                Business / API
              </div>
              <p className="text-sm text-[#A8A0D8] leading-relaxed">
                API・Webhook・SLA・商用TSA・DPAが必要な制作会社/出版社/プラットフォーム向け。導入支援・監査証跡まで個別対応します。
              </p>
              <span className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-white group-hover:text-[#00D4AA]">
                法人向けページを開く →
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

        {/* ── Pricing FAQ（重要3問） ── */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h3 className="text-center text-sm font-bold uppercase tracking-[0.24em] text-[#A8A0D8] mb-6">
            Pricing FAQ
          </h3>
          <div className="space-y-3">
            <div className="rounded-xl border border-[#1C1A38] bg-[#0D0B24]/70 p-5">
              <p className="font-bold text-white text-sm mb-1.5">
                Q. Free と Spot と Creator の違いを30秒で
              </p>
              <p className="text-sm text-[#A8A0D8] leading-relaxed">
                Free は「Webリンク形式」での存在証明。月30件まで無料で利用でき、検証ページを口コミやSNSでシェアできます（PDF/ZIP発行は非対応）。Spot はアカウント不要で「1案件だけファイル形式の証拠（Evidence Pack）」が必要な場合の使い切り購入。Creator は、毎月の納品で「PDF証明書やEvidence Pack」を正式な納品物として添えたいプロ向けの完全版プランです。
              </p>
            </div>
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
                Q. 運営が終了したら証明書は無効になりますか？
              </p>
              <p className="text-sm text-[#A8A0D8] leading-relaxed">
                いいえ。発行されるタイムスタンプトークン（TST）はRFC3161の国際標準であり、ProofMarkの存続に依存しません。
                <Link href="/trust-center#s7">
                  <span className="text-[#00D4AA] underline hover:no-underline">
                    Trust Center §7
                  </span>
                </Link>
                に独立検証の手順を、
                <a
                  href="https://github.com/proofmark-jp/verify"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#00D4AA] underline hover:no-underline"
                >
                  公開リポジトリ
                </a>
                に検証スクリプトを公開しています。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
