"use client";
/**
 * src/lib/supabase.ts — Next.js App Router版 Supabase クライアント
 *
 * ⚠️ セキュリティルール:
 *   - NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY のみを使用
 *   - SERVICE_ROLE_KEY はサーバーサイド（api/ ディレクトリ）のみで使用
 *   - anon key は RLS (Row Level Security) によって保護されており、
 *     公開しても安全です（auth.uid() ベースのポリシーで制御）
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof window !== "undefined") {
    console.error(
      "[ProofMark] Supabase 環境変数が設定されていません。\n" +
        ".env.local.example を参考に .env.local を作成してください。"
    );
  }
}

/**
 * フロントエンド用 Supabase クライアント
 * RLS によって保護された操作のみ実行可能
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
