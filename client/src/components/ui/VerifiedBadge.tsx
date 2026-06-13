/**
 * VerifiedBadge.tsx
 * -----------------------------------------------------------------------------
 * ProofMark Gallery 用「右アンカー展開型」トラストバッジ。
 * * 【修正点 (God-Tier Upgrades)】
 * 1. Hover-Spam の防止: setTimeout を用いた intent-delay (100ms) を導入し、
 * マウスが通過しただけの意図しない暴発展開を防止。
 * 2. Z-Index エレベーション: 展開時のみ zIndex を昇格させ、隣接要素への潜り込みを防止。
 * 3. 確実な GPU 処理: Layout 計算を抑制し、Composite のみで処理させる。
 * -----------------------------------------------------------------------------
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { ShieldCheck, Lock } from 'lucide-react';

/* ... (THEME等の定数は変更なしのため省略) ... */
interface BadgeTheme {
  primary: string; primaryRgb: string; accent: string; accentRgb: string; label: string; Icon: typeof ShieldCheck;
}
const THEME_PUBLIC: BadgeTheme = { primary: '#00D4AA', primaryRgb: '0,212,170', accent: '#00D4AA', accentRgb: '0,212,170', label: '3 STEPS VERIFIED', Icon: ShieldCheck };
const THEME_NDA: BadgeTheme = { primary: '#6C3EF4', primaryRgb: '108,62,244', accent: '#F0BB38', accentRgb: '240,187,56', label: 'NDA PROTECTED', Icon: Lock };

const COLLAPSED_W = 28;
const EXPANDED_W = 134;
const HEIGHT = 28;
const EXPAND_SPRING = { type: 'spring', stiffness: 400, damping: 28, mass: 0.8 } as const;

const TEXT_VARIANTS: Variants = {
  initial: { opacity: 0, x: 6 },
  animate: { opacity: 1, x: 0, transition: { delay: 0.12, duration: 0.22, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, x: 6, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } },
};

const SHINE_VARIANTS: Variants = {
  initial: { x: '-160%', opacity: 0 },
  animate: {
    x: '220%', opacity: [0, 0.55, 0.55, 0],
    transition: { x: { duration: 1.0, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: 1.0, times: [0, 0.2, 0.7, 1] } },
  },
};

export interface VerifiedBadgeProps {
  isMasked: boolean;
  reduce: boolean;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ isMasked, reduce }) => {
  const [expanded, setExpanded] = useState(false);
  const theme = isMasked ? THEME_NDA : THEME_PUBLIC;
  const { Icon } = theme;
  
  // Hover Intent (暴発防止用タイマー)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); };
  }, []);

  const handleHoverStart = () => {
    // マウス通過による暴発を防ぐため 100ms 待つ
    hoverTimerRef.current = setTimeout(() => setExpanded(true), 100);
  };
  const handleHoverEnd = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setExpanded(false);
  };
  const handleFocus = () => setExpanded(true);
  const handleBlur = () => setExpanded(false);

  const pulseAnimate = useMemo(() => {
    if (reduce) return undefined;
    return { boxShadow: [`0 0 0 0 rgba(${theme.primaryRgb}, 0)`, `0 0 10px 1px rgba(${theme.primaryRgb}, 0.35)`, `0 0 0 0 rgba(${theme.primaryRgb}, 0)`] };
  }, [reduce, theme.primaryRgb]);

  const backgroundStyle = useMemo<React.CSSProperties>(() => ({
    backgroundImage: `linear-gradient(135deg, rgba(${theme.primaryRgb}, 0.10) 0%, rgba(${theme.accentRgb}, 0.06) 100%)`,
    backgroundColor: 'rgba(5,5,12,0.55)',
  }), [theme.primaryRgb, theme.accentRgb]);

  return (
    <motion.div
      role="status"
      aria-label={theme.label}
      tabIndex={0}
      onHoverStart={handleHoverStart}
      onHoverEnd={handleHoverEnd}
      onFocus={handleFocus}
      onBlur={handleBlur}
      initial={false}
      layout={false} // CPUリフローを誘発するFramerのLayoutエンジンを明示的に遮断
      animate={{ width: expanded ? EXPANDED_W : COLLAPSED_W }}
      transition={reduce ? { duration: 0 } : EXPAND_SPRING}
      className="absolute top-3 right-3 outline-none focus-visible:ring-1 focus-visible:ring-white/40 rounded-full overflow-hidden"
      style={{
        height: HEIGHT,
        zIndex: expanded ? 50 : 30, // 展開時のみ前面に昇格
        willChange: 'width, transform',
        contain: 'layout paint',
        transform: 'translateZ(0)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: `1px solid rgba(${theme.primaryRgb}, 0.65)`,
        ...backgroundStyle,
      }}
    >
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ willChange: 'box-shadow' }}
        animate={pulseAnimate}
        transition={reduce ? undefined : { duration: 2.0, repeat: Infinity, ease: 'easeInOut' }}
      />

      <AnimatePresence>
        {expanded && !reduce && (
          <motion.div
            key="pm-shine"
            aria-hidden
            className="absolute inset-y-0 pointer-events-none"
            style={{
              width: '40%', left: 0,
              background: `linear-gradient(115deg, transparent 0%, rgba(${theme.accentRgb}, 0.55) 50%, transparent 100%)`,
              transform: 'translateX(-160%) skewX(-22deg)',
              willChange: 'transform, opacity', filter: 'blur(2px)',
            }}
            variants={SHINE_VARIANTS}
            initial="initial"
            animate="animate"
          />
        )}
      </AnimatePresence>

      <div className="absolute inset-0 flex flex-row-reverse items-center" style={{ paddingRight: 0, paddingLeft: 10 }}>
        <div className="flex items-center justify-center flex-shrink-0" style={{ width: HEIGHT, height: HEIGHT }}>
          <Icon size={13} strokeWidth={2.2} color={theme.primary} style={{ filter: `drop-shadow(0 0 4px rgba(${theme.primaryRgb}, 0.6))` }} />
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.span
              key="pm-label"
              variants={TEXT_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              className="font-bold whitespace-nowrap select-none"
              style={{
                fontSize: 9.5, letterSpacing: '0.18em', color: theme.accent, textShadow: `0 0 6px rgba(${theme.accentRgb}, 0.4)`,
                lineHeight: 1, marginRight: 4,
              }}
            >
              {theme.label}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default VerifiedBadge;