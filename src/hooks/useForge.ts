// src/hooks/useForge.ts
/**
 * useForge — React state を経由せず Framer Motion の MotionValue に
 * 進捗を直流するための「Jank 完全殺害型」フック。
 *
 * 主な設計原則:
 *  ① progress は useState を使わない。
 *     Worker から届く高頻度 (60ms 間隔) の PROGRESS イベントは
 *     onProgressDirect(percent, stage) コールバックとして呼び出し、
 *     UI 層で直接 motionValue.set() を叩かせる。
 *  ② stage / cid / error / isForging は「フェーズ遷移」の粒度でのみ
 *     setState する (せいぜい 5〜6 回/セッション)。
 *  ③ registerCertificateAction は Server Action。ネットワーク断は
 *     fetchWithRetry で吸収する。
 *  ④ unmount / 新規 start / cancel で worker.terminate() +
 *     AbortController.abort() を確実に発火。ゾンビ通信ゼロ。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ForgeMessage } from '../lib/forge.worker';

export type ForgeStage =
  | 'idle'
  | 'hashing'
  | 'decoding'
  | 'muxing'
  | 'uploading'
  | 'finalizing';

export interface ForgeState {
  isForging: boolean;
  stage: ForgeStage;
  error: string | null;
  cid: string | null;
  certificateId: string | null;
}

export interface UseForgeOptions {
  /**
   * Worker から届く進捗を「React State を経由せず」に受け取る直流コールバック。
   * UI 層でこの中から Framer Motion の MotionValue.set() を叩くと、
   * React の Virtual DOM 再計算サイクルを完全にバイパスできる。
   *
   *  - percent : 0..100
   *  - stage   : 現在のワーカー内フェーズ
   */
  onProgressDirect?: (percent: number, stage: 'hashing' | 'decoding' | 'muxing') => void;
}

/* ══════════════════════════════════════════════════════════════
 *  Network helper (Retry with exponential backoff)
 * ══════════════════════════════════════════════════════════════ */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  backoff = 500,
): Promise<Response> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    return res;
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') throw err;
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw err;
  }
}

/* ══════════════════════════════════════════════════════════════
 *  Hook
 * ══════════════════════════════════════════════════════════════ */
