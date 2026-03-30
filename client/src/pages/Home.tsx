import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Lock, Fingerprint, Database, AlertCircle, Check, Shield, Zap, Award, Info } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { CertificateMockup } from "@/components/CertificateMockup";
import { CertificateUpload } from "@/components/CertificateUpload";
import { FAQAccordion } from "@/components/FAQAccordion";
import { SupportedToolsSection } from "@/components/SupportedToolsSection";
import { DeveloperMessage } from "@/components/DeveloperMessage";
import { PrivacyFooter } from "@/components/PrivacyFooter";
import { sendConfirmationEmail } from "@/lib/email";
import LearningSection from "@/components/LearningSection";
import { SchemaScript } from "@/components/SchemaScript";
import navbarLogo from "../assets/logo/navbar/proofmark-navbar-symbol-dark.svg";
import {
  fadeInVariants,
  slideInVariants,
  staggerContainer,
  buttonVariants,
  heroTextVariants,
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

/**
 * ProofMark Landing Page — Manus-style Rich Dark Theme
 */
export default function Home() {
  const [heroEmail, setHeroEmail] = useState("");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [isHeroSubmitting, setIsHeroSubmitting] = useState(false);
  const [isWaitlistSubmitting, setIsWaitlistSubmitting] = useState(false);

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
      <div id="top" className="min-h-screen bg-background text-foreground overflow-x-hidden">

        {/* ── Navigation ──────────────────────────────────────── */}
        <motion.nav
          className="sticky top-0 z-50 border-b border-border/50"
          style={{ backdropFilter: "blur(16px)", background: "rgba(10,14,39,0.85)" }}
          initial={{ y: -64, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <motion.div
              className="flex items-center gap-3"
              whileHover={{ scale: 1.03 }}
              transition={{ duration: 0.15 }}
            >
              <img src={navbarLogo} alt="ProofMark Logo" style={{ height: "32px", width: "auto" }} />
              <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "24px", fontWeight: 800, letterSpacing: "-0.5px", color: "#F0EFF8" }}>
                Proof<span style={{ color: "#00D4AA" }}>Mark</span>
              </span>
            </motion.div>
            <Link
              href="/auth"
              style={{ background: "#6C3EF4", color: "#FFF", padding: "8px 20px", borderRadius: "8px", textDecoration: "none", fontWeight: "bold", fontSize: "14px", transition: "opacity 0.2s" }}
            >
              ログイン / 登録
            </Link>
          </div>
        </motion.nav>

        {/* ── Hero Section ────────────────────────────────────── */}
        <section className="relative min-h-[90vh] flex items-center overflow-hidden">
          {/* Background orbs */}
          <GlowOrb color="#6c3ef4" size={520} top="-10%" left="-8%" opacity={0.18} />
          <GlowOrb color="#00d4aa" size={380} top="50%" left="60%" opacity={0.12} />
          <GlowOrb color="#6c3ef4" size={260} top="70%" left="10%" opacity={0.1} />

          {/* Mesh grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(rgba(108,62,244,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(108,62,244,0.04) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />

          {/* Hero image (low opacity) */}
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
            <div className="max-w-2xl">
              {/* Badge */}
              <motion.div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-8"
                style={{
                  background: "rgba(108,62,244,0.12)",
                  borderColor: "rgba(108,62,244,0.35)",
                  boxShadow: "0 0 12px rgba(108,62,244,0.15)",
                }}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <AlertCircle className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-primary">先着100名限定</span>
              </motion.div>

              {/* Main heading */}
              <h1 style={{ 
                fontSize: "clamp(40px, 8vw, 64px)", 
                fontWeight: 900, 
                lineHeight: 1.2, 
                letterSpacing: "-1.5px", 
                color: "#F0EFF8", 
                marginBottom: "24px",
                wordBreak: "keep-all"
              }}>
                <span style={{ display: "inline-block", whiteSpace: "nowrap" }}>「どうせAIでしょ？」と</span>
                <br />
                <span style={{ 
                  display: "inline-block", 
                  whiteSpace: "nowrap",
                  background: "linear-gradient(90deg, #6C3EF4 0%, #00D4AA 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  color: "transparent"
                }}>言わせない。</span>
              </h1>

              {/* Subheading */}
              <motion.p
                className="text-lg text-muted mb-8 leading-relaxed max-w-xl"
                variants={fadeInVariants}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.5 }}
              >
                あなたの創作の「事実」を、一生消えない証拠に。運営のWebサーバーを一切経由しない「Direct Upload」方式を採用。作品データはセキュアなストレージへ直接暗号化転送され、改ざん不能なデジタル指紋を生成します。
              </motion.p>

              {/* Hero form */}
              <motion.form
                onSubmit={handleHeroSubmit}
                className="flex flex-col sm:flex-row gap-3 mb-6 max-w-md w-full"
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
                  ) : "無料で先行登録 →"}
                </motion.button>
              </motion.form>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                <p className="text-xs text-muted flex items-center gap-2 mb-3">
                  <Lock className="w-4 h-4 text-accent" />
                  メールアドレスはSSL/TLSで保護されます
                </p>
                <p className="text-sm text-muted">
                  <span className="text-[#ffd966] font-bold">🎁 先着100名限定</span>：β版優先招待 + 3ヶ月無料 + 創設者バッジ<br />
                  クレジットカード不要・いつでも解除OK
                </p>
              </motion.div>
            </div>
          </motion.div>
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
                      className="text-2xl font-black mb-1"
                      style={{
                        backgroundImage: "linear-gradient(135deg, #6c3ef4, #00d4aa)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                      }}
                    >
                      {stat.value}
                    </div>
                    <div className="text-xs text-muted">{stat.label}</div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </FadeInSection>

        {/* ── How It Works ────────────────────────────────────── */}
        <section id="how-it-works" className="py-24 relative overflow-hidden">
          <GlowOrb color="#6c3ef4" size={400} top="0%" left="70%" opacity={0.08} />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <FadeInSection className="text-center mb-16">
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold text-accent mb-4"
                style={{ background: "rgba(0,212,170,0.1)", border: "1px solid rgba(0,212,170,0.25)" }}
              >
                <Zap className="w-3 h-3" /> HOW IT WORKS
              </div>
              <h2 className="text-4xl font-black mb-4">3ステップで「先取権」を確定</h2>
              <p className="text-muted max-w-2xl mx-auto">
                あなたの作品を、未来に残る証拠に変える仕組み
              </p>
            </FadeInSection>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
            >
              {[
                {
                  icon: <Lock className="w-8 h-8 text-primary" />,
                  number: "01",
                  title: "ブラウザ内ハッシュ計算",
                  desc: "ハッシュ計算はブラウザ内で完結し、サーバーに負荷や情報を渡しません。（※公開ポートフォリオ用の画像のみ、暗号化通信でセキュアクラウドに安全に保管されます）",
                  glow: "rgba(108,62,244,0.15)",
                },
                {
                  icon: <Fingerprint className="w-8 h-8 text-accent" />,
                  number: "02",
                  title: "デジタル指紋（SHA-256）",
                  desc: "あなたの作品固有の「デジタル指紋」を不可逆な暗号技術で生成。データベースにはこの指紋とタイムスタンプのみが強固に記録されます。",
                  glow: "rgba(0,212,170,0.15)",
                },
                {
                  icon: <Database className="w-8 h-8 text-primary" />,
                  number: "03",
                  title: "セキュアクラウド保存",
                  desc: "国内の高度なセキュリティ要件を満たすクラウドサーバーに、あなたの存在証明とタイムスタンプを改ざん不可能な形で記録します。",
                  glow: "rgba(108,62,244,0.15)",
                },
              ].map((step, i) => (
                <motion.div
                  key={i}
                  className="relative p-8 rounded-2xl border overflow-hidden group"
                  style={{
                    background: "rgba(21,29,47,0.8)",
                    backdropFilter: "blur(12px)",
                    borderColor: "rgba(42,42,78,0.7)",
                  }}
                  variants={slideInVariants}
                  whileHover={{
                    borderColor: "rgba(108,62,244,0.45)",
                    boxShadow: `0 0 30px ${step.glow}`,
                    y: -4,
                  }}
                  transition={{ duration: 0.25 }}
                >
                  {/* Step number watermark */}
                  <span
                    className="absolute top-4 right-6 text-6xl font-black opacity-5 select-none pointer-events-none"
                    style={{ color: "#6c3ef4" }}
                  >
                    {step.number}
                  </span>

                  <motion.div
                    className="mb-6 w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: "rgba(15,22,41,0.8)", border: "1px solid rgba(42,42,78,0.6)" }}
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ duration: 0.2 }}
                  >
                    {step.icon}
                  </motion.div>

                  <h3 className="text-lg font-bold mb-3">{step.title}</h3>
                  <p className="text-muted text-sm leading-relaxed">{step.desc}</p>

                  {/* Bottom accent line */}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: "linear-gradient(90deg, #6c3ef4, #00d4aa)" }}
                  />
                </motion.div>
              ))}
            </motion.div>

            {/* Badges */}
            <FadeInSection>
              <div className="flex flex-wrap justify-center gap-3 mb-16">
                {[
                  { icon: <Check className="w-4 h-4" />, text: "C2PA対応予定", color: "accent" },
                  { icon: <Lock className="w-4 h-4" />, text: "ブラウザ内処理", color: "primary" },
                  { icon: <Database className="w-4 h-4" />, text: "セキュア保存", color: "accent" },
                ].map((badge, i) => (
                  <motion.div
                    key={i}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold"
                    style={{
                      background: "rgba(21,29,47,0.7)",
                      borderColor: "rgba(42,42,78,0.7)",
                      backdropFilter: "blur(8px)",
                    }}
                    whileHover={{ scale: 1.05, borderColor: "rgba(108,62,244,0.5)" }}
                    transition={{ duration: 0.15 }}
                  >
                    <span className={badge.color === "accent" ? "text-accent" : "text-primary"}>
                      {badge.icon}
                    </span>
                    {badge.text}
                  </motion.div>
                ))}
              </div>
            </FadeInSection>

            <FadeInSection>
              <CertificateMockup />
            </FadeInSection>

            {/* ── Upload Demo ────────────────────────────────── */}
            <FadeInSection delay={0.1} className="mt-12">
              <div className="text-center mb-6">
                <div
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold text-primary mb-3"
                  style={{
                    background: "rgba(108,62,244,0.1)",
                    border: "1px solid rgba(108,62,244,0.25)",
                  }}
                >
                  ⬡ 証明書を発行する
                </div>
                <h3 className="text-2xl font-black mb-2">作品をアップロードして証明を開始</h3>
                <p className="text-muted text-sm max-w-lg mx-auto">
                  ハッシュ計算はブラウザ内で完結します。ポートフォリオ公開用の作品データは、堅牢なクラウドストレージへ直接暗号化転送され、プライバシーは最大限保護されます。
                </p>
              </div>
              <div className="max-w-2xl mx-auto">
                <CertificateUpload
                  onUploadComplete={(path) => {
                    console.info("[ProofMark] アップロード完了:", path);
                  }}
                />
              </div>
            </FadeInSection>
          </div>
        </section>

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
                  {/* Tag */}
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
                まずは大幅増枠した無料プラン（月30件）で、あなたの創作に安心をプラスしませんか？
              </p>
            </FadeInSection>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-8"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {/* ── Free plan ── */}
              <motion.div
                className="p-8 rounded-2xl border relative overflow-hidden"
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
                <p className="text-sm text-muted mb-6">まずは試したい方</p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                    <span>
                      Webタイムスタンプ証明{" "}
                      <span
                        className="ml-1 text-xs font-bold px-2 py-0.5 rounded-full"
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
                    <span className="line-through">PDF証明書</span>
                  </li>
                </ul>
                <motion.a
                  href="#waitlist-section"
                  className="block w-full px-6 py-3 rounded-full border font-bold text-sm transition-colors text-center"
                  style={{ borderColor: "rgba(108,62,244,0.4)", color: "#6c3ef4" }}
                  whileHover={{ background: "rgba(108,62,244,0.12)" }}
                  whileTap={{ scale: 0.98 }}
                >
                  無料で始める
                </motion.a>
              </motion.div>

              {/* ── Light plan ── */}
              <motion.div
                className="p-8 rounded-2xl relative overflow-hidden"
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
                <ul className="space-y-3 mb-8">
                  {[
                    "Webタイムスタンプ証明 無制限",
                    "PDF証明書（無制限）",
                    "C2PAメタデータ読取（対応予定）",
                    "制作工程アップロード",
                    "全データエクスポート",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-accent flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <motion.a
                  href="#waitlist-section"
                  className="block w-full px-6 py-3 rounded-full font-bold text-sm text-primary-foreground text-center"
                  style={{
                    background: "linear-gradient(135deg, #6c3ef4, rgba(108,62,244,0.8))",
                    boxShadow: "0 0 20px rgba(108,62,244,0.4)",
                  }}
                  whileHover={{ boxShadow: "0 0 32px rgba(108,62,244,0.6)", scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  先行特典を予約（Lightプラン）
                </motion.a>
              </motion.div>
            </motion.div>

            {/* Single-shot plan note */}
            <FadeInSection>
              <div className="flex items-start justify-center gap-2 mb-4">
                <Info className="w-4 h-4 text-muted flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted">
                  必要な時だけ、1回100円からPDF証明書を発行できる単発プランも準備中です。
                </p>
              </div>
              <p className="text-center text-sm text-muted">
                ※ 先着100名はLightプラン3ヶ月無料＋創設者バッジ付き
              </p>
            </FadeInSection>
          </div>
        </section>

        {/* ── Supported Tools ──────────────────────────────────── */}
        <SupportedToolsSection />

        {/* ── Learning Section (順序を最適化) ──────────────────── */}
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

        {/* ── Waitlist CTA (最後に強く背中を押す) ───────────────── */}
        <section
          id="waitlist-section"
          className="py-24 relative overflow-hidden border-t border-b border-border/50"
          style={{ background: "rgba(15,22,41,0.5)" }}
        >
          <GlowOrb color="#6c3ef4" size={600} top="50%" left="50%" opacity={0.08} />
          <GlowOrb color="#00d4aa" size={300} top="10%" left="10%" opacity={0.06} />

          {/* Mesh grid */}
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
                  { emoji: "🏅", text: "創設者バッジ" },
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
        <PrivacyFooter />
      </div>
    </>
  );
}