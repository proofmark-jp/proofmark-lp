import { useState } from 'react';
import { ChevronDown, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';
import { PRICING_PLANS } from '@/data/pricingPlans';

/**
 * FAQAccordion (Home 用ショート版)
 * ─────────────────────────────────────────────
 * - 価格表記は data/pricingPlans.ts と完全一致させる。
 * - 「絶対」「100%」「必ず」など断定表現は廃し、Trust Center の誠実な開示と整合させる。
 * - 詳細は /faq に誘導し、ホームでは「不安を増幅しない」最重要4問のみ。
 */

interface FAQItem {
  id: string;
  question: string;
  answer: React.ReactNode;
}

const getPrice = (planId: string) => {
  const plan = PRICING_PLANS.find(p => p.id === planId);
  return plan ? `${plan.priceLabel}${plan.priceUnit}` : '';
};

const faqItems: FAQItem[] = [
  {
    id: 'is-data-safe',
    question: '原画はサーバーに送られますか？',
    answer: (
      <>
        <p>
          Private Proof モードでは、原画はサーバーに送信されません。ハッシュ計算（SHA-256）はあなたのブラウザ内で完結し、ProofMark が受け取るのはハッシュ値とメタデータのみです。
        </p>
        <p className="mt-2">
          Shareable Proof モードを選んだ場合のみ、SNS共有・ポートフォリオ表示用の画像が、Vercelをバイパスして Supabase Storage に直接転送されます。どちらのモードを使っているかはダッシュボードで明示されます。
        </p>
      </>
    ),
  },
  {
    id: 'ai-training-use',
    question: 'アップロードした画像がAIの学習に使われることはありますか？',
    answer:
      'ProofMarkは、お預かりした画像データを生成AIの学習データとして外部提供したり、自社で利用することはありません。Private Proof モードではそもそも画像がサーバーに到達しないため、構造的に学習利用が不可能です。',
  },
  {
    id: 'admin-visibility',
    question: '画像データは運営側に見られませんか？',
    answer:
      'ハッシュ値はユーザーのブラウザ内で計算されるため、Private Proof モードで証明書を発行する場合、運営が画像の内容を知ることはシステム上不可能です。Shareable Proof でクラウド保存される画像は厳格なRLSで保護され、運営スタッフが意図的に非公開画像を閲覧できる導線は実装されていません。',
  },
  {
    id: 'pricing',
    question: '料金プランについて教えてください',
    answer: (
      <>
        <p>
          ProofMarkは「証明回数」ではなく「納品信頼の運用」に基づいた料金体系です。
        </p>
        <ul className="list-disc pl-5 space-y-1 my-4">
          <li>
            <strong>Free（{getPrice('free')}）</strong>: 月30件までのWeb証明（PDF発行は含みません）
          </li>
          <li>
            <strong>Spot（{getPrice('spot')}）</strong>: 単発でのEvidence Pack発行（登録不要）
          </li>
          <li>
            <strong>Creator（{getPrice('creator')}）</strong>: 無制限PDF・Evidence Pack・案件単位整理・NDA表示
          </li>
          <li>
            <strong>Studio（{getPrice('studio')}）</strong>: チーム管理・WORM監査ログ・Chain of Evidence
          </li>
        </ul>
        <p>
          詳細は
          <Link
            href="/pricing"
            style={{ color: '#00D4AA', textDecoration: 'underline' }}
          >
            料金プランページ
          </Link>
          をご確認ください。
        </p>
      </>
    ),
  },
];

export const FAQAccordion = () => {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-black mb-4">よくある質問</h2>
          <p className="text-muted max-w-2xl mx-auto">
            運用前に知っておきたい、最重要の4問。
          </p>
        </div>

        <div className="space-y-3">
          {faqItems.map((item) => (
            <div
              key={item.id}
              className="border border-border rounded-xl overflow-hidden bg-card/50 hover:bg-card/80 transition-colors"
            >
              <button
                onClick={() => setOpenId(openId === item.id ? null : item.id)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-card/50 transition-colors"
                aria-expanded={openId === item.id}
                aria-controls={`faq-${item.id}`}
              >
                <span className="font-bold text-foreground pr-4">
                  {item.question}
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-primary flex-shrink-0 transition-transform duration-300 ${openId === item.id ? 'rotate-180' : ''}`}
                />
              </button>

              {openId === item.id && (
                <div
                  id={`faq-${item.id}`}
                  className="px-6 py-4 border-t border-border bg-secondary/30 animate-in fade-in duration-200"
                >
                  <div className="text-muted leading-relaxed text-sm">
                    {item.answer}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 p-6 rounded-xl bg-primary/10 border border-primary/20">
          <p className="text-sm text-muted text-center">
            その他のご質問は、
            <a
              href="https://x.com/ProofMark_jp"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#6C3EF4', textDecoration: 'underline' }}
            >
              お問い合わせ
            </a>
            までお気軽にどうぞ。
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            href="/faq"
            className="inline-flex items-center gap-2 text-[#00D4AA] hover:text-white font-bold transition-colors"
          >
            詳細なFAQ・法的有効性について確認する{' '}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};
