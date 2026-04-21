import { useEffect, useMemo, useRef, useState } from 'react';
import { useRoute } from 'wouter';
import PortfolioEmbedWidget, {
  type PortfolioWidgetPayload,
  type PortfolioWidgetSettings,
} from '../components/embed/PortfolioEmbedWidget';

function clamp(value: number, min: number, max: number) {
  const safeValue = Number.isFinite(value) ? value : min;
  return Math.min(Math.max(safeValue, min), max);
}

function parseBoolean(value: string | null, fallback: boolean) {
  if (value == null) return fallback;
  return value !== 'false' && value !== '0';
}

export default function EmbedPortfolioPage() {
  const [match, params] = useRoute('/embed/:username');
  const username = match && params ? params.username : null;
  const shellRef = useRef<HTMLDivElement>(null);
  const [payload, setPayload] = useState<PortfolioWidgetPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const settings = useMemo<PortfolioWidgetSettings>(() => {
    const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();

    return {
      theme: search.get('theme') === 'light' ? 'light' : 'dark',
      layout: search.get('layout') === 'list' ? 'list' : search.get('layout') === 'compact' ? 'compact' : 'grid',
      showBadges: parseBoolean(search.get('badges'), true),
      showBundles: parseBoolean(search.get('bundles'), true),
      maxItems: clamp(Number(search.get('maxItems') || '8'), 1, 12),
      bundleLimit: clamp(Number(search.get('bundleLimit') || '3'), 0, 6),
    };
  }, []);

  useEffect(() => {
    if (!username) {
      setLoading(false);
      setError('ユーザー名が見つかりません。');
      return;
    }

    const controller = new AbortController();
    const search = new URLSearchParams({
      maxItems: String(settings.maxItems),
      bundles: String(settings.showBundles),
      bundleLimit: String(settings.bundleLimit),
    });

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/certificates/widget/${encodeURIComponent(username)}?${search.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(response.status === 404 ? '公開ポートフォリオが見つかりませんでした。' : 'ウィジェットの読み込みに失敗しました。');
        }

        const json = (await response.json()) as PortfolioWidgetPayload;
        setPayload(json);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'ウィジェットの読み込みに失敗しました。');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [settings.bundleLimit, settings.maxItems, settings.showBundles, username]);

  useEffect(() => {
    if (typeof window === 'undefined' || !shellRef.current) return;

    const postHeight = () => {
      const element = shellRef.current;
      if (!element) return;
      const nextHeight = Math.ceil(element.getBoundingClientRect().height);
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'proofmark:embed:resize', height: nextHeight }, '*');
      }
    };

    const frame = requestAnimationFrame(postHeight);
    const observer = new ResizeObserver(() => requestAnimationFrame(postHeight));
    observer.observe(shellRef.current);
    window.addEventListener('load', postHeight);
    window.addEventListener('resize', postHeight);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('load', postHeight);
      window.removeEventListener('resize', postHeight);
    };
  }, [error, loading, payload, settings]);

  if (error) {
    return (
      <div ref={shellRef} className="min-h-screen bg-[#050816] p-4 text-white">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-sm text-white/70">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div ref={shellRef} className="min-h-screen bg-transparent p-3 sm:p-4">
      {loading || !payload ? (
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-[#050816] p-5 shadow-[0_24px_120px_rgba(2,8,24,0.45)]">
          <div className="animate-pulse space-y-4">
            <div className="h-36 rounded-[1.8rem] bg-white/[0.06]" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-24 rounded-[1.2rem] bg-white/[0.06]" />
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-72 rounded-[1.5rem] bg-white/[0.06]" />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-7xl">
          <PortfolioEmbedWidget payload={payload} settings={settings} />
        </div>
      )}
    </div>
  );
}
