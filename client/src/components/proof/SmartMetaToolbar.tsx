// client/src/components/proof/SmartMetaToolbar.tsx
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Save, Undo2 } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════════════════════ */

export interface SmartMetaToolbarProps {
  /** 封印後にメタデータ（テキスト）の未保存変更がある状態 */
  hasUnsavedMeta: boolean;
  /** 画像差分（Fork）中は表示しない */
  isForkedDraft: boolean;
  /** メタデータ保存中フラグ */
  savingMeta: boolean;
  /** 現在のリヴィジョンラベル（例: "v2"） */
  revisionLabel: string;
  /** 「取り消す」ボタン押下ハンドラ */
  onRevert: () => void;
  /** 「変更を保存」ボタン押下ハンドラ */
  onSave: () => void;
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function SmartMetaToolbar({
  hasUnsavedMeta,
  isForkedDraft,
  savingMeta,
  revisionLabel,
  onRevert,
  onSave,
}: SmartMetaToolbarProps) {
  return (
    <AnimatePresence>
      {hasUnsavedMeta && !isForkedDraft && (
        <motion.div
          key="smart-meta-toolbar"
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          style={{ willChange: 'transform, opacity' }}
          className="mt-3 relative overflow-hidden rounded-2xl border border-[#00D4AA]/40 backdrop-blur-xl"
        >
          {/* ambient gradient (Linear / Stripe 流の繊細な層) */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(135deg, rgba(0,212,170,0.10) 0%, rgba(13,11,36,0.65) 50%, rgba(108,62,244,0.08) 100%)',
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />

          <div className="relative flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3">
            {/* Label */}
            <div className="flex items-center gap-2.5 min-w-0">
              <motion.span
                aria-hidden
                className="inline-block w-1.5 h-1.5 rounded-full bg-[#00D4AA]"
                animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.25, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                style={{ boxShadow: '0 0 8px rgba(0,212,170,0.7)' }}
              />
              <span className="text-sm font-bold text-white tracking-tight">
                📝 メタデータの未保存の変更があります
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
              <button
                type="button"
                onClick={onRevert}
                disabled={savingMeta}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#A8A0D8] hover:text-white hover:bg-white/5 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all"
                style={{ willChange: 'transform' }}
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>取り消す</span>
              </button>

              {/* Pulse Save Button — 呼吸する box-shadow で「押したくなる」 */}
              <motion.button
                type="button"
                onClick={onSave}
                disabled={savingMeta}
                whileTap={{ scale: 0.96 }}
                animate={
                  savingMeta
                    ? undefined
                    : {
                        boxShadow: [
                          '0 0 0 0 rgba(0,212,170,0.0), 0 6px 18px rgba(0,212,170,0.28)',
                          '0 0 0 6px rgba(0,212,170,0.18), 0 8px 24px rgba(0,212,170,0.40)',
                          '0 0 0 0 rgba(0,212,170,0.0), 0 6px 18px rgba(0,212,170,0.28)',
                        ],
                      }
                }
                transition={{ duration: 2.0, repeat: Infinity, ease: 'easeInOut' }}
                className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black tracking-wide disabled:opacity-60 disabled:pointer-events-none"
                style={{
                  background: 'linear-gradient(135deg, #00D4AA 0%, #00B89A 100%)',
                  color: '#07061A',
                  willChange: 'transform, box-shadow, opacity',
                }}
              >
                {savingMeta ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>保存中...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>変更を保存</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>

          {/* TSA 非消費の微細なヒント */}
          <div className="relative px-4 pb-3 -mt-1 flex items-center justify-between">
            <span className="text-[10px] font-mono tracking-[0.14em] text-[#A8A0D8]/50 uppercase">
              text-only · no TSA consumption
            </span>
            <span className="text-[10px] text-[#A8A0D8]/40">
              画像を編集すると新リヴィジョン (v{(parseInt(revisionLabel.replace('v', ''), 10) || 1) + 1}) になります
            </span>
          </div>

          {/* bottom accent line */}
          <div
            aria-hidden
            className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(0,212,170,0.5) 30%, rgba(108,62,244,0.5) 70%, transparent 100%)',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
