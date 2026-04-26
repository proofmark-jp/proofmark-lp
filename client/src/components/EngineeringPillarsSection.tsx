import { motion } from 'framer-motion';
import { Link } from 'wouter';
import {
    ShieldCheck,
    Hash,
    GaugeCircle,
    Lock,
    ScrollText,
    KeyRound,
    ArrowRight,
} from 'lucide-react';
import { PROOFMARK_COPY } from '@/lib/proofmark-copy';

/**
 * EngineeringPillarsSection
 * ─────────────────────────────────────────────
 * Phase 4 で獲得した「絶対防衛機能群」を、
 * ユーザーが理解できる粒度で前面に出す。
 *
 * 設計：
 *  - "技術自慢" にせず "信用を担保する仕組み" として翻訳して見せる。
 *  - 各カードはアクセシブルな article 要素で、見出し・説明・アイコンの3要素のみ。
 *  - 追加の長文や CTA は付けず、最後に "Trust Center で完全仕様を読む" を1つだけ置く。
 *  - 文言は PROOFMARK_COPY.pillars が唯一の正。
 */

const ICONS = [ShieldCheck, Hash, GaugeCircle, Lock, ScrollText, KeyRound];

const ACCENT_GRADIENTS = [
    'from-[#6C3EF4]/30 via-transparent to-[#00D4AA]/20',
    'from-[#00D4AA]/30 via-transparent to-[#6C3EF4]/20',
    'from-[#F0BB38]/30 via-transparent to-[#6C3EF4]/15',
    'from-[#BC78FF]/30 via-transparent to-[#00D4AA]/20',
    'from-[#6C3EF4]/30 via-transparent to-[#F0BB38]/15',
    'from-[#00D4AA]/30 via-transparent to-[#BC78FF]/20',
];

export default function EngineeringPillarsSection() {
    const p = PROOFMARK_COPY.pillars;

    return (
        <section
            id="engineering-pillars"
            aria-labelledby="pillars-heading"
            className="relative overflow-hidden bg-[#07061A] py-24"
        >
            {/* ambient glow */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(108,62,244,0.14),transparent_55%)]" />

            <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-2xl text-center">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-[#A8A0D8]">
                        Engineering Pillars
                    </span>
                    <h2
                        id="pillars-heading"
                        className="mt-5 text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl md:text-5xl"
                    >
                        {p.heading}
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-[#A8A0D8] sm:text-[17px]">
                        {p.subheading}
                    </p>
                </div>

                <motion.div
                    className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-60px' }}
                    variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
                >
                    {p.items.map((item, index) => {
                        const Icon = ICONS[index % ICONS.length];
                        const accent = ACCENT_GRADIENTS[index % ACCENT_GRADIENTS.length];

                        return (
                            <motion.article
                                key={item.title}
                                variants={{
                                    hidden: { opacity: 0, y: 14 },
                                    visible: {
                                        opacity: 1,
                                        y: 0,
                                        transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
                                    },
                                }}
                                className="group relative overflow-hidden rounded-2xl border border-[#1C1A38] bg-[#0D0B24]/85 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#6C3EF4]/45 hover:shadow-[0_8px_32px_rgba(108,62,244,0.18)]"
                            >
                                <div
                                    className={`pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br ${accent} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100`}
                                />
                                <div className="relative z-10">
                                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-[#6C3EF4]/20 via-[#211a4a] to-[#00D4AA]/20">
                                        <Icon className="h-5 w-5 text-white" />
                                    </div>
                                    <h3 className="mb-2 text-base font-bold tracking-tight text-white">
                                        {item.title}
                                    </h3>
                                    <p className="text-sm leading-relaxed text-[#A8A0D8]">
                                        {item.desc}
                                    </p>
                                </div>
                            </motion.article>
                        );
                    })}
                </motion.div>

                <div className="mt-12 text-center">
                    <p className="mb-4 text-sm text-[#A8A0D8]">{p.note}</p>
                    <Link href={p.ctaHref}>
                        <button className="inline-flex items-center gap-2 rounded-full border border-[#6C3EF4]/40 bg-[#6C3EF4]/10 px-6 py-3 text-sm font-bold text-[#BC78FF] transition-all hover:border-[#6C3EF4] hover:bg-[#6C3EF4]/20 hover:text-white">
                            {p.ctaLabel}
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </Link>
                </div>
            </div>
        </section>
    );
}
