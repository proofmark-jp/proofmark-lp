import React from 'react';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import Dropzone from '@/components/console/Dropzone';
import SignOutButton from '@/components/console/SignOutButton';

// 【The Apex】完全な Server Component (非同期処理に完全対応)
export default async function ConsolePage() {
  // サーバーサイドでCookieから直接セッションを確定。ローディング（isChecking）は不要。
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  // 万が一、Edge Proxyをすり抜けた異常アクセスがあれば、サーバーレベルで物理的に弾き返す
  if (error || !user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-[#00D4AA]/30">
      
      {/* 統合ヘッダー (The Header) */}
      <header className="border-b border-zinc-800 bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-[#00D4AA]" />
            <span className="font-bold text-lg tracking-wide">
              ProofMark <span className="text-zinc-500 font-normal">Console</span>
            </span>
          </div>
          <div className="flex items-center gap-6">
            {/* サーバー側で取得したユーザーEmailを即座に流し込む */}
            <span className="text-sm font-bold text-zinc-400 hidden sm:inline-block">
              {user.email}
            </span>
            {/* ログアウト機能だけを分離したClient Componentを配置 */}
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* メイン・ワークスペース (The Workspace) */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10 space-y-3">
          <h1 className="text-3xl font-extrabold tracking-tight">
            New Certification
          </h1>
          <p className="text-zinc-400 leading-relaxed font-medium">
            AI生成の冤罪からあなたの作品を守るため、原本となる動画ファイルをアップロードしてください。<br />
            アップロードされたデータはエンドツーエンドで暗号化され、Cloudflare R2 のセキュア領域に隔離保存されます。
          </p>
        </div>

        {/* The Dropzone (統合エリア) */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-2 shadow-2xl">
          <div className="bg-black rounded-[1.25rem] border border-zinc-800/50 p-6">
            {/* ファイルの検証とアップロード処理だけを切り出したClient Componentを配置 */}
            <Dropzone />
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-zinc-600 font-bold tracking-widest uppercase">
          <ShieldCheck className="w-4 h-4" />
          <span>ProofMark Trust Infrastructure</span>
        </div>
      </main>

    </div>
  );
}