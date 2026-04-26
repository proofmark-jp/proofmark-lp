import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { CheckCircle2, XCircle, Activity, ArrowRight } from 'lucide-react';
import { PROOFMARK_COPY } from '@/lib/proofmark-copy';

/**
 * TrustSignalRow
 * ─────────────────────────────────────────────
 * ヒーロー直下に「証明する / 証明しない / 現在のTSA運用」を3カードで固定表示する。
 * 信頼商品としてのページ間整合を、最初のスクロール領域で担保する最重要セクション。
 *
 * - 文言は PROOFMARK_COPY.trustSignals が単一の正。
 * - "誠実な開示" を視覚的にダウングレードしないよう、
 *   ✓ / ✗ / ▲ で同列に扱う（×を強調しすぎない）。
 * - "現在の運用" カードは Trust Center §4 への導線として機能する。
 */

const cardBase =
  'group relative overflow-hidden rounded-2xl border bg-[#0D0B24]/85 p-6 backdrop-blur-md transition-all duration-300';

export default function TrustSignalRow() {
  const t = PROOFMARK_COPY.trustSignals;

  return (
    <section
      aria-label="ProofMarkが証明すること、証明しないこと、現在の運用"
      className="relative z-10 mx-auto -mt-12 max-w-6xl px-4 sm:px-6 lg:px-8"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
        {/* ✓ 証明すること */}
        <motion.article
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className={`${cardBase} border-[#00D4AA]/25 hover:border-[#00D4AA]/55`}
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#00D4AA]/10 blur-2xl" />
          <header className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#00D4AA]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#00D4AA]">
              {t.proves.label}
            </span>
          </header>
          <h3 className="mb-3 text-lg font-bold text-white">{t.proves.title}</h3>
          <ul className="space-y-2 text-sm leading-relaxed text-[#D4D0F4]">
            {t.proves.points.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="mt-[6px] inline-block h-1 w-1 shrink-0 rounded-full bg-[#00D4AA]" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </motion.article>

        {/* ✗ 証明しないこと */}
        <motion.article
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.45, delay: 0.07, ease: [0.22, 1, 0.36, 1] }}
          className={`${cardBase} border-[#F0BB38]/25 hover:border-[#F0BB38]/55`}
        >
          <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-[#F0BB38]/10 blur-2xl" />
          <header className="mb-3 flex items-center gap-2">
            <XCircle className="h-4 w-4 text-[#F0BB38]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#F0BB38]">
              {t.notProves.label}
            </span>
          </header>
          <h3 className="mb-3 text-lg font-bold text-white">{t.notProves.title}</h3>
          <ul className="space-y-2 text-sm leading-relaxed text-[#D4D0F4]">
            {t.notProves.points.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="mt-[6px] inline-block h-1 w-1 shrink-0 rounded-full bg-[#F0BB38]" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </motion.article>

        {/* ▲ 現在の運用（TSAステータスへの導線） */}
        <motion.article
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.45, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
          className={`${cardBase} border-[#6C3EF4]/30 hover:border-[#6C3EF4]/60`}
        >
          <div className="pointer-events-none absolute -right-12 -bottom-12 h-36 w-36 rounded-full bg-[#6C3EF4]/15 blur-2xl" />
          <header className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#BC78FF]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#BC78FF]">
              {t.operation.label}
            </span>
          </header>
          <h3 className="mb-3 text-lg font-bold text-white">{t.operation.title}</h3>
          <ul className="space-y-2 text-sm leading-relaxed text-[#D4D0F4]">
            {t.operation.points.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="mt-[6px] inline-block h-1 w-1 shrink-0 rounded-full bg-[#BC78FF]" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <Link href={t.operation.ctaHref}>
            <button className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#BC78FF] transition-colors hover:text-white">
              {t.operation.ctaLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </Link>
        </motion.article>
      </div>
    </section>
  );
}
