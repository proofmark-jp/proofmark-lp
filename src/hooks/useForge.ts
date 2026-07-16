// client/src/hooks/useForge.ts
import { useState, useRef, useCallback } from 'react';
import type { ForgeMessage } from '../lib/forge.worker';

interface ForgeState {
  isForging: boolean;
  progress: number;
  stage: 'idle' | 'hashing' | 'decoding' | 'uploading';
  error: string | null;
  cid: string | null;
}

export function useForge() {
  const [state, setState] = useState<ForgeState>({
    isForging: false,
    progress: 0,
    stage: 'idle',
    error: null,
    cid: null,
  });
  const workerRef = useRef<Worker | null>(null);

  const startForge = useCallback((file: File) => {
    if (workerRef.current) workerRef.current.terminate();
    
    // Webpack / Vite の機能を使ってWorkerをインスタンス化
    workerRef.current = new Worker(new URL('../lib/forge.worker.ts', import.meta.url), {
      type: 'module'
    });

    setState({ isForging: true, progress: 0, stage: 'hashing', error: null, cid: null });

    workerRef.current.onmessage = (e: MessageEvent<ForgeMessage>) => {
      const msg = e.data;
      switch (msg.type) {
        case 'PROGRESS':
          setState(s => ({ ...s, progress: msg.percent, stage: msg.stage }));
          break;
        case 'SUCCESS':
          setState(s => ({ ...s, isForging: false, progress: 100, cid: msg.cid }));
          // TODO: ここで msg.framesBlob (軽量化された1MBのデータ) をR2へアップロードする処理を繋ぐ
          console.log(`[FORGE COMPLETE] Master Hash: ${msg.cid}`);
          workerRef.current?.terminate();
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