/** @type {import('next').NextConfig} */
const nextConfig = {
  // 【防衛線 1: The Image Tax Evasion (画像課金爆発の物理的遮断)】
  // Vercelの画像最適化（Image Optimization）は従量課金です。
  // ここを `true` に固定することで、<Image>コンポーネントを使用してもVercelのサーバーリソースは一切消費されず、
  // SupabaseやCDNからのオリジナル画像が限界費用ゼロで配信されます。
  images: {
    unoptimized: true,
  },

  // 【防衛線 2: Strict Mode (潜在的バグの炙り出し)】
  // Vite時代には見逃されていたReactコンポーネントの副作用（useEffectのクリーンアップ漏れ等）を
  // 開発モードで2回レンダリングさせることで強制的に検知し、本番でのメモリリークを防ぎます。
  reactStrictMode: true,

  // 【防衛線 3: The Wasm & Node.js Polyfill Shield (重処理ライブラリのSSRクラッシュ回避)】
  // あなたの資産である `hash-wasm` や PDF生成ライブラリはブラウザ（Client）での実行を前提としています。
  // Next.jsがこれらをサーバー（SSR）で誤って解釈・実行してビルドが落ちるのを防ぐため、
  // Webpackの設定をハックし、Node.js特有のモジュール解決をフロントエンドから冷徹に隔離します。
  webpack: (config, { isServer }) => {
    // クライアントビルド時のみ、Node.js標準モジュールを無効化（fs, crypto等）
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        module: false,
        crypto: false,
        path: false,
      };
    }

    // `hash-wasm` のような高度な暗号処理ライブラリをブラウザで正常にコンパイル・実行させるための
    // WebAssembly（Wasm）の明示的な有効化
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      syncWebAssembly: true,
    };

    return config;
  },

  // 【防衛線 4: The Header Injection (セキュリティヘッダーの強制付与)】
  // XSSやクリックジャッキングなどの古典的な攻撃を、アプリケーション層ではなく
  // Next.jsのレスポンスヘッダー（エッジ層）で物理的に弾き返します。
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