'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

interface RegisterInput {
  cid: string;
  sizeBytes: number;
  mimeType: string;
  title?: string;
}

export async function registerCertificateAction(input: RegisterInput) {
  try {
    const supabase = await createClient();
    
    // 1. 認証チェック
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error('UNAUTHORIZED_ACTION');

    // 2. PostgreSQLのRPCを1回だけ呼び出し、証明書とQueueのアトミック作成を強制
    // p_user_id は渡さない。DB側がリクエストヘッダーのJWTから自動抽出する。
    const { data: certId, error: rpcErr } = await supabase.rpc('register_certificate_atomic', {
      p_cid: input.cid,
      p_title: input.title,
      p_size_bytes: input.sizeBytes,
      p_mime_type: input.mimeType
    });

    if (rpcErr || !certId) throw new Error(`ATOMIC_TRANSACTION_FAILED: ${rpcErr?.message}`);

    revalidatePath('/dashboard');
    return { success: true, certificateId: certId as string };
  } catch (err: any) {
    console.error('[ServerAction Error]', err);
    return { success: false, error: err.message };
  }
}