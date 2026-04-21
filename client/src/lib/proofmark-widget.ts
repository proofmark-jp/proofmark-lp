export type PortfolioWidgetTheme = 'dark' | 'light';
export type PortfolioWidgetLayout = 'grid' | 'list' | 'compact';

export interface PortfolioWidgetOptions {
  theme?: PortfolioWidgetTheme;
  layout?: PortfolioWidgetLayout;
  showBadges?: boolean;
  showBundles?: boolean;
  maxItems?: number;
  bundleLimit?: number;
  height?: number;
}

const clamp = (value: number, min: number, max: number) => {
  const safeValue = Number.isFinite(value) ? value : min;
  return Math.min(Math.max(safeValue, min), max);
};

export function buildPortfolioWidgetUrl(baseUrl: string, username: string, options: PortfolioWidgetOptions = {}) {
  const url = new URL(`/embed/${encodeURIComponent(username)}`, baseUrl);

  if (options.theme) url.searchParams.set('theme', options.theme);
  if (options.layout) url.searchParams.set('layout', options.layout);
  if (typeof options.showBadges === 'boolean') url.searchParams.set('badges', String(options.showBadges));
  if (typeof options.showBundles === 'boolean') url.searchParams.set('bundles', String(options.showBundles));
  if (typeof options.maxItems === 'number') url.searchParams.set('maxItems', String(clamp(options.maxItems, 1, 12)));
  if (typeof options.bundleLimit === 'number') url.searchParams.set('bundleLimit', String(clamp(options.bundleLimit, 0, 6)));

  return url.toString();
}

export function buildPortfolioWidgetEmbedHtml(baseUrl: string, username: string, options: PortfolioWidgetOptions = {}) {
  const src = buildPortfolioWidgetUrl(baseUrl, username, options);
  const frameId = `proofmark-widget-${username.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || 'portfolio'}`;
  const height = clamp(options.height ?? 880, 520, 1600);

  return `<iframe
  id="${frameId}"
  src="${src}"
  title="ProofMark verified portfolio"
  loading="lazy"
  style="width:100%;height:${height}px;border:0;border-radius:28px;overflow:hidden;background:#050816;box-shadow:0 24px 120px rgba(10,14,39,.36);"
  referrerpolicy="strict-origin-when-cross-origin"
></iframe>
<script>
(function(){
  var frame = document.getElementById('${frameId}');
  if (!frame) return;
  window.addEventListener('message', function(event){
    if (!event || !event.data || event.data.type !== 'proofmark:embed:resize') return;
    // 🛡️ 防衛線：自分自身（ProofMarkのiframe）からの通信以外は完全に無視する
    if (event.source !== frame.contentWindow) return;
    if (typeof event.data.height !== 'number') return;
    frame.style.height = Math.max(520, Math.min(1600, Math.ceil(event.data.height))) + 'px';
  });
})();
</script>`;
}
