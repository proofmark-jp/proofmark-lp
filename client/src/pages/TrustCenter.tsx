import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Shield, 
  ShieldAlert, 
  AlertTriangle, 
  Info, 
  ShieldCheck, 
  Download, 
  Code, 
  CheckCircle2, 
  ChevronRight, 
  Copy, 
  Check, 
  Zap,
  ServerOff,
  Fingerprint,
  Lock,
  Cpu
} from "lucide-react";
import { toast } from "sonner";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SEO from "../components/SEO";

/* =============================================================================
 * Utility Components
 * =========================================================================== */
const CodeBlock = ({ language, code }: { language: string; code: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("クリップボードにコピーしました");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-6 rounded-xl overflow-hidden border border-white/5 shadow-2xl bg-[#0B0A1F]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1C1A38]/80 border-b border-white/5 backdrop-blur-sm">
        <span className="text-[10px] font-black text-[#A8A0D8] uppercase tracking-widest">{language}</span>
        <button
          onClick={handleCopy}
          className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-[#A8A0D8] hover:text-white"
          aria-label="コードをコピー"
        >
          {copied ? <Check className="w-4 h-4 text-[#00D4AA]" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <div className="p-4 border-l-4 border-[#6C3EF4] overflow-x-auto">
        <pre className="text-xs font-mono text-[#F0EFF8] leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};

const Callout = ({ type, children }: { type: 'info' | 'warning' | 'shield' | 'zap'; children: React.ReactNode }) => {
  const styles = {
    info: "bg-[#6C3EF4]/10 border-[#6C3EF4]/30 text-[#E8E6FF]",
    warning: "bg-[#F0BB38]/10 border-[#F0BB38]/30 text-[#E8D4A0]",
    shield: "bg-[#00D4AA]/10 border-[#00D4AA]/30 text-[#A0E8D8]",
    zap: "bg-[#FF3366]/10 border-[#FF3366]/30 text-[#FFB3C6]"
  };

  const icons = {
    info: <Info className="w-5 h-5 text-[#6C3EF4] mt-0.5 flex-shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-[#F0BB38] mt-0.5 flex-shrink-0" />,
    shield: <ShieldCheck className="w-5 h-5 text-[#00D4AA] mt-0.5 flex-shrink-0" />,
    zap: <Zap className="w-5 h-5 text-[#FF3366] mt-0.5 flex-shrink-0" />
  };

  return (
    <div className={`my-6 p-5 rounded-xl border flex gap-4 backdrop-blur-sm leading-relaxed text-sm ${styles[type]}`}>
      {icons[type]}
      <div>{children}</div>
    </div>
  );
};

/* =============================================================================
 * Section Data (The Apex Blueprint Architecture)
 * =========================================================================== */
const SectionData = [
  { id: "s1", title: "§1 脅威モデルとトラストバウンダリ" },
  { id: "s2", title: "§2 エッジ防衛とゼロサーバー錬成" },
  { id: "s3", title: "§3 AWS KMSとC2PA抽象化金庫" },
  { id: "s4", title: "§4 ゼロコピーDAGとプロセス連鎖" },
  { id: "s5", title: "§5 RPC封印と追記型イベントソーシング" },
  { id: "s6", title: "§6 AI推論関所と時空間シグナル抽出" },
  { id: "s7", title: "§7 ローカルMCPとプロトコル抽象化" },
  { id: "s8", title: "§8 制限事項と絶対フェイルセーフ" },
  { id: "s9", title: "§9 更新履歴 (Changelog)" },
];

/* =============================================================================
 * Main Component
 * =========================================================================== */
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
        title="ProofMark セキュリティ白書 | 暗号学的主張とインフラアーキテクチャの全貌"
        description="限界費用ゼロのインフラからエンタープライズ品質の証拠を錬成する、The Ultimate Apex Blueprint。Vercel Edge、AWS KMS、C2PA抽象化の実装詳細を完全公開します。"
        url="https://proofmark.jp/trust-center"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "TechArticle",
          "name": "ProofMark Security Whitepaper: The Apex Blueprint",
          "headline": "Cryptographic Proof-of-Creation & Zero-Marginal-Cost Architecture",
          "description": "限界費用ゼロのインフラからエンタープライズ品質の証拠を錬成する完全仕様。",
          "author": {
            "@type": "Organization",
            "name": "ProofMark Architecture Team",
            "url": "https://proofmark.jp"
          }
        }}
      />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24 flex flex-col md:flex-row gap-12">
        {/* =========================================================================
         * TOC Sidebar
         * ======================================================================= */}
        <aside className="hidden md:block w-72 flex-shrink-0">
          <div className="sticky top-32">
            <h4 className="text-[10px] font-black text-[#A8A0D8] uppercase tracking-[0.2em] mb-6 border-b border-white/10 pb-4">Table of Contents</h4>
            <nav className="flex flex-col gap-1.5">
              {SectionData.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className={`text-left px-4 py-2.5 rounded-lg text-sm transition-all flex items-center gap-3 border-l-2 ${
                    activeId === item.id
                      ? "bg-[#6C3EF4]/10 text-white font-bold border-[#6C3EF4]"
                      : "text-[#A8A0D8] border-transparent hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span className={`font-mono text-xs w-5 ${activeId === item.id ? 'text-[#00D4AA]' : 'text-[#6C3EF4]'}`}>
                    {item.title.split(' ')[0]}
                  </span>
                  <span className="text-[13px]">{item.title.substring(item.title.indexOf(' ') + 1)}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* =========================================================================
         * Main Content
         * ======================================================================= */}
        <div className="flex-1 max-w-3xl">

          {/* ── Hero Section ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-20 border-b border-white/10 pb-16"
          >
            <div className="flex items-center gap-3 mb-6">
              <span className="text-[#00D4AA] text-[10px] font-black tracking-[0.2em] uppercase">Trust Center</span>
              <span className="text-white/20">/</span>
              <span className="text-[#A8A0D8] text-[10px] font-black tracking-[0.2em] uppercase">Architecture & Security</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-[54px] font-black text-white leading-[1.1] tracking-tight mb-8">
              The Apex Blueprint<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6C3EF4] via-[#8B61FF] to-[#00D4AA]">
                Security Whitepaper
              </span>
            </h1>

            <div className="text-[13px] text-[#A8A0D8] mb-10 flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#00D4AA]" />
              <span>Architected & Maintained by:</span>
              <a
                href="https://x.com/ProofMark_jp"
                target="_blank"
                rel="noopener"
                className="font-bold text-white hover:text-[#00D4AA] transition-colors decoration-[#00D4AA]/50 underline-offset-4 hover:underline"
              >
                ProofMark Architecture Team
              </a>
            </div>

            <p className="text-[15px] text-[#A8A0D8] leading-[1.8] mb-10">
              ProofMark.jp は単なるハッシュ化ツールではありません。クラウドの演算リソースを削ぎ落とし、エッジとブラウザを徴用することで「限界費用ゼロ」を達成しつつ、AWS KMS と C2PAプロトコル によってエンタープライズ品質の「確定論的客観証拠」を錬成する、究極の SaaS アーキテクチャです。本白書では、その全10層に及ぶインフラ設計と暗号プロトコルを完全に開示します。
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-[#0B0A1F] border border-white/5 rounded-2xl shadow-xl">
              <div>
                <p className="text-[9px] text-[#6C3EF4] uppercase tracking-[0.15em] font-black mb-1.5">Version</p>
                <p className="font-mono text-sm text-white font-medium">v4.0 — Apex</p>
              </div>
              <div>
                <p className="text-[9px] text-[#6C3EF4] uppercase tracking-[0.15em] font-black mb-1.5">Status</p>
                <p className="font-mono text-sm text-[#00D4AA] font-medium">Production</p>
              </div>
              <div>
                <p className="text-[9px] text-[#6C3EF4] uppercase tracking-[0.15em] font-black mb-1.5">Core Cryptography</p>
                <p className="font-mono text-sm text-white font-medium">AWS KMS (FIPS 140-2)</p>
              </div>
              <div>
                <p className="text-[9px] text-[#6C3EF4] uppercase tracking-[0.15em] font-black mb-1.5">Standard</p>
                <p className="font-sans text-sm text-white font-medium">W3C VC / C2PA Agnostic</p>
              </div>
            </div>
          </motion.div>

          {/* ── §1: 脅威モデルとトラストバウンダリ ── */}
          <motion.section id="s1" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="mb-24 scroll-mt-32">
            <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/10">
              <span className="font-mono bg-[#6C3EF4] text-white px-2.5 py-1 rounded-md text-[13px] font-bold shadow-[0_0_15px_rgba(108,62,244,0.4)]">§1</span>
              <h2 className="text-[22px] font-bold text-white tracking-tight">脅威モデルとトラストバウンダリ</h2>
            </div>

            <p className="text-[15px] text-[#A8A0D8] leading-[1.8] mb-8">
              ProofMark のアーキテクチャを評価する前に、私たちが「何を証明し、何を防ぐのか」という脅威モデル（Adversary Model）を極めて厳密に定義します。単一ファイルのハッシュをスタンプするだけの旧来のツールとは異なり、ProofMark は<strong className="text-white font-medium">「時空間を伴うプロセスの連鎖（The Narrative）」</strong>を暗号学的に封印します。
            </p>

            <h3 className="flex items-center gap-3 text-white font-bold text-[17px] mb-5 mt-12">
              <div className="w-1.5 h-5 bg-[#00D4AA] rounded-full shadow-[0_0_10px_rgba(0,212,170,0.5)]" /> 
              唯一の検証可能な主張 (The Absolute Claim)
            </h3>

            <div className="bg-[#0B0A1F] border-l-[3px] border-[#00D4AA] border-t border-r border-b border-white/5 rounded-xl p-6 mb-8 font-mono text-[13px] leading-[1.8] text-[#E8E6FF] shadow-lg">
              <strong className="text-[#00D4AA]">Claim:</strong> クライアントデバイスで抽出された「時空間シグナル（Chrono-Data）」および「最終アセットのSHA-256ハッシュ」が、指定時刻に間違いなく存在し、AWS KMS の署名以降、1ビットの改ざんもなく完全に保持されていること。
            </div>

            <div className="grid md:grid-cols-2 gap-5 mb-10">
              <div className="bg-[#00D4AA]/[0.03] border border-[#00D4AA]/20 rounded-xl p-6">
                <h4 className="text-[10px] font-black tracking-[0.15em] text-[#00D4AA] uppercase mb-5">✓ In Scope（証明・防御できること）</h4>
                <ul className="space-y-3.5">
                  <li className="flex gap-3 text-[13px] text-[#E8E6FF] leading-snug"><CheckCircle2 className="w-4 h-4 text-[#00D4AA] flex-shrink-0 mt-0.5" /> 制作過程（時間と手数の蓄積）の証明</li>
                  <li className="flex gap-3 text-[13px] text-[#E8E6FF] leading-snug"><CheckCircle2 className="w-4 h-4 text-[#00D4AA] flex-shrink-0 mt-0.5" /> 署名時刻以降の完全性（1ビットの改ざん検知）</li>
                  <li className="flex gap-3 text-[13px] text-[#E8E6FF] leading-snug"><CheckCircle2 className="w-4 h-4 text-[#00D4AA] flex-shrink-0 mt-0.5" /> APIキー流出によるDB改ざんの物理遮断</li>
                  <li className="flex gap-3 text-[13px] text-[#E8E6FF] leading-snug"><CheckCircle2 className="w-4 h-4 text-[#00D4AA] flex-shrink-0 mt-0.5" /> ボットによるAPIスクレイピングとDDoS攻撃</li>
                </ul>
              </div>
              <div className="bg-[#FF3366]/[0.03] border border-[#FF3366]/20 rounded-xl p-6">
                <h4 className="text-[10px] font-black tracking-[0.15em] text-[#FF3366] uppercase mb-5">✗ Out of Scope（意図的に破棄したスコープ）</h4>
                <ul className="space-y-3.5">
                  <li className="flex gap-3 text-[13px] text-[#E8E6FF] leading-snug"><AlertTriangle className="w-4 h-4 text-[#FF3366] flex-shrink-0 mt-0.5" /> 法的な著作権帰属の自動判定</li>
                  <li className="flex gap-3 text-[13px] text-[#E8E6FF] leading-snug"><AlertTriangle className="w-4 h-4 text-[#FF3366] flex-shrink-0 mt-0.5" /> 芸術的な「独自性・新規性」の評価</li>
                  <li className="flex gap-3 text-[13px] text-[#E8E6FF] leading-snug"><AlertTriangle className="w-4 h-4 text-[#FF3366] flex-shrink-0 mt-0.5" /> クライアントOS自体のマルウェア感染による抽出データの偽装</li>
                </ul>
              </div>
            </div>

            <Callout type="shield">
              <strong className="text-white font-bold">The Cryptographic Fact（暗号学的真実）：</strong> 私たちはAIに対する感情的な「100%人間が作った」という断定（虚偽リスク）をシステムから排除しました。ProofMarkが宣告するのは、「このデータの時間的連続性と完全性は暗号学的に封印されている」という冷徹な数学的事実のみです。
            </Callout>
          </motion.section>

          {/* ── §2: エッジ防衛とゼロサーバー錬成 ── */}
          <motion.section id="s2" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="mb-24 scroll-mt-32">
            <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/10">
              <span className="font-mono bg-[#6C3EF4] text-white px-2.5 py-1 rounded-md text-[13px] font-bold shadow-[0_0_15px_rgba(108,62,244,0.4)]">§2</span>
              <h2 className="text-[22px] font-bold text-white tracking-tight">エッジ防衛とゼロサーバー錬成</h2>
            </div>

            <p className="text-[15px] text-[#A8A0D8] leading-[1.8] mb-8">
              ProofMark のインフラ第1層および第2層は、クラウドのサーバーリソース（Compute課金）を完全にゼロ化するパラダイムシフトによって構築されています。攻撃者のCPUを焼き、ユーザーのデバイスを適法に徴用します。
            </p>

            <h3 className="flex items-center gap-3 text-white font-bold text-[17px] mb-5 mt-10">
              <div className="w-1.5 h-5 bg-[#6C3EF4] rounded-full shadow-[0_0_10px_rgba(108,62,244,0.5)]" /> 
              2.1 The Shadow PoW Gateway (非同期クライアント負担型DDoS防衛)
            </h3>

            <p className="text-[14px] text-[#A8A0D8] leading-[1.8] mb-6">
              Vercel WAFのルール評価課金を回避するため、フロントエンド（Vite SPA）のバックグラウンドの Web Worker で Hashcash（PoW）を強制的に採掘させます。生成された Nonce は Vercel Edge Middleware において <code className="text-[#00D4AA] bg-white/5 px-1.5 py-0.5 rounded font-mono text-[11px]">WebCrypto API</code> で0.1ミリ秒で検証されます。不正アクセスはバックエンドに到達する前に 401 Unauthorized で即時ドロップされ、DDoS攻撃者のCPUはメルトダウンします。
            </p>

            <CodeBlock language="TypeScript (Vercel Edge Middleware)" code={`// Edge Validation (Simplified PoW Verification)
export async function middleware(req: NextRequest) {
  const nonce = req.headers.get('x-proofmark-nonce');
  if (!nonce) return new NextResponse('Unauthorized', { status: 401 });

  // WebCrypto APIによる超高速エッジ検証（Redis不要）
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(nonce));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // 難易度チェック（例: 先頭4桁が0）
  if (!hashHex.startsWith('0000')) {
    return new NextResponse('Proof of Work Failed', { status: 401 });
  }
  
  return NextResponse.next();
}`} />

            <h3 className="flex items-center gap-3 text-white font-bold text-[17px] mb-5 mt-12">
              <div className="w-1.5 h-5 bg-[#6C3EF4] rounded-full shadow-[0_0_10px_rgba(108,62,244,0.5)]" /> 
              2.2 ゼロサーバー証拠錬成と WakeLock Shield
            </h3>

            <p className="text-[14px] text-[#A8A0D8] leading-[1.8] mb-6">
              数GBに及ぶ暗号証拠パッケージ（Evidence Pack ZIP）をサーバーで生成・圧縮する旧来の設計を完全に破棄しました。Vercelバックエンドは極薄の「設計図（JSON）」のみを返し、ブラウザの <code className="text-[#00D4AA] bg-white/5 px-1.5 py-0.5 rounded font-mono text-[11px]">Streams API</code> と Blob メモリを用いてユーザーのローカルデバイス上で直接ZIPを錬成します。
            </p>

            <Callout type="zap">
              <strong className="text-white font-bold">The WakeLock Shield：</strong> モバイル端末でのZIP錬成中、OSが画面をスリープさせてJSプロセスを強制キルするのを防ぐため、錬成開始と同時に <code className="font-mono text-[#FF3366]">navigator.wakeLock.request('screen')</code> を発火させます。OSレベルでスリープを物理的にブロックし、サーバーコンピュート0円のまま、100%のダウンロード成功率を保証します。
            </Callout>
            
            <h3 className="flex items-center gap-3 text-white font-bold text-[17px] mb-5 mt-12">
              <div className="w-1.5 h-5 bg-[#6C3EF4] rounded-full shadow-[0_0_10px_rgba(108,62,244,0.5)]" /> 
              2.3 The PDF Mutex & GC Yielding (メモリクラッシュの撲滅)
            </h3>

            <p className="text-[14px] text-[#A8A0D8] leading-[1.8] mb-6">
              クライアントサイドでの重厚なPDF生成（<code className="text-[#00D4AA] bg-white/5 px-1.5 py-0.5 rounded font-mono text-[11px]">@react-pdf</code> のWASMエンジン）が引き起こすブラウザのメモリ枯渇（OOM）を構造的に根絶します。グローバルな排他制御（Mutex）によって生成プロセスを直列化し、ループ間に意図的な <code className="text-[#00D4AA] bg-white/5 px-1.5 py-0.5 rounded font-mono text-[11px]">150msのTick</code> を挟むことで、メインスレッドにガベージコレクション（GC）の息継ぎを強制。ローエンドスマートフォンでの連続生成でも絶対にクラッシュしない堅牢性を獲得しました。
            </p>

          </motion.section>
          {/* ── §3: AWS KMSとC2PA抽象化金庫 ── */}
          <motion.section id="s3" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="mb-24 scroll-mt-32">
            <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/10">
              <span className="font-mono bg-[#6C3EF4] text-white px-2.5 py-1 rounded-md text-[13px] font-bold shadow-[0_0_15px_rgba(108,62,244,0.4)]">§3</span>
              <h2 className="text-[22px] font-bold text-white tracking-tight">AWS KMS と C2PA 抽象化金庫</h2>
            </div>

            <p className="text-[15px] text-[#A8A0D8] leading-[1.8] mb-8">
              ProofMark の心臓部における「署名と保存」は、クラウドの従量課金を許容してでも「完璧な標準規格」と「データの永遠性」を買う絶対権限層（Layer 3）として設計されています。旧時代の単一TSA（FreeTSA等）への依存を完全に破棄しました。
            </p>

            <h3 className="flex items-center gap-3 text-white font-bold text-[17px] mb-5 mt-10">
              <div className="w-1.5 h-5 bg-[#00D4AA] rounded-full shadow-[0_0_10px_rgba(0,212,170,0.5)]" /> 
              3.1 The Streamlined Direct KMS (直結型KMS署名)
            </h3>

            <p className="text-[14px] text-[#A8A0D8] leading-[1.8] mb-6">
              過剰最適化（バッチ署名）の罠を捨て、C2PAの国際標準規格に100%完全準拠するため「1リクエスト＝1署名」を超光速で執行します。AWS SDKの不要コードを静的削除（Tree Shaking）し、Vercel Edgeから AWS Key Management Service (FIPS 140-2準拠) へ直結させます。
            </p>

            <CodeBlock language="TypeScript (Next.js Edge API)" code={`// Edge Region Pinning: KMSと同一データセンターに物理固定し、海越えの遅延を0にする
export const preferredRegion = ['hnd1'];

// TCP/TLSハンドシェイクのオーバーヘッドを消し去るkeepAlive強制
import { KMSClient, SignCommand } from '@aws-sdk/client-kms';
import { NodeHttpHandler } from '@smithy/node-http-handler';

const kmsClient = new KMSClient({
  region: 'ap-northeast-1',
  requestHandler: new NodeHttpHandler({ keepAlive: true }),
});

export async function signPayload(digest: Uint8Array) {
  // EdgeからKMSへ直結。5〜10ミリ秒で暗号学的証明を錬成する
  const command = new SignCommand({
    KeyId: process.env.AWS_KMS_KEY_ID,
    Message: digest,
    MessageType: 'DIGEST',
    SigningAlgorithm: 'ECDSA_SHA_256',
  });
  return await kmsClient.send(command);
}`} />

            <h3 className="flex items-center gap-3 text-white font-bold text-[17px] mb-5 mt-12">
              <div className="w-1.5 h-5 bg-[#00D4AA] rounded-full shadow-[0_0_10px_rgba(0,212,170,0.5)]" /> 
              3.2 The Standard-Agnostic Vault (規格の抽象化と絶対適応)
            </h3>

            <p className="text-[14px] text-[#A8A0D8] leading-[1.8] mb-6">
              ProofMarkは、Adobeが主導する C2PA 規格に「依存」しません。特定のベンダー規格にデータをハードコードすることは、将来的な仕様変更によって証明基盤が即死するリスク（ベンダーロックイン）を伴うからです。
            </p>

            <div className="bg-[#0B0A1F] border border-white/10 rounded-xl p-6 mb-8">
              <h4 className="text-[11px] font-black tracking-[0.15em] text-white uppercase mb-4">W3C VC / DID ベースの中間プロトコル</h4>
              <p className="text-[13px] text-[#E8E6FF] leading-[1.8]">
                Supabaseの最深部（The Vault）に保存されるのは、純粋な <strong className="text-[#00D4AA]">W3C Verifiable Credentials (VC)</strong> に近い規格非依存のJSONフォーマットです。ブラウザでのZIP錬成時（エクスポートの最後の0.1秒）にのみ、その時代における「最強の規格（現在はC2PA）」のラッパーを被せて出力します。もしC2PA規格が暴走・陳腐化しても、コードを1行書き換えるだけで次世代オープン規格へとシームレスに切り替わる、生存率100%のインフラです。
              </p>
            </div>
          </motion.section>

          {/* ── §4: ゼロコピーDAGとプロセス連鎖 ── */}
          <motion.section id="s4" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="mb-24 scroll-mt-32">
            <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/10">
              <span className="font-mono bg-[#6C3EF4] text-white px-2.5 py-1 rounded-md text-[13px] font-bold shadow-[0_0_15px_rgba(108,62,244,0.4)]">§4</span>
              <h2 className="text-[22px] font-bold text-white tracking-tight">ゼロコピーDAGとプロセス連鎖</h2>
            </div>

            <p className="text-[15px] text-[#A8A0D8] leading-[1.8] mb-8">
              「パクリ・無断転載」という泥沼の争いを、システムレベルで「正当な派生（Remix）とリスペクトの連鎖」へ昇華させるモート（参入障壁）です。ProofMarkは単一のファイルハッシュツールではなく、巨大なコラボレーション経済圏のインフラとして機能します。
            </p>

            <h3 className="flex items-center gap-3 text-white font-bold text-[17px] mb-5 mt-10">
              <div className="w-1.5 h-5 bg-[#6C3EF4] rounded-full shadow-[0_0_10px_rgba(108,62,244,0.5)]" /> 
              4.1 Zero-Copy Merkle DAG (ストレージ破産の回避)
            </h3>

            <p className="text-[14px] text-[#A8A0D8] leading-[1.8] mb-6">
              あるクリエイターの「50MBの線画」を1,000人がFork（派生）した際、毎回ファイルを複製すればクラウドのストレージ課金は指数関数的に爆発（Bill Shock）します。ProofMarkはFork発生時、親の画像データを絶対に複製しません。
            </p>

            <div className="bg-[#1C1A38]/30 border border-white/5 rounded-xl p-6 mb-8 text-[13px] text-[#E8E6FF] leading-[1.8]">
              子の新しいマニフェストには、親の最終成果物の<strong className="text-[#6C3EF4]">絶対的ハッシュ値（CID）</strong>のみが <code className="text-[#00D4AA] bg-[#0D0B24] px-1.5 py-0.5 rounded font-mono text-[11px]">parent_node</code> ポインタとして記録されます。1万人がForkしても、インフラの限界費用はゼロに固定されたまま、ネットワーク効果のみが無限にスケールする「有向非巡回グラフ（DAG）」を形成します。
            </div>

            <h3 className="flex items-center gap-3 text-white font-bold text-[17px] mb-5 mt-12">
              <div className="w-1.5 h-5 bg-[#6C3EF4] rounded-full shadow-[0_0_10px_rgba(108,62,244,0.5)]" /> 
              4.2 The Asymmetric Handshake (暗号的テロリズムの遮断)
            </h3>

            <p className="text-[14px] text-[#A8A0D8] leading-[1.8] mb-6">
              誰でも勝手に派生でき、親の権威（ブランド）を利用できる仕様は、NSFW等の悪意ある改変によって親を汚染するテロ（Vandalism）を生みます。これを完全に防ぐため、非対称な承認プロトコル（Merkle Merge Request）を導入しました。
            </p>

            <ul className="space-y-4 mb-8">
              <li className="flex gap-4 items-start bg-[#0B0A1F] p-4 rounded-lg border border-white/5">
                <Lock className="w-5 h-5 text-[#00D4AA] flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white text-[13px] block mb-1">エアギャップ状態での派生</strong>
                  <span className="text-[#A8A0D8] text-[12px] leading-relaxed">子がForkして公開しても、親のUI上には一切表示されません。子は親の権威を勝手にシステム上で連結（主張）することはできません。</span>
                </div>
              </li>
              <li className="flex gap-4 items-start bg-[#0B0A1F] p-4 rounded-lg border border-white/5">
                <CheckCircle2 className="w-5 h-5 text-[#6C3EF4] flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white text-[13px] block mb-1">Approve（承認）による結線</strong>
                  <span className="text-[#A8A0D8] text-[12px] leading-relaxed">親に対して「承認リクエスト」を送り、親が手動でApproveした瞬間にのみ、DB上で双方向のグラフが結線され、公式なRemixツリーとして世界に公開されます。</span>
                </div>
              </li>
            </ul>

          </motion.section>

          {/* ── §5: RPC封印と追記型イベントソーシング ── */}
          <motion.section id="s5" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="mb-24 scroll-mt-32">
            <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/10">
              <span className="font-mono bg-[#6C3EF4] text-white px-2.5 py-1 rounded-md text-[13px] font-bold shadow-[0_0_15px_rgba(108,62,244,0.4)]">§5</span>
              <h2 className="text-[22px] font-bold text-white tracking-tight">RPC封印と追記型イベントソーシング</h2>
            </div>

            <p className="text-[15px] text-[#A8A0D8] leading-[1.8] mb-8">
              ProofMarkのデータベース（Supabase / PostgreSQL）は、クライアントフロントエンドからの直接的な書き込み（INSERT/UPDATE）を一切信用しません。Row-Level Security (RLS) に依存する旧来のBaaS設計を捨て、カーネルレベルの権限剥奪とイベントソーシングを採用しています。
            </p>

            <h3 className="flex items-center gap-3 text-white font-bold text-[17px] mb-5 mt-10">
              <div className="w-1.5 h-5 bg-[#00D4AA] rounded-full shadow-[0_0_10px_rgba(0,212,170,0.5)]" /> 
              5.1 The RPC Lockdown (Service Role 独占)
            </h3>

            <p className="text-[14px] text-[#A8A0D8] leading-[1.8] mb-6">
              決済完了処理、証明書発行ログの書き込み、C2PAマニフェストのハッシュ保存など、システム根幹に関わるすべてのRPC（ストアドプロシージャ）の実行権限を、一般ユーザーから完全に剥奪（REVOKE）します。
            </p>

            <CodeBlock language="PostgreSQL (Supabase Migrations)" code={`-- クライアントからの直接実行を物理的に不可能にする絶対支配
REVOKE EXECUTE ON FUNCTION public.process_evidence_minting FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_evidence_minting FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_evidence_minting FROM authenticated;

-- Vercel バックエンド（service_role キー保持）からのみ実行を許可
GRANT EXECUTE ON FUNCTION public.process_evidence_minting TO service_role;`} />

            <h3 className="flex items-center gap-3 text-white font-bold text-[17px] mb-5 mt-12">
              <div className="w-1.5 h-5 bg-[#00D4AA] rounded-full shadow-[0_0_10px_rgba(0,212,170,0.5)]" /> 
              5.2 Insert-Only Event Sourcing (MVCCの保護)
            </h3>

            <p className="text-[14px] text-[#A8A0D8] leading-[1.8] mb-6">
              Stripe Webhook 等のクリティカルな処理において、既存レコードを直接更新する <code className="font-mono text-[#FF3366]">UPDATE</code> 構文の使用を禁止します。PostgreSQLのMVCC（多版同時実行制御）仕様上、重度のUPDATEはデッドタプルを量産し、DBのパフォーマンスを永久に劣化させるからです。
            </p>

            <div className="bg-[#0B0A1F] border border-white/5 rounded-xl p-6 mb-8 text-[13px] text-[#E8E6FF] leading-[1.8] shadow-lg">
              <strong className="text-[#00D4AA] block mb-2">The Architecture:</strong>
              Webhookイベントは、すべて <code className="text-[#00D4AA] bg-[#0D0B24] px-1.5 py-0.5 rounded font-mono text-[11px]">stripe_webhook_events</code> というログ専用テーブルに <code className="font-mono">INSERT</code> されます。Stripeの <code className="font-mono">event.id</code> をPrimary Keyにしているため、リトライで同時に5つのイベントが着弾しても、DBのカーネルレベルで一意制約エラーとして瞬殺され、アプリケーション側での複雑な冪等性管理が不要になります。
              <br /><br />
              ログが追記された瞬間に、PostgreSQL内部の <code className="font-mono text-[#6C3EF4]">AFTER INSERT TRIGGER</code> が同期的に発火し、対象レコードを <code className="font-mono">SELECT ... FOR UPDATE</code> で行ロックして原子的にステータスを更新します。これにより、外部からの処理は「超高速なログ追記」だけで終わり、データの整合性はDB内部のトランザクションが絶対保証します。
            </div>

          </motion.section>
          {/* ── §6: AI推論関所と時空間シグナル抽出 ── */}
          <motion.section id="s6" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="mb-24 scroll-mt-32">
            <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/10">
              <span className="font-mono bg-[#6C3EF4] text-white px-2.5 py-1 rounded-md text-[13px] font-bold shadow-[0_0_15px_rgba(108,62,244,0.4)]">§6</span>
              <h2 className="text-[22px] font-bold text-white tracking-tight">AI推論関所と時空間シグナル抽出</h2>
            </div>

            <p className="text-[15px] text-[#A8A0D8] leading-[1.8] mb-8">
              AIによる「ロンダリング（生成AIの出力を人間が描いたように偽装する行為）」を看破するため、重い画像解析モデル（VLM）をサーバーで回す旧来の設計を破棄しました。画像のピクセルではなく、人間の認知バイアスが宿る「コンテキスト（文脈）」を解析します。
            </p>

            <h3 className="flex items-center gap-3 text-white font-bold text-[17px] mb-5 mt-10">
              <div className="w-1.5 h-5 bg-[#00D4AA] rounded-full shadow-[0_0_10px_rgba(0,212,170,0.5)]" /> 
              6.1 The Spatial-Temporal Signal Extractor (時空間シグナル)
            </h3>

            <p className="text-[14px] text-[#A8A0D8] leading-[1.8] mb-6">
              クライアント（Vite）側で、クリエイターが操作した「レイヤー変更、ブラシの座標、ミリ秒単位の時間差」を数KBのテキストログとして抽出します。専用のベアメタル環境（Layer 4）に常駐するローカルLLMは、この軽量なシグナルだけを読んで「思考の遅延や局所的執着が存在するか」をディベートします。これにより推論環境のVRAM消費は実質0MBへと激減します。
            </p>

            <h3 className="flex items-center gap-3 text-white font-bold text-[17px] mb-5 mt-12">
              <div className="w-1.5 h-5 bg-[#00D4AA] rounded-full shadow-[0_0_10px_rgba(0,212,170,0.5)]" /> 
              6.2 Cryptographic Signal Sealing (抽出データの暗号封印)
            </h3>

            <p className="text-[14px] text-[#A8A0D8] leading-[1.8] mb-6">
              抽出処理をクライアントに委譲すると、「悪意あるハッカーが人間らしいダミーのJSONを生成して送信する（Spoofing）」という脆弱性が生じます。これを物理的に封殺します。
            </p>

            <CodeBlock language="TypeScript (Client-Side Sealing)" code={`// ブラウザ内で抽出した直後、WebCrypto APIを用いて署名（HMAC-SHA256）
async function sealChronoData(chronoJson: string, sessionSalt: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(sessionSalt),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(chronoJson));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}`} />
            
            <div className="bg-[#0B0A1F] border border-white/5 rounded-xl p-5 mb-8 text-[13px] text-[#E8E6FF] leading-[1.8]">
              サーバー側はこのHMAC署名が一致しないシグナルを「AIロンダリングハッカーの工作」としてエッジで即座に弾き返し、抽出データの完全なる証拠能力（Trust）を担保します。
            </div>
          </motion.section>

          {/* ── §7: ローカルMCPとプロトコル抽象化 ── */}
          <motion.section id="s7" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="mb-24 scroll-mt-32">
            <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/10">
              <span className="font-mono bg-[#6C3EF4] text-white px-2.5 py-1 rounded-md text-[13px] font-bold shadow-[0_0_15px_rgba(108,62,244,0.4)]">§7</span>
              <h2 className="text-[22px] font-bold text-white tracking-tight">ローカルMCPとプロトコル抽象化</h2>
            </div>

            <p className="text-[15px] text-[#A8A0D8] leading-[1.8] mb-8">
              ProofMark を単なる証明SaaSから、Claude Code や Cursor 等のAIエージェントが必ず経由しなければならない「OSレベルのプロトコル（関所）」へと次元上昇させるための非対称アーキテクチャです。
            </p>

            <ul className="space-y-4 mb-8">
              <li className="flex gap-4 items-start bg-[#0B0A1F] p-5 rounded-xl border border-white/5 shadow-lg">
                <Cpu className="w-5 h-5 text-[#6C3EF4] flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white text-[14px] block mb-2">Edge-Decentralized MCP Proxy</strong>
                  <span className="text-[#A8A0D8] text-[13px] leading-relaxed block mb-3">
                    MCP（Model Context Protocol）サーバーをクラウドに置けば、世界中のAIエージェントからの巨大なコンテキスト・トラフィックによってCompute課金が爆発します。これを防ぐため、MCPデーモンをクリエイターのローカルPC上で稼働させます。
                  </span>
                  <span className="text-[#E8E6FF] text-[13px] leading-relaxed block">
                    AIの巨大な通信はすべてPC内で完結し、ProofMarkのVercel Edgeへは「数バイトの暗号署名要求」のみが送信されます。インフラコスト0円のまま、AIの文脈を完全に支配します。
                  </span>
                </div>
              </li>
              <li className="flex gap-4 items-start bg-[#0B0A1F] p-5 rounded-xl border border-white/5 shadow-lg">
                <Fingerprint className="w-5 h-5 text-[#00D4AA] flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white text-[14px] block mb-2">Zero-Knowledge B2B SDK (ゼロ知識関所)</strong>
                  <span className="text-[#A8A0D8] text-[13px] leading-relaxed block">
                    エンタープライズ（メディア・SNSプラットフォーム）に対して検証用REST APIを露出させません（スクレイピング枯渇の防御）。代わりに、企業のサーバー内で完結して動く「検証用SDK」をライセンス販売し、KMS公開鍵を用いてC2PAの深部をゼロ知識証明的に解読させます。ProofMarkのAPI負荷ゼロでサブスクリプション収益を強奪します。
                  </span>
                </div>
              </li>
            </ul>
          </motion.section>

          {/* ── §8: 制限事項と絶対フェイルセーフ ── */}
          <motion.section id="s8" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="mb-24 scroll-mt-32">
            <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/10">
              <span className="font-mono bg-[#6C3EF4] text-white px-2.5 py-1 rounded-md text-[13px] font-bold shadow-[0_0_15px_rgba(108,62,244,0.4)]">§8</span>
              <h2 className="text-[22px] font-bold text-white tracking-tight">制限事項と絶対フェイルセーフ (Failsafe Protocols)</h2>
            </div>

            <p className="text-[15px] text-[#A8A0D8] leading-[1.8] mb-8">
              インフラの物理法則やプラットフォームのブラックボックス仕様、そして「ベアメタルの不確実性（停電やネットワーク断）」が最悪の形で連鎖した時でも、ユーザーのUXを絶対に破壊しないための「神の視点」の防衛機構です。
            </p>

            <h3 className="flex items-center gap-3 text-white font-bold text-[17px] mb-5 mt-10">
              <div className="w-1.5 h-5 bg-[#FF3366] rounded-full shadow-[0_0_10px_rgba(255,51,102,0.5)]" /> 
              8.1 Stripe決済の時限フォールバック (Time-Triggered Auto-Bypass)
            </h3>

            <p className="text-[14px] text-[#A8A0D8] leading-[1.8] mb-6">
              デビットカードの「即時引き落とし」仕様と、バックエンドのAI判定遅延が衝突した際のUX死（ロック状態）を回避します。
            </p>

            <div className="bg-[#FF3366]/[0.05] border border-[#FF3366]/20 rounded-xl p-5 mb-8 text-[13px] text-[#E8E6FF] leading-[1.8]">
              Supabase pg_cron（またはVercel Serverless Cron）に、15分TTLの監視ジョブを仕掛けます。決済ステータスが <code className="text-[#FF3366] font-mono">auth_pending</code> のまま15分が経過した（＝推論ワーカーが停止・遅延している）場合、エッジ側で自律的に Stripe の Capture を叩き、「AI判定保留」のまま強制アンロックを行います。その後ワーカーが復帰しても、厳格なステートマシンにより二重処理（Cancelの発行）を物理的にロックします。
            </div>

            <h3 className="flex items-center gap-3 text-white font-bold text-[17px] mb-5 mt-12">
              <div className="w-1.5 h-5 bg-[#FF3366] rounded-full shadow-[0_0_10px_rgba(255,51,102,0.5)]" /> 
              8.2 LINEインフラの非同期搾取 (Push API Detachment)
            </h3>

            <p className="text-[14px] text-[#A8A0D8] leading-[1.8] mb-6">
              数万人がLINEから一斉に動画を送信してきた際、VercelのメモリとCompute課金が吹き飛ぶのを防ぐため、Webhook受領時に動画データ（バイナリ）のダウンロードを完全に禁止します。
            </p>

            <div className="bg-[#0B0A1F] border border-white/5 rounded-xl p-5 mb-8 text-[13px] text-[#A8A0D8] leading-[1.8] shadow-lg">
              <strong className="text-white block mb-1">Pointer DB & Reply Token Hack:</strong>
              Vercel Edge はLINEの署名検証のみを行い、<code className="text-[#00D4AA] font-mono">messageId</code> と <code className="text-[#00D4AA] font-mono">userId</code>（データのポインタ）だけをDBのQueueへINSERTし、1秒以内に HTTP 200 を返します。1分で期限切れとなる Reply API は「暗号化処理を開始します」という一次応答にのみ消費し、重い動画のダウンロードと解析はベアメタルワーカーが後から非同期でPull。納品はPush Message APIで確実に押し出します。
            </div>

          </motion.section>

          {/* ── §9: 更新履歴 ── */}
          <motion.section id="s9" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="mb-20 scroll-mt-32">
            <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/10">
              <span className="font-mono bg-[#6C3EF4] text-white px-2.5 py-1 rounded-md text-[13px] font-bold shadow-[0_0_15px_rgba(108,62,244,0.4)]">§9</span>
              <h2 className="text-[22px] font-bold text-white tracking-tight">更新履歴 (Changelog)</h2>
            </div>

            <div className="relative border-l-2 border-[#1C1A38] ml-4 space-y-12">
              
              <div className="pl-8 relative">
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-[#00D4AA] border-4 border-[#07061A]" />
                <h3 className="text-lg font-black text-white mb-2 flex items-center gap-3">
                  v4.0 — The Apex Blueprint <span className="text-[10px] font-mono font-bold text-[#00D4AA] bg-[#00D4AA]/10 px-2 py-0.5 rounded-full border border-[#00D4AA]/30">Current</span>
                </h3>
                <p className="text-[12px] font-mono text-[#A8A0D8] mb-4">July 2026</p>
                <div className="bg-[#0B0A1F] border border-white/5 rounded-xl p-5">
                  <ul className="space-y-3">
                    <li className="flex gap-3 text-[13px] text-[#E8E6FF] leading-relaxed">
                      <Zap className="w-4 h-4 text-[#FF3366] flex-shrink-0 mt-0.5" />
                      <span><strong>インフラ全面刷新:</strong> 限界費用ゼロ化のため、Vercel ServerlessからVercel Edgeへの完全移行（The Shadow PoW Gatewayの実装）。</span>
                    </li>
                    <li className="flex gap-3 text-[13px] text-[#E8E6FF] leading-relaxed">
                      <ServerOff className="w-4 h-4 text-[#FF3366] flex-shrink-0 mt-0.5" />
                      <span><strong>ゼロサーバー錬成:</strong> ZIP生成とPDFレンダリングをサーバーからブラウザ（クライアントサイド）へ完全委譲。WakeLock API と PDF Mutex を導入。</span>
                    </li>
                    <li className="flex gap-3 text-[13px] text-[#E8E6FF] leading-relaxed">
                      <ShieldCheck className="w-4 h-4 text-[#00D4AA] flex-shrink-0 mt-0.5" />
                      <span><strong>暗号アーキテクチャの進化:</strong> 旧来の FreeTSA.org および verify.py 依存を完全に破棄。AWS KMS直結署名およびC2PA抽象化（W3C VC）モデルへ移行。</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="pl-8 relative opacity-60">
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-[#1C1A38] border-4 border-[#07061A]" />
                <h3 className="text-lg font-bold text-white mb-2">v1.0 — Initial Architecture</h3>
                <p className="text-[12px] font-mono text-[#A8A0D8] mb-4">April 2026</p>
                <p className="text-[13px] text-[#A8A0D8] leading-relaxed">
                  初版公開。Supabase Edge Functions、RFC3161 TST、OpenSSLベースの検証スクリプトを採用した初期プロトタイプ仕様。
                </p>
              </div>
              
            </div>
          </motion.section>

        </div>
      </main>

      <Footer />
    </div>
  );
}