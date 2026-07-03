import React from 'react';
import { redirect } from 'next/navigation';
import { FileVideo, ShieldCheck, Cpu } from 'lucide-react';

// 【The Apex仕様】Next.js 15における破壊的変更: searchParamsは必ずPromiseとして扱う
interface IssuePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function IssuePage({ searchParams }: IssuePageProps) {
  // Promiseを展開してパラメータを抽出
  const resolvedParams = await searchParams;
  const fileKey = resolvedParams.key as string;

  // 鍵(key)を持たずにこのURLに直接アクセスしてきた不届き者は、トップへ強制送還
  if (!fileKey) {
    redirect('/console');
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
        </div>
      </header>

      {/* 発行ワークスペース (The Issuance Workspace) */}
      <main className="max-w-4xl mx-auto px-6 py-12 animate-in fade-in duration-500">
        <div className="mb-10 space-y-3">
          <h1 className="text-3xl font-extrabold tracking-tight">
            Certificate Issuance
          </h1>
          <p className="text-zinc-400 leading-relaxed font-medium">
            アップロードされた原本動画を解析し、暗号化ハッシュチェーンを構築します。<br />
            以下の対象ファイルに間違いがないか確認し、C2PAマニフェストの生成を開始してください。
          </p>
        </div>

        {/* ターゲットファイルの確認パネル */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 shadow-2xl mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-black rounded-xl border border-zinc-800">
              <FileVideo className="w-6 h-6 text-[#00D4AA]" />
            </div>
            <div>
              <h2 className="text-sm text-zinc-500 font-bold tracking-widest uppercase mb-1">Target File Key</h2>
              <p className="text-zinc-300 font-mono text-sm break-all">
                {fileKey}
              </p>
            </div>
          </div>
        </div>

        {/* 次のフェーズへのアクションボタン（現時点ではUIのみ） */}
        <div className="flex justify-end">
          <button className="flex items-center gap-2 bg-white text-black hover:bg-zinc-200 px-8 py-4 rounded-xl font-bold transition-all shadow-lg">
            <Cpu className="w-5 h-5" />
            解析と証明書生成を開始
          </button>
        </div>
      </main>
      
    </div>
  );
}