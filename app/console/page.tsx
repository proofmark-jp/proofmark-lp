'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, type User } from '@supabase/supabase-js';
import { Loader2, ShieldCheck, LogOut } from 'lucide-react';
import { toast } from 'sonner';
// エイリアス迷子を完全に物理遮断するための相対パス指定
import Dropzone from '../../src/components/console/Dropzone';

// クライアントサイド用 Supabase インスタンスの生成
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ConsolePage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);

  // 【絶対的マウント・ガード】
  // コンポーネントがマウントされた直後にセッションを検証。無ければ即座に強制送還。
  useEffect(() => {
    const verifySession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          toast.error('認証セッションが見つかりません。ログインしてください。');
          router.replace('/'); // トップページ（ログイン想定）へ強制送還
          return;
        }
        
        setUser(session.user);
      } catch (err) {
        console.error('[Auth Guard] Session verification failed:', err);
        router.replace('/');
      } finally {
        // 検証が完了（または送還）するまで画面のロックを解除しない
        setIsChecking(false);
      }
    };

    verifySession();
  }, [router]);

  // ログアウト処理
  const handleSignOut = async () => {
    const toastId = toast.loading('サインアウトしています...');
    await supabase.auth.signOut();
    toast.success('安全にサインアウトしました', { id: toastId });
    router.replace('/');
  };

  // Dropzoneからの成功シグナル受信処理
  const handleUploadSuccess = (fileKey: string) => {
    // アップロード成功後のビジネスロジック（現時点ではコンソール通知のみ）
    // TODO: 次のフェーズで、この fileKey を用いて証明書発行APIを叩く画面へ遷移させる
    console.log('[Upload Success] Saved to R2 with key:', fileKey);
    toast.success('次のステップ（証明書発行）の準備が完了しました。');
  };

  // 認証確認中の物理ロック画面（The Lockdown Screen）
  if (isChecking) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#00D4AA] animate-spin mb-4" />
        <p className="text-zinc-400 font-bold tracking-widest animate-pulse">
          VERIFYING SECURE SESSION...
        </p>
      </div>
    );
  }

  // 認証通過後のメイン・ダッシュボード
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
            <span className="text-sm text-zinc-400 hidden sm:inline-block">
              {user?.email}
            </span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* メイン・ワークスペース (The Workspace) */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10 space-y-3">
          <h1 className="text-3xl font-extrabold tracking-tight">
            New Certification
          </h1>
          <p className="text-zinc-400 leading-relaxed">
            AI生成の冤罪からあなたの作品を守るため、原本となる動画ファイルをアップロードしてください。<br />
            アップロードされたデータは暗号化され、Cloudflare R2 のセキュア領域に隔離保存されます。
          </p>
        </div>

        {/* The Dropzone (統合エリア) */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-2 shadow-2xl">
          <div className="bg-black rounded-[1.25rem] border border-zinc-800/50 p-6">
            <Dropzone onSuccess={handleUploadSuccess} />
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-zinc-600 font-bold tracking-widest uppercase">
          <ShieldCheck className="w-4 h-4" />
          <span>End-to-End Encrypted Storage</span>
        </div>
      </main>

    </div>
  );
}