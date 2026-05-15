/**
 * api/admin-update-plan.ts — Server-side RBAC via admin_users table
 *
 * Fail-safe design:
 *  - Verifies caller JWT via Supabase Auth (Service Role)
 *  - Checks admin_users table with Service Role (unreachable by anon/user keys)
 *  - Any DB error → 403 (never 500 leak)
 *  - user_metadata is NEVER trusted for authorization
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[admin-update-plan] Missing required env vars');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const reqId = randomUUID();
    res.setHeader('x-request-id', reqId);

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed', reqId });
    }

    try {
        // 1. JWT 検証
        const authHeader = (req.headers.authorization as string) || '';
        if (!/^Bearer\s+[\w-]+\.[\w-]+\.[\w-]+$/.test(authHeader)) {
            return res.status(401).json({ success: false, error: 'Missing or malformed Authorization header', reqId });
        }
        const jwt = authHeader.slice(7);

        // 2. Service Role クライアントでトークンを検証
        const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: { user: requestUser }, error: authErr } = await adminClient.auth.getUser(jwt);
        if (authErr || !requestUser) {
            return res.status(401).json({ success: false, error: 'Invalid session', reqId });
        }

        // 3. 管理者テーブル（admin_users）による厳格なDBレベル検証
        // user_metadata はブラウザから改ざん可能なため、絶対に信用しない
        const { data: adminCheck, error: adminErr } = await adminClient
            .from('admin_users')
            .select('user_id')
            .eq('user_id', requestUser.id)
            .maybeSingle();

        if (adminErr || !adminCheck) {
            console.error(`[AdminAuth] Unauthorized attempt by: ${requestUser.id}`);
            return res.status(403).json({ success: false, error: 'Forbidden: データベースレベルで管理者権限が確認できません', reqId });
        }

        // 4. リクエストボディのバリデーション
        const { targetUserId, newPlan } = req.body as { targetUserId?: string; newPlan?: string };
        const VALID_PLANS = ['free', 'creator', 'studio', 'business', 'light'];

        if (!targetUserId || typeof targetUserId !== 'string') {
            return res.status(400).json({ success: false, error: 'targetUserId is required', reqId });
        }
        if (!newPlan || !VALID_PLANS.includes(newPlan)) {
            return res.status(400).json({ success: false, error: `newPlan must be one of: ${VALID_PLANS.join(', ')}`, reqId });
        }

        // 5. 対象ユーザーのプランを更新
        const { error: updateErr } = await adminClient
            .from('profiles')
            .update({ plan_tier: newPlan })
            .eq('id', targetUserId);

        if (updateErr) {
            console.error(`[admin-update-plan] DB update failed for ${targetUserId}:`, updateErr);
            return res.status(500).json({ success: false, error: 'Failed to update plan', reqId });
        }

        console.log(JSON.stringify({
            reqId,
            event: 'admin.plan_updated',
            adminId: requestUser.id,
            targetUserId,
            newPlan,
        }));

        return res.status(200).json({ success: true, targetUserId, newPlan, reqId });

    } catch (error: any) {
        console.error(JSON.stringify({ reqId, event: 'admin.plan_update_error', message: String(error?.message || error) }));
        return res.status(500).json({ success: false, error: 'Internal error', reqId });
    }
}
