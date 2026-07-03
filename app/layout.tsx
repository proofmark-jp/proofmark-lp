import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import { Toaster } from 'sonner'; // 【The Monitor】通知エンジンを注入
import './globals.css'; // 【The Engine】Viteのindex.cssを捨て、Next.js専用のCSSエンジンをバインド

// Geistフォントのインポート（サブセット化による超高速ロード）
const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
});

// Viewportを完全に独立させてエクスポート
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

// Metadata
export const metadata: Metadata = {
  title: 'ProofMark Console',
  description: 'AI生成の冤罪からクリエイターの技術と誇りを守る、世界標準の公証インフラ。',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  
  // 【防衛線 4: The Cache Guillotine (古いViteキャッシュの強制破壊)】
  const cacheWiperScript = `
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for (let registration of registrations) {
          registration.unregister().then(function(boolean) {
            if (boolean) {
              console.log('ProofMark Security: Vite時代の古いService Workerを強制解除しました。');
              window.location.reload();
            }
          });
        }
      });
    }
  `;

  return (
    // HTML全体にGeistの変数を適用し、背景を漆黒に固定
    <html lang="ja" className={`${geist.variable} bg-black`}>
      <head>
        {/* ハイドレーション前に確実に実行させ、キャッシュの先祖返りを防ぐ */}
        <script dangerouslySetInnerHTML={{ __html: cacheWiperScript }} />
      </head>
      {/* font-sans を指定してGeistを適用し、
        selection (テキスト選択時) の色をProofMarkブルー (#00D4AA) に設定 
      */}
      <body className="antialiased bg-black text-white font-sans selection:bg-[#00D4AA]/30 min-h-screen flex flex-col">
        
        {/* Next.js 16 Server Components Output */}
        {children}

        {/* 【The Monitor】UI Feedback Engine (Dropzoneの通知を可視化) */}
        <Toaster 
          theme="dark" 
          position="bottom-right" 
          richColors 
          expand={true}
          toastOptions={{
            style: {
              background: '#18181b', 
              border: '1px solid #27272a',
              color: '#fff',
            },
          }}
        />
        
      </body>
    </html>
  );
}