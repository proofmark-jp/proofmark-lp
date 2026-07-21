// client/src/components/proof/ResolutionArea.tsx
import { AnimatePresence, motion } from 'framer-motion';
import {
  CloudLightning,
  GitBranch,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import KineticSlideToSeal from './KineticSlideToSeal';
import SmartMetaToolbar from './SmartMetaToolbar';

/* ═══════════════════════════════════════════════════════════════
   SealedResolutionPanel — 内部サブコンポーネント（Props型で制御）
   ═══════════════════════════════════════════════════════════════ */

interface SealedResolutionPanelProps {
  submitting: boolean;
  caption: string;
  revisionLabel: string;
  headSha: string | null;
  onViewCert?: () => void;
}

function SealedResolutionPanel({
  submitting,
  caption,
  revisionLabel,
  headSha,
  onViewCert,
}: SealedResolutionPanelProps) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-px rounded-3xl pointer-events-none opacity-70"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 0%, rgba(0,212,170,0.18), transparent 70%), radial-gradient(60% 60% at 50% 100%, rgba(108,62,244,0.18), transparent 70%)',
          filter: 'blur(20px)',
        }}
      />

      <div
        className="relative overflow-hidden rounded-3xl border border-[#00D4AA]/30 backdrop-blur-xl"
        style={{
          background:
            'linear-gradient(135deg, rgba(0,212,170,0.10) 0%, rgba(13,11,36,0.55) 50%, rgba(108,62,244,0.12) 100%)',
          boxShadow:
            '0 1px 0 rgba(255,255,255,0.08) inset, 0 24px 60px rgba(0,212,170,0.10), 0 4px 16px rgba(0,0,0,0.4)',
        }}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative p-6 md:p-7">
          <div className="flex items-start gap-4">
            <motion.div
              initial={{ rotate: -8, scale: 0.85, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.06 }}
              className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #00D4AA 0%, #6C3EF4 100%)',
                boxShadow:
                  '0 8px 24px rgba(0,212,170,0.35), 0 0 1px rgba(255,255,255,0.5) inset',
              }}
            >
              <Lock className="w-7 h-7 text-white" strokeWidth={2.5} />
            </motion.div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg md:text-xl font-black tracking-tight text-white">
                  🔒 暗号封印済み
                </h3>
                <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-[#00D4AA]/80">
                  Verified by ProofMark
                </span>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase"
                  style={{
                    background: 'rgba(108,62,244,0.18)',
                    border: '1px solid rgba(108,62,244,0.35)',
                    color: '#BC78FF',
                  }}
                >
                  <GitBranch className="w-2.5 h-2.5" />
                  {revisionLabel}
                </span>
              </div>

              <p className="mt-2 text-sm leading-6 text-[#D4D0F4]/85 max-w-xl">
                公的な <strong className="text-white">The Merkle Rollup</strong> に記録されました。
                <span className="text-[#A8A0D8]">編集を加えると新しいリヴィジョン</span>
                <strong className="text-[#00D4AA]">
                  {' '}(v{((parseInt(revisionLabel.replace('v', ''), 10) || 1) + 1)}){' '}
                </strong>
                <span className="text-[#A8A0D8]">として派生します。</span>
              </p>

              {headSha && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#07061A]/70 border border-white/10 backdrop-blur-md">
                  <ShieldCheck className="w-3 h-3 text-[#00D4AA]" />
                  <code className="text-[10px] font-mono text-[#A8A0D8] tracking-wider">
                    HEAD&nbsp;{headSha.slice(0, 10)}…{headSha.slice(-8)}
                  </code>
                </div>
              )}

              {submitting && (
                <div className="mt-4 flex items-center gap-2 text-xs text-[#A8A0D8]/80">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00D4AA]" />
                  <span>{caption}</span>
                </div>
              )}

              {!submitting && onViewCert && (
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={onViewCert}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-[#07061A]"
                    style={{
                      background: 'linear-gradient(135deg, #00D4AA 0%, #00B89A 100%)',
                      boxShadow: '0 6px 20px rgba(0,212,170,0.32)',
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    証明書を見る
                  </button>
                  <span className="text-[10px] text-[#A8A0D8]/40 font-mono tracking-wider">
                    Edits below auto-fork to new revision
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          aria-hidden
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(0,212,170,0.6) 30%, rgba(108,62,244,0.6) 70%, transparent 100%)',
          }}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════════════════════ */

export interface ResolutionAreaProps {
  /** 工程数 */
  stepCount: number;
  readyCount: number;
  allVerified: boolean;
  allUploaded: boolean;
  magicMode: boolean;
  /** 封印状態 */
  sealed: boolean;
  /** 封印後に画像変更があった（新リヴィジョン候補）状態 */
  isForkedDraft: boolean;
  /** 封印後にメタデータ（テキスト）の未保存変更がある状態 */
  hasUnsavedMeta: boolean;
  /** メタデータ保存中 */
  savingMeta: boolean;
  /** Slide to Seal の disabled 制御 */
  canSubmit: boolean;
  /** 送信中フラグ */
  submitting: boolean;
  /** 圧縮フェーズキャプション */
  compressionCaption: string;
  /** リヴィジョンラベル（例: "v2"） */
  revisionLabel: string;
  /** HEAD の SHA256 */
  headSha: string | null;
  /** 封印（Slide to Seal）完了時のコールバック */
  onSealed: () => void;
  /** 画像差分をリバートするコールバック */
  onRevertToSealed: () => void;
  /** メタデータ変更をリバートするコールバック */
  onRevertMetadata: () => void;
  /** メタデータを保存するコールバック */
  onSaveMetadata: () => void;
  /** 証明書を見るボタン押下コールバック（証明書IDが確定している場合のみ渡す） */
  onViewCert?: () => void;
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function ResolutionArea({
  stepCount,
  readyCount,
  allVerified,
  allUploaded,
  magicMode,
  sealed,
  isForkedDraft,
  hasUnsavedMeta,
  savingMeta,
  canSubmit,
  submitting,
  compressionCaption,
  revisionLabel,
  headSha,
  onSealed,
  onRevertToSealed,
  onRevertMetadata,
  onSaveMetadata,
  onViewCert,
}: ResolutionAreaProps) {
  return (
    <div className="mt-6 pt-6 border-t border-white/5">
      {/* 工程数・同期ステータス */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="text-sm text-[#A8A0D8]/50 min-w-0 truncate">
          <span className="text-white font-bold">{readyCount}</span> 工程が連結可能
          {!allVerified && stepCount > 0 && (
            <span className="ml-2 text-xs text-[#6C3EF4] animate-pulse">
              <Loader2 className="inline w-3 h-3 animate-spin mr-1" />
              ハッシュ計算中...
            </span>
          )}
          {!magicMode && allVerified && !allUploaded && stepCount > 0 && (
            <span className="ml-2 text-xs text-[#00D4AA] animate-pulse">
              <CloudLightning className="inline w-3 h-3 mr-1" />
              クラウド同期中...
            </span>
          )}
        </div>
      </div>

      {/* Autosaved label (Draft 時のみ控えめに表示) */}
      <AnimatePresence>
        {!sealed && (
          <motion.div
            key="autosaved"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="mb-3 flex items-center justify-center gap-1.5 text-[10px] tracking-[0.16em] text-[#A8A0D8]/40 uppercase font-medium"
          >
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#00D4AA]/60"
              style={{ boxShadow: '0 0 6px rgba(0,212,170,0.5)' }}
            />
            Autosaved · ProofMark Secure Storage
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slider ↔ Sealed Resolution Panel クロスフェード */}
      <AnimatePresence mode="wait">
        {!sealed ? (
          <motion.div
            key="slider"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <KineticSlideToSeal
              empty={stepCount === 0}
              disabled={!canSubmit}
              onSealed={onSealed}
            />

            {/* Revert Button (画像差分時のみ) */}
            <AnimatePresence>
              {isForkedDraft && (
                <motion.button
                  key="revert-btn"
                  type="button"
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                  onClick={onRevertToSealed}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all group"
                  style={{
                    background: 'rgba(168, 160, 216, 0.06)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 138, 133, 0.25)',
                    color: '#FF8A85',
                    boxShadow: '0 2px 16px rgba(255, 138, 133, 0.08)',
                  }}
                >
                  <motion.span
                    animate={{ rotate: [0, -12, 0] }}
                    transition={{ delay: 0.3, duration: 0.4, ease: 'easeInOut' }}
                    style={{ display: 'inline-block' }}
                  >
                    ↩️
                  </motion.span>
                  <span className="tracking-wide">
                    変更を破棄して封印状態に戻す
                  </span>
                  <span
                    className="ml-auto text-[9px] font-mono uppercase tracking-widest opacity-50 group-hover:opacity-80 transition-opacity"
                    style={{ color: '#A8A0D8' }}
                  >
                    Revert to Sealed
                  </span>
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            key="verified"
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            <SealedResolutionPanel
              submitting={submitting}
              caption={compressionCaption}
              revisionLabel={revisionLabel}
              headSha={headSha}
              onViewCert={onViewCert}
            />

            {/* ⭐ Smart Meta Toolbar — hasUnsavedMeta 時のみ出現 */}
            <SmartMetaToolbar
              hasUnsavedMeta={hasUnsavedMeta}
              isForkedDraft={isForkedDraft}
              savingMeta={savingMeta}
              revisionLabel={revisionLabel}
              onRevert={onRevertMetadata}
              onSave={onSaveMetadata}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
