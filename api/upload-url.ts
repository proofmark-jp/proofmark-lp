import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { requireUser, methodGuard, json, HttpError } from './_lib/server.js';

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
  "image/avif",
  "image/heic",
  "image/heif"
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!methodGuard(req, res, ['POST'])) return;

  try {
    const user = await requireUser(req);
    const { filename, contentType } = req.body;
    const userId = user.id;

    if (!filename) return json(res, 400, { error: "filename は必須です" });
    if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
      return json(res, 400, { error: `許可されていない形式です: ${contentType}` });
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return json(res, 500, { error: "サーバーの設定エラー（環境変数）" });
    }

    const ext = filename.split(".").pop()?.toLowerCase() || "bin";
    const uuid = randomUUID();
    const storagePath = `${userId}/${uuid}.${ext}`;

    // 認証バイパスの排除: originals -> proofmark-originals への修正
    const { data, error } = await supabaseAdmin.storage
      .from("proofmark-originals")
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      // 鍵の間違いがないかデバッグでヒントを出します
      const isLikelyWrongKey = !serviceRoleKey.includes("c2VydmljZV9yb2xl");

      return json(res, 500, {
        error: "アップロードURLの発行に失敗しました",
        supabase_error: error,
        hint: isLikelyWrongKey ? "⚠️ 鍵が間違っている可能性があります。'service_role' の鍵か再確認してください。" : "通信エラーの可能性があります"
      });
    }

    return json(res, 200, {
      success: true,
      signedUrl: data.signedUrl,
      storagePath: `proofmark-originals/${storagePath}`,
    });

  } catch (err: any) {
    if (err instanceof HttpError) {
        return json(res, err.status, { error: err.message });
    }
    return json(res, 500, {
      error: "Internal Server Error",
      details: err?.message || String(err)
    });
  }
}