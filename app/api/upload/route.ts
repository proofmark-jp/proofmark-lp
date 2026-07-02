import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@supabase/supabase-js';

// 1. 環境変数の絶対検証（インフラの結線確認）
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('FATAL: Infrastructure environment variables are missing.');
}

// 2. R2 (S3互換) クライアントの初期化
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export async function POST(req: Request) {
  try {
    // 3. サーバーサイド絶対認証 (The Auth Guard)
    // フロントエンドから送信された Authorization ヘッダー（Bearer トークン）を検証
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized: Missing Auth Header' }, { status: 401 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid Session' }, { status: 401 });
    }

    // 4. リクエストボディのパースとMIMEタイプ厳格検証
    const body = await req.json();
    const { contentType } = body;

    // MP4とMOV以外の拡張子偽装アップロードをサーバーサイドで物理遮断
    if (!contentType || (!contentType.includes('video/mp4') && !contentType.includes('video/quicktime'))) {
      return NextResponse.json({ error: 'Bad Request: Invalid file type. Only MP4 and MOV are allowed.' }, { status: 400 });
    }

    // 5. 強制UUIDリネーム (The Isolation)
    // ファイル名の衝突とディレクトリトラバーサル攻撃を防ぐため、ランダムなUUIDへ強制変換
    const fileExtension = contentType.includes('mp4') ? 'mp4' : 'mov';
    const objectKey = `uploads/${user.id}/${crypto.randomUUID()}.${fileExtension}`;

    // 6. R2 署名付きURLの発行 (寿命: 15分 = 900秒)
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: contentType,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    // フロントエンドへ1回限りの通行証（URL）と保存先キーを返却
    return NextResponse.json({
      url: signedUrl,
      key: objectKey,
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[Upload API] Error generating presigned URL:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}