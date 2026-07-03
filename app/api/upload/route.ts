import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@/utils/supabase/server';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error('FATAL ERROR: R2 Environment variables are missing.');
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: Request) {
  try {
    // 【絶対防衛】フロントからの自己申告トークン（Bearer）は無視。サーバーCookieから直接特定。
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired session.' }, { status: 401 });
    }

    const body = await req.json();
    const { contentType } = body;

    if (!contentType || (!contentType.includes('video/mp4') && !contentType.includes('video/quicktime'))) {
      return NextResponse.json({ error: 'Bad Request: Only MP4 or MOV files are allowed.' }, { status: 400 });
    }

    const fileExtension = contentType.includes('mp4') ? 'mp4' : 'mov';
    const objectKey = `uploads/${user.id}/${crypto.randomUUID()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: contentType,
    });

    // 15分（900秒）限定の署名付きURL
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    return NextResponse.json({ url: signedUrl, key: objectKey }, { status: 200 });

  } catch (error: unknown) {
    console.error('[Upload API] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}