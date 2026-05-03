import { useState, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import {
    ShieldCheck,
    Hash,
    GaugeCircle,
    Lock,
    ScrollText,
    KeyRound,
    ArrowRight,
    ChevronDown,
    Cpu,
} from 'lucide-react';
import { PROOFMARK_COPY } from '@/lib/proofmark-copy';

/**
 * EngineeringPillarsSection
 * ─────────────────────────────────────────────
 * Phase 11.A — Accordion化
 *
 * B2C（個人クリエイター層）の離脱を防ぐため、デフォルトで折りたたみ状態にする。
 * 「技術的詳細を見る」のトグルで height: 0 → auto へ展開する。
 *
 * 設計：
 *  - "技術自慢" にせず "信用を担保する仕組み" として翻訳して見せる。
 *  - デフォルト closed: B2Cユーザーには情報密度を強制せず、認知負荷を下げる。
 *  - B2B層には「展開して読み込む」明確な意思決定としてエンゲージメント計測しやすい。
 *  - 新規 npmパッケージは追加しない（framer-motion の AnimatePresence のみ使用）。
 *  - Tailwind と The Vault 美学（ダークテーマ・余白）を完全踏襲。
 *
 * 文言は PROOFMARK_COPY.pillars が唯一の正。
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
    const [open, setOpen] = useState(false);
    const panelId = useId();

    return (
        <section
            id="engineering-pillars"
            aria-labelledby="pillars-heading"
            className="relative overflow-hidden bg-[#07061A] py-20"
        >
            {/* ambient glow */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(108,62,244,0.10),transparent_55%)]" />

            <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                {/* ─────────────────────────────────
         * Compact summary header (always visible)
         *  - B2Cユーザーは閉じたまま離脱しても情報密度に殺されない
         *  - B2Bユーザーは "技術的詳細を見る" で踏み込める
         * ───────────────────────────────── */}
                <div className="mx-auto max-w-3xl text-center">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-[#A8A0D8]">
                        Engineering Pillars
                    </span>
                    <h2
                        id="pillars-heading"
                        className="mt-5 text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl md:text-4xl"
                    >
                        {p.heading}
                    </h2>
                    <p className="mt-4 text-sm leading-relaxed text-[#A8A0D8] sm:text-base">
                        {p.subheading}
                    </p>

                    {/* Accordion toggle */}
                    <button
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        aria-expanded={open}
                        aria-controls={panelId}
                        className="group mt-7 inline-flex items-center gap-2 rounded-full border border-[#6C3EF4]/35 bg-[#6C3EF4]/10 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.18em] text-[#BC78FF] transition-all hover:border-[#6C3EF4] hover:bg-[#6C3EF4]/20 hover:text-white"
                    >
                        <Cpu className="h-3.5 w-3.5" />
                        技術的詳細を見る
                        <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? 'rotate-180' : ''
                                }`}
                        />
                    </button>

                    {!open && (
                        <p className="mt-3 text-[11px] text-[#A8A0D8]/60">
                            個人クリエイター向けの利用には、この詳細を読まなくても問題ありません。
                        </p>
                    )}
                </div>

                {/* ─────────────────────────────────
         * Expandable pillars panel
         *  - height: 0 ↔ auto は framer-motion で制御
         *  - aria-hidden で支援技術にも閉じ状態を伝達
         * ───────────────────────────────── */}
                <AnimatePresence initial={false}>
                    {open && (
                        <motion.div
                            id={panelId}
                            key="pillars-panel"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                            aria-hidden={!open}
                            className="overflow-hidden"
                        >
                            <div className="pt-12">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {p.items.map((item, index) => {
                                        const Icon = ICONS[index % ICONS.length];
                                        const accent = ACCENT_GRADIENTS[index % ACCENT_GRADIENTS.length];

                                        return (
                                            <motion.article
                                                key={item.title}
                                                initial={{ opacity: 0, y: 14 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{
                                                    duration: 0.45,
                                                    delay: index * 0.06,
                                                    ease: [0.22, 1, 0.36, 1],
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
                                </div>

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
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </section>
    );
}
