// src/actions/upload.ts
// =============================================================================
// 👑 THE SOVEREIGN ARCHITECT: src/actions/upload.ts
// Phase 1.8: Direct-to-R2 Pipeline & Multipart Reaper Integration
// 目的: Blueprint §VII.2, §VII.3, §VII.4 に基づき、VercelコンテナのRAMを保護し、
//       5GB超えのファイルの安全な分割アップロードと孤児化（課金爆発）防止を実装する。
// =============================================================================

'use server';

import { 
  S3Client, 
  PutObjectCommand, 
  CreateMultipartUploadCommand, 
  UploadPartCommand, 
  CompleteMultipartUploadCommand 
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// --- Configuration & Clients ---
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
// Blueprint §XII.2: Originals Bucket
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'proofmark-originals';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// 孤児セッション管理（r2_multipart_sessions）のため、Service Role KeyでRLSをバイパスするAdmin Client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * 送信者の認証状態を確認する（Server Actionsの保護層）
 */
async function requireAuth(): Promise<string> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
  
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('UNAUTHORIZED: Authentication required.');
  return user.id;
}

// --- Action 1: Standard Presigned PUT (< 5GB) ---
export async function getPresignedUploadUrl(objectKey: string, contentType: string, sizeBytes: number) {
  await requireAuth();
  
  // Blueprint §VII.3: The 5GB S3 PUT Guillotine (上限チェック)
  if (sizeBytes > 5 * 1024 * 1024 * 1024) {
    throw new Error('PAYLOAD_TOO_LARGE: Use multipart upload for files > 5GB.');
  }

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: objectKey,
    ContentType: contentType,
    ContentLength: sizeBytes,
  });

  // Blueprint §XII.2: Presigned URLの有効期限を900秒(15分)に短縮
  const url = await getSignedUrl(s3Client, command, { expiresIn: 900 });
  return { success: true, url };
}

// --- Action 2: Initiate Multipart Upload (>= 5GB) & Reaper Logging ---
export async function initiateMultipartUpload(objectKey: string, contentType: string, expectedParts: number) {
  const userId = await requireAuth();

  const command = new CreateMultipartUploadCommand({
    Bucket: R2_BUCKET,
    Key: objectKey,
    ContentType: contentType,
  });

  const response = await s3Client.send(command);
  const uploadId = response.UploadId;

  if (!uploadId) throw new Error('Failed to initiate multipart upload.');

  // Blueprint §VII.4: The Multipart Orphan Storm & Reaper 台帳への打刻
  const { error } = await supabaseAdmin.from('r2_multipart_sessions').insert({
    upload_id: uploadId,
    object_key: objectKey,
    bucket: R2_BUCKET,
    user_id: userId,
    parts_expected: expectedParts,
    status: 'active'
  });

  if (error) {
    throw new Error(`Failed to log multipart session: ${error.message}`);
  }

  return { success: true, uploadId };
}

// --- Action 3: Generate Presigned URLs for Multipart chunks ---
export async function getMultipartPreSignedUrls(uploadId: string, objectKey: string, partNumbers: number[]) {
  await requireAuth();

  const urls = await Promise.all(
    partNumbers.map(async (partNumber) => {
      const command = new UploadPartCommand({
        Bucket: R2_BUCKET,
        Key: objectKey,
        UploadId: uploadId,
        PartNumber: partNumber,
      });
      // チャンク単位のURLも時限付き（900秒）
      const url = await getSignedUrl(s3Client, command, { expiresIn: 900 });
      return { partNumber, url };
    })
  );

  return { success: true, urls };
}

// --- Action 4: Heartbeat for Active Multipart Session ---
export async function heartbeatMultipartSession(uploadId: string, partsUploaded: number) {
  await requireAuth();

  // Blueprint §VII.4: pg_cron Reaperの自動Abortを回避するため、チャンク成功ごとにハートビートを刻む
  const { error } = await supabaseAdmin.from('r2_multipart_sessions')
    .update({ 
      last_heartbeat_at: new Date().toISOString(),
      parts_uploaded: partsUploaded
    })
    .eq('upload_id', uploadId)
    .eq('status', 'active');

  if (error) throw new Error('Heartbeat failed');
  return { success: true };
}

// --- Action 5: Complete Multipart Upload ---
export async function completeMultipartUpload(uploadId: string, objectKey: string, parts: { ETag: string, PartNumber: number }[]) {
  await requireAuth();

  // S3への完了通知
  const command = new CompleteMultipartUploadCommand({
    Bucket: R2_BUCKET,
    Key: objectKey,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts },
  });

  await s3Client.send(command);

  // 台帳のステータスを完了に更新 (Reaperの課金爆発防止対象から外す)
  const { error } = await supabaseAdmin.from('r2_multipart_sessions')
    .update({ status: 'completed' })
    .eq('upload_id', uploadId);
    
  if (error) throw new Error('Failed to update session status to completed');

  return { success: true };
}