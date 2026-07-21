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

              // 🩸 究極のトークン抽出機構 (The Invincible Ghost Extractor v2)
              // Supabaseクライアントを起こさず、Base64URLデコードを自力で行い、期限切れの古いトークンを確実に弾く。
              let accessToken: string | undefined = undefined;

              const isValidJWT = (token: string) => {
                try {
                  if (!token || typeof token !== 'string' || token.indexOf('eyJ') !== 0) return false;
                  const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
                  const payload = JSON.parse(atob(b64));
                  // 期限切れ（1分以内の猶予）は絶対に弾く。腐敗したトークンはここで死滅する。
                  return payload.exp && (payload.exp * 1000 > Date.now() + 60000);
                } catch (e) { return false; }
              };

              // 1. Cookie からの抽出 (@supabase/ssr の Base64URL チャンク対応)
              try {
                const cookies = document.cookie.split(';');
                const baseNames: string[] = [];
                for (let i = 0; i < cookies.length; i++) {
                  const c = cookies[i].trim();
                  const match = c.match(/^(sb-[a-z0-9]+-auth-token)(?:\.\d+)?=/);
                  if (match && baseNames.indexOf(match[1]) === -1) {
                    baseNames.push(match[1]);
                  }
                }

                for (let i = 0; i < baseNames.length; i++) {
                  const baseName = baseNames[i];
                  const chunks = [];
                  for (let j = 0; j < cookies.length; j++) {
                    const c = cookies[j].trim();
                    if (c.indexOf(`${baseName}=`) === 0 || c.indexOf(`${baseName}.`) === 0) {
                      chunks.push(c);
                    }
                  }
                  chunks.sort();

                  const tokenStr = chunks.map(c => decodeURIComponent(c.substring(c.indexOf('=') + 1))).join('');

                  let parsed: any = null;
                  try {
                    parsed = JSON.parse(tokenStr);
                  } catch (e1) {
                    try {
                      // Base64URL デコード
                      let b64 = tokenStr.replace(/-/g, '+').replace(/_/g, '/');
                      const pad = b64.length % 4;
                      if (pad > 0) {
                        for (let k = 0; k < 4 - pad; k++) b64 += '=';
                      }
                      // UTF-8 安全デコード
                      const decoded = atob(b64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('');
                      parsed = JSON.parse(decodeURIComponent(decoded));
                    } catch (e2) {}
                  }

                  if (parsed && parsed.access_token && isValidJWT(parsed.access_token)) {
                    accessToken = parsed.access_token;
                    break;
                  }
                }
              } catch (e) {
                console.warn('[ForgePipeline] Cookie extraction failed', e);
              }

              // 2. LocalStorage からの抽出 (Cookieが見つからなかった場合のフォールバック)
              if (!accessToken) {
                try {
                  for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.indexOf('sb-') > -1 && key.indexOf('-auth-token') > -1) {
                      const raw = localStorage.getItem(key);
                      if (raw) {
                        try {
                          const parsed = JSON.parse(raw);
                          // ここでも有効期限を厳格にチェック。古いトークンは拾わない。
                          if (parsed && parsed.access_token && isValidJWT(parsed.access_token)) {
                            accessToken = parsed.access_token;
                            break;
                          }
                        } catch (e) {}
                      }
                    }
                  }
                } catch (e) {}
              }

              if (!accessToken) {
                throw new Error('認証セッションが失われています。再度ログインしてください。');
              }

              const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`, // 強奪し、かつ「新鮮」であることを証明されたトークン
              };

              // 1) Presigned URL 取得
              const presignRes = await fetch('/api/storage/presign', {
                method: 'POST',
                headers,
                body: JSON.stringify({ 
                  cid: msg.cid, 
                  contentType: msg.framesBlob.type,
                  sizeBytes: msg.framesBlob.size 
                }),
                signal,
              });
              
              if (!presignRes.ok) {
                const errText = await presignRes.text().catch(() => 'Unknown error');
                let errMsg = errText;
                try {
                  const parsed = JSON.parse(errText);
                  if (parsed.error) errMsg = parsed.error;
                } catch {}
                throw new Error(errMsg);
              }

              const presignData = (await presignRes.json()) as { signedUrl?: string; objectKey?: string; error?: string };
              if (presignData.error || !presignData.signedUrl || !presignData.objectKey) {
                throw new Error(presignData.error || 'Failed to get secure URL or Object Key');
              }

              // 2) R2 への直接 PUT
              await fetchWithRetry(presignData.signedUrl, {
                method: 'PUT',
                body: msg.framesBlob,
                headers: { 'Content-Type': msg.framesBlob.type },
                signal,
              });

              // 3) DB 打刻
              if (isMountedRef.current) {
                setState((s) => ({ ...s, stage: 'finalizing' }));
              }

              const commitRes = await fetch('/api/certificates/commit', {
                method: 'POST',
                headers,
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
                const errText = await commitRes.text().catch(() => 'Unknown error');
                let errMsg = errText;
                try {
                  const parsed = JSON.parse(errText);
                  if (parsed.error) errMsg = parsed.error;
                } catch {}
                throw new Error(errMsg);
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