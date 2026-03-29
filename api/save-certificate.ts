import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// 環境変数のトリムとスラッシュ削除
const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

// Vercel安定化オプション付きクライアント
const supabaseAdmin = createClient(
    supabaseUrl || "https://dummy.supabase.co",
    serviceRoleKey || "dummy",
    {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { fetch: (...args) => fetch(...args) }
    }
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Only POST allowed" });
    }

    try {
        // 🌟 修正: フロントエンドから `filename` も受け取るようにした
        const { storagePath, userId = "anon", fileHash, filename } = req.body;

        // fileHash と storagePath が送られてきていない場合はエラーを返す
        if (!storagePath || !fileHash) {
            return res.status(400).json({ success: false, error: "storagePath と fileHash は必須です" });
        }

        if (!supabaseUrl || !serviceRoleKey) {
            return res.status(500).json({ success: false, error: "サーバーの設定エラー（環境変数）" });
        }

        // 3. データベース保存
        const safeUserId = userId === "anon" ? null : userId;

        // 公開URLを生成
        const fileUrl = `${supabaseUrl}/storage/v1/object/public/${storagePath}`;
        // 🌟 修正: ファイル名がない場合は「Untitled」にする
        const safeFileName = filename || "Untitled";

        const { data: insertData, error: dbError } = await supabaseAdmin
            .from("certificates")
            .insert({
                user_id: safeUserId,
                file_hash: fileHash,
                storage_path: storagePath,
                file_url: fileUrl,
                file_name: safeFileName, // 🌟 これを追加！
            })
            .select()
            .single();

        if (dbError) {
            console.error("[save-certificate] DB insert error:", dbError);
            if (dbError.code === "23505") {
                return res.status(409).json({
                    success: false,
                    error: "この作品は既に著作権証明が発行されています（重複）"
                });
            }
            return res.status(500).json({ success: false, error: "データベースへの保存に失敗しました" });
        }

        // 4. 成功レスポンス
        return res.status(200).json({
            success: true,
            message: "証明書の保存が完了しました",
            certificate: insertData,
        });

    } catch (err: any) {
        console.error("[save-certificate] Unexpected error:", err);
        return res.status(500).json({ success: false, error: "Internal server error" });
    }
}