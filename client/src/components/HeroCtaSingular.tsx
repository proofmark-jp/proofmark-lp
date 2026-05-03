import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowRight, Lock } from 'lucide-react';

/**
 * HeroCtaSingular
 * ─────────────────────────────────────────────
 * Phase 11.A — Hero CTA Single-Funnel
 *
 * 旧版ヒーロー：メール先行登録フォーム + Evidence Pack リンク + 4バッジ + 特典 = 4つの行動喚起
 * 新版ヒーロー：プライマリ「無料で証明書を1枚作ってみる」のみ。メール登録はテキストリンクへ格下げ。
 *
 * 設計：
 *  - 「証明書を1枚作る」体験こそ最強のオンボーディング。
 *  - Free プランの月30件枠で即時に体感可能。
 *  - メール登録（先行登録）は「待たずに始められる」ユーザーには不要なので二次化。
 *
 * Home.tsx 側で {user} の状態に応じて呼び出すこと：
 *  - 認証済み: 「管理画面へ進む」
 *  - 未認証:   「無料で証明書を1枚作ってみる」
 */
export default function HeroCtaSingular({
  authed,
  showWaitlistFallback = true,
}: {
  authed: boolean;
  showWaitlistFallback?: boolean;
}) {
  if (authed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65, duration: 0.4 }}
        className="mb-10 w-full"
      >
        <Link href="/dashboard">
          <button
            className="px-10 py-5 rounded-full bg-primary text-white font-black text-lg hover:scale-105 transition-all shadow-[0_0_40px_rgba(108,62,244,0.4)] block mx-auto"
            aria-label="管理画面へ進む"
          >
            管理画面へ進む (Go to Dashboard) →
          </button>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.65, duration: 0.4 }}
      className="mb-10 flex w-full flex-col items-center"
    >
      {/* Primary CTA — 単一化 */}
      <Link href="/auth?mode=signup&intent=first-cert">
        <button
          className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] px-8 sm:px-10 py-4 sm:py-5 text-base sm:text-lg font-black text-white shadow-[0_0_40px_rgba(108,62,244,0.45)] transition-transform hover:scale-[1.03]"
          aria-label="無料で証明書を1枚作ってみる"
        >
          無料で証明書を1枚作ってみる
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </Link>

      <p className="mt-3 text-xs text-[#A8A0D8] flex items-center justify-center gap-1.5">
        <Lock className="h-3 w-3 text-[#00D4AA]" />
        クレカ不要 / 月30件まで無料 / 1分で完了
      </p>

      {/* Secondary — メール先行登録 */}
      {showWaitlistFallback && (
        <a
          href="#waitlist-section"
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#A8A0D8] underline-offset-4 hover:text-white hover:underline transition-colors"
        >
          いますぐ作らずに、先にメールで通知を受け取る
        </a>
      )}
    </motion.div>
  );
}
