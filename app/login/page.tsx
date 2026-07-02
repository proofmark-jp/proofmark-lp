'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '../../src/utils/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('メールアドレスとパスワードを入力してください。');
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading('安全な接続を確立中...');

    try {
      // @supabase/ssr の BrowserClient を使うことで、自動的にセキュアCookieが発行・同期される
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success('認証に成功しました。コンソールへ転送します。', { id: toastId });
      
      // router.push後に router.refresh() を呼ぶことで、ミドルウェアを強制的に再評価させる
      router.push('/console');
      router.refresh();
      
    } catch (error: any) {
      console.error('[Login Error]', error);
      toast.error(error.message || '認証に失敗しました。認証情報を確認してください。', { id: toastId });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-[#00D4AA]/30">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <ShieldCheck className="w-16 h-16 text-[#00D4AA] mb-4" />
        <h2 className="text-center text-3xl font-extrabold tracking-tight">
          ProofMark Console
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-400 font-medium">
          Authorized Personnel Only
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-zinc-900/50 border border-zinc-800 py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 backdrop-blur-sm">
          <form className="space-y-6" onSubmit={handleLogin}>
            
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-zinc-500" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-3 border border-zinc-700 rounded-xl bg-black text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#00D4AA] focus:border-transparent transition-all sm:text-sm"
                  placeholder="admin@proofmark.jp"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-zinc-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-3 border border-zinc-700 rounded-xl bg-black text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#00D4AA] focus:border-transparent transition-all sm:text-sm"
                  placeholder="••••••••"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-black bg-[#00D4AA] hover:bg-[#00D4AA]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-[#00D4AA] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Sign In <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}