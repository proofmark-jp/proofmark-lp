import { useState, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * The Apex Hydration-Safe Reduced Motion Hook
 * * Next.js 15 (SSR) 環境において、framer-motion の useReducedMotion は
 * サーバーサイドで window.matchMedia が存在しないため null を返す。
 * これをそのまま使用すると、OSの設定で「視差効果を減らす」をオンにしている
 * ユーザーのブラウザ上で hydration mismatch（サーバー: false, クライアント: true）
 * が発生し、UIの致命的なチラつき（Flash）やReactのエラーを引き起こす。
 * * このフックは、初期レンダリング（SSRおよびハイドレーション）時には
 * 強制的に false を返し、マウント完了後（CSR）に初めて実際のユーザー設定を反映する
 * ことで、この不整合を物理的に完全に遮断する。
 *
 * @returns {boolean} 視差効果を減らす設定が有効であり、かつマウント済みの場合のみ true
 */
export function useSafeReducedMotion(): boolean {
  // framer-motionの本来のフックを呼び出す (戻り値は boolean | null)
  const shouldReduceMotion = useReducedMotion();

  // コンポーネントのマウント状態を厳格に追跡するState
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    // クライアントサイドでの初期描画（ハイドレーション）完了後にマウントを確定させる
    setIsMounted(true);
  }, []);

  // 1. マウント前（SSR / ハイドレーション中）は、サーバー側のHTMLと完全に一致させるため絶対に false を返す
  // 2. マウント後は、shouldReduceMotion の実際の値（null の場合は false）を返す
  return isMounted ? (shouldReduceMotion ?? false) : false;
}