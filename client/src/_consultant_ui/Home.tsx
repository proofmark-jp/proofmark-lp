/**
 * src/pages/Home.tsx — Phase 1 (Task C) 世界基準 LP 本体
 *
 * 仕様書 §2「ランディングページ（/）情報アーキテクチャ」に厳密準拠。
 * 1 セクション = 1 感情 (フック→危機感→安堵→確信→行動) で展開する。
 *
 * 設計上の不変条件:
 *   - 既存の API、Supabase、認証ロジックには一切触れない (静的フロント)。
 *   - 背景は #07061A 統一。セクションの区切りは「色」ではなく「余白」で。
 *   - スクロール出現は opacity 0→1 + translateY 24→0、
 *     easing は cubic-bezier(0.16,1,0.3,1)。Framer Motion を使用。
 *   - Hero 右側カラムは <HeroMockup /> (空コンテナ) を配置するのみ。
 *     アニメーション本体は別チームから後日納品される (Task D)。
 *   - Lighthouse 90+ を維持するため:
 *       * embla / dropzone / sonner 等の重量 import は呼ばない
 *       * 画像は SVG/CSS で表現
 *       * Framer Motion は whileInView (once: true) で 1 回限り発火
 */

import { type ReactNode } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  ShieldCheck,
  Hash,
  Clock,
  Lock,
  GitBranch,
  Eye,
  CheckCircle2,
  PenTool,
  BookOpen,
  Palette,
  Code2,
  AlertTriangle,
} from 'lucide-react';
import LpNavbar from '../components/lp/Navbar';
import HeroMockup from '../components/HeroAnimation';

/* Apple-grade easing と統一トランジション (仕様書 §1-3) */
const PM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const fadeInProps = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.7, delay, ease: PM_EASE },
});

/* ───────────────────────────────────────────────────────────────────
 * 共通レイアウト要素
 * ─────────────────────────────────────────────────────────────────── */

function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="pm-label">{children}</span>;
}

function SectionHeader({
  eyebrow,
  title,
  sub,
  align = 'left',
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: ReactNode;
  align?: 'left' | 'center';
}) {
  const alignClass = align === 'center' ? 'text-center mx-auto' : '';
  return (
    <header className={`max-w-3xl ${alignClass}`}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <motion.h2 className="pm-h2 mt-4" {...fadeInProps()}>
        {title}
      </motion.h2>
      {sub ? (
        <motion.p className="pm-body mt-5 max-w-2xl" {...fadeInProps(0.05)}>
          {sub}
        </motion.p>
      ) : null}
    </header>
  );
}

/* ───────────────────────────────────────────────────────────────────
 * Page
 * ─────────────────────────────────────────────────────────────────── */

