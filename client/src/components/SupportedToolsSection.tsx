/**
 * SupportedToolsSection Component
 * Design: Cyber-Minimalist Security
 */

export const SupportedToolsSection = () => {
  const tools = [
    { 
      name: "Nano Banana Pro", 
      logo: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ margin: "0 auto" }}>
          <path d="M12 2L4 6V18L12 22L20 18V6L12 2Z" stroke="#6EE7DF" strokeWidth="2"/>
          <path d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z" fill="#6EE7DF"/>
        </svg>
      ), 
      description: "プロ仕様の画像生成API、Nano Banana Proをサポート。" 
    },
    { name: "Midjourney", logo: "🎨", description: "AI画像生成" },
    { name: "Stable Diffusion", logo: "⚡", description: "オープンソースAI" },
    { name: "DALL-E", logo: "🤖", description: "OpenAI生成" },
    { name: "Adobe Firefly", logo: "✨", description: "Adobe統合" },
    { name: "Leonardo.AI", logo: "🎭", description: "クリエイティブAI" },
    { name: "Niji・journey", logo: "🌸", description: "アニメ系AI" },
  ];

  // 1. 配列から不要なものをコメントアウトして、現在の仕様（画像5種）に合わせる
  const supportedFormats = [
    "JPG",
    "PNG",
    "WebP",
    "GIF",
    "AVIF", // 新規追加
    /* ── 将来の拡張用（セキュリティ確認後に解除） ──
    "TIFF", 
    "BMP", 
    "SVG", 
    "PDF" 
    */
  ];

  return (
    <section className="py-20 bg-secondary/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black mb-3">Supported Formats & AI Tools</h2>
          <p className="text-muted max-w-2xl mx-auto">
            主要なAIツールの出力に対応。あなたのワークフローをそのまま活かせます。
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-4 mb-12">
          {tools.map((tool) => (
            <div
              key={tool.name}
              className="group flex flex-col items-center justify-center p-6 rounded-xl bg-card border border-border hover:border-primary/30 transition-all hover:bg-card/80"
            >
              <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300">
                {tool.logo}
              </div>
              <h3 className="text-sm font-bold text-center mb-1">{tool.name}</h3>
              <p className="text-xs text-muted text-center">{tool.description}</p>
            </div>
          ))}
        </div>

        {/* Format Support */}
        <div className="max-w-3xl mx-auto">
          <div className="p-6 rounded-xl bg-card border border-border">
            <h3 className="font-bold mb-4">対応フォーマット</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4"> {/* colを5に調整 */}
              {/* 2. 定義した supportedFormats を回すように変更 */}
              {supportedFormats.map(
                (format) => (
                  <div
                    key={format}
                    className="px-4 py-2 rounded-lg bg-secondary/50 border border-border text-sm font-semibold text-center"
                  >
                    {format}
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Compatibility Note */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted">
            ※ ProofMarkはこれらのツールに対応しています。公式な提携ではなく、互換性を示しています。
          </p>
        </div>
      </div>
    </section>
  );
};