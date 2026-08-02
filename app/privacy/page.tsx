// ============================================================================
//  ProofMark: Privacy Policy Page
//  File: app/privacy/page.tsx
// ============================================================================

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | ProofMark',
  description:
    'ProofMark operates on a Zero-Knowledge architecture. Learn how we handle your data, your cryptographic proofs, and your rights under GDPR and CCPA.',
};

// ---------------------------------------------------------------------------
// Sub-components (co-located, server-safe)
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-xs tracking-widest text-emerald-400 uppercase">
      {children}
    </span>
  );
}

interface TldrCardProps {
  index: string;
  summary: string;
  href: string;
}

function TldrCard({ index, summary, href }: TldrCardProps) {
  return (
    <a
      href={href}
      className="block group bg-zinc-900/50 border border-zinc-800 border-t-2 border-t-emerald-500/50 rounded-lg p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
    >
      <p className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-2">
        {index}
      </p>
      <p className="text-zinc-300 text-sm leading-relaxed group-hover:text-zinc-200 transition-colors">
        {summary}
      </p>
      <p className="font-mono text-[10px] text-emerald-400/60 mt-3 group-hover:text-emerald-400 transition-colors">
        Read section →
      </p>
    </a>
  );
}

interface LegalSectionProps {
  id: string;
  label: string;
  title: string;
  children: React.ReactNode;
}

