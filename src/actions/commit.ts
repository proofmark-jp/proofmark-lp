'use server';

import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@/utils/supabase/server';

// ---------------------------------------------------------------------------
// Zero-Knowledge S3 Client Initialization
// ---------------------------------------------------------------------------
// サーバーアクションの実行コンテキストでのみ初期化され、クライアントには絶対に漏洩しない
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export type CommitUploadInput = {
  sha256: string;
  objectKey: string;
  declaredSize: number;
};

export type CommitUploadResult = 
  | { success: true; isDuplicate?: boolean; certificateId?: string }
  | { success: false; error: string; retryable: boolean };

/**
 * The Two-Phase Commit Protocol (Server Action)
 * R2への物理オブジェクト配置とSupabaseへのDB打刻の間の量子的空隙を封鎖する
 */
export async function commitUploadAction(input: CommitUploadInput): Promise<CommitUploadResult> {
  try {
    const supabase = await createClient();

    // 1. Gatekeeper: 実行者の認証セッションを検証 (Zero-Trust)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'UNAUTHORIZED', retryable: false };
    }

    // 2. Phase 1: R2 の物理存在確認 (Zero-Knowledge)
    // ファイルの中身 (Body) は絶対に取得しない。メタデータのみで検証を完結させる。
    const head = await s3Client.send(new HeadObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: input.objectKey,
    })).catch(() => null);

    if (!head) {
      // 物理オブジェクトが存在しない場合、Orphan Object化を防ぐためリトライ可能エラーとして弾く
      return { success: false, error: 'R2_OBJECT_NOT_FOUND', retryable: true };
    }

    // 3. Phase 2: サイズ不一致検知
    // Multipart Upload 中断等の異常を検知し、不完全なファイルの証明書化を物理遮断
    if (head.ContentLength !== input.declaredSize) {
      return { success: false, error: 'SIZE_MISMATCH', retryable: false };
    }

    // 4. Phase 3: Supabase へのアトミック打刻
    // ON CONFLICT(sha256) DO NOTHING を内包する RPC を呼び出す
    const { data, error } = await supabase.rpc('atomic_certificate_commit', {
      p_sha256: input.sha256,
      p_object_key: input.objectKey,
      p_size_bytes: input.declaredSize,
      p_etag: head.ETag,
    });

    if (error) {
      // PostgreSQL 23505 (unique_violation) を検出した場合
      // "エラー" ではなく "既に暗号領域で保護されている" 正規ユースケースとして再定義
      if (error.code === '23505' || error.message.includes('duplicate key value')) {
        return { success: true, isDuplicate: true };
      }
      console.error('[Two-Phase Commit] DB Error:', error);
      return { success: false, error: `DB_COMMIT_FAILED`, retryable: true };
    }

    // RPC側で重複を吸収し、明示的なフラグを返却する設計にも対応 (Cryptographic Brutalism 適用)
    if (data && typeof data === 'object' && data.isDuplicate) {
      return { success: true, isDuplicate: true, certificateId: data.certificateId };
    }

    return { 
      success: true, 
      certificateId: data // RPCが正常完了時に返す UUID
    };

  } catch (err) {
    console.error('[Two-Phase Commit] Fatal Error:', err);
    return { success: false, error: 'INTERNAL_SERVER_ERROR', retryable: true };
  }
}