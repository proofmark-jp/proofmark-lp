/**
 * GlobalDropzoneOverlay.tsx
 * ──────────────────────────────────────────────────────────────
 * ProofMark — Global Drag & Drop Overlay
 *
 * Design Philosophy:
 *   "Restraint as the highest form of luxury."
 *
 *   We do not impress users with effects.
 *   We make them feel that their action has been *received*
 *   by something quietly intelligent — a vault that is awake.
 *
 * Layers (back → front):
 *   L0  Scrim         : near-black wash, the "silence"
 *   L1  Fluid Mesh    : Teal × Purple, breathing at 0.04 opacity
 *   L2  Film Grain    : SVG turbulence, 3% opacity, eternal
 *   L3  Spatial Light : cursor-tracked spotlight (Spring physics)
 *   L4  Vignette      : edge fade, focuses the eye to center
 *   L5  Message       : the only thing that speaks
 *
 * Physics:
 *   - Idle entrance     : critically damped spring (smooth arrival)
 *   - Kinetic rejection : heavy mass + low damping (iron-door bounce)
 *   - Merkle Collapse   : exit converges toward drop coordinates
 *
 * Accessibility:
 *   useReducedMotion → all kinetic motion neutralized,
 *                      only opacity transitions remain.
 * ──────────────────────────────────────────────────────────────
 */

import React, { useCallback, useEffect, useId, useRef } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface GlobalDropzoneOverlayProps {
  /** Whether a drag operation is in progress over the window. */
  isDragging: boolean;
  /** If non-null, overlay enters the "kinetic rejection" state. */
  dragError?: string | null;
  /** Called with the dropped FileList. Coordinates are captured internally. */
  onDrop: (files: FileList, dropPoint: { x: number; y: number }) => void;
  /** Optional: override the default idle headline. */
  title?: string;
  /** Optional: override the default idle subtitle. */
  subtitle?: string;
  /** Optional: override the default accepted-types hint. */
  hint?: string;
}

// ──────────────────────────────────────────────────────────────
// Design tokens — single source of truth
// ──────────────────────────────────────────────────────────────

const PALETTE = {
  teal: "#00D4AA",
  purple: "#6C3EF4",
  amber: "#F59E0B",
  ink: "#07061A",
  fog: "rgba(255,255,255,0.06)",
} as const;

const SPRING = {
  /** Cursor spotlight — high stiffness for an "alive" follow. */
  spotlight: { stiffness: 420, damping: 38, mass: 0.6 },
  /** Standard entrance — calm and confident. */
  arrival: { stiffness: 220, damping: 28, mass: 1 },
  /** Kinetic rejection — heavy iron-door rebound. */
  rejection: { stiffness: 380, damping: 12, mass: 2.6 },
} as const;

// ──────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────

