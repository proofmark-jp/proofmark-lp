/**
 * useQuarantineUpload.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * One-Click Delivery Kit — Network & Abort Protocol
 *
 * フロー:
 *   1. POST /api/upload-quarantine-url → Signed URL 取得
 *   2. PUT {signedUrl} — 暗号化 Blob を直接送信 (AbortController 制御下)
 *
 * AbortController の保証:
 *   - コンポーネントアンマウント時にフックが自動的に abort() を呼ぶ。
 *   - キャンセルボタン押下時にも abort() を呼び、OS レベルで通信を即時遮断。
 *   - AbortController は呼び出しごとに新規生成し、前回の upload が残っていれば先にキャンセルする。
 *
 * 既存 API エンドポイント (/api/upload-url) の accept 形式を再利用:
 *   POST body: { filename, contentType, fileSize }
 *   レスポンス: { success, signedUrl, quarantinePath, bucket, ttlSeconds }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

/** 既存の upload-url エンドポイントをそのまま利用 */
const QUARANTINE_URL_ENDPOINT = '/api/upload-url';

/** 暗号化 Blob は application/octet-stream として送信 */
const VAULT_CONTENT_TYPE = 'application/octet-stream';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

interface QuarantineUrlResponse {
  success: boolean;
  signedUrl?: string;
  quarantinePath?: string;
  bucket?: string;
  ttlSeconds?: number;
  error?: string;
  details?: string;
}

export type UploadPhase =
  | 'idle'
  | 'requesting-url'    // Signed URL を取得中
  | 'uploading'         // 暗号化 Blob を PUT 中
  | 'done'
  | 'cancelled'
  | 'error';

export interface QuarantineUploadResult {
  /** Supabase Storage 上の内部パス */
  quarantinePath: string;
  /** バケット名 */
  bucket: string;
}

export interface UseQuarantineUploadReturn {
  phase: UploadPhase;
  /** 0.0 – 1.0 (Signed URL 取得: 0.1、アップロード完了: 1.0) */
  progress: number;
  error: string | null;
  /**
   * 暗号化済み Blob を送信する。
   * @param encryptedBlob useEncryptedVault が返した Blob
   * @param originalFilename 元のファイル名 (ログ・メタデータ用)
   * @param clientName クライアント名 (任意。メタデータとして送信)
   */
  upload: (
    encryptedBlob: Blob,
    originalFilename: string,
    clientName?: string,
  ) => Promise<QuarantineUploadResult | null>;
  /** 進行中のアップロードを即座にキャンセル (OS レベル通信遮断) */
  abort: () => void;
  reset: () => void;
}

/* ═══════════════════════════════════════════════════════════════
   HOOK
   ═══════════════════════════════════════════════════════════════ */

export function useQuarantineUpload(): UseQuarantineUploadReturn {
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /** 現在進行中の fetch を制御する AbortController */
  const controllerRef = useRef<AbortController | null>(null);

  /* ── コンポーネントアンマウント時に通信を自動遮断 ── */
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    setPhase('cancelled');
    setProgress(0);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setPhase('idle');
    setProgress(0);
    setError(null);
  }, []);

  const upload = useCallback(
    async (
      encryptedBlob: Blob,
      originalFilename: string,
      clientName?: string,
    ): Promise<QuarantineUploadResult | null> => {
      /* ── 前回の通信が残っていればキャンセル ── */
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const { signal } = controller;

      setPhase('requesting-url');
      setProgress(0);
      setError(null);

      try {
        /* ────────────────────────────────────────────────────
           Step 1: Signed URL 取得
           POST /api/upload-url
        ──────────────────────────────────────────────────── */
        /* ── Supabase 認証トークン取得 ── */
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token ?? '';

        const urlRes = await fetch(QUARANTINE_URL_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            filename: `vault_${Date.now()}.bin`,
            contentType: VAULT_CONTENT_TYPE,
            fileSize: encryptedBlob.size,
            // メタデータ: クライアント名と元ファイル名は参照用に送信
            meta: {
              originalFilename,
              clientName: clientName?.trim() || null,
              encryptedAt: new Date().toISOString(),
            },
          }),
          signal,
        });

        if (signal.aborted) return null;

        setProgress(0.1);

        const urlData: QuarantineUrlResponse = await urlRes.json();

        if (!urlRes.ok || !urlData.success || !urlData.signedUrl) {
          throw new Error(urlData.error || `Signed URL 取得失敗 (HTTP ${urlRes.status})`);
        }

        if (signal.aborted) return null;

        /* ────────────────────────────────────────────────────
           Step 2: 暗号化 Blob を PUT で直接送信
           AbortController の signal を fetch に渡し、
           キャンセル時は OS レベルで即時遮断する。
        ──────────────────────────────────────────────────── */
        setPhase('uploading');
        setProgress(0.2);

        const putRes = await fetch(urlData.signedUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': VAULT_CONTENT_TYPE,
            'Content-Length': String(encryptedBlob.size),
            ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
          },
          body: encryptedBlob,
          signal,
        });

        if (signal.aborted) return null;

        if (!putRes.ok) {
          throw new Error(`アップロード失敗 (HTTP ${putRes.status})`);
        }

        setProgress(1.0);
        setPhase('done');

        return {
          quarantinePath: urlData.quarantinePath!,
          bucket: urlData.bucket!,
        };

      } catch (err) {
        /* AbortError は「キャンセル」であり「エラー」ではない */
        if (err instanceof DOMException && err.name === 'AbortError') {
          setPhase('cancelled');
          setProgress(0);
          return null;
        }

        const msg = err instanceof Error ? err.message : 'アップロード中に不明なエラーが発生しました';
        setError(msg);
        setPhase('error');
        setProgress(0);
        return null;
      }
    },
    [],
  );

  return { phase, progress, error, upload, abort, reset };
}
