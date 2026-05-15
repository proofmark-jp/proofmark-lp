import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, ShieldAlert, AlertTriangle, Info, ShieldCheck, Download, Code, CheckCircle2, ChevronRight, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SEO from "../components/SEO";

const CodeBlock = ({ language, code }: { language: string; code: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("コピーしました");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-6 rounded-xl overflow-hidden border border-white/5 shadow-2xl">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1C1A38]/80 border-b border-white/5 backdrop-blur-sm">
        <span className="text-xs font-bold text-[#A8A0D8] uppercase tracking-widest">{language}</span>
        <button
          onClick={handleCopy}
          className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-[#A8A0D8] hover:text-white"
          aria-label="コードをコピー"
        >
          {copied ? <Check className="w-4 h-4 text-[#00D4AA]" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <div className="p-4 bg-[#0B0A1F] border-l-4 border-[#6C3EF4] overflow-x-auto">
        <pre className="text-sm font-mono text-[#F0EFF8] leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};

const Callout = ({ type, children }: { type: 'info' | 'warning' | 'shield'; children: React.ReactNode }) => {
  const styles = {
    info: "bg-[#6C3EF4]/10 border-[#6C3EF4]/30 text-[#E8E6FF]",
    warning: "bg-[#F0BB38]/10 border-[#F0BB38]/30 text-[#E8D4A0]",
    shield: "bg-[#00D4AA]/10 border-[#00D4AA]/30 text-[#A0E8D8]"
  };

  const icons = {
    info: <Info className="w-5 h-5 text-[#6C3EF4] mt-0.5 flex-shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-[#F0BB38] mt-0.5 flex-shrink-0" />,
    shield: <ShieldCheck className="w-5 h-5 text-[#00D4AA] mt-0.5 flex-shrink-0" />
  };

  return (
    <div className={`my-6 p-5 rounded-xl border flex gap-4 backdrop-blur-sm leading-relaxed text-sm ${styles[type]}`}>
      {icons[type]}
      <div>{children}</div>
    </div>
  );
};

const SectionData = [
  { id: "s1", title: "§1 脅威モデル" },
  { id: "s2", title: "§2 SHA-256" },
  { id: "s3", title: "§3 RFC3161" },
  { id: "s4", title: "§4 TSA選定" },
  { id: "s5", title: "§5 DB/RLS" },
  { id: "s6", title: "§6 データフロー" },
  { id: "s7", title: "§7 第三者検証" },
  { id: "s8", title: "§8 制限事項" },
  { id: "s9", title: "§9 更新履歴" },
  { id: "sa", title: "§A Appendix" },
];

export default function TrustCenter() {
  const [activeId, setActiveId] = useState("s1");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -80% 0px" }
    );

    SectionData.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const sectionVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] font-sans selection:bg-[#6C3EF4]/30 selection:text-white">
      <SEO
        title="ProofMark セキュリティ白書 | RFC3161・SHA-256による技術証明の全貌"
        description="AI生成作品の真正性を証明する暗号アーキテクチャの完全仕様。SHA-256・RFC3161・Supabase RLSの実装詳細を完全公開します。"
        url="https://proofmark.jp/trust-center"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "TechArticle",
          "name": "ProofMark Technical Security Whitepaper",
          "headline": "Cryptographic Proof-of-Creation Architecture for AI-Generated Digital Works",
          "description": "AI生成作品の真正性を証明する暗号アーキテクチャの完全仕様。",
          "author": {
            "@type": "Organization",
            "name": "ProofMark Security",
            "url": "https://proofmark.jp"
          }
        }}
      />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24 flex flex-col md:flex-row gap-12">
        {/* TOC Sidebar */}
        <aside className="hidden md:block w-64 flex-shrink-0">
          <div className="sticky top-32">
            <h4 className="text-xs font-black text-[#A8A0D8] uppercase tracking-[0.15em] mb-6">目次</h4>
            <nav className="flex flex-col gap-1">
              {SectionData.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className={`text-left px-4 py-2.5 rounded-lg text-sm transition-all flex items-center gap-3 border-l-2 ${activeId === item.id
                    ? "bg-[#6C3EF4]/10 text-white font-bold border-[#6C3EF4]"
                    : "text-[#A8A0D8] border-transparent hover:text-white hover:bg-white/5"
                    }`}
                >
                  <span className="font-mono text-xs text-[#6C3EF4] w-5">{item.title.split(' ')[0]}</span>
                  <span>{item.title.substring(item.title.indexOf(' ') + 1)}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 max-w-3xl">

          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-16 border-b border-white/10 pb-12"
          >
            <div className="flex items-center gap-3 mb-6">
              <span className="text-[#00D4AA] text-xs font-bold tracking-[0.15em] uppercase">Trust Center</span>
              <span className="text-white/20">/</span>
              <span className="text-[#A8A0D8] text-xs font-bold tracking-[0.15em] uppercase">Technical Whitepaper</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.1] tracking-tight mb-6">
              Technical Security<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6C3EF4] to-[#00D4AA]">Whitepaper</span>
            </h1>

            <div className="text-sm text-gray-400 -mt-2 mb-8 flex items-center gap-1.5">
              <span>Written by:</span>
              <a
                href="https://x.com/ProofMark_jp"
                target="_blank"
                rel="noopener"
                className="font-bold text-[#F0EFF8] hover:text-[#00D4AA] transition-colors decoration-[#00D4AA] underline-offset-4 hover:underline"
              >
                ProofMark Security Team
              </a>
            </div>

            <p className="text-lg text-[#A8A0D8] leading-relaxed mb-8 max-w-2xl">
              AI生成作品の真正性を証明する暗号アーキテクチャの完全仕様。SHA-256・RFC3161・Supabase RLSの実装詳細を完全公開します。
            </p>

            <div className="flex flex-wrap items-center gap-4 mb-8">
              <a
                href="/documents/ProofMark Whitepaper v1.0.pdf"
                download
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#6C3EF4] hover:bg-[#8B61FF] text-white rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(108,62,244,0.4)] hover:-translate-y-0.5"
              >
                <Download className="w-4 h-4" /> PDF ダウンロード (v1.0)
              </a>
              <a
                href="#sa"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#1C1A38] hover:bg-[#2A2654] border border-[#2A284D] text-[#E8E6FF] rounded-xl font-bold transition-all hover:border-[#6C3EF4]"
              >
                <Code className="w-4 h-4" /> 検証スクリプト (GitHub)
              </a>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-[#0D0B24] border border-[#1C1A38] rounded-2xl">
              <div>
                <p className="text-[10px] text-[#A8A0D8] uppercase tracking-wider font-bold mb-1">Version</p>
                <p className="font-mono text-sm text-white">v1.0 — April 2026</p>
              </div>
              <div>
                <p className="text-[10px] text-[#A8A0D8] uppercase tracking-wider font-bold mb-1">Status</p>
                <p className="font-mono text-sm text-[#00D4AA]">Public Beta</p>
              </div>
              <div>
                <p className="text-[10px] text-[#A8A0D8] uppercase tracking-wider font-bold mb-1">Standards</p>
                <p className="font-mono text-sm text-white">RFC3161 · SHA-256</p>
              </div>
              <div>
                <p className="text-[10px] text-[#A8A0D8] uppercase tracking-wider font-bold mb-1">Author</p>
                <p className="font-sans text-sm text-white">ProofMark Security</p>
              </div>
            </div>
          </motion.div>

          {/* §1 */}
          <motion.section id="s1" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="mb-20 scroll-mt-32">
            <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/10">
              <span className="font-mono bg-[#6C3EF4] text-white px-2 py-1 rounded text-sm font-bold">§1</span>
              <h2 className="text-2xl font-bold text-white tracking-tight">脅威モデル & 信頼境界</h2>
            </div>

            <p className="text-[#A8A0D8] leading-relaxed mb-6">
              暗号システムを評価する前に、脅威モデルを明確にする必要があります。ProofMarkは特定の、限定された主張に対処します。
            </p>

            <h3 className="flex items-center gap-2 text-[#00D4AA] font-bold text-lg mb-4 mt-10">
              <div className="w-1 h-5 bg-[#00D4AA] rounded-full" /> 唯一の検証可能な主張
            </h3>

            <div className="bg-[#0D0B24] border-l-4 border-[#00D4AA] border border-[#1C1A38] rounded-xl p-5 mb-8 font-mono text-sm leading-relaxed text-white">
              <strong className="text-[#00D4AA]">Claim:</strong> SHA-256ハッシュ <strong className="text-white">H</strong> を持つファイルが、信頼された第三者TSAによって証明されたタイムスタンプ <strong className="text-white">T</strong> の時点で、改ざんされていない状態で存在していた。
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <div className="bg-[#00D4AA]/5 border border-[#00D4AA]/20 rounded-xl p-6">
                <h4 className="text-xs font-bold tracking-widest text-[#00D4AA] uppercase mb-4">✓ In Scope（証明できること）</h4>
                <ul className="space-y-3">
                  <li className="flex gap-3 text-sm text-[#E8E6FF]"><CheckCircle2 className="w-4 h-4 text-[#00D4AA] flex-shrink-0 mt-0.5" /> 時刻Tにおけるファイル完全性</li>
                  <li className="flex gap-3 text-sm text-[#E8E6FF]"><CheckCircle2 className="w-4 h-4 text-[#00D4AA] flex-shrink-0 mt-0.5" /> タイムスタンプの否認不可性</li>
                  <li className="flex gap-3 text-sm text-[#E8E6FF]"><CheckCircle2 className="w-4 h-4 text-[#00D4AA] flex-shrink-0 mt-0.5" /> 第三者による独立検証</li>
                  <li className="flex gap-3 text-sm text-[#E8E6FF]"><CheckCircle2 className="w-4 h-4 text-[#00D4AA] flex-shrink-0 mt-0.5" /> 発行後はProofMark依存なし</li>
                </ul>
              </div>
              <div className="bg-[#F0BB38]/5 border border-[#F0BB38]/20 rounded-xl p-6">
                <h4 className="text-xs font-bold tracking-widest text-[#F0BB38] uppercase mb-4">✗ Out of Scope（証明できないこと）</h4>
                <ul className="space-y-3">
                  <li className="flex gap-3 text-sm text-[#E8E6FF]"><AlertTriangle className="w-4 h-4 text-[#F0BB38] flex-shrink-0 mt-0.5" /> 著作権の帰属</li>
                  <li className="flex gap-3 text-sm text-[#E8E6FF]"><AlertTriangle className="w-4 h-4 text-[#F0BB38] flex-shrink-0 mt-0.5" /> 芸術的独自性</li>
                  <li className="flex gap-3 text-sm text-[#E8E6FF]"><AlertTriangle className="w-4 h-4 text-[#F0BB38] flex-shrink-0 mt-0.5" /> 世界初の創作であること</li>
                  <li className="flex gap-3 text-sm text-[#E8E6FF]"><AlertTriangle className="w-4 h-4 text-[#F0BB38] flex-shrink-0 mt-0.5" /> AI生成コンテンツの合法性</li>
                </ul>
              </div>
            </div>

            <h3 className="flex items-center gap-2 text-[#00D4AA] font-bold text-lg mb-4 mt-8">
              <div className="w-1 h-5 bg-[#00D4AA] rounded-full" /> Adversary Model
            </h3>

            <div className="overflow-x-auto rounded-xl border border-white/10 mb-8">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#6C3EF4] text-white">
                  <tr>
                    <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider">攻撃者</th>
                    <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider">能力</th>
                    <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider">ProofMarkの防御</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr className="bg-[#0D0B24] hover:bg-[#1C1A38]/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-[#6C3EF4]">主張偽造</td>
                    <td className="px-6 py-4 text-[#A8A0D8]">先に作ったと主張</td>
                    <td className="px-6 py-4 text-white">TSAタイムスタンプが事実を証明；ハッシュ衝突は不可能（2¹²⁸）</td>
                  </tr>
                  <tr className="bg-[#07061A] hover:bg-[#1C1A38]/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-[#6C3EF4]">ファイル改ざん</td>
                    <td className="px-6 py-4 text-[#A8A0D8]">タイムスタンプ後に改ざん</td>
                    <td className="px-6 py-4 text-white">SHA-256ダイジェストが即座に無効化；第三者が検証可能</td>
                  </tr>
                  <tr className="bg-[#0D0B24] hover:bg-[#1C1A38]/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-[#6C3EF4]">タイムスタンプ再利用</td>
                    <td className="px-6 py-4 text-[#A8A0D8]">古いTSTを新ファイルに</td>
                    <td className="px-6 py-4 text-white">TSTはhash+nonceをバインド；暗号的に検知可能</td>
                  </tr>
                  <tr className="bg-[#07061A] hover:bg-[#1C1A38]/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-[#6C3EF4]">サーバー侵害</td>
                    <td className="px-6 py-4 text-[#A8A0D8]">DBハッシュ漏洩</td>
                    <td className="px-6 py-4 text-white">ハッシュは公開安全；Private Proofモードでは原画なし</td>
                  </tr>
                  <tr className="bg-[#0D0B24] hover:bg-[#1C1A38]/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-[#6C3EF4]">TSA共謀</td>
                    <td className="px-6 py-4 text-[#A8A0D8]">偽タイムスタンプ発行</td>
                    <td className="px-6 py-4 text-white">TSA選定（§4）+ RFC3161チェーン検証で軽減</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.section>

          {/* §2 */}
          <motion.section id="s2" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="mb-20 scroll-mt-32">
            <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/10">
              <span className="font-mono bg-[#6C3EF4] text-white px-2 py-1 rounded text-sm font-bold">§2</span>
              <h2 className="text-2xl font-bold text-white tracking-tight">暗号ハッシュ — SHA-256 via Web Crypto API</h2>
            </div>

            <p className="text-[#A8A0D8] leading-relaxed mb-6">
              ProofMarkはブラウザネイティブの <strong className="text-white">Web Crypto API</strong>（W3C仕様）を使用し、SHA-256ダイジェストを完全にクライアントサイドで計算します。Private Proofモードでは原画はサーバーに一切送信されません。
            </p>

            <h3 className="flex items-center gap-2 text-[#00D4AA] font-bold text-lg mb-4 mt-8">
              <div className="w-1 h-5 bg-[#00D4AA] rounded-full" /> 実装コード
            </h3>

            <CodeBlock language="TypeScript" code={`// ProofMark client-side hashing pipeline\n// Requires: SubtleCrypto (window.crypto.subtle)\n\nasync function computeProofHash(file: File): Promise<string> {\n  // 1. 非対応ブラウザを明示的に拒否 — フォールバックなし\n  if (!window.crypto?.subtle) {\n    throw new Error("SubtleCrypto unavailable — use a modern browser");\n  }\n  // 2. ArrayBufferとして読み込み（ブラウザメモリ内で完結）\n  const buffer = await file.arrayBuffer();\n  // 3. SHA-256計算 — ハードウェアアクセラレーション\n  const hashBuffer = await window.crypto.subtle.digest("SHA-256", buffer);\n  // 4. 小文字hex文字列（64文字）にエンコード\n  return Array.from(new Uint8Array(hashBuffer))\n    .map(b => b.toString(16).padStart(2, "0")).join("");\n}`} />

            <Callout type="warning">
              <strong className="text-white font-bold">⚠ No-Fallback Policy.</strong> SubtleCryptoが利用できない場合（非HTTPS、レガシーブラウザ）、UIは明示的なエラーを表示します。JSポリフィルへのサイレントフォールバックは行いません。
            </Callout>

            <h3 className="flex items-center gap-2 text-[#00D4AA] font-bold text-lg mb-4 mt-8">
              <div className="w-1 h-5 bg-[#00D4AA] rounded-full" /> SHA-256のセキュリティ特性
            </h3>

            <div className="overflow-x-auto rounded-xl border border-white/10 mb-8">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#6C3EF4] text-white">
                  <tr>
                    <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider">特性</th>
                    <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider">値 / 保証</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr className="bg-[#0D0B24] hover:bg-[#1C1A38]/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-[#6C3EF4]">出力サイズ</td>
                    <td className="px-6 py-4 text-white">256ビット（32バイト）— 64文字hex</td>
                  </tr>
                  <tr className="bg-[#07061A] hover:bg-[#1C1A38]/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-[#6C3EF4]">衝突耐性</td>
                    <td className="px-6 py-4 text-white">2¹²⁸回演算（誕生日攻撃の下界）</td>
                  </tr>
                  <tr className="bg-[#0D0B24] hover:bg-[#1C1A38]/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-[#6C3EF4]">原像耐性</td>
                    <td className="px-6 py-4 text-white">2²⁵⁶回演算 — 計算的に不可能</td>
                  </tr>
                  <tr className="bg-[#07061A] hover:bg-[#1C1A38]/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-[#6C3EF4]">雪崩効果</td>
                    <td className="px-6 py-4 text-white">1ビット変化 → 出力の約50%が変化</td>
                  </tr>
                  <tr className="bg-[#0D0B24] hover:bg-[#1C1A38]/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-[#6C3EF4]">標準</td>
                    <td className="px-6 py-4 text-white">NIST FIPS 180-4 — TLS 1.3、Git、Bitcoinでも使用</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.section>

          {/* §3 */}
          <motion.section id="s3" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="mb-20 scroll-mt-32">
            <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/10">
              <span className="font-mono bg-[#6C3EF4] text-white px-2 py-1 rounded text-sm font-bold">§3</span>
              <h2 className="text-2xl font-bold text-white tracking-tight">RFC3161 タイムスタンプ — アーキテクチャ & 信頼チェーン</h2>
            </div>

            <p className="text-[#A8A0D8] leading-relaxed mb-6">
              RFC3161は、ハッシュ値を特定の時刻にバインドする暗号的に安全なプロトコルを定義します。生成されたTime-Stamp Token（TST）は、ProofMarkを信頼することなく独立して検証可能です。
            </p>

            <h3 className="flex items-center gap-2 text-[#00D4AA] font-bold text-lg mb-4 mt-8">
              <div className="w-1 h-5 bg-[#00D4AA] rounded-full" /> プロトコルフロー
            </h3>

            <div className="rounded-xl border border-white/10 overflow-hidden mb-8">
              <ul className="divide-y divide-white/5">
                {[
                  { fn: "①", fa: "Browser", fd: "SHA-256(file) を計算 → ダイジェストH（32バイト）" },
                  { fn: "②", fa: "Browser", fd: "暗号ノンスN生成（リプレイ攻撃防止）" },
                  { fn: "③", fa: "Browser", fd: "TimeStampReq := { hashAlgorithm: SHA-256, hash: H, nonce: N, certReq: true }" },
                  { fn: "④", fa: "→ TSA", fd: "TSAへHTTPS POST — ハッシュのみ送信、ファイルは送信しない" },
                  { fn: "⑤", fa: "TSA", fd: "{ hash, time, cert } を秘密鍵で署名 → TST生成" },
                  { fn: "⑥", fa: "→ DB", fd: "TST（DER/base64）をSupabaseに保存" },
                  { fn: "⑦", fa: "第三者", fd: "TSA公開鍵でTSTを検証 — ProofMark不要" }
                ].map((item, i) => (
                  <li key={i} className={`flex items-start gap-4 p-4 ${i % 2 === 0 ? "bg-[#0D0B24]" : "bg-[#07061A]"}`}>
                    <span className="font-mono font-bold text-[#6C3EF4] w-6 shrink-0">{item.fn}</span>
                    <span className="font-bold text-[#00D4AA] text-xs mt-0.5 w-16 shrink-0">{item.fa}</span>
                    <span className="text-sm text-[#F0EFF8]">{item.fd}</span>
                  </li>
                ))}
              </ul>
            </div>

            <h3 className="flex items-center gap-2 text-[#00D4AA] font-bold text-lg mb-4 mt-8">
              <div className="w-1 h-5 bg-[#00D4AA] rounded-full" /> Time-Stamp Token（ASN.1構造）
            </h3>

            <CodeBlock language="ASN.1" code={`TimeStampToken ::= ContentInfo {\n  contentType : id-signedData,\n  content : SignedData {\n    encapContent : TSTInfo {\n      messageImprint : { SHA-256, hash_of_your_file },\n      genTime        : GeneralizedTime,  -- e.g. 20260410153042Z\n      nonce          : INTEGER,           -- replay protection\n    },\n    signerInfo : { TSA_cert_chain, RSA_signature }\n  }\n}`} />
          </motion.section>

          {/* §4 */}
          <motion.section id="s4" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="mb-20 scroll-mt-32">
            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-white/10">
              <span className="font-mono bg-[#6C3EF4] text-white px-2 py-1 rounded text-sm font-bold">§4</span>
              <h2 className="text-2xl font-bold text-white tracking-tight">TSA選定：現在の構成と、商用TSAへの移行条件</h2>
            </div>

            {/* §4 最終更新日・Business向け移行条件サマリ */}
            <div className="mb-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-[#0D0B24] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A8A0D8] mb-1">Section last updated</p>
                <p className="text-base font-black text-white">2026-05-12 (JST)</p>
                <p className="text-[11px] text-[#A8A0D8] mt-1">§9 更新履歴と 1～1 で一致させています。</p>
              </div>
              <div className="rounded-xl border border-[#00D4AA]/30 bg-[#00D4AA]/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#00D4AA] mb-1">Business / API 専用 TSA</p>
                <p className="text-base font-black text-white">DigiCert / GlobalSign 二重定結</p>
                <p className="text-[11px] text-[#A8A0D8] mt-1">SLA・DPA・長期検証 (LTV) を含むサポート付き。</p>
              </div>
              <div className="rounded-xl border border-[#F0BB38]/30 bg-[#F0BB38]/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F0BB38] mb-1">Commercial TSA 切替トリガ</p>
                <p className="text-base font-black text-white">5 条件すべて満たした日</p>
                <p className="text-[11px] text-[#A8A0D8] mt-1">4.4 に掲載した5項目がすべてTrueになったタイミングで公式切替としてアナウンスします。</p>
              </div>
            </div>

            <Callout type="info">
              TSA（時刻認証局）の選択は、ProofMarkが発行するすべての証明の信頼性を決定する最上位の設計判断です。本節では、(a) 現在の本番構成、(b) 各プランで使用するTSAクラス、(c) 商用TSAへの移行条件と契約上のトリガ、(d) 移行時の既存TST互換性、(e) Dashboardでの信頼レベル表示との対応、を <strong>Trust Center 更新履歴（§9）に紐づく約束として</strong> 公開します。曖昧な表現で隠しません。
            </Callout>

            {/* 4.0 — 現状サマリカード */}
            <div className="grid md:grid-cols-3 gap-4 my-8">
              <div className="rounded-xl border border-[#1C1A38] bg-[#0D0B24] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#A8A0D8] mb-1">Current Production TSA</p>
                <p className="text-lg font-black text-white">FreeTSA.org</p>
                <p className="text-xs text-[#A8A0D8] mt-2 leading-relaxed">Beta 公開用。RFC3161として暗号的に有効ですが、主要トラストストア未収録・SLAなし。</p>
              </div>
              <div className="rounded-xl border border-[#00D4AA]/30 bg-[#00D4AA]/5 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#00D4AA] mb-1">Next — Trusted TSA</p>
                <p className="text-lg font-black text-white">DigiCert / GlobalSign</p>
                <p className="text-xs text-[#A8A0D8] mt-2 leading-relaxed">有料プラン開始と同時に切替。OS/ブラウザのトラストストアに収録済みの商用TSA。</p>
              </div>
              <div className="rounded-xl border border-[#F0BB38]/30 bg-[#F0BB38]/5 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#F0BB38] mb-1">JP-legal Option</p>
                <p className="text-lg font-black text-white">セイコーソリューションズ</p>
                <p className="text-xs text-[#A8A0D8] mt-2 leading-relaxed">国内法廷・監査実務での実績を重視する Business / Enterprise 向け。</p>
              </div>
            </div>

            <h3 className="flex items-center gap-2 text-[#00D4AA] font-bold text-lg mb-4 mt-8">
              <div className="w-1 h-5 bg-[#00D4AA] rounded-full" /> 4.1 現在の設定（Public Beta）
            </h3>

            <p className="text-base text-white mb-4">
              <strong>TSA: FreeTSA.org</strong> — <code className="text-[#00D4AA] font-mono text-sm bg-white/5 py-0.5 px-2 rounded">freetsa.org/tsr</code>
            </p>
            <ul className="text-sm text-[#A8A0D8] leading-relaxed mb-6 space-y-1.5 list-disc pl-5">
              <li>ハッシュアルゴリズム: SHA-256（RFC 3161 / RFC 5816 対応）</li>
              <li>TSA鍵管理: 運営元（FreeTSA）側で管理。ProofMarkはHSMを自社運用しません。</li>
              <li>応答形式: DER エンコードされた TimeStampResp / TSTInfo（Base64化して `certificates.timestamp_token` に保存）</li>
              <li>Dashboard上の表示: <strong>Beta TSA</strong> バッジで明示（後述 §4.5）</li>
            </ul>

            <Callout type="warning">
              <strong className="text-white font-bold">⚠ 正直な評価：</strong> FreeTSA.org の TST は RFC3161として暗号的に有効ですが、次の3点の制約があります。(1) 正式なSLAが提供されない、(2) ルートCAが Windows / macOS / Mozilla の主要トラストストアに収録されていない、(3) 正式な紛争において証拠採用されるか・どの程度の証拠価値を持つかは事案と法域、裁判所の裁量に依存する。これらの理由から、<strong>Beta公開期間中の検証用にのみ適しており、Studio / Business プランでの本番運用には用いません。</strong>
            </Callout>

            <h3 className="flex items-center gap-2 text-[#00D4AA] font-bold text-lg mb-4 mt-8">
              <div className="w-1 h-5 bg-[#00D4AA] rounded-full" /> 4.2 商用TSAロードマップ（プラン別）
            </h3>

            <p className="text-[#A8A0D8] leading-relaxed mb-4 text-sm">
              各プランで使用するTSAと、それが Dashboard に表示される信頼バッジを以下のように対応させます。利用開始後に下位クラスへ変更されることはありません（片方向移行）。
            </p>
            <div className="overflow-x-auto rounded-xl border border-white/10 mb-4">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#6C3EF4] text-white">
                  <tr>
                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider">プラン</th>
                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider">使用TSA</th>
                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider">ルートCA</th>
                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider">SLA</th>
                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider">LTV対応</th>
                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Dashboard表示</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr className="bg-[#0D0B24] hover:bg-[#1C1A38]/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-white">Free / Beta</td>
                    <td className="px-4 py-3 text-white">FreeTSA.org</td>
                    <td className="px-4 py-3 text-[#A8A0D8]">自己署名</td>
                    <td className="px-4 py-3 text-[#A8A0D8]">—</td>
                    <td className="px-4 py-3 text-[#A8A0D8]">—</td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(155,163,212,0.12)", color: "#9BA3D4", border: "1px solid rgba(155,163,212,0.35)" }}>Beta TSA</span></td>
                  </tr>
                  <tr className="bg-[#07061A] hover:bg-[#1C1A38]/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-white">Creator / Studio</td>
                    <td className="px-4 py-3 text-white">DigiCert TSA</td>
                    <td className="px-4 py-3 text-[#A8A0D8]">DigiCert（グローバル）</td>
                    <td className="px-4 py-3 text-[#A8A0D8]">99.9%</td>
                    <td className="px-4 py-3 text-[#A8A0D8]">可</td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(0,212,170,0.12)", color: "#00D4AA", border: "1px solid rgba(0,212,170,0.4)" }}>Trusted TSA</span></td>
                  </tr>
                  <tr className="bg-[#0D0B24] hover:bg-[#1C1A38]/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-white">Business</td>
                    <td className="px-4 py-3 text-white">GlobalSign TSA</td>
                    <td className="px-4 py-3 text-[#A8A0D8]">GlobalSign（グローバル）</td>
                    <td className="px-4 py-3 text-[#A8A0D8]">99.95%</td>
                    <td className="px-4 py-3 text-[#A8A0D8]">可</td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(0,212,170,0.12)", color: "#00D4AA", border: "1px solid rgba(0,212,170,0.4)" }}>Trusted TSA</span></td>
                  </tr>
                  <tr className="bg-[#07061A] hover:bg-[#1C1A38]/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-white">Business (JP-legal)</td>
                    <td className="px-4 py-3 text-white">セイコーソリューションズ</td>
                    <td className="px-4 py-3 text-[#A8A0D8]">SECOM / 日本政府</td>
                    <td className="px-4 py-3 text-[#A8A0D8]">99.9%</td>
                    <td className="px-4 py-3 text-[#A8A0D8]">可</td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(0,212,170,0.12)", color: "#00D4AA", border: "1px solid rgba(0,212,170,0.4)" }}>Trusted TSA · SEIKO</span></td>
                  </tr>
                  <tr className="bg-[#0D0B24] hover:bg-[#1C1A38]/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-white">Enterprise (Dual-anchor)</td>
                    <td className="px-4 py-3 text-white">上記のうち2つ（Global + JP）</td>
                    <td className="px-4 py-3 text-[#A8A0D8]">クロスアンカー</td>
                    <td className="px-4 py-3 text-[#A8A0D8]">99.95%</td>
                    <td className="px-4 py-3 text-[#A8A0D8]">可</td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(240,187,56,0.12)", color: "#F0BB38", border: "1px solid rgba(240,187,56,0.4)" }}>Cross-anchored</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[#A8A0D8]/75 mb-2">
              ※ SLAは各TSA提供元が公表する数値を参照値として掲載しています。ProofMark自身のSLAはアプリケーション層の可用性について別途定義します（§9 更新履歴で告知）。
            </p>

            <h3 className="flex items-center gap-2 text-[#00D4AA] font-bold text-lg mb-4 mt-10">
              <div className="w-1 h-5 bg-[#00D4AA] rounded-full" /> 4.3 移行のトリガ条件（Go / No-Go）
            </h3>
            <p className="text-[#A8A0D8] leading-relaxed mb-4 text-sm">
              商用TSA（DigiCert等）との本契約プロセスおよびインフラ移行は、Creatorプラン以上の有償顧客が「30名」に達した時点を公式なトリガーとして開始します。Beta期間中はFreeTSA.orgを運用しますが、トリガー達成後はProofMarkのシステム全体（API環境変数）が商用TSAへと一斉にアップグレードされます。移行後に新たに「TSA付与」を実行した場合、Evidence Packには自動的に商用TSAのトークンが同梱されるようになります。
            </p>
            <p className="text-[#A8A0D8] leading-relaxed mb-4 text-sm">
              「いつ商用TSAに切り替えるか」を曖昧にしないために、以下の <strong>5つの条件をすべて満たしたタイミング</strong> を、公式な切替日とします。一つでも満たさない場合は、Beta のまま据え置きます。
            </p>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-[#E8E6FF] leading-relaxed mb-6">
              <li><strong>商用TSAとの契約締結：</strong>DigiCert または GlobalSign の SaaS 契約を締結し、本番用 TSA URL / API キー / ルートCAチェーンを取得していること。</li>
              <li><strong>段階切替フラグの実装：</strong>サーバー環境変数 <code className="text-[#00D4AA] bg-white/5 px-1.5 py-0.5 rounded font-mono text-xs">TSA_PROVIDER</code> / <code className="text-[#00D4AA] bg-white/5 px-1.5 py-0.5 rounded font-mono text-xs">TSA_URL</code> により、ゼロダウンタイムでTSAを切り替え可能であること。</li>
              <li><strong>検証スクリプトの互換確認：</strong>既存の <a href="https://github.com/proofmark-jp/verify" target="_blank" rel="noopener noreferrer" className="text-[#00D4AA] hover:underline">verify リポジトリ</a>が、新TSAのルート証明書バンドルで OpenSSL 検証をパスすること（CIで自動確認）。</li>
              <li><strong>旧TSTの永続有効性：</strong>Beta 期間中に発行された TST が、TSAの CA 証明書アーカイブにより、切替後も独立検証できることを確認済であること（LTV対応またはアーカイブTSA運用）。</li>
              <li><strong>Trust Center / Security / Dashboard の3点同期：</strong>本ページ §4.2、<a href="/security" className="text-[#00D4AA] hover:underline">/security</a>、および Dashboard の信頼バッジ表示が、切替と同一コミットで更新されること。</li>
            </ol>
            <Callout type="info">
              これら5条件のうち <strong>いずれかが未達</strong> の段階で「Trusted TSA 対応」と表示することはしません。マーケティング都合で条件をスキップしません。
            </Callout>

            <h3 className="flex items-center gap-2 text-[#00D4AA] font-bold text-lg mb-4 mt-10">
              <div className="w-1 h-5 bg-[#00D4AA] rounded-full" /> 4.4 既存TST（Beta期間分）の扱い
            </h3>
            <p className="text-[#A8A0D8] leading-relaxed mb-4 text-sm">
              移行時に最も重要なのは、<strong>既に発行済のTSTが移行後に「無効扱いにならない」</strong>ことです。RFC3161の設計上、TST は発行時点のTSA署名鍵 / CA チェーンに紐づくため、以下の方針で永続的な検証可能性を担保します。
            </p>
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl border border-[#00D4AA]/30 bg-[#00D4AA]/5 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#00D4AA] mb-1">保証する</p>
                <ul className="text-sm text-[#E8E6FF] leading-relaxed space-y-1.5 list-disc pl-5">
                  <li>Beta期間中に発行されたTSTは、そのまま保存・再ダウンロード可能（`certificates.timestamp_token`）。</li>
                  <li>FreeTSA公開CA証明書とルート証明書のスナップショットを、ProofMark側リポジトリにアーカイブ（commit pinで固定）。</li>
                  <li>Beta TST の検証手順を、verify リポジトリに個別コマンドとして残置。</li>
                  <li>旧TST、元データのハッシュ、および検証手順をすべてエクスポート可能な状態（<strong>Evidence Pack</strong>）で提供します。これにより、ProofMarkに依存せず、ユーザー自身で外部ツールを用いた長期保管や再タイムスタンプ（overstamp）が可能なデータ・ポータビリティを保証します。</li>
                </ul>
              </div>
              <div className="rounded-xl border border-[#F0BB38]/30 bg-[#F0BB38]/5 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#F0BB38] mb-1">保証しない</p>
                <ul className="text-sm text-[#E8E6FF] leading-relaxed space-y-1.5 list-disc pl-5">
                  <li>Beta TSTをもって「Trusted TSA 相当の信頼レベル」を主張すること。Dashboard上は Beta TSA のまま保持されます。</li>
                  <li>Beta TSTを第三者機関（裁判所・監査法人等）が必ず採用すること。採否は事案と法域に依存します。</li>
                  <li>FreeTSA.org 側のサービス継続性（廃止・鍵失効など外部要因）。このリスクを軽減するために Evidence Pack のエクスポートを推奨します。</li>
                </ul>
              </div>
            </div>

            <h3 className="flex items-center gap-2 text-[#00D4AA] font-bold text-lg mb-4 mt-10">
              <div className="w-1 h-5 bg-[#00D4AA] rounded-full" /> 4.5 Dashboard 信頼バッジとの対応
            </h3>
            <p className="text-[#A8A0D8] leading-relaxed mb-4 text-sm">
              Dashboard / 公開検証ページに表示される <strong>信頼バッジ</strong> は、サーバーに保存されている <code className="text-[#00D4AA] bg-white/5 px-1.5 py-0.5 rounded font-mono text-xs">tsa_provider</code> と <code className="text-[#00D4AA] bg-white/5 px-1.5 py-0.5 rounded font-mono text-xs">cross_anchors</code> のみから決定されます。クライアント側のロジックで昇格させることはできません。
            </p>
            <div className="overflow-x-auto rounded-xl border border-white/10 mb-4">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#0D0B24] text-white">
                  <tr>
                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider">バッジ</th>
                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider">導出条件</th>
                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider">意味</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(168,160,216,0.10)", color: "#A8A0D8", border: "1px solid rgba(168,160,216,0.35)" }}>Pending</span></td>
                    <td className="px-4 py-3 text-[#A8A0D8]">timestamp_token が未設定</td>
                    <td className="px-4 py-3 text-[#E8E6FF]">TSA応答待ち（通常は数秒で解消）</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(155,163,212,0.10)", color: "#9BA3D4", border: "1px solid rgba(155,163,212,0.35)" }}>Beta TSA</span></td>
                    <td className="px-4 py-3 text-[#A8A0D8]">tsa_provider = <code className="font-mono">freetsa</code></td>
                    <td className="px-4 py-3 text-[#E8E6FF]">RFC3161として暗号的に有効。主要トラストストア未収録、SLAなし。</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(0,212,170,0.12)", color: "#00D4AA", border: "1px solid rgba(0,212,170,0.4)" }}>Trusted TSA</span></td>
                    <td className="px-4 py-3 text-[#A8A0D8]">tsa_provider ∈ {"{ digicert, globalsign, seiko, sectigo }"}</td>
                    <td className="px-4 py-3 text-[#E8E6FF]">主要トラストストアに収録された商用TSAによる発行。SLA付き。</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(240,187,56,0.12)", color: "#F0BB38", border: "1px solid rgba(240,187,56,0.4)" }}>Cross-anchored</span></td>
                    <td className="px-4 py-3 text-[#A8A0D8]">cross_anchors.length ≥ 1</td>
                    <td className="px-4 py-3 text-[#E8E6FF]">複数のTSAで多重発行。TSA単一障害・鍵失効に対する耐性。</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Callout type="shield">
              <strong className="text-white font-bold">UIとサーバーの約束：</strong>Dashboardのバッジ導出ロジックは、<code className="text-[#00D4AA] bg-white/5 px-1.5 py-0.5 rounded font-mono text-xs">deriveTrustTier()</code> という純関数1箇所に集約しており、テスト可能かつ他画面との二重定義を禁止しています（<a href="https://github.com/proofmark-jp/proofmark-web/blob/main/src/pages/Dashboard.tsx" target="_blank" rel="noopener noreferrer" className="text-[#00D4AA] hover:underline">実装を見る</a>）。
            </Callout>

            <h3 className="flex items-center gap-2 text-[#00D4AA] font-bold text-lg mb-4 mt-10">
              <div className="w-1 h-5 bg-[#00D4AA] rounded-full" /> 4.6 公開タイムライン（2026年）
            </h3>
            <ol className="relative border-l border-[#1C1A38] ml-3 space-y-6 mb-8">
              <li className="pl-6">
                <div className="absolute -left-[7px] w-3.5 h-3.5 rounded-full bg-[#00D4AA] border-2 border-[#07061A]" />
                <p className="text-xs font-mono text-[#00D4AA] mb-1">2026 Q2 — 現在</p>
                <p className="text-sm text-[#E8E6FF]"><strong>Public Beta。</strong> FreeTSA.org 利用。Dashboardには Beta TSA バッジ。検証スクリプトを公開。</p>
              </li>
              <li className="pl-6">
                <div className="absolute -left-[7px] w-3.5 h-3.5 rounded-full bg-[#6C3EF4] border-2 border-[#07061A]" />
                <p className="text-xs font-mono text-[#6C3EF4] mb-1">2026 Q3 — Trusted TSA 切替</p>
                <p className="text-sm text-[#E8E6FF]">DigiCert または GlobalSign と契約。§4.3 の5条件を満たし次第、Creator / Studio プランを Trusted TSA で本番開始。既存 Beta TST はそのまま保存継続。</p>
              </li>
              <li className="pl-6">
                <div className="absolute -left-[7px] w-3.5 h-3.5 rounded-full bg-[#F0BB38] border-2 border-[#07061A]" />
                <p className="text-xs font-mono text-[#F0BB38] mb-1">2026 Q4 — JP-legal オプション</p>
                <p className="text-sm text-[#E8E6FF]">セイコーソリューションズ TSA を Business プラン向けに追加。国内紛争・監査対応のユースケースをカバー。</p>
              </li>
              <li className="pl-6">
                <div className="absolute -left-[7px] w-3.5 h-3.5 rounded-full bg-[#F0BB38] border-2 border-[#07061A]" />
                <p className="text-xs font-mono text-[#F0BB38] mb-1">2027 H1 — Cross-anchor 運用</p>
                <p className="text-sm text-[#E8E6FF]">Enterprise 向けにグローバルTSA × JP-TSA の二重発行を提供。Dashboard に Cross-anchored バッジ。TSA障害・鍵失効リスクを構造的に低減。</p>
              </li>
            </ol>

            <h3 className="flex items-center gap-2 text-[#00D4AA] font-bold text-lg mb-4 mt-10">
              <div className="w-1 h-5 bg-[#00D4AA] rounded-full" /> 4.7 インシデント・ダウングレードの扱い
            </h3>
            <p className="text-[#A8A0D8] leading-relaxed mb-4 text-sm">
              商用TSAの障害・鍵漏洩・CA失効といった外部インシデントが発生した場合、<strong>ProofMarkは証明をダウングレード表示しません（静かに格下げしません）</strong>。代わりに、以下の明示的な手順を踏みます。
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-[#E8E6FF] leading-relaxed mb-6">
              <li>検知後72時間以内に、<a href="/trust-center/incidents" className="text-[#00D4AA] hover:underline">/trust-center/incidents</a> にインシデント告知を掲載。</li>
              <li>影響範囲の証明レコードに対し、サーバー側に <code className="text-[#00D4AA] bg-white/5 px-1.5 py-0.5 rounded font-mono text-xs">tsa_incident_ref</code> を紐づけ、Dashboard / 公開検証ページ上で注意ラベルを表示。</li>
              <li>影響ユーザー向けに、代替TSAを用いた新規証明書の再発行（付け直し）を円滑に行うための運用手順とサポートを公開。</li>
              <li>インシデントの事後レポートを Trust Center §9 の更新履歴に追記。</li>
            </ul>

            <Callout type="shield">
              <strong className="text-white font-bold">移行コミットメント（再掲）：</strong>有料プラン正式リリース以降、証明の発行には常に主要トラストストアに収録された商用TSAを用います。Beta TSA（FreeTSA.org）による発行は、検証用途および Free プランにのみ残置し、UI上で明示的に Beta TSA バッジとして区別します。既存TSTは暗号的に有効なまま保持されます。
            </Callout>

            <p className="text-xs text-[#A8A0D8]/70 mt-8 leading-relaxed">
              本セクション (§4) は、Trust Center のバージョン履歴（§9）に対して拘束力を持つ約束として運用されます。文言変更・条件の追加 / 削除は、すべて §9 の更新ログに記録します。
            </p>
          </motion.section>


          {/* §5 */}
          <motion.section id="s5" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="mb-20 scroll-mt-32">
            <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/10">
              <span className="font-mono bg-[#6C3EF4] text-white px-2 py-1 rounded text-sm font-bold">§5</span>
              <h2 className="text-2xl font-bold text-white tracking-tight">データ永続化 & セキュリティ（Supabase / RLS）</h2>
            </div>

            <p className="text-[#A8A0D8] leading-relaxed mb-6">
              ProofMarkはSupabase（PostgreSQLベースのBaaS）を使用します。セキュリティはRow-Level Security（RLS）ポリシーによりデータベース層で強制されます。
            </p>

            <h3 className="flex items-center gap-2 text-[#00D4AA] font-bold text-lg mb-4 mt-8">
              <div className="w-1 h-5 bg-[#00D4AA] rounded-full" /> スキーマ
            </h3>

            <CodeBlock language="PostgreSQL" code={`-- 証明レコード（追記専用）\nCREATE TABLE proof_records (\n  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  user_id      UUID NOT NULL REFERENCES auth.users(id),\n  sha256_hash  CHAR(64) NOT NULL,\n  proof_mode   TEXT CHECK (proof_mode IN ('private', 'shareable')),\n  tst_base64   TEXT,        -- 完全なRFC3161 TST（DER/base64）\n  tst_time     TIMESTAMPTZ, -- TSTから抽出したgenTime\n  created_at   TIMESTAMPTZ DEFAULT now()\n);`} />

            <h3 className="flex items-center gap-2 text-[#00D4AA] font-bold text-lg mb-4 mt-8">
              <div className="w-1 h-5 bg-[#00D4AA] rounded-full" /> Row-Level Security ポリシー
            </h3>

            <CodeBlock language="PostgreSQL RLS" code={`ALTER TABLE proof_records ENABLE ROW LEVEL SECURITY;\n\n-- SELECT: 自分のレコードのみ\nCREATE POLICY "own_records_select" ON proof_records\nFOR SELECT USING (auth.uid() = user_id);\n\n-- INSERT: 自分のレコードのみ\nCREATE POLICY "own_records_insert" ON proof_records\nFOR INSERT WITH CHECK (auth.uid() = user_id);\n\n-- UPDATEとDELETEのポリシーなし → レコードは不変\n\n-- 公開検証用: shareableのみ\nCREATE POLICY "public_shareable" ON proof_records\nFOR SELECT USING (proof_mode = 'shareable');`} />

            <Callout type="shield">
              <strong className="text-white font-bold">設計上の重要な判断：</strong> (1) UPDATEポリシーなし — タイムスタンプ操作が不可能。(2) IPアドレスはSHA-256(IP)のみ保存。(3) <code>tst_base64</code>が完全なRFC3161 TSTを保持 — ProofMark停止後も外部検証が可能。
            </Callout>
          </motion.section>

          {/* §6 */}
          <motion.section id="s6" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="mb-20 scroll-mt-32">
            <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/10">
              <span className="font-mono bg-[#6C3EF4] text-white px-2 py-1 rounded text-sm font-bold">§6</span>
              <h2 className="text-2xl font-bold text-white tracking-tight">エンドツーエンド データフロー</h2>
            </div>

            <p className="text-white font-bold mb-4">Private Proofモード（デフォルト）</p>

            <div className="rounded-xl border border-white/10 overflow-hidden mb-8">
              <ul className="divide-y divide-white/5">
                {[
                  { fn: "1", fa: "Browser", fd: "ファイル選択 — ブラウザメモリ内に留まる（FileReader API）" },
                  { fn: "2", fa: "Browser", fd: "SubtleCrypto.digest()でSHA-256計算 — ネットワーク通信ゼロ" },
                  { fn: "3", fa: "→ Supabase", fd: "POST /functions/v1/process-hash { hash, filename, size, nonce }" },
                  { fn: "4", fa: "Edge Fn", fd: "JWT検証（Supabase Auth）、user_id抽出" },
                  { fn: "5", fa: "→ TSA", fd: "RFC3161 TimeStampReqをTSAへHTTPS送信" },
                  { fn: "6", fa: "TSA →", fd: "署名済みTSTを含むTimeStampRespを受信" },
                  { fn: "7", fa: "→ DB", fd: "INSERT into proof_records { user_id, hash, tst_base64, tst_time }" },
                  { fn: "8", fa: "→ Browser", fd: "{ proof_id, tst_time, certificate_url } を返却" },
                  { fn: "9", fa: "Browser", fd: "PDF証明書をクライアントサイドで生成 — 原画は一切送信されていない" }
                ].map((item, i) => (
                  <li key={i} className={`flex items-start gap-4 p-4 ${i % 2 === 0 ? "bg-[#0D0B24]" : "bg-[#07061A]"}`}>
                    <span className="font-mono font-bold text-[#6C3EF4] w-6 shrink-0">{item.fn}</span>
                    <span className="font-bold text-[#00D4AA] text-xs mt-0.5 w-20 shrink-0">{item.fa}</span>
                    <span className="text-sm text-[#F0EFF8]">{item.fd}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Callout type="shield">
              <strong className="text-white font-bold">プライバシー保証：</strong> Private Proofモードでは、原画ファイルはブラウザの外に出ません。SHA-256は一方向関数であり、ハッシュ値から元ファイルを復元することは計算的に不可能です。
            </Callout>
          </motion.section>

          {/* §7 */}
          <motion.section id="s7" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="mb-20 scroll-mt-32">
            <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/10">
              <span className="font-mono bg-[#6C3EF4] text-white px-2 py-1 rounded text-sm font-bold">§7</span>
              <h2 className="text-2xl font-bold text-white tracking-tight">検証ガイド — 第三者監査</h2>
            </div>

            <p className="text-[#A8A0D8] leading-relaxed mb-6">
              ProofMarkの証明は、標準的なオープンソースツールを使って誰でも検証できます。ProofMarkインフラへの信頼は不要です。
            </p>

            <h3 className="flex items-center gap-2 text-[#00D4AA] font-bold text-lg mb-4 mt-8">
              <div className="w-1 h-5 bg-[#00D4AA] rounded-full" /> Step 1 — SHA-256ハッシュの再計算
            </h3>

            <CodeBlock language="Python 3" code={`# Python 3 -- SHA-256ハッシュ検証\nimport hashlib\n\ndef verify_hash(filepath: str, expected: str) -> bool:\n  with open(filepath, "rb") as f:\n    computed = hashlib.sha256(f.read()).hexdigest()\n    ok = computed == expected.lower()\n    print("Result: PASS ✓" if ok else "Result: FAIL ✗")\n    return ok`} />

            <h3 className="flex items-center gap-2 text-[#00D4AA] font-bold text-lg mb-4 mt-8">
              <div className="w-1 h-5 bg-[#00D4AA] rounded-full" /> Step 2 — RFC3161タイムスタンプの検証
            </h3>

            <CodeBlock language="Shell (OpenSSL)" code={`# TSTを抽出（base64）\necho "<tst_base64>" | base64 -d > proof.tsr\n\n# OpenSSLで検証 — ProofMarkへの依存ゼロ\nopenssl ts -verify \\\n  -in proof.tsr \\\n  -digest <sha256_hash_hex> \\\n  -CAfile freetsa-ca.crt \\\n  -untrusted freetsa-tsa.crt\n\n# 期待される出力:\nVerification: OK`} />

            <Callout type="info">
              TSAのルート証明書はTSAのウェブサイトで公開されています。この検証はProofMarkへの信頼を一切必要とせず、TSAの公開鍵とOpenSSLのRFC3161実装のみに依存します。
            </Callout>
          </motion.section>

          {/* §8 */}
          <motion.section id="s8" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="mb-20 scroll-mt-32">
            <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/10">
              <span className="font-mono bg-[#6C3EF4] text-white px-2 py-1 rounded text-sm font-bold">§8</span>
              <h2 className="text-2xl font-bold text-white tracking-tight">制限事項 & 正直な開示</h2>
            </div>

            <p className="text-[#A8A0D8] leading-relaxed mb-6">
              制限事項についての誠実な開示が、それを隠すよりも信頼を築くと考えています。
            </p>

            <ul className="divide-y divide-white/10 border-t border-white/10">
              {[
                { title: "Beta TSA（FreeTSA.org）", desc: "SLAなし、自己署名ルートCA。有料リリース前に商用TSAへ移行予定。既存TSTは暗号的に有効のまま維持。" },
                { title: "HSMなし", desc: "TSA署名鍵はTSA運営者が管理。軽減策：本番では信頼できる商用TSAを使用。" },
                { title: "証明ごとに単一TSA", desc: "マルチTSAクロスタイムスタンプ（耐性向上）はProロードマップ。" },
                { title: "ブラウザ信頼境界", desc: "悪意のある拡張機能がハッシュ前のデータをインターセプト可能。全ブラウザ暗号ツールと共有するリスク。" },
                { title: "C2PA未対応（現時点）", desc: "C2PAマニフェストの埋め込みは未対応。長期ロードマップに含まれています。" },
                { title: "第三者コード監査なし", desc: "ハッシュ計算ロジックをGitHubでMITライセンス公開。§Aの検証スクリプトで独立検証が可能。" }
              ].map((item, i) => (
                <li key={i} className="py-4 flex gap-4 items-start">
                  <span className="text-[#F0BB38] font-bold mt-1">⚠</span>
                  <div>
                    <strong className="text-white block mb-1">{item.title}</strong>
                    <span className="text-[#A8A0D8] text-sm leading-relaxed">{item.desc}</span>
                  </div>
                </li>
              ))}
            </ul>
          </motion.section>

          {/* §9 */}
          <motion.section id="s9" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="mb-20 scroll-mt-32">
            <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/10">
              <span className="font-mono bg-[#6C3EF4] text-white px-2 py-1 rounded text-sm font-bold">§9</span>
              <h2 className="text-2xl font-bold text-white tracking-tight">更新履歴</h2>
            </div>

            <ul className="divide-y divide-white/10">
              <li className="py-4 flex gap-6">
                <span className="font-mono text-[#6C3EF4] font-bold w-16 shrink-0">v1.0</span>
                <span className="text-[#A8A0D8] text-sm leading-relaxed">
                  <strong className="text-white">April 2026</strong> — 初版公開。SHA-256パイプライン、RFC3161 TST（ASN.1構造含む）、Supabase RLSスキーマ、脅威モデル、TSA選定理由、第三者検証ガイド、完全なAppendixスクリプト。
                </span>
              </li>
              <li className="py-4 flex gap-6">
                <span className="font-mono text-[#6C3EF4] font-bold w-16 shrink-0">v1.1</span>
                <span className="text-[#A8A0D8] text-sm leading-relaxed">
                  <strong className="text-white">May 2026</strong> — §4.3に商用TSAへの移行条件（有償顧客30名トリガー）を明記。FreeTSAの稼働ステータスを2026-05-12付けで確認。
                </span>
              </li>
              <li className="py-4 flex gap-6">
                <span className="font-mono text-[#6C3EF4] font-bold w-16 shrink-0">v1.2（予定）</span>
                <span className="text-[#A8A0D8] text-sm leading-relaxed">
                  <strong className="text-white">Q3 2026</strong> — 商用TSAへの移行完了後に発行。TSA移行証明書・旧TSTの継続有効性の確認手順を追記。
                </span>
              </li>
            </ul>
          </motion.section>

          {/* §A */}
          <motion.section id="sa" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="mb-20 scroll-mt-32">
            <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/10">
              <span className="font-mono bg-[#6C3EF4] text-white px-2 py-1 rounded text-sm font-bold">§A</span>
              <h2 className="text-2xl font-bold text-white tracking-tight">Appendix：Python検証スクリプト（完全版）</h2>
            </div>

            <p className="text-[#A8A0D8] leading-relaxed mb-6">
              ProofMark証明書を検証するスタンドアロンスクリプト。Python 3.8+とOpenSSLが必要。完全版ソース: <a href="https://github.com/proofmark-jp/proofmark-verify" target="_blank" rel="noopener noreferrer" className="text-[#00D4AA] hover:underline">github.com/proofmark-jp/verify</a>
            </p>

            <CodeBlock language="Python 3" code={`#!/usr/bin/env python3\n"""ProofMark RFC3161 Timestamp Verifier\n   Usage: python verify_proofmark.py <file> <hash_hex> <tst_base64>\n"""\nimport sys, hashlib, base64, subprocess\nfrom pathlib import Path\n\ndef verify_file_hash(filepath: str, expected_hex: str) -> bool:\n    actual = hashlib.sha256(Path(filepath).read_bytes()).hexdigest()\n    ok = actual == expected_hex.lower()\n    print(f"[HASH] Expected : {expected_hex}")\n    print(f"[HASH] Computed : {actual}")\n    print("[HASH] Result   : PASS ✓" if ok else "[HASH] Result   : FAIL ✗")\n    return ok\n\ndef verify_rfc3161_tst(tst_b64: str, hash_hex: str,\n                       ca: str = "freetsa-ca.crt",\n                       tsa: str = "freetsa-tsa.crt") -> bool:\n    tsr = Path("/tmp/proof.tsr")\n    tsr.write_bytes(base64.b64decode(tst_b64))\n    r = subprocess.run(\n        ["openssl", "ts", "-verify",\n         "-in", str(tsr), "-digest", hash_hex,\n         "-CAfile", ca, "-untrusted", tsa],\n        capture_output=True, text=True\n    )\n    ok = "Verification: OK" in r.stdout\n    print(f"[TST]  openssl : {r.stdout.strip()}")\n    print("[TST]  Result  : PASS ✓" if ok else "[TST]  Result  : FAIL ✗")\n    return ok\n\nif __name__ == "__main__":\n    filepath, hash_hex, tst_b64 = sys.argv[1], sys.argv[2], sys.argv[3]\n    h_ok = verify_file_hash(filepath, hash_hex)\n    t_ok = verify_rfc3161_tst(tst_b64, hash_hex)\n    sys.exit(0 if (h_ok and t_ok) else 1)`} />
          </motion.section>

        </div>
      </main>

      <Footer />
    </div>
  );
}