export default function Home() {
  return (
    <div style={{ background: '#07061A', minHeight: '100vh', color: '#FFFFFF' }}>
      <LpNavbar />

      {/* [S1] Hero — 即座の確信・期待 */}
      <section
        aria-labelledby="hero-title"
        style={{ background: '#07061A' }}
        className="relative overflow-hidden"
      >
        {/* SVG ノイズグラデーション (静的、軽量) */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div
            className="absolute -left-32 top-32 h-[420px] w-[420px] rounded-full"
            style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(108,62,244,0.20), transparent 70%)' }}
          />
          <div
            className="absolute -right-24 top-64 h-[360px] w-[360px] rounded-full"
            style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(0,212,170,0.16), transparent 70%)' }}
          />
        </div>

        <div className="pm-container relative flex min-h-[100vh] items-center pb-24 pt-32 lg:pb-32 lg:pt-40">
          <div className="grid w-full grid-cols-1 items-center gap-16 lg:grid-cols-[55fr_45fr] lg:gap-12">
            {/* 左 55% — テキスト */}
            <div>
              <motion.div {...fadeInProps()}>
                <Eyebrow>YOUR CREATION. YOUR PROOF.</Eyebrow>
              </motion.div>

              <motion.h1
                id="hero-title"
                className="pm-display mt-6"
                {...fadeInProps(0.05)}
              >
                作った、その瞬間が
                <br />
                <span className="pm-accent-text">永遠の証拠</span>
                になる。
              </motion.h1>

              <motion.p
                className="pm-body mt-7 max-w-[520px]"
                {...fadeInProps(0.10)}
              >
                AIで生成した作品に、世界標準のタイムスタンプを。
                <br className="hidden md:inline" />
                無料で、今すぐ。
              </motion.p>

              <motion.div
                className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
                {...fadeInProps(0.15)}
              >
                <Link href="/auth?mode=signup">
                  <span className="pm-cta-primary">
                    無料で証明書を発行する
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </Link>
                <Link href="/spot-issue">
                  <span className="pm-cta-ghost">
                    登録不要で1件だけ発行
                  </span>
                </Link>
              </motion.div>

              <motion.div
                className="mt-8 flex items-center gap-5 text-[13px]"
                style={{ color: 'rgba(255,255,255,0.55)' }}
                {...fadeInProps(0.20)}
              >
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" style={{ color: '#00D4AA' }} aria-hidden="true" />
                  RFC3161 準拠
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Hash className="h-4 w-4" style={{ color: '#00D4AA' }} aria-hidden="true" />
                  SHA-256
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="h-4 w-4" style={{ color: '#00D4AA' }} aria-hidden="true" />
                  原画は預けない
                </span>
              </motion.div>
            </div>

            {/* 右 45% — Lottie/Motion デモのコンテナ (Task D 受け入れ準備) */}
            <motion.div {...fadeInProps(0.10)}>
              <HeroMockup />
            </motion.div>
          </div>
        </div>
      </section>

      {/* [S2] Problem — 共感と危機感 */}
      <section aria-labelledby="problem-title" className="pm-section">
        <div className="pm-container">
          <SectionHeader
            eyebrow="THE RISK"
            title={
              <>
                あなたのAI作品、誰かに先に使われたとき、
                <br className="hidden md:inline" />
                どう証明しますか？
              </>
            }
            sub="作成日のメタデータは書き換えられる。SNSの投稿日時は証拠にならない。「私が先に作った」を証明する手段が、今はない。"
          />

          <motion.div
            className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6"
            {...fadeInProps(0.05)}
          >
            <PainCard
              icon={<AlertTriangle className="h-5 w-5" />}
              title="メタデータは書き換え可能"
              body="EXIF / 作成日時はソフトで簡単に偽造できます。後日「自分が先に作った」と言い張る相手に、技術的な反論ができません。"
            />
            <PainCard
              icon={<Clock className="h-5 w-5" />}
              title="SNSの投稿日時は不十分"
              body="プラットフォーム側のメタは消されます。スクリーンショットは原本ではなく、第三者検証もできません。"
            />
            <PainCard
              icon={<Lock className="h-5 w-5" />}
              title="原画を渡したくない"
              body="法的証明のために原画を第三者に預けるのは現実的ではない。NDA案件なら尚更です。"
            />
          </motion.div>
        </div>
      </section>

      {/* [S3] Solution — 安堵と理解 */}
      <section aria-labelledby="solution-title" className="pm-section">
        <div className="pm-container">
          <SectionHeader
            eyebrow="THE SOLUTION"
            title={
              <>
                ファイルをアップロードするだけ。
                <br className="hidden md:inline" />
                <span className="pm-accent-text">改ざん不可能な証明</span>
                が、その瞬間に刻まれる。
              </>
            }
          />

          <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
            <StepRow
              index="01"
              title="アップロード"
              body="ブラウザ内でSHA-256を計算します。原画はあなたの端末から外に出ません。"
            />
            <StepRow
              index="02"
              title="ハッシュ生成"
              body="作品を一意に識別する64桁の指紋(SHA-256)を作成します。逆計算は実質的に不可能です。"
            />
            <StepRow
              index="03"
              title="証明書発行"
              body="RFC3161準拠の公的タイムスタンプ機関がハッシュに署名します。発行後の改ざんは検出可能です。"
            />
            <StepRow
              index="04"
              title="検証 URL"
              body="発行直後に検証 URL とPDFを取得。納品時はそのURLを添えるだけで第三者が再検証できます。"
            />
          </div>
        </div>
      </section>

      {/* [S4] Technology — 確信・信頼 */}
      <section aria-labelledby="tech-title" className="pm-section">
        <div className="pm-container">
          <SectionHeader
            eyebrow="TECHNOLOGY"
            title="世界標準の技術基盤で、あなたの作品を守る。"
            sub="独自規格ではなく、IETF 標準と暗号学的事実だけを根拠にしています。"
          />

          <motion.div
            className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2"
            {...fadeInProps(0.05)}
          >
            <TechCard
              icon={<Hash className="h-5 w-5" />}
              title="SHA-256"
              body="NIST FIPS 180-4 規格。同じ出力を作る別ファイルを意図的に作ることは、現代の計算資源では不可能です。"
            />
            <TechCard
              icon={<Clock className="h-5 w-5" />}
              title="RFC3161 タイムスタンプ"
              body="主要 TSA が署名した公的な時刻証明。OpenSSL 等で誰でも検証可能で、特定ベンダーへのロックインがありません。"
            />
            <TechCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="検証可能"
              body="発行された証明はあなたの手元に残り、ProofMark が消えても OpenSSL だけで再検証できます。"
            />
            <TechCard
              icon={<Eye className="h-5 w-5" />}
              title="透明性"
              body="証明アルゴリズム・検証スクリプト・データ保持ポリシーをすべて Trust Center で公開しています。"
            />
          </motion.div>

          {/* GitHub 風バッジ — verify.py オープンソース検証 */}
          <motion.div className="mt-10" {...fadeInProps(0.10)}>
            <a
              href="https://proofmark.jp/trust-center"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:border-white/30"
            >
              <GitBranch className="h-4 w-4" style={{ color: '#00D4AA' }} aria-hidden="true" />
              <span>verify.py</span>
              <span className="text-white/45">|</span>
              <span style={{ color: '#00D4AA' }}>open source</span>
              <ArrowRight className="h-3.5 w-3.5 text-white/55" aria-hidden="true" />
            </a>
          </motion.div>
        </div>
      </section>

      {/* [S5] Use Cases — 自分ごと化 */}
      <section aria-labelledby="usecase-title" className="pm-section">
        <div className="pm-container">
          <SectionHeader
            eyebrow="WHO IT'S FOR"
            title="すべてのクリエイターの、すべての作品のために。"
          />
        </div>

        {/* 横スクロールカルーセル (デスクトップ・モバイル共通) */}
        <motion.div
          className="mt-12 overflow-x-auto pl-6 pr-6 [scrollbar-width:thin]"
          style={{
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
          }}
          {...fadeInProps(0.05)}
        >
          <ul
            className="flex gap-4 pb-6 md:gap-6"
            role="list"
            style={{ width: 'max-content' }}
          >
            {USE_CASES.map((u) => (
              <UseCaseCard key={u.title} {...u} />
            ))}
          </ul>
        </motion.div>
      </section>

      {/* [S6] Pricing — 決断・低ハードル */}
      <section aria-labelledby="pricing-title" className="pm-section">
        <div className="pm-container">
          <SectionHeader
            eyebrow="PRICING"
            title="まず、無料で始める。"
            sub="クレジットカード不要。アカウント登録だけで今日から使えます。"
            align="center"
          />

          <motion.div
            className="mx-auto mt-16 grid w-full max-w-5xl grid-cols-1 gap-5 md:grid-cols-3 md:gap-6"
            {...fadeInProps(0.05)}
          >
            {/* Free (強調) */}
            <PricingCard
              tier="Free"
              price="¥0"
              cadence="ずっと無料"
              tagline="クリエイターが、まず始めるべき場所。"
              points={[
                '月30件まで証明書発行',
                'SHA-256 + RFC3161 タイムスタンプ',
                '検証 URL の発行',
                'クレジットカード不要',
              ]}
              ctaLabel="無料で始める"
              ctaHref="/auth?mode=signup"
              highlighted
            />
            {/* Light */}
            <PricingCard
              tier="Light"
              price="¥1,480"
              cadence="月額"
              tagline="納品の信頼を担保したいフリーランスへ。"
              points={[
                '月間発行数の上限なし',
                'PDF・Evidence Pack ダウンロード',
                'NDA 表示モード',
                '案件単位の整理',
              ]}
              ctaLabel="プラン詳細"
              ctaHref="/pricing#light"
            />
            {/* Spot */}
            <PricingCard
              tier="Spot"
              price="¥480"
              cadence="1案件あたり"
              tagline="アカウント不要で、今この1案件だけ。"
              points={[
                '1案件分の Evidence Pack',
                '登録不要・即時発行',
                'PDF + RFC3161 + 検証スクリプト',
                '24時間後にデータ削除',
              ]}
              ctaLabel="Spotで発行"
              ctaHref="/spot-issue"
            />
          </motion.div>

        </div>
      </section>

      {/* [S7] Final CTA — 最終行動 */}
      <section
        aria-labelledby="final-title"
        className="pm-section relative overflow-hidden"
      >
        {/* このセクションのみ、微かなグラデーション背景 (仕様書 §2 [S7]) */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(60% 70% at 50% 50%, rgba(108,62,244,0.18), transparent 70%), radial-gradient(40% 50% at 80% 100%, rgba(0,212,170,0.16), transparent 70%)',
            }}
          />
          {/* 巨大なシール透かし */}
          <div
            className="absolute right-[-10%] top-[8%] h-[420px] w-[420px] rounded-full"
            style={{
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: 'inset 0 0 0 60px rgba(255,255,255,0.025)',
            }}
          />
        </div>

        <div className="pm-container relative">
          <motion.div className="mx-auto max-w-3xl text-center" {...fadeInProps()}>
            <Eyebrow>FIRST PROOF</Eyebrow>
            <h2 id="final-title" className="pm-h2 mt-5">
              あなたの次の作品に、
              <br className="hidden md:inline" />
              <span className="pm-accent-text">最初の証明書</span>
              を発行しませんか。
            </h2>
            <p className="pm-body mt-6 max-w-2xl mx-auto">
              SHA-256 はブラウザ内で計算され、原画は送信されません。最短 30 秒、無料で完了します。
            </p>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <Link href="/auth?mode=signup">
                <span
                  className="inline-flex h-[56px] items-center justify-center gap-2 rounded-full px-8 text-[15px] font-bold tracking-tight"
                  style={{
                    background: '#FFFFFF',
                    color: '#6C3EF4',
                    boxShadow: '0 18px 40px -16px rgba(255,255,255,0.45)',
                  }}
                >
                  無料で証明書を発行する
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </Link>
              <Link href="/spot-issue">
                <span className="pm-cta-ghost">
                  登録せずに 1 件だけ
                </span>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────
 * 部分コンポーネント
 * ─────────────────────────────────────────────────────────────────── */

function PainCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <article className="pm-glass p-7">
      <span
        aria-hidden="true"
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
        style={{
          color: '#00D4AA',
          background: 'rgba(0,212,170,0.10)',
          border: '1px solid rgba(0,212,170,0.30)',
        }}
      >
        {icon}
      </span>
      <h3 className="mt-5 text-[20px] font-bold tracking-tight text-white">{title}</h3>
      <p className="pm-body mt-3 text-[15px]">{body}</p>
    </article>
  );
}

function StepRow({ index, title, body }: { index: string; title: string; body: string }) {
  return (
    <motion.div className="flex items-start gap-6 md:gap-8" {...fadeInProps()}>
      <span
        aria-hidden="true"
        className="pm-accent-text shrink-0 font-extrabold leading-none"
        style={{ fontSize: 88, letterSpacing: '-0.04em' }}
      >
        {index}
      </span>
      <div>
        <h3 className="text-[22px] font-bold tracking-tight text-white">{title}</h3>
        <p className="pm-body mt-3 max-w-md text-[15px]">{body}</p>
      </div>
    </motion.div>
  );
}

function TechCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <article
      className="rounded-3xl p-7"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
        style={{
          color: '#00D4AA',
          background: 'rgba(0,212,170,0.10)',
          border: '1px solid rgba(0,212,170,0.30)',
        }}
      >
        {icon}
      </span>
      <h3 className="mt-5 text-[20px] font-bold tracking-tight text-white">{title}</h3>
      <p className="pm-body mt-3 text-[15px]">{body}</p>
    </article>
  );
}