export const GlobalDropzoneOverlay: React.FC<GlobalDropzoneOverlayProps> = ({
  isDragging,
  dragError = null,
  onDrop,
  title = "ここにファイルをドロップ",
  subtitle = "ブラウザ内でSHA-256ハッシュを計算し、RFC-3161タイムスタンプを発行します",
  hint = "PNG · JPG · PDF · MP4 · 任意のバイナリ — 最大 50 MB",
}) => {
  const prefersReducedMotion = useReducedMotion();
  const grainId = useId();

  // ── Cursor-tracked spatial light ──────────────────────────
  const rawX = useMotionValue(-9999);
  const rawY = useMotionValue(-9999);
  const x = useSpring(rawX, SPRING.spotlight);
  const y = useSpring(rawY, SPRING.spotlight);

  // Spotlight is rendered via a CSS radial-gradient anchored to (x, y).
  const spotlightBg = useTransform(
    [x, y] as const,
    ([lx, ly]) =>
      `radial-gradient(420px circle at ${lx}px ${ly}px, rgba(255,255,255,0.10), rgba(255,255,255,0.04) 35%, transparent 65%)`
  );

  // ── Drop coordinates (for The Merkle Collapse exit) ───────
  const dropPointRef = useRef<{ x: number; y: number }>({
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
    y: typeof window !== "undefined" ? window.innerHeight / 2 : 0,
  });

  // ── Window-level drag tracking ────────────────────────────
  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: DragEvent) => {
      rawX.set(e.clientX);
      rawY.set(e.clientY);
      dropPointRef.current = { x: e.clientX, y: e.clientY };
    };
    const handleOver = (e: DragEvent) => {
      e.preventDefault(); // required to enable drop
    };

    window.addEventListener("dragover", handleOver);
    window.addEventListener("dragover", handleMove);
    return () => {
      window.removeEventListener("dragover", handleOver);
      window.removeEventListener("dragover", handleMove);
    };
  }, [isDragging, rawX, rawY]);

  // ── Drop handler ──────────────────────────────────────────
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const point = { x: e.clientX, y: e.clientY };
      dropPointRef.current = point;
      if (e.dataTransfer?.files?.length) {
        onDrop(e.dataTransfer.files, point);
      }
    },
    [onDrop]
  );

  // ── Derived state ─────────────────────────────────────────
  const inError = Boolean(dragError);

  // ── Animation variants ────────────────────────────────────
  // The exit transform origin is set inline so the Merkle Collapse
  // converges precisely on the cursor's last known position.
  const overlayExit = prefersReducedMotion
    ? { opacity: 0, transition: { duration: 0.18 } }
    : {
        opacity: 0,
        scale: 0.0,
        filter: "blur(14px)",
        transition: { duration: 0.55, ease: [0.7, 0, 0.84, 0] as const },
      };

  const messageVariants = {
    initial: { opacity: 0, y: 12, scale: 0.98 },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: prefersReducedMotion
        ? { duration: 0.18 }
        : { type: "spring" as const, ...SPRING.arrival },
    },
    error: {
      opacity: 1,
      x: prefersReducedMotion ? 0 : [0, -14, 11, -7, 4, 0],
      y: 0,
      scale: 1,
      transition: prefersReducedMotion
        ? { duration: 0.18 }
        : { type: "spring" as const, ...SPRING.rejection },
    },
  };

  return (
    <AnimatePresence>
      {isDragging && (
        <motion.div
          key="proofmark-dropzone"
          // ── Accessibility ─────────────────────────────────
          role="region"
          aria-label={inError ? "ファイル受入エラー" : "ファイルドロップ領域"}
          aria-live="polite"
          // ── Drag wiring ───────────────────────────────────
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          // ── Motion ────────────────────────────────────────
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={overlayExit}
          transition={{ duration: prefersReducedMotion ? 0.18 : 0.32, ease: [0.16, 1, 0.3, 1] }}
          style={{
            transformOrigin: `${dropPointRef.current.x}px ${dropPointRef.current.y}px`,
          }}
          className="fixed inset-0 z-[9999] pointer-events-auto select-none"
        >
          {/* ─────────────────────────────────────────────────
             L0 — Scrim (the silence)
             ───────────────────────────────────────────────── */}
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: PALETTE.ink,
              opacity: 0.78,
              backdropFilter: "blur(18px) saturate(140%)",
              WebkitBackdropFilter: "blur(18px) saturate(140%)",
            }}
          />

          {/* ─────────────────────────────────────────────────
             L1 — Fluid Mesh Gradient (Teal × Purple)
             Two slow-breathing orbs. Opacity stays near 0.04
             so the color is felt, not seen.
             ───────────────────────────────────────────────── */}
          {!prefersReducedMotion && (
            <>
              <motion.div
                aria-hidden
                className="absolute -inset-[20%] pointer-events-none"
                style={{
                  background: `radial-gradient(40% 40% at 30% 35%, ${PALETTE.teal} 0%, transparent 60%)`,
                  filter: "blur(80px)",
                  mixBlendMode: "screen",
                }}
                animate={
                  inError
                    ? { opacity: 0 }
                    : {
                        opacity: [0.04, 0.07, 0.04],
                        x: ["-2%", "3%", "-2%"],
                        y: ["1%", "-2%", "1%"],
                      }
                }
                transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                aria-hidden
                className="absolute -inset-[20%] pointer-events-none"
                style={{
                  background: `radial-gradient(45% 45% at 70% 65%, ${PALETTE.purple} 0%, transparent 60%)`,
                  filter: "blur(90px)",
                  mixBlendMode: "screen",
                }}
                animate={
                  inError
                    ? { opacity: 0 }
                    : {
                        opacity: [0.05, 0.08, 0.05],
                        x: ["2%", "-3%", "2%"],
                        y: ["-1%", "2%", "-1%"],
                      }
                }
                transition={{ duration: 17, repeat: Infinity, ease: "easeInOut" }}
              />
              {/* Error wash — single amber sheet, calm but unmistakable */}
              <motion.div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(60% 60% at 50% 50%, ${PALETTE.amber} 0%, transparent 70%)`,
                  mixBlendMode: "screen",
                }}
                animate={{ opacity: inError ? 0.12 : 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              />
            </>
          )}

          {/* ─────────────────────────────────────────────────
             L2 — Film Grain (SVG turbulence, 3% opacity)
             A whisper, not a texture.
             ───────────────────────────────────────────────── */}
          <svg
            aria-hidden
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ opacity: 0.035, mixBlendMode: "overlay" }}
          >
            <filter id={grainId}>
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.9"
                numOctaves="2"
                stitchTiles="stitch"
              />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter={`url(#${grainId})`} />
          </svg>

          {/* ─────────────────────────────────────────────────
             L3 — Spatial Spotlight (cursor-tracked)
             Renders ONLY in the absence of reduced-motion.
             ───────────────────────────────────────────────── */}
          {!prefersReducedMotion && (
            <motion.div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background: spotlightBg,
                mixBlendMode: "soft-light",
              }}
            />
          )}

          {/* ─────────────────────────────────────────────────
             L4 — Vignette (edge fade)
             ───────────────────────────────────────────────── */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(120% 80% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)",
            }}
          />

          {/* ─────────────────────────────────────────────────
             L5 — Message
             The only element that speaks.
             ───────────────────────────────────────────────── */}
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <motion.div
              variants={messageVariants}
              initial="initial"
              animate={inError ? "error" : "animate"}
              className="relative w-full max-w-[520px]"
            >
              {/* Frame — restrained, single hairline, monumental corners */}
              <div
                className="relative rounded-[28px] px-10 py-12 text-center overflow-hidden"
                style={{
                  background: "rgba(10, 9, 30, 0.55)",
                  border: `1px solid ${inError ? "rgba(245,158,11,0.45)" : PALETTE.fog}`,
                  boxShadow: inError
                    ? "0 30px 90px -30px rgba(245,158,11,0.35), inset 0 1px 0 rgba(255,255,255,0.04)"
                    : "0 30px 90px -30px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)",
                  backdropFilter: "blur(22px) saturate(160%)",
                  WebkitBackdropFilter: "blur(22px) saturate(160%)",
                }}
              >
                {/* Icon — pure SVG, no library dependency */}
                <motion.div
                  aria-hidden
                  className="mx-auto mb-7 flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{
                    background: inError
                      ? "rgba(245,158,11,0.10)"
                      : "rgba(0,212,170,0.08)",
                    border: `1px solid ${
                      inError ? "rgba(245,158,11,0.35)" : "rgba(0,212,170,0.22)"
                    }`,
                  }}
                  animate={
                    prefersReducedMotion || inError
                      ? {}
                      : { y: [0, -3, 0] }
                  }
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                >
                  {inError ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 8v5M12 16.5v.5"
                        stroke={PALETTE.amber}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M10.6 3.6 2.3 18a1.6 1.6 0 0 0 1.4 2.4h16.6a1.6 1.6 0 0 0 1.4-2.4L13.4 3.6a1.6 1.6 0 0 0-2.8 0Z"
                        stroke={PALETTE.amber}
                        strokeWidth="1.6"
                      />
                    </svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 4v12M12 16l-4-4M12 16l4-4"
                        stroke={PALETTE.teal}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1"
                        stroke={PALETTE.teal}
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </motion.div>

                {/* Headline */}
                <h2
                  className="text-[22px] leading-tight font-semibold tracking-[-0.01em]"
                  style={{
                    color: inError ? PALETTE.amber : "rgba(255,255,255,0.96)",
                  }}
                >
                  {inError ? "受け入れできません" : title}
                </h2>

                {/* Subtitle / error message */}
                <p
                  className="mx-auto mt-3 max-w-[380px] text-[13.5px] leading-relaxed"
                  style={{
                    color: inError
                      ? "rgba(245,158,11,0.85)"
                      : "rgba(255,255,255,0.62)",
                  }}
                >
                  {inError ? dragError : subtitle}
                </p>

                {/* Hint row */}
                {!inError && (
                  <div
                    className="mx-auto mt-7 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] tracking-[0.06em] uppercase"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${PALETTE.fog}`,
                      color: "rgba(255,255,255,0.5)",
                      fontFeatureSettings: '"tnum"',
                    }}
                  >
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: PALETTE.teal }}
                    />
                    {hint}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalDropzoneOverlay;
