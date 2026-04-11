import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Lock, Database, AlertCircle, Check, Shield, Zap, Award, Info, Share2, CheckCircle } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";

import CertificateUpload from "@/components/CertificateUpload";
import { useAuth } from "@/hooks/useAuth";
import { FAQAccordion } from "@/components/FAQAccordion";
import { SupportedToolsSection } from "@/components/SupportedToolsSection";
import { DeveloperMessage } from "@/components/DeveloperMessage";
import { sendConfirmationEmail } from "@/lib/email";
import LearningSection from "@/components/LearningSection";
import { SchemaScript } from "@/components/SchemaScript";
import Navbar from "@/components/Navbar";
import founderBadge from "../assets/logo/badges/proofmark-badge-founder.svg";
import {
  fadeInVariants,
  slideInVariants,
  staggerContainer,
  buttonVariants,
} from "@/lib/animations";

// ── Reusable scroll-triggered wrapper ──────────────────────────
const FadeInSection = ({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-80px" }}
    transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);

// ── Spinning Glow Orb (hero BG decoration) ─────────────────────
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
  const [heroEmail, setHeroEmail] = useState("");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [isHeroSubmitting, setIsHeroSubmitting] = useState(false);
  const [isWaitlistSubmitting, setIsWaitlistSubmitting] = useState(false);

  const { user, signOut } = useAuth();
  SchemaScript();

  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -60]);

  const handleHeroSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!heroEmail) return;
    setIsHeroSubmitting(true);
    const emailResult = await sendConfirmationEmail(heroEmail);
    if (emailResult.success) {
      toast.success("登録完了！確認メールをお送りしました。");
      setHeroEmail("");
    } else {
      toast.error(emailResult.error || "登録に失敗しました");
    }
    setIsHeroSubmitting(false);
  };

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail) return;
    setIsWaitlistSubmitting(true);
    const emailResult = await sendConfirmationEmail(waitlistEmail);
    if (emailResult.success) {
      toast.success("ウェイティングリストに追加されました！");
      setWaitlistEmail("");
    } else {
      toast.error(emailResult.error || "登録に失敗しました");
    }
    setIsWaitlistSubmitting(false);
  };

  return (
    <>
      <div id="top" className="min-h-screen bg-background text-foreground overflow-clip">
        <Navbar user={user} signOut={signOut} />

        {/* ── Hero Section ────────────────────────────────────── */}
        <section className="relative min-h-[90vh] flex items-center overflow-hidden">
          <GlowOrb color="#6c3ef4" size={520} top="-10%" left="-8%" opacity={0.18} />
          <GlowOrb color="#00d4aa" size={380} top="50%" left="60%" opacity={0.12} />
          <GlowOrb color="#6c3ef4" size={260} top="70%" left="10%" opacity={0.1} />

          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(rgba(108,62,244,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(108,62,244,0.04) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
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
            className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24"
            style={{ y: heroY }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%" }}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-[#00D4AA] text-xs sm:text-sm font-bold tracking-widest uppercase mb-8">
                ブラウザ完結・完全秘匿型 デジタル存在証明
              </div>
              <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-white tracking-tight mb-6 leading-tight text-center">
                「どうせAIでしょ？」を、<br className="hidden sm:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00D4AA] to-[#6C3EF4]">
                  検証可能な事実で終わらせる。
                </span>
              </h1>
              <p className="text-[#A8A0D8] text-base sm:text-xl max-w-3xl mx-auto mb-10 leading-relaxed text-center">
                画像のSHA-256ハッシュをブラウザ内で計算し（Client-side Hashing）、作成時点の証拠を暗号学的に記録。<br className="hidden md:block" />
                公開検証URL・PDF・QRコードで、あなたの創作の事実を第三者に堂々と共有できます。
              </p>

              {/* Hero form / Dashboard CTA based on auth state */}
              {user ? (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.65, duration: 0.4 }}
                  className="mb-10 w-full"
                >
                  <Link href="/dashboard">
                    <button className="px-10 py-5 rounded-full bg-primary text-white font-black text-lg hover:scale-105 transition-all shadow-[0_0_40px_rgba(108,62,244,0.4)] block mx-auto">
                      管理画面へ進む (Go to Dashboard) ➔
                    </button>
                  </Link>
                </motion.div>
              ) : (
                <>
                  <motion.form
                    onSubmit={handleHeroSubmit}
                    className="flex flex-col sm:flex-row gap-3 mb-6 max-w-md w-full mx-auto"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.65, duration: 0.4 }}
                  >
                    <label htmlFor="hero-email" className="sr-only">メールアドレス</label>
                    <input
                      id="hero-email"
                      type="email"
                      placeholder="your@email.com"
                      value={heroEmail}
                      onChange={(e) => setHeroEmail(e.target.value)}
                      disabled={isHeroSubmitting}
                      className="flex-1 px-6 py-4 rounded-full border transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
                      style={{
                        background: "rgba(21,29,47,0.85)",
                        borderColor: "rgba(42,42,78,0.8)",
                        backdropFilter: "blur(8px)",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "rgba(108,62,244,0.7)";
                        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(108,62,244,0.15)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "rgba(42,42,78,0.8)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                      required
                      aria-label="先行登録用のメールアドレス"
                    />
                    <motion.button
                      type="submit"
                      disabled={isHeroSubmitting}
                      className="px-8 py-4 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-70 disabled:cursor-wait"
                      style={{ boxShadow: "0 0 20px rgba(108,62,244,0.4)" }}
                      variants={buttonVariants}
                      initial="rest"
                      whileHover="hover"
                      whileTap="tap"
                    >
                      {isHeroSubmitting ? (
                        <>
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          暗号化通信中...
                        </>
                      ) : "先行アクセスを確保 ➔"}
                    </motion.button>
                  </motion.form>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    style={{ fontSize: "14px", color: "#A8A0D8", marginTop: "16px", lineHeight: "1.5", wordBreak: "break-word", whiteSpace: "normal", textAlign: "center" }}
                  >
                    <p className="text-xs text-muted flex items-center justify-center gap-2 mb-3">
                      <Lock className="w-4 h-4 text-accent" />
                      メールアドレスはSSL/TLSで保護されます
                    </p>
                    <p>
                      <span className="text-[#ffd966] font-bold">🎁 先着100名限定</span>：β版優先招待 + 3ヶ月無料 + 創設者バッジ<br />
                      クレジットカード不要・いつでも解除OK
                    </p>
                  </motion.div>
                </>
              )}

              {/* ヒーロー画像：証明書モックアップ（/mockup.avif に置き換え） */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0, duration: 0.8, ease: "easeOut" }}
                className="w-full"
              >
                <img 
                  src="/mockup.avif" 
                  alt="ProofMark Mockup" 
                  className="w-full max-w-3xl mx-auto mt-12 rounded-2xl shadow-[0_0_50px_rgba(108,62,244,0.2)] border border-[#1C1A38] transform perspective-1000 rotate-x-12 hover:rotate-0 transition-transform duration-700" 
                />
              </motion.div>
            </div>
          </motion.div>
        </section>

        {/* --- 2モード解説セクション --- */}
        <section className="py-24 px-6 sm:px-12 bg-[#0D0B24] border-y border-[#1C1A38]">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">選べる2つの証明モード</h2>
              <p className="text-[#A8A0D8]">ProofMarkは「原画を送信しない」ことをデフォルトとし、クリエイターの尊厳を守ります。</p>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-[#07061A] border border-[#1C1A38] rounded-3xl p-8 sm:p-10 relative overflow-hidden group hover:border-[#00D4AA]/50 transition-colors">
                <Shield className="w-12 h-12 text-[#00D4AA] mb-6" />
                <h3 className="text-2xl font-bold text-white mb-3">Private Proof <span className="text-sm font-normal text-slate-400 ml-2">(推奨)</span></h3>
                <p className="text-[#A8A0D8] mb-6 leading-relaxed">原画をサーバーに一切送信せず、ブラウザ上でハッシュ計算のみを行います。運営側すら作品を見ることができない、最高水準のプライバシー保護モードです。</p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-sm text-slate-300"><CheckCircle className="w-5 h-5 text-[#00D4AA]" /> 原画の漏洩リスクゼロ</li>
                </ul>
              </div>
              <div className="bg-[#07061A] border border-[#1C1A38] rounded-3xl p-8 sm:p-10 relative overflow-hidden group hover:border-[#6C3EF4]/50 transition-colors">
                <Share2 className="w-12 h-12 text-[#6C3EF4] mb-6" />
                <h3 className="text-2xl font-bold text-white mb-3">Shareable Proof</h3>
                <p className="text-[#A8A0D8] mb-6 leading-relaxed">SNSシェアやポートフォリオ用に、表示用画像をセキュアストレージに保存します。RLSにより、安全な状態で公開検証ページに画像を表示できます。</p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-sm text-slate-300"><CheckCircle className="w-5 h-5 text-[#6C3EF4]" /> 美しい公開検証ページの生成</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* --- 免責事項セクション --- */}
        <section className="py-20 px-6 sm:px-12">
          <div className="max-w-4xl mx-auto bg-[#15132D] rounded-2xl border border-[#2a2a4e] p-8 sm:p-10 text-center">
            <Lock className="w-10 h-10 text-slate-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-4">この証明が意味すること、保証しないこと</h2>
            <p className="text-sm text-[#A8A0D8] leading-relaxed text-left sm:text-center">
              ProofMarkは、「特定の日時において、特定のハッシュ値を持つファイルが存在した」という客観的な事実を暗号技術を用いて記録・証明するインフラストラクチャです。<br className="hidden sm:block" />
              <span className="text-yellow-500/90 font-bold">本サービスは、当該ファイルの「著作権の帰属」や「作品の独自性・適法性」そのものを最終的に判定・保証するものではありません。</span><br className="hidden sm:block" />
              無断転載時の証拠提示や、クライアントへの納品時の信頼性担保としてご活用ください。また、Private Proofモードにおいて運営側がユーザーの元データを閲覧・取得することは技術的に不可能です。
            </p>
          </div>
        </section>

        {/* ── Stats Bar ───────────────────────────────────────── */}
        <FadeInSection>
          <div
            className="border-y border-border/50 py-6"
            style={{ background: "rgba(21,29,47,0.6)", backdropFilter: "blur(8px)" }}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <motion.div
                className="flex flex-wrap justify-center gap-8 md:gap-16"
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                {[
                  { value: "SHA-256", label: "暗号強度" },
                  { value: "Direct", label: "ストレージ直結" },
                  { value: "Secure", label: "クラウド保存" },
                  { value: "C2PA", label: "対応予定" },
                ].map((stat) => (
                  <motion.div key={stat.value} className="text-center" variants={slideInVariants}>
                    <div
                      className="text-2xl font-black mb-1 stats-keyword"
                      style={{
                        backgroundImage: "linear-gradient(135deg, #6c3ef4, #00d4aa)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                        transition: "filter 0.3s ease",
                      }}
                    >
                      {stat.value}
                    </div>
                    <div className="text-xs text-muted">{stat.label}</div>
                  </motion.div>
                ))}
                <style>{`
                  .stats-keyword:hover {
                    filter: drop-shadow(0 0 8px rgba(0, 212, 170, 0.55)) drop-shadow(0 0 16px rgba(0, 212, 170, 0.30));
                    -webkit-text-fill-color: transparent;
                    cursor: default;
                  }
                `}</style>
              </motion.div>
            </div>
          </div>
        </FadeInSection>

        {/* ── How it Works Section - 数字＋アイコンのハイブリッドUI ── */}
        <section id="how-it-works" className="relative py-24 bg-[#07061A] border-y border-[#1C1A38] overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#6C3EF4] opacity-[0.05] blur-[120px] rounded-full pointer-events-none" />

          <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold text-[#00D4AA] mb-4"
              style={{ background: "rgba(0,212,170,0.1)", border: "1px solid rgba(0,212,170,0.25)" }}
            >
              <Zap className="w-3 h-3" /> HOW IT WORKS
            </div>

            <h2 className="text-4xl md:text-5xl font-extrabold text-[#F0EFF8] mb-4 tracking-tight">
              <span className="text-[#00D4AA] mr-1">3</span>ステップで「先取権」を確定
            </h2>
            <p className="text-[#A8A0D8] mb-16 text-lg">あなたの作品を、未来に残る証拠に変える仕組み</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              {/* Step 1 */}
              <div className="group relative bg-[#0D0B24] border border-[#1C1A38] hover:border-[#00D4AA]/50 p-8 rounded-2xl transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_8px_32px_rgba(0,212,170,0.15)] overflow-hidden">
                <div className="absolute -right-4 -top-8 text-[120px] font-black text-white/[0.02] group-hover:text-[#00D4AA]/[0.05] transition-colors duration-500 pointer-events-none select-none" style={{ fontFamily: "'Syne', sans-serif" }}>
                  01
                </div>
                <div className="relative z-10 w-16 h-16 rounded-2xl mb-6 flex items-center justify-center border border-[#00D4AA]/20 bg-gradient-to-br from-[#00D4AA]/10 to-transparent group-hover:from-[#00D4AA]/20 transition-all duration-500">
                  <span className="absolute top-1 left-2 text-xs font-bold text-[#00D4AA]/60 font-mono">1</span>
                  <Lock className="w-7 h-7 text-[#00D4AA] group-hover:scale-110 transition-transform duration-500 drop-shadow-[0_0_8px_rgba(0,212,170,0.5)]" />
                </div>
                <h3 className="relative z-10 text-xl font-bold text-[#F0EFF8] mb-4 group-hover:text-[#00D4AA] transition-colors">ブラウザ内ハッシュ計算</h3>
                <p className="relative z-10 text-[#A8A0D8] leading-relaxed text-sm md:text-base">
                  Client-side Hashing技術により、計算はブラウザ内で完結。原画データをサーバーに送信することなく証明が可能です。<span className="text-[#00D4AA] opacity-80 text-xs block mt-2">（※Shareable Proofモードを選択した場合のみ、公開用画像が安全に保管されます）</span>
                </p>
              </div>

              {/* Step 2 */}
              <div className="group relative bg-[#0D0B24] border border-[#1C1A38] hover:border-[#6C3EF4]/50 p-8 rounded-2xl transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_8px_32px_rgba(108,62,244,0.15)] overflow-hidden">
                <div className="absolute -right-4 -top-8 text-[120px] font-black text-white/[0.02] group-hover:text-[#6C3EF4]/[0.05] transition-colors duration-500 pointer-events-none select-none" style={{ fontFamily: "'Syne', sans-serif" }}>
                  02
                </div>
                <div className="relative z-10 w-16 h-16 rounded-2xl mb-6 flex items-center justify-center border border-[#6C3EF4]/20 bg-gradient-to-br from-[#6C3EF4]/10 to-transparent group-hover:from-[#6C3EF4]/20 transition-all duration-500">
                  <span className="absolute top-1 left-2 text-xs font-bold text-[#6C3EF4]/60 font-mono">2</span>
                  <Database className="w-7 h-7 text-[#6C3EF4] group-hover:scale-110 transition-transform duration-500 drop-shadow-[0_0_8px_rgba(108,62,244,0.5)]" />
                </div>
                <h3 className="relative z-10 text-xl font-bold text-[#F0EFF8] mb-4 group-hover:text-[#6C3EF4] transition-colors">タイムスタンプ刻印</h3>
                <p className="relative z-10 text-[#A8A0D8] leading-relaxed text-sm md:text-base">
                  計算されたハッシュ値と現在日時（タイムスタンプ）をセキュアなデータベースに記録し、あなたの「先取権」を裏付ける客観的な証拠を確立します。
                </p>
              </div>

              {/* Step 3 */}
              <div className="group relative bg-[#0D0B24] border border-[#1C1A38] hover:border-[#F0BB38]/50 p-8 rounded-2xl transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_8px_32px_rgba(240,187,56,0.15)] overflow-hidden">
                <div className="absolute -right-4 -top-8 text-[120px] font-black text-white/[0.02] group-hover:text-[#F0BB38]/[0.05] transition-colors duration-500 pointer-events-none select-none" style={{ fontFamily: "'Syne', sans-serif" }}>
                  03
                </div>
                <div className="relative z-10 w-16 h-16 rounded-2xl mb-6 flex items-center justify-center border border-[#F0BB38]/20 bg-gradient-to-br from-[#F0BB38]/10 to-transparent group-hover:from-[#F0BB38]/20 transition-all duration-500">
                  <span className="absolute top-1 left-2 text-xs font-bold text-[#F0BB38]/60 font-mono">3</span>
                  <Award className="w-7 h-7 text-[#F0BB38] group-hover:scale-110 transition-transform duration-500 drop-shadow-[0_0_8px_rgba(240,187,56,0.5)]" />
                </div>
                <h3 className="relative z-10 text-xl font-bold text-[#F0EFF8] mb-4 group-hover:text-[#F0BB38] transition-colors">デジタル証明書の発行</h3>
                <p className="relative z-10 text-[#A8A0D8] leading-relaxed text-sm md:text-base">
                  ワンクリックでクライアント提出用のPDF証明書を発行。公開ポートフォリオとしても機能し、SNSでの無断転載を抑止します。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Upload Section ───────────────────────────────────── */}
        <FadeInSection delay={0.1}>
          <div style={{ padding: "64px 20px", background: "#07061A" }}>
            <div style={{ maxWidth: "720px", margin: "0 auto", textAlign: "center" }}>
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold text-primary mb-3"
                style={{ background: "rgba(108,62,244,0.1)", border: "1px solid rgba(108,62,244,0.25)" }}
              >
                ⬡ 証明書を発行する
              </div>
              <h3 className="text-2xl font-black mb-2">作品をアップロードして証明を開始</h3>
              <p className="text-muted text-sm max-w-lg mx-auto mb-8">
                ハッシュ計算はブラウザ内で完結します。ログイン不要でSHA-256計算とタイムスタンプを即時確認できます。
              </p>
              <div className="max-w-2xl mx-auto">
                <CertificateUpload />
              </div>
            </div>
          </div>
        </FadeInSection>

        {/* ── Pain Points ─────────────────────────────────────── */}
        <section
          className="py-24 relative overflow-hidden"
          style={{ background: "rgba(15,22,41,0.6)" }}
        >
          <GlowOrb color="#00d4aa" size={360} top="10%" left="-8%" opacity={0.07} />
          <GlowOrb color="#6c3ef4" size={300} top="60%" left="75%" opacity={0.07} />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <FadeInSection className="text-center mb-16">
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold text-primary mb-4"
                style={{ background: "rgba(108,62,244,0.1)", border: "1px solid rgba(108,62,244,0.25)" }}
              >
                <Shield className="w-3 h-3" /> PAIN POINTS
              </div>
              <h2 className="text-4xl font-black mb-4">こんな経験、ありませんか？</h2>
              <p className="text-muted max-w-2xl mx-auto">
                AIクリエイターが直面する、リアルな悩みと解決策
              </p>
            </FadeInSection>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
            >
              {[
                {
                  emoji: "😤",
                  title: "「どうせAIでしょ？」と言われた",
                  desc: "何時間も試行錯誤した作品を、たった一言で否定される悔しさ。",
                  tag: "信用問題",
                },
                {
                  emoji: "😰",
                  title: "作品を盗用されたが証拠がない",
                  desc: "DMCA申請には「先に作った」証明が必要。でも手元に証拠が…。",
                  tag: "著作権侵害",
                },
                {
                  emoji: "📁",
                  title: "ポートフォリオに説得力が欲しい",
                  desc: "自分の成長や実績を、信頼できる形でクライアントに伝えたい。",
                  tag: "実績証明",
                },
              ].map((pain, i) => (
                <motion.div
                  key={i}
                  className="p-8 rounded-2xl border relative overflow-hidden group"
                  style={{
                    background: "rgba(21,29,47,0.75)",
                    backdropFilter: "blur(12px)",
                    borderColor: "rgba(42,42,78,0.7)",
                  }}
                  variants={slideInVariants}
                  whileHover={{
                    borderColor: "rgba(108,62,244,0.4)",
                    boxShadow: "0 8px 32px rgba(108,62,244,0.12)",
                    y: -4,
                  }}
                  transition={{ duration: 0.25 }}
                >
                  <span
                    className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-4"
                    style={{
                      background: "rgba(108,62,244,0.15)",
                      color: "#6c3ef4",
                      border: "1px solid rgba(108,62,244,0.2)",
                    }}
                  >
                    {pain.tag}
                  </span>
                  <div className="text-4xl mb-4">{pain.emoji}</div>
                  <h3 className="text-lg font-bold mb-3 leading-snug">{pain.title}</h3>
                  <p className="text-muted text-sm leading-relaxed">{pain.desc}</p>
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: "linear-gradient(90deg, #6c3ef4, #00d4aa)" }}
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── Pricing ─────────────────────────────────────────── */}
        <section id="pricing" className="py-24 relative overflow-hidden">
          <GlowOrb color="#6c3ef4" size={500} top="20%" left="45%" opacity={0.07} />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <FadeInSection className="text-center mb-16">
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-4"
                style={{
                  background: "rgba(255,217,102,0.1)",
                  border: "1px solid rgba(255,217,102,0.25)",
                  color: "#ffd966",
                }}
              >
                <Award className="w-3 h-3" /> PRICING
              </div>
              <h2 className="text-4xl font-black mb-4">描いた証拠を、ワンコインで一生の守りに。</h2>
              <p className="text-muted max-w-xl mx-auto">
                まずは気軽に試せる単発プランか、大幅増枠した無料プランで、あなたの創作に安心をプラスしませんか？
              </p>
            </FadeInSection>

            {/* 🌟 2カラムから3カラム（md:grid-cols-3）に変更し、最大幅（max-w-5xl）を拡張 */}
            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-8"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {/* ── Free plan ── */}
              <motion.div
                className="p-8 rounded-2xl border relative overflow-hidden flex flex-col"
                style={{
                  background: "rgba(21,29,47,0.8)",
                  backdropFilter: "blur(12px)",
                  borderColor: "rgba(42,42,78,0.7)",
                }}
                variants={slideInVariants}
                whileHover={{ borderColor: "rgba(108,62,244,0.4)", y: -4 }}
                transition={{ duration: 0.25 }}
              >
                <div className="text-xs font-bold text-muted uppercase tracking-widest mb-2">Free</div>
                <div className="text-4xl font-black mb-1">
                  ¥0<span className="text-lg text-muted font-normal">/月</span>
                </div>
                <p className="text-sm text-muted mb-6">まずは無料で試したい方</p>
                <ul className="space-y-3 mb-8 flex-1">
                  <li className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                    <span>
                      Webタイムスタンプ証明{" "}
                      <span
                        className="ml-1 text-xs font-bold px-2 py-0.5 rounded-full block mt-1 w-fit"
                        style={{
                          background: "rgba(0,212,170,0.15)",
                          color: "#00d4aa",
                          border: "1px solid rgba(0,212,170,0.3)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        月30件に増枠！
                      </span>
                    </span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-accent flex-shrink-0" />
                    <span>公開ポートフォリオ機能</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm text-muted/60">
                    <span className="w-4 h-4 text-center text-muted/40 flex-shrink-0 select-none">—</span>
                    <span className="line-through">PDF証明書の発行</span>
                  </li>
                </ul>
                <Link
                  href="/auth?mode=signup"
                  className="block w-full px-6 py-3 rounded-full border font-bold text-sm transition-colors text-center mt-auto"
                  style={{ borderColor: "rgba(108,62,244,0.4)", color: "#6c3ef4" }}
                >
                  無料で始める
                </Link>
              </motion.div>

              {/* ── Spot plan (新規追加) ── */}
              <motion.div
                className="p-8 rounded-2xl border relative overflow-hidden flex flex-col"
                style={{
                  background: "rgba(21,29,47,0.85)",
                  backdropFilter: "blur(12px)",
                  borderColor: "rgba(0,212,170,0.3)",
                }}
                variants={slideInVariants}
                whileHover={{ borderColor: "rgba(0,212,170,0.6)", y: -4, boxShadow: "0 8px 24px rgba(0,212,170,0.1)" }}
                transition={{ duration: 0.25 }}
              >
                <div className="text-xs font-bold text-[#00D4AA] uppercase tracking-widest mb-2">Spot</div>
                <div className="text-4xl font-black mb-1">
                  ¥100<span className="text-lg text-muted font-normal">/回</span>
                </div>
                <p className="text-sm text-muted mb-6">必要な時だけ手軽に使いたい方</p>
                <ul className="space-y-3 mb-8 flex-1">
                  <li className="flex items-center gap-2 text-sm font-bold text-white">
                    <Zap className="w-4 h-4 text-[#00D4AA] flex-shrink-0" />
                    <span>アカウント登録不要</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-accent flex-shrink-0" />
                    <span>PDF証明書（1件発行）</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-accent flex-shrink-0" />
                    <span>Webタイムスタンプ証明</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm text-muted/60">
                    <span className="w-4 h-4 text-center text-muted/40 flex-shrink-0 select-none">—</span>
                    <span className="line-through">公開ポートフォリオ保存</span>
                  </li>
                </ul>
                <Link
                  href="/auth?mode=signup"
                  className="block w-full px-6 py-3 rounded-full border font-bold text-sm transition-colors text-center mt-auto"
                  style={{ borderColor: "rgba(0,212,170,0.4)", color: "#00D4AA", background: "rgba(0,212,170,0.05)" }}
                >
                  今すぐ1件発行する
                </Link>
              </motion.div>

              {/* ── Light plan ── */}
              <motion.div
                className="p-8 rounded-2xl relative overflow-hidden flex flex-col"
                style={{
                  background: "linear-gradient(135deg, rgba(108,62,244,0.2) 0%, rgba(21,29,47,0.95) 60%)",
                  border: "2px solid rgba(108,62,244,0.5)",
                  boxShadow: "0 0 40px rgba(108,62,244,0.2), inset 0 1px 0 rgba(255,255,255,0.05)",
                  backdropFilter: "blur(12px)",
                }}
                variants={slideInVariants}
                whileHover={{ boxShadow: "0 0 60px rgba(108,62,244,0.35)", y: -4 }}
                transition={{ duration: 0.25 }}
              >
                {/* Recommended badge */}
                <div
                  className="absolute top-4 right-4 text-xs font-black px-3 py-1 rounded-full"
                  style={{
                    background: "linear-gradient(135deg, #6c3ef4, #00d4aa)",
                    color: "#f0f0fa",
                  }}
                >
                  おすすめ
                </div>

                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Light</div>
                <div className="text-4xl font-black mb-1">
                  ¥480<span className="text-lg text-muted font-normal">/月</span>
                </div>
                <p className="text-sm text-muted mb-6">本格的に権利を守りたい方へ</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {[
                    "PDF証明書 無制限",
                    "Webタイムスタンプ証明 無制限",
                    "公開ポートフォリオ機能",
                    "C2PAメタデータ読取（対応予定）",
                    "制作工程アップロード",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth?mode=signup"
                  className="block w-full px-6 py-3 rounded-full font-bold text-sm text-primary-foreground text-center mt-auto"
                  style={{
                    background: "linear-gradient(135deg, #6C3EF4, #8B61FF)",
                    boxShadow: "0 0 20px rgba(108,62,244,0.4)",
                  }}
                >
                  先行特典を予約する
                </Link>
              </motion.div>
            </motion.div>

            <FadeInSection>
              <p className="text-center text-sm font-bold" style={{ color: "#BC78FF" }}>
                ※ 先着100名はLightプラン3ヶ月無料＋創設者バッジ付き
              </p>
            </FadeInSection>
          </div>
        </section>

        {/* ── Supported Tools ──────────────────────────────────── */}
        <SupportedToolsSection />

        {/* ── Learning Section ─────────────────────────────────── */}
        <div id="learning">
          <LearningSection onRegisterClick={() => {
            const el = document.getElementById("waitlist-section");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }} />
        </div>

        {/* ── FAQ ─────────────────────────────────────────────── */}
        <FAQAccordion />

        {/* ── Developer Message ────────────────────────────────── */}
        <DeveloperMessage />

        {/* ── Waitlist CTA ─────────────────────────────────────── */}
        <section
          id="waitlist-section"
          className="py-24 relative overflow-hidden border-t border-b border-border/50"
          style={{ background: "rgba(15,22,41,0.5)" }}
        >
          <GlowOrb color="#6c3ef4" size={600} top="50%" left="50%" opacity={0.08} />
          <GlowOrb color="#00d4aa" size={300} top="10%" left="10%" opacity={0.06} />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(rgba(108,62,244,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(108,62,244,0.03) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />

          <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <FadeInSection>
              <motion.div
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border mb-8"
                style={{
                  background: "rgba(108,62,244,0.12)",
                  borderColor: "rgba(108,62,244,0.35)",
                  boxShadow: "0 0 16px rgba(108,62,244,0.15)",
                }}
                animate={{ boxShadow: ["0 0 16px rgba(108,62,244,0.15)", "0 0 28px rgba(108,62,244,0.3)", "0 0 16px rgba(108,62,244,0.15)"] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <span className="text-lg">🚀</span>
                <span className="text-sm font-bold text-primary">β版アーリーアクセス受付中</span>
              </motion.div>

              <h2 className="text-4xl font-black mb-4">今すぐ先行登録する</h2>
              <p className="text-muted mb-2">
                ProofMarkは現在、開発の最終フェーズにあります。初期メンバーとして参加し、AIクリエイターのための新しい基準を一緒に作りませんか？
              </p>
              <p className="text-muted mb-8 text-sm">スパムなし・クレカ不要。いつでも解除できます。</p>
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
                  { emoji: "🚀", text: "β版優先招待" },
                  { emoji: "🎁", text: "3ヶ月無料" },
                ].map((badge, i) => (
                  <motion.div
                    key={i}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold"
                    style={{
                      background: "rgba(21,29,47,0.7)",
                      borderColor: "rgba(42,42,78,0.7)",
                      backdropFilter: "blur(8px)",
                    }}
                    variants={slideInVariants}
                    whileHover={{ scale: 1.05, borderColor: "rgba(108,62,244,0.5)" }}
                  >
                    <span>{badge.emoji}</span>
                    {badge.text}
                  </motion.div>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(108, 62, 244, 0.1)", padding: "8px 16px", borderRadius: "100px", border: "1px solid rgba(108, 62, 244, 0.5)", boxShadow: "0 0 12px rgba(108, 62, 244, 0.4)" }}>
                  <img src={founderBadge} alt="Founder Badge" style={{ height: "16px", width: "16px" }} />
                  <span style={{ fontSize: "14px", fontWeight: "bold", color: "#BC78FF", whiteSpace: "nowrap" }}>Founderバッジ</span>
                </div>
              </motion.div>
            </FadeInSection>

            <FadeInSection delay={0.15}>
              <form onSubmit={handleWaitlistSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <label htmlFor="waitlist-email" className="sr-only">メールアドレス</label>
                <input
                  id="waitlist-email"
                  type="email"
                  placeholder="your@email.com"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  disabled={isWaitlistSubmitting}
                  className="flex-1 px-6 py-4 rounded-full border transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
                  style={{
                    background: "rgba(21,29,47,0.85)",
                    borderColor: "rgba(42,42,78,0.8)",
                    backdropFilter: "blur(8px)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "rgba(108,62,244,0.7)";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(108,62,244,0.15)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(42,42,78,0.8)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                  required
                  aria-label="ウェイティングリスト登録用のメールアドレス"
                />
                <motion.button
                  type="submit"
                  disabled={isWaitlistSubmitting}
                  className="px-8 py-4 rounded-full text-primary-foreground font-bold flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-70 disabled:cursor-wait"
                  style={{
                    background: "linear-gradient(135deg, #6c3ef4, rgba(108,62,244,0.85))",
                    boxShadow: "0 0 20px rgba(108,62,244,0.4)",
                  }}
                  variants={buttonVariants}
                  initial="rest"
                  whileHover="hover"
                  whileTap="tap"
                >
                  {isWaitlistSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      暗号化通信中...
                    </>
                  ) : "登録する"}
                </motion.button>
              </form>
              <p className="text-xs text-muted flex items-center justify-center gap-2 mt-3">
                <Lock className="w-4 h-4 text-accent" />
                メールアドレスはSSL/TLSで保護されます
              </p>
            </FadeInSection>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────── */}
      </div>
    </>
  );
}