import { motion } from 'framer-motion';
import { useLocation, useSearch } from 'wouter';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { fadeInVariants, staggerContainer } from '@/lib/animations';
import {
  Briefcase, User, MapPin, Tag, CreditCard, Clock, Package,
  RefreshCcw, Mail, Phone, FileText, ShieldCheck, Info,
  Building2, Lock,
} from 'lucide-react';
import SEO from '@/components/SEO';
import {
  detectDisclosureMode,
  shouldShowField,
  getB2CFallback,
  type DisclosureMode,
} from '@/lib/business-context';

/**
 * /tokushoho — Tokutei Shotorihiki Hou (Specified Commercial Transactions Act).
 *
 * Phase 11.A — B2B/B2C 動的レンダリング
 * ─────────────────────────────────────────────
 *  - B2C（通常アクセス）: 運営者氏名・住所・電話番号は「開示請求ベース」
 *  - B2B（/business 経由 / ?context=business / ?plan=studio|business）:
 *    完全開示モードで、法務・経理が即決できる情報を全表示
 *
 * 切替ロジックは src/lib/business-context.ts に集約（SSOT）。
 *
 * NOTE:
 *  - 個人クリエイターの秘匿性を守りつつ、エンタープライズ調達要件を満たす
 *  - Stripe決済画面の最終拘束力は維持される（補足注記あり）
 */
