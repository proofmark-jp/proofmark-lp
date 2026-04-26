import { motion } from 'framer-motion';
import { PROOFMARK_COPY } from '@/lib/proofmark-copy';

/**
 * UseCasesSection
 * ─────────────────────────────────────────────
 * 「誰の・どの場面で使われるか」をLP上で明示するセクション。
 *
 * - 文言は PROOFMARK_COPY.useCases が唯一の正。
 * - "防衛 < 営業加速" の文脈で並べ替えた6つの場面。
 * - カードは情報密度を抑え、絵文字で視認性を担保。
 */

export default function UseCasesSection() {
    const u = PROOFMARK_COPY.useCases;

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
                    {u.items.map((item) => (
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
            </div>
        </section>
    );
}
