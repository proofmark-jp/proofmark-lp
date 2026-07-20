// src/utils/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  // 100%絶対確実なグローバル・シングルトン
  // Viteのインポートパス（@/ vs ../）のブレによるモジュール分裂を物理的に無効化する
  if (typeof window !== 'undefined') {
    if (!(window as any).__SUPABASE_CLIENT__) {
      (window as any).__SUPABASE_CLIENT__ = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    }
    return (window as any).__SUPABASE_CLIENT__;
  }

  // SSR等の非ブラウザ環境用フォールバック
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}