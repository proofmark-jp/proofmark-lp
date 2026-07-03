/** @type {import('next').NextConfig} */
const nextConfig = {
  // 【防衛線 1: The Image Tax Evasion (画像課金爆発の物理的遮断)】
  // Vercelの画像最適化（Image Optimization）は従量課金です。
  // ここを `true` に固定することで、Vercelのサーバーリソース消費をゼロに抑え、限界費用ゼロで配信します。
  images: {
    unoptimized: true,
  },

  // 【防衛線 2: Strict Mode (潜在的バグの炙り出し)】
  reactStrictMode: true,

  // 【防衛線 3: The Wasm Shield (サーバーコンポーネントの完全解放)】
  // 過去のVite向けだった「fsやcryptoの強制隔離（fallback: false）」の足枷を完全に撤去。
  // Next.js 15のApp Routerが持つネイティブなNode.js APIへのアクセス権を回復させます。
  // Dropzoneの暗号化（hash-wasm等）に必要な WebAssembly のみ明示的に許可します。
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      syncWebAssembly: true,
    };
    return config;
  },

  // 【防衛線 4: The Header Injection (セキュリティヘッダーの強制付与)】
  // XSSやクリックジャッキングなどの古典的な攻撃をレスポンスヘッダー層で物理的に弾き返します。
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;