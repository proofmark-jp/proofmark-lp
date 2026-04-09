import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as Sentry from "@sentry/node";
import { supabaseAdmin } from "./lib/supabase-admin";

Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  tracesSampleRate: 1.0,
});

/**
 * ADMIN専用: ユーザープラン更新 API
 * 
 * 注意: 本来はリクエストユーザーが本当にADMINかチェックするロジックが必要ですが、
 * 今回は Service Role Key を使用してメタデータを直接更新する機能を実装します。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    // 1. リクエスト送信者のトークンを取得
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ success: false, error: "Unauthorized: トークンがありません" });
    }
    const token = authHeader.replace('Bearer ', '');

    // 2. トークンから送信者の情報を検証
    const { data: { user: requestUser }, error: verifyError } = await supabaseAdmin.auth.getUser(token);

    if (verifyError || !requestUser) {
        return res.status(401).json({ success: false, error: "Unauthorized: 無効なトークンです" });
    }

    // 3. 送信者がADMIN権限を持っているかチェック
    if (requestUser.user_metadata?.plan_type !== 'admin') {
        return res.status(403).json({ success: false, error: "Forbidden: 管理者権限が必要です" });
    }

    const { userId, newPlan } = req.body;

    if (!userId || !newPlan) {
        return res.status(400).json({ success: false, error: "userId と newPlan は必須です" });
    }

    try {
        // 1. Auth メタデータを更新 (user_metadata.plan_type)
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { user_metadata: { plan_type: newPlan } }
        );

        if (authError) throw authError;

        // 2. Profile テーブルを更新 (plan_tier) - 同期させる
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ plan_tier: newPlan })
            .eq('id', userId);

        if (profileError) {
            console.warn("[Admin API] Profile update failed but Auth update succeeded:", profileError.message);
        }

        return res.status(200).json({
            success: true,
            message: `ユーザー ${userId} のプランを ${newPlan} に更新しました。`
        });

    } catch (err: any) {
        console.error("[Admin API] Error updating plan:", err);
        Sentry.captureException(err);
        await Sentry.flush(2000); // 🌟 追加: 送信完了まで最大2秒待機する
        return res.status(500).json({ success: false, error: err.message });
    }
}
