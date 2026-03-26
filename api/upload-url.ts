import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

// ------------------------------------------------------------------
// 1. 環境変数の「見えない空白・改行」を強制的に削ぎ落とす (trim)
// ------------------------------------------------------------------
const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseUrl = rawUrl.trim();
const serviceRoleKey = rawKey.trim();

// 安全装置付きでクライアント初期化
const supabaseAdmin = createClient(
  supabaseUrl || "https://dummy.supabase.co",
  serviceRoleKey || "dummy",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ------------------------------------------------------------------
// 2. 許可する画像フォーマット
// ------------------------------------------------------------------
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif"
]);

// ------------------------------------------------------------------
// 3. メインのAPI処理
// ------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("=== API Start ===");
  console.log("Method:", req.method);
  // URLが正しく認識されているか、文字数も一緒に出力して確認
  console.log("URL length:", supabaseUrl.length, "Key length:", serviceRoleKey.length);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POSTのみ対応" });

  try {
    const { filename, contentType, userId = "anon" } = req.body;

    if (!filename) return res.status(400).json({ error: "filename は必須です" });
    if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
      return res.status(400).json({ error: `許可されていない形式です: ${contentType}` });
    }

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Fatal: Supabase keys are missing in Vercel!");
      return res.status(500).json({ error: "サーバーの設定エラー（環境変数）" });
    }

    const ext = filename.split(".").pop()?.toLowerCase() || "bin";
    const uuid = randomUUID();
    const storagePath = `${userId}/${uuid}.${ext}`;

    const { data, error } = await supabaseAdmin.storage
      .from("originals")
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      console.error("Supabase Storage Error:", error);
      return res.status(500).json({ error: "アップロードURLの発行に失敗しました" });
    }

    console.log("=== API Success ===");
    return res.status(200).json({
      success: true,
      signedUrl: data.signedUrl,
      storagePath: `originals/${storagePath}`,
    });

  } catch (err) {
    console.error("Fatal API Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}