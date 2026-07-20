import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'edge';

const S3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const rateLimitCache = new Map<string, number>();

// 👑 許容する最大ファイルサイズ (例: 500MB)
// 500 * 1024 * 1024 = 524,288,000 bytes
const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED_ACCESS' }), { status: 401 });
    }

    // 1. レートリミット検証
    const now = Date.now();
    const lastRequest = rateLimitCache.get(user.id) || 0;
    if (now - lastRequest < 10000) {
      return new Response(JSON.stringify({ error: 'RATE_LIMIT_EXCEEDED' }), { status: 429 });
    }
    rateLimitCache.set(user.id, now);

    // 👑 sizeBytes をペイロードから受け取るように追加
    const { cid, contentType, sizeBytes } = await req.json();
    
    if (!cid || !/^sha256:[a-f0-9]{64}$/.test(cid) || !contentType) {
      return new Response(JSON.stringify({ error: 'INVALID_PAYLOAD' }), { status: 400 });
    }

    // 👑 2. 兵糧攻め（巨大ファイル）の物理遮断
    if (!sizeBytes || typeof sizeBytes !== 'number' || sizeBytes > MAX_FILE_SIZE_BYTES) {
      return new Response(JSON.stringify({ 
        error: `PAYLOAD_TOO_LARGE: File size must be under ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.` 
      }), { status: 413 });
    }

    // 3. R2 署名付きURL生成
    const objectKey = `timelines/${user.id}/${cid.replace('sha256:', '')}.webp`;
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: objectKey,
      ContentType: contentType,
      Metadata: { 'proofmark-status': 'pending' } 
    });

    const signedUrl = await getSignedUrl(S3, command, { expiresIn: 60 });

    return new Response(JSON.stringify({ signedUrl, objectKey }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}