/**
 * Supabase Admin クライアント（サーバーサイド専用）
 * Vercel 本番環境用に最適化済み
 */

import { createClient } from "@supabase/supabase-js";

// 1. dotenv 関連をすべて削除（Vercelでは環境変数が自動的に読み込まれるため）

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  // 本番環境のログに出力されるように
  console.error(
    "[ProofMark Admin] 環境変数が未設定です。Vercelダッシュボードの設定を確認してください。"
  );
}

/**
 * サーバーサイド専用 Supabase クライアント
 */
export const supabaseAdmin = createClient(
  supabaseUrl ?? "",
  serviceRoleKey ?? "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);