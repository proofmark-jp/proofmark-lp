/**
 * VisibilityToggle.tsx — ProofMark Public/Private Pill (v2)
 *
 * 修正点:
 *  - 旧スキーマ `proven_assets` への参照を完全削除し、`certificates` テーブルへ
 *    update する正規実装に差し替え。
 *  - 切替中の微細フィードバック (Loader2) を強化、disabled 視覚も上品に。
 *  - `layoutId` で滑らかな pill 移動、`spring` 物理で Stripe / Linear 級の質感。
 *
 * Props 契約は完全後方互換 (assetId / initialVisibility / onVisibilityChange)。
 */

import { useState } from 'react';
import { Globe, Lock, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

interface VisibilityToggleProps {
  /** 証明書 ID (certificates.id) */
  assetId: string;
  initialVisibility: 'public' | 'private';
  onVisibilityChange?: (newVisibility: 'public' | 'private') => void;
  /** UI を強制的に縮める時に使う（Dashboard 一覧行用） */
  size?: 'sm' | 'md';
}

export default function VisibilityToggle({
  assetId,
  initialVisibility,
  onVisibilityChange,
  size = 'md',
}: VisibilityToggleProps) {
  const [visibility, setVisibility] = useState<'public' | 'private'>(initialVisibility);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async (target: 'public' | 'private') => {
    if (visibility === target || isUpdating) return;

    // 1. Optimistic UI (即時切替で「触っている感」を作る)
    const previousVisibility = visibility;
    setVisibility(target);
    setIsUpdating(true);

    try {
      // 2. ✅ certificates テーブルへ正規 update
      //     旧スキーマ `proven_assets` は完全に廃止。
      const { error } = await supabase
        .from('certificates')
        .update({ visibility: target })
        .eq('id', assetId);

      if (error) throw error;

      toast.success(
        target === 'public' ? '公開に設定しました' : '非公開 (NDAモード) に設定しました',
        {
          description: target === 'public'
            ? '検証URLを共有すると誰でも閲覧できます'
            : 'リンクを知っている本人のみ閲覧可能です',
        },
      );
      onVisibilityChange?.(target);
    } catch (error: any) {
      // 3. ロールバック + 失敗フィードバック
      setVisibility(previousVisibility);
      toast.error('設定の変更に失敗しました', {
        description: error?.message ?? '時間をおいて再試行してください',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const isPublic = visibility === 'public';
  const cellSize = size === 'sm' ? 24 : 28;
  const iconClass = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <div
      className="inline-flex items-center bg-[#07061A]/90 border border-white/[0.06] p-[3px] rounded-full relative select-none"
      style={{
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
        // updating 中はうっすら停止感を出す（hover の誤発火を抑止）
        opacity: isUpdating ? 0.92 : 1,
        transition: 'opacity 0.18s ease',
      }}
      aria-busy={isUpdating}
    >
      {/* Private (🔒) */}
      <button
        type="button"
        disabled={isUpdating}
        onClick={() => handleToggle('private')}
        className={`relative flex items-center justify-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C3EF4]/40 z-10 ${
          !isPublic ? 'text-white' : 'text-white/40 hover:text-white/65'
        } ${isUpdating ? 'cursor-wait' : 'cursor-pointer'}`}
        style={{ width: cellSize, height: cellSize }}
        title="非公開 (NDA)"
        aria-label="Set Private"
        aria-pressed={!isPublic}
      >
        {!isPublic && (
          <motion.div
            layoutId={`active-pill-${assetId}`}
            className="absolute inset-0 bg-[#6C3EF4] rounded-full -z-10"
            style={{ boxShadow: '0 2px 8px rgba(108,62,244,0.45)' }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}
        <span className="relative">
          {isUpdating && !isPublic ? (
            <Loader2 className={`${iconClass} animate-spin`} aria-hidden="true" />
          ) : (
            <Lock className={iconClass} aria-hidden="true" />
          )}
        </span>
      </button>

      {/* Public (🌐) */}
      <button
        type="button"
        disabled={isUpdating}
        onClick={() => handleToggle('public')}
        className={`relative flex items-center justify-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4AA]/40 z-10 ${
          isPublic ? 'text-[#07061A]' : 'text-white/40 hover:text-white/65'
        } ${isUpdating ? 'cursor-wait' : 'cursor-pointer'}`}
        style={{ width: cellSize, height: cellSize }}
        title="公開"
        aria-label="Set Public"
        aria-pressed={isPublic}
      >
        {isPublic && (
          <motion.div
            layoutId={`active-pill-${assetId}`}
            className="absolute inset-0 bg-[#00D4AA] rounded-full -z-10"
            style={{ boxShadow: '0 2px 8px rgba(0,212,170,0.45)' }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}
        <span className="relative">
          {isUpdating && isPublic ? (
            <Loader2 className={`${iconClass} animate-spin`} aria-hidden="true" />
          ) : (
            <Globe className={iconClass} aria-hidden="true" />
          )}
        </span>
      </button>
    </div>
  );
}