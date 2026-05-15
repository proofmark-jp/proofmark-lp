/**
 * api/admin-vercel-deployments.ts — Vercel deployment info (admin only)
 *
 * Fail-safe RBAC:
 *  - JWT verified via Supabase Service Role
 *  - admin_users table consulted — any DB error → 403
 *  - user_metadata is NEVER trusted
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const VERCEL_TOKEN = process.env.VERCEL_API_TOKEN ?? '';
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID ?? '';
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID ?? '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 1. JWT 検証
        const authHeader = (req.headers.authorization as string) || '';
        if (!/^Bearer\s+[\w-]+\.[\w-]+\.[\w-]+$/.test(authHeader)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const token = authHeader.slice(7);

        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
        });

        // 2. トークン検証
        const { data: { user }, error: verifyError } = await supabaseAdmin.auth.getUser(token);
        if (verifyError || !user) return res.status(401).json({ error: 'Unauthorized' });

        // 3. DBレベルの管理者ホワイトリスト照会
        const { data: isAdmin, error: dbErr } = await supabaseAdmin
            .from('admin_users')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle();

        if (dbErr || !isAdmin) {
            return res.status(403).json({ error: 'Forbidden: Admin access restricted' });
        }

        // 4. Vercel API からデプロイ一覧を取得
        if (!VERCEL_TOKEN) {
            return res.status(503).json({ error: 'Vercel API token not configured' });
        }

        const params = new URLSearchParams({ limit: '20' });
        if (VERCEL_TEAM_ID) params.set('teamId', VERCEL_TEAM_ID);
        if (VERCEL_PROJECT_ID) params.set('projectId', VERCEL_PROJECT_ID);

        const vercelRes = await fetch(`https://api.vercel.com/v6/deployments?${params.toString()}`, {
            headers: {
                Authorization: `Bearer ${VERCEL_TOKEN}`,
                'Content-Type': 'application/json',
            },
        });

        if (!vercelRes.ok) {
            const body = await vercelRes.text();
            console.error('[admin-vercel-deployments] Vercel API error:', vercelRes.status, body);
            return res.status(502).json({ error: 'Vercel API error', status: vercelRes.status });
        }

        const data = await vercelRes.json();
        return res.status(200).json(data);

    } catch (error: any) {
        console.error('[admin-vercel-deployments] Error:', error?.message || error);
        return res.status(500).json({ error: 'Internal error' });
    }
}
