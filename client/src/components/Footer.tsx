import React from "react";
import { Link } from "wouter";
import { ShieldCheck, Lock, FileText, Zap, ChevronRight } from "lucide-react";
import navbarLogo from "../assets/logo/navbar/proofmark-navbar-symbol-dark.svg";
import { PROOFMARK_COPY } from "../lib/proofmark-copy";

interface FooterLinkProps {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}

const FooterLink = ({ href, external = false, children }: FooterLinkProps) => {
  const className =
    "group flex items-center text-[#A8A0D8] hover:text-[#00D4AA] text-sm transition-all duration-300 ease-out hover:translate-x-1 active:translate-x-1";
  const inner = (
    <>
      <ChevronRight className="w-4 h-4 text-[#00D4AA] opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 group-hover:mr-1 group-active:opacity-100 group-active:ml-0 group-active:mr-1 transition-all duration-300 ease-out" />
      <span>{children}</span>
    </>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
};

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#07061A] border-t border-[#1C1A38] pt-16 pb-8 px-6 md:px-12 no-print">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
          {/* Brand */}
          <div className="space-y-6 lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 sm:gap-3 text-decoration-none group">
              <div className="relative">
                <div className="absolute inset-0 bg-[#00D4AA]/20 blur-lg rounded-full group-hover:bg-[#00D4AA]/40 transition-all opacity-0 group-hover:opacity-100" />
                <img src={navbarLogo} alt="ProofMark" className="h-7 w-auto relative z-10" />
              </div>
              <span className="font-['Syne'] text-xl font-extrabold text-[#F0EFF8] tracking-tight">
                Proof<span className="text-[#00D4AA]">Mark</span>
              </span>
            </Link>
            <p className="text-[#A8A0D8] text-sm leading-relaxed max-w-md">
              {PROOFMARK_COPY.brandLong}SHA-256ハッシュとRFC3161タイムスタンプによる「制作事実の客観証拠」を、
              Evidence Pack として納品できる SaaS。著作権を保証する代わりに、
              <span className="text-[#F0EFF8]"> あなたの制作と納品を「客観証拠つき」で運用できる状態にします。</span>
            </p>
            <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.2em] text-[#48456A]">
              <span className="px-3 py-1 rounded-full border border-[#1C1A38] bg-[#0D0B24]">Client-side Hashing</span>
              <span className="px-3 py-1 rounded-full border border-[#1C1A38] bg-[#0D0B24]">RFC3161 Compliant</span>
              <span className="px-3 py-1 rounded-full border border-[#1C1A38] bg-[#0D0B24]">Independent Verifiable</span>
            </div>
          </div>

          {/* Trust Center */}
          <div>
            <h3 className="text-white font-bold text-sm tracking-widest uppercase mb-6 flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#00D4AA]" /> TRUST CENTER
            </h3>
            <ul className="space-y-4">
              <li><FooterLink href="/trust-center">Trust Center (運用ステータス)</FooterLink></li>
              <li><FooterLink href="/what-it-proves">証明する/しないこと</FooterLink></li>
              <li><FooterLink href="/security">セキュリティの透明性</FooterLink></li>
              <li><FooterLink href="/faq">よくある質問 (FAQ)</FooterLink></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-white font-bold text-sm tracking-widest uppercase mb-6 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#6C3EF4]" /> LEGAL
            </h3>
            <ul className="space-y-4">
              <li><FooterLink href="/terms">利用規約</FooterLink></li>
              <li><FooterLink href="/privacy">プライバシーポリシー</FooterLink></li>
              <li><FooterLink href="/tokushoho">特定商取引法に基づく表記</FooterLink></li>
              <li><FooterLink href="/legal-resources">権利行使ガイド (DMCA)</FooterLink></li>
            </ul>
          </div>

          {/* Service */}
          <div>
            <h3 className="text-white font-bold text-sm tracking-widest uppercase mb-6 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#ffd966]" /> SERVICE
            </h3>
            <ul className="space-y-4">
              <li><FooterLink href="/how-it-works">ProofMarkの仕組み</FooterLink></li>
              <li><FooterLink href="/pricing">料金プラン</FooterLink></li>
              <li><FooterLink href="/compare-c2pa">C2PAとの比較</FooterLink></li>
              <li><FooterLink href="/blog">公式ブログ</FooterLink></li>
              <li><FooterLink href="/contact">よくある質問 / お問い合わせ</FooterLink></li>
              <li><FooterLink href="https://x.com/ProofMark_jp" external>公式 X (@ProofMark_jp)</FooterLink></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-[#1C1A38] flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[#48456A] text-xs">© {currentYear} ProofMark. All rights reserved.</p>
          <div className="flex gap-6 text-[#48456A] text-[10px] uppercase tracking-tighter flex-wrap justify-center">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-[#00D4AA]" /> Evidence Operations SaaS
            </span>
            <span>RFC3161 + SHA-256</span>
            <span>Independent Verifiable</span>
          </div>
        </div>

        <div className="mt-8 p-4 rounded-xl bg-[#0D0B24] border border-[#1C1A38]/50 space-y-3">
          <p className="text-[#48456A] text-xs leading-relaxed text-center sm:text-left">
            <span className="font-semibold text-[#8B88B1]">表現について:</span>{" "}
            ProofMarkが生成するのは、RFC3161準拠のタイムスタンプ付き証拠データです。
            証拠としての価値・採否は、利用文脈・TSA構成・法域により異なります。最新の運用構成は
            {" "}<Link href="/trust-center#s4" className="text-[#00D4AA] hover:underline">Trust Center</Link>
            {" "}に常時公開しています。
          </p>
          <p className="text-[#48456A] text-xs leading-relaxed text-center sm:text-left">
            <span className="font-semibold text-[#8B88B1]">商標について:</span>{" "}
            本サイトに表示されるすべての製品名、ロゴ、ブランドは、それぞれの所有者の財産です。ProofMarkはこれらのツールとの公式な提携を主張するものではなく、互換性を示しています。
          </p>
        </div>
      </div>
    </footer>
  );
}
