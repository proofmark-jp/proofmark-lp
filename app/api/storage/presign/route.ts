import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'edge';

const S3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// Edge領域での簡易インメモリRate Limit（Vercel Edgeの同一アイソレート内でのスパム防止）
const rateLimitCache = new Map<string, number>();

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED_ACCESS' }), { status: 401 });
    }

    // 1. レートリミット検証 (1ユーザーあたり10秒に1回以上の連続リクエストを物理遮断)
    const now = Date.now();
    const lastRequest = rateLimitCache.get(user.id) || 0;
    if (now - lastRequest < 10000) {
      return new Response(JSON.stringify({ error: 'RATE_LIMIT_EXCEEDED' }), { status: 429 });
    }
    rateLimitCache.set(user.id, now);

    const { cid, contentType } = await req.json();
    
    if (!cid || !/^sha256:[a-f0-9]{64}$/.test(cid) || !contentType) {
      return new Response(JSON.stringify({ error: 'INVALID_PAYLOAD' }), { status: 400 });
    }

    // 2. R2 署名付きURL生成
    const objectKey = `timelines/${user.id}/${cid.replace('sha256:', '')}.webp`;
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: objectKey,
      ContentType: contentType,
      // Metadataを付与しておくことで、将来のR2 Lifecycle Ruleでの判定に利用可能
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