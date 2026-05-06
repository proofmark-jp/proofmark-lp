/**
 * HeroDemoOrFallback.tsx — HeroDemo と WebP フォールバックの自動切替
 *
 * - JS 有効・モーション可・実機が十分速い → HeroDemo（Framer Motion）
 * - 上記以外（reduced-motion / 旧端末 / JS 無効化された <noscript> 領域）→ WebP
 *
 * 仕様書 §6 C と整合。LCP を最優先するため、フォールバック WebP は <picture> で先に
 * 出し、JS が乗り換えるまで体験が崩れないようにします。
 */

import { lazy, Suspense, useEffect, useState } from "react";
import type { HeroDemoProps } from "./HeroDemo";

const HeroDemo = lazy(() => import("./HeroDemo"));

export interface HeroDemoOrFallbackProps extends HeroDemoProps {
  /** /public からの相対パス。例: "/hero/hero-demo.webp" */
  fallbackWebpSrc: string;
  /** 同等の静止画 PNG（さらに重要なフォールバック）。例: "/hero/hero-demo.png" */
  fallbackStaticSrc?: string;
}

export default function HeroDemoOrFallback(props: HeroDemoOrFallbackProps) {
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    // 初回 paint を譲り、ユーザーがスクロール開始する直前で有効化
    const idle =
      (window as any).requestIdleCallback ||
      ((cb: any) => window.setTimeout(cb, 200));
    idle(() => setInteractive(true));
  }, []);

  const { fallbackWebpSrc, fallbackStaticSrc, ...heroProps } = props;

  if (!interactive) {
    return (
      <picture>
        {fallbackStaticSrc && (
          <source media="(prefers-reduced-motion: reduce)" srcSet={fallbackStaticSrc} />
        )}
        <img
          src={fallbackWebpSrc}
          alt="ProofMark hero animation"
          width={1280}
          height={720}
          decoding="async"
          loading="eager"
          fetchPriority="high"
          style={{ width: "100%", height: "auto", borderRadius: 24 }}
        />
      </picture>
    );
  }

  return (
    <Suspense
      fallback={
        <img
          src={fallbackWebpSrc}
          alt="ProofMark hero animation"
          width={1280}
          height={720}
          style={{ width: "100%", height: "auto", borderRadius: 24 }}
        />
      }
    >
      <HeroDemo {...heroProps} />
    </Suspense>
  );
}
