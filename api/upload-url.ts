/**
 * api/upload-url.ts — Quarantine Signed Upload URL Issuer
 *
 * - proofmark-originals/quarantine/{userId}/{uuid}.{ext} のみ発行
 * - 本番領域 (certificates/) には絶対に発行しない
 * - 期限切れの quarantine は別ジョブで掃除する (TTL 24h を後段で運用)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { requireUser, methodGuard, json, HttpError } from './_lib/server.js';

const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const supabaseAdmin = createClient(
  supabaseUrl || 'https://dummy.supabase.co',
  serviceRoleKey || 'dummy',
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: (...args) => fetch(...args as Parameters<typeof fetch>) },
  },
);

/** quarantine では「あらゆる形式」を許す。本番領域 (shareable) でのみ画像種別を絞る方針に変更。 */
const ALLOWED_CONTENT_TYPES_HINT: ReadonlyArray<string> = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
  'image/heic', 'image/heif',
  'application/pdf', 'application/zip', 'application/octet-stream',
  'video/mp4', 'video/webm',
];

const BUCKET = 'proofmark-originals';
const QUARANTINE_PREFIX = 'quarantine';
const SIGNED_URL_TTL_SEC = 60 * 10; // 10 min (大型ファイル想定で十分な余裕)
const MAX_DECLARED_SIZE = 500 * 1024 * 1024; // 500MB

interface UploadUrlBody {
  filename?: string;
  contentType?: string;
  /** クライアントが申告するサイズ。大きすぎる場合は早期 reject。 */
  size?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (!methodGuard(req, res, ['POST'])) return;

  try {
    const user = await requireUser(req);
    const body = (req.body ?? {}) as UploadUrlBody;
    const filename = (body.filename ?? '').toString();
    const contentType = (body.contentType ?? '').toString();
    const declaredSize = Number.isFinite(body.size) ? Number(body.size) : 0;

    if (!supabaseUrl || !serviceRoleKey) {
      json(res, 500, { error: 'サーバーの設定エラー（環境変数）' });
      return;
    }
    if (!filename) {
      json(res, 400, { error: 'filename は必須です' });
      return;
    }
    if (!contentType) {
      json(res, 400, { error: 'contentType は必須です' });
      return;
    }
    // 警告のみ。MIME 偽装は最終的に create.ts の stat で検出する。
    if (!ALLOWED_CONTENT_TYPES_HINT.includes(contentType)) {
      // ハードリジェクトしない（将来の拡張を阻害しないため）
    }
    if (declaredSize < 0 || declaredSize > MAX_DECLARED_SIZE) {
      json(res, 413, { error: 'declared size out of range (0 .. 500MB)' });
      return;
    }

    const ext = (filename.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
    const uuid = randomUUID();
    const quarantinePath = `${QUARANTINE_PREFIX}/${user.id}/${uuid}.${ext}`;

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(quarantinePath);

    if (error || !data) {
      json(res, 500, {
        error: 'アップロードURLの発行に失敗しました',
        details: error?.message ?? null,
      });
      return;
    }

    json(res, 200, {
      success: true,
      // 直接 PUT する URL (Supabase が発行する一意 URL)
      signedUrl: data.signedUrl,
      // 後で create.ts に渡す内部パス。bucket を含めない (内部 SDK で move するため)
      bucket: BUCKET,
      quarantinePath,
      ttlSeconds: SIGNED_URL_TTL_SEC,
    });
  } catch (err) {
    if (err instanceof HttpError) {
      json(res, err.status, { error: err.message });
      return;
    }
    json(res, 500, {
      error: 'Internal Server Error',
      details: err instanceof Error ? err.message : String(err),
    });
  }
}
