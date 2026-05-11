import React, { useState } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Lock,
  FileText,
  Zap,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import navbarLogo from '../assets/logo/navbar/proofmark-navbar-symbol-dark.svg';
import { PROOFMARK_COPY } from '../lib/proofmark-copy';

/* ───────── shared link primitive ───────── */
interface FooterLinkProps {
  href: string;
  external?: boolean;
  children: React.ReactNode;
  onNavigate?: () => void;
}

const FooterLink = ({
  href,
  external = false,
  children,
  onNavigate,
}: FooterLinkProps): JSX.Element => {
  const className =
    'group flex items-center text-[#A8A0D8] hover:text-[#00D4AA] active:text-[#00D4AA] text-sm transition-all duration-300 ease-out hover:translate-x-1 active:translate-x-1 py-1.5 md:py-0';
  const inner = (
    <>
      <ChevronRight className="w-4 h-4 text-[#00D4AA] opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 group-hover:mr-1 group-active:opacity-100 group-active:ml-0 group-active:mr-1 transition-all duration-300 ease-out" />
      <span>{children}</span>
    </>
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onNavigate}
      >
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={className} onClick={onNavigate}>
      {inner}
    </Link>
  );
};

/* ───────── footer column data (single source of truth) ───────── */
interface FooterSection {
  id: 'trust' | 'legal' | 'service';
  title: string;
  icon: React.ReactNode;
  links: ReadonlyArray<{
    label: string;
    href: string;
    external?: boolean;
  }>;
}

const SECTIONS: ReadonlyArray<FooterSection> = [
  {
    id: 'trust',
    title: 'TRUST CENTER',
    icon: <Lock className="w-4 h-4 text-[#00D4AA]" />,
    links: [
      { label: 'Trust Center (運用ステータス)', href: '/trust-center' },
      { label: '証明する/しないこと', href: '/what-it-proves' },
      { label: 'セキュリティの透明性', href: '/security' },
      { label: 'よくある質問 (FAQ)', href: '/faq' },
    ],
  },
  {
    id: 'legal',
    title: 'LEGAL',
    icon: <FileText className="w-4 h-4 text-[#6C3EF4]" />,
    links: [
      { label: '利用規約', href: '/terms' },
      { label: 'プライバシーポリシー', href: '/privacy' },
      { label: '特定商取引法に基づく表記', href: '/tokushoho' },
      { label: '権利行使ガイド (DMCA)', href: '/legal-resources' },
    ],
  },
  {
    id: 'service',
    title: 'SERVICE',
    icon: <Zap className="w-4 h-4 text-[#ffd966]" />,
    links: [
      { label: 'ProofMarkの仕組み', href: '/how-it-works' },
      { label: '料金プラン', href: '/pricing' },
      { label: 'C2PAとの比較', href: '/compare-c2pa' },
      { label: '公式ブログ', href: '/blog' },
      { label: 'よくある質問 / お問い合わせ', href: '/contact' },
      {
        label: '公式 X (@ProofMark_jp)',
        href: 'https://x.com/ProofMark_jp',
        external: true,
      },
    ],
  },
];

/* ───────── mobile-only accordion ───────── */
type SectionId = FooterSection['id'];

interface MobileAccordionProps {
  section: FooterSection;
  open: boolean;
  onToggle: () => void;
}

