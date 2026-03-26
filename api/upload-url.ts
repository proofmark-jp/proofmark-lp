import type { VercelRequest, VercelResponse } from "@vercel/node";
// 1. dotenv 関連のインポートと設定をすべて削除！ (Vercelでは不要)
import { supabaseAdmin } from "./lib/supabase-admin";
import { randomUUID } from "node:crypto";

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  // SVGはやめるという方針だったので削除
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 対策（念のため）
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Only POST requests are supported" });
  }

  try {
    const { filename, contentType, userId = "anon" } = req.body;

    if (!filename) return res.status(400).json({ success: false, error: "filename は必須です" });

    // バリデーション
    if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
      return res.status(400).json({
        success: false,
        error: `許可されていない形式です: ${contentType}`
      });
    }

    const ext = filename.split(".").pop()?.toLowerCase() || "bin";
    const uuid = randomUUID();
    const storagePath = `${userId}/${uuid}.${ext}`;

    // 署名付きアップロードURLの発行（originals バケットを使用）
    const { data, error } = await supabaseAdmin.storage
      .from("originals")
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      console.error("[upload-url] Supabase error:", error);
      return res.status(500).json({
        success: false,
        error: "Supabaseへの接続に失敗しました。環境変数が正しいか確認してください。"
      });
    }

    return res.status(200).json({
      success: true,
      signedUrl: data.signedUrl,
      storagePath: `originals/${storagePath}`,
    });
  } catch (err) {
    console.error("[upload-url] Internal error:", err);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}