/**
 * KineticSlideToSeal.tsx — The Weight of History. The Magnetic Point of No Return.
 * ─────────────────────────────────────────────────────────────────────────────
 * ProofMark の最終トリガー。150 工程の歴史を封印する「重厚な金庫のカンヌキ」。
 *
 * Architecture Rules (絶対遵守)
 *  ① Zero-Render Physics — ドラッグ中の x 値は useMotionValue で管理し、
 *     派生視覚 (背景幅 / テキスト不透明度 / ネオン強度) はすべて useTransform。
 *     React の setState は「成功/失敗の確定」時のみ呼ぶ。
 *  ② Dynamic Width — ResizeObserver で親幅を購読し、MAX_X を再計算する。
 *
 * Interaction
 *  - Phase 1: dragElastic 0.02 の重い金属ドラッグ + 液体プログレス追随
 *  - Phase 2: 85% 未満で離す → spring(450,25,m=1.2) で左端へガチャン弾き返し
 *  - Phase 3: 85% 突破 → magnetic snap(600,20) + haptic + neon explosion +
 *             "🔒 SEALED" の啓示 + onSealed() 発火 + 永久ロック
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from 'framer-motion';
import { Lock, ChevronsRight, ShieldCheck } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════════════════════ */

export interface KineticSlideToSealProps {
  /** true: ドロップ前の完全ロック (grayscale + drag 禁止) */
  empty: boolean;
  /** true: 処理中など操作不可 (opacity 0.5 + drag 禁止) */
  disabled: boolean;
  /** 封印完了コールバック */
  onSealed: () => void;
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const TRACK_HEIGHT = 72;
const KNOB_WIDTH = 92;
const PADDING = 6;                     // トラック内側パディング
const SEAL_THRESHOLD_RATIO = 0.85;     // 85% 突破で確定
const NEON = '#00FFCC';
const PURPLE = '#6C3EF4';
const TRACK_BASE = '#07061A';
const KNOB_BASE = '#1A153A';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function KineticSlideToSeal({
  empty,
  disabled,
  onSealed,
}: KineticSlideToSealProps) {
  /* ─── refs / state ─── */
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState<number>(0);

  /** 封印確定後の永久ロック。trueになったら以降のドラッグを一切受け付けない */
  const [sealed, setSealed] = useState<boolean>(false);

  /** ノブが現在ドラッグ中か (枝葉エフェクト用。 x 値そのものは触らない) */
  const [dragging, setDragging] = useState<boolean>(false);

  /* ─── motion values (Zero-Render Physics) ─── */
  const x = useMotionValue(0);

  /** 実効ドラッグ可能距離 */
  const maxX = Math.max(0, trackWidth - KNOB_WIDTH - PADDING * 2);

  /* ─── derived visuals (useTransform — 全て render 外) ─── */

  // L1 Progress Fill: ノブ中心まで液体が満たされる
  const fillWidth = useTransform(x, (v) => v + KNOB_WIDTH / 2 + PADDING);

  // L2 Ghost Text: 右へ引くほどフェードアウト
  const ghostOpacity = useTransform(
    x,
    [0, Math.max(1, maxX * 0.7)],
    [1, 0],
  );
  const ghostBlur = useTransform(
    x,
    [0, Math.max(1, maxX * 0.7)],
    ['blur(0px)', 'blur(2px)'],
  );

  // ノブのネオンシャドウ: ドラッグが進むほど強くなる
  const knobShadow = useTransform(x, (v) => {
    const t = maxX > 0 ? v / maxX : 0;
    const glow = 14 + t * 36;        // 14 → 50px
    const spread = 0 + t * 4;        // 0 → 4px
    const alpha = 0.35 + t * 0.5;    // 0.35 → 0.85
    return `0 8px 22px rgba(0,0,0,0.45), 0 0 ${glow}px ${spread}px rgba(0,255,204,${alpha.toFixed(3)})`;
  });

  // ノブのチェブロン (>>) 透明度: 引き始めで強調 → 進むと消える
  const chevronOpacity = useTransform(
    x,
    [0, Math.max(1, maxX * 0.4)],
    [0.85, 0],
  );

  // トラックの外周パルス: 進捗で内側のリング光量が増す
  const ringOpacity = useTransform(
    x,
    [0, Math.max(1, maxX)],
    [0.0, 0.35],
  );

  /* ─── ResizeObserver: 親幅を購読 ─── */
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const measure = () => {
      setTrackWidth(el.getBoundingClientRect().width);
    };

    measure();

    // ResizeObserver 優先、未対応環境は window resize にフォールバック
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    } else {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
  }, []);

  /* ─── lock helpers ─── */
  const isLocked = empty || disabled || sealed;

  /* ─── Phase 3: Magnetic Lock + Explosion ─── */
  const triggerSeal = useCallback(() => {
    if (sealed) return;

    // 1) Magnetic Snap: 強力な磁石でMAX_Xへ吸着
    animate(x, maxX, {
      type: 'spring',
      stiffness: 600,
      damping: 20,
    });

    // 2) State Lock (永久封印)
    setSealed(true);
    setDragging(false);

    // 3) Haptic Feedback
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }

    // 5) Callback (Neon Explosion は JSX 側で sealed=true をトリガに発火)
    //    確定後の React レンダリングと同フレームで親へ通知
    onSealed();
  }, [maxX, onSealed, sealed, x]);

  /* ─── Phase 2: Rejection (ガチャン) ─── */
  const rejectToOrigin = useCallback(() => {
    animate(x, 0, {
      type: 'spring',
      stiffness: 450,
      damping: 25,
      mass: 1.2,
    });
  }, [x]);

  /* ─── Drag Handlers ─── */
  const handleDragStart = useCallback(() => {
    if (isLocked) return;
    setDragging(true);
  }, [isLocked]);

  /**
   * onDrag は派生視覚に影響させない (Zero-Render Physics)。
   * ここでは「進行中に閾値を超えたら即座に Magnetic Snap」を行うため、
   * x.get() を読むだけにとどめ、setState は呼ばない。
   */
  const handleDrag = useCallback(
    (_: unknown, info: PanInfo) => {
      if (isLocked) return;
      if (maxX <= 0) return;
      // info.point ではなく motion value を信頼
      const current = x.get();
      if (current >= maxX * SEAL_THRESHOLD_RATIO) {
        triggerSeal();
      }
    },
    [isLocked, maxX, triggerSeal, x],
  );

  const handleDragEnd = useCallback(() => {
    if (sealed) return;
    setDragging(false);
    if (maxX <= 0) {
      rejectToOrigin();
      return;
    }
    const current = x.get();
    if (current >= maxX * SEAL_THRESHOLD_RATIO) {
      // 安全網: onDrag を素早く抜けた指離しでも確実に封印
      triggerSeal();
    } else {
      rejectToOrigin();
    }
  }, [sealed, maxX, rejectToOrigin, triggerSeal, x]);

  /* ─── unlock/empty に戻ったら x を 0 に戻す (sealed は維持) ─── */
  useEffect(() => {
    if (sealed) return;
    if (isLocked) {
      animate(x, 0, { type: 'spring', stiffness: 450, damping: 25, mass: 1.2 });
    }
  }, [isLocked, sealed, x]);

  /* ─── style: container ─── */
  const containerStyle: React.CSSProperties = {
    height: TRACK_HEIGHT,
    backgroundColor: TRACK_BASE,
    backgroundImage: `
      radial-gradient(ellipse at 0% 50%, rgba(0,255,204,0.06) 0%, transparent 60%),
      radial-gradient(ellipse at 100% 50%, rgba(108,62,244,0.08) 0%, transparent 60%)
    `,
    opacity: disabled && !sealed ? 0.5 : 1,
    filter: empty && !sealed ? 'grayscale(1)' : 'none',
    cursor: isLocked ? 'not-allowed' : 'grab',
    willChange: 'filter, opacity',
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label="スライドして封印 (Seal)"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={sealed ? 100 : 0}
      aria-disabled={isLocked}
      className="
        relative w-full select-none overflow-hidden
        rounded-2xl border border-white/10
        backdrop-blur-md
      "
      style={containerStyle}
    >
      {/* ═════════════════════════════════════════════════════════
         L0: Track Base — 内側の溝 (inset shadow による彫り込み)
         ═════════════════════════════════════════════════════════ */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          boxShadow:
            'inset 0 2px 6px rgba(0,0,0,0.65), inset 0 -1px 2px rgba(255,255,255,0.04)',
        }}
      />

      {/* ═════════════════════════════════════════════════════════
         L1: Progress Fill — 液体ネオン (シアン→パープル)
         ═════════════════════════════════════════════════════════ */}
      <motion.div
        aria-hidden
        className="absolute top-0 left-0 h-full rounded-2xl"
        style={{
          width: fillWidth,
          backgroundImage: `linear-gradient(90deg, ${NEON} 0%, ${NEON} 55%, ${PURPLE} 100%)`,
          opacity: 0.85,
          mixBlendMode: 'screen',
          filter: 'blur(0.4px)',
          willChange: 'width',
        }}
      />
      {/* L1 補助: 縁の発光 */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          opacity: ringOpacity,
          boxShadow: `inset 0 0 24px rgba(0,255,204,0.55), 0 0 18px rgba(0,255,204,0.35)`,
          willChange: 'opacity',
        }}
      />
      {/* L1 補助: スキャンライン (進捗の流体感) */}
      <motion.div
        aria-hidden
        className="absolute top-0 left-0 h-full"
        style={{
          width: fillWidth,
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.0) 0px, rgba(255,255,255,0.0) 10px, rgba(255,255,255,0.06) 11px, rgba(255,255,255,0.0) 12px)',
          mixBlendMode: 'overlay',
          willChange: 'width',
        }}
      />

      {/* ═════════════════════════════════════════════════════════
         L2: Ghost Text — 「スライドして封印 (Seal)」
         ═════════════════════════════════════════════════════════ */}
      <motion.div
        aria-hidden
        className="
          pointer-events-none absolute inset-0
          flex items-center justify-center
        "
        style={{
          opacity: sealed ? 0 : ghostOpacity,
          filter: ghostBlur,
          willChange: 'opacity, filter',
        }}
      >
        <span
          className="
            inline-flex items-center gap-2.5
            text-[13px] font-bold uppercase
            text-white/70
          "
          style={{
            letterSpacing: '0.32em',
            textShadow: '0 0 8px rgba(0,255,204,0.25)',
          }}
        >
          <ChevronsRight size={14} className="opacity-60" />
          スライドして封印 (Seal)
          <ChevronsRight size={14} className="opacity-60" />
        </span>
      </motion.div>

      {/* ═════════════════════════════════════════════════════════
         L3: The Knob — 重厚な金属のカンヌキ
         ═════════════════════════════════════════════════════════ */}
      <motion.div
        drag={isLocked ? false : 'x'}
        dragConstraints={{ left: 0, right: maxX }}
        dragElastic={0.02}         /* 重い金属の抵抗感 */
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        whileTap={isLocked ? undefined : { cursor: 'grabbing' as const }}
        style={{
          x,
          width: KNOB_WIDTH,
          height: TRACK_HEIGHT - PADDING * 2,
          top: PADDING,
          left: PADDING,
          backgroundColor: KNOB_BASE,
          backgroundImage: `
            linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.25) 100%),
            linear-gradient(135deg, ${KNOB_BASE} 0%, #0E0A26 100%)
          `,
          boxShadow: knobShadow,
          willChange: 'transform, box-shadow',
          touchAction: 'pan-y',     /* 縦スクロールは親に委譲 */
        }}
        className="
          absolute
          rounded-xl
          flex items-center justify-center
          border border-white/10
        "
      >
        {/* 中央の Lock アイコン */}
        <motion.div
          aria-hidden
          className="relative flex items-center justify-center"
          animate={
            sealed
              ? { scale: [1, 1.18, 1] }
              : dragging
                ? { scale: 1.04 }
                : { scale: 1 }
          }
          transition={
            sealed
              ? { duration: 0.55, ease: [0.22, 1, 0.36, 1] }
              : { type: 'spring', stiffness: 380, damping: 24 }
          }
          style={{ willChange: 'transform' }}
        >
          {/* アイコン背景の発光リング */}
          <motion.span
            aria-hidden
            className="absolute inset-[-10px] rounded-full"
            animate={
              sealed
                ? {
                    boxShadow: [
                      `0 0 0px 0px rgba(0,255,204,0)`,
                      `0 0 30px 10px rgba(0,255,204,0.75)`,
                      `0 0 14px 4px rgba(0,255,204,0.55)`,
                    ],
                  }
                : {
                    boxShadow: dragging
                      ? `0 0 16px 4px rgba(0,255,204,0.45)`
                      : `0 0 0px 0px rgba(0,255,204,0.0)`,
                  }
            }
            transition={{
              duration: sealed ? 0.7 : 0.35,
              ease: 'easeOut',
            }}
          />
          {sealed ? (
            <ShieldCheck size={22} color={NEON} strokeWidth={2.5} />
          ) : (
            <Lock
              size={20}
              color="rgba(255,255,255,0.92)"
              strokeWidth={2.25}
            />
          )}
        </motion.div>

        {/* ノブ右側の Chevron (>>) ヒント */}
        <motion.span
          aria-hidden
          className="absolute right-2 flex items-center"
          style={{ opacity: chevronOpacity, willChange: 'opacity' }}
        >
          <ChevronsRight size={14} color={NEON} />
        </motion.span>

        {/* ノブ表面のミクロな光沢ライン */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-2 top-1 h-px rounded-full"
          style={{
            backgroundImage:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
          }}
        />
      </motion.div>

      {/* ═════════════════════════════════════════════════════════
         Phase 3 (4): Neon Explosion + "🔒 SEALED" 啓示
         ═════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {sealed && (
          <>
            {/* 全景パルス: 大爆発 → 脈打ち */}
            <motion.div
              key="neon-explosion"
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl"
              initial={{
                boxShadow: `0 0 0px 0px ${NEON}, inset 0 0 0px 0px ${NEON}`,
                opacity: 1,
              }}
              animate={{
                boxShadow: [
                  `0 0 0px 0px rgba(0,255,204,0)`,
                  `0 0 80px 18px rgba(0,255,204,0.85)`,
                  `0 0 28px 6px rgba(0,255,204,0.55)`,
                  `0 0 40px 8px rgba(0,255,204,0.65)`,
                  `0 0 26px 5px rgba(0,255,204,0.55)`,
                ],
              }}
              transition={{
                duration: 1.8,
                times: [0, 0.18, 0.45, 0.72, 1],
                ease: 'easeOut',
                repeat: Infinity,
                repeatType: 'reverse',
              }}
              exit={{ opacity: 0 }}
              style={{ willChange: 'box-shadow' }}
            />

            {/* 中央リング波紋 */}
            <motion.div
              key="ring-wave"
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-1/2 rounded-full"
              initial={{
                width: 20,
                height: 20,
                x: '-50%',
                y: '-50%',
                opacity: 0.9,
                border: `2px solid rgba(0,255,204,0.9)`,
              }}
              animate={{
                width: 360,
                height: 360,
                opacity: 0,
              }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              style={{ willChange: 'width, height, opacity' }}
            />

            {/* 🔒 SEALED テキストの啓示 */}
            <motion.div
              key="sealed-text"
              className="
                pointer-events-none absolute inset-0
                flex items-center justify-center
              "
              initial={{ opacity: 0, scale: 0.88, filter: 'blur(6px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.55,
                delay: 0.12,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{ willChange: 'transform, opacity, filter' }}
            >
              <span
                className="
                  inline-flex items-center gap-2.5
                  text-[15px] font-black uppercase
                "
                style={{
                  color: NEON,
                  letterSpacing: '0.42em',
                  textShadow: `
                    0 0 8px rgba(0,255,204,0.85),
                    0 0 22px rgba(0,255,204,0.55),
                    0 0 40px rgba(0,255,204,0.35)
                  `,
                }}
              >
                <span aria-hidden>🔒</span>
                SEALED
              </span>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
