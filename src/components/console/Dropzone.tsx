'use client';

import React, { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { UploadCloud, FileVideo, Loader2 } from 'lucide-react';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const ALLOWED_TYPES = ['video/mp4', 'video/quicktime'];

export default function Dropzone() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndUpload = useCallback(async (file: File) => {
    if (isUploading) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('無効なファイル形式です。MP4またはMOV形式のみ対応しています。');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`サイズ超過です。最大500MBまで（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）`);
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading('セキュア通信経路を構築中...');

    try {
      // 1. Next.js APIへ署名付きURLを要求（Cookieが自動送信されるため認証ヘッダーは不要）
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || '経路の構築に失敗しました。');
      }

      const { url, key } = await res.json();
      toast.loading('Cloudflare R2 へ暗号化転送中...', { id: toastId });

      // 2. R2へ直接PUT（Next.jsサーバーの帯域を一切消費しない）
      const uploadRes = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadRes.ok) throw new Error('ストレージへのデータ転送に失敗しました。');

      toast.success('動画のセキュアアップロードが完了しました。', { id: toastId });
      console.log('[Upload Success] File securely stored at:', key);

    } catch (error: any) {
      console.error('[Dropzone Error]', error);
      toast.error(error.message || '予期せぬエラーが発生しました。', { id: toastId });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [isUploading]);

  return (
    <div
      onClick={() => !isUploading && fileInputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!isUploading) setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.length) validateAndUpload(e.dataTransfer.files[0]);
      }}
      className={`
        relative flex flex-col items-center justify-center w-full h-80 rounded-2xl border-2 border-dashed transition-all duration-300 ease-in-out cursor-pointer overflow-hidden
        ${isUploading ? 'pointer-events-none opacity-60 border-zinc-700 bg-zinc-900/50' : ''}
        ${isDragging ? 'border-[#00D4AA] bg-[#00D4AA]/10 shadow-[0_0_30px_rgba(0,212,170,0.15)]' : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/30'}
      `}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={(e) => { if (e.target.files?.length) validateAndUpload(e.target.files[0]); }} 
        accept="video/mp4, video/quicktime" 
        className="hidden" 
      />
      
      <div className="flex flex-col items-center justify-center space-y-4 p-8 text-center z-10">
        {isUploading ? (
          <>
            <Loader2 className="w-14 h-14 text-[#00D4AA] animate-spin" />
            <p className="text-lg font-bold text-white tracking-wide">Uploading securely...</p>
          </>
        ) : (
          <>
            <div className={`p-4 rounded-full transition-colors duration-300 ${isDragging ? 'bg-[#00D4AA]/20 text-[#00D4AA]' : 'bg-zinc-800/80 text-zinc-400'}`}>
              <UploadCloud className="w-10 h-10" />
            </div>
            <p className="text-xl font-bold text-white tracking-tight">原本動画をドロップして証明書を作成</p>
            <div className="flex items-center gap-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">
              <span className="flex items-center gap-1.5"><FileVideo className="w-4 h-4" /> MP4 / MOV</span>
              <span>•</span>
              <span>MAX 500MB</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}