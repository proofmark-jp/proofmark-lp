import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import { Toaster } from 'sonner'; // 【The Monitor】通知エンジンを注入
import './globals.css'; // 【The Engine】Viteのindex.cssを捨て、Next.js専用のCSSエンジンをバインド

// Geistフォントのインポート（サブセット化による超高速ロード）
const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
});

// 👑 The Apex Fix 1: 漆黒 of UI をネイティブブラウザ(Safariノッチ等)まで完全に貫通させる
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
  colorScheme: 'dark',
};

// 👑 The Apex Fix 2: OGP画像の絶対パス解決に必要な metadataBase を装填
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://proofmark.jp'),
  title: 'ProofMark Console',
  description: 'AI生成の冤罪からクリエイターの技術と誇りを守る、世界標準の公証インフラ。',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  
  // 👑 The Apex Fix 3: Promise.allによる非同期競合(レースコンディション)の殺害
  // 以前のforループ内reloadでは、複数のSW登録があった場合に他の解除処理が強制アボートされ、
  // 永遠に画面がリロードされ続ける「無限リロード地獄」に陥る致死的バグを回避。
  // StreamSaver用の sw.js は意図的に除外してアンインストールを阻止。
  const cacheWiperScript = `
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        if (registrations.length > 0) {
          var unregisterPromises = registrations.map(function(r) {
            if (r.active && r.active.scriptURL.includes('sw.js')) {
              return Promise.resolve(false);
            }
            return r.unregister();
          });
          Promise.all(unregisterPromises).then(function(results) {
            var anyUnregistered = results.some(function(success) { return success === true; });
            if (anyUnregistered) {
              console.log('ProofMark Security: Vite時代の古いService Workerを完全パージしました。');
              window.location.reload();
            }
          });
        }
      });
    }
  `;

  return (
    // 👑 The Apex Fix 4: suppressHydrationWarning の強制注入
    // これがないと、ユーザーのブラウザ拡張機能(Grammarly, 1Password等)がHTMLを汚染した瞬間に
    // React 19の厳格なハイドレーションがパニックを起こし、画面がクラッシュする。
    <html lang="ja" className={`${geist.variable} bg-black`} suppressHydrationWarning>
      <head>
        {/* ハイドレーション前に確実に実行させ、キャッシュの先祖返りを防ぐ */}
        <script dangerouslySetInnerHTML={{ __html: cacheWiperScript }} />
      </head>
      {/* font-sans を指定してGeistを適用し、
        selection (テキスト選択時) の色をProofMarkブルー (#00D4AA) に設定 
      */}
      <body 
        className="antialiased bg-black text-white font-sans selection:bg-[#00D4AA]/30 min-h-screen flex flex-col"
        suppressHydrationWarning
      >
        
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