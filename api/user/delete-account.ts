export const config = { runtime: 'edge' };
import { json, supabaseAdmin, getAuthenticatedUserId } from '../_shared';

export default async function handler(request: Request) {
    if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

    try {
        // 🛡️ 退会するユーザー本人のIDを特定
        const userId = await getAuthenticatedUserId(request);

        // 1. ユーザーに紐づく全証明書のストレージパスを取得
        const { data: certs } = await supabaseAdmin
            .from('certificates')
            .select('id, storage_path')
            .eq('user_id', userId);

        if (certs && certs.length > 0) {
            const originalPaths = certs
                .map(c => c.storage_path)
                .filter((path): path is string => !!path);

            const publicPaths = certs.map(c => {
                const ext = c.storage_path?.split('.').pop() || 'webp';
                return `certificates/${c.id}.${ext}`;
            });

            // 🏎️ ストレージの全ファイルを一括削除
            if (originalPaths.length > 0) {
                await supabaseAdmin.storage.from('proofmark-originals').remove(originalPaths);
            }
            if (publicPaths.length > 0) {
                await supabaseAdmin.storage.from('proofmark-public').remove(publicPaths);
            }
            console.log(`[ProofMark] Cleanup storage for user: ${userId}`);
        }

        // 2. Authアカウントを削除（DB側のCASCADE設定により、profileやcertificatesも連動して消える）
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authError) throw authError;

        return json(200, { success: true, message: 'Account and all data deleted permanently.' });
    } catch (error: any) {
        console.error('[ProofMark] Account Delete Error:', error);
        return json(500, { error: error.message });
    }
}