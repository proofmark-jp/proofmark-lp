'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Cpu, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export default function IssueProcessor({ fileKey }: { fileKey: string }) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleProcess = async () => {
    setIsProcessing(true);
    const toastId = toast.loading('原本動画のセキュアリンクを構築中...');

    try {
      // ─────────────────────────────────────────────────────────
      // 🚀 【The Ignition】本物の証明書発行APIへの発火
      // ─────────────────────────────────────────────────────────
      const res = await fetch('/api/certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileKey }), // 厳格にfileKeyのみを送信
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || '証明書の生成APIが拒絶されました。');
      }

      // APIからの応答（新しく発行された証明書のID）を受信
      // const { id } = await res.json(); 
      // ─────────────────────────────────────────────────────────

      toast.success('証明書のインフラ登録が完了しました。', { id: toastId });
      
      // ダッシュボードへ帰還（ここで最新のリストが再フェッチされ、今上げた動画が出現します）
      router.replace('/console'); 

    } catch (error: any) {
      console.error('[Issue Error]', error);
      toast.error(error.message || '証明書の生成処理中にエラーが発生しました。', { id: toastId });
      setIsProcessing(false);
    }
  };

  return (
    <button
      onClick={handleProcess}
      disabled={isProcessing}
      className="flex items-center gap-2 bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-black px-8 py-4 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(0,212,170,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isProcessing ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin text-black" />
          <span>暗号化処理を実行中...</span>
        </>
      ) : (
        <>
          <Cpu className="w-5 h-5 text-black" />
          <span>解析と証明書生成を開始</span>
          <ArrowRight className="w-5 h-5 ml-1 text-black" />
        </>
      )}
    </button>
  );
}   