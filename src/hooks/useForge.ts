import { useState, useRef, useCallback, useEffect } from 'react';
import type { ForgeMessage } from '../lib/forge.worker';
import { registerCertificateAction } from '../../../src/actions/upload'; // パス調整

interface ForgeState {
  isForging: boolean;
  progress: number;
  stage: 'idle' | 'hashing' | 'decoding' | 'uploading' | 'finalizing';
  error: string | null;
  cid: string | null;
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3, backoff = 500): Promise<Response> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    return res;
  } catch (err: any) {
    if (err.name === 'AbortError') throw err; // ユーザーキャンセル時はリトライしない
    if (retries > 0) {
      console.warn(`[Network Drop Detected] Retrying upload in ${backoff}ms...`);
      await new Promise(r => setTimeout(r, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw err;
  }
}

export function useForge() {
  const [state, setState] = useState<ForgeState>({
    isForging: false, progress: 0, stage: 'idle', error: null, cid: null,
  });
  
  const workerRef = useRef<Worker | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // コンポーネントアンマウント時のクリーンアップ（メモリリーク完全防止）
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      abortControllerRef.current?.abort();
    };
  }, []);

  const startForge = useCallback((file: File) => {
    workerRef.current?.terminate();
    abortControllerRef.current?.abort();
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    workerRef.current = new Worker(new URL('../lib/forge.worker.ts', import.meta.url), {
      type: 'module'
    });

    setState({ isForging: true, progress: 0, stage: 'hashing', error: null, cid: null });

    workerRef.current.onmessage = async (e: MessageEvent<ForgeMessage>) => {
      if (signal.aborted) return;
      const msg = e.data;
      
      switch (msg.type) {
        case 'PROGRESS':
          setState(s => ({ ...s, progress: msg.percent, stage: msg.stage }));
          break;

        case 'SUCCESS':
          workerRef.current?.terminate();
          try {
            setState(s => ({ ...s, progress: 100, stage: 'uploading', cid: msg.cid }));
            
            // 1. Presigned URL 取得
            const presignRes = await fetch('/api/storage/presign', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cid: msg.cid, contentType: msg.framesBlob.type }),
              signal
            });
            const presignData = await presignRes.json();
            if (!presignRes.ok || presignData.error) throw new Error(presignData.error || 'Failed to get secure URL');

            // 2. R2 への直接アップロード (自動リトライ搭載)
            await fetchWithRetry(presignData.signedUrl, {
              method: 'PUT',
              body: msg.framesBlob,
              headers: { 'Content-Type': msg.framesBlob.type },
              signal
            });

            // 3. アトミックなDBトランザクション確定 (RPC呼び出し)
            setState(s => ({ ...s, stage: 'finalizing' }));
            const actionRes = await registerCertificateAction({
              cid: msg.cid,
              sizeBytes: msg.framesBlob.size,
              mimeType: msg.framesBlob.type,
              title: file.name
            });
            
            if (!actionRes.success) throw new Error(actionRes.error);

            setState(s => ({ ...s, isForging: false, stage: 'idle' }));
            console.log(`[FORGE APEX COMPLETE] ID: ${actionRes.certificateId}`);

          } catch (err: any) {
            if (err.name === 'AbortError') return; // キャンセル時のノイズ排除
            setState(s => ({ ...s, isForging: false, error: `Pipeline Error: ${err.message}` }));
          }
          break;

        case 'ERROR':
          setState(s => ({ ...s, isForging: false, error: msg.message }));
          workerRef.current?.terminate();
          break;
      }
    };

    workerRef.current.postMessage({ type: 'START', file });
  }, []);

  return { state, startForge };
}