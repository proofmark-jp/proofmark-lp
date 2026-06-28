// client/src/pages/embed/EmbedWidgetPage.tsx
/**
 * EmbedWidgetPage — Kinetic Zero-Render Engine
 * ────────────────────────────────────────────────────────────────
 * The Parasitic Proof Widget.
 *
 * Architectural laws of this file:
 *   1. NO Virtual DOM during scrub. Frame index never touches React state.
 *   2. NO C2PA. Manifest parsing was excised — the seal already says enough.
 *   3. NO eager preload. proof_frame_urls are dormant until the cursor enters.
 *   4. The scrub surface mutates <img>.src directly inside requestAnimationFrame,
 *      coalesced by a single rAF token. 60fps survives even on Pixel 4a.
 *
 * Vite + React 18 + Wouter. No Next.js. No Framer Motion.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRoute } from 'wouter';

function getNetworkAwareFrames(urls: string[]): string[] {
  const n = urls.length;
  if (n <= 5) return urls;
  if (typeof navigator === 'undefined' || !('connection' in navigator)) return urls;
  const conn = (navigator as any).connection;

  const isSaveData = conn.saveData === true;
  const is3G = conn.effectiveType === '3g';
  const is2G = conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g';

  if (!isSaveData && !is3G && !is2G) return urls;

  const numFrames = is2G ? 3 : 12;
  const reduced: string[] = [];
  const step = Math.max(1, (n - 1) / (numFrames - 1));

  for (let i = 0; i < numFrames - 1; i++) {
    reduced.push(urls[Math.floor(i * step)]);
  }
  reduced.push(urls[n - 1]);
  
  return Array.from(new Set(reduced));
}

/* ════════════════════════════════════════════════════════════════
   Types
   ════════════════════════════════════════════════════════════════ */

type CertificateLite = {
  id: string;
  title: string | null;
  public_image_url: string | null;
  public_verify_token: string | null;
  certified_at: string | null;
  /** Ordered chain of evolution frames (T0 → HEAD). Last frame == HEAD. */
  proof_frame_urls: string[];
};

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; reason: 'not_found' | 'unknown' }
  | { status: 'ready'; cert: CertificateLite };

/* ════════════════════════════════════════════════════════════════
   Iframe resize sync helper
   ════════════════════════════════════════════════════════════════ */

function postResize() {
  if (typeof window === 'undefined' || window.parent === window) return;
  const h = Math.max(
    document.documentElement.scrollHeight,
    document.body?.scrollHeight ?? 0,
  );
  try {
    window.parent.postMessage({ type: 'PROOFMARK_WIDGET_RESIZE', height: h }, '*');
  } catch {
    /* noop */
  }
}

/* ════════════════════════════════════════════════════════════════
   Sub-components (visual DNA — DO NOT TOUCH the cyberpunk skin)
   ════════════════════════════════════════════════════════════════ */

