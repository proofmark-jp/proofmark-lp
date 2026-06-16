// client/src/pages/embed/EmbedWidgetPage.tsx
/**
 * EmbedWidgetPage — ADR-009 Phase 2.5 (Edge Data Proxy)
 * ────────────────────────────────────────────────────────────────
 * - Supabase への直接フェッチを廃止。/api/widget-cert?id= 経由に統一。
 * - Vercel Edge がレスポンスをキャッシュ → バズ時も DB コネクション枯渇ゼロ。
 * - WidgetShell の href を証明書の実 URL に修正。
 * - Vite + React + Wouter (NOT Next.js)
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRoute } from 'wouter';
import { parseC2paManifest, type WidgetC2paSignal } from '../../lib/c2pa-parser';

/* ════════════════════════════════════════════════════════════════
   Types
   ════════════════════════════════════════════════════════════════ */

type CertificateLite = {
  id: string;
  title: string | null;
  public_image_url: string | null;
  public_verify_token: string | null;
  certified_at: string | null;
  c2pa_manifest: unknown;
};

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; reason: 'not_found' | 'unknown' }
  | { status: 'ready'; cert: CertificateLite; signal: WidgetC2paSignal };


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
   Sub-components
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

/* ── WidgetShell: href を外部から注入できるように変更 ── */
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
   Main Page
   ════════════════════════════════════════════════════════════════ */

export default function EmbedWidgetPage() {
  const [, params] = useRoute<{ id: string }>('/embed/widget/:id');
  const id = params?.id;

  const [state, setState] = useState<FetchState>({ status: 'loading' });
  const rootRef = useRef<HTMLDivElement>(null);

  /* ─── 1) Fetch certificate via Edge Proxy (NOT direct Supabase) ─── */
  useEffect(() => {
    if (!id) {
      setState({ status: 'error', reason: 'not_found' });
      return;
    }

    let cancelled = false;

    const fetchCert = async () => {
      setState({ status: 'loading' });

      try {
        const res = await fetch(`/api/widget-cert?id=${encodeURIComponent(id)}`);

        if (cancelled) return;

        if (res.status === 404) {
          setState({ status: 'error', reason: 'not_found' });
          return;
        }
        if (!res.ok) {
          setState({ status: 'error', reason: 'unknown' });
          return;
        }

        const data: CertificateLite = await res.json();
        if (cancelled) return;

        const signal = parseC2paManifest(data.c2pa_manifest);
        setState({ status: 'ready', cert: data, signal });
      } catch {
        if (!cancelled) setState({ status: 'error', reason: 'unknown' });
      }
    };

    fetchCert();
    return () => { cancelled = true; };
  }, [id]);

  /* ─── 2) Resize sync to parent ─── */
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

  // state 変化時にも再送信 (Skeleton→Ready/Error の高さ差)
  useEffect(() => {
    const t = setTimeout(postResize, 0);
    return () => clearTimeout(t);
  }, [state.status]);

  /* ─── 3) Memo: proof chips ─── */
  const chips = useMemo(() => {
    if (state.status !== 'ready') return null;
    const { signal } = state;
    return (
      <>
        {signal.signatureValid && (
          <ProofChip
            tone="green"
            label="Cryptographically Signed"
            dotClass="bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
          />
        )}
        {signal.isAiGenerated && (
          <ProofChip
            tone="purple"
            label={signal.generatorName ?? 'AI Generated'}
            dotClass="bg-fuchsia-400 shadow-[0_0_6px_rgba(232,121,249,0.6)]"
          />
        )}
        {signal.isHumanEdited && (
          <ProofChip
            tone="blue"
            label="Human Edited"
            dotClass="bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.6)]"
          />
        )}
        {!signal.signatureValid && !signal.isAiGenerated && !signal.isHumanEdited && (
          <ProofChip
            tone="slate"
            label="Verified by ProofMark"
            dotClass="bg-white/60"
          />
        )}
      </>
    );
  }, [state]);

  /* ─── 4) 証明書ページへのダイレクトリンク URL を構築 ─── */
  const certHref =
    state.status === 'ready'
      ? `https://proofmark.jp/verify/${state.cert.public_verify_token ?? state.cert.id}`
      : 'https://proofmark.jp';

  /* ─── 5) Render ─── */
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
          {/* Thumbnail */}
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#0A0A0C]">
            {state.cert.public_image_url ? (
              <img
                src={state.cert.public_image_url}
                alt={state.cert.title ?? 'Proof'}
                loading="lazy"
                decoding="async"
                onLoad={postResize}
                onError={postResize}
                className="absolute inset-0 w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/20 text-xs tracking-widest">
                NO PREVIEW
              </div>
            )}
            {/* Top-right ProofMark seal */}
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-[3px] rounded-full bg-black/55 backdrop-blur-md border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
              <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-white">
                ProofMark
              </span>
            </div>
            {/* bottom gradient */}
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#0F0F11] to-transparent pointer-events-none" />
          </div>

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

            {/* Proof chips */}
            <div className="mt-3 flex flex-wrap gap-1.5">{chips}</div>

            {/* Footer */}
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
