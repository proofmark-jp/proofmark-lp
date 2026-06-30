import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import '../index.css'; // 既存のグローバルCSS（Tailwind v4）をバインド

// Geistフォントのインポーズ（サブセット化による超高速ロード）
const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
});

export const metadata: Metadata = {
  title: 'ProofMark | Cryptographic Human Attestation',
  description: 'AI生成の冤罪からクリエイターの技術と誇りを守る、世界標準の公証インフラ。',
  viewport: 'width=device-width, initial-scale=true',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  
  // 【防衛線 4: The Cache Guillotine (古いViteキャッシュの強制破壊)】
  // ユーザーの端末に残留しているVite時代の `sw.js` (Service Worker) や古いPWAキャッシュが、
  // Next.jsのApp Routerと大衝突を起こして画面がバグるのを防ぐため、
  // クライアントのブラウザ起動の瞬間（インラインJavaScript）で古い登録を物理的に抹殺・浄化します。
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
    <html lang="ja" className={`${geist.variable}`}>
      <head>
        {/* ハイドレーション前に確実に実行させ、キャッシュの先祖返りを防ぐ */}
        <script dangerouslySetInnerHTML={{ __html: cacheWiperScript }} />
      </head>
      <body className="antialiased bg-black text-white selection:bg-zinc-800 selection:text-white">
        {/* 既存のレイアウト（NavbarやFooter）は、移行の進捗に合わせてここに流し込みます */}
        {children}
      </body>
    </html>
  );
}