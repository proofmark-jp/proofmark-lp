/**
 * src/pages/Tokushoho.tsx — 特定商取引法に基づく表記
 *
 * Phase 11.A — B2B / B2C 動的レンダリング
 * ─────────────────────────────────────────────────────────────────
 *  B2C（通常アクセス）  : 氏名・住所・電話番号は「開示請求ベース」で秘匿
 *  B2B（/business 経由 / ?context=business / ?plan=studio|business）:
 *                       完全開示モード。法務・経理が即決できる情報を全表示
 *
 * 変更履歴:
 *  - LAST_REVIEWED を静的定数に変更（動的 new Date() は法的リスクのため廃止）
 *  - 所在地を B2C / B2B で正しく分離（プレースホルダーを除去）
 *  - 電話番号プレースホルダーを除去（B2C: 開示請求ベース / B2B: 要記入）
 *  - 受付時間の約束を削除（個人 SaaS が守れない SLA を約束しない）
 *  - 消費税・インボイス開示を追加（免税事業者の明示）
 *  - 問い合わせにフォーム URL を追加
 *
 * 本番運用前に必ず確認する箇所:
 *  [FILL] とコメントされた箇所を実際の値に置き換えること
 */

import { motion } from 'framer-motion';
import { useLocation, useSearch } from 'wouter';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { fadeInVariants, staggerContainer } from '@/lib/animations';
import {
  Briefcase, User, MapPin, Tag, CreditCard, Clock, Package,
  RefreshCcw, Mail, Phone, FileText, ShieldCheck, Info,
  Building2, Lock, Receipt,
} from 'lucide-react';
import SEO from '@/components/SEO';
import {
  detectDisclosureMode,
  shouldShowField,
  getB2CFallback,
  type DisclosureMode,
} from '@/lib/business-context';

/* ────────────────────────────────────────────────────────────────
 * 最終確認日 — コンテンツを変更したときに手動で更新する。
 * new Date() による動的生成は禁止（実態と乖離した日付表示になるため）。
 * ──────────────────────────────────────────────────────────────── */
const LAST_REVIEWED = '2026年5月';

/* ────────────────────────────────────────────────────────────────
 * 運営者情報
 * B2C モードでは shouldShowField() / getB2CFallback() で自動的に秘匿される項目があります。
 * ──────────────────────────────────────────────────────────────── */

