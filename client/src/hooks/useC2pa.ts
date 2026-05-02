/**
 * useC2pa — C2PA Web Worker のラッパフック (Lazy Activation 対応)
 *
 * Phase 10 の核となる契約:
 *   1. 有料プラン (creator / studio / business / light / admin) でしか
 *      Worker を **インスタンス化しない**。Free / 未ログインでは
 *      `enabled=false` になり、import すらされない。
 *   2. 1 回の `parse(file)` 呼び出しごとに id を発行し、`onmessage` で
 *      正しく対応する Promise を解決する (並列呼び出し safe)。
 *   3. Worker が異常終了 (Worker クラッシュ) しても、1 回限りの破棄 + 再構築
 *      で次回呼び出しに備える。アプリは決して落ちない。
 *
 * Inputs:
 *   - planTier: 'free' | 'creator' | 'studio' | 'business' | 'light' | 'admin' | string
 *
 * Returns:
 *   - enabled        : Worker が利用可能か
 *   - parsing        : 直近の parse 進行中フラグ
 *   - parse(file)    : Promise<C2paParseResult>
 *   - dispose()      : Worker を即時破棄 (画面遷移時に呼ぶ)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { C2paManifest } from '../lib/c2pa-schema';

const PAID_TIERS = new Set(['creator', 'studio', 'business', 'light', 'admin']);

export type C2paParseResult =
  | { kind: 'manifest'; manifest: C2paManifest; bytes: number }
  | { kind: 'no_manifest'; reason?: string };

export interface UseC2paOptions {
  /** SDK ESM URL (CDN). 既定値は jsdelivr の c2pa@0.32 系。 */
  sdkUrl?: string;
  /** WASM URL (CDN). SDK の wasmSrc に渡す */
  wasmUrl?: string;
}

interface UseC2paResult {
  enabled: boolean;
  parsing: boolean;
  parse: (file: File) => Promise<C2paParseResult>;
  dispose: () => void;
}

interface PendingEntry {
  resolve: (r: C2paParseResult) => void;
  reject: (e: Error) => void;
  timerId: ReturnType<typeof setTimeout>;
}