interface UseCaseSpec {
  title: string;
  body: string;
  icon: ReactNode;
}

const USE_CASES: ReadonlyArray<UseCaseSpec> = [
  {
    title: 'AIイラストレーター',
    body: '生成直後の作品にタイムスタンプ。SNSアップ前に「私が先」を確定。',
    icon: <Palette className="h-5 w-5" />,
  },
  {
    title: '小説家・脚本家',
    body: '原稿の各バージョンに証明書。改稿の歴史と先行性を残します。',
    icon: <BookOpen className="h-5 w-5" />,
  },
  {
    title: 'デザイナー・写真家',
    body: '納品物に検証 URL を添付。クライアントの安心と二次利用への抑止力。',
    icon: <PenTool className="h-5 w-5" />,
  },
  {
    title: '開発者',
    body: 'リリースアセットや学習データに証明。第三者検証可能な納品履歴。',
    icon: <Code2 className="h-5 w-5" />,
  },
];

function UseCaseCard({ title, body, icon }: UseCaseSpec) {
  return (
    <li
      className="pm-glass shrink-0 p-7"
      style={{ width: 'min(86vw, 340px)', scrollSnapAlign: 'start' }}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
        style={{
          color: '#00D4AA',
          background: 'rgba(0,212,170,0.10)',
          border: '1px solid rgba(0,212,170,0.30)',
        }}
      >
        {icon}
      </span>
      <h3 className="mt-5 text-[20px] font-bold tracking-tight text-white">{title}</h3>
      <p className="pm-body mt-3 text-[15px]">{body}</p>
    </li>
  );
}

