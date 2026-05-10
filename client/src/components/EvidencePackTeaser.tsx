import { Link } from 'wouter';
import { motion } from 'framer-motion';
import {
  FileText,
  FileBadge,
  Workflow,
  Layers3,
  Mail,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { PROOFMARK_COPY } from '@/lib/proofmark-copy';

/**
 * EvidencePackTeaser
 * ─────────────────────────────────────────────
 * 「証明書を発行する会社」ではなく「信用を納品できる会社」へ
 * カテゴリを切り替える、ProofMarkの差別化のコア・セクション。
 *
 * - 文言は PROOFMARK_COPY.evidencePack を唯一の正とする。
 * - PackItem の数は 4〜8 の範囲で動的に対応。
 * - 6番目以降が増えてもグリッドが崩れないよう grid-cols-2 を維持。
 */
const ICONS = [FileText, FileBadge, Workflow, Layers3, Mail, ShieldCheck];

export default function EvidencePackTeaser() {
  const ev = PROOFMARK_COPY.evidencePack;

  return (
    <section
      id="evidence-pack"
      aria-labelledby="evidence-pack-heading"
      className="relative overflow-hidden border-y border-[#1C1A38] bg-gradient-to-b from-[#07061A] via-[#0B0A24] to-[#07061A] py-24"
    >
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(108,62,244,0.18),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(0,212,170,0.14),transparent_45%)]" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          {/* ─── Left: Copy ─── */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#6C3EF4]/30 bg-[#6C3EF4]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-[#BC78FF]">
              {ev.label}
            </span>
            <h2
              id="evidence-pack-heading"
              className="mt-5 text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl md:text-5xl"
            >
              {ev.title}
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-[#A8A0D8] sm:text-[17px]">
              {ev.description}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/what-it-proves#evidence-pack">
                <button className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] px-6 py-3 text-sm font-bold text-white shadow-[0_0_24px_rgba(108,62,244,0.45)] transition-transform hover:scale-[1.02]">
                  {ev.cta}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
              <Link href="/trust-center#s4">
                <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-white/85 transition-colors hover:border-[#00D4AA]/30 hover:text-[#00D4AA]">
                  運用ステータスを見る
                </button>
              </Link>
            </div>
          </div>

          {/* ─── Right: Pack Items ─── */}
          <motion.ul
            className="grid grid-cols-2 gap-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
          >
            {ev.items.map((item, index) => {
              const Icon = ICONS[index % ICONS.length];
              return (
                <motion.li
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#0D0B24]/85 p-4 backdrop-blur-md transition-colors hover:border-[#6C3EF4]/40"
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
                    },
                  }}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-[#6C3EF4]/30 via-[#211a4a] to-[#00D4AA]/30 text-white">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
                      Pack item {String(index + 1).padStart(2, '0')}
                    </div>
                    <div className="mt-1 whitespace-normal text-sm font-semibold leading-snug text-white">
                      {item}
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </motion.ul>
        </div>
      </div>
    </section>
  );
}
