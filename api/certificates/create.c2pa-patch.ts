/**
 * api/certificates/create.c2pa-patch.ts — Phase 10 サーバ側差分例
 *
 * 既存の `api/certificates/create.ts` は本番のフローを担う重要ファイルなので
 * 「上書き」ではなく **差分の参照実装** として本ファイルを提供する。
 * 担当者は既存ファイルの該当箇所に下記 3 行のロジックだけを差し込めばよい。
 *
 * ▼ 差し込みポイント (擬似 diff)
 *
 *   import { resolveC2paForPersistence } from '../_lib/c2pa-validate';
 *
 *   // multipart の form フィールドを読んだ直後 (sha256 / proofMode / metadataJson の隣)
 *   const c2paRaw = formData.get('c2paManifest'); // string | null
 *
 *   // ユーザーの plan_tier はこれまでと同じく profiles から取得
 *   const planTier = profile?.plan_tier ?? 'free';
 *
 *   // ゲート判定 (Free は silent_drop, 不正サイズ/スキーマは silent reject)
 *   const { value: c2paValue, gate } = resolveC2paForPersistence(c2paRaw, planTier);
 *   if (gate.kind === 'reject') {
 *     log.warn({ event: 'c2pa.rejected', reason: gate.reason });
 *   }
 *
 *   // INSERT に列を追加
 *   await admin.from('certificates').insert({
 *     ...,
 *     c2pa_manifest: c2paValue, // null の場合は列に書かれない (DB default)
 *   });
 *
 * 既存 API の構造を最小限変えるため、ここでは「差分例」を 1 つのハンドラと
 * して提示する。実装担当は既存のロジックに **資格情報検証 / WORM トリガ /
 * 監査ログ起動 / Sentry 連携** などをそのまま温存しつつ、上記 3 行を挿入する。
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveC2paForPersistence } from '../_lib/c2pa-validate';
// 既存ファイルから流用する想定の helpers (Sprint 1〜4 で導入済み)
// import { HttpError, getAdminClient, isAllowedOrigin, json, makeLogger, methodGuard, requireUser } from '../_lib/server';

/**
 * ▼ 既存の handler の中で、c2pa_manifest を扱う最小ブロックだけを示す。
 *   実プロジェクトでは既存の create.ts と統合してください。
 */
export async function handleC2paField(
  formData: FormData,
  planTier: string,
  log: { warn: (o: Record<string, unknown>) => void },
): Promise<unknown | null> {
  const raw = formData.get('c2paManifest');
  // multipart は string | File | null。File が来ても無視 (バイナリは入れさせない)
  if (raw instanceof File) {
    log.warn({ event: 'c2pa.binary_field_ignored' });
    return null;
  }

  const { value, gate } = resolveC2paForPersistence(raw, planTier);

  if (gate.kind === 'reject') {
    // 4xx を返さない (アップセル UI の責務に統一)。サイレントに無視 + ログ。
    log.warn({ event: 'c2pa.rejected', reason: gate.reason });
    return null;
  }
  if (gate.kind === 'silent_drop') {
    // Free / 不在 → 何も書かない
    return null;
  }
  return value; // accept: DB に書く JSONB
}
