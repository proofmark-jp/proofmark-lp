'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, Loader2, CheckCircle2, ArrowRight, FileVideo } from 'lucide-react';
import { toast } from 'sonner';

export default function Dropzone() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  // 【The Apex】成功状態をロックするためのState
  const [successKey, setSuccessKey] = useState<string | null>(null);

  const onDrop = useCallback(async (e: React.DragEvent | React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    
    let file: File | null = null;
    if ('dataTransfer' in e) {
      file = e.dataTransfer.files[0];
    } else if (e.target && 'files' in e.target && e.target.files) {
      file = e.target.files[0];
    }

    if (!file) return;

    if (!file.type.includes('video/')) {
      toast.error('動画ファイル（MP4 / MOV）のみアップロード可能です。');
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading('セキュアトンネルを構築中...');

    try {
      // 1. 署名付きURLの取得（Vercel API経由）
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size })
      });
      
      if (!res.ok) throw new Error('APIの初期化に失敗しました');
      const { url, key } = await res.json();

      // 2. Cloudflare R2 へのダイレクト・セキュア転送
      toast.loading('Cloudflare R2 へ暗号化転送中...', { id: toastId });
      const uploadRes = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadRes.ok) throw new Error('R2ストレージへの転送に失敗しました');

      // 3. 転送成功 ➔ UIを「成功状態」で物理ロックする
      toast.success('動画のセキュアアップロードが完了しました。', { id: toastId });
      setSuccessKey(key);

    } catch (error: any) {
      console.error('[Upload Error]', error);
      toast.error(error.message || 'アップロード中にエラーが発生しました。', { id: toastId });
      setIsUploading(false); // エラー時のみ初期画面に戻す
    }
  }, []);

  // ─────────────────────────────────────────────────────────
  // 状態 1: 成功ロック画面 (The Success Lock)
  // ─────────────────────────────────────────────────────────
  if (successKey) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 border border-[#00D4AA]/30 bg-[#00D4AA]/5 rounded-2xl animate-in fade-in duration-500">
        <CheckCircle2 className="w-16 h-16 text-[#00D4AA] mb-4" />
        <h3 className="text-2xl font-extrabold text-white mb-3 tracking-tight">アップロード完了</h3>
        <p className="text-sm text-zinc-400 mb-10 text-center leading-relaxed">
          原本データは安全なセキュア領域に隔離されました。<br />
          続いて、この動画ハッシュに基づく証明書を発行します。
        </p>
        <button
          // ※TODO: 次の画面（証明書発行画面）のURLに合わせて `/console/issue` 等を変更してください
          onClick={() => router.push(`/console/issue?key=${successKey}`)}
          className="flex items-center gap-2 bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-black px-8 py-4 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(0,212,170,0.2)]"
        >
          証明書の発行へ進む <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // 状態 2: 初期待機 ＆ アップロード中 (Idle & Uploading)
  // ─────────────────────────────────────────────────────────
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={`relative flex flex-col items-center justify-center py-20 px-4 border-2 border-dashed rounded-2xl transition-all duration-300 ${
        isUploading 
          ? 'border-[#00D4AA]/50 bg-[#00D4AA]/5' 
          : 'border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900/50 cursor-pointer'
      }`}
    >
      <input 
        type="file" 
        accept="video/mp4,video/quicktime" 
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        onChange={onDrop}
        disabled={isUploading}
      />

      {isUploading ? (
        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
          <Loader2 className="w-14 h-14 text-[#00D4AA] animate-spin mb-6" />
          <p className="text-white font-extrabold text-xl mb-3 tracking-tight">Uploading securely...</p>
          <p className="text-xs text-[#00D4AA] font-bold animate-pulse uppercase tracking-widest">
            Cloudflare R2 へ暗号化転送中...
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="bg-zinc-900 p-5 rounded-full mb-6 ring-1 ring-zinc-800">
            <UploadCloud className="w-10 h-10 text-zinc-400" />
          </div>
          <p className="text-xl font-bold text-white mb-5">原本動画をドロップして証明書を作成</p>
          <div className="flex items-center gap-4 text-xs font-bold text-zinc-500 tracking-widest">
            <span className="flex items-center gap-1"><FileVideo className="w-4 h-4"/> MP4 / MOV</span>
            <span>•</span>
            <span>MAX 500MB</span>
          </div>
        </div>
      )}
    </div>
  );
}