/**
 * useHashFile — Streaming Hash Hook
 *
 * - hashWorker.ts と protocol を完全一致させる
 * - メインスレッドに「進捗 callback」を露出
 * - StrictMode 二重 mount に耐える（Worker は 1 インスタンス保持）
 * - 同時複数ファイルでも request id でルーティング
 */

import { useCallback, useEffect, useRef } from 'react';
import type {
  HashRequest,
  HashResponse,
  HashProgressMessage,
  HashSuccessMessage,
} from '../workers/hashWorker';

export interface HashFileResult {
  id: string;
  sha256: string;
  size: number;
  name: string;
  type: string;
  durationMs: number;
}

export interface HashFileOptions {
  /** 0.0 〜 1.0 の進捗が通知される */
  onProgress?: (state: HashProgressMessage) => void;
  /** チャンクサイズ (byte)。既定 4MB。 */
  chunkSize?: number;
  /** 外部から計算を中断したい場合に渡す */
  signal?: AbortSignal;
}

export function useHashFile() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/hashWorker.ts', import.meta.url),
      { type: 'module', name: 'pm-hash-worker' },
    );
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const hashFile = useCallback(
    (file: File, options: HashFileOptions = {}): Promise<HashFileResult> => {
      const worker = workerRef.current;
      if (!worker) {
        return Promise.reject(new Error('hash worker is not initialized'));
      }

      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `hash-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      return new Promise<HashFileResult>((resolve, reject) => {
        const cleanup = (): void => {
          worker.removeEventListener('message', handleMessage);
          worker.removeEventListener('error', handleError);
          options.signal?.removeEventListener('abort', handleAbort);
        };

        const handleMessage = (event: MessageEvent<HashResponse>): void => {
          const data = event.data;
          if (data.id !== id) return;

          switch (data.kind) {
            case 'progress':
              options.onProgress?.(data);
              return;
            case 'success': {
              cleanup();
              const result: HashFileResult = {
                id: data.id,
                sha256: data.sha256,
                size: data.size,
                name: data.name,
                type: data.type,
                durationMs: data.durationMs,
              };
              resolve(result);
              return;
            }
            case 'error':
              cleanup();
              reject(new Error(data.message));
              return;
          }
        };

        const handleError = (event: ErrorEvent): void => {
          cleanup();
          reject(event.error ?? new Error('Hash worker crashed'));
        };

        const handleAbort = (): void => {
          cleanup();
          // Worker を捨てて作り直すのが最も安全（hash-wasm は abort 非対応）
          workerRef.current?.terminate();
          workerRef.current = new Worker(
            new URL('../workers/hashWorker.ts', import.meta.url),
            { type: 'module', name: 'pm-hash-worker' },
          );
          reject(new DOMException('Hashing aborted', 'AbortError'));
        };

        worker.addEventListener('message', handleMessage);
        worker.addEventListener('error', handleError, { once: true });
        options.signal?.addEventListener('abort', handleAbort, { once: true });

        const request: HashRequest = {
          id,
          file,
          chunkSize: options.chunkSize,
        };
        worker.postMessage(request);
      });
    },
    [],
  );

  return { hashFile };
}

// ハッシュ完了型を再 export しておくと、呼び出し側 import が楽になる
export type {
  HashProgressMessage,
  HashSuccessMessage,
} from '../workers/hashWorker';