interface PricingSpec {
  tier: string;
  price: string;
  cadence: string;
  tagline: string;
  points: string[];
  ctaLabel: string;
  ctaHref: string;
  highlighted?: boolean;
}

function PricingCard({ tier, price, cadence, tagline, points, ctaLabel, ctaHref, highlighted }: PricingSpec) {
  return (
    <article
      className="relative flex h-full flex-col rounded-3xl p-7"
      style={{
        background: highlighted ? 'rgba(108,62,244,0.10)' : 'rgba(255,255,255,0.025)',
        border: `1px solid ${highlighted ? 'rgba(108,62,244,0.45)' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: highlighted ? '0 24px 60px -28px rgba(108,62,244,0.55)' : 'none',
      }}
    >
      {highlighted && (
        <span
          aria-hidden="true"
          className="absolute -top-3 left-7 inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{
            color: '#0A0E27',
            background: 'linear-gradient(135deg, #6C3EF4, #00D4AA)',
          }}
        >
          Recommended
        </span>
      )}
      <header>
        <p className="text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: '#00D4AA' }}>
          {tier}
        </p>
        <p className="mt-4 flex items-baseline gap-2">
          <span className="text-[40px] font-extrabold tracking-tight text-white">{price}</span>
          <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.55)' }}>{cadence}</span>
        </p>
        <p className="mt-3 text-[14px] font-semibold text-white">{tagline}</p>
      </header>

      <ul className="mt-6 flex-1 space-y-3" role="list">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2.5 text-[14px]" style={{ color: 'rgba(255,255,255,0.78)' }}>
            <CheckCircle2 className="mt-[2px] h-4 w-4 shrink-0" style={{ color: '#00D4AA' }} aria-hidden="true" />
            <span>{p}</span>
          </li>
        ))}
      </ul>

      <Link href={ctaHref}>
        <span
          className={highlighted ? 'pm-cta-primary mt-7 w-full' : 'pm-cta-ghost mt-7 w-full'}
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </Link>
    </article>
  );
}
