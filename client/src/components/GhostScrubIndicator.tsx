// client/src/components/GhostScrubIndicator.tsx
/**
 * GhostScrubIndicator — The Uncompromised World-Class Implementation
 * ─────────────────────────────────────────────────────────────────────────
 * Opusが設計した「3層構造の光彩（Ambient Halo / Pulse Glow / Core Orb）」と
 * 「Genesisノードの独立した質感」を1DOMたりとも間引くことなく完全維持し、
 * かつ Framer Motion (JSスレッド) を一切使わずに GPU Compositor で駆動させる
 * 極限のハイブリッド・アーキテクチャ。
 *
 * [技術的ブレイクスルー]
 * - React側からは `--dot-idx` のみをCSS変数として渡す（Zero-JS Animation）。
 * - 波の「通過」と「余韻（Repeat Delay）」を CSS Keyframes の % 尺で完全再現。
 * - サブピクセル・ジッターを封殺する `transform: translateZ(0)` を全層に適用。
 */

import { memo, useMemo } from 'react';

/* ════════════════════════════════════════════════════════════════
   Constants — The Philosophy in Numbers
   ════════════════════════════════════════════════════════════════ */

/** 表示する最大ドット数。これ以上はオーバーフローとして「+N」表記に集約。 */
const MAX_VISIBLE_DOTS = 12;

/**
 * タイムライン設計 (Opusの緻密な計算をCSSに翻訳)
 * アニメーション1周の合計時間: 2.0s
 * - 波の挙動 (Active): 1.4s (0% 〜 70%)
 * - 波の余韻 (Delay) : 0.6s (70% 〜 100%)
 * これにより CSS だけで `repeatDelay` を再現する。
 */
const TOTAL_DURATION_S = 2.0;

/* ════════════════════════════════════════════════════════════════
   Props
   ════════════════════════════════════════════════════════════════ */

export interface GhostScrubIndicatorProps {
  /** 工程数 (Merkle Chain の深さ) */
  chainDepth: number;
  /** 親のホバー状態に依存せず強制的に active にしたい場合 (任意) */
  forceActive?: boolean;
  /** カードコンテキストでの控えめ表示用 (任意) */
  className?: string;
  /** aria-label を上書きしたい場合 (任意) */
  label?: string;
}

/* ════════════════════════════════════════════════════════════════
   Noise Film (Micro-Texture)
   ════════════════════════════════════════════════════════════════ */

const NOISE_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='40'>
    <filter id='n'>
      <feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>
      <feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/>
    </filter>
    <rect width='100%' height='100%' filter='url(%23n)'/>
  </svg>`,
)}`;

/* ════════════════════════════════════════════════════════════════
   Sub Component: Single Dot (1ミリも妥協しない多層構造)
   ════════════════════════════════════════════════════════════════ */

interface DotProps {
  idx: number;
  isGenesis: boolean;
  isHead: boolean;
}

const Dot = memo(function Dot({ idx, isGenesis, isHead }: DotProps) {
  // CSS変数を通してGPUにインデックスを渡す
  const styleWithIdx = { '--dot-idx': idx } as React.CSSProperties;

  /* ─── HEAD: 3層構造のネオン凝縮ノード (Opus設計の完全復元) ─── */
  if (isHead) {
    return (
      <span
        className="pm-scrub-head-container relative inline-flex items-center justify-center z-10"
        style={{ width: 8, height: 8, ...styleWithIdx }}
        aria-hidden
      >
        {/* Layer 1: Ambient halo (常時発光のベース) */}
        <span
          className="absolute inset-[-3px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(0,212,170,0.35) 0%, rgba(108,62,244,0.18) 55%, transparent 75%)',
            filter: 'blur(2px)',
            transform: 'translateZ(0)',
          }}
        />
        
        {/* Layer 2: Pulse glow (波到達時に極限まで広がる光の脈動) */}
        <span
          className="pm-scrub-head-glow absolute inset-[-4px] rounded-full pointer-events-none opacity-0"
          style={{
            background: 'radial-gradient(circle, rgba(0,212,170,0.55) 0%, rgba(108,62,244,0.25) 60%, transparent 80%)',
            willChange: 'transform, opacity',
            transform: 'scale(0.9) translateZ(0)',
          }}
        />
        
        {/* Layer 3: The HEAD orb (コアとなる実体) */}
        <span
          className="pm-scrub-head-core relative block rounded-full"
          style={{
            width: 8,
            height: 8,
            background: 'linear-gradient(135deg, #6C3EF4 0%, #00D4AA 100%)',
            willChange: 'transform, filter',
            transform: 'scale(1) translateZ(0)',
            filter: 'drop-shadow(0 0 2px rgba(0,212,170,0.4))',
          }}
        />
      </span>
    );
  }

  /* ─── 通常 / Genesis ノード (物質感と波の透過) ─── */
  const restOpacity = isGenesis ? 0.55 : 0.28;
  const baseBg = isGenesis
    ? 'radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(168,160,216,0.55) 100%)'
    : 'rgba(168,160,216,0.55)';
  const baseShadow = isGenesis
    ? '0 0 4px rgba(255,255,255,0.25), 0 0 1px rgba(168,160,216,0.55)'
    : '0 0 0 rgba(0,0,0,0)';

  return (
    <span
      className="pm-scrub-dot-normal block rounded-full relative z-10"
      style={{
        width: 4,
        height: 4,
        background: baseBg,
        opacity: restOpacity,
        boxShadow: baseShadow,
        willChange: 'transform, opacity, box-shadow',
        transform: 'scale(1) translateZ(0)',
        ...styleWithIdx,
      }}
    />
  );
});

