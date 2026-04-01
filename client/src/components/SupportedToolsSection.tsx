/**
 * SupportedToolsSection Component
 * Design: Premium Dark SaaS (Perfect Grid)
 */

export const SupportedToolsSection = () => {
  const tools = [
    {
      name: "Nano Banana Pro",
      logo: (
        <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" style={{ margin: "0 auto" }}>
          <path d="M12 2C16.4183 2 20 5.58172 20 10C20 15.5228 12 22 12 22C12 22 4 15.5228 4 10C4 5.58172 7.58172 2 12 2Z" stroke="url(#nbp-gradient)" strokeWidth="1.5" />
          <path d="M8 9C8 9 9.5 7.5 12 7.5C14.5 7.5 16 9 16 9" stroke="#00D4AA" strokeWidth="1.5" strokeLinecap="round" />
          <defs>
            <linearGradient id="nbp-gradient" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6C3EF4" /><stop offset="1" stopColor="#00D4AA" />
            </linearGradient>
          </defs>
        </svg>
      ),
      description: "次世代生成AI" // ← 1行に収まるよう極限まで短縮
    },
    { name: "Midjourney", logo: "🎨", description: "AI画像生成" },
    { name: "Stable Diffusion", logo: "⚡", description: "オープンソース" }, // ← 文字数を調整
    { name: "DALL-E", logo: "🤖", description: "OpenAI生成" },
    { name: "Adobe Firefly", logo: "✨", description: "Adobe統合" },
    { name: "Leonardo.AI", logo: "🎭", description: "クリエイティブ" }, // ← 文字数を調整
    { name: "Niji・journey", logo: "🌸", description: "アニメ系AI" },
    {
      name: "NovelAI",
      logo: (
        <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="#F0EFF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto" }}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      ),
      description: "イラスト特化" // ← 1行に収まるよう極限まで短縮
    },
  ];

  // 対応フォーマット（6種）
  const supportedFormats = [
    "JPG",
    "PNG",
    "WebP",
    "GIF",
    "AVIF",
    "HEIC",
  ];

  return (
    <section className="py-24 bg-[#07061A] border-y border-[#1C1A38]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4 text-[#F0EFF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
            Supported Formats &amp; AI Tools
          </h2>
          <p className="text-[#A8A0D8] max-w-2xl mx-auto text-sm md:text-base">
            主要なAIツールの出力に対応。あなたのワークフローをそのまま活かせます。
          </p>
        </div>

        {/* Tools Grid: 高さを完全に統一 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-4 mb-16">
          {tools.map((tool) => (
            <div
              key={tool.name}
              className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-[#0D0B24] border border-[#1C1A38] hover:border-[#6C3EF4]/50 hover:shadow-[0_8px_32px_rgba(108,62,244,0.1)] transition-all duration-300 h-full"
            >
              {/* アイコンのコンテナ高さを固定し、絵文字とSVGのズレを吸収 */}
              <div className="h-12 flex items-center justify-center text-4xl mb-4 group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-300">
                {tool.logo}
              </div>
              <h3 className="text-sm font-bold text-[#F0EFF8] text-center mb-2">{tool.name}</h3>
              <p className="text-xs text-[#A8A0D8] text-center whitespace-nowrap">{tool.description}</p>
            </div>
          ))}
        </div>

        {/* Format Support */}
        <div className="max-w-4xl mx-auto">
          <div className="p-8 rounded-2xl bg-[#0D0B24] border border-[#1C1A38]">
            <h3 className="font-bold mb-6 text-center text-[#F0EFF8]">対応フォーマット</h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
              {supportedFormats.map((format) => (
                <div
                  key={format}
                  className="px-4 py-3 rounded-xl bg-[#07061A] border border-[#1C1A38] text-sm font-bold text-center text-[#00D4AA] tracking-wider"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  {format}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Compatibility Note */}
        <div className="mt-10 text-center">
          <p className="text-xs text-[#A8A0D8]/60">
            ※ ProofMarkはこれらのツールに対応しています。公式な提携ではなく、互換性を示しています。
          </p>
        </div>
      </div>
    </section>
  );
};