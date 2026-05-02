/**
 * c2pa-worker.ts — C2PA Manifest Web Worker (Zero-Knowledge / Off-Main-Thread)
 *
 * ▼ 設計原則
 *   1. メインスレッドを 1 ms もブロックしない。WASM ロードもパースもこの
 *      Worker 内で完結する。
 *   2. **公式 SDK (@contentauth/c2pa) は CDN から動的 import**。
 *      これにより Free / 未契約環境ではバンドルにも CDN にも 1 byte も
 *      ロードされない。Worker は Lazy 起動、SDK は Lazy fetch、二重に
 *      コストフリー。
 *   3. SDK のフル出力は数百 KB～数 MB に膨れあがる (thumbnail / 派生画像 /
 *      assertion data)。本 Worker はそれを `c2pa-schema.ts` の Scrubbed 形に
 *      "削ぎ落として" からメインスレッドへ返す。
 *   4. 失敗しても **クラッシュしない**。SDK が読めない / 画像が C2PA を
 *      含まない / 署名が壊れている — いずれの場合も `result: 'no_manifest'`
 *      または `validity: 'invalid'` の正規な応答を返す。SaaS の基本フローを
 *      止めない。
 *
 * ▼ 通信プロトコル
 *   ─ inbound message ─
 *     { id: string, kind: 'parse', file: File, sdkUrl?: string, wasmUrl?: string }
 *   ─ outbound message ─
 *     { id, ok: true,  result: 'manifest', manifest: C2paManifest }
 *     { id, ok: true,  result: 'no_manifest' }
 *     { id, ok: false, error: string }
 *
 * ▼ 安全な失敗
 *   - 50MB 超は SDK ロード前に skip ('no_manifest' を返す)
 *   - SDK 動的 import 失敗時 → 'no_manifest' (本機能は付加価値であり、欠如で
 *     はなく "気付かれない欠席" として扱う)
 */

/* eslint-disable no-restricted-globals */

import {
  C2paManifestZ,
  C2PA_PAYLOAD_MAX_BYTES,
  C2PA_ASSERTIONS_MAX,
  C2PA_INGREDIENTS_MAX,
  measureBytes,
  scrubDeep,
  type C2paAssertion,
  type C2paIngredient,
  type C2paManifest,
} from '../lib/c2pa-schema';

const MAX_BYTES = 50 * 1024 * 1024;       // 50 MB ハード上限

/* ──────────────────────────────────────────────────────────────────── */
/* Inbound / outbound types                                             */
/* ──────────────────────────────────────────────────────────────────── */

type InboundMsg = {
  id: string;
  kind: 'parse';
  file: File;
  /** 公式 SDK の ESM エントリ (CDN URL を推奨) */
  sdkUrl?: string;
  /** WASM バイナリの場所。SDK の `createC2pa({ wasmSrc })` に渡す */
  wasmUrl?: string;
};

type OutboundMsg =
  | { id: string; ok: true; result: 'manifest'; manifest: C2paManifest; bytes: number }
  | { id: string; ok: true; result: 'no_manifest'; reason?: string }
  | { id: string; ok: false; error: string };

/* ──────────────────────────────────────────────────────────────────── */
/* SDK loader (lazy, cached across messages)                            */
/* ──────────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sdkCache: any = null;

async function loadSdk(sdkUrl: string, wasmUrl: string) {
  if (sdkCache) return sdkCache;
  // 動的 import — Worker のグローバルに何も染まないように try/catch で守る
  // (Failure は呼び出し側で 'no_manifest' に翻訳)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import(/* @vite-ignore */ sdkUrl);
  if (!mod || typeof mod.createC2pa !== 'function') {
    throw new Error('c2pa_sdk_missing_createC2pa');
  }
  const inst = await mod.createC2pa({ wasmSrc: wasmUrl, workerSrc: undefined });
  if (!inst || typeof inst.read !== 'function') {
    throw new Error('c2pa_sdk_missing_read');
  }
  sdkCache = inst;
  return inst;
}

