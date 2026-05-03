import { motion } from 'framer-motion';
import { Link } from 'wouter';
import {
  Building2,
  ShieldCheck,
  FileText,
  Workflow,
  Users,
  Mail,
  ArrowRight,
  Github,
  Lock,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';
import SEO from '@/components/SEO';
import VendorLockInFreeSection from '@/components/VendorLockInFreeSection';

/**
 * /business — B2B Stealth Route
 * ─────────────────────────────────────────────
 * Phase 11.A 新規追加。
 *
 * 目的：
 *  - 法人決済の調達承認を「迷わせない」専用ランディング。
 *  - 法務・経理・情報システム部門が必要とする情報を、1ページに集約。
 *  - /business 経由で /tokushoho にアクセスすると完全開示モードになるよう、
 *    business-context.ts のルーティング判定と整合する。
 *
 * 設計：
 *  - 個人クリエイター向けのトーンを排除し、エンタープライズの語彙で書き直す。
 *  - 「正直さ」と「Vendor Lock-in Free」をヘッドラインに昇格。
 *  - SLA / DPA / 監査 / API / 商用TSA を一覧化。
 *  - The Vault 美学（ダーク・余白・控えめなアクセント）を完全踏襲。
 */
export default function Business() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] font-sans selection:bg-[#00D4AA]/30">
      <SEO
        title="法人向けプラン | ProofMark Business / API"
        description="ProofMark の法人向けプラン。商用TSA・SLA・DPA・API・監査証跡・WORM 設計に対応。法務/経理が承認しやすい完全開示モードで運用情報を提供します。"
        url="https://proofmark.jp/business"
      />
      <Navbar user={user} signOut={signOut} />

      {/* ── Hero ──────────────────────────────── */}
      <section className="relative overflow-hidden pt-32 pb-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,212,170,0.10),transparent_55%)]" />

        <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-[#00D4AA]/25 bg-[#00D4AA]/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-[#00D4AA]"
          >
            <Building2 className="h-4 w-4" />
            For Enterprise
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-6 text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.08]"
          >
            法務・経理が、迷わず決済できる
            <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00D4AA] to-[#BC78FF]">
              トラスト基盤
            </span>
            。
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-[#A8A0D8]"
          >
            ProofMark Business / API は、商用TSA・SLA・DPA・監査ログ・API・WORM設計を備えた
            法人向けプランです。運営者情報は完全開示モードで提示し、調達フローを一切ブロックしません。
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-3"
          >
            <a
              href="mailto:support@proofmark.jp?subject=Business%20%E3%83%97%E3%83%A9%E3%83%B3%E3%81%AE%E3%81%94%E7%9B%B8%E8%AB%87"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] px-7 py-3.5 text-sm font-bold text-white shadow-[0_0_24px_rgba(108,62,244,0.45)] transition-transform hover:scale-[1.02]"
            >
              <Mail className="h-4 w-4" />
              法人向けに相談する
            </a>
            <Link href="/tokushoho?context=business">
              <button className="inline-flex items-center gap-2 rounded-full border border-[#00D4AA]/30 bg-[#00D4AA]/5 px-7 py-3.5 text-sm font-bold text-[#00D4AA] transition-all hover:border-[#00D4AA] hover:bg-[#00D4AA]/15 hover:text-white">
                完全開示版の特商法を見る
                <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="mt-6 text-xs text-[#A8A0D8]/70"
          >
            ※ 本ページからの遷移は、特商法表記が法人決済向けの完全開示モードで表示されます。
          </motion.p>
        </div>
      </section>

      {/* ── B2B 4つのコア要件 ───────────────── */}
      <section
        aria-labelledby="b2b-requirements"
        className="border-y border-[#1C1A38] bg-[#0B0A24] py-20"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-[#A8A0D8]">
              Procurement Checklist
            </span>
            <h2
              id="b2b-requirements"
              className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl"
            >
              法人調達で必要な要件を、すべて。
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: ShieldCheck,
                title: '商用TSA / SLA',
                desc: 'GlobalSign / DigiCert / セイコーソリューションズ等の商用 RFC3161 TSA への切替対応。SLA は個別契約。',
              },
              {
                icon: FileText,
                title: 'DPA / 法務対応',
                desc: 'Data Processing Agreement、秘密保持契約、社内規程整合のためのドキュメントを個別提供。',
              },
              {
                icon: Workflow,
                title: 'API / Webhook',
                desc: '社内ワークフローへの組込。Evidence Pack の自動発行・検証・保管 API を提供。',
              },
              {
                icon: Users,
                title: '監査ログ / WORM',
                desc: '改ざん不能な追記型ログ。誰がいつ何を発行・閲覧したかを完全記録。',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="rounded-2xl border border-[#1C1A38] bg-[#0D0B24]/85 p-6 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-[#00D4AA]/35"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-[#00D4AA]/20 bg-[#00D4AA]/5">
                    <Icon className="h-5 w-5 text-[#00D4AA]" />
                  </div>
                  <h3 className="mb-2 text-base font-bold tracking-tight text-white">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-[#A8A0D8]">
                    {item.desc}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Vendor Lock-in Free（B2Bの核訴求） ─ */}
      <VendorLockInFreeSection />

      {/* ── 法務・経理が即決できる情報導線 ──── */}
      <section
        id="tokushoho"
        aria-labelledby="b2b-disclosure"
        className="bg-[#07061A] py-24"
      >
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-[#A8A0D8]">
              Compliance Documents
            </span>
            <h2
              id="b2b-disclosure"
              className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl"
            >
              承認に必要な情報は、すべて公開しています。
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[#A8A0D8]">
              個人事業主の秘匿性を守る B2C 表示と、法人決済を通すための完全開示表示を、ルートで明確に分けています。本ページから遷移すれば、調達担当者は完全開示版を受け取れます。
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
            <Link href="/tokushoho?context=business">
              <article className="group h-full cursor-pointer rounded-2xl border border-[#00D4AA]/25 bg-[#00D4AA]/5 p-6 transition-all hover:-translate-y-0.5 hover:border-[#00D4AA]/55">
                <div className="mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#00D4AA]" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#00D4AA]">
                    Full Disclosure
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">
                  特定商取引法に基づく表記（完全開示版）
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#A8A0D8]">
                  運営者氏名・住所・電話番号を全て表示。法人決済の調達承認に直接使えます。
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#00D4AA] transition-colors group-hover:text-white">
                  開く
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </article>
            </Link>

            <Link href="/trust-center">
              <article className="group h-full cursor-pointer rounded-2xl border border-[#1C1A38] bg-[#0D0B24]/85 p-6 transition-all hover:-translate-y-0.5 hover:border-[#6C3EF4]/45">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#BC78FF]" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#BC78FF]">
                    Technical Whitepaper
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">
                  Trust Center（技術仕様の完全開示）
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#A8A0D8]">
                  脅威モデル、TSA選定、データフロー、第三者検証手順までを全文公開。情シス審査に直結します。
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#BC78FF] transition-colors group-hover:text-white">
                  開く
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </article>
            </Link>
          </div>

          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-[#1C1A38] bg-[#0D0B24]/70 p-5">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#A8A0D8]" />
              <p className="text-xs leading-relaxed text-[#A8A0D8]">
                ProofMark は、個人クリエイター向けの B2C 表示では運営者情報を「開示請求ベース」で運用しています（個人事業主の秘匿性を守るため）。法人決済の調達承認では、本ページ経由で完全開示モードへ確実に切り替わります。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 最終 CTA ──────────────────────── */}
      <section className="bg-[#0B0A24] py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            まずは要件のすり合わせから。
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#A8A0D8]">
            導入規模・想定発行数・既存ワークフロー・法務要件をお知らせください。SLA / DPA を含む個別見積を48時間以内にお送りします。
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="mailto:support@proofmark.jp?subject=Business%20%E3%83%97%E3%83%A9%E3%83%B3%E3%81%AE%E3%81%94%E7%9B%B8%E8%AB%87"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] px-7 py-3.5 text-sm font-bold text-white shadow-[0_0_24px_rgba(108,62,244,0.45)] transition-transform hover:scale-[1.02]"
            >
              <Mail className="h-4 w-4" />
              support@proofmark.jp に送る
            </a>
            <a
              href="https://github.com/proofmark-jp/verify"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-7 py-3.5 text-sm font-bold text-white/85 transition-colors hover:border-[#00D4AA]/30 hover:text-white"
            >
              <Github className="h-4 w-4" />
              proofmark-jp/verify
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
