'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Fingerprint, Mail, ArrowRight, Loader2 } from 'lucide-react';
// ※適宜あなたのプロジェクトのUIコンポーネント（Button, Input等）に置き換えて構わない

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading_magic' | 'loading_passkey' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  const supabase = createClient();

  // 1. Magic Link 送信処理
  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setStatus('loading_magic');
    setErrorMessage('');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // 本番環境とローカル環境で適切にリダイレクトさせる
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setStatus('error');
    } else {
      setStatus('success');
    }
  };

  // 2. Passkey ログイン処理
  const handlePasskeyLogin = async () => {
    setStatus('loading_passkey');
    setErrorMessage('');

    const { error } = await supabase.auth.signInWithPasskey();

    if (error) {
      setErrorMessage(error.message);
      setStatus('error');
    }
    // 成功時はSupabaseクライアントが自動的にセッションを確立し、画面が切り替わるかリロードされる
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-xl">
        
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            ProofMark
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            デジタル存在証明ワークスペースへ
          </p>
        </div>

        {status === 'success' ? (
          <div className="rounded-md bg-green-50 p-6 text-center border border-green-100">
            <Mail className="mx-auto h-8 w-8 text-green-500 mb-3" />
            <h3 className="text-sm font-medium text-green-800">
              ログインリンクを送信しました
            </h3>
            <p className="mt-2 text-sm text-green-700">
              {email} 宛てに送信されたメール内のボタンをクリックしてログインを完了してください。
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            
            {/* メイン: Magic Link フォーム */}
            <form onSubmit={handleMagicLinkLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="sr-only">メールアドレス</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="メールアドレス"
                />
              </div>

              <button
                type="submit"
                disabled={status === 'loading_magic' || !email}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {status === 'loading_magic' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    メールでログイン
                    <ArrowRight className="ml-2 h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
                  </>
                )}
              </button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">または</span>
              </div>
            </div>

            {/* サブ: Passkey ログイン */}
            <button
              onClick={handlePasskeyLogin}
              disabled={status === 'loading_passkey'}
              className="w-full flex items-center justify-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === 'loading_passkey' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Fingerprint className="w-5 h-5 mr-2 text-gray-500" />
                  パスキーでログイン (生体認証)
                </>
              )}
            </button>

            {status === 'error' && (
              <div className="text-sm text-red-600 text-center bg-red-50 p-3 rounded-lg border border-red-100">
                {errorMessage}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}