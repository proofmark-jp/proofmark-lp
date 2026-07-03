import React from 'react';
import { redirect } from 'next/navigation';
import { FileVideo, ShieldCheck } from 'lucide-react';
// 【The Apex】先ほど作った動的エンジンをインポート
import IssueProcessor from '@/components/console/IssueProcessor';

interface IssuePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function IssuePage({ searchParams }: IssuePageProps) {
  const resolvedParams = await searchParams;
  const fileKey = resolvedParams.key as string;

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
            <div className="p-3 bg-black rounded-xl border border-zinc-800 ring-1 ring-zinc-700/50">
              <FileVideo className="w-6 h-6 text-[#00D4AA]" />
            </div>
            <div className="overflow-hidden">
              <h2 className="text-xs text-zinc-500 font-bold tracking-widest uppercase mb-1">Target File Key</h2>
              <p className="text-zinc-300 font-mono text-sm break-all truncate">
                {fileKey}
              </p>
            </div>
          </div>
        </div>

        {/* 🚀 【The Ignition】クライアントコンポーネントへ処理を完全委譲 */}
        <div className="flex justify-end">
          <IssueProcessor fileKey={fileKey} />
        </div>
      </main>
      
    </div>
  );
}