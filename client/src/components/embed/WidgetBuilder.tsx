import { useState, useMemo } from 'react';
import { Copy, Check, Code } from 'lucide-react';
import { buildPortfolioWidgetEmbedHtml, buildPortfolioWidgetUrl } from '@/lib/proofmark-widget'; 

export default function WidgetBuilder({ username }: { username: string }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [layout, setLayout] = useState<'grid' | 'list' | 'compact'>('grid');
  const [showBadges, setShowBadges] = useState(true);
  const [showBundles, setShowBundles] = useState(true);
  const [copied, setCopied] = useState(false);

  const embedHtml = useMemo(() => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://www.proofmark.jp';
    return buildPortfolioWidgetEmbedHtml(baseUrl, username, {
      theme,
      layout,
      showBadges,
      showBundles,
    });
  }, [username, theme, layout, showBadges, showBundles]);

  // 👑 キャッシュバスター：プレビュー用には本物のURLを生成し、キャッシュ回避パラメータを付与する
  const previewUrl = useMemo(() => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://www.proofmark.jp';
    const url = buildPortfolioWidgetUrl(baseUrl, username, { theme, layout, showBadges, showBundles });
    // URLの末尾に強制キャッシュクリアのタイムスタンプを付与（buildPortfolioWidgetUrlは必ずクエリパラメータを持つため '&' を使用）
    return `${url}&_t=${Date.now()}`;
  }, [username, theme, layout, showBadges, showBundles]);

  const handleCopy = () => {
    navigator.clipboard.writeText(embedHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.02] p-5 lg:p-8">
      <div className="mb-8">
        <h3 className="text-lg font-bold text-white">ウィジェット・ジェネレーター</h3>
        <p className="text-sm text-white/60">あなたのポートフォリオを自身のサイトやブログに埋め込んで、証明をアピールしましょう。</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
        {/* 左側：設定パネル ＆ アクション（コックピット） */}
        <div className="flex flex-col gap-8">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-xs font-medium text-white/70">テーマ (Theme)</label>
              <select value={theme} onChange={(e) => setTheme(e.target.value as any)} className="w-full rounded-lg border border-white/10 bg-[#0a0e27] px-3 py-2 text-sm text-white outline-none focus:border-white/30 transition-all">
                <option value="dark">Dark (漆黒)</option>
                <option value="light">Light (純白)</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-white/70">レイアウト (Layout)</label>
              <select value={layout} onChange={(e) => setLayout(e.target.value as any)} className="w-full rounded-lg border border-white/10 bg-[#0a0e27] px-3 py-2 text-sm text-white outline-none focus:border-white/30 transition-all">
                <option value="grid">Grid (グリッド)</option>
                <option value="list">List (リスト)</option>
                <option value="compact">Compact (省スペース)</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-white/80">バッジを表示</span>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" className="peer sr-only" checked={showBadges} onChange={(e) => setShowBadges(e.target.checked)} />
                <div className="peer h-6 w-11 rounded-full bg-white/10 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#00D4AA] peer-checked:after:translate-x-full peer-focus:outline-none"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-white/80">証拠チェーンを表示</span>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" className="peer sr-only" checked={showBundles} onChange={(e) => setShowBundles(e.target.checked)} />
                <div className="peer h-6 w-11 rounded-full bg-white/10 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#00D4AA] peer-checked:after:translate-x-full peer-focus:outline-none"></div>
              </label>
            </div>
          </div>

          {/* 👑 コピーUIを左側に移動：スクロール不要で即座にアクション可能に */}
          <div className="pt-6 border-t border-white/10">
            <div className="mb-3 flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-bold text-[#00D4AA] tracking-wider uppercase">
                <Code className="h-4 w-4" /> Embed Code
              </label>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                  copied ? 'bg-[#00D4AA]/20 text-[#00D4AA]' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied!' : 'コードをコピー'}
              </button>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#050816]">
              <pre className="proofmark-scrollbar max-h-32 overflow-auto p-4 text-[11px] leading-relaxed text-emerald-400/80 font-mono">
                <code>{embedHtml}</code>
              </pre>
            </div>
            <p className="mt-3 text-[10px] text-white/40 leading-relaxed">
              このHTMLコードをコピーして、ご自身のWebサイトやブログ（note等のiframe対応サービス）に貼り付けてください。
            </p>
          </div>
        </div>

        {/* 右側：ライブプレビュー（SaaSブラウザ・モックアップ / 固定高） */}
        <div className="relative h-[600px] overflow-hidden rounded-2xl border border-white/10 bg-[#02040A] shadow-2xl flex flex-col">
          {/* モックアップ・ヘッダー */}
          <div className="flex h-10 w-full shrink-0 items-center border-b border-white/5 bg-[#151D2F]/50 px-4 backdrop-blur-md">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
              <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
              <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
            </div>
            <div className="absolute inset-x-0 flex justify-center pointer-events-none">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#00D4AA]/70">Live Preview</span>
            </div>
          </div>
          
          {/* iframeコンテナ：モックアップ内に本物のブラウザ画面（iframe）を全画面で展開する */}
          <div className="flex-1 relative bg-[#050816] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-blend-soft-light overflow-hidden">
            <iframe
              key={previewUrl}
              src={previewUrl}
              className="absolute inset-0 w-full h-full border-0"
              title="Widget Preview"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
