/**
 * GlobalDropzoneOverlay.tsx
 * ──────────────────────────────────────────────────────────────
 * ProofMark — Global Drag & Drop Overlay  [Kinetic Tuning Edition]
 *
 * Design Philosophy (this iteration):
 *   "Sensual physics. Cybernetic acceptance."
 *
 *   The vault no longer whispers — it breathes neon.
 *   Every pixel must feel like it has mass, current, and intent.
 *
 * Layers (back → front):
 *   L0  Scrim         : variable-depth blur, "the silence deepens"
 *   L1  Fluid Mesh    : Teal/Cyan × Purple, awakened orbs
 *   L2  Scan Lines    : faint cyberpunk horizontals (CRT memory)
 *   L3  Film Grain    : SVG turbulence, 4% — kept honest
 *   L4  Spatial Light : cursor-tracked spotlight (Spring physics)
 *   L5  Vignette      : edge fade
 *   L6  Drop Capsule  : the neon vault door
 *
 * Physics:
 *   - Entrance         : heavy spring  { mass:2.6, damping:18, stiffness:100 }
 *                        → "vault door swinging open"
 *   - Pulse / breath   : 2.6s sine, scale 1↔1.015, neon shadow swells
 *   - Glitch rejection : two-pass shake (x/y/rotate) + RGB split flash
 *   - Merkle Collapse  : exit converges to drop coordinates
 *
 * Accessibility:
 *   useReducedMotion → kinetic motion neutralized; only opacity,
 *                      static neon, no shake/breath/spotlight motion.
 * ──────────────────────────────────────────────────────────────
 */

import React, { useId, useRef } from "react";
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
  isDragActive: boolean;
  dragError?: string | null;
  onDrop: (files: FileList | File[], dropPoint?: { x: number; y: number }) => void;
  title?: string;
  subtitle?: string;
  hint?: string;
}

// ──────────────────────────────────────────────────────────────
// Design tokens
// ──────────────────────────────────────────────────────────────

const PALETTE = {
  neon: "#00FFCC",        // primary cyber accent
  teal: "#00D4AA",        // secondary cool
  purple: "#6C3EF4",      // depth
  magenta: "#FF2E97",     // accent glitch
  amber: "#F59E0B",       // rejection
  red: "#FF3344",         // rejection edge
  ink: "#04030F",         // void
  fog: "rgba(255,255,255,0.06)",
} as const;

const SPRING = {
  /** Cursor spotlight — alive, snappy. */
  spotlight: { stiffness: 480, damping: 36, mass: 0.55 },
  /** The vault opens — heavy, audible-feeling. */
  vaultDoor: { type: "spring" as const, mass: 2.6, damping: 18, stiffness: 100 },
  /** Glitch rejection — fast, brittle. */
  rejection: { type: "spring" as const, mass: 2.6, damping: 12, stiffness: 380 },
} as const;

// Reusable neon shadow recipe — kept here so pulse animations stay coherent.
const neonShadow = (level: 0 | 1 | 2, color: string = PALETTE.neon) => {
  const a = level === 0 ? 0.18 : level === 1 ? 0.32 : 0.55;
  const b = level === 0 ? 0.06 : level === 1 ? 0.12 : 0.22;
  return [
    `0 0 0 1px ${color}${level === 2 ? "55" : "33"}`,
    `0 0 24px -2px ${hexA(color, a)}`,
    `0 0 60px -10px ${hexA(color, b)}`,
    `inset 0 1px 0 rgba(255,255,255,0.06)`,
  ].join(", ");
};