export default function Tokushoho() {
  const { user, signOut } = useAuth();
  const [location] = useLocation();
  const searchString = useSearch();

  const mode: DisclosureMode = detectDisclosureMode(location, searchString);
  const isB2B = mode === 'B2B_FULL_DISCLOSURE';

  /* ────────────────────────────────────────────
   * 運営者情報（B2B完全開示・B2C非開示の値）
   *   実際の値の正は本ファイル。本番運用前に確実に正しい値であることを確認すること。
   * ──────────────────────────────────────────── */
  const ALL_DETAILS = [
    {
      label: '販売業者',
      icon: <Briefcase className="w-4 h-4" />,
      value: 'ProofMark運営事務局（屋号）',
    },
    {
      label: '運営統括責任者',
      icon: <User className="w-4 h-4" />,
      value: '小栗 慎也（Shinya Oguri）',
    },
    {
      label: '所在地',
      icon: <MapPin className="w-4 h-4" />,
      value: '〒100-0005 東京都千代田区丸の内1-1-1',
    },
    {
      label: 'お問い合わせ',
      icon: <Mail className="w-4 h-4" />,
      value: 'support@proofmark.jp（受付：平日 10:00–18:00 JST）',
    },
    {
      label: '電話番号',
      icon: <Phone className="w-4 h-4" />,
      value: '050-XXXX-XXXX',
    },
    {
      label: '販売価格',
      icon: <Tag className="w-4 h-4" />,
      value:
        'Free: ¥0 / Spot: ¥480（税込・1案件） / Creator: ¥1,480（税込・月額） / Studio: ¥4,980（税込・月額） / Business: 個別見積。最新価格は /pricing に常時掲載。',
    },
    {
      label: '商品代金以外の必要料金',
      icon: <FileText className="w-4 h-4" />,
      value:
        'インターネット接続料・通信料はお客様負担。商用TSAオプション（Business）を選択した場合、TSA署名回数に応じた従量費が発生する場合があります。',
    },
    {
      label: '支払方法',
      icon: <CreditCard className="w-4 h-4" />,
      value: 'クレジットカード決済（Stripe）。Business プランは銀行振込にも対応。',
    },
    {
      label: '支払時期',
      icon: <Clock className="w-4 h-4" />,
      value:
        'Spot: 申込時に都度決済 / Creator・Studio: 申込時に初回決済、以降は毎月の更新日に自動決済 / Business: 個別契約による。',
    },
    {
      label: '商品の引渡時期',
      icon: <Package className="w-4 h-4" />,
      value:
        'デジタルサービスのため決済完了直後より利用可能。Evidence Pack（ZIP）はWeb上から即時ダウンロード可能。',
    },
    {
      label: '解約・キャンセル',
      icon: <RefreshCcw className="w-4 h-4" />,
      value:
        'サブスクリプション（Creator / Studio）はマイページからいつでも解約可能。解約後は次回更新日まで利用可能。Spot（単発購入）は決済確定後の解約は受付不可（ただし Evidence Pack 未取得時はカスタマーサポート経由で個別対応）。',
    },
    {
      label: '返品・返金',
      icon: <RefreshCcw className="w-4 h-4" />,
      value:
        'デジタルコンテンツの性質上、原則として返品・返金は受付しません。ただし、当社責に帰すべきサービス障害により提供を受けられなかった場合、全額または日割り返金の対応を行います。',
    },
    {
      label: '動作環境',
      icon: <Info className="w-4 h-4" />,
      value:
        '最新版のChrome / Edge / Safari / Firefox を推奨。Web Crypto API（SHA-256）が利用可能なブラウザが必要です。',
    },
  ];

  /**
   * モードに応じてフィールドの表示値を決定する。
   * B2B: 全て完全開示。
   * B2C: 一部フィールドは「開示請求ベース」のフォールバックテキストへ置換。
   */
  const details = ALL_DETAILS.map((item) => {
    if (shouldShowField(item.label, mode)) {
      return item;
    }
    const fallback = getB2CFallback(item.label);
    return {
      ...item,
      value: fallback ?? '請求があった場合、書面で開示します。',
      isFallback: true,
    };
  });

  return (
    <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] font-sans selection:bg-[#F0BB38]/30">
      <SEO
        title={
          isB2B
            ? '特定商取引法に基づく表記（法人向け完全開示版） | ProofMark'
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
          {/* ── Header ───────────────────── */}
          <motion.div variants={fadeInVariants} className="mb-12 text-center">
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold mb-4 uppercase tracking-widest ${isB2B
                  ? 'bg-[#00D4AA]/10 border-[#00D4AA]/25 text-[#00D4AA]'
                  : 'bg-[#F0BB38]/10 border-[#F0BB38]/20 text-[#F0BB38]'
                }`}
            >
              {isB2B ? (
                <>
                  <Building2 className="w-3.5 h-3.5" />
                  Enterprise / Full Disclosure
                </>
              ) : (
                <>Commercial Disclosure</>
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
              特定商取引法に基づく表記
              {isB2B && (
                <span className="block mt-2 text-base md:text-lg font-bold text-[#00D4AA]">
                  ── 法人向け完全開示版
                </span>
              )}
            </h1>
            <p className="text-[#A8A0D8] text-sm">
              Legal Information for Paid Services — last reviewed:{' '}
              {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })}
            </p>
          </motion.div>

          {/* ── Mode banner ──────────────── */}
          <motion.div
            variants={fadeInVariants}
            className={`mb-8 rounded-2xl border p-5 backdrop-blur-md ${isB2B
                ? 'border-[#00D4AA]/25 bg-[#00D4AA]/5'
                : 'border-[#1C1A38] bg-[#0D0B24]/70'
              }`}
          >
            {isB2B ? (
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-[#00D4AA] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-white mb-1">
                    法人決済向けに、運営者情報を完全開示しています。
                  </p>
                  <p className="text-xs text-[#A8A0D8] leading-relaxed">
                    法務・経理部門の調達承認に必要な氏名・住所・電話番号を全て表示しています。Studio / Business プラン、または{' '}
                    <code className="px-1.5 py-0.5 rounded bg-white/5 text-[#BC78FF]">
                      /business
                    </code>{' '}
                    経由でのアクセスでは、本表示モードが適用されます。
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-[#A8A0D8] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-white mb-1">
                    個人事業主・個人クリエイターの秘匿性を守る表示モードです。
                  </p>
                  <p className="text-xs text-[#A8A0D8] leading-relaxed">
                    運営者の氏名・住所・電話番号は「開示請求ベース」で運用しています。法令に基づく開示請求があった場合、遅滞なく書面で提供します。法人決済（Studio / Business）をご利用の方は{' '}
                    <a href="/business" className="text-[#00D4AA] underline">
                      /business
                    </a>{' '}
                    から完全開示版をご確認ください。
                  </p>
                </div>
              </div>
            )}
          </motion.div>

          {/* ── Disclosure table ─────────── */}
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
                    <td className="px-6 py-5 text-sm font-bold text-[#F0EFF8]">
                      <span className="inline-flex items-center gap-2">
                        <span className="text-[#F0BB38]">{item.icon}</span>
                        {item.label}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-sm text-[#A8A0D8] leading-relaxed whitespace-pre-line">
                      {item.value}
                      {(item as any).isFallback && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#A8A0D8]/60">
                          <Lock className="w-3 h-3" />
                          B2C 秘匿モード
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          {/* ── Supplementary cards ──────── */}
          <motion.div
            variants={fadeInVariants}
            className="mt-10 grid sm:grid-cols-2 gap-4"
          >
            <div className="p-6 rounded-2xl bg-[#0D0B24] border border-[#1C1A38]">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-[#00D4AA]" />
                <h3 className="text-sm font-bold text-white tracking-widest uppercase">
                  サービス障害時の補償
                </h3>
              </div>
              <p className="text-sm text-[#A8A0D8] leading-relaxed">
                当社の責に帰すべきサービス停止が継続した場合、停止時間に応じて日割り返金または翌月分の利用料減算で補償します。詳細は{' '}
                <a href="/trust-center#s9" className="text-[#00D4AA] underline">
                  Trust Center §9 更新履歴
                </a>{' '}
                に記録します。
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-[#0D0B24] border border-[#1C1A38]">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-4 h-4 text-[#BC78FF]" />
                <h3 className="text-sm font-bold text-white tracking-widest uppercase">
                  個別開示請求について
                </h3>
              </div>
              <p className="text-sm text-[#A8A0D8] leading-relaxed">
                取引相手方からの法令に基づく開示請求があった場合、運営者氏名・住所・電話番号を遅滞なく書面で開示します。請求は{' '}
                <a href="/contact" className="text-[#00D4AA] underline">
                  お問い合わせフォーム
                </a>{' '}
                よりお願いします。
              </p>
            </div>
          </motion.div>

          {/* ── B2B/B2C のもう一方への切替リンク ── */}
          <motion.div
            variants={fadeInVariants}
            className="mt-6 text-center"
          >
            {isB2B ? (
              <a
                href="/tokushoho"
                className="inline-flex items-center gap-2 text-xs font-bold text-[#A8A0D8] hover:text-white transition-colors"
              >
                <Lock className="w-3 h-3" />
                個人向け（B2C 秘匿モード）に切替
              </a>
            ) : (
              <a
                href="/business#tokushoho"
                className="inline-flex items-center gap-2 text-xs font-bold text-[#00D4AA] hover:text-white transition-colors"
              >
                <Building2 className="w-3 h-3" />
                法人決済をご検討の方は完全開示版へ
              </a>
            )}
          </motion.div>

          <motion.p
            variants={fadeInVariants}
            className="mt-10 text-xs text-[#48456A] text-center leading-relaxed"
          >
            本ページの内容は最新の法令・社内運用に応じて随時改定します。最終的な拘束力を持つのは Stripe 決済時点で表示される
            利用規約・特定商取引法表記・プライバシーポリシーです。
          </motion.p>
        </motion.div>
      </main>
    </div>
  );
}