export default function Tokushoho() {
  const { user, signOut } = useAuth();
  const [location] = useLocation();
  const searchString = useSearch();

  const mode: DisclosureMode = detectDisclosureMode(location, searchString);
  const isB2B = mode === 'B2B_FULL_DISCLOSURE';

  /* ──────────────────────────────────────────────────────────────
   * 開示テーブルの定義
   * value は B2B 完全開示値。B2C では shouldShowField / getB2CFallback
   * によって一部フィールドが秘匿テキストに置き換えられる。
   * ────────────────────────────────────────────────────────────── */
  const ALL_DETAILS = [
    /* ── 運営者 ── */
    {
      label: '販売業者',
      icon: <Briefcase className="w-4 h-4" />,
      value: 'ProofMark（運営者：小栗 慎也）',
    },
    {
      label: '運営統括責任者',
      icon: <User className="w-4 h-4" />,
      value: '小栗 慎也（Shinya Oguri）',
    },

    /* ── 所在地 ── */
    {
      label: '所在地',
      icon: <MapPin className="w-4 h-4" />,
      value: '神奈川県川崎市\n（番地以降はご請求に基づき遅滞なく開示いたします）',
      _skipFallback: true,
    },

    /* ── 連絡先 ── */
    {
      label: 'お問い合わせ',
      icon: <Mail className="w-4 h-4" />,
      value: (
        <>
          お問い合わせフォーム:{' '}
          <a href="https://proofmark.jp/contact" className="text-[#00D4AA] hover:underline">
            https://proofmark.jp/contact
          </a>
          <br />
          メール: <span className="break-all">support@proofmark.jp</span>
          <br />
          ※順次ご返信いたしますが、内容によってはお時間をいただく場合がございます。
        </>
      ),
    },
    {
      label: '電話番号',
      icon: <Phone className="w-4 h-4" />,
      value: 'ご請求に基づき遅滞なく開示いたします。日常のお問い合わせはフォームのご利用を推奨します。',
      _skipFallback: true,
    },

    /* ── 価格 ── */
    {
      label: '販売価格',
      icon: <Tag className="w-4 h-4" />,
      value:
        'Free（無料）/ Spot: ¥480（税込・1件）/ Creator: ¥1,480（税込・月額）/ Studio: ¥4,980（税込・月額）/ Business: 個別見積。\n' +
        '最新価格は /pricing に常時掲載しています。',
    },
    {
      label: '商品代金以外の必要料金',
      icon: <FileText className="w-4 h-4" />,
      value:
        'インターネット接続料・通信料はお客様のご負担となります。\n' +
        'Business プランで商用 TSA オプションを選択した場合、TSA 署名回数に応じた従量費が発生することがあります（詳細は個別見積時に明示します）。',
    },

    /* ── 税・インボイス ── */
    {
      label: '消費税・インボイスについて',
      icon: <Receipt className="w-4 h-4" />,
      value:
        '当社は現在、消費税法上の免税事業者です。適格請求書発行事業者（インボイス）の登録は行っておりません。\n' +
        '法人契約（Studio / Business）でインボイスが必要な場合は、お問い合わせフォームよりご相談ください。',
    },

    /* ── 決済 ── */
    {
      label: '支払方法',
      icon: <CreditCard className="w-4 h-4" />,
      value: 'クレジットカード決済（Stripe）',
    },
    {
      label: '支払時期',
      icon: <Clock className="w-4 h-4" />,
      value:
        'Spot: 申込時に都度決済\n' +
        'Creator・Studio: 申込時に初回決済、以降は毎月の更新日に自動決済\n' +
        'Business: 個別契約による',
    },

    /* ── 提供・解約・返金 ── */
    {
      label: '商品の引渡時期',
      icon: <Package className="w-4 h-4" />,
      value:
        'デジタルサービスのため、決済完了直後より利用可能です。\n' +
        'Evidence Pack（ZIP）は Web 上から即時ダウンロードできます。',
    },
    {
      label: '解約・キャンセル',
      icon: <RefreshCcw className="w-4 h-4" />,
      value:
        'サブスクリプション（Creator / Studio）はダッシュボードのプラン管理からいつでも解約できます。解約後は次回更新日まで引き続き利用可能です。日割り返金は行いません。\n' +
        'Spot（単発購入）は決済確定後の解約は承りかねます。ただし Evidence Pack 未取得の場合はお問い合わせフォームより個別にご相談ください。',
    },
    {
      label: '返品・返金',
      icon: <RefreshCcw className="w-4 h-4" />,
      value:
        'デジタルコンテンツの性質上、原則として返品・返金は承りかねます。\n' +
        'デジタル署名およびタイムスタンプが発行された Evidence Pack については、その性質上、内容の如何に関わらず返金は致しかねます。これは、発行された証跡の客観的妥当性を担保するための措置です。\n' +
        '当社の責に帰すべき重大なサービス障害が発生した場合、利用規約およびTrust Centerの定めに従い、利用期間の延長または利用料の減算等の補償を個別に対応いたします。',
    },

    /* ── 動作環境 ── */
    {
      label: '動作環境',
      icon: <Info className="w-4 h-4" />,
      value:
        '最新版の Chrome / Edge / Safari / Firefox を推奨します。\n' +
        'Web Crypto API（SHA-256）が利用可能なブラウザが必要です。Internet Explorer は非対応です。',
    },
  ] satisfies Array<{
    label: string;
    icon: React.ReactNode;
    value: React.ReactNode;
    _skipFallback?: boolean;
    _b2cSuffix?: string;
    _b2cFallback?: React.ReactNode;
  }>;

  /* ──────────────────────────────────────────────────────────────
   * B2C モード時に秘匿フィールドをフォールバックテキストへ置換
   * ────────────────────────────────────────────────────────────── */
  const details = ALL_DETAILS.map((item) => {
    // _skipFallback フラグがある行は shouldShowField をスキップ
    if ((item as any)._skipFallback) {
      return {
        ...item,
        displayValue:
          item.value +
          ((item as any)._b2cSuffix ? '\n' + (item as any)._b2cSuffix : ''),
        isFallback: false,
      };
    }

    if (shouldShowField(item.label, mode)) {
      return { ...item, displayValue: item.value, isFallback: false };
    }

    const fallback = getB2CFallback(item.label);
    return {
      ...item,
      displayValue: fallback ?? '請求があった場合、遅滞なく開示いたします。',
      isFallback: true,
    };
  });

  const staggerContainer = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const fadeInVariants = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };

  return (
    <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] font-sans selection:bg-[#F0BB38]/30">
      <SEO
        title={
          isB2B
            ? '特定商取引法に基づく表記（法人向け表示） | ProofMark'
            : '特定商取引法に基づく表記 | ProofMark'
        }
        description="ProofMarkの特定商取引法に基づく表記。販売者情報、価格、支払、引渡時期、解約・返金ポリシーを明記しています。"
        url="https://proofmark.jp/tokushoho"
      />
      <Navbar user={user} signOut={signOut} />

      <main className="relative pt-32 pb-24 px-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-[#F0BB38]/10 to-transparent pointer-events-none" />

        <motion.div
          className="max-w-4xl mx-auto relative z-10"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={fadeInVariants} className="mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
              特定商取引法に基づく表記
              {isB2B && (
                <span className="block mt-2 text-base md:text-lg font-bold text-[#00D4AA]">
                  ── 法人向け表示
                </span>
              )}
            </h1>
            <p className="text-[#A8A0D8] text-sm">
              Legal Information for Paid Services — last reviewed: {LAST_REVIEWED}
            </p>
          </motion.div>

          <motion.div
            variants={fadeInVariants}
            className={`mb-8 rounded-2xl border p-5 backdrop-blur-md ${isB2B
                ? 'border-[#00D4AA]/25 bg-[#00D4AA]/5'
                : 'border-[#1C1A38] bg-[#0D0B24]/70'
              }`}
          >
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-[#A8A0D8] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-white mb-1">
                  運営者情報の取扱いについて
                </p>
                <p className="text-xs text-[#A8A0D8] leading-relaxed">
                  当サービスは個人による運営のため、プライバシー保護の観点から住所および電話番号の一部を非公開としています。法令に基づき開示請求があった場合、遅延なく情報を開示いたします。ご請求の際は、お問い合わせフォームよりご連絡ください。
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            variants={fadeInVariants}
            className="overflow-hidden rounded-3xl border border-[#2a2a4e] bg-[#15132D]/50 backdrop-blur-xl"
          >
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#2a2a4e]">
                  <th className="px-6 py-5 text-sm font-bold text-[#A8A0D8] bg-[#1A1200]/20 w-1/3 md:w-1/4">
                    項目
                  </th>
                  <th className="px-6 py-5 text-sm font-bold text-[#F0EFF8] bg-[#1A1200]/10">
                    内容
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a4e]">
                {details.map((item) => (
                  <tr
                    key={item.label}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-6 py-5 text-sm font-bold text-[#F0EFF8] align-top">
                      <span className="inline-flex items-center gap-2">
                        <span className="text-[#F0BB38]">{item.icon}</span>
                        {item.label}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-sm text-[#A8A0D8] leading-relaxed whitespace-pre-line">
                      {item.displayValue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          {/* ── 補足カード ── */}
          <motion.div
            variants={fadeInVariants}
            className="mt-10 grid sm:grid-cols-2 gap-4"
          >
            {/* サービス障害補償 */}
            <div className="p-6 rounded-2xl bg-[#0D0B24] border border-[#1C1A38]">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-[#00D4AA]" />
                <h3 className="text-sm font-bold text-white tracking-widest uppercase">
                  サービス障害時の補償
                </h3>
              </div>
              <p className="text-sm text-[#A8A0D8] leading-relaxed">
                当社の責に帰すべき重大なサービス障害が発生した場合、利用規約およびTrust Centerの定めに従い、利用期間の延長または利用料の減算等の補償を個別に対応いたします。
              </p>
            </div>

            {/* 個別開示請求 */}
            <div className="p-6 rounded-2xl bg-[#0D0B24] border border-[#1C1A38]">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-4 h-4 text-[#BC78FF]" />
                <h3 className="text-sm font-bold text-white tracking-widest uppercase">
                  個別開示請求について
                </h3>
              </div>
              <p className="text-sm text-[#A8A0D8] leading-relaxed">
                法令に基づく開示請求（運営者氏名・住所・電話番号）があった場合、遅滞なく開示いたします。請求は{' '}
                <a href="/contact" className="text-[#00D4AA] underline">
                  お問い合わせフォーム
                </a>{' '}
                よりお願いします。
              </p>
            </div>

            {/* 消費税・インボイス */}
            <div className="p-6 rounded-2xl bg-[#0D0B24] border border-[#1C1A38] sm:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <Receipt className="w-4 h-4 text-[#F0BB38]" />
                <h3 className="text-sm font-bold text-white tracking-widest uppercase">
                  消費税・インボイス登録について
                </h3>
              </div>
              <p className="text-sm text-[#A8A0D8] leading-relaxed">
                当サービスは現在、消費税法上の<strong className="text-white">免税事業者</strong>
                として運営しています。適格請求書発行事業者（インボイス）の登録は行っておらず、
                適格請求書の発行はできません。法人・個人事業主としてご利用の方で仕入税額控除が必要な場合は、
                事前に{' '}
                <a href="/contact" className="text-[#00D4AA] underline">
                  お問い合わせフォーム
                </a>{' '}
                よりご相談ください。
              </p>
            </div>
          </motion.div>

          {/* ── B2B / B2C 切替リンク ── */}
          <motion.div variants={fadeInVariants} className="mt-6 text-center">
            {isB2B ? (
              <a
                href="/tokushoho"
                className="inline-flex items-center gap-2 text-xs font-bold text-[#A8A0D8] hover:text-white transition-colors"
              >
                <Lock className="w-3 h-3" />
                標準表示に戻す
              </a>
            ) : (
              <div className="flex flex-col items-center sm:items-end">
                <span className="text-xs text-[#A8A0D8] mb-1.5 font-medium tracking-wide">
                  法人決済をご検討の方はこちら
                </span>
                <a
                  href="/tokushoho?context=business"
                  className="inline-flex items-center gap-2 text-xs font-bold text-[#00D4AA] hover:text-white transition-colors"
                >
                  <Building2 className="w-3 h-3" />
                  法人向け表示を見る
                </a>
              </div>
            )}
          </motion.div>

          <motion.p
            variants={fadeInVariants}
            className="mt-10 text-xs text-[#48456A] text-center leading-relaxed"
          >
            本ページの内容は法令・社内運用の変更に応じて随時改定します。
            最終的な拘束力を持つのは Stripe 決済時点で表示される
            利用規約・特定商取引法表記・プライバシーポリシーです。
          </motion.p>
        </motion.div>
      </main>
    </div>
  );
}