const MobileAccordion = ({
  section,
  open,
  onToggle,
}: MobileAccordionProps): JSX.Element => {
  const panelId = `footer-section-${section.id}`;
  const buttonId = `footer-section-${section.id}-button`;

  return (
    <div className="border-b border-[#1C1A38]">
      <button
        type="button"
        id={buttonId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-white font-bold text-sm tracking-widest uppercase">
          {section.icon}
          {section.title}
        </span>
        <motion.span
          aria-hidden
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="text-[#A8A0D8]"
        >
          <ChevronDown className="w-5 h-5" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key={panelId}
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <ul className="space-y-1 pb-4 pl-1">
              {section.links.map((link) => (
                <li key={link.href}>
                  <FooterLink href={link.href} external={link.external}>
                    {link.label}
                  </FooterLink>
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

/* ───────── footer root ───────── */
export default function Footer(): JSX.Element {
  const currentYear = new Date().getFullYear();
  const [openSection, setOpenSection] = useState<SectionId | null>(null);

  const toggleSection = (id: SectionId): void => {
    setOpenSection((prev) => (prev === id ? null : id));
  };

  return (
    <footer
      className="bg-[#07061A] border-t border-[#1C1A38] pt-16 pb-8 px-6 md:px-12 no-print"
      // モバイルでは Sticky CTA と被らないよう余白を確保
      style={{
        paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
      }}
    >
      <div className="max-w-7xl mx-auto">
        {/* ────── Brand block (PC/Mobile 共通、レイアウトは md で切替) ────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12 md:mb-16">
          <div className="space-y-6 lg:col-span-2">
            <Link
              href="/"
              className="flex items-center gap-2 sm:gap-3 text-decoration-none group"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-[#00D4AA]/20 blur-lg rounded-full group-hover:bg-[#00D4AA]/40 transition-all opacity-0 group-hover:opacity-100" />
                <img
                  src={navbarLogo}
                  alt="ProofMark"
                  className="h-7 w-auto relative z-10"
                />
              </div>
              <span className="font-['Syne'] text-xl font-extrabold text-[#F0EFF8] tracking-tight">
                Proof<span className="text-[#00D4AA]">Mark</span>
              </span>
            </Link>
            <p className="text-[#A8A0D8] text-sm leading-relaxed max-w-md">
              {PROOFMARK_COPY.brandLong}
              SHA-256ハッシュとRFC3161タイムスタンプによる「制作事実の客観証拠」を、
              Evidence Pack として納品できる SaaS。著作権を保証する代わりに、
              <span className="text-[#F0EFF8]">
                {' '}
                あなたの制作と納品を「客観証拠つき」で運用できる状態にします。
              </span>
            </p>
            <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.2em] text-[#48456A]">
              <span className="px-3 py-1 rounded-full border border-[#1C1A38] bg-[#0D0B24]">
                Client-side Hashing
              </span>
              <span className="px-3 py-1 rounded-full border border-[#1C1A38] bg-[#0D0B24]">
                RFC3161 Compliant
              </span>
              <span className="px-3 py-1 rounded-full border border-[#1C1A38] bg-[#0D0B24]">
                Independent Verifiable
              </span>
            </div>
          </div>

          {/* ────── Desktop: 既存の3カラムグリッド (md 以上のみ表示) ────── */}
          {SECTIONS.map((section) => (
            <div key={`desktop-${section.id}`} className="hidden md:block">
              <h3 className="text-white font-bold text-sm tracking-widest uppercase mb-6 flex items-center gap-2">
                {section.icon}
                {section.title}
              </h3>
              <ul className="space-y-4">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <FooterLink href={link.href} external={link.external}>
                      {link.label}
                    </FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ────── Mobile: アコーディオン (md 未満のみ表示) ────── */}
        <div className="md:hidden mb-8 border-t border-[#1C1A38]">
          {SECTIONS.map((section) => (
            <MobileAccordion
              key={`mobile-${section.id}`}
              section={section}
              open={openSection === section.id}
              onToggle={() => toggleSection(section.id)}
            />
          ))}
        </div>

        {/* ────── 法務・コピーライトブロック (PC/Mobile 共通) ────── */}
        <div className="pt-8 border-t border-[#1C1A38] flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[#48456A] text-xs">
            © {currentYear} ProofMark. All rights reserved.
          </p>
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
            <span className="font-semibold text-[#8B88B1]">表現について:</span>{' '}
            ProofMarkが生成するのは、RFC3161準拠のタイムスタンプ付き証拠データです。
            証拠としての価値・採否は、利用文脈・TSA構成・法域により異なります。最新の運用構成は{' '}
            <Link href="/trust-center#s4" className="text-[#00D4AA] hover:underline">
              Trust Center
            </Link>{' '}
            に常時公開しています。
          </p>
          <p className="text-[#48456A] text-xs leading-relaxed text-center sm:text-left">
            <span className="font-semibold text-[#8B88B1]">商標について:</span>{' '}
            本サイトに表示されるすべての製品名、ロゴ、ブランドは、それぞれの所有者の財産です。ProofMarkはこれらのツールとの公式な提携を主張するものではなく、互換性を示しています。
          </p>
        </div>
      </div>
    </footer>
  );
}
