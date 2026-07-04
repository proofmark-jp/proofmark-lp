/**
 * Supabase クライアント（フロントエンド用）
 *
 * ⚠️ セキュリティルール:
 *   - VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY のみを使用
 *   - SERVICE_ROLE_KEY はサーバーサイド（api/ ディレクトリ）のみで使用
 *   - anon key は RLS (Row Level Security) によって保護されており、
 *     公開しても安全です（auth.uid() ベースのポリシーで制御）
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "[ProofMark] Supabase 環境変数が設定されていません。\n" +
      ".env.local.example を参考に .env.local を作成してください。"
  );
}

/**
 * フロントエンド用 Supabase クライアント
 * RLS によって保護された操作のみ実行可能
 */
export const supabase = createClient(
  supabaseUrl ?? "",
  supabaseAnonKey ?? "",
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);

/**
 * Database型定義（将来の型安全性のため）
 * Supabase CLI で生成する場合: supabase gen types typescript --local > src/lib/database.types.ts
 */
export type Database = {
  public: {
    Tables: {
      certificates: {
        Row: {
          id: string;
          user_id: string;
          file_hash: string;
          storage_path: string | null;
          cert_url: string | null;
          metadata: Record<string, unknown>;
          status: "pending" | "processing" | "completed" | "failed";
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["certificates"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["certificates"]["Insert"]
        >;
      };
      early_registrations: {
        Row: {
          id: string;
          email: string;
          plan_interest: string | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["early_registrations"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["early_registrations"]["Insert"]
        >;
      };
    };
  };
};
