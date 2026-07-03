import React from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, FileBadge, Search, Clock, ChevronRight } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import Dropzone from '@/components/console/Dropzone';
import SignOutButton from '@/components/console/SignOutButton';

export default async function ConsolePage() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/login');
  }

  // 🚨 【完全修正】過去の全資産が眠る certificates テーブルから直接取得する
  const { data: certs, error: dbError } = await supabase
    .from('certificates')
    .select('id, title, file_name, created_at, certified_at, timestamp_token, is_archived')
    .eq('user_id', user.id)
    .eq('is_archived', false) // アーカイブ済みは一覧から除外
    .order('created_at', { ascending: false })
    .limit(5);

  if (dbError) {
    console.error('[Console] Failed to fetch certificates:', dbError);
  }

  const hasCerts = certs && certs.length > 0;

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
          <h1 className="text-3xl font-extrabold tracking-tight">
            New Certification
          </h1>
          <p className="text-zinc-400 leading-relaxed font-medium">
            AI生成の冤罪からあなたの作品を守るため、原本となる動画ファイルをアップロードしてください。<br />
            アップロードされたデータはエンドツーエンドで暗号化され、Cloudflare R2 に隔離保存されます。
          </p>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-2 shadow-2xl">
          <div className="bg-black rounded-[1.25rem] border border-zinc-800/50 p-6">
            <Dropzone />
          </div>
        </div>

        <div className="mt-20 pt-10 border-t border-zinc-800/50">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
              <FileBadge className="w-5 h-5 text-[#00D4AA]" />
              Recent Certificates
            </h2>
            {hasCerts && (
              <button className="text-sm font-bold text-zinc-500 hover:text-white transition-colors">
                View All
              </button>
            )}
          </div>

          {!hasCerts ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 border border-zinc-800/50 rounded-2xl bg-zinc-900/20">
              <Search className="w-10 h-10 text-zinc-600 mb-4" />
              <p className="text-zinc-300 font-bold mb-1">証明書はまだありません</p>
              <p className="text-sm text-zinc-500">
                最初の動画をアップロードして、ハッシュチェーンを構築してください。
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {certs.map((cert) => (
                <Link 
                  href={`/console/${cert.id}`} 
                  key={cert.id} 
                  className="flex items-center justify-between p-4 bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all rounded-xl cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-black rounded-lg border border-zinc-800">
                      <ShieldCheck className="w-5 h-5 text-[#00D4AA]" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm mb-0.5">
                        {cert.title || cert.file_name || 'Untitled Certificate'}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3"/> 
                          {new Date(cert.created_at).toLocaleDateString()}
                        </span>
                        <span>ID: {cert.id.split('-')[0]}...</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${
                          cert.timestamp_token && cert.certified_at ? 'bg-[#00D4AA]/10 text-[#00D4AA]' : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {cert.timestamp_token && cert.certified_at ? 'ISSUED' : 'PENDING'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-[#00D4AA] transition-colors" />
                </Link>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}