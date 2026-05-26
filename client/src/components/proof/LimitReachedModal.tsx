/**
 * LimitReachedModal.tsx
 * ─────────────────────────────────────────────────────────────
 * 無料枠（月3件）上限到達時のアップセルモーダル（PLGのコア駆動）
 * ─────────────────────────────────────────────────────────────
 */

import { AnimatePresence, motion } from 'framer-motion';
import { ShieldAlert, Zap, Crown, X, Check } from 'lucide-react';
import { Link } from 'wouter';

const PM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LimitReachedModal({ isOpen, onClose }: LimitReachedModalProps): JSX.Element {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#07061A]/80 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.4, ease: PM_EASE }}
            className="relative w-full max-w-lg overflow-hidden rounded-[28px] border p-6 sm:p-8 text-center"
            style={{
              background: '#0D0B24',
              borderColor: 'rgba(108,62,244,0.3)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 80px rgba(108,62,244,0.15)',
            }}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
              aria-label="閉じる"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Alert Icon */}
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF453A]/10 text-[#FF453A] border border-[#FF453A]/20">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#FF453A]">
              Monthly Limit Reached
            </span>
            <h3 className="text-xl font-extrabold text-white mt-2 leading-tight">
              今月の無料発行枠（3件）を<br />すべて使い切りました。
            </h3>
            <p className="text-sm text-white/60 mt-3 leading-relaxed">
              ProofMarkをご利用いただきありがとうございます。<br />
              このまま納品を続けるには、以下の2つの方法を選択できます。
            </p>

            {/* Options Grid */}
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 text-left">
              
              {/* Option 1: SPOT */}
              <div 
                className="rounded-xl border p-4 flex flex-col justify-between"
                style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#00D4AA]">
                    <Zap className="w-3.5 h-3.5" /> SPOT
                  </div>
                  <p className="text-lg font-black text-white mt-1">¥480 <span className="text-xs font-normal text-white/50">/ 件</span></p>
                  <p className="text-[11px] text-white/50 mt-1 leading-tight">この1案件だけ、今すぐ単発で証明書をPDF発行</p>
                </div>
                <Link
                  href="/spot-issue"
                  className="mt-4 flex h-9 items-center justify-center rounded-lg text-xs font-bold bg-white/10 hover:bg-white/15 text-white transition-colors text-center"
                >
                  単発で発行する
                </Link>
              </div>

              {/* Option 2: CREATOR */}
              <div 
                className="rounded-xl border p-4 flex flex-col justify-between relative overflow-hidden"
                style={{ borderColor: 'rgba(108,62,244,0.4)', background: 'rgba(108,62,244,0.08)' }}
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#BC78FF]">
                    <Crown className="w-3.5 h-3.5" /> CREATOR
                  </div>
                  <p className="text-lg font-black text-white mt-1">¥1,480 <span className="text-xs font-normal text-white/50">/ 月</span></p>
                  <p className="text-[11px] text-white/70 mt-1 leading-tight">毎月50件までEvidence Packを発行可能。名義切替も解禁。</p>
                </div>
                <Link
                  href="/settings/billing"
                  className="mt-4 flex h-9 items-center justify-center rounded-lg text-xs font-bold text-white transition-transform hover:scale-[1.02]"
                  style={{ background: 'linear-gradient(135deg, #6C3EF4 0%, #00D4AA 100%)' }}
                >
                  プランをアップグレード
                </Link>
              </div>

            </div>

            <p className="mt-5 text-[11px] text-white/40">
              ※無料のWeb証明履歴はリセットされず、永続的に保持・検証可能です。
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}