function LegalSection({ id, label, title, children }: LegalSectionProps) {
  return (
    <section id={id} className="scroll-mt-8">
      <div className="mb-4">
        <SectionLabel>{label}</SectionLabel>
        <h2 className="text-white text-xl font-semibold mt-1">{title}</h2>
      </div>
      <div className="text-zinc-300 leading-relaxed text-sm space-y-4">
        {children}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-300 font-sans">

      {/* ── Top nav strip ── */}
      <nav className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="font-mono text-xs tracking-widest text-zinc-500 uppercase hover:text-emerald-400 transition-colors"
        >
          ← ProofMark
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/tos"
            className="font-mono text-xs tracking-widest text-zinc-500 uppercase hover:text-zinc-300 transition-colors"
          >
            Terms of Service
          </Link>
        </div>
      </nav>

      {/* ── Page header ── */}
      <header className="max-w-5xl mx-auto px-6 pt-16 pb-12">
        <SectionLabel>Privacy Policy</SectionLabel>
        <h1 className="text-white text-4xl font-bold tracking-tight mt-3 mb-4">
          Your Data, Your Proofs
        </h1>
        <p className="text-zinc-400 text-base leading-relaxed max-w-2xl">
          ProofMark is built on a Zero-Knowledge architecture. We commit the minimum
          possible data to our servers, and the maximum possible proof to open,
          verifiable infrastructure — infrastructure that belongs to no single entity,
          including us.
        </p>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-8 pt-6 border-t border-zinc-800">
          <div>
            <p className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-1">
              Last Updated
            </p>
            <p className="font-mono text-sm text-zinc-300">August 2, 2026</p>
          </div>
          <div className="h-8 w-px bg-zinc-800 hidden sm:block" />
          <div>
            <p className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-1">
              Architecture
            </p>
            <p className="font-mono text-sm text-emerald-400">Zero-Knowledge</p>
          </div>
          <div className="h-8 w-px bg-zinc-800 hidden sm:block" />
          <div>
            <p className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-1">
              Compliance
            </p>
            <p className="font-mono text-sm text-zinc-300">GDPR · CCPA</p>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

          {/* ── LEFT: Sticky TL;DR sidebar ── */}
          <aside className="md:col-span-1">
            <div className="md:sticky md:top-8 space-y-4">
              <p className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-5">
                TL;DR — Plain English Summary
              </p>

              <TldrCard
                href="#data-deletion"
                index="§ 01 / Data Deletion"
                summary="You can delete your personal data, but public cryptographic hashes are permanent. The math doesn't forget."
              />

              <TldrCard
                href="#eternal-registry"
                index="§ 02 / Eternal Registry"
                summary="Your proofs outlive this platform. The registry runs daily, unconditionally — even on days with zero transactions."
              />

              <TldrCard
                href="#ai-revenue-share"
                index="§ 03 / AI Revenue Share"
                summary="If you explicitly opt-in, we share AI training licensing revenue with you. No data is ever used without your consent."
              />

              {/* Architecture badge */}
              <div className="mt-8 bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                <p className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-3">
                  Root Hash
                </p>
                <p className="font-mono text-[11px] text-emerald-400/70 break-all leading-relaxed">
                  merkle://proofmark.registry
                  <br />
                  /daily/∞
                </p>
                <p className="text-zinc-500 text-xs mt-3 leading-relaxed">
                  All daily Merkle roots are committed to decentralized, socially
                  verifiable infrastructure independent of ProofMark's servers.
                </p>
              </div>
            </div>
          </aside>

          {/* ── RIGHT: Legal text ── */}
          <div className="md:col-span-2 space-y-14">

            {/* Preamble */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
              <p className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-3">
                Preamble
              </p>
              <p className="text-zinc-300 text-sm leading-relaxed">
                This Privacy Policy governs your use of the ProofMark platform, including
                all associated APIs, web interfaces, and cryptographic services
                (collectively, the{' '}
                <span className="font-mono text-zinc-200">&quot;Service&quot;</span>). By
                accessing or using the Service, you agree to the collection and use of
                information as described herein. ProofMark reserves the right to amend
                this Policy with reasonable notice. Continued use of the Service following
                such notice constitutes acceptance of the revised Policy.
              </p>
            </div>

            {/* ── Section 1: Data Deletion ── */}
            <LegalSection
              id="data-deletion"
              label="§ 01 · Data Deletion"
              title="Zero-Knowledge Soft Delete"
            >
              <p>
                In compliance with the General Data Protection Regulation (
                <span className="font-mono text-zinc-200">GDPR</span>) and the California
                Consumer Privacy Act (
                <span className="font-mono text-zinc-200">CCPA</span>), users may submit
                a verifiable account deletion request at any time via the ProofMark
                Console. Upon processing, all Personally Identifiable Information (
                <span className="font-mono text-zinc-200">PII</span>) associated with the
                requesting account — including legal name, email address, billing records,
                and session data — will be irreversibly anonymized through the application
                of cryptographic salts unique to each user record.
              </p>
              <p>
                This process is commonly referred to as a{' '}
                <span className="font-mono text-emerald-400">soft delete</span>: the
                underlying data rows are not physically expunged from ProofMark's primary
                database, but are rendered computationally indistinguishable from random
                noise. The anonymization is designed to be mathematically irreversible;
                ProofMark retains neither the salts nor any mechanism to recover the
                original PII after deletion is confirmed.
              </p>
              <p>
                Notwithstanding the foregoing, the User expressly acknowledges and agrees
                that cryptographic hashes derived from their content and previously
                committed to decentralized ledgers, public Merkle trees, or any
                distributed and socially verifiable infrastructure (collectively,{' '}
                <span className="font-mono text-zinc-200">&quot;The Registry&quot;</span>)
                are mathematically immutable. Such hashes are, by the inherent design of
                cryptographic hash functions, impossible to physically delete, retract, or
                modify — by ProofMark or any other party. The existence of a hash in The
                Registry does not, following a successful deletion request, constitute the
                storage of PII, as the hash itself contains no recoverable personal
                information.
              </p>
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg px-5 py-4 mt-2">
                <p className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-2">
                  Technical Note
                </p>
                <p className="font-mono text-xs text-zinc-400 leading-relaxed">
                  SHA-256(<span className="text-emerald-400">content</span> +{' '}
                  <span className="text-zinc-500">userSalt</span>) → hash committed to
                  ledger
                  <br />
                  On deletion: <span className="text-zinc-500">userSalt</span> is
                  destroyed. The hash remains. The hash is not PII.
                </p>
              </div>
              <p>
                To submit a deletion request, navigate to{' '}
                <span className="font-mono text-emerald-400">
                  Console → Settings → Account → Delete Account
                </span>
                , or contact our Data Protection Officer at{' '}
                <span className="font-mono text-zinc-200">privacy@proofmark.jp</span>.
                Requests will be processed within the statutory period of thirty (30) days
                as required under applicable data protection law.
              </p>
            </LegalSection>

            <hr className="border-zinc-800" />

            {/* ── Section 2: Eternal Registry ── */}
            <LegalSection
              id="eternal-registry"
              label="§ 02 · Eternal Registry"
              title="Eternal Registry &amp; The Empty Day Rule"
            >
              <p>
                ProofMark is architecturally committed to the perpetual, unconditional
                verifiability of all proofs generated through the Service. To this end,
                ProofMark commits a Merkle root — a single cryptographic fingerprint
                summarizing all hashes timestamped within a given UTC calendar day — to
                one or more external, socially verifiable infrastructure providers on a
                daily basis (the{' '}
                <span className="font-mono text-emerald-400">&quot;Daily Commitment&quot;</span>).
              </p>
              <p>
                The Daily Commitment occurs unconditionally. On days where no user
                transactions are processed, ProofMark will commit a deterministic empty
                root, representing an explicit and publicly verifiable record that no
                proofs were issued on that date. This policy is formally defined as{' '}
                <span className="font-mono text-emerald-400">The Empty Day Rule</span> and
                exists to prevent ambiguity: the absence of a commitment shall never be
                mistakable for a gap in the record, a system failure, or a data omission.
              </p>
              <p>
                Proofs generated through the Service are designed to be independently
                verifiable using publicly available cryptographic tools in perpetuity.
                Verification does not require access to ProofMark&apos;s servers, APIs, or
                any proprietary software. In the event of ProofMark&apos;s commercial
                dissolution, acquisition, or service termination (
                <span className="font-mono text-zinc-200">&quot;Termination Event&quot;</span>),
                all previously committed Merkle roots remain accessible via The Registry,
                and all proofs remain independently verifiable by any party holding the
                original content hash and the corresponding daily root.
              </p>
              <p>
                ProofMark makes no warranty that any specific infrastructure provider
                will persist indefinitely. ProofMark&apos;s obligation, as stated herein,
                is to commit to multiple, geographically and institutionally independent
                infrastructure providers to maximize the probability of perpetual
                availability. Details of current infrastructure providers are published in
                ProofMark&apos;s open-source verification specification.
              </p>
            </LegalSection>

            <hr className="border-zinc-800" />

            {/* ── Section 3: AI Revenue Share ── */}
            <LegalSection
              id="ai-revenue-share"
              label="§ 03 · AI Revenue Share"
              title="Explicit AI Revenue Share Program"
            >
              <p>
                ProofMark intends to implement an Explicit Opt-In AI Revenue Share
                Program (the{' '}
                <span className="font-mono text-zinc-200">&quot;Program&quot;</span>). The
                Program is designed as an affirmative, creator-first mechanism through
                which users may, entirely at their own discretion, authorize the use of
                their verified assets and associated metadata in AI training datasets in
                exchange for a proportional share of licensing revenue collected from AI
                entities.
              </p>
              <p>
                Participation in the Program is strictly{' '}
                <span className="font-mono text-emerald-400">opt-in</span>. No asset, no
                metadata, and no derivative thereof will be licensed to any AI entity,
                training pipeline, or data aggregator without the explicit, affirmative,
                and individually authenticated consent of the asset&apos;s registered owner
                on the ProofMark platform. Participation in the Program may be granted or
                revoked by the user at any time via the ProofMark Console. Revocation of
                consent will apply prospectively; any licensing arrangements already
                executed and in good standing prior to the revocation date will remain
                valid for their contracted term.
              </p>
              <p>
                Revenue share rates, payment schedules, eligible asset categories, and
                the list of authorized AI licensees will be published in the Program&apos;s
                supplemental terms at the time of launch. ProofMark reserves the right to
                modify these Program terms with a minimum of thirty (30) days&apos; written
                notice to participating users. The Program is currently in design phase
                and is not yet commercially available; participation is not possible at
                this time.
              </p>
              <div className="bg-zinc-950 border border-emerald-800/50 rounded-lg px-5 py-4 mt-2">
                <p className="font-mono text-[10px] tracking-widest text-emerald-400/70 uppercase mb-2">
                  Default Stance: No Consent
                </p>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  By default, all ProofMark accounts are enrolled with{' '}
                  <span className="font-mono text-zinc-200">AI_CONSENT = false</span>.
                  No action is required to protect your data from AI licensing. You must
                  take an explicit, authenticated action to change this setting.
                </p>
              </div>
            </LegalSection>

            {/* Governing law note */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
              <p className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-3">
                Governing Law &amp; Jurisdiction
              </p>
              <p className="text-zinc-400 text-sm leading-relaxed">
                This Privacy Policy is governed by and construed in accordance with the
                laws of Japan, without regard to its conflict of law provisions. For users
                located in the European Economic Area, the provisions of the GDPR shall
                apply in addition to and, where inconsistent, shall supersede the
                governing law of Japan to the extent required by applicable regulation.
                For questions regarding this Policy, contact{' '}
                <span className="font-mono text-zinc-200">privacy@proofmark.jp</span>.
              </p>
            </div>

          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-800 mt-16 pt-8 pb-12 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] tracking-widest text-zinc-600 uppercase mb-1">
              ProofMark
            </p>
            <p className="text-zinc-600 text-xs">
              © {new Date().getFullYear()} ProofMark. All rights reserved.
            </p>
          </div>
          <nav className="flex items-center gap-6">
            <Link
              href="/tos"
              className="font-mono text-xs text-zinc-500 uppercase tracking-widest hover:text-zinc-300 transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              className="font-mono text-xs text-emerald-400/70 uppercase tracking-widest hover:text-emerald-400 transition-colors"
              aria-current="page"
            >
              Privacy Policy
            </Link>
          </nav>
        </div>
      </footer>

    </div>
  );
}