function hexA(hex: string, alpha: number) {
  // #RRGGBB → rgba(r,g,b,a)
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ──────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────

export const GlobalDropzoneOverlay: React.FC<GlobalDropzoneOverlayProps> = ({
  isDragActive,
  dragError = null,
  onDrop,
  title = "Drop to Seal your History",
  subtitle = "ブラウザ内でSHA-256を演算し、RFC-3161で時刻を封印します",
  hint = "PNG · JPG · PDF · MP4 · BIN — up to 50 MB",
}) => {
  const prefersReducedMotion = useReducedMotion();
  const grainId = useId();

  // ── Cursor-tracked spatial light ──────────────────────────
  const rawX = useMotionValue(-9999);
  const rawY = useMotionValue(-9999);
  const x = useSpring(rawX, SPRING.spotlight);
  const y = useSpring(rawY, SPRING.spotlight);

  const spotlightBg = useTransform(
    [x, y] as const,
    ([lx, ly]) =>
      `radial-gradient(520px circle at ${lx}px ${ly}px, ${hexA(
        PALETTE.neon,
        0.14
      )}, ${hexA(PALETTE.purple, 0.06)} 38%, transparent 68%)`
  );

  // Parallax tilt for the capsule (subtle — never seasick)
  const tiltX = useTransform(y, (v) => {
    if (typeof window === "undefined") return 0;
    return ((v - window.innerHeight / 2) / window.innerHeight) * -6;
  });
  const tiltY = useTransform(x, (v) => {
    if (typeof window === "undefined") return 0;
    return ((v - window.innerWidth / 2) / window.innerWidth) * 6;
  });

  // ── Drop point memory (for The Merkle Collapse) ───────────
  const dropPointRef = useRef({
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
    y: typeof window !== "undefined" ? window.innerHeight / 2 : 0,
  });

  const inError = Boolean(dragError);

  // ── Exit (Merkle Collapse) ────────────────────────────────
  const overlayExit = prefersReducedMotion
    ? { opacity: 0, transition: { duration: 0.18 } }
    : {
        opacity: 0,
        scale: 0.0,
        filter: "blur(18px)",
        transition: { duration: 0.6, ease: [0.7, 0, 0.84, 0] as const },
      };

  // ── Capsule variants ──────────────────────────────────────
  const capsuleVariants = {
    initial: { opacity: 0, y: 28, scale: 0.92, rotateX: -8 },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      rotateX: 0,
      transition: prefersReducedMotion ? { duration: 0.2 } : SPRING.vaultDoor,
    },
    error: {
      opacity: 1,
      y: 0,
      scale: 1,
      rotateX: 0,
      x: prefersReducedMotion ? 0 : [0, -22, 18, -12, 9, -5, 0],
      rotateZ: prefersReducedMotion ? 0 : [0, -1.4, 1.1, -0.7, 0.4, 0],
      transition: prefersReducedMotion ? { duration: 0.2 } : SPRING.rejection,
    },
  };

  return (
    <AnimatePresence>
      {isDragActive && (
        <motion.div
          key="proofmark-dropzone"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={overlayExit}
          style={{
            transformOrigin: `${dropPointRef.current.x}px ${dropPointRef.current.y}px`,
          }}
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden pointer-events-auto select-none"
          onDragOver={(e) => {
            e.preventDefault();
            rawX.set(e.clientX);
            rawY.set(e.clientY);
            dropPointRef.current = { x: e.clientX, y: e.clientY };
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer?.files?.length) {
              const point = { x: e.clientX, y: e.clientY };
              dropPointRef.current = point;
              onDrop(e.dataTransfer.files, point);
            }
          }}
        >
          {/* ───────── L0  Scrim — variable-depth blur ───────── */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundColor: PALETTE.ink,
              opacity: 0.85,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          />

          {/* ───────── L1  Fluid Mesh (neon + purple) ───────── */}
          {!prefersReducedMotion && (
            <>
              <motion.div
                className="absolute w-[80vw] h-[80vh] rounded-full pointer-events-none mix-blend-screen blur-[100px]"
                style={{ background: PALETTE.teal, left: "-10%", top: "-10%", opacity: 0.4 }}
                animate={{
                  x: ["0%", "15%", "0%"],
                  y: ["0%", "20%", "0%"],
                  scale: [1, 1.1, 1],
                }}
                transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute w-[90vw] h-[90vh] rounded-full pointer-events-none mix-blend-screen blur-[100px]"
                style={{ background: PALETTE.purple, right: "-10%", bottom: "-10%", opacity: 0.3 }}
                animate={{
                  x: ["0%", "-10%", "0%"],
                  y: ["0%", "-15%", "0%"],
                  scale: [1, 1.1, 1],
                }}
                transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
              />
              {/* Magenta accent — only awakens on error */}
              <motion.div
                className="absolute inset-0 pointer-events-none mix-blend-color-dodge blur-[100px]"
                style={{ background: `radial-gradient(circle at 50% 50%, ${PALETTE.magenta} 0%, transparent 60%)` }}
                animate={{ opacity: inError ? 1 : 0 }}
                transition={{ duration: 0.3 }}
              />
            </>
          )}

          {/* ───────── L2  Scan lines (CRT memory) ───────── */}
          <div
            className="absolute inset-0 pointer-events-none mix-blend-overlay"
            style={{
              opacity: 0.05,
              backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)",
            }}
          />

          {/* ───────── L3  Film grain ───────── */}
          <svg className="absolute inset-0 h-full w-full pointer-events-none mix-blend-overlay" style={{ opacity: 0.04 }}>
            <filter id={grainId}>
              <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter={`url(#${grainId})`} />
          </svg>

          {/* ───────── L4  Spatial spotlight ───────── */}
          {!prefersReducedMotion && (
            <motion.div
              className="absolute inset-0 pointer-events-none mix-blend-soft-light"
              style={{ background: spotlightBg }}
            />
          )}

          {/* ───────── L5  Vignette ───────── */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ boxShadow: "inset 0 0 150px rgba(0,0,0,0.9)" }}
          />

          {/* ───────── L6  Drop Capsule — the neon vault door ───────── */}
          <div className="relative z-10 px-6 [perspective:800px] pointer-events-none">
            <motion.div
              variants={capsuleVariants}
              initial="initial"
              animate={inError ? "error" : "animate"}
              style={{
                rotateX: tiltX,
                rotateY: tiltY,
                transformStyle: "preserve-3d" as const,
              }}
              className="relative w-full max-w-[540px] mx-auto"
            >
              {/* Neon halo — pulses on idle, snaps to red on error */}
              {!prefersReducedMotion && (
                <motion.div
                  className="absolute inset-0 rounded-[32px] pointer-events-none"
                  style={{
                    border: `1px solid ${inError ? PALETTE.red : PALETTE.neon}`,
                    boxShadow: neonShadow(inError ? 2 : 1, inError ? PALETTE.red : PALETTE.neon),
                  }}
                  animate={
                    inError
                      ? { scale: [1, 1.02, 1] }
                      : { boxShadow: [neonShadow(0), neonShadow(2), neonShadow(0)] }
                  }
                  transition={
                    inError
                      ? { duration: 0.2, repeat: 2 }
                      : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }
                  }
                />
              )}

              {/* Capsule shell */}
              <div
                style={{
                  background: "rgba(8, 7, 20, 0.75)",
                  border: `1px solid ${inError ? "rgba(255, 51, 68, 0.3)" : "rgba(0, 255, 204, 0.15)"}`,
                  backdropFilter: "blur(24px) saturate(140%)",
                  WebkitBackdropFilter: "blur(24px) saturate(140%)",
                  boxShadow: inError
                    ? "0 30px 90px -30px rgba(255, 51, 68, 0.3)"
                    : "0 30px 90px -30px rgba(0, 255, 204, 0.2)",
                }}
                className="relative rounded-[32px] px-8 py-10 text-center overflow-hidden"
              >
                {/* Top hairline — neon underglow strip */}
                <div
                  className="absolute top-0 left-8 right-8 h-[1px]"
                  style={{ background: `linear-gradient(90deg, transparent, ${inError ? PALETTE.red : PALETTE.neon}, transparent)` }}
                />
                {/* Bottom hairline */}
                <div
                  className="absolute bottom-0 left-8 right-8 h-[1px]"
                  style={{ background: `linear-gradient(90deg, transparent, ${inError ? PALETTE.red : PALETTE.purple}, transparent)` }}
                />

                {/* Corner brackets — cyber HUD ornament */}
                <CornerBracket pos="tl" color={inError ? PALETTE.red : PALETTE.neon} />
                <CornerBracket pos="tr" color={inError ? PALETTE.red : PALETTE.neon} />
                <CornerBracket pos="bl" color={inError ? PALETTE.red : PALETTE.neon} />
                <CornerBracket pos="br" color={inError ? PALETTE.red : PALETTE.neon} />

                {/* Icon ring */}
                <div
                  className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full relative"
                  style={{
                    background: inError ? "rgba(255,51,68,0.08)" : "rgba(0,255,204,0.05)",
                    border: `1px solid ${inError ? "rgba(255,51,68,0.25)" : "rgba(0,255,204,0.2)"}`,
                  }}
                >
                  {inError ? <IconWarn /> : <IconDrop />}
                  {/* Rotating ring for active state — disabled on error */}
                  {!prefersReducedMotion && !inError && (
                    <motion.div
                      className="absolute inset-0 rounded-full border border-dashed"
                      style={{ borderColor: `${PALETTE.neon}55`, margin: -4 }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
                    />
                  )}
                </div>

                {/* Headline — with RGB-split shadow for cyber edge */}
                <h2
                  style={{
                    color: inError ? PALETTE.red : "#FFFFFF",
                    textShadow: inError
                      ? `0 0 16px ${PALETTE.red}66`
                      : `1px 0px 0px ${PALETTE.magenta}bb, -1px 0px 0px ${PALETTE.neon}bb`,
                  }}
                  className="text-[22px] font-bold tracking-tight mb-3"
                >
                  {inError ? "ZKP対象外 / Rejected" : title}
                </h2>

                {/* Sub */}
                <p
                  style={{ color: inError ? "rgba(255,51,68,0.85)" : "rgba(255,255,255,0.65)" }}
                  className="max-w-[360px] mx-auto text-[14px] leading-relaxed"
                >
                  {inError ? dragError : subtitle}
                </p>

                {/* Hint chip */}
                {!inError && (
                  <div
                    className="mt-8 inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-[11px] font-mono tracking-widest uppercase"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.5)",
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full animate-pulse"
                      style={{ backgroundColor: PALETTE.neon, boxShadow: `0 0 8px ${PALETTE.neon}` }}
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

// ──────────────────────────────────────────────────────────────
// Internal atoms
// ──────────────────────────────────────────────────────────────

const IconDrop: React.FC = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 4V20M12 20L6 14M12 20L18 14"
      stroke={PALETTE.neon}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconWarn: React.FC = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 8V13M12 17.01L12.01 17M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"
      stroke={PALETTE.red}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CornerBracket: React.FC<{ pos: "tl" | "tr" | "bl" | "br"; color: string }> = ({ pos, color }) => {
  const base = "absolute h-5 w-5 pointer-events-none";
  const posCls =
    pos === "tl"
      ? "top-4 left-4 border-t-2 border-l-2"
      : pos === "tr"
      ? "top-4 right-4 border-t-2 border-r-2"
      : pos === "bl"
      ? "bottom-4 left-4 border-b-2 border-l-2"
      : "bottom-4 right-4 border-b-2 border-r-2";
  return (
    <span
      className={`${base} ${posCls}`}
      style={{ borderColor: `${color}44` }}
    />
  );
};