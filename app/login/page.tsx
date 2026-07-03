import React from 'react';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import Dropzone from '@/components/console/Dropzone';
import SignOutButton from '@/components/console/SignOutButton';

// 完全な Server Component。JSバンドルサイズは実質ゼロ。
export default async function ConsolePage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  // ミドルウェアをすり抜けた異常アクセス（またはセッション切れ）を物理遮断
  if (error || !user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-[#00D4AA]/30">
      <header className="border-b border-zinc-800 bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-[#00D4AA]" />
            <span className="font-bold text-lg tracking-wide">
              ProofMark <span className="text-zinc-500 font-normal">Console</span>
            </span>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-sm font-bold text-zinc-400 hidden sm:inline-block">
              {user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10 space-y-3">
          <h1 className="text-3xl font-extrabold tracking-tight">New Certification</h1>
          <p className="text-zinc-400 leading-relaxed font-medium">
            AI生成の冤罪からあなたの作品を守るため、原本となる動画ファイルをアップロードしてください。<br />
            アップロードされたデータはエンドツーエンドで暗号化され、Cloudflare R2 のセキュア領域に隔離保存されます。
          </p>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-2 shadow-2xl">
          <div className="bg-black rounded-[1.25rem] border border-zinc-800/50 p-6">
            <Dropzone />
          </div>
        </div>
      </main>
    </div>
  );
}