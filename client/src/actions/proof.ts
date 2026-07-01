"use server";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// R2 (S3互換) クライアントの初期化 (R2の仕様通り region は "auto")
const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

// サーバー権限でSupabaseを直接叩くためのAdminクライアント
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * 1. R2への直接アップロード用「署名付きURL」を発行する
 */
export async function getUploadPresignedUrl(fileName: string, fileType: string, fileSize: number) {
  try {
    // 50MBのハードリミット防衛 (フロントエンドのバリデーションと二重チェック)
    if (fileSize > 50 * 1024 * 1024) {
      throw new Error("ファイルサイズが50MBを超えています。");
    }

    // 👑 修正: 日本語ファイル名の蒸発を防ぎ、安全なURLエンコードを適用
    const safeFileName = encodeURIComponent(fileName);
    const uniqueId = crypto.randomUUID();
    const objectKey = `uploads/${uniqueId}-${safeFileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: fileType,
    });

    // 👑 修正: 不安定な回線でのアップロードクラッシュを物理的に防ぐため、余裕を持った15分(900秒)に設定
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    return { success: true, signedUrl, objectKey };
  } catch (error: any) {
    console.error("[ProofMark Action] Presigned URL Error:", error);
    return { success: false, error: error.message || "アップロードURLの発行に失敗しました" };
  }
}

/**
 * 2. アップロード完了後、SupabaseのQueueへ証明オーダーを刻印する
 */
export async function createProofOrder(payload: {
  userId: string;
  originalFileName: string;
  objectKey: string;
  fileHash: string; // クライアントで計算したSHA-256
}) {
  try {
    // Supabaseの 'proof_orders' (または video_queues) テーブルへINSERT
    const { data, error } = await supabaseAdmin
      .from('proof_orders')
      .insert({
        user_id: payload.userId,
        original_filename: payload.originalFileName,
        r2_object_key: payload.objectKey,
        original_hash: payload.fileHash,
        status: 'pending', // Mac mini (Oracle) がこれをポーリングして処理する
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, order: data };
  } catch (error: any) {
    console.error("[ProofMark Action] Create Order Error:", error);
    return { success: false, error: error.message || "証明オーダーの作成に失敗しました" };
  }
}