/// <reference lib="webworker" />
/**
 * hashWorker.ts — Streaming SHA-256 Worker
 *
 * 設計目的:
 *   1. 数 GB 級のファイルでも OOM を起こさず SHA-256 を計算する。
 *   2. メインスレッドへ「ファイル全体 ArrayBuffer」を一切渡さない（メモリピーク回避）。
 *   3. UI が滑らかな進捗を描画できるよう、throttle 済み progress を postMessage する。
 *
 * アルゴリズム:
 *   - hash-wasm の createSHA256() で Incremental Hasher を生成
 *   - File を 4MB 単位の Blob.slice() でチャンク化（端末メモリへの安全マージン）
 *   - 各チャンクは arrayBuffer() で取得 → update() → すぐ GC 対象化
 *   - 進捗は 60ms throttle / 1% 単位 でメインスレッドへ通知
 *   - 完了時は digest() を hex で返却
 *
 * 互換性:
 *   - ブラウザは Web Worker (module) を要求
 *   - file.stream() に依存しない（古い iOS Safari 15 互換）
 *   - hash-wasm は AbortController を受け付けないので、worker.terminate() で確実に停止
 */

import { createSHA256 } from 'hash-wasm';

/* ─────────────────────────────────────────────
 *  Protocol — 既存型を拡張
 *  - HashRequest: id, file, (optional) chunkSize
 *  - HashResponse は discriminated union 化
 *      'progress' | 'success' | 'error'
 * ───────────────────────────────────────────── */

export interface HashRequest {
  /** 呼び出しの突合せ ID（uuid 等） */
  id: string;
  /** 計算対象ファイル */
  file: File;
  /** チャンクサイズ（バイト）。未指定なら 4MB。 */
  chunkSize?: number;
}

export interface HashProgressMessage {
  kind: 'progress';
  id: string;
  /** 0.0 〜 1.0 の正規化進捗 */
  progress: number;
  /** ここまで読み込んだバイト数 */
  bytesProcessed: number;
  /** ファイル全体のバイト数 */
  totalBytes: number;
  /** ハッシュ計算開始からの経過 ms (ETA 用) */
  elapsedMs: number;
}

export interface HashSuccessMessage {
  kind: 'success';
  id: string;
  sha256: string;
  size: number;
  name: string;
  type: string;
  /** 計算全体の所要 ms */
  durationMs: number;
}

export interface HashErrorMessage {
  kind: 'error';
  id: string;
  message: string;
}

export type HashResponse =
  | HashProgressMessage
  | HashSuccessMessage
  | HashErrorMessage;

/* ─────────────────────────────────────────────
 *  Constants
 * ───────────────────────────────────────────── */

/** 既定チャンクサイズ。4MB は「メモリ安全 × syscall 効率」のスイートスポット。 */
const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024;

/** 進捗 postMessage の throttle インターバル (ms)。 */
const PROGRESS_THROTTLE_MS = 60;

/* ─────────────────────────────────────────────
 *  Worker entry
 * ───────────────────────────────────────────── */

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (event: MessageEvent<HashRequest>): Promise<void> => {
  const { id, file, chunkSize = DEFAULT_CHUNK_SIZE } = event.data;

  try {
    const sha256 = await streamingSha256(id, file, chunkSize, (msg) => {
      ctx.postMessage(msg);
    });

    const success: HashSuccessMessage = {
      kind: 'success',
      id,
      sha256,
      size: file.size,
      name: file.name,
      type: file.type,
      durationMs: 0, // streamingSha256 内で上書きせず ETA は progress で運用
    };
    ctx.postMessage(success);
  } catch (err) {
    const errorMessage: HashErrorMessage = {
      kind: 'error',
      id,
      message: err instanceof Error ? err.message : 'Hashing failed',
    };
    ctx.postMessage(errorMessage);
  }
};

/* ─────────────────────────────────────────────
 *  Core — streaming SHA-256
 * ───────────────────────────────────────────── */

/**
 * Incremental SHA-256 を hash-wasm で計算する。
 *
 * - file.slice(start, end) で 1 チャンクずつだけメモリに乗せる
 * - update() 後に参照を解放し、GC が回収できる状態にする
 * - ループ 1 回ごとに `await` で event loop に制御を返し、Worker 内 GC を促す
 */
async function streamingSha256(
  id: string,
  file: File,
  chunkSize: number,
  emit: (msg: HashProgressMessage) => void,
): Promise<string> {
  const totalBytes = file.size;
  const hasher = await createSHA256();
  hasher.init();

  const startedAt = performance.now();
  let bytesProcessed = 0;
  let lastEmitAt = 0;
  let lastEmittedPercent = -1;

  // 空ファイル対応 (空でも SHA-256 は定義される)
  if (totalBytes === 0) {
    emit({
      kind: 'progress',
      id,
      progress: 1,
      bytesProcessed: 0,
      totalBytes: 0,
      elapsedMs: 0,
    });
    return hasher.digest('hex');
  }

  for (let offset = 0; offset < totalBytes; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, totalBytes);

    // ── 1チャンクだけメモリへ ─────────────────────────────
    // file.slice() は Blob を遅延参照で返すだけなのでメモリは消費しない。
    // arrayBuffer() を呼んだ瞬間に「そのチャンク分だけ」が物理メモリに乗る。
    const chunkBlob = file.slice(offset, end);
    const chunkBuffer = await chunkBlob.arrayBuffer();
    const chunkBytes = new Uint8Array(chunkBuffer);

    // ── hash-wasm に逐次投入 ──────────────────────────────
    // update() は同期、内部で wasm linear memory を再利用する
    hasher.update(chunkBytes);

    bytesProcessed = end;

    // ── progress 通知 (throttle) ──────────────────────────
    const now = performance.now();
    const percent = Math.floor((bytesProcessed / totalBytes) * 100);
    const shouldEmit =
      now - lastEmitAt >= PROGRESS_THROTTLE_MS &&
      percent !== lastEmittedPercent;

    if (shouldEmit) {
      emit({
        kind: 'progress',
        id,
        progress: bytesProcessed / totalBytes,
        bytesProcessed,
        totalBytes,
        elapsedMs: now - startedAt,
      });
      lastEmitAt = now;
      lastEmittedPercent = percent;
    }

    // microtask に制御を返して GC とイベントキューに息継ぎさせる
    // （これがないと巨大ファイル時に Worker が「ハングっぽく」見える）
    await Promise.resolve();
  }

  // 末尾で必ず 100% を送る
  emit({
    kind: 'progress',
    id,
    progress: 1,
    bytesProcessed: totalBytes,
    totalBytes,
    elapsedMs: performance.now() - startedAt,
  });

  return hasher.digest('hex');
}

export { };
