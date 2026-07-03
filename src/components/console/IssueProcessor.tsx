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
    const toastId = toast.loading('動画の解析とC2PAマニフェストを生成中...');

    try {
      // ─────────────────────────────────────────────────────────
      // 🚀 【The Ignition】証明書発行APIへの発火点
      // ─────────────────────────────────────────────────────────
      // TODO: ここを実際のバックエンドAPIのエンドポイントに書き換えます
      // 例: const res = await fetch('/api/process-bundles/create-json', { ... })
      
      // ※現在はUIとUXの完璧な動作を検証するためのシミュレーション（3秒の遅延）
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // ─────────────────────────────────────────────────────────

      toast.success('暗号化ハッシュチェーンの構築が完了しました。', { id: toastId });
      
      // 処理完了後、ダッシュボード（または完了画面）へ帰還させる
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