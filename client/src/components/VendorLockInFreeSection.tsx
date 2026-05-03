import { motion } from 'framer-motion';
import {
  Github,
  Terminal,
  ShieldCheck,
  Infinity as InfinityIcon,
  ArrowRight,
} from 'lucide-react';

/**
 * VendorLockInFreeSection
 * ─────────────────────────────────────────────
 * Phase 11.A — proofmark-jp/verify を B2B 向けの強いヘッドラインに昇格
 *
 * 旧来：「運営終了時も大丈夫」という防御的訴求にしか使われていなかった。
 * 新版：「ProofMark に依存しない設計」を Business 層向けの攻勢的訴求として独立化。
 *
 * 想定読者：制作会社・出版社・大企業の法務/調達担当。
 * 期待効果：DPA（データ処理契約）レビュー時に「ベンダーロックインの懸念」を解消する根拠資料として機能。
 *
 * 設計：
 *  - 中央に GitHubリポジトリへの導線を配置し、信頼性の客観的物証として強調。
 *  - 「サービス停止後も検証可能」を技術ファクトとして3カードで提示。
 *  - The Vault 美学（ダーク・余白・控えめなアクセント）を完全踏襲。
 */
export default function VendorLockInFreeSection() {
  return (
    <section
      id="vendor-lockin-free"
      aria-labelledby="vendor-lockin-heading"
      className="relative overflow-hidden bg-[#07061A] py-24"
    >
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,212,170,0.08),transparent_55%)]" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#00D4AA]/25 bg-[#00D4AA]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-[#00D4AA]">
            <InfinityIcon className="h-3 w-3" />
            Vendor Lock-in Free
          </span>
          <h2
            id="vendor-lockin-heading"
            className="mt-5 text-3xl font-black leading-[1.1] tracking-tight text-white sm:text-4xl md:text-5xl"
          >
            ProofMarkが終了しても、
            <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00D4AA] to-[#BC78FF]">
              証拠は永続する設計
            </span>
            です。
          </h2>
          <p className="mt-5 text-base leading-relaxed text-[#A8A0D8] sm:text-[17px]">
            ProofMarkが発行するタイムスタンプトークン（TST）は RFC3161 国際標準規格そのものです。
            <span className="text-white">
              {' '}OpenSSL や Python の標準ツールだけで独立検証できます。
            </span>
            検証スクリプトとドキュメントは、すべて MIT ライセンスで GitHub に公開しています。
          </p>
        </div>

        {/* ── Three pillars ────────────────────── */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
          className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-3"
        >
          {[
            {
              icon: ShieldCheck,
              title: 'RFC3161 国際標準',
              desc: 'タイムスタンプトークンは独自規格ではなく、電子契約・電子文書で広く参照される国際規格に準拠。',
            },
            {
              icon: Terminal,
              title: 'OpenSSL で独立検証',
              desc: 'コマンド一発で TST の真正性を検証可能。ProofMark の API/サーバーに一切依存しない。',
            },
            {
              icon: Github,
              title: 'MIT License で公開',
              desc: '検証スクリプト proofmark-jp/verify は MIT ライセンス。社内環境にコピーして恒久的に保持できます。',
            },
          ].map((pillar) => {
            const Icon = pillar.icon;
            return (
              <motion.article
                key={pillar.title}
                variants={{
                  hidden: { opacity: 0, y: 14 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
                  },
                }}
                className="rounded-2xl border border-[#1C1A38] bg-[#0D0B24]/85 p-6 backdrop-blur-md transition-all hover:-translate-y-1 hover:border-[#00D4AA]/35"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-[#00D4AA]/20 bg-[#00D4AA]/5">
                  <Icon className="h-5 w-5 text-[#00D4AA]" />
                </div>
                <h3 className="mb-2 text-base font-bold tracking-tight text-white">
                  {pillar.title}
                </h3>
                <p className="text-sm leading-relaxed text-[#A8A0D8]">
                  {pillar.desc}
                </p>
              </motion.article>
            );
          })}
        </motion.div>

        {/* ── Code preview ───────────────────────── */}
        <div className="mx-auto mt-14 max-w-3xl rounded-2xl border border-[#1C1A38] bg-[#05040E] p-1 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between rounded-t-xl border-b border-[#1C1A38] bg-[#0D0B24] px-4 py-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#A8A0D8]">
              shell
            </span>
            <span className="text-[10px] font-mono text-[#00D4AA]/70">
              proofmark-jp/verify · MIT
            </span>
          </div>
          <pre className="overflow-x-auto p-5 text-xs leading-relaxed">
            <code className="font-mono text-[#D4D0F4]">
              <span className="text-[#A8A0D8]"># 任意の環境で、ProofMark の関与なしに検証</span>
              {'\n'}
              <span className="text-[#00D4AA]">$</span> git clone https://github.com/proofmark-jp/verify.git
              {'\n'}
              <span className="text-[#00D4AA]">$</span> python verify.py path/to/evidence-pack.zip
              {'\n\n'}
              <span className="text-[#A8A0D8]"># 出力例</span>
              {'\n'}
              <span className="text-[#BC78FF]">[OK]</span>{' '}
              <span className="text-white">SHA-256 matches certificate</span>
              {'\n'}
              <span className="text-[#BC78FF]">[OK]</span>{' '}
              <span className="text-white">TSA signature valid (RFC3161)</span>
              {'\n'}
              <span className="text-[#BC78FF]">[OK]</span>{' '}
              <span className="text-white">Timestamped at 2026-04-23T12:34:56Z UTC</span>
            </code>
          </pre>
        </div>

        {/* ── CTA ─────────────────────────────── */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://github.com/proofmark-jp/verify"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-[#00D4AA]/40 bg-[#00D4AA]/10 px-6 py-3 text-sm font-bold text-[#00D4AA] transition-all hover:border-[#00D4AA] hover:bg-[#00D4AA]/20 hover:text-white"
          >
            <Github className="h-4 w-4" />
            proofmark-jp/verify を見る
          </a>
          <a
            href="/trust-center#s7"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-white/85 transition-colors hover:border-[#6C3EF4]/30 hover:text-white"
          >
            Trust Center §7 検証手順を読む
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
