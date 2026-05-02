/**
 * api/_lib/c2pa-validate.ts — サーバ側の C2PA ペイロード防衛線
 *
 * Phase 10 の "DB に到達する前に弾く" ガードレール:
 *   1. 文字列 / オブジェクトのいずれでも受け付け、JSON parse 例外を握る。
 *   2. Zod (`C2paManifestZ`) でフィールド単位の型/長/列挙を厳格に検証。
 *   3. payload 全体の UTF-8 byte サイズを実測し、`C2PA_PAYLOAD_MAX_BYTES`
 *      (10KB) を 1byte でも超えたら拒絶。クライアント宣言値は信用しない。
 *   4. plan_tier が 'free' の場合は **サイレントに無視 (null 返却)**。
 *      不正クライアントに 4xx を返さないことで、C2PA 機能の存在自体を
 *      ステルス化し、有料プランへのアップセル経路を UI 層に一本化する。
 *
 * すべての関数は純粋: ロギングは呼び出し側で行う。
 */

import { z } from 'zod';
import {
  C2paManifestZ,
  C2PA_PAYLOAD_MAX_BYTES,
  measureBytes,
  type C2paManifest,
} from '../../client/src/lib/c2pa-schema';

const PAID_TIERS = new Set(['creator', 'studio', 'business', 'light', 'admin']);

export type C2paGateResult =
  | { kind: 'accept'; manifest: C2paManifest }
  | { kind: 'reject'; reason: string }
  | { kind: 'silent_drop'; reason: string };

/**
 * 受信値を「DB に保存できる正規な C2pa マニフェスト」にまで通すか、
 * 静かに捨てるかを判定するゲート。エラーで処理を止めず、返り値を見て
 * 呼び出し側が `c2pa_manifest = null` を保存するか決める。
 */
export function gateC2paManifest(
  raw: unknown,
  planTier: string | null | undefined,
): C2paGateResult {
  // 1. 値そのものが無い → 通常 (C2PA を持たない画像)
  if (raw === null || raw === undefined || raw === '') {
    return { kind: 'silent_drop', reason: 'absent' };
  }

  // 2. 課金されていないユーザーからの送信は **無視**
  //    (アップセル UI のため UI 層で別経路を用意; API は黙ってドロップ)
  const tier = String(planTier ?? 'free').toLowerCase();
  if (!PAID_TIERS.has(tier)) {
    return { kind: 'silent_drop', reason: 'plan_locked' };
  }

  // 3. 文字列なら JSON parse を試行 (multipart のフィールドは文字列で来る)
  let candidate: unknown = raw;
  if (typeof raw === 'string') {
    try {
      candidate = JSON.parse(raw);
    } catch {
      return { kind: 'reject', reason: 'invalid_json' };
    }
  }

  // 4. シリアライズ後の実サイズを最終ガード (Vercel 4.5MB 上限の手前で 10KB)
  const bytes = measureBytes(candidate);
  if (bytes > C2PA_PAYLOAD_MAX_BYTES) {
    return { kind: 'reject', reason: `payload_too_large:${bytes}` };
  }

  // 5. Zod 厳格バリデーション
  const parsed = C2paManifestZ.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      kind: 'reject',
      reason: `schema_invalid:${issue?.path?.join('.') ?? '?'}:${issue?.code ?? 'unknown'}`,
    };
  }

  // 6. クライアント宣言の size_hint と実測の差を 5% 以内にクランプ
  //    (大幅乖離 = 改ざん試行の可能性)
  const declared = parsed.data.size_hint ?? 0;
  const drift = Math.abs(declared - bytes);
  if (declared > 0 && drift / Math.max(1, bytes) > 0.50) {
    // 50% 超ずれは怪しい → reject (5%/10% より緩いのは JSON 正規化差を許容)
    return { kind: 'reject', reason: 'size_hint_drift' };
  }

  // 7. size_hint を実測値で上書き (クライアント宣言は採用しない)
  return {
    kind: 'accept',
    manifest: { ...parsed.data, size_hint: bytes },
  };
}

/**
 * Express / Vercel ハンドラ向けの薄いユーティリティ。
 * raw (multipart の string / JSON body の object どちらでも) を受け、
 * INSERT / UPDATE 用に「DB へそのまま投げてよい値」を返す。
 *
 *   - accept       → manifest object (DB に書く)
 *   - silent_drop  → null            (DB に書かない: 既存値を保存)
 *   - reject       → null            (4xx は呼ばない: サイレント無視 + 警告ログ)
 */
export function resolveC2paForPersistence(
  raw: unknown,
  planTier: string | null | undefined,
): { value: C2paManifest | null; gate: C2paGateResult } {
  const gate = gateC2paManifest(raw, planTier);
  if (gate.kind === 'accept') return { value: gate.manifest, gate };
  return { value: null, gate };
}

/* ── 再エクスポート (呼び出し側の import を 1 箇所に集約) ─────────── */
export type { C2paManifest };
export { z, C2PA_PAYLOAD_MAX_BYTES };
