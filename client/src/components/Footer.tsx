import React from "react";
import { Link } from "wouter";
import { ShieldCheck, Lock, HelpCircle, FileText, Info, Zap, Scale } from "lucide-react";

import navbarLogo from "../assets/logo/navbar/proofmark-navbar-symbol-dark.svg";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#07061A] border-t border-[#1C1A38] pt-16 pb-8 px-6 md:px-12 no-print">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand Section */}
          <div className="space-y-6">
            <Link href="/" className="flex items-center gap-2 sm:gap-3 text-decoration-none group">
              <div className="relative">
                <div className="absolute inset-0 bg-[#00D4AA]/20 blur-lg rounded-full group-hover:bg-[#00D4AA]/40 transition-all opacity-0 group-hover:opacity-100" />
                <img src={navbarLogo} alt="ProofMark" className="h-7 w-auto relative z-10" />
              </div>
              <span className="font-['Syne'] text-xl font-extrabold text-[#F0EFF8] tracking-tight">
                Proof<span className="text-[#00D4AA]">Mark</span>
              </span>
            </Link>
            <p className="text-[#A8A0D8] text-sm leading-relaxed max-w-xs">
              デジタル作品の存在と真正性を、最新の暗号技術で即座に証明。クリエイターの権利と信頼を守るための防衛プラットフォーム。
            </p>
          </div>

          {/* Trust Center Section */}
          <div>
            <h3 className="text-white font-bold text-sm tracking-widest uppercase mb-6 flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#00D4AA]" /> TRUST CENTER
            </h3>
            <ul className="space-y-4">
              <li>
                <Link href="/faq" className="text-[#A8A0D8] hover:text-[#00D4AA] text-sm transition-colors flex items-center gap-2 group">
                  <HelpCircle className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" /> よくある質問 (FAQ)
                </Link>
              </li>
              <li>
                <Link href="/what-it-proves" className="text-[#A8A0D8] hover:text-[#00D4AA] text-sm transition-colors flex items-center gap-2 group">
                  <Info className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" /> ProofMarkが証明するもの
                </Link>
              </li>
              <li>
                <Link href="/security" className="text-[#A8A0D8] hover:text-[#00D4AA] text-sm transition-colors flex items-center gap-2 group">
                  <ShieldCheck className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" /> セキュリティの透明性
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Section */}
          <div>
            <h3 className="text-white font-bold text-sm tracking-widest uppercase mb-6 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#6C3EF4]" /> LEGAL
            </h3>
            <ul className="space-y-4">
              <li>
                <Link href="/privacy" className="text-[#A8A0D8] hover:text-[#6C3EF4] text-sm transition-colors">
                  プライバシーポリシー
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-[#A8A0D8] hover:text-[#6C3EF4] text-sm transition-colors">
                  利用規約
                </Link>
              </li>
              <li>
                <Link href="/tokushoho" className="text-[#A8A0D8] hover:text-[#6C3EF4] text-sm transition-colors">
                  特定商取引法に基づく表記
                </Link>
              </li>
              <li>
                <Link href="/legal-resources" className="text-[#A8A0D8] hover:text-[#6C3EF4] text-sm transition-colors">
                  権利行使キット (DMCA)
                </Link>
              </li>
            </ul>
          </div>

          {/* Service Section */}
          <div>
            <h3 className="text-white font-bold text-sm tracking-widest uppercase mb-6 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#ffd966]" /> SERVICE
            </h3>
            <ul className="space-y-4">
              <li>
                <Link href="/how-it-works" className="text-[#A8A0D8] hover:text-[#ffd966] text-sm transition-colors flex items-center gap-2 group">
                  <Zap className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" /> ProofMarkの仕組み
                </Link>
              </li>
              <li>
                <Link href="/compare-c2pa" className="text-[#A8A0D8] hover:text-[#ffd966] text-sm transition-colors flex items-center gap-2 group">
                  <Scale className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" /> C2PAとの比較
                </Link>
              </li>
            </ul>
          </div>

          {/* Support Section */}
          <div>
            <h3 className="text-white font-bold text-sm tracking-widest uppercase mb-6">Connect</h3>
            <ul className="space-y-4">
              <li>
                <a 
                  href="https://x.com/ProofMark_jp" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-[#A8A0D8] hover:text-[#00D4AA] text-sm transition-colors"
                >
                  公式 X (@ProofMark_jp)
                </a>
              </li>
              <li>
                <Link 
                  href="/blog" 
                  className="text-[#A8A0D8] hover:text-[#00D4AA] text-sm transition-colors"
                >
                  公式ブログ
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-[#1C1A38] flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[#48456A] text-xs">
            © {currentYear} ProofMark. All rights reserved.
          </p>
          <div className="flex gap-6 text-[#48456A] text-[10px] uppercase tracking-tighter flex-wrap justify-center">
            <span>Serverless Infrastructure</span>
            <span>Client-side Hash Verification</span>
            <span>RFC3161 Compliant</span>
          </div>
        </div>

        <div className="mt-8 p-4 rounded-xl bg-[#0D0B24] border border-[#1C1A38]/50">
          <p className="text-[#48456A] text-xs leading-relaxed text-center sm:text-left">
            <span className="font-semibold text-[#8B88B1]">商標について:</span>{" "}
            本サイトに表示されるすべての製品名、ロゴ、ブランドは、それぞれの所有者の財産です。ProofMarkはこれらのツールとの公式な提携を主張するものではなく、互換性を示しています。
          </p>
        </div>
      </div>
    </footer>
  );
}