/* ════════════════════════════════════════════════════════════════
   Main Component
   ════════════════════════════════════════════════════════════════ */

function GhostScrubIndicatorBase({
  chainDepth,
  forceActive = false,
  className,
  label,
}: GhostScrubIndicatorProps) {
  // 安全クランプ: 負数や NaN を 0 に固定
  const depth = Math.max(0, Math.floor(chainDepth || 0));
  const visibleCount = Math.min(depth, MAX_VISIBLE_DOTS);
  const overflow = Math.max(0, depth - visibleCount);

  const dots = useMemo(() => {
    if (visibleCount === 0) return [];
    return Array.from({ length: visibleCount }, (_, i) => ({
      key: `node-${i}`,
      idx: i,
      isGenesis: i === 0 && visibleCount > 1,
      isHead: i === visibleCount - 1,
    }));
  }, [visibleCount]);

  if (visibleCount === 0) {
    return (
      <div
        className={['flex items-center gap-1.5 select-none', className].filter(Boolean).join(' ')}
        aria-label={label ?? '工程はまだ記録されていません'}
      >
        <span className="text-[10px] font-mono tabular-nums tracking-[0.18em] text-white/25 uppercase">
          no chain
        </span>
      </div>
    );
  }

  // 強制アクティブの場合はクラスを付与
  const activeClass = forceActive ? 'is-active' : '';

  return (
    <div
      className={['pm-scrub-wrapper relative inline-flex items-center gap-1.5 py-0.5 select-none group', activeClass, className].filter(Boolean).join(' ')}
      aria-label={
        label ??
        `Merkle chain depth: ${depth} ${depth === 1 ? 'node' : 'nodes'}${
          overflow > 0 ? ` (showing ${visibleCount})` : ''
        }`
      }
      role="img"
      style={{ contain: 'layout paint style' }}
    >
      {/* 💎 THE GPU ARCHITECTURE (Global CSS Pollution Free)
        Framer Motion の 2.0s ループ（1.4s稼働 + 0.6s待機）を Keyframes のパーセンテージで完全再現。
        0%~70% で波が完結し、70%~100% は沈黙（delay）となる。
      */}
      <style>{`
        /* 1. 通常ドットの波（opacity, scale, box-shadow） */
        @keyframes pm-wave-normal {
          0%   { opacity: var(--rest-opacity, 0.28); transform: scale(1) translateZ(0); box-shadow: var(--rest-shadow, 0 0 0 transparent); }
          35%  { opacity: 0.95; transform: scale(1.2) translateZ(0); box-shadow: 0 0 6px rgba(0,212,170,0.55), 0 0 10px rgba(108,62,244,0.25); }
          70%  { opacity: var(--rest-opacity, 0.28); transform: scale(1) translateZ(0); box-shadow: var(--rest-shadow, 0 0 0 transparent); }
          100% { opacity: var(--rest-opacity, 0.28); transform: scale(1) translateZ(0); box-shadow: var(--rest-shadow, 0 0 0 transparent); }
        }

        /* 2. HEADノード Layer 2: Pulse Glow（大きく広がるオーラ） */
        @keyframes pm-wave-head-glow {
          0%   { opacity: 0; transform: scale(0.9) translateZ(0); }
          35%  { opacity: 0.9; transform: scale(1.4) translateZ(0); }
          70%  { opacity: 0; transform: scale(0.9) translateZ(0); }
          100% { opacity: 0; transform: scale(0.9) translateZ(0); }
        }

        /* 3. HEADノード Layer 3: The Core（中心の強い輝き） */
        @keyframes pm-wave-head-core {
          0%   { transform: scale(1) translateZ(0); filter: drop-shadow(0 0 2px rgba(0,212,170,0.4)); }
          35%  { transform: scale(1.2) translateZ(0); filter: drop-shadow(0 0 8px rgba(0,212,170,0.9)) drop-shadow(0 0 14px rgba(108,62,244,0.6)); }
          70%  { transform: scale(1) translateZ(0); filter: drop-shadow(0 0 2px rgba(0,212,170,0.4)); }
          100% { transform: scale(1) translateZ(0); filter: drop-shadow(0 0 2px rgba(0,212,170,0.4)); }
        }

        /* ホバー発火ルール: CSS変数のインデックスから遅延を計算 */
        @media (prefers-reduced-motion: no-preference) {
          .group:hover .pm-scrub-dot-normal,
          .is-active .pm-scrub-dot-normal {
            /* Genesisノード(idx=0)はベーススタイルが違うため変数を上書き */
            --rest-opacity: 0.28;
            --rest-shadow: 0 0 0 transparent;
            animation: pm-wave-normal ${TOTAL_DURATION_S}s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            animation-delay: calc(var(--dot-idx) * 0.055s);
          }
          
          /* Genesisノードの特別扱い (CSS疑似クラスで判定) */
          .group:hover .pm-scrub-dot-normal:first-child,
          .is-active .pm-scrub-dot-normal:first-child {
             --rest-opacity: 0.55;
             --rest-shadow: 0 0 4px rgba(255,255,255,0.25), 0 0 1px rgba(168,160,216,0.55);
          }

          .group:hover .pm-scrub-head-glow,
          .is-active .pm-scrub-head-glow {
            animation: pm-wave-head-glow ${TOTAL_DURATION_S}s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            animation-delay: calc(var(--dot-idx) * 0.055s);
          }

          .group:hover .pm-scrub-head-core,
          .is-active .pm-scrub-head-core {
            animation: pm-wave-head-core ${TOTAL_DURATION_S}s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            animation-delay: calc(var(--dot-idx) * 0.055s);
          }
        }
      `}</style>

      {/* Rail — 過去 → 現在の極細レール */}
      <span
        className="absolute left-0 right-4 top-1/2 -translate-y-1/2 h-px pointer-events-none z-0"
        style={{
          background: 'linear-gradient(90deg, rgba(255,255,255,0.00) 0%, rgba(255,255,255,0.08) 50%, rgba(108,62,244,0.15) 80%, rgba(0,212,170,0.3) 100%)',
        }}
        aria-hidden
      />

      {/* Noise film — 極薄の物質感レイヤー */}
      <span
        className="absolute inset-0 pointer-events-none rounded-full z-0"
        style={{
          backgroundImage: `url("${NOISE_DATA_URI}")`,
          backgroundSize: '120px 40px',
          opacity: 0.05,
          mixBlendMode: 'overlay',
        }}
        aria-hidden
      />

      {/* Dot row */}
      <div className="relative flex items-center gap-[6px] z-10">
        {dots.map((d) => (
          <Dot
            key={d.key}
            idx={d.idx}
            isGenesis={d.isGenesis}
            isHead={d.isHead}
          />
        ))}
      </div>

      {/* Overflow counter — ホバー時に静かに発光 */}
      {overflow > 0 && (
        <span
          className="relative ml-1 text-[9px] font-mono tabular-nums tracking-widest z-10 transition-colors duration-500 text-white/35 group-hover:text-white/80"
          style={{ fontVariantNumeric: 'tabular-nums' }}
          aria-hidden
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

export const GhostScrubIndicator = memo(GhostScrubIndicatorBase);
export default GhostScrubIndicator;