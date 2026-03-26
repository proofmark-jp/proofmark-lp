import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

// 🌟 Vercel特有の通信バグ（fetch failed）を回避する最強の特効薬
const supabaseAdmin = createClient(
  supabaseUrl || "https://dummy.supabase.co",
  serviceRoleKey || "dummy",
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: (...args) => fetch(...args) } // 👈 これが Vercel を安定させます！
  }
);

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif"
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POSTのみ対応" });

  try {
    const { filename, contentType, userId = "anon" } = req.body;

    if (!filename) return res.status(400).json({ error: "filename は必須です" });
    if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
      return res.status(400).json({ error: `許可されていない形式です: ${contentType}` });
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ error: "サーバーの設定エラー（環境変数）" });
    }

    const ext = filename.split(".").pop()?.toLowerCase() || "bin";
    const uuid = randomUUID();
    const storagePath = `${userId}/${uuid}.${ext}`;

    const { data, error } = await supabaseAdmin.storage
      .from("originals")
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      // 鍵の間違いがないかデバッグでヒントを出します
      const isLikelyWrongKey = !serviceRoleKey.includes("c2VydmljZV9yb2xl");

      return res.status(500).json({
        error: "アップロードURLの発行に失敗しました",
        supabase_error: error,
        hint: isLikelyWrongKey ? "⚠️ 鍵が間違っている可能性があります。'service_role' の鍵か再確認してください。" : "通信エラーの可能性があります"
      });
    }

    return res.status(200).json({
      success: true,
      signedUrl: data.signedUrl,
      storagePath: `originals/${storagePath}`,
    });

  } catch (err: any) {
    return res.status(500).json({
      error: "Internal Server Error",
      details: err?.message || String(err)
    });
  }
}