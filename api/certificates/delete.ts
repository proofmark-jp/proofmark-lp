export const config = { runtime: 'edge' };
import { json, supabaseAdmin, getAuthenticatedUserId } from '../_shared';

export default async function handler(request: Request) {
    if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

    try {
        const { id } = await request.json();
        if (!id) return json(400, { error: 'Certificate ID is required' });

        // 🛡️ リクエストしたユーザーの認証情報を取得
        const userId = await getAuthenticatedUserId(request);

        // 1. 対象の証明書を取得（所有者確認とファイルパスの特定）
        const { data: cert, error: fetchError } = await supabaseAdmin
            .from('certificates')
            .select('id, user_id, storage_path')
            .eq('id', id)
            .single();

        if (fetchError || !cert) return json(404, { error: 'Certificate not found' });

        // 🛡️ IDOR対策：自分以外の証明書は絶対に消せない
        if (cert.user_id !== userId) return json(403, { error: 'Forbidden. You do not own this certificate.' });

        // 2. データベースからレコードを削除
        const { error: deleteError } = await supabaseAdmin
            .from('certificates')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        // 3. ストレージから実体ファイルを削除（Shareableモードの場合のみ）
        if (cert.storage_path) {
            // storage_path から拡張子を抽出し、Publicバケツ側のパスも計算する
            const ext = cert.storage_path.split('.').pop() || 'webp';
            const publicPreviewPath = `certificates/${id}.${ext}`;

            // 🏎️ 並列処理で原本とプレビューの両方を一気に削除
            await Promise.all([
                supabaseAdmin.storage.from('proofmark-originals').remove([cert.storage_path]),
                supabaseAdmin.storage.from('proofmark-public').remove([publicPreviewPath])
            ]);

            console.log(`[ProofMark] Storage cleanup completed for ${id}`);
        }

        return json(200, { success: true });
    } catch (error: any) {
        console.error('[ProofMark] Delete API Error:', error);
        return json(500, { error: error.message });
    }
}