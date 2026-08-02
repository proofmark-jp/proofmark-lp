import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service | ProofMark',
  description:
    'ProofMarkの利用規約。暗号タイムスタンプサービスの条件、免責事項、およびAI収益配分プログラムについて。',
};

// ─── セクション定義 ──────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: 'anti-revision',
    index: '01',
    title: 'The Immutable Notary',
    tldr: 'ProofMark is an immutable notary for your creative timeline. We protect your baseline.',
    legal:
      'ProofMark provides cryptographic timestamping services. We do not evaluate the quality or artistic merit of uploaded work. Our service serves exclusively as definitive proof of existence at a specific time, designed to protect creators from unwarranted revision requests and scope creep.',
  },
  {
    id: 'blind-courier',
    index: '02',
    title: 'The Blind Courier Protocol',
    tldr: 'We do not inspect your files. You are 100% responsible for your uploads. We act strictly as a blind cryptographic courier.',
    legal:
      'ProofMark operates under a strict Zero-Knowledge architecture. We only process and store cryptographic hashes. Users bear sole, absolute liability for the legality of the content they hash. Acting as a "mere conduit" for cryptographic verification, ProofMark expressly disclaims any liability for illegal, infringing, or malicious content processed through our algorithms.',
  },
  {
    id: 'data-deletion',
    index: '03',
    title: 'Zero-Knowledge Soft Delete',
    tldr: 'You can delete your personal data, but public cryptographic hashes are permanent.',
    legal:
      'In compliance with GDPR and CCPA, users may request account deletion, irreversibly anonymizing all Personally Identifiable Information (PII) using cryptographic salts. However, the User acknowledges that cryptographic hashes previously committed to decentralized ledgers are mathematically immutable and cannot be physically deleted.',
  },
  {
    id: 'eternal-registry',
    index: '04',
    title: 'Eternal Registry & The Empty Day Rule',
    tldr: 'Your proofs outlive this platform. The registry runs daily, unconditionally.',
    legal:
      'ProofMark commits Merkle roots of all hashes to external, socially verifiable infrastructure on a daily basis, regardless of daily transaction volume (The Empty Day Rule). Proofs generated remain independently verifiable in perpetuity, even in the event of ProofMark\'s service termination.',
  },
  {
    id: 'ai-revenue-share',
    index: '05',
    title: 'Explicit AI Revenue Share Program',
    tldr: 'If you explicitly opt-in, we share AI training licensing revenue with you. No data is used without consent.',
    legal:
      'ProofMark intends to implement an explicit Opt-In AI Revenue Share Program. Users who proactively grant permission for verified assets and metadata to be utilized in AI training datasets will be eligible for a revenue share of licensing fees collected from AI entities. No data will be utilized without explicit, affirmative consent.',
  },
] as const;

// ─── Components ──────────────────────────────────────────────────────────────

function SectionIndex({ value }: { value: string }) {
  return (
    <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-zinc-600 uppercase select-none">
      {value}
    </span>
  );
}

function TldrCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 overflow-hidden">
      <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500/60 to-emerald-500/0" />
      <div className="p-4">
        <p className="font-mono text-[10px] font-bold tracking-[0.15em] text-emerald-500/80 uppercase mb-2.5 select-none">
          TL;DR
        </p>
        <p className="text-sm text-zinc-300 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TosPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-emerald-900/40">
      {/* ── Nav bar ── */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800/60 bg-black/90 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-3.5 flex items-center justify-between">
          <Link
            href="/"
            className="font-mono text-sm font-bold text-white hover:text-emerald-400 transition-colors duration-150"
          >
            PROOF<span className="text-emerald-400">MARK</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/privacy"
              className="font-mono text-xs text-zinc-500 hover:text-zinc-200 transition-colors duration-150"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        {/* ── Header ── */}
        <header className="mb-16 border-b border-zinc-800/60 pb-12">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border border-zinc-800 bg-zinc-900/50 mb-6">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-zinc-400 uppercase">
              Legal Document
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4 leading-[1.1]">
            Terms of Service
          </h1>
          <p className="text-zinc-400 text-base md:text-lg max-w-xl leading-relaxed">
            A developer-first legal framework. Plain English summaries sit beside every clause,
            because you should always know what you are agreeing to.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-6 font-mono text-xs text-zinc-500">
            <span>
              Last updated:{' '}
              <span className="text-zinc-300">August 2, 2026</span>
            </span>
            <span className="hidden md:inline text-zinc-700">·</span>
            <span>
              Jurisdiction:{' '}
              <span className="text-zinc-300">Japan</span>
            </span>
            <span className="hidden md:inline text-zinc-700">·</span>
            <span>
              Contact:{' '}
              <a
                href="mailto:legal@proofmark.jp"
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                legal@proofmark.jp
              </a>
            </span>
          </div>

          {/* Table of contents */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="group flex items-center gap-3 px-3 py-2.5 rounded-md border border-zinc-800/60 bg-zinc-900/30 hover:bg-zinc-900/70 hover:border-zinc-700 transition-all duration-150"
              >
                <span className="font-mono text-[10px] text-zinc-600 group-hover:text-zinc-500 shrink-0">
                  {s.index}
                </span>
                <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors line-clamp-1">
                  {s.title}
                </span>
              </a>
            ))}
          </div>
        </header>

        {/* ── Sections ── */}
        <div className="flex flex-col gap-0">
          {SECTIONS.map((section, i) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 py-12 border-b border-zinc-800/40 last:border-0"
            >
              {/* LEFT: Sticky TL;DR */}
              <div className="md:col-span-1">
                <div className="md:sticky md:top-24 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <SectionIndex value={section.index} />
                    <div className="h-px flex-1 bg-zinc-800/60" />
                  </div>

                  <h2 className="text-sm font-mono font-bold text-zinc-200 leading-snug">
                    {section.title}
                  </h2>

                  <TldrCard>{section.tldr}</TldrCard>

                  <a
                    href={`#${section.id}`}
                    className="font-mono text-[10px] text-zinc-700 hover:text-zinc-400 transition-colors duration-150 tracking-widest"
                  >
                    #{section.id}
                  </a>
                </div>
              </div>

              {/* RIGHT: Legal Text */}
              <div className="md:col-span-2 flex flex-col justify-center">
                <div className="bg-zinc-950/40 border border-zinc-800/50 rounded-xl p-6 md:p-8">
                  <div className="flex items-center gap-2 mb-5">
                    <span className="font-mono text-[10px] tracking-[0.2em] text-zinc-600 uppercase font-bold">
                      Legal Text
                    </span>
                    <div className="h-px flex-1 bg-zinc-800/60" />
                  </div>
                  <p className="text-sm text-zinc-300 leading-[1.85] tracking-wide">
                    {section.legal}
                  </p>

                  {/* Cloudflare-style Mere Conduit callout for section 02 */}
                  {section.id === 'blind-courier' && (
                    <div className="mt-6 flex gap-3 p-4 rounded-lg border border-zinc-700/50 bg-zinc-900/40">
                      <div className="shrink-0 w-0.5 self-stretch rounded-full bg-amber-500/50" />
                      <div>
                        <p className="font-mono text-[10px] font-bold text-amber-500/80 uppercase tracking-widest mb-1.5">
                          Mere Conduit Doctrine
                        </p>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          ProofMark operates as a neutral, passive cryptographic infrastructure
                          layer — analogous to a telecommunications carrier under international
                          safe harbor provisions. We do not direct, select, or modify the data
                          being processed.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Immutability notice for section 03 */}
                  {section.id === 'data-deletion' && (
                    <div className="mt-6 flex gap-3 p-4 rounded-lg border border-zinc-700/50 bg-zinc-900/40">
                      <div className="shrink-0 w-0.5 self-stretch rounded-full bg-blue-500/50" />
                      <div>
                        <p className="font-mono text-[10px] font-bold text-blue-400/80 uppercase tracking-widest mb-1.5">
                          Mathematical Immutability
                        </p>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          Cryptographic hashes are one-way functions. Once a hash is committed to
                          an external ledger, no entity — including ProofMark — can alter or
                          delete it. This is a feature, not a limitation.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Empty Day Rule callout for section 04 */}
                  {section.id === 'eternal-registry' && (
                    <div className="mt-6 flex gap-3 p-4 rounded-lg border border-zinc-700/50 bg-zinc-900/40">
                      <div className="shrink-0 w-0.5 self-stretch rounded-full bg-emerald-500/50" />
                      <div>
                        <p className="font-mono text-[10px] font-bold text-emerald-400/80 uppercase tracking-widest mb-1.5">
                          The Empty Day Rule
                        </p>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          Even on days with zero new proofs, ProofMark commits a Merkle root to
                          the public ledger. This creates an unbroken, tamper-evident chain of
                          custody with no gaps.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* AI Revenue Share opt-in for section 05 */}
                  {section.id === 'ai-revenue-share' && (
                    <div className="mt-6 flex gap-3 p-4 rounded-lg border border-zinc-700/50 bg-zinc-900/40">
                      <div className="shrink-0 w-0.5 self-stretch rounded-full bg-violet-500/50" />
                      <div>
                        <p className="font-mono text-[10px] font-bold text-violet-400/80 uppercase tracking-widest mb-1.5">
                          Affirmative Consent Required
                        </p>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          Participation in the AI Revenue Share Program is strictly opt-in. Default
                          account settings exclude all data from AI licensing. Your creative work is
                          never monetized without your explicit, written authorization.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          ))}
        </div>

        {/* ── Footer ── */}
        <footer className="mt-16 pt-10 border-t border-zinc-800/60">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <p className="font-mono text-xs font-bold text-white mb-1">
                PROOF<span className="text-emerald-400">MARK</span>
              </p>
              <p className="text-xs text-zinc-600">
                © 2026 ProofMark. All rights reserved.
              </p>
            </div>
            <div className="flex items-center gap-6 font-mono text-xs text-zinc-500">
              <Link
                href="/privacy"
                className="hover:text-zinc-200 transition-colors duration-150"
              >
                Privacy Policy
              </Link>
              <a
                href="mailto:legal@proofmark.jp"
                className="hover:text-zinc-200 transition-colors duration-150"
              >
                legal@proofmark.jp
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