/* ──────────────────────────────────────────────────────────────────── */
/* Mapping: SDK manifest → Scrubbed C2paManifest                        */
/* ──────────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickAiUsage(active: any): { used: boolean | null; provider: string | null } {
  // Adobe / OpenAI / Stable Diffusion 等は assertion ラベルで判別する。
  // 厳密な仕様化は変動が大きいので、ヒューリスティクスで安全側に倒す。
  const assertions: unknown[] = active?.assertions ?? [];
  let used: boolean | null = null;
  let provider: string | null = null;

  for (const a of assertions) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aa = a as any;
    const label: string = String(aa?.label ?? '');
    const data: unknown = aa?.data;

    if (/^c2pa\.actions(\.v2)?$/i.test(label)) {
      // actions[].action === 'c2pa.created' / 'c2pa.placed' / 'c2pa.aiGenerated'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const acts: any[] = (data as any)?.actions ?? [];
      for (const act of acts) {
        const action = String(act?.action ?? '').toLowerCase();
        if (action.includes('aigenerated') || action.includes('ai_generated')) {
          used = true;
          provider = String(act?.softwareAgent ?? act?.digitalSourceType ?? provider ?? '') || provider;
        }
        if (action === 'c2pa.created' && used === null) used = false;
      }
    }
    if (/training-mining|generative|ai/i.test(label) && used === null) {
      used = true;
    }
  }

  if (provider) provider = provider.slice(0, 200);
  return { used, provider };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function compressAssertions(active: any): C2paAssertion[] {
  const out: C2paAssertion[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list: any[] = active?.assertions ?? [];
  for (const a of list) {
    const label = String(a?.label ?? '').slice(0, 120).trim();
    if (!label) continue;
    let summary: string | null = null;
    if (typeof a?.summary === 'string') summary = a.summary;
    else if (a?.data && typeof a.data === 'object') {
      // よく出てくる小さなフィールドだけを文字列化する
      const k =
        a.data.title ??
        a.data.action ??
        a.data.format ??
        a.data.softwareAgent ??
        null;
      if (typeof k === 'string') summary = k;
    }
    out.push({
      label,
      summary: summary ? String(summary).slice(0, 280) : null,
    });
    if (out.length >= C2PA_ASSERTIONS_MAX) break;
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function compressIngredients(active: any): C2paIngredient[] {
  const out: C2paIngredient[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list: any[] = active?.ingredients ?? [];
  for (const ing of list) {
    out.push({
      title: typeof ing?.title === 'string' ? ing.title.slice(0, 160) : null,
      format: typeof ing?.format === 'string' ? ing.format.slice(0, 40) : null,
      document_id: typeof ing?.document_id === 'string' ? ing.document_id.slice(0, 120) :
                   typeof ing?.documentId === 'string' ? ing.documentId.slice(0, 120) : null,
      relationship:
        ing?.relationship === 'parentOf' || ing?.relationship === 'componentOf' || ing?.relationship === 'inputTo'
          ? ing.relationship
          : null,
      hash_match:
        typeof ing?.hash_match === 'boolean' ? ing.hash_match :
        typeof ing?.validation_status === 'string'
          ? !/error|failed/i.test(ing.validation_status)
          : null,
    });
    if (out.length >= C2PA_INGREDIENTS_MAX) break;
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deriveValidity(parsed: any): { validity: 'valid' | 'invalid' | 'unknown'; reason: string | null } {
  // SDK が validation_status を提供する場合: 'valid' / 'error.*' 等
  const vs = parsed?.validation_status ?? parsed?.manifestStore?.validationStatus;
  if (Array.isArray(vs) && vs.length > 0) {
    const hasError = vs.some((v: unknown) => typeof v === 'object' && v && /error/i.test(String((v as { code?: string }).code ?? '')));
    if (hasError) {
      const first = (vs[0] as { explanation?: string; code?: string }) ?? {};
      return { validity: 'invalid', reason: (first.explanation ?? first.code ?? 'signature_error').slice(0, 280) };
    }
    return { validity: 'valid', reason: null };
  }
  // SDK のレガシー形 (boolean)
  if (parsed?.is_valid === true) return { validity: 'valid', reason: null };
  if (parsed?.is_valid === false) return { validity: 'invalid', reason: 'signature_invalid' };
  return { validity: 'unknown', reason: null };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildScrubbedManifest(parsed: any, sdkVersion: string): C2paManifest {
  // SDK のレイアウト差を吸収
  const active = parsed?.activeManifest ?? parsed?.manifestStore?.activeManifest ?? parsed;
  const validity = deriveValidity(parsed);
  const ai = pickAiUsage(active);

  const draft: C2paManifest = {
    schema_version: 1,
    validity: validity.validity,
    validity_reason: validity.reason,
    issuer: typeof active?.signature_info?.issuer === 'string'
      ? active.signature_info.issuer.slice(0, 200)
      : typeof active?.issuer === 'string' ? active.issuer.slice(0, 200) : null,
    software: typeof active?.claim_generator === 'string'
      ? active.claim_generator.slice(0, 200)
      : typeof active?.software === 'string' ? active.software.slice(0, 200) : null,
    device: typeof active?.device === 'string' ? active.device.slice(0, 200) : null,
    ai_used: ai.used,
    ai_provider: ai.provider,
    manifest_url: typeof active?.manifest_url === 'string' && /^https?:\/\//i.test(active.manifest_url)
      ? active.manifest_url.slice(0, 512) : null,
    active_manifest_label: typeof active?.label === 'string' ? active.label.slice(0, 160) : null,
    assertions: compressAssertions(active),
    ingredients: compressIngredients(active),
    parser: { name: '@contentauth/c2pa', version: sdkVersion?.slice(0, 64) || 'unknown' },
    parsed_at: new Date().toISOString(),
    size_hint: 0, // 後で書き換える
  };

  // 二重防衛で scrubDeep を当てる
  const scrubbed = (scrubDeep(draft) as C2paManifest) ?? draft;
  scrubbed.size_hint = measureBytes(scrubbed);
  return scrubbed;
}

/* ──────────────────────────────────────────────────────────────────── */
/* Message handler                                                      */
/* ──────────────────────────────────────────────────────────────────── */

