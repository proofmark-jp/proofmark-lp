import { useState } from "react";
import { toast } from "sonner";
import { Lock, Fingerprint, Database, AlertCircle, Check } from "lucide-react";
import { CertificateMockup } from "@/components/CertificateMockup";
import { FAQAccordion } from "@/components/FAQAccordion";
import { SupportedToolsSection } from "@/components/SupportedToolsSection";
import { DeveloperMessage } from "@/components/DeveloperMessage";
import { PrivacyFooter } from "@/components/PrivacyFooter";
import { sendConfirmationEmail } from "@/lib/email";
import LearningSection from "@/components/LearningSection";
import { SchemaScript } from "@/components/SchemaScript";

/**
 * ProofMark Landing Page
 * Design: Cyber-Minimalist Security (Professional Edition)
 * 
 * This is the main landing page for ProofMark, an AI artwork copyright verification service.
 * The design emphasizes security, trust, and premium quality through:
 * - Professional SVG icons (lucide-react) instead of emoji
 * - Deep navy background with cyan/purple accents
 * - Poppins (bold) + Inter (readable) typography
 * - Cybersecurity-focused visual metaphors
 * - Non-centered asymmetric layout
 * - Enhanced accessibility (a11y) and form UX
 */

export default function Home() {
  const [heroEmail, setHeroEmail] = useState("");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [isHeroSubmitting, setIsHeroSubmitting] = useState(false);
  const [isWaitlistSubmitting, setIsWaitlistSubmitting] = useState(false);

  // JSON-LD構造化データを挿入
  SchemaScript();

  const handleHeroSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!heroEmail) return;
    
    setIsHeroSubmitting(true);
    
    // Send confirmation email (Resend integration ready)
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
    
    // Send confirmation email (Resend integration ready)
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
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="sticky top-0 z-100 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-primary">⬡</span>
            <span className="text-2xl font-black text-primary">ProofMark</span>
          </div>
          <a 
            href="#waitlist" 
            className="px-6 py-2 rounded-full bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors"
          >
            先着100名の特典
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/10" />
        {/* Hero image */}
        <div className="absolute inset-0 opacity-30">
          <img 
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663365821234/UaD7q9pZxZRGqrDfYC425T/proofmark-hero-bg-JMfzwFshajssXPcJshrNUg.webp"
            alt="Security background"
            className="w-full h-full object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-2xl">
            {/* Tag */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-6">
              <AlertCircle className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-primary">先着100名限定</span>
            </div>

            {/* Main heading */}
            <h1 className="text-5xl sm:text-6xl font-black leading-tight mb-6">
              「どうせAIでしょ？」と<br />
              <span className="text-primary">言わせない。</span>
            </h1>

            {/* Subheading */}
            <p className="text-lg text-muted mb-8 leading-relaxed max-w-xl">
              あなたの創作の「事実」を、一生消えない証拠に。<br />
              画像を送信せず、SHA-256でデジタル指紋を生成。<br />
              タイムスタンプとともに改ざん不能な証拠を残します。
            </p>

            {/* Hero form */}
            <form onSubmit={handleHeroSubmit} className="flex flex-col sm:flex-row gap-3 mb-6 max-w-md w-full relative group">
              <label htmlFor="hero-email" className="sr-only">メールアドレス</label>
              <input
                id="hero-email"
                type="email"
                placeholder="your@email.com"
                value={heroEmail}
                onChange={(e) => setHeroEmail(e.target.value)}
                disabled={isHeroSubmitting}
                className="flex-1 px-6 py-4 rounded-full bg-card/80 backdrop-blur-sm border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                required
                aria-label="先行登録用のメールアドレス"
              />
              <button
                type="submit"
                disabled={isHeroSubmitting}
                className="px-8 py-4 rounded-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-wait flex items-center justify-center gap-2 whitespace-nowrap shadow-[0_0_20px_-5px_rgba(108,62,244,0.4)] hover:shadow-[0_0_25px_-5px_rgba(108,62,244,0.6)]"
              >
                {isHeroSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    暗号化通信中...
                  </>
                ) : "無料で先行登録 →"}
              </button>
            </form>
            <p className="text-xs text-muted flex items-center justify-center gap-2">
              <Lock className="w-4 h-4 text-accent" />
              メールアドレスはSSL/TLSで保護されます
            </p>

            {/* Note */}
            <p className="text-sm text-muted">
              <span className="text-gold font-bold">🎁 先着100名限定</span>：β版優先招待 + 3ヶ月無料 + 創設者バッジ<br />
              クレジットカード不要・いつでも解除OK
            </p>
          </div>
        </div>
      </section>

      {/* How it works section */}
      <section className="py-20 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-black text-center mb-4">3ステップで「先取権」を確定</h2>
          <p className="text-center text-muted mb-12 max-w-2xl mx-auto">
            あなたの作品を、未来に残る証拠に変える仕組み
          </p>

          {/* Steps grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {[
              { 
                icon: <Lock className="w-10 h-10 text-primary" />, 
                title: "1. 画像はブラウザ内処理", 
                desc: "データは一切サーバーに送信されません。ローカル環境で安全に処理を完結します。" 
              },
              { 
                icon: <Fingerprint className="w-10 h-10 text-accent" />, 
                title: "2. SHA-256ハッシュ生成", 
                desc: "作品固有の「デジタル指紋」を不可逆な暗号技術で生成し、改ざんを不可能にします。" 
              },
              { 
                icon: <Database className="w-10 h-10 text-primary" />, 
                title: "3. 3拠点分散タイムスタンプ", 
                desc: "東京・大阪・シンガポールのセキュアなサーバーに存在証明を分散記録します。" 
              },
            ].map((step, i) => (
              <div
                key={i}
                className="p-8 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all hover:shadow-[0_0_30px_-5px_rgba(108,62,244,0.15)] group"
              >
                <div className="mb-6 p-4 rounded-xl bg-secondary/50 inline-block group-hover:scale-110 transition-transform duration-300">
                  {step.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-muted text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {[
              { icon: <Check className="w-4 h-4" />, text: "C2PA準拠" },
              { icon: <Lock className="w-4 h-4" />, text: "画像非送信" },
              { icon: <Database className="w-4 h-4" />, text: "3拠点保存" },
            ].map((badge, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border"
              >
                <span className="text-accent">{badge.icon}</span>
                <span className="text-sm font-semibold">{badge.text}</span>
              </div>
            ))}
          </div>

          {/* Certificate mock */}
          <CertificateMockup />
        </div>
      </section>

      {/* Pain points section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-black text-center mb-4">こんな経験、ありませんか？</h2>
          <p className="text-center text-muted mb-12 max-w-2xl mx-auto">
            AIクリエイターが直面する、リアルな悩みと解決策
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                emoji: "😤",
                title: "「どうせAIでしょ？」と言われた",
                desc: "何時間も試行錯誤した作品を、たった一言で否定される悔しさ。",
              },
              {
                emoji: "😰",
                title: "作品を盗用されたが証拠がない",
                desc: "DMCA申請には「先に作った」証明が必要。でも手元に証拠が…。",
              },
              {
                emoji: "📁",
                title: "ポートフォリオに説得力が欲しい",
                desc: "自分の成長や実績を、信頼できる形でクライアントに伝えたい。",
              },
            ].map((pain, i) => (
              <div key={i} className="p-8 rounded-2xl bg-card border border-border">
                <div className="text-5xl mb-4">{pain.emoji}</div>
                <h3 className="text-lg font-bold mb-2">{pain.title}</h3>
                <p className="text-muted text-sm">{pain.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing section */}
      <section className="py-20 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-black text-center mb-4">料金プラン</h2>
          <p className="text-center text-muted mb-12 max-w-2xl mx-auto">
            シンプルで分かりやすい料金体系
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-8">
            {/* Free plan */}
            <div className="p-8 rounded-2xl bg-card border border-border">
              <h3 className="text-2xl font-bold mb-2">Free</h3>
              <div className="text-4xl font-black mb-6">
                ¥0<span className="text-lg text-muted font-normal">/月</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "証明書 10件まで",
                  "SHA-256ハッシュ",
                  "公開ポートフォリオ",
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-accent" />
                    <span>{feature}</span>
                  </li>
                ))}
                <li className="flex items-center gap-2 text-sm text-muted">
                  <span className="w-4 h-4">—</span>
                  <span>PDF証明書</span>
                </li>
              </ul>
              <button className="w-full px-6 py-3 rounded-full bg-primary text-white font-bold hover:bg-primary/90 transition-colors">
                無料で始める
              </button>
            </div>

            {/* Standard plan (featured) */}
            <div className="p-8 rounded-2xl bg-gradient-to-br from-card to-secondary border-2 border-primary shadow-lg shadow-primary/30">
              <h3 className="text-2xl font-bold mb-2">Standard</h3>
              <div className="text-4xl font-black mb-6">
                ¥980<span className="text-lg text-muted font-normal">/月</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "証明書 無制限",
                  "PDF証明書",
                  "C2PAメタデータ読取",
                  "制作工程アップロード",
                  "全データエクスポート",
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-accent" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button className="w-full px-6 py-3 rounded-full bg-primary text-white font-bold hover:bg-primary/90 transition-colors">
                先行特典を予約
              </button>
            </div>
          </div>

          <p className="text-center text-sm text-muted">
            ※ 先着100名はStandardプラン3ヶ月無料＋創設者バッジ付き
          </p>
        </div>
      </section>

      {/* Supported Tools */}
      <SupportedToolsSection />

      {/* FAQ Section */}
      <FAQAccordion />

      {/* Developer Message */}
      <DeveloperMessage />

      {/* Waitlist section */}
      <section id="waitlist-section" className="py-20 border-t border-b border-border">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary/10 border border-primary/30 mb-6">
            <span className="text-lg">🚀</span>
            <span className="text-sm font-bold text-primary">β版アーリーアクセス受付中</span>
          </div>

          <h2 className="text-4xl font-black mb-4">今すぐ先行登録する</h2>
          <p className="text-muted mb-4">
            ProofMarkは現在、開発の最終フェーズにあります。初期メンバーとして参加し、AIクリエイターのための新しい基準を一緒に作りませんか？
          </p>
          <p className="text-muted mb-8">
            スパムなし・クレカ不要。いつでも解除できます。
          </p>

          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {[
              { emoji: "🚀", text: "β版優先招待" },
              { emoji: "🎁", text: "3ヶ月無料" },
              { emoji: "🏅", text: "創設者バッジ" },
            ].map((badge, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border"
              >
                <span className="text-lg">{badge.emoji}</span>
                <span className="text-sm font-semibold">{badge.text}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleWaitlistSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <label htmlFor="waitlist-email" className="sr-only">メールアドレス</label>
            <input
              id="waitlist-email"
              type="email"
              placeholder="your@email.com"
              value={waitlistEmail}
              onChange={(e) => setWaitlistEmail(e.target.value)}
              disabled={isWaitlistSubmitting}
              className="flex-1 px-6 py-4 rounded-full bg-card border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              required
              aria-label="ウェイティングリスト登録用のメールアドレス"
            />
            <button
              type="submit"
              disabled={isWaitlistSubmitting}
              className="px-8 py-4 rounded-full bg-primary text-white font-bold hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-wait flex items-center justify-center gap-2 whitespace-nowrap shadow-[0_0_20px_-5px_rgba(108,62,244,0.4)] hover:shadow-[0_0_25px_-5px_rgba(108,62,244,0.6)]"
            >
              {isWaitlistSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  暗号化通信中...
                </>
              ) : "登録する"}
            </button>
            <p className="text-xs text-muted flex items-center justify-center gap-2">
              <Lock className="w-4 h-4 text-accent" />
              メールアドレスはSSL/TLSで保護されます
            </p>
          </form>
        </div>
      </section>

      {/* Learning Section */}
      <LearningSection onRegisterClick={() => {
        const waitlistSection = document.getElementById('waitlist-section');
        if (waitlistSection) {
          waitlistSection.scrollIntoView({ behavior: 'smooth' });
        }
      }} />

      {/* Privacy by Design Footer */}
      <PrivacyFooter />
    </div>
    </>
  );
}
