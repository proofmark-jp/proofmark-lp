import { motion } from 'framer-motion';
import { Link } from 'wouter';
import {
  Lock,
  EyeOff,
  Hash,
  ShieldCheck,
  Briefcase,
  ArrowRight,
} from 'lucide-react';

/**
 * NdaPortfolioSection
 * ─────────────────────────────────────────────
 * Phase 11.A — NDA "黒い石板" の独立化
 *
 * UseCasesSection に埋もれていた NDA表示モードを、
 * 独立した営業武器セクションとして引き上げる。
 *
 * キャッチコピー：「見せられない実績を、強力な営業武器に」
 *
 * 設計：
 *  - 中央に "Obsidian Slab"（黒い石板）の視覚的メタファ。
 *  - 鍵アイコンとSHA-256ハッシュだけが緑色に光る漆黒のカード。
 *  - 「NDAで原画は出せないが、存在した実績は示せる」という他にない価値を可視化。
 *
 *  CTOからのメモ：
 *    新規パッケージは追加せず、Tailwind + framer-motion + lucide-react のみで構築。
 *    The Vault 美学（ダーク・余白・ハイライト最小限）を完全踏襲。
 */

// 表示用のサンプル "黒い石板" 内に出すハッシュ抜粋
const SAMPLE_HASH_PREFIXES = [
  '7f3a8e1c…b29d',
  'a14de29f…0c84',
  '5e8c12bb…9af7',
];

export default function NdaPortfolioSection() {
  return (
    <section
      id="nda-portfolio"
      aria-labelledby="nda-portfolio-heading"
      className="relative overflow-hidden bg-[#050416] py-24"
    >
      {/* 背景装飾：縦のサブトルなライン */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(90deg, rgba(108,62,244,0.04) 1px, transparent 1px)',
          backgroundSize: '120px 100%',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,212,170,0.07),transparent_55%)]" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* ── Header ────────────────────── */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-[#A8A0D8]">
            <Briefcase className="h-3 w-3" />
            NDA Portfolio
          </span>
          <h2
            id="nda-portfolio-heading"
            className="mt-5 text-3xl font-black leading-[1.1] tracking-tight text-white sm:text-4xl md:text-5xl"
          >
            見せられない実績を、
            <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00D4AA] to-[#BC78FF]">
              強力な営業武器に。
            </span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-[#A8A0D8] sm:text-[17px]">
            NDA案件は、原画を公開できないため、これまでポートフォリオに載せられないのが当たり前でした。
            ProofMarkの「黒い石板（Obsidian Slab）」モードは、ファイルそのものは見せずに、
            <span className="text-white"> 「特定の日時に、特定のハッシュが存在した」 </span>
            事実だけを提示します。
          </p>
        </div>

        {/* ─────────────────────────────────
         * Obsidian Slab — visual centerpiece
         *  - 漆黒の背景に鍵 + ハッシュだけが緑色に光る
         *  - 視覚的メタファとして "見せないが存在を示す" を物理化
         * ───────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-3"
        >
          {SAMPLE_HASH_PREFIXES.map((hash, idx) => (
            <motion.article
              key={hash}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{
                duration: 0.5,
                delay: idx * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-[#0a0918] to-[#020108] p-7 shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
              aria-label={`NDA案件 #${idx + 1}（非公開・ハッシュ提示モード）`}
            >
              {/* faint inner border */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.04]" />

              {/* Lock badge */}
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#00D4AA]/20 bg-[#00D4AA]/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#00D4AA]">
                  <Lock className="h-3 w-3" />
                  NDA / Sealed
                </div>
                <span className="text-[10px] font-mono text-white/30">
                  #{String(idx + 1).padStart(3, '0')}
                </span>
              </div>

              {/* Visual metaphor: redacted area */}
              <div className="my-7 flex h-24 items-center justify-center">
                <EyeOff className="h-9 w-9 text-white/15" />
              </div>

              {/* Hash signature — the only thing that "glows" */}
              <div className="rounded-xl border border-[#00D4AA]/15 bg-[#00D4AA]/[0.04] p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-[#00D4AA]/80">
                  <Hash className="h-3 w-3" />
                  SHA-256
                </div>
                <code className="block font-mono text-[13px] font-semibold tracking-wide text-[#00D4AA] [text-shadow:0_0_12px_rgba(0,212,170,0.4)]">
                  {hash}
                </code>
              </div>

              {/* Footer: timestamp + verify hint */}
              <div className="mt-4 flex items-center justify-between text-[10px] text-white/40">
                <span className="font-mono">
                  Timestamped · 2026-04-XX UTC
                </span>
                <span className="inline-flex items-center gap-1 transition-colors group-hover:text-white/70">
                  <ShieldCheck className="h-3 w-3" />
                  Verifiable
                </span>
              </div>
            </motion.article>
          ))}
        </motion.div>

        {/* ── Use cases & rationale ─────── */}
        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              title: '受託案件の営業実績化',
              desc: '機密保持で公開できない案件でも、「この期間にこのレベルの仕事をしていた」という客観事実を提示できます。',
            },
            {
              title: 'クライアント説明の補助',
              desc: '原画は出せないが、「いつ・誰が・どんなファイルを納品したか」のハッシュ的事実を、第三者検証可能な形で示せます。',
            },
            {
              title: '法務・コンプライアンス耐性',
              desc: 'ProofMarkはハッシュのみを保持するため、NDA違反や機密漏洩のリスク構造そのものが小さく抑えられます。',
            },
          ].map((card) => (
            <article
              key={card.title}
              className="rounded-2xl border border-[#1C1A38] bg-[#0D0B24]/70 p-6 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-[#00D4AA]/30"
            >
              <h3 className="text-base font-bold tracking-tight text-white">
                {card.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#A8A0D8]">
                {card.desc}
              </p>
            </article>
          ))}
        </div>

        {/* ── CTA ────────────────────────── */}
        <div className="mt-14 text-center">
          <Link href="/pricing#plan-creator">
            <button className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] px-6 py-3 text-sm font-bold text-white shadow-[0_0_24px_rgba(108,62,244,0.45)] transition-transform hover:scale-[1.02]">
              NDA Portfolio を Creator で使う
              <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
          <p className="mt-3 text-[11px] text-[#A8A0D8]/70">
            Creator プラン以上で、NDA案件を「黒い石板」モードでポートフォリオに掲載できます。
          </p>
        </div>
      </div>
    </section>
  );
}
