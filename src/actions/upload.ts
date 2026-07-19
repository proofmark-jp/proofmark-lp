"use server";

export const maxDuration = 300;

/**
 * src/actions/upload.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Direct-to-R2 Pipeline: The Authorization & Atomic Commit Engine (Apex Edition)
 *
 * ⚡ Absolute Defenses:
 * 1. Multi-Layer Authentication: Server Actionsは全て `auth.getUser()` で検証。
 * 2. RLS & RPC Domination: データの打刻は Service Role ではなく、ユーザーのJWTを
 *    持った標準クライアントから PostgreSQL の RPC を叩く。これにより、データベース層の
 *    RLS (Row Level Security) とトランザクション (Atomic) を強制発動させる。
 * 3. Safe UTF-8 Object Key: 日本語ファイル名を無傷で保存。
 */

import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2';
import { createClient } from '@/utils/supabase/server'; 

/**
 * ─────────────────────────────────────────────────────────────────────────
 * Action 1: getPresignedUrlAction
 * クライアントに R2 への直接 PUT を許可する「署名付きURL」を発行する。
 * ─────────────────────────────────────────────────────────────────────────
 */
export async function getPresignedUrlAction(
  fileName: string,
  mimeType: string,
  sha256: string
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Unauthorized: 署名付きURLを発行する権限がありません。ログインしてください。');
    }

    if (!fileName || !sha256) {
      throw new Error('ファイル名またはハッシュ値が欠落しています。');
    }

    // パストラバーサル攻撃を弾きつつ、日本語ファイル名は維持
    const safeFileName = fileName.replace(/[\/\\]/g, '_');
    const objectKey = `uploads/${sha256}/${Date.now()}_${safeFileName}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
      // クライアント(useForge.ts)が Blob に設定した type と完全に一致させる必要がある
      ContentType: mimeType, 
    });

    const presignedUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 });

    return {
      success: true,
      url: presignedUrl,
      objectKey: objectKey, // フロントエンドには返すが、改ざん防止のためDB打刻時はパスを再構築推奨
    };
  } catch (error) {
    console.error('[UploadAction: getPresignedUrl] 致命的エラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '署名付きURLの発行に失敗しました。',
    };
  }
}

/**
 * ─────────────────────────────────────────────────────────────────────────
 * Action 2: registerCertificateAction
 * R2への直接アップロード成功後、Supabase RPCを呼び出しアトミックに台帳を確定する。
 * (※ commitUploadAction からフロントエンドの実態に合わせてリネーム＆堅牢化)
 * ─────────────────────────────────────────────────────────────────────────
 */
export async function registerCertificateAction(input: {
  cid: string;
  sizeBytes: number;
  mimeType: string;
  objectKey: string;
  title?: string;
}) {
  try {
    const supabase = await createClient();
    
    // 🛡️ 認証チェック
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      throw new Error('Unauthorized: 台帳へ打刻する権限がありません。ログインしてください。');
    }

    if (!input.cid || !input.objectKey) {
      throw new Error('マスターハッシュまたはオブジェクトキーが欠落しています。');
    }

    // 🛡️ RPCによるアトミックトランザクション実行
    // ユーザーIDはフロントから受け取らず、PostgreSQL内部で auth.uid() により解決される
    const { data: certId, error: rpcErr } = await supabase.rpc('register_certificate_atomic', {
      p_cid: input.cid,
      p_title: input.title || 'Untitled Archive',
      p_size_bytes: input.sizeBytes,
      p_mime_type: input.mimeType,
      p_storage_key: input.objectKey
    });

    if (rpcErr || !certId) {
      throw new Error(`Atomic Transaction Failed: ${rpcErr?.message || 'Unknown DB error'}`);
    }

    return { 
      success: true, 
      certificateId: certId as string 
    };
  } catch (err: any) {
    console.error('[ServerAction Error]', err);
    return { 
      success: false, 
      error: err.message || 'データベースへのコミットに失敗しました。' 
    };
  }
}