/**
 * ─────────────────────────────────────────────────────────────────────────────
 * app/api/cron/multipart-abort/route.ts
 * Blueprint §VII.4 — ProofMark R2 Orphan Multipart Reaper
 *
 * Trigger:   Vercel Cron (GET)
 * Security:  Authorization: Bearer ${CRON_SECRET} — 不一致で即 401
 * Runtime:   nodejs (AWS SDK v3 完全互換)
 * Batch:     LIMIT 50 / run — Vercel 300 s タイムアウトギロチン防衛
 * Atomicity: for...of + 個別 try-catch — Promise.all 絶対禁止
 *            R2 Abort 成功時のみ DB を 'reaped' へ更新する
 * RLS:       SUPABASE_SERVICE_ROLE_KEY で完全バイパス
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextResponse } from 'next/server';
import {
  S3Client,
  AbortMultipartUploadCommand,
  type AbortMultipartUploadCommandInput,
} from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

// ── Runtime 宣言 ──────────────────────────────────────────────────────────────
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── バッチ上限（Vercel タイムアウトギロチン防衛） ──────────────────────────────
const REAP_BATCH_LIMIT = 50;

// ── r2_multipart_sessions テーブルの行型 ────────────────────────────────────
interface MultipartSession {
  upload_id: string;    // PRIMARY KEY / R2 UploadId
  object_key: string;   // R2 Object Key (パス)
  bucket: string;       // R2 Bucket 名
  status: 'active' | 'completed' | 'aborted' | 'reaped';
}

// ── 結果レコード型 ────────────────────────────────────────────────────────────
interface ReapResult {
  upload_id: string;
  object_key: string;
  status: 'reaped' | 'error';
  error?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET ハンドラ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function GET(req: Request): Promise<NextResponse> {

  // ─── §1. Cron Security Armor: Bearer トークン検証 ───────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[Reaper] CRON_SECRET env var is not set');
    return NextResponse.json({ error: 'Cron secret not configured' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  const incomingToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (incomingToken !== cronSecret) {
    // DDoS / 外部スキャン攻撃による DB 枯渇を物理遮断
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ─── §2. 環境変数ガード ─────────────────────────────────────────────────
  const supabaseUrl      = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r2AccountId      = process.env.R2_ACCOUNT_ID;
  const r2AccessKeyId    = process.env.R2_ACCESS_KEY_ID;
  const r2SecretKey      = process.env.R2_SECRET_ACCESS_KEY;

  if (!supabaseUrl || !serviceRoleKey || !r2AccountId || !r2AccessKeyId || !r2SecretKey) {
    console.error('[Reaper] Missing required environment variables');
    return NextResponse.json({ error: 'Environment configuration incomplete' }, { status: 500 });
  }

  // ─── §3. Supabase Admin クライアント（RLS 完全バイパス） ─────────────────
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // ─── §4. R2 S3Client 初期化 ──────────────────────────────────────────────
  // endpoint: https://${ACCOUNT_ID}.r2.cloudflarestorage.com
  // region: 'auto' (Cloudflare R2 必須)
  const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretKey,
    },
  });

  // ─── §5. 刈り取り対象の取得: status = 'aborted', LIMIT 50 ──────────────
  const { data: sessions, error: fetchError } = await supabase
    .from('r2_multipart_sessions')
    .select('upload_id, object_key, bucket, status')
    .eq('status', 'aborted')
    .order('created_at', { ascending: true })
    .limit(REAP_BATCH_LIMIT);

  if (fetchError) {
    console.error('[Reaper] Failed to fetch aborted sessions:', fetchError.message);
    return NextResponse.json(
      { error: `DB fetch failed: ${fetchError.message}` },
      { status: 500 },
    );
  }

  const targets = (sessions ?? []) as MultipartSession[];

  if (targets.length === 0) {
    console.info('[Reaper] No aborted sessions found. Nothing to reap.');
    return NextResponse.json({ reaped: 0, errors: [], total: 0 }, { status: 200 });
  }

  console.info(`[Reaper] Found ${targets.length} aborted session(s). Starting reap...`);

  // ─── §6. 個別 AbortMultipartUpload + Atomic DB Update ─────────────────
  // 【The Domino Crash Prevention】
  // Promise.all 禁止。for...of + 個別 try-catch で完全分離。
  // R2 Abort 成功時のみ DB を 'reaped' へ UPDATE する。
  const results: ReapResult[] = [];

  for (const session of targets) {
    try {
      // ── §6-a. R2 AbortMultipartUploadCommand 発火 ────────────────────
      const abortInput: AbortMultipartUploadCommandInput = {
        Bucket: session.bucket,
        Key: session.object_key,
        UploadId: session.upload_id,
      };

      await r2.send(new AbortMultipartUploadCommand(abortInput));

      // ── §6-b. R2 Abort 成功 → DB を 'reaped' へ UPDATE ──────────────
      const { error: updateError } = await supabase
        .from('r2_multipart_sessions')
        .update({ status: 'reaped' })
        .eq('upload_id', session.upload_id);

      if (updateError) {
        // R2 削除は成功したが DB 更新が失敗した場合: エラーとして記録しつつ続行
        // （次回 Cron 発火時に再 Abort を試みるが R2 側は既に削除済みのため安全）
        throw new Error(`R2 aborted but DB update failed: ${updateError.message}`);
      }

      results.push({ upload_id: session.upload_id, object_key: session.object_key, status: 'reaped' });
      console.info(`[Reaper] ✓ Reaped: ${session.upload_id} (${session.object_key})`);

    } catch (err: unknown) {
      // ── §6-c. NoSuchUpload 自己修復: 幽霊セッション（R2上で物理消滅済み）を検出 ──
      // AWS SDK v3 は ServiceException を名前付きエラーとして投げるため
      // err.name で判定する。HTTP 404 は $metadata.httpStatusCode で補足する。
      // 【`any` 絶対禁止】$metadata へのアクセスは Record<string, unknown> を経由して型安全に行う。
      const errMeta =
        err !== null &&
        typeof err === 'object' &&
        '$metadata' in err
          ? (err as Record<string, unknown>)['$metadata']
          : undefined;

      const httpStatus =
        errMeta !== null &&
        typeof errMeta === 'object' &&
        'httpStatusCode' in (errMeta as Record<string, unknown>)
          ? (errMeta as Record<string, unknown>)['httpStatusCode']
          : undefined;

      const isNoSuchUpload =
        (err instanceof Error && err.name === 'NoSuchUpload') ||
        httpStatus === 404;

      if (isNoSuchUpload) {
        // R2 上に物理的なフラグメントは存在しないため、課金リスクはゼロ。
        // DB を 'reaped' に昇格させ、次回 Cron での無限リトライループを物理遮断する。
        console.info(
          `[Reaper] R2 object already gone (NoSuchUpload). Self-healing to reaped: ${session.upload_id}`,
        );

        const { error: fallbackDbError } = await supabase
          .from('r2_multipart_sessions')
          .update({ status: 'reaped' })
          .eq('upload_id', session.upload_id);

        if (!fallbackDbError) {
          results.push({
            upload_id: session.upload_id,
            object_key: session.object_key,
            status: 'reaped',
          });
          continue; // エラー配列には入れずに次のセッションへ進む
        }

        // fallbackDbError が非 null の場合は通常エラーとして落下させる
        console.error(
          `[Reaper] Self-healing DB update failed: ${session.upload_id} — ${fallbackDbError.message}`,
        );
      }

      // ── 未知のエラー: DB を変更せず次回 Cron での再試行を保証する ───────
      const message = err instanceof Error ? err.message : 'Unknown R2 abort error';
      console.error(`[Reaper] ✗ Failed to reap: ${session.upload_id} — ${message}`);

      results.push({
        upload_id: session.upload_id,
        object_key: session.object_key,
        status: 'error',
        error: message,
      });
    }
  }

  // ─── §7. 結果集計 ────────────────────────────────────────────────────────
  const reapedCount = results.filter((r) => r.status === 'reaped').length;
  const errorResults = results.filter((r) => r.status === 'error');

  console.info(
    `[Reaper] Complete. reaped=${reapedCount} errors=${errorResults.length} total=${targets.length}`,
  );

  return NextResponse.json(
    {
      reaped: reapedCount,
      errors: errorResults,
      total: targets.length,
    },
    { status: 200 },
  );
}
