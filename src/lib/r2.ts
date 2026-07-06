/**
 * src/lib/r2.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Cloudflare R2 Client Initialization (The Apex Infrastructure)
 *
 * ⚡ Absolute Defenses:
 * 1. Fail-Fast Validation: 起動時に環境変数を監査し、欠落があれば即座に物理停止させる。
 * (本番環境での「原因不明のアップロード失敗」というサイレントエラーをゼロ化)
 * 2. Singleton Connection Pool: Next.jsのHMR（Hot Module Replacement）や
 * Serverless関数実行時のメモリリークを防ぐため、globalThis を用いて
 * S3Client インスタンスを単一化し、コネクションプールを保護する。
 * 3. Vercel Egress Zero: Region 'auto' と Cloudflare エンドポイントにより、
 * AWS S3 のような高額なデータ転送コスト（Egress）を完全に無力化する。
 */

import { S3Client } from '@aws-sdk/client-s3';

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

// 🛡️ 防衛線 1: Fail-Fast (環境変数の欠落を許さない)
if (!accountId || !accessKeyId || !secretAccessKey || !R2_BUCKET_NAME) {
  throw new Error(
    'CRITICAL: Cloudflare R2 の環境変数 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) が設定されていません。'
  );
}

const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

// 🛡️ 防衛線 2: Singleton Connection Pool (Next.js環境でのメモリリーク防止)
const globalForS3 = globalThis as unknown as { s3Client: S3Client | undefined };

export const r2Client =
  globalForS3.s3Client ??
  new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    // R2に対するリクエストは通常S3互換APIのpath-styleを要求されないことが多いが、
    // 安定性を極限まで高めるためデフォルトのV4署名と仮想ホストベースのルーティングを利用
  });

if (process.env.NODE_ENV !== 'production') {
  globalForS3.s3Client = r2Client;
}