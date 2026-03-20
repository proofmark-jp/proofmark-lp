/**
 * SupportedToolsSection Component
 * Design: Cyber-Minimalist Security
 * 
 * Displays supported AI tools and formats with grayscale logos.
 * Builds trust through ecosystem compatibility without claiming partnerships.
 * 
 * Design principles:
 * 1. Use grayscale logos to avoid brand dominance
 * 2. Emphasize "Works with" not "Partnered with"
 * 3. Add trademark disclaimer in footer
 */

export const SupportedToolsSection = () => {
  const tools = [
    {
      name: "Midjourney",
      logo: "🎨",
      description: "AI画像生成",
    },
    {
      name: "Stable Diffusion",
      logo: "⚡",
      description: "オープンソースAI",
    },
    {
      name: "DALL-E",
      logo: "🤖",
      description: "OpenAI生成",
    },
    {
      name: "Adobe Firefly",
      logo: "✨",
      description: "Adobe統合",
    },
    {
      name: "Leonardo.AI",
      logo: "🎭",
      description: "クリエイティブAI",
    },
    {
      name: "Runway",
      logo: "🎬",
      description: "ビデオ生成",
    },
  ];

  return (
    <section className="py-20 bg-secondary/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black mb-3">Supported Formats & AI Tools</h2>
          <p className="text-muted max-w-2xl mx-auto">
            すべての主要なAIツールの出力に対応。あなたのワークフローをそのまま活かせます。
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mb-12">
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {["JPG", "PNG", "WebP", "TIFF", "GIF", "BMP", "SVG", "PDF"].map(
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
