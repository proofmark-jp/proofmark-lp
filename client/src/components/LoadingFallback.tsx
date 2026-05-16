/**
 * LoadingFallback — SaaS-grade Suspense fallback
 *
 * 設計:
 *   - 250ms 未満の高速遷移ではスケルトンを出さない (チラつき防止)
 *   - 250ms 以上で fade-in: skeleton shimmer
 *   - 8s 経過しても解決しなければ「読み込みに時間がかかっています」を表示
 *   - prefers-reduced-motion を尊重し、shimmer を停止
 *   - レイアウトシフト 0: Navbar 高さ・フッター高さを推定して詰める
 *
 * 用途:
 *   <Suspense fallback={<LoadingFallback />}> ... </Suspense>
 *   <Suspense fallback={<LoadingFallback variant="page" />}> ... </Suspense>
 *   <Suspense fallback={<LoadingFallback variant="inline" />}> ... </Suspense>
 */

import { useEffect, useState } from 'react';

type Variant = 'page' | 'inline' | 'minimal';

interface LoadingFallbackProps {
    variant?: Variant;
    /** 開発者向け識別子（DevTools の Performance で chunk 名と紐付けるため） */
    label?: string;
}

const SHOW_AFTER_MS = 200;
const STALE_AFTER_MS = 8_000;

export default function LoadingFallback({
    variant = 'page',
    label,
}: LoadingFallbackProps): JSX.Element | null {
    const [showSkeleton, setShowSkeleton] = useState(false);
    const [showStale, setShowStale] = useState(false);

    useEffect(() => {
        const showTimer = window.setTimeout(() => setShowSkeleton(true), SHOW_AFTER_MS);
        const staleTimer = window.setTimeout(() => setShowStale(true), STALE_AFTER_MS);
        return () => {
            window.clearTimeout(showTimer);
            window.clearTimeout(staleTimer);
        };
    }, []);

    // 200ms 未満なら何も出さない（最も気持ちの良い体感）
    if (!showSkeleton) return null;

    if (variant === 'minimal') {
        return <MinimalSpinner label={label} />;
    }

    if (variant === 'inline') {
        return <InlineSkeleton label={label} stale={showStale} />;
    }

    return <PageSkeleton label={label} stale={showStale} />;
}

/* ────────────────────────── inner pieces ────────────────────────── */

function PageSkeleton({
    label,
    stale,
}: {
    label?: string;
    stale: boolean;
}): JSX.Element {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label={label ?? 'ページを読み込んでいます'}
            className="relative flex min-h-[calc(100dvh-72px)] w-full flex-col items-center justify-start bg-[#07061A] px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24"
            data-fallback={label ?? 'page'}
        >
            {/* Hero placeholder */}
            <div className="w-full max-w-5xl space-y-6">
                <ShimmerBar className="h-6 w-40 rounded-full" />
                <ShimmerBar className="h-12 w-3/4 rounded-2xl" />
                <ShimmerBar className="h-12 w-1/2 rounded-2xl" />
                <div className="space-y-3 pt-2">
                    <ShimmerBar className="h-4 w-full rounded-lg" />
                    <ShimmerBar className="h-4 w-11/12 rounded-lg" />
                    <ShimmerBar className="h-4 w-9/12 rounded-lg" />
                </div>

                <div className="grid grid-cols-1 gap-4 pt-8 sm:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="rounded-2xl border border-white/8 bg-white/[0.02] p-5"
                        >
                            <ShimmerBar className="mb-4 h-8 w-8 rounded-xl" />
                            <ShimmerBar className="mb-3 h-5 w-3/4 rounded-md" />
                            <ShimmerBar className="h-3 w-full rounded-md" />
                            <ShimmerBar className="mt-2 h-3 w-5/6 rounded-md" />
                        </div>
                    ))}
                </div>
            </div>

            {stale ? <StaleHint /> : null}
            <span className="sr-only">読み込み中…</span>
        </div>
    );
}

function InlineSkeleton({
    label,
    stale,
}: {
    label?: string;
    stale: boolean;
}): JSX.Element {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label={label ?? '読み込んでいます'}
            className="w-full rounded-2xl border border-white/8 bg-[#0D0B24] p-6"
            data-fallback={label ?? 'inline'}
        >
            <div className="space-y-3">
                <ShimmerBar className="h-4 w-2/3 rounded-md" />
                <ShimmerBar className="h-4 w-1/2 rounded-md" />
                <ShimmerBar className="h-4 w-5/6 rounded-md" />
            </div>
            {stale ? <StaleHint inline /> : null}
        </div>
    );
}

function MinimalSpinner({ label }: { label?: string }): JSX.Element {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label={label ?? '読み込んでいます'}
            className="flex w-full items-center justify-center py-8"
        >
            <svg
                className="h-5 w-5 animate-spin text-[#6C3EF4] motion-reduce:animate-none"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
            >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path
                    d="M22 12a10 10 0 0 1-10 10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                />
            </svg>
        </div>
    );
}

function ShimmerBar({ className = '' }: { className?: string }): JSX.Element {
    return (
        <div
            className={`relative overflow-hidden bg-white/[0.05] ${className}`}
            style={{ contain: 'paint' }}
        >
            <div
                aria-hidden
                className="absolute inset-0 -translate-x-full motion-reduce:hidden"
                style={{
                    background:
                        'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 50%, transparent 100%)',
                    animation: 'pm-shimmer 1.6s ease-in-out infinite',
                }}
            />
            <style>{`
        @keyframes pm-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
        </div>
    );
}

function StaleHint({ inline = false }: { inline?: boolean }): JSX.Element {
    return (
        <p
            className={[
                'text-[12px] text-[#A8A0D8]',
                inline ? 'mt-4' : 'mt-10 text-center',
            ].join(' ')}
        >
            回線状況によって読み込みに時間がかかっています…
        </p>
    );
}
