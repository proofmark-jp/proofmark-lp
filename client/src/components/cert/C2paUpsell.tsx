/**
 * C2paUpsell — Free プラン向け、C2PA メタデータ検出時のアップセル UI。
 *
 * Phase 10 のビジネス導線:
 *   • Free プランのユーザーが C2PA を持つ画像をドロップした瞬間、Worker は
 *     起動せず、`probeC2paMagic()` のバイトスキャンだけで検知する。
 *   • そこから本コンポーネントを Dropzone 直上に表示し、Creator プランへ
 *     導く。文言は「機能のためのアップセル」ではなく「ユーザーが拾える価値」
 *     として伝える。
 *   • 「無視して進む」操作で従来の RFC3161 だけの証明発行を 1ms も遅延させ
 *     ない。これが Apple-level UX の絶対条件。
 *
 * ブランド: linear-gradient(135deg,#6c3ef4,#00d4aa) を 1 本だけ使用。
 */

import { motion } from 'framer-motion';
import { ArrowRight, Layers3, Lock, ShieldCheck, X } from 'lucide-react';

interface Props {
  /** /pricing への遷移ハンドラ (wouter 等を親で接続) */
  onUpgrade: () => void;
  /** 「このまま続ける」 (= C2PA を解析せず、従来フローで証明発行) */
  onDismiss: () => void;
}

export function C2paUpsell({ onUpgrade, onDismiss }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      role="status"
      aria-live="polite"
      className="relative overflow-hidden rounded-[calc(0.65rem+2px)] border border-[#2a2a4e] bg-[#151d2f] mb-4"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(108,62,244,0.65) 35%, rgba(0,212,170,0.65) 65%, transparent 100%)',
        }}
      />
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4">
        <span
          aria-hidden="true"
          className="w-9 h-9 rounded-[calc(0.65rem-2px)] flex items-center justify-center shrink-0"
          style={{
            background: 'rgba(108,62,244,0.12)',
            border: '1px solid rgba(108,62,244,0.35)',
            color: '#bc78ff',
          }}
        >
          <Layers3 className="w-4 h-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest mb-1"
            style={{
              color: '#00D4AA',
              background: 'rgba(0,212,170,0.10)',
              border: '1px solid rgba(0,212,170,0.40)',
            }}
          >
            <ShieldCheck className="w-3 h-3" aria-hidden="true" />
            Content Credentials Detected
          </p>
          <p className="text-[13px] sm:text-[14px] font-semibold text-[#f0f0fa] leading-snug">
            🔒 この画像から C2PA メタデータを検知しました
          </p>
          <p className="mt-1 text-[11px] sm:text-[12px] text-[#a0a0c0] leading-relaxed">
            Creator プラン以上にアップグレードすると、Adobe Creative Cloud などが埋め込んだ
            <span className="text-[#f0f0fa]/85"> 発行元 / 制作ソフト / 生成 AI 使用フラグ</span>
            を解析し、ProofMark の証明書 (RFC3161) と統合して表示できます。
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <motion.button
            type="button"
            onClick={onUpgrade}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-1.5 rounded-[calc(0.65rem-2px)] px-3 py-2 text-[12px] font-bold"
            style={{
              background: 'linear-gradient(135deg, #6c3ef4 0%, #00d4aa 100%)',
              color: '#0a0e27',
              boxShadow: '0 8px 24px -12px rgba(108,62,244,0.55)',
            }}
          >
            アップグレードして解析
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </motion.button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="無視してこのまま証明を発行"
            className="p-2 rounded-md text-[#a0a0c0] hover:text-[#f0f0fa] hover:bg-white/5 transition-colors"
            title="無視してこのまま証明を発行"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <p className="px-4 sm:px-5 pb-3 text-[10px] text-[#a0a0c0]/80 inline-flex items-center gap-1.5">
        <Lock className="w-3 h-3" aria-hidden="true" />
        ファイル本体はサーバーへ送信されません。解析はあなたのブラウザ内で完結します。
      </p>
    </motion.div>
  );
}