export function useForge(options?: UseForgeOptions) {
  const [state, setState] = useState<ForgeState>({
    isForging: false,
    stage: 'idle',
    error: null,
    cid: null,
    certificateId: null,
  });

  const workerRef = useRef<Worker | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const onProgressDirectRef = useRef<UseForgeOptions['onProgressDirect']>(options?.onProgressDirect);
  useEffect(() => {
    onProgressDirectRef.current = options?.onProgressDirect;
  }, [options?.onProgressDirect]);

  const isMountedRef = useRef<boolean>(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      try { workerRef.current?.terminate(); } catch { /* noop */ }
      workerRef.current = null;
      try { abortRef.current?.abort(); } catch { /* noop */ }
      abortRef.current = null;
    };
  }, []);

  const cancel = useCallback(() => {
    try { workerRef.current?.terminate(); } catch { /* noop */ }
    workerRef.current = null;
    try { abortRef.current?.abort(); } catch { /* noop */ }
    abortRef.current = null;
    if (isMountedRef.current) {
      setState({
        isForging: false,
        stage: 'idle',
        error: null,
        cid: null,
        certificateId: null,
      });
    }
  }, []);

  const startForge = useCallback(
    (file: File) => {
      try { workerRef.current?.terminate(); } catch { /* noop */ }
      workerRef.current = null;
      try { abortRef.current?.abort(); } catch { /* noop */ }
      const controller = new AbortController();
      abortRef.current = controller;
      const signal = controller.signal;

      let worker: Worker;
      try {
        worker = new Worker(new URL('../lib/forge.worker.ts', import.meta.url), { type: 'module' });
      } catch (err) {
        setState({
          isForging: false,
          stage: 'idle',
          error: `Worker の起動に失敗しました: ${(err as Error).message}`,
          cid: null,
          certificateId: null,
        });
        return;
      }
      workerRef.current = worker;

      if (isMountedRef.current) {
        setState({
          isForging: true,
          stage: 'hashing',
          error: null,
          cid: null,
          certificateId: null,
        });
      }

      let lastStage: ForgeStage = 'hashing';

      worker.onmessage = async (e: MessageEvent<ForgeMessage>) => {
        if (signal.aborted) return;
        const msg = e.data;

        switch (msg.type) {
          case 'PROGRESS': {
            try {
              onProgressDirectRef.current?.(msg.percent, msg.stage);
            } catch { /* UI 層の例外を握り潰す */ }

            const nextStage: ForgeStage =
              msg.stage === 'hashing'
                ? 'hashing'
                : msg.stage === 'decoding'
                  ? 'decoding'
                  : 'muxing';

            if (nextStage !== lastStage) {
              lastStage = nextStage;
              if (isMountedRef.current) {
                setState((s) => ({ ...s, stage: nextStage }));
              }
            }
            break;
          }

          case 'SUCCESS': {
            try { worker.terminate(); } catch { /* noop */ }
            if (workerRef.current === worker) workerRef.current = null;
            if (!isMountedRef.current) return;

            try {
              setState((s) => ({ ...s, stage: 'uploading', cid: msg.cid }));

              // 🩸 @supabase/ssr の Cookie チャンクを完全にデコードしてJWTを直接抽出する
              let accessToken: string | undefined = undefined;
              try {
                const cookies = document.cookie.split(';').map(c => c.trim());
                const baseNames = new Set<string>();
                
                // Cookieの中から 'sb-[project-ref]-auth-token' のベース名を探す
                cookies.forEach(c => {
                  const match = c.match(/^(sb-[a-z0-9]+-auth-token)(?:\.\d+)?=/);
                  if (match) baseNames.add(match[1]);
                });

                for (const baseName of baseNames) {
                  // チャンク化されている場合 (.0, .1) も含めて取得し、正しい順序で結合する
                  const chunks = cookies
                    .filter(c => c.startsWith(`${baseName}=`) || c.startsWith(`${baseName}.`))
                    .sort();
                  
                  const tokenStr = chunks.map(c => {
                    const val = c.split('=').slice(1).join('=');
                    return decodeURIComponent(val);
                  }).join('');
                  
                  try {
                    const parsed = JSON.parse(tokenStr);
                    if (parsed?.access_token) {
                      accessToken = parsed.access_token;
                      break; // 正当なトークンが見つかれば抜ける
                    }
                  } catch (e) { /* 解析失敗時は次のベース名を試す */ }
                }
              } catch (e) {
                console.warn('[ForgePipeline] Cookie session extraction failed:', e);
              }

              const headers: Record<string, string> = {
                'Content-Type': 'application/json',
              };
              if (accessToken) {
                headers['Authorization'] = `Bearer ${accessToken}`;
              }

              // 1) Presigned URL 取得
              const presignRes = await fetch('/api/storage/presign', {
                method: 'POST',
                headers,
                body: JSON.stringify({ cid: msg.cid, contentType: msg.framesBlob.type }),
                signal,
              });
              
              if (presignRes.status === 401 || presignRes.status === 403) {
                throw new Error('認証セッションが失われています。再度ログインしてください。');
              }
              if (!presignRes.ok) {
                throw new Error(`Failed to get secure URL (HTTP ${presignRes.status})`);
              }

              const presignData = (await presignRes.json()) as { signedUrl?: string; objectKey?: string; error?: string };
              if (presignData.error || !presignData.signedUrl || !presignData.objectKey) {
                throw new Error(presignData.error || 'Failed to get secure URL or Object Key');
              }

              // 2) R2 への直接 PUT (retry 付き)
              await fetchWithRetry(presignData.signedUrl, {
                method: 'PUT',
                body: msg.framesBlob,
                headers: { 'Content-Type': msg.framesBlob.type },
                signal,
              });

              // 3) DB 打刻 (API Route Handler)
              if (isMountedRef.current) {
                setState((s) => ({ ...s, stage: 'finalizing' }));
              }

              const commitRes = await fetch('/api/certificates/commit', {
                method: 'POST',
                headers, // 抽出したトークンヘッダーを再利用
                body: JSON.stringify({
                  cid: msg.cid,
                  sizeBytes: msg.framesBlob.size,
                  mimeType: msg.framesBlob.type,
                  objectKey: presignData.objectKey,
                  title: file.name,
                }),
                signal,
              });

              if (!commitRes.ok) {
                const errData = (await commitRes.json().catch(() => ({}))) as { error?: string };
                throw new Error(errData.error || `DB commit failed (HTTP ${commitRes.status})`);
              }

              const actionRes = (await commitRes.json()) as { success: boolean; certificateId?: string; error?: string };
              if (!actionRes.success) {
                throw new Error(actionRes.error || 'DB 打刻に失敗しました');
              }

              if (isMountedRef.current) {
                setState({
                  isForging: false,
                  stage: 'idle',
                  error: null,
                  cid: msg.cid,
                  certificateId: actionRes.certificateId ?? null,
                });
              }

            } catch (err) {
              if ((err as DOMException)?.name === 'AbortError') return;
              if (!isMountedRef.current) return;
              setState((s) => ({
                ...s,
                isForging: false,
                stage: 'idle',
                error: `Pipeline Error: ${(err as Error).message}`,
              }));
            }
            break;
          }

          case 'ERROR': {
            try { worker.terminate(); } catch { /* noop */ }
            if (workerRef.current === worker) workerRef.current = null;
            if (!isMountedRef.current) return;
            setState((s) => ({
              ...s,
              isForging: false,
              stage: 'idle',
              error: msg.message,
            }));
            break;
          }

          default:
            break;
        }
      };

      worker.onerror = (e) => {
        if (!isMountedRef.current) return;
        setState((s) => ({
          ...s,
          isForging: false,
          stage: 'idle',
          error: e.message || 'Worker ランタイムエラー',
        }));
      };

      worker.postMessage({ type: 'START', file });
    },
    [],
  );

  return { state, startForge, cancel };
}