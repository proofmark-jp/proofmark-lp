import { motion } from 'framer-motion';
import { PROOFMARK_COPY } from '@/lib/proofmark-copy';

/**
 * UseCasesSection
 * ─────────────────────────────────────────────
 * Phase 11.A — NDA Portfolio を独立セクションへ抽出
 *
 * 旧版にあった "🤐 NDA案件の営業実績づくりに" は NdaPortfolioSection.tsx に
 * 独立化したため、本セクションからは除外する。
 *
 * UseCasesSection は「日常運用シーン」の網羅的提示にフォーカスし、
 * NDA案件の文脈は専用セクションが担う。
 *
 * 設計：
 *  - 文言は PROOFMARK_COPY.useCases が唯一の正。
 *  - "防衛 < 営業加速" の文脈は維持。
 *  - NDA関連タイトル（"NDA"を含むもの）は本セクションでは描画しない。
 */

export default function UseCasesSection() {
    const u = PROOFMARK_COPY.useCases;

    // NDA Portfolio 独立化に伴い、NDA に関するユースケースは本セクションでは表示しない
    const items = u.items.filter((item) => !/NDA|nda/.test(item.title));

    return (
        <section
            aria-labelledby="usecases-heading"
            className="relative bg-[#0B0A24] py-24"
        >
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-2xl text-center">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-[#A8A0D8]">
                        Use Cases
                    </span>
                    <h2
                        id="usecases-heading"
                        className="mt-5 text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl"
                    >
                        {u.heading}
                    </h2>
                </div>

                <motion.div
                    className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-60px' }}
                    variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
                >
                    {items.map((item) => (
                        <motion.article
                            key={item.title}
                            variants={{
                                hidden: { opacity: 0, y: 14 },
                                visible: {
                                    opacity: 1,
                                    y: 0,
                                    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
                                },
                            }}
                            className="rounded-2xl border border-[#1C1A38] bg-[#07061A]/85 p-6 backdrop-blur-md transition-all duration-300 hover:border-[#00D4AA]/40 hover:bg-[#0D0B24]"
                        >
                            <div className="text-3xl" aria-hidden="true">
                                {item.emoji}
                            </div>
                            <h3 className="mt-3 text-base font-bold tracking-tight text-white">
                                {item.title}
                            </h3>
                            <p className="mt-2 text-sm leading-relaxed text-[#A8A0D8]">
                                {item.desc}
                            </p>
                        </motion.article>
                    ))}
                </motion.div>

                {/* NDA Portfolio への導線 */}
                <div className="mt-10 text-center">
                    <a
                        href="#nda-portfolio"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#A8A0D8] hover:text-white transition-colors"
                    >
                        <span>NDA案件の活用方法は専用セクション</span>
                        <span className="text-[#00D4AA]">「NDA Portfolio」</span>
                        <span>へ →</span>
                    </a>
                </div>
            </div>
        </section>
    );
}
