export const config = { runtime: 'edge' };
import { json, supabaseAdmin, getAuthenticatedUserId } from '../_shared.js';

async function chunkedRemove(bucket: string, paths: string[]) {
    const uniquePaths = [...new Set(paths)].filter(Boolean);
    if (uniquePaths.length === 0) return;
    const storage = supabaseAdmin.storage.from(bucket);
    for (let i = 0; i < uniquePaths.length; i += 100) {
        const chunk = uniquePaths.slice(i, i + 100);
        const { error } = await storage.remove(chunk);
        if (error) console.error(`[DeleteAccount] Storage remove error in ${bucket}:`, error.message);
    }
}

export default async function handler(request: Request) {
    if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

    try {
        const userId = await getAuthenticatedUserId(request);

        // 1. certificates のパス取得
        const { data: certs } = await supabaseAdmin
            .from('certificates')
            .select('id, storage_path')
            .eq('user_id', userId);

        // 2. process_bundle_steps のパス取得 (Chain of Evidence 用)
        const { data: steps } = await supabaseAdmin
            .from('process_bundle_steps')
            .select('storage_path, preview_url')
            .eq('user_id', userId);

        const originalPaths: string[] = [];
        const publicPaths: string[] = [];

        // certificates 分の仕分け
        if (certs) {
            for (const c of certs) {
                if (c.storage_path) originalPaths.push(c.storage_path);
                const ext = c.storage_path?.split('.').pop() || 'webp';
                publicPaths.push(`certificates/${c.id}.${ext}`); // レガシー対応
            }
        }

        // steps 分の仕分け
        if (steps) {
            for (const s of steps) {
                if (s.storage_path) originalPaths.push(s.storage_path);
                if (s.preview_url && s.preview_url.includes('/proofmark-public/')) {
                    const path = s.preview_url.split('/proofmark-public/')[1];
                    if (path) publicPaths.push(path);
                }
            }
        }

        // 3. チャンク処理で完全削除
        await Promise.all([
            chunkedRemove('proofmark-originals', originalPaths),
            chunkedRemove('proofmark-public', publicPaths)
        ]);
        console.log(`[ProofMark] Cleanup storage for user: ${userId}. Originals: ${originalPaths.length}, Public: ${publicPaths.length}`);

        // 4. Authアカウントを削除（DBのCASCADE発火）
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authError) throw authError;

        return json(200, { success: true, message: 'Account and all data deleted permanently.' });
    } catch (error: any) {
        console.error('[ProofMark] Account Delete Error:', error);
        return json(500, { error: error.message });
    }
}