self.addEventListener('message', async (ev: MessageEvent<InboundMsg>) => {
  const msg = ev.data;
  const post = (m: OutboundMsg) => (self as DedicatedWorkerGlobalScope).postMessage(m);
  if (!msg || msg.kind !== 'parse') {
    post({ id: msg?.id ?? '?', ok: false, error: 'invalid_message' });
    return;
  }
  const id = msg.id;

  try {
    if (!msg.file || msg.file.size <= 0) {
      post({ id, ok: true, result: 'no_manifest', reason: 'empty_file' });
      return;
    }
    if (msg.file.size > MAX_BYTES) {
      post({ id, ok: true, result: 'no_manifest', reason: 'too_large' });
      return;
    }

    const sdkUrl = msg.sdkUrl ?? 'https://cdn.jsdelivr.net/npm/c2pa@0.32.6/+esm';
    const wasmUrl = msg.wasmUrl ?? 'https://cdn.jsdelivr.net/npm/c2pa@0.32.6/dist/assets/wasm/toolkit_bg.wasm';

    let sdk;
    try {
      sdk = await loadSdk(sdkUrl, wasmUrl);
    } catch (e) {
      // SDK ロード自体に失敗 → C2PA は "見えない欠席"
      post({ id, ok: true, result: 'no_manifest', reason: `sdk_load_failed:${(e as Error)?.message ?? 'unknown'}` });
      return;
    }

    const parsed = await sdk.read(msg.file);

    // SDK の return shape: { manifestStore } or { manifest }
    const hasManifest =
      parsed?.activeManifest ||
      parsed?.manifestStore?.activeManifest ||
      parsed?.manifests?.length;
    if (!hasManifest) {
      post({ id, ok: true, result: 'no_manifest', reason: 'no_active_manifest' });
      return;
    }

    const sdkVersion: string = (sdk?.version ?? '0.32.6') as string;
    const draft = buildScrubbedManifest(parsed, sdkVersion);

    // ペイロード上限の最終ガード
    if (draft.size_hint > C2PA_PAYLOAD_MAX_BYTES) {
      // 安全に削減: assertions / ingredients をハードカットして再計測
      draft.assertions = draft.assertions.slice(0, 8);
      draft.ingredients = draft.ingredients.slice(0, 4);
      draft.size_hint = measureBytes(draft);
    }

    // Zod で最終検証 (壊れていたら no_manifest として返す)
    const safe = C2paManifestZ.safeParse(draft);
    if (!safe.success) {
      post({ id, ok: true, result: 'no_manifest', reason: `schema_invalid:${safe.error.issues[0]?.code ?? 'unknown'}` });
      return;
    }

    post({ id, ok: true, result: 'manifest', manifest: safe.data, bytes: safe.data.size_hint });
  } catch (e) {
    // 想定外の例外も SaaS 全体を止めない: ok:true / no_manifest にフォールバック
    post({ id, ok: true, result: 'no_manifest', reason: `exception:${(e as Error)?.message ?? 'unknown'}` });
  }
});

export {}; // ensure module
