// src/lib/sha256-wasm.worker.ts
// =============================================================================
// 👑 THE SOVEREIGN ARCHITECT: src/lib/sha256-wasm.worker.ts
// Phase 1.7: WASM Incremental Streaming Hash Pipeline
// 目的: Blueprint §VII.2 に基づき、OOMを完全封殺する4MBチャンクハッシュワーカーを錬成
// =============================================================================

/**
 * Web WorkerコードのBlob URLを生成する
 * Next.jsのWebpackによるWorker解釈・ビルドエラーを回避するため、文字列としてインライン定義する。
 * CSP (script-src) で許可されたCDNから hash-wasm を importScripts で直接注入。
 */
const WORKER_CODE = `
  // Blueprint §VII.2: Next.jsの型・バンドラ制約を回避するインラインWorker + CDN読み込み
  importScripts('https://cdn.jsdelivr.net/npm/hash-wasm@4/dist/sha256.umd.min.js');

  self.onmessage = async (event) => {
    try {
      const { file, chunkSize } = event.data;
      
      if (typeof hashwasm === 'undefined' || !hashwasm.createSHA256) {
        throw new Error('CRITICAL: hash-wasm library failed to load from CDN.');
      }

      const hasher = await hashwasm.createSHA256();
      hasher.init();

      const size = file.size;
      let offset = 0;

      // Blueprint §VII.2: 4MB Chunked Stream & OOM 完全封殺
      // file.slice でチャンク分割し、メモリ上に展開するバイナリを常時4MB以下に保つ
      while (offset < size) {
        const end = Math.min(offset + chunkSize, size);
        const chunk = file.slice(offset, end);
        const buffer = await chunk.arrayBuffer();
        
        hasher.update(new Uint8Array(buffer));
        
        offset = end;
        
        // XMLHttpRequest (XHR) のアップロード進捗に合わせた計算用 (0-100%)
        self.postMessage({ type: 'progress', progress: Math.round((offset / size) * 100) });
      }

      const hash = hasher.digest('hex');
      self.postMessage({ type: 'done', hash });
    } catch (error) {
      self.postMessage({ 
        type: 'error', 
        error: error instanceof Error ? error.message : 'Unknown Worker Error' 
      });
    }
  };
`;

let workerBlobUrl: string | null = null;

function getWorkerUrl(): string {
  if (!workerBlobUrl) {
    const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
    workerBlobUrl = URL.createObjectURL(blob);
  }
  return workerBlobUrl;
}

/**
 * メインスレッドをブロックせず、ファイルサイズ無制限でインクリメンタルにSHA-256を算出する。
 * 
 * @param file ハッシュ化対象の File または Blob オブジェクト
 * @param onProgress 進捗コールバック (0-100)
 * @returns 計算されたSHA-256ハッシュ (HEX文字列)
 */
export const calculateSHA256 = (
  file: File | Blob,
  onProgress?: (progress: number) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const workerUrl = getWorkerUrl();
    const worker = new Worker(workerUrl);
    
    // 4MB Chunk (Blueprint §VII.2)
    const CHUNK_SIZE = 4 * 1024 * 1024;

    worker.onmessage = (event) => {
      const { type, hash, progress, error } = event.data;
      
      if (type === 'progress') {
        if (onProgress) onProgress(progress);
      } else if (type === 'done') {
        worker.terminate();
        resolve(hash);
      } else if (type === 'error') {
        worker.terminate();
        reject(new Error(error));
      }
    };

    worker.onerror = (error) => {
      worker.terminate();
      reject(error instanceof Error ? error : new Error('Worker execution failed'));
    };

    worker.postMessage({ file, chunkSize: CHUNK_SIZE });
  });
};