export function useC2pa(planTier: string | null | undefined, opts: UseC2paOptions = {}): UseC2paResult {
  const enabled = !!planTier && PAID_TIERS.has(planTier.toLowerCase());

  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, PendingEntry>>(new Map());
  const [parsing, setParsing] = useState(false);

  // ── Worker 初期化 (有料プランでのみ) ─────────────────────────────
  const ensureWorker = useCallback((): Worker | null => {
    if (!enabled) return null;
    if (workerRef.current) return workerRef.current;

    // Vite ネイティブの Worker constructor (TypeScript / module 形式)
    // 既存ビルドはそのまま動く。SSR では呼ばれない (enabled が false のため)。
    const w = new Worker(new URL('../workers/c2pa-worker.ts', import.meta.url), { type: 'module' });

    w.addEventListener('message', (ev: MessageEvent) => {
      const m = ev.data as
        | { id: string; ok: true; result: 'manifest'; manifest: C2paManifest; bytes: number }
        | { id: string; ok: true; result: 'no_manifest'; reason?: string }
        | { id: string; ok: false; error: string };
      const entry = pendingRef.current.get(m.id);
      if (!entry) return;
      pendingRef.current.delete(m.id);
      if (!m.ok) {
        entry.reject(new Error(m.error));
        return;
      }
      if (m.result === 'manifest') entry.resolve({ kind: 'manifest', manifest: m.manifest, bytes: m.bytes });
      else entry.resolve({ kind: 'no_manifest', reason: m.reason });
    });

    // Worker クラッシュ時のフェイルセーフ
    w.addEventListener('error', () => {
      // 既存の pending を no_manifest で解決し、Worker を破棄する
      for (const [, entry] of pendingRef.current) {
        entry.resolve({ kind: 'no_manifest', reason: 'worker_crashed' });
      }
      pendingRef.current.clear();
      try { w.terminate(); } catch { /* noop */ }
      workerRef.current = null;
      setParsing(false);
    });

    workerRef.current = w;
    return w;
  }, [enabled]);

  // ── dispose ─────────────────────────────────────────────────────
  const dispose = useCallback(() => {
    const w = workerRef.current;
    if (w) {
      try { w.terminate(); } catch { /* noop */ }
    }
    workerRef.current = null;
    for (const [, entry] of pendingRef.current) {
      clearTimeout(entry.timerId);
      entry.resolve({ kind: 'no_manifest', reason: 'disposed' });
    }
    pendingRef.current.clear();
    setParsing(false);
  }, []);

  // ── parse() ─────────────────────────────────────────────────────
  const parse = useCallback(async (file: File): Promise<C2paParseResult> => {
    if (!enabled) return { kind: 'no_manifest', reason: 'plan_locked' };
    const w = ensureWorker();
    if (!w) return { kind: 'no_manifest', reason: 'worker_unavailable' };

    const id =
      (globalThis.crypto as Crypto | undefined)?.randomUUID?.() ??
      `c2pa_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;

    setParsing(true);
    return new Promise<C2paParseResult>((resolve, reject) => {
      const timerId = setTimeout(() => {
        dispose();
        resolve({ kind: 'no_manifest', reason: 'worker_timeout_killed' });
      }, 12000);

      pendingRef.current.set(id, {
        resolve: (r) => { clearTimeout(timerId); setParsing(false); resolve(r); },
        reject:  (e) => { clearTimeout(timerId); setParsing(false); reject(e); },
        timerId,
      });
      try {
        w.postMessage({
          id,
          kind: 'parse',
          file,
          sdkUrl: opts.sdkUrl,
          wasmUrl: opts.wasmUrl,
        });
      } catch (e) {
        // postMessage 失敗 (大量ファイルの clone コスト等)
        clearTimeout(timerId);
        pendingRef.current.delete(id);
        setParsing(false);
        resolve({ kind: 'no_manifest', reason: `postmessage_failed:${(e as Error)?.message ?? 'unknown'}` });
      }
    });
  }, [enabled, ensureWorker, opts.sdkUrl, opts.wasmUrl, dispose]);



  // unmount で必ず Worker を畳む
  useEffect(() => {
    return () => dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useMemo<UseC2paResult>(() => ({
    enabled, parsing, parse, dispose,
  }), [enabled, parsing, parse, dispose]);
}

/* ──────────────────────────────────────────────────────────────────── */
/* バイトレベルのマジック検出 (Free プラン用、Worker を起動せずに済む) */
/* ──────────────────────────────────────────────────────────────────── */

/**
 * 画像ファイルの先頭 64KB を覗き、JUMBF コンテナの可能性をマジック検出する。
 * - JPEG: APP11 'JUMB' マーカー
 * - PNG : 'jumb' チャンクタイプ
 * - HEIF/AVIF: 'jumb' box タイプ
 *
 * ヒューリスティクスゆえに偽陽性 / 偽陰性は出るが、Free プランの "アップ
 * セルきっかけ" としては十分。Worker (=数百KB の WASM) を起動せずに判定。
 */
export async function probeC2paMagic(file: File): Promise<boolean> {
  const SLICE = Math.min(64 * 1024, file.size);
  if (SLICE === 0) return false;
  const buf = new Uint8Array(await file.slice(0, SLICE).arrayBuffer());

  // ASCII "jumb" or "JUMB" の出現を検索
  const pat1 = [0x6a, 0x75, 0x6d, 0x62]; // jumb
  const pat2 = [0x4a, 0x55, 0x4d, 0x42]; // JUMB
  outer: for (let i = 0; i < buf.length - 4; i++) {
    if (
      (buf[i] === pat1[0] && buf[i+1] === pat1[1] && buf[i+2] === pat1[2] && buf[i+3] === pat1[3]) ||
      (buf[i] === pat2[0] && buf[i+1] === pat2[1] && buf[i+2] === pat2[2] && buf[i+3] === pat2[3])
    ) {
      return true;
    }
    // 連続スキャンを抑止する余地 (将来の最適化)
    if (false) break outer;
  }
  return false;
}
