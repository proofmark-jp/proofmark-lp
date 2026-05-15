/**
 * UpgradeModal.tsx — Phase 12.3 Graceful アップセル UI
 *
 * トリガー:
 *   1. ローカルカウントが 30 件に到達 (UI 予測)
 *   2. サーバから 429 quota_exceeded が返ってきた瞬間 (真)
 *
 * 設計:
 *   • ProofMark のトンマナ (#0D0B24 / #00D4AA / #6C3EF4 / glass blur)
 *   • framer-motion で滑らかに mount / unmount
 *   • body scroll を lock し、Escape / 背景クリックで閉じる
 *   • 「Creator にアップグレード」CTA は /pricing#creator へ
 *   • 「今月の上限到達日時」をリセット日時で明示 (信頼性)
 *   • prefers-reduced-motion で animation を退避
 *   • a11y: role=dialog / aria-modal / focus trap (最初のボタンに focus)
 */

import { useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Lock, ShieldCheck, Sparkles, X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  /** UI 表示用。未指定なら「来月初」を自動表示する。 */
  resetAt?: string | null;
  /** クォータ超過の根拠 (UI に出す). */
  used?: number;
  quota?: number;
}

function formatResetAtJst(iso: string | null | undefined): string {
  if (!iso) return '翌月の月初 (JST 00:00)';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '翌月の月初 (JST 00:00)';
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function UpgradeModal({ open, onClose, resetAt, used, quota = 30 }: Props) {
  const reduced = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const ctaRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Move focus to the upgrade CTA after mount
    const t = window.setTimeout(() => ctaRef.current?.focus(), 60);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="upgrade-modal-backdrop"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(5,4,18,0.78)] backdrop-blur-sm px-4"
          onMouseDown={(e) => {
            // Close on backdrop click only
            if (e.target === e.currentTarget) onClose();
          }}
          aria-hidden={!open}
        >
          <motion.div
            key="upgrade-modal-dialog"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="upgrade-modal-title"
            aria-describedby="upgrade-modal-desc"
            initial={reduced ? false : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.985 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-[#1C1A38] bg-[#0D0B24]/95 p-7 shadow-[0_30px_80px_-30px_rgba(108,62,244,0.55)] sm:p-9"
          >
            {/* Glow ornaments */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[#6C3EF4]/25 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-[#00D4AA]/15 blur-3xl"
            />

            <button
              type="button"
              onClick={onClose}
              aria-label="閉じる"
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#2a2a4e] bg-[#0a0e27]/70 text-[#A8A0D8] transition-colors hover:border-[#00D4AA]/50 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em]"
                style={{
                  color: '#FFD966',
                  background: 'rgba(255,217,102,0.10)',
                  border: '1px solid rgba(255,217,102,0.40)',
                }}
              >
                <Lock className="h-3 w-3" aria-hidden="true" />
                Free Plan · 月間上限到達
              </span>
              <h2
                id="upgrade-modal-title"
                className="mt-4 font-display text-[26px] font-extrabold leading-tight text-white sm:text-[30px]"
              >
                今月の<span className="text-[#00D4AA]">{quota}件</span>を、
                すべて使い切りました。
              </h2>
              <p
                id="upgrade-modal-desc"
                className="mt-3 text-sm leading-relaxed text-[#A8A0D8]"
              >
                {typeof used === 'number' && used > 0 ? (
                  <>これまでに <span className="font-semibold text-white">{used} 件</span> の証明を発行しました。</>
                ) : null}{' '}
                月初リセットは <span className="font-semibold text-white">{formatResetAtJst(resetAt)}</span>。
                それまで待たずに発行を続けるなら、Creator プランへ。
              </p>

              <div className="mt-6 grid gap-2.5">
                <Bullet>納品用PDF証明書 ＆ Evidence Pack (証拠一式)</Bullet>
                <Bullet>実務に耐えうる月30件の本格的なビジネス利用</Bullet>
                <Bullet>NDA マスク・案件ごとの整理 (Studio に拡張可)</Bullet>
                <Bullet>C2PA Content Credentials の同梱</Bullet>
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-sm font-semibold text-[#A8A0D8] transition-colors hover:text-white"
                >
                  あとで決める
                </button>
                <Link href="/pricing#creator">
                  <a
                    ref={ctaRef}
                    className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] px-6 py-3 text-sm font-black tracking-wide text-white shadow-[0_0_24px_rgba(108,62,244,0.45)] transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4AA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0B24]"
                    onClick={onClose}
                  >
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Creator にアップグレード
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </a>
                </Link>
              </div>

              <p className="mt-5 flex items-center gap-1.5 text-[11px] text-[#48456A]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#00D4AA]" aria-hidden="true" />
                Stripeによるセキュアな決済 / いつでも解約 / 既存の証明書はそのまま保持
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-[#1C1A38] bg-[#0a0e27]/60 px-3.5 py-2.5">
      <span
        aria-hidden="true"
        className="mt-[3px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
        style={{
          color: '#00D4AA',
          background: 'rgba(0,212,170,0.10)',
          border: '1px solid rgba(0,212,170,0.45)',
        }}
      >
        <ShieldCheck className="h-2.5 w-2.5" />
      </span>
      <span className="text-sm leading-relaxed text-[#D4D0F4]">{children}</span>
    </div>
  );
}
