import { Link } from 'wouter';
import { BookOpen, ChevronRight, ArrowLeft } from 'lucide-react';
import navbarLogo from '../assets/logo/navbar/proofmark-navbar-symbol-dark.svg';
import SEO from '../components/SEO';

export default function BlogIndex() {
  return (
    <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] font-sans pb-24">
      <SEO 
        title="ProofMark ブログ | AIクリエイターのための最新情報"
        description="AIクリエイターのための著作権知識や、ProofMarkの活用方法を発信します。"
        url="https://proofmark.jp/blog"
      />
      {/* ── Header ── */}
      <div className="w-full border-b border-[#1C1A38] bg-[#0D0B24]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-decoration-none">
            <img src="/spa/logo.svg" alt="ProofMark" className="h-6 w-auto" />
            <span className="font-['Syne'] text-lg font-extrabold text-[#F0EFF8]">
              Proof<span className="text-[#00D4AA]">Mark</span>
            </span>
          </Link>
          <Link href="/" className="flex items-center gap-2 text-sm font-bold text-[#A8A0D8] hover:text-[#00D4AA] transition-colors">
            <ArrowLeft className="w-4 h-4" /> トップに戻る
          </Link>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-4xl mx-auto px-6 pt-16">
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 bg-[#F0BB38]/10 border border-[#F0BB38]/30 text-[#F0BB38] px-4 py-2 rounded-full text-xs font-black tracking-widest uppercase mb-6">
            <BookOpen className="w-4 h-4" /> Learning Hub
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">ブログ・お役立ち情報</h1>
          <p className="text-[#A8A0D8] text-sm md:text-base">AIクリエイターのための著作権知識や、ProofMarkの活用方法を発信します。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Article 1 */}
          <Link href="/blog/copyright">
            <div className="group bg-[#0D0B24] border border-[#1C1A38] rounded-2xl p-6 hover:border-[#6C3EF4] transition-all cursor-pointer shadow-lg hover:shadow-[0_0_30px_rgba(108,62,244,0.15)] relative overflow-hidden h-full flex flex-col">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <BookOpen className="w-24 h-24 text-[#6C3EF4]" />
              </div>
              <div className="relative z-10 flex-1 flex flex-col">
                <span className="text-xs font-bold text-[#00D4AA] tracking-widest uppercase mb-3 block">Copyright & AI</span>
                <h2 className="text-xl font-bold text-white mb-3 group-hover:text-[#6C3EF4] transition-colors line-clamp-2">
                  AI生成物の著作権と無断転載対策：クリエイターが今すべき防衛策とは？
                </h2>
                <p className="text-[#A8A0D8] text-sm mb-6 line-clamp-3 flex-1">
                  「AIで作ったイラストに著作権はあるのか？」現代のAIクリエイターが抱える最大の悩みを解決し、作品を守るための具体的な手段を解説します。
                </p>
                <div className="flex items-center text-sm font-bold text-[#6C3EF4] group-hover:text-[#8B61FF] mt-auto">
                  記事を読む <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </Link>

          {/* Article 2 */}
          <Link href="/blog/monetization">
            <div className="group bg-[#0D0B24] border border-[#1C1A38] rounded-2xl p-6 hover:border-[#F0BB38] transition-all cursor-pointer shadow-lg hover:shadow-[0_0_30px_rgba(240,187,56,0.15)] relative overflow-hidden h-full flex flex-col">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <BookOpen className="w-24 h-24 text-[#F0BB38]" />
              </div>
              <div className="relative z-10 flex-1 flex flex-col">
                <span className="text-xs font-bold text-[#F0BB38] tracking-widest uppercase mb-3 block">Client Work & Trust</span>
                <h2 className="text-xl font-bold text-white mb-3 group-hover:text-[#F0BB38] transition-colors line-clamp-2">
                  AI作品のマネタイズとクライアントワーク：納品トラブルを防ぐ「信頼」の作り方
                </h2>
                <p className="text-[#A8A0D8] text-sm mb-6 line-clamp-3 flex-1">
                  AIイラストの販売や依頼受注で必須となる「プロとしての信頼」。クライアントを安心させ、単価を上げるための存在証明書の活用テクニックを公開。
                </p>
                <div className="flex items-center text-sm font-bold text-[#F0BB38] group-hover:text-[#F2C95D] mt-auto">
                  記事を読む <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
