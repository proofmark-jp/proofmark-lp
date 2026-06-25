// client/src/components/proof/KineticEvolutionScrub.tsx
/**
 * KineticEvolutionScrub — The Zero-Render 60fps Scrub Engine
 * ─────────────────────────────────────────────────────────────────────────
 * 制作の歴史 (最大150枚) を「撫でる」だけでパラパラ漫画のように滑走させる、
 * Reactの再レンダリングを完全に封殺したサイバーパンクUI。
 *
 * 設計の核 (The Zero-Render Hack):
 *  - 進捗は useMotionValue(0..1) のみで保持し、useState は一切更新しない
 *  - useMotionValueEvent("change") で <img>.src / <span>.innerText を
 *    直接 DOM ミューテーション → Reactの reconciliation を 0 回で 60fps を死守
 *  - onScrubEnd は onPointerUp の瞬間にのみ発火 (親 Dashboard との同期点)
 *  - Indicator Dot は GPU Composite (transform: scale / box-shadow) のみで
 *    Active 表現するため、ドット数が 150 でも RAF 一発で完了
 */

import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
  animate,
} from 'framer-motion';

/* ════════════════════════════════════════════════════════════════
   Types
   ════════════════════════════════════════════════════════════════ */

type WorkspaceStep = {
  id: string;
  title: string;
  file?: File;
  thumbUrl?: string;
  previewUrl?: string;
};

export interface KineticEvolutionScrubProps {
  steps: WorkspaceStep[];
  /** スクラブ終了時 (onPointerUp / onPointerCancel) にのみ発火 */
  onScrubEnd: (finalIndex: number) => void;
}

/* ════════════════════════════════════════════════════════════════
   Constants
   ════════════════════════════════════════════════════════════════ */

/** ドット列で同時に視認できる最大本数 (これ以上は density を下げて間引く) */
const MAX_DOT_DENSITY = 150;
/** Active 周辺に薄っすら光らせる近傍ドットの片側数 */
const HALO_RADIUS = 2;

/* ════════════════════════════════════════════════════════════════
   Helpers
   ════════════════════════════════════════════════════════════════ */

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function progressToIndex(p: number, len: number): number {
  if (len <= 1) return 0;
  // floor だと最右端で len に届かないため round 寄りの丸め
  const idx = Math.round(clamp01(p) * (len - 1));
  return idx < 0 ? 0 : idx >= len ? len - 1 : idx;
}

/** lastModified の差分を「+2時間40分」のような人間語に整形 */
function formatDelta(deltaMs: number): string {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return '起点 (T+0)';
  const sec = Math.floor(deltaMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (day >= 1) {
    const restHr = hr % 24;
    return `+${day}日${restHr ? `${restHr}時間` : ''}`;
  }
  if (hr >= 1) {
    const restMin = min % 60;
    return `+${hr}時間${restMin ? `${restMin}分` : ''}`;
  }
  if (min >= 1) {
    const restSec = sec % 60;
    return `+${min}分${restSec ? `${restSec}秒` : ''}`;
  }
  return `+${sec}秒`;
}

/* ════════════════════════════════════════════════════════════════
   Indicator Dot — pure GPU layer (no Re-render)
   ─────────────────────────────────────────────────────────────────
   各ドットは scale / box-shadow を useTransform で activeProgress から
   直接生成する。React の state 経由を一切通さない。
   ════════════════════════════════════════════════════════════════ */

interface DotProps {
  /** このドットの正規化位置 0..1 */
  t: number;
  /** 現在進捗 0..1 のMotionValue */
  progress: ReturnType<typeof useMotionValue<number>>;
  /** 視覚密度のための間引き比率 (1=全部表示 / 0.5=1個飛ばし) */
  visible: boolean;
}

const IndicatorDot = memo(function IndicatorDot({ t, progress, visible }: DotProps) {
  // 近傍距離 (0=自分が真上 / 1=最遠) を派生
  const dist = useTransform(progress, (p) => Math.abs(p - t));
  // スケール: 自分が active のときに 1 → 2.2 へ膨張
  const scale = useTransform(dist, [0, 0.02, 0.06], [2.2, 1.4, 1]);
  // 発光強度: 近傍だけネオンシアン
  const glow = useTransform(dist, [0, 0.02, 0.08], [1, 0.55, 0]);
  // box-shadow を文字列で組み立てて Composite Layer に流す
  const shadow = useTransform(glow, (g) =>
    g <= 0
      ? '0 0 0 rgba(0,0,0,0)'
      : `0 0 ${6 + g * 14}px rgba(0,255,204,${0.45 * g}), 0 0 ${14 + g * 28}px rgba(108,62,244,${0.35 * g})`,
  );
  // 色: active 近傍はシアン、それ以外はミュート
  const bg = useTransform(glow, (g) => {
    if (g >= 0.9) return '#00FFCC';
    if (g >= 0.4) return '#7AFFE0';
    return 'rgba(168,160,216,0.45)';
  });

  if (!visible) {
    // 間引きドットは超微細なラインのみ (情報密度の犠牲なし)
    return (
      <span
        aria-hidden
        className="inline-block shrink-0"
        style={{
          width: 1,
          height: 6,
          background: 'rgba(168,160,216,0.10)',
        }}
      />
    );
  }

  return (
    <motion.span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{
        width: 4,
        height: 4,
        background: bg,
        boxShadow: shadow,
        scale,
        willChange: 'transform, box-shadow, background-color',
        transformOrigin: 'center',
      }}
    />
  );
});

