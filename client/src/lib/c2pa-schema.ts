/**
 * c2pa-schema.ts — フロント / バックエンド共通の C2PA マニフェスト圧縮スキーマ。
 *
 * Phase 10 の根幹: Web Worker が公式 SDK で抽出した冗長な C2PA マニフェスト
 * (画像サムネイル / バイナリ / 巨大 JSON) を、ここで定義した Scrubbed 形に
 * 必ず圧縮してから API へ送る。サーバはこのスキーマで Zod バリデーションし、
 * 規格外のペイロードを **DB に到達する前に** 弾く。
 *
 * 設計の核:
 *   • payload 全体は 10KB を超えない (size_hint で監視)
 *   • 画像 / バイナリは一切含まない (thumbnail / preview は dropped)
 *   • 検証可否を 'validity' (valid|invalid|unknown) に正規化
 *   • UI が宝石化に必要な最小限のフィールドのみ
 */

import { z } from 'zod';

/* ──────────────────────────────────────────────────────────────────── */
/* 限界値 (Vercel ペイロード爆発の防衛線)                                */
/* ──────────────────────────────────────────────────────────────────── */

/** payload 全体の最大サイズ (UTF-8 bytes) */
export const C2PA_PAYLOAD_MAX_BYTES = 10 * 1024;
/** 個別文字列フィールドの最大長 (制作ソフト名・Issuer など) */
export const C2PA_FIELD_MAX = 200;
/** assertions 配列の最大要素数 */
export const C2PA_ASSERTIONS_MAX = 20;
/** ingredients 配列の最大要素数 */
export const C2PA_INGREDIENTS_MAX = 8;

/* ──────────────────────────────────────────────────────────────────── */
/* Sub-schemas                                                          */
/* ──────────────────────────────────────────────────────────────────── */

const safeText = (max = C2PA_FIELD_MAX) =>
  z.string().trim().min(1).max(max);

const safeOptionalText = (max = C2PA_FIELD_MAX) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

const safeUrl = z
  .string()
  .trim()
  .max(512)
  .regex(/^https?:\/\//i, 'must be http(s)://')
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

/** C2PA Assertion (label + summary). バイナリ data は受けない */
export const C2paAssertionZ = z.object({
  label: safeText(120), // e.g. "c2pa.actions.v2", "stds.exif"
  summary: safeOptionalText(280),
}).strict();

/** C2PA Ingredient (素材). thumbnail / data_uri は受けない */
export const C2paIngredientZ = z.object({
  title: safeOptionalText(160),
  format: safeOptionalText(40),
  document_id: safeOptionalText(120),
  relationship: z.enum(['parentOf', 'componentOf', 'inputTo']).optional().nullable(),
  hash_match: z.boolean().optional().nullable(),
}).strict();

/* ──────────────────────────────────────────────────────────────────── */
/* Top-level schema                                                     */
/* ──────────────────────────────────────────────────────────────────── */

export const C2paManifestZ = z.object({
  /** スキーマ版 (将来の互換性のため) */
  schema_version: z.literal(1),

  /** 検証結果。SDK の上位レベルの判定をここに集約する */
  validity: z.enum(['valid', 'invalid', 'unknown']),
  validity_reason: safeOptionalText(280),

  /** 発行元 (例: "Adobe Inc."). アクティブ Manifest の signature_info.issuer */
  issuer: safeOptionalText(200),
  /** 制作ソフトウェア (例: "Adobe Photoshop 25.0") */
  software: safeOptionalText(200),
  /** 撮影 / 出力デバイス (例: "iPhone 15 Pro") */
  device: safeOptionalText(200),

  /** 生成 AI が使用された痕跡 (assertions/c2pa.actions.v2 を集計) */
  ai_used: z.boolean().nullable(),
  /** AI モデル名 / プロバイダ (assertion から拾えた場合のみ) */
  ai_provider: safeOptionalText(200),

  /** Generator 情報の URL (例: c2pa.org/manifest/...) */
  manifest_url: safeUrl,

  /** Active manifest の SHA-256 ラベル (UI に表示する短縮ID) */
  active_manifest_label: safeOptionalText(160),

  /** 圧縮済みの assertion 群 (バイナリは含まない) */
  assertions: z.array(C2paAssertionZ).max(C2PA_ASSERTIONS_MAX).default([]),

  /** 派生関係 (派生元素材) — ingredients */
  ingredients: z.array(C2paIngredientZ).max(C2PA_INGREDIENTS_MAX).default([]),

  /** SDK のバージョン (デバッグ用) */
  parser: z.object({
    name: safeText(64),
    version: safeText(64),
  }).strict(),

  /** 抽出時刻 (ISO8601, クライアント時計). サーバ側では信用しない */
  parsed_at: z.string().datetime(),

  /**
   * payload 全体のサイズヒント (UTF-8 bytes).
   * Worker が JSON.stringify 後にセットする。サーバ側で実測と比較。
   */
  size_hint: z.number().int().nonnegative().max(C2PA_PAYLOAD_MAX_BYTES),
}).strict();

export type C2paManifest = z.infer<typeof C2paManifestZ>;
export type C2paAssertion = z.infer<typeof C2paAssertionZ>;
export type C2paIngredient = z.infer<typeof C2paIngredientZ>;

/* ──────────────────────────────────────────────────────────────────── */
/* Helpers                                                              */
/* ──────────────────────────────────────────────────────────────────── */

/**
 * オブジェクトを UTF-8 でシリアライズしたときの byte 数を計測する。
 * Buffer は Vercel Node Runtime にあるが、ブラウザでは TextEncoder を使う。
 */
export function measureBytes(obj: unknown): number {
  const json = JSON.stringify(obj);
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(json).byteLength;
  }
  // Node.js fallback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (Buffer as any).byteLength(json, 'utf8');
}

/**
 * 任意の JSON から null/undefined/空文字を削いだ "scrubbed" な複製を返す。
 * Worker 側で SDK 出力を最後に通すフィルタ。再帰深さを 4 に制限し、
 * 循環参照を保護する。
 */
export function scrubDeep(input: unknown, depth = 4): unknown {
  if (depth < 0 || input === null || input === undefined) return undefined;
  if (typeof input === 'string') {
    const t = input.trim();
    return t.length === 0 ? undefined : t;
  }
  if (typeof input === 'number' || typeof input === 'boolean') return input;
  if (Array.isArray(input)) {
    const out = input
      .map((v) => scrubDeep(v, depth - 1))
      .filter((v) => v !== undefined);
    return out.length === 0 ? undefined : out;
  }
  if (typeof input === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      // バイナリ系のキー名は問答無用で落とす (二重防衛)
      if (/^(thumbnail|data|data_uri|preview|raw|bytes)$/i.test(k)) continue;
      const s = scrubDeep(v, depth - 1);
      if (s !== undefined) o[k] = s;
    }
    return Object.keys(o).length === 0 ? undefined : o;
  }
  return undefined;
}