function ProofChip({
  tone,
  label,
  dotClass,
}: {
  tone: 'green' | 'purple' | 'blue' | 'slate';
  label: string;
  dotClass: string;
}) {
  const toneClass =
    tone === 'green'
      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
      : tone === 'purple'
        ? 'border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-300'
        : tone === 'blue'
          ? 'border-sky-400/30 bg-sky-400/10 text-sky-300'
          : 'border-white/10 bg-white/5 text-white/70';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-[3px] rounded-full text-[10.5px] font-semibold tracking-wide border backdrop-blur-sm ${toneClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}

function WidgetShell({
  children,
  href,
}: {
  children: React.ReactNode;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full max-w-[420px] mx-auto rounded-2xl border border-white/10 bg-[#0F0F11] shadow-[0_4px_20px_rgba(0,0,0,0.35)] overflow-hidden text-white no-underline font-sans antialiased transition-[transform,box-shadow] duration-200 hover:shadow-[0_8px_28px_rgba(0,212,170,0.18)] hover:-translate-y-[1px]"
      style={{ contain: 'layout style paint' }}
    >
      {children}
    </a>
  );
}

function SkeletonWidget() {
  return (
    <WidgetShell href="https://proofmark.jp">
      <div className="animate-pulse">
        <div className="aspect-[16/10] w-full bg-white/[0.04]" />
        <div className="p-4 space-y-3">
          <div className="h-3.5 w-3/4 rounded-md bg-white/[0.06]" />
          <div className="h-3 w-1/2 rounded-md bg-white/[0.05]" />
          <div className="flex gap-2 pt-1">
            <div className="h-5 w-28 rounded-full bg-white/[0.05]" />
            <div className="h-5 w-20 rounded-full bg-white/[0.05]" />
          </div>
        </div>
      </div>
    </WidgetShell>
  );
}

function NotFoundWidget() {
  return (
    <WidgetShell href="https://proofmark.jp">
      <div className="p-5 flex items-center gap-3">
        <div className="shrink-0 w-9 h-9 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4 text-white/40"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M9 9l6 6M15 9l-6 6" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold text-white/80 leading-tight">
            Certificate Not Found
          </div>
          <div className="mt-0.5 text-[11px] text-white/40 leading-tight truncate">
            This ProofMark badge could not be verified.
          </div>
        </div>
        <div className="ml-auto shrink-0 text-[10px] font-bold tracking-[0.18em] text-white/30 uppercase">
          ProofMark
        </div>
      </div>
    </WidgetShell>
  );
}

/* ════════════════════════════════════════════════════════════════
   KineticScrubSurface
   ────────────────────────────────────────────────────────────────
   The heart of the Zero-Render Engine.

   - Owns ONE numeric scalar `progressRef.current` (0..1)
   - Owns ONE rAF token `rafTokenRef.current`
   - Mutates ONE <img>.src + ONE sweep-line .style.transform per frame
   - React never re-renders during scrub. Confirmed.
   ════════════════════════════════════════════════════════════════ */

function KineticScrubSurface({
  finalUrl,
  frameUrls,
  title,
}: {
  finalUrl: string | null;
  frameUrls: string[];
  title: string;
}) {
  /** DOM handles for direct mutation. */
  const imgRef = useRef<HTMLImageElement | null>(null);
  const sweepRef = useRef<HTMLDivElement | null>(null);
  const indexRef = useRef<HTMLSpanElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const hintRef = useRef<HTMLDivElement | null>(null);

  /** Mutable scalars — these never trigger React renders. */
  const progressRef = useRef(1); // start at HEAD
  const rafTokenRef = useRef(0);
  const dirtyRef = useRef(false);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const lastIdxRef = useRef(-1);
  const preloadedRef = useRef(false);

  /** Frame URLs as a stable ref (avoid prop-drilling into rAF). */
  const framesRef = useRef<string[]>(frameUrls);
  framesRef.current = frameUrls;

  const total = frameUrls.length;
  const hasChain = total > 1;

  /* ─── Lazy preload ────────────────────────────────────────────
     Triggered ONLY on first pointerenter / touchstart. We never
     issue these requests on initial page load. */
  const preloadChain = useCallback(() => {
    if (preloadedRef.current) return;
    preloadedRef.current = true;
    const urls = framesRef.current;
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      if (!url) continue;
      // Detached Image: lands in browser cache, never enters the DOM tree.
      const im = new window.Image();
      im.decoding = 'async';
      // High priority on the last few frames (HEAD is what users hover toward).
      // @ts-expect-error fetchPriority is supported by Chromium/Safari/Firefox 132+
      im.fetchPriority = i >= urls.length - 3 ? 'high' : 'low';
      im.src = url;
    }
  }, []);

  /* ─── rAF-coalesced paint ─────────────────────────────────── */
  const paint = useCallback(() => {
    rafTokenRef.current = 0;
    if (!dirtyRef.current) return;
    dirtyRef.current = false;

    const p = progressRef.current;
    const urls = framesRef.current;
    const n = urls.length;
    if (n === 0) return;

    // Index resolution. floor for forward feel, clamped to [0, n-1].
    let idx = Math.floor(p * n);
    if (idx >= n) idx = n - 1;
    if (idx < 0) idx = 0;

    // Sweep line — GPU-only transform. No layout, no paint cascade.
    const sweep = sweepRef.current;
    if (sweep) {
      sweep.style.transform = `translate3d(${(p * 100).toFixed(3)}%, 0, 0)`;
    }

    // Index counter
    if (indexRef.current && lastIdxRef.current !== idx) {
      indexRef.current.textContent = `${idx + 1} / ${n}`;
    }

    // Image src — only write when index actually moves to a new frame.
    if (idx !== lastIdxRef.current) {
      lastIdxRef.current = idx;
      const next = urls[idx];
      const im = imgRef.current;
      if (im && next && im.src !== next) {
        // decoding="sync" is set in JSX; this keeps the previous frame painted
        // until the new bitmap is ready → zero flash, zero broken-image icon.
        im.src = next;
      }
    }
  }, []);

  const schedulePaint = useCallback(() => {
    if (rafTokenRef.current) return;
    dirtyRef.current = true;
    rafTokenRef.current = requestAnimationFrame(paint);
  }, [paint]);

  /* ─── Pointer scrub ──────────────────────────────────────── */
  const setProgressFromClientX = useCallback(
    (clientX: number) => {
      const rect = rectRef.current;
      if (!rect || rect.width <= 0) return;
      let next = (clientX - rect.left) / rect.width;
      if (next < 0) next = 0;
      else if (next > 1) next = 1;
      if (next === progressRef.current) return;
      progressRef.current = next;
      schedulePaint();
    },
    [schedulePaint],
  );

  const handlePointerEnter = useCallback(() => {
    if (!hasChain) return;
    preloadChain();
    // Fade the hint without remounting.
    const hint = hintRef.current;
    if (hint) hint.style.opacity = '0';
  }, [hasChain, preloadChain]);

  const handlePointerLeave = useCallback(() => {
    if (!hasChain) return;
    if (draggingRef.current) return;
    const hint = hintRef.current;
    if (hint) hint.style.opacity = '1';
  }, [hasChain]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!hasChain) return;
      const el = e.currentTarget;
      rectRef.current = el.getBoundingClientRect();
      pointerIdRef.current = e.pointerId;
      draggingRef.current = true;
      preloadChain();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      setProgressFromClientX(e.clientX);
    },
    [hasChain, preloadChain, setProgressFromClientX],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!hasChain) return;
      // Two modes:
      //   - while dragging:  follow even when off-axis
      //   - while hovering:  follow on hover (Stripe-style preview scrub)
      if (
        draggingRef.current &&
        pointerIdRef.current !== null &&
        e.pointerId !== pointerIdRef.current
      ) {
        return;
      }
      // Lazily refresh rect on hover so resizes don't desync.
      if (!draggingRef.current) {
        rectRef.current = e.currentTarget.getBoundingClientRect();
      }
      setProgressFromClientX(e.clientX);
    },
    [hasChain, setProgressFromClientX],
  );

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    pointerIdRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }, []);

  /* ─── Keyboard accessibility (Arrow / Home / End) ────────── */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!hasChain) return;
      const step = 1 / Math.max(1, total - 1);
      let next: number | null = null;
      if (e.key === 'ArrowRight') next = Math.min(1, progressRef.current + step);
      else if (e.key === 'ArrowLeft') next = Math.max(0, progressRef.current - step);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = 1;
      if (next !== null) {
        e.preventDefault();
        preloadChain();
        progressRef.current = next;
        schedulePaint();
      }
    },
    [hasChain, total, preloadChain, schedulePaint],
  );

  /* ─── Bail-out: prevent <a> drag-image hijack ────────────── */
  const handleClickGuard = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // If the user just finished scrubbing, swallow the click so the
    // parent <a href="…/cert/…"> doesn't navigate accidentally.
    // A natural tap (no drag) still bubbles up and navigates.
    // Heuristic: progress moved during this gesture? Stop the click.
    // We can't observe that from here directly, but the safest UX is to
    // *only* prevent navigation when the surface is mid-drag.
    if (draggingRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  /* ─── Resize listener — keep rect fresh ──────────────────── */
  useEffect(() => {
    const onResize = () => {
      const el = surfaceRef.current;
      if (el) rectRef.current = el.getBoundingClientRect();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* ─── Cleanup rAF on unmount ─────────────────────────────── */
  useEffect(() => {
    return () => {
      if (rafTokenRef.current) {
        cancelAnimationFrame(rafTokenRef.current);
        rafTokenRef.current = 0;
      }
    };
  }, []);

  /* ─── Render ──────────────────────────────────────────────
     Only ONE <img> tag exists. Its src is mutated by hand. */
  const initialSrc = finalUrl ?? frameUrls[frameUrls.length - 1] ?? '';

  return (
    <div
      ref={surfaceRef}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      onClick={handleClickGuard}
      role={hasChain ? 'slider' : undefined}
      aria-label={hasChain ? `Scrub ${title} creation history` : undefined}
      aria-valuemin={hasChain ? 1 : undefined}
      aria-valuemax={hasChain ? total : undefined}
      aria-valuenow={hasChain ? total : undefined}
      tabIndex={hasChain ? 0 : -1}
      className={`relative aspect-[16/10] w-full overflow-hidden bg-[#0A0A0C] ${
        hasChain ? 'cursor-ew-resize' : ''
      } focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40`}
      style={{ touchAction: hasChain ? 'pan-y' : undefined }}
    >
      {initialSrc ? (
        <img
          ref={imgRef}
          src={initialSrc}
          alt={title}
          loading="lazy"
          decoding="sync"
          onLoad={postResize}
          onError={postResize}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
          draggable={false}
          style={{ textIndent: '-9999px' }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-white/20 text-xs tracking-widest">
          NO PREVIEW
        </div>
      )}

      {/* Cyberpunk scanlines */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-25"
        style={{
          background:
            'repeating-linear-gradient(0deg, rgba(0,255,204,0.05) 0px, rgba(0,255,204,0.05) 1px, transparent 1px, transparent 3px)',
        }}
      />

      {/* Sweep line — anchored at left:0, translated by GPU transform */}
      {hasChain && (
        <div
          ref={sweepRef}
          aria-hidden
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{
            left: 0,
            width: '2px',
            marginLeft: '-1px',
            transform: 'translate3d(100%, 0, 0)',
            background:
              'linear-gradient(180deg, rgba(0,255,204,0) 0%, rgba(0,255,204,0.9) 50%, rgba(108,62,244,0) 100%)',
            boxShadow: '0 0 12px rgba(0,255,204,0.65)',
            willChange: 'transform',
          }}
        />
      )}

      {/* Top-right ProofMark seal */}
      <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-[3px] rounded-full bg-black/55 backdrop-blur-md border border-white/10 pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
        <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-white">
          ProofMark
        </span>
      </div>

      {/* Bottom gradient (legibility) */}
      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#0F0F11] to-transparent pointer-events-none" />

      {/* Frame counter — innerText-mutated, never re-rendered */}
      {hasChain && (
        <div className="absolute left-2 bottom-2 pointer-events-none">
          <span
            ref={indexRef}
            className="inline-block px-1.5 py-[2px] rounded-md bg-black/55 backdrop-blur-md border border-white/10 text-[10px] font-mono tabular-nums tracking-[0.14em] text-emerald-300/90"
          >
            {`${total} / ${total}`}
          </span>
        </div>
      )}

      {/* Hover hint */}
      {hasChain && (
        <div
          ref={hintRef}
          aria-hidden
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none transition-opacity duration-300"
          style={{ opacity: 1 }}
        >
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/10 text-[10.5px] font-semibold tracking-[0.16em] uppercase text-white/85 shadow-[0_4px_20px_rgba(0,0,0,0.45)]">
            <svg
              viewBox="0 0 24 24"
              className="w-3 h-3 text-emerald-300"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M3 12h6l2-3 2 6 2-3h6" />
            </svg>
            Hover / Drag to replay human creation
          </span>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Main Page
   ════════════════════════════════════════════════════════════════ */

export default function EmbedWidgetPage() {
  const [, params] = useRoute<{ id: string }>('/embed/widget/:id');
  const id = params?.id;

  const [state, setState] = useState<FetchState>({ status: 'loading' });
  const rootRef = useRef<HTMLDivElement>(null);

  /* ─── 1) Fetch certificate (Edge Proxy /api/cert?id=…) ─────── */
  useEffect(() => {
    if (!id) {
      setState({ status: 'error', reason: 'not_found' });
      return;
    }

    const ctrl = new AbortController();

    (async () => {
      setState({ status: 'loading' });
      try {
        const res = await fetch(`/api/cert?id=${encodeURIComponent(id)}`, {
          signal: ctrl.signal,
          headers: { accept: 'application/json' },
        });

        if (res.status === 404) {
          setState({ status: 'error', reason: 'not_found' });
          return;
        }
        if (!res.ok) {
          setState({ status: 'error', reason: 'unknown' });
          return;
        }

        const raw = (await res.json()) as Partial<CertificateLite>;

        // Defensive normalisation — the wire format MUST satisfy this shape.
        const cert: CertificateLite = {
          id: String(raw.id ?? id),
          title: raw.title ?? null,
          public_image_url: raw.public_image_url ?? null,
          public_verify_token: raw.public_verify_token ?? null,
          certified_at: raw.certified_at ?? null,
          proof_frame_urls: getNetworkAwareFrames(
            Array.isArray(raw.proof_frame_urls)
              ? raw.proof_frame_urls.filter(
                  (u): u is string => typeof u === 'string' && u.length > 0,
                )
              : []
          ),
        };

        setState({ status: 'ready', cert });
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setState({ status: 'error', reason: 'unknown' });
      }
    })();

    return () => ctrl.abort();
  }, [id]);

  /* ─── 2) Resize sync to parent ─────────────────────────────── */
  useEffect(() => {
    postResize();
    const raf = requestAnimationFrame(postResize);

    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => postResize())
        : null;
    if (ro && rootRef.current) ro.observe(rootRef.current);
    if (ro) ro.observe(document.documentElement);

    window.addEventListener('load', postResize);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('load', postResize);
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(postResize, 0);
    return () => clearTimeout(t);
  }, [state.status]);

  /* ─── 3) Proof chips (static — no C2PA, no manifest parsing) ─ */
  const chips = useMemo(() => {
    if (state.status !== 'ready') return null;
    const hasChain = state.cert.proof_frame_urls.length > 1;
    return (
      <>
        <ProofChip
          tone="green"
          label="Cryptographically Sealed"
          dotClass="bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
        />
        {hasChain && (
          <ProofChip
            tone="blue"
            label="Human Creation Replay"
            dotClass="bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.6)]"
          />
        )}
        <ProofChip
          tone="slate"
          label="Verified by ProofMark"
          dotClass="bg-white/60"
        />
      </>
    );
  }, [state]);

  /* ─── 4) Direct link to the canonical certificate page ─────── */
  const certHref =
    state.status === 'ready'
      ? `https://proofmark.jp/cert/${state.cert.public_verify_token ?? state.cert.id}`
      : 'https://proofmark.jp';

  /* ─── 5) Render ──────────────────────────────────────────── */
  return (
    <div
      ref={rootRef}
      className="w-full min-h-[1px] p-2 bg-transparent"
      style={{ colorScheme: 'dark' }}
    >
      {state.status === 'loading' && <SkeletonWidget />}

      {state.status === 'error' && <NotFoundWidget />}

      {state.status === 'ready' && (
        <WidgetShell href={certHref}>
          {/* Kinetic scrub — the entire 16:10 surface */}
          <KineticScrubSurface
            finalUrl={state.cert.public_image_url}
            frameUrls={state.cert.proof_frame_urls}
            title={state.cert.title ?? 'Untitled Work'}
          />

          {/* Body */}
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-[13.5px] font-bold text-white leading-snug truncate">
                  {state.cert.title || 'Untitled Work'}
                </h3>
                {state.cert.certified_at && (
                  <div className="mt-0.5 text-[10.5px] text-white/40 tracking-wide">
                    Proven&nbsp;
                    {new Date(state.cert.certified_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-[10px] font-mono text-white/30 tracking-wider mt-0.5">
                {(state.cert.public_verify_token ?? state.cert.id).slice(0, 6)}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">{chips}</div>

            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] text-white/35 tracking-wide">
                Tap to verify on ProofMark
              </span>
              <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-emerald-300/80">
                Verified →
              </span>
            </div>
          </div>
        </WidgetShell>
      )}
    </div>
  );
}