/* ════════════════════════════════════════════════════════════════
   Main Component
   ════════════════════════════════════════════════════════════════ */

function KineticEvolutionScrubBase({ steps, onScrubEnd }: KineticEvolutionScrubProps) {
  const total = steps.length;
  const hasContent = total > 0;

  /* ─── Single source of truth: motionValue only ─── */
  const progress = useMotionValue(0);

  /* ─── DOM refs (Direct Mutation targets) ─── */
  const imgRef = useRef<HTMLImageElement | null>(null);
  const titleRef = useRef<HTMLSpanElement | null>(null);
  const deltaRef = useRef<HTMLSpanElement | null>(null);
  const indexRef = useRef<HTMLSpanElement | null>(null);
  const sensorRef = useRef<HTMLDivElement | null>(null);

  /* ─── ポインタ状態 (Re-render を起こさない) ─── */
  const isDraggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const sensorRectRef = useRef<DOMRect | null>(null);

  /* ─── 起点 timestamp (最古の lastModified を T0) ─── */
  const t0 = useMemo(() => {
    if (!hasContent) return null;
    let min = Number.POSITIVE_INFINITY;
    for (const s of steps) {
      const lm = s.file?.lastModified;
      if (typeof lm === 'number' && lm < min) min = lm;
    }
    return Number.isFinite(min) ? min : null;
  }, [steps, hasContent]);

  /* ─── 表示密度 (150枚を 1px ピッチで配置するための間引き) ─── */
  const density = useMemo(() => {
    if (total <= MAX_DOT_DENSITY) return 1;
    // 全ステップ位置は必要なので「視覚的に強調するドット」だけ間引く
    return Math.ceil(total / MAX_DOT_DENSITY);
  }, [total]);

  /* ─── 各ステップの正規化位置 (0..1) を事前計算 ─── */
  const ts = useMemo(() => {
    if (total <= 1) return [0];
    return Array.from({ length: total }, (_, i) => i / (total - 1));
  }, [total]);

  /* ════════════════════════════════════════════════════════════
     The Direct DOM Mutation (Zero-Render Core)
     ──────────────────────────────────────────────────────────────
     progress が変わるたびに DOM を直接書き換える。
     React の setState は一切呼ばない。
     ════════════════════════════════════════════════════════════ */
  useMotionValueEvent(progress, 'change', (p) => {
    if (!hasContent) return;
    const idx = progressToIndex(p, total);
    const step = steps[idx];
    if (!step) return;

    // 1) <img>.src を直接差し替え (差分があるときだけ書き込んで GC を抑制)
    const src = step.thumbUrl ?? step.previewUrl ?? '';
    if (imgRef.current && imgRef.current.src !== src) {
      if (src) {
        imgRef.current.style.opacity = '1';
        imgRef.current.src = src;
      } else {
        // 🚨 パッチ: 画像がない（生成中）の時は透明にしてリンク切れアイコンを隠す
        imgRef.current.style.opacity = '0';
      }
    }

    // 2) Title text
    if (titleRef.current) {
      titleRef.current.innerText = step.title || `工程 ${idx + 1}`;
    }

    // 3) Delta (経過時間 or lastModified 生表示)
    if (deltaRef.current) {
      const lm = step.file?.lastModified;
      if (typeof lm === 'number' && t0 !== null) {
        deltaRef.current.innerText = formatDelta(lm - t0);
      } else if (typeof lm === 'number') {
        deltaRef.current.innerText = new Date(lm).toLocaleString();
      } else {
        deltaRef.current.innerText = '—';
      }
    }

    // 4) Index counter
    if (indexRef.current) {
      indexRef.current.innerText = `${idx + 1} / ${total}`;
    }
  });

  /* ─── 初期化: 最後の (HEAD) を表示 ─── */
  useEffect(() => {
    if (!hasContent) return;
    // HEAD を初期位置に
    progress.set(1);
    // 強制的に DOM 反映
    const idx = total - 1;
    const step = steps[idx];
    if (step && imgRef.current) {
      const src = step.thumbUrl ?? step.previewUrl ?? '';
      if (src) imgRef.current.src = src;
    }
    if (step && titleRef.current) titleRef.current.innerText = step.title || `工程 ${idx + 1}`;
    if (indexRef.current) indexRef.current.innerText = `${idx + 1} / ${total}`;
    if (deltaRef.current) {
      const lm = step?.file?.lastModified;
      if (typeof lm === 'number' && t0 !== null) {
        deltaRef.current.innerText = formatDelta(lm - t0);
      } else if (typeof lm === 'number') {
        deltaRef.current.innerText = new Date(lm).toLocaleString();
      } else {
        deltaRef.current.innerText = '—';
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, hasContent, t0]);

  /* ════════════════════════════════════════════════════════════
     Pointer handling
     ════════════════════════════════════════════════════════════ */

  const updateFromClientX = useCallback((clientX: number) => {
    const rect = sensorRectRef.current;
    if (!rect || rect.width <= 0) return;
    const ratio = clamp01((clientX - rect.left) / rect.width);
    progress.set(ratio);
  }, [progress]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!hasContent) return;
    const el = e.currentTarget;
    sensorRectRef.current = el.getBoundingClientRect();
    pointerIdRef.current = e.pointerId;
    isDraggingRef.current = true;
    try { el.setPointerCapture(e.pointerId); } catch { /* noop */ }
    updateFromClientX(e.clientX);
  }, [hasContent, updateFromClientX]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    if (pointerIdRef.current !== null && e.pointerId !== pointerIdRef.current) return;
    updateFromClientX(e.clientX);
  }, [updateFromClientX]);

  const endScrub = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    pointerIdRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    const finalIdx = progressToIndex(progress.get(), total);
    // 同期点: 親 Dashboard との state 同期はここだけ
    onScrubEnd(finalIdx);
  }, [progress, total, onScrubEnd]);

  /* ─── キーボード操作 (Accessibility) ─── */
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!hasContent || total <= 1) return;
    const step = 1 / (total - 1);
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = clamp01(progress.get() + step);
    else if (e.key === 'ArrowLeft') next = clamp01(progress.get() - step);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 1;
    if (next !== null) {
      e.preventDefault();
      animate(progress, next, { type: 'spring', stiffness: 300, damping: 30 });
      // キー操作も「確定」とみなす
      onScrubEnd(progressToIndex(next, total));
    }
  }, [progress, total, hasContent, onScrubEnd]);

  /* ════════════════════════════════════════════════════════════
     Reactive style values (header progress bar / sensor overlay)
     ────────────────────────────────────────────────────────────── */
  const sweepX = useTransform(progress, (p) => `${p * 100}%`);

  /* ════════════════════════════════════════════════════════════
     Empty state
     ════════════════════════════════════════════════════════════ */
  if (!hasContent) {
    return (
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4">
        <div className="text-[10px] uppercase tracking-[0.22em] text-[#A8A0D8]/50 font-bold">
          Kinetic Evolution — no chain
        </div>
        <div className="mt-3 aspect-[16/9] rounded-xl bg-[#0D0B24] border border-white/5 flex items-center justify-center text-[#A8A0D8]/30 text-xs tracking-widest uppercase">
          empty timeline
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
     Render
     ════════════════════════════════════════════════════════════ */
  return (
    <div
      className="mt-6 relative rounded-2xl border border-white/10 bg-[#0A0814]/80 backdrop-blur-xl p-4 overflow-hidden select-none"
      style={{
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 40px rgba(0,0,0,0.45)',
      }}
    >
      {/* Ambient cyber-grid */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,255,204,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(108,62,244,0.4) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Header */}
      <div className="relative flex items-center justify-between mb-3">
        <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-[#A8A0D8]/70">
          Kinetic Evolution Scrub
        </div>
        <span
          ref={indexRef}
          className="text-[10px] font-mono tabular-nums tracking-[0.16em] text-[#A8A0D8]/70"
        >
          {total} / {total}
        </span>
      </div>

      {/* ═══════════════════════════════════════════════════════
          Preview + Sensor (Direct DOM Mutation surface)
          ═══════════════════════════════════════════════════════ */}
      <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-[#0D0B24] border border-white/5">
        <img
          ref={imgRef}
          alt="Evolution Preview"
          // 🚨 パッチ: decoding="sync" を強制し、画像が描画されるまで前の画像を残してチラつきを防ぐ
          decoding="sync"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          draggable={false}
          // 🚨 パッチ: 空のsrcの時にブラウザの「リンク切れアイコン」を出さないCSSハック
          style={{ textIndent: '-9999px' }} 
        />

        {/* Scanline overlay (Cyberpunk material) */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30"
          style={{
            background:
              'repeating-linear-gradient(0deg, rgba(0,255,204,0.05) 0px, rgba(0,255,204,0.05) 1px, transparent 1px, transparent 3px)',
          }}
        />

        {/* Vertical sweep line (現在位置を画像の上にも示す) */}
        <motion.div
          aria-hidden
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{
            left: sweepX,
            width: 2,
            transform: 'translateX(-1px)',
            background:
              'linear-gradient(180deg, rgba(0,255,204,0.0) 0%, rgba(0,255,204,0.9) 50%, rgba(108,62,244,0.0) 100%)',
            boxShadow: '0 0 12px rgba(0,255,204,0.7)',
            willChange: 'left',
          }}
        />

        {/* Bottom shade for text legibility */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-16 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(10,8,20,0) 0%, rgba(10,8,20,0.85) 100%)',
          }}
        />

        {/* Timeline data (Title + delta) — innerText で直接書き換え */}
        <div className="absolute left-3 right-3 bottom-2.5 flex items-end justify-between gap-3 pointer-events-none">
          <span
            ref={titleRef}
            className="min-w-0 flex-1 truncate text-[12.5px] font-bold tracking-tight"
            style={{
              background:
                'linear-gradient(90deg, #6C3EF4 0%, #00FFCC 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              color: 'transparent',
              filter: 'drop-shadow(0 1px 8px rgba(0,255,204,0.25))',
            }}
          />
          <span
            ref={deltaRef}
            className="shrink-0 text-[10px] font-mono tabular-nums tracking-[0.14em]"
            style={{
              background:
                'linear-gradient(90deg, #6C3EF4 0%, #00FFCC 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          />
        </div>

        {/* The Sensor — 透明なドラッグ検知エリア (画像全体を覆う) */}
        <div
          ref={sensorRef}
          role="slider"
          tabIndex={0}
          aria-label="工程プレビューをスクラブ"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={total /* 表示は innerText 側で更新するため fixed でOK */}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endScrub}
          onPointerCancel={endScrub}
          onKeyDown={onKeyDown}
          className="absolute inset-0 cursor-ew-resize focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFCC]/50"
          style={{ touchAction: 'touch-pan-y' }}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════
          Ghost Scrub Indicator (Dot rail)
          ═══════════════════════════════════════════════════════ */}
      <div className="relative mt-3">
        {/* base rail */}
        <div
          aria-hidden
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px"
          style={{
            background:
              'linear-gradient(90deg, rgba(108,62,244,0.0) 0%, rgba(108,62,244,0.45) 30%, rgba(0,255,204,0.55) 100%)',
          }}
        />
        {/* progress rail (active fill) */}
        <motion.div
          aria-hidden
          className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] rounded-full"
          style={{
            width: sweepX,
            background:
              'linear-gradient(90deg, #6C3EF4 0%, #00FFCC 100%)',
            boxShadow: '0 0 12px rgba(0,255,204,0.55)',
            willChange: 'width',
          }}
        />

        {/* dots */}
        <div className="relative flex items-center justify-between gap-px py-3">
          {ts.map((t, i) => {
            // 視覚的に強調するドット (density で間引き)
            const emphasized =
              density === 1 ||
              i === 0 ||
              i === total - 1 ||
              i % density === 0 ||
              Math.abs(i - Math.round(progress.get() * (total - 1))) <= HALO_RADIUS;
            return (
              <IndicatorDot
                key={steps[i]?.id ?? `dot-${i}`}
                t={t}
                progress={progress}
                visible={emphasized}
              />
            );
          })}
        </div>

        {/* axis labels */}
        <div className="mt-1 flex items-center justify-between text-[9px] font-mono tabular-nums tracking-[0.16em] uppercase">
          <span className="text-[#A8A0D8]/40">Genesis · T0</span>
          <span
            className="text-[#A8A0D8]/40"
            style={{
              background:
                'linear-gradient(90deg, #6C3EF4 0%, #00FFCC 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            ◀ Drag to traverse the chain ▶
          </span>
          <span className="text-[#00FFCC]/70">HEAD</span>
        </div>
      </div>
    </div>
  );
}

export const KineticEvolutionScrub = memo(KineticEvolutionScrubBase);
export default KineticEvolutionScrub;
