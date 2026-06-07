/**
 * usePromoteCertificate.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * One-Click Delivery Kit — Quarantine → WORM Ledger Promotion Hook
 *
 * DeliveryKitModal の onComplete ペイロードを受け取り、
 * POST /api/certificates/create を叩いて quarantine 領域のファイルを
 * WORM 台帳（certificates テーブル）へ原子的に昇格させる。
 *
 * 不変条件:
 *   - proofMode: 'private' (固定)
 *   - visibility: 'private' (固定)
 *   - isPromoting ミューテックスで多重実行を物理排除
 *   - HTTP 409 は「重複証明書」として専用エラーメッセージへ昇格
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const CREATE_ENDPOINT = '/api/certificates/create';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

/** DeliveryKitModal の onComplete が渡すペイロード（型共有） */
export interface ModalPayload {
  quarantinePath: string;
  bucket: string;
  password: string;
  clientName: string;
  fileHash: string;
  c2paManifest?: string | null;
}

/** POST /api/certificates/create のレスポンス */
interface CreateCertificateResponse {
  certificate?: {
    id: string;
    public_verify_token: string;
    proven_at: string;
    [key: string]: unknown;
  };
  verifyUrl?: string;
  error?: string;
  duplicate?: boolean;
  details?: unknown;
}

export interface UsePromoteCertificateReturn {
  /**
   * quarantine を WORM 台帳へ昇格させる。
   * 失敗時は Error を throw するため、呼び出し元で catch してトーストを表示すること。
   *
   * @param modalPayload DeliveryKitModal.onComplete から渡されるペイロード
   * @param originalFile 元の File オブジェクト（メタデータ抽出用）
   */
  promote: (modalPayload: ModalPayload, originalFile: File) => Promise<CreateCertificateResponse>;
  /** 昇格処理中は true。多重実行防止に使用 */
  isPromoting: boolean;
  /** 最後に発生したエラーメッセージ。成功時・リセット時は null */
  error: string | null;
}

/* ═══════════════════════════════════════════════════════════════
   HOOK
   ═══════════════════════════════════════════════════════════════ */

export function usePromoteCertificate(): UsePromoteCertificateReturn {
  const [isPromoting, setIsPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const promote = useCallback(
    async (modalPayload: ModalPayload, originalFile: File): Promise<CreateCertificateResponse> => {
      /* ── ミューテックス: 多重実行を物理排除 ── */
      if (isPromoting) {
        throw new Error('既に昇格処理が進行中です。完了までお待ちください。');
      }

      setIsPromoting(true);
      setError(null);

      try {
        /* ────────────────────────────────────────────────────
           Step 1: Supabase セッションから access_token を取得
        ──────────────────────────────────────────────────── */
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token ?? '';

        if (!accessToken) {
          throw new Error('認証セッションが見つかりません。再度ログインしてください。');
        }

        /* ────────────────────────────────────────────────────
           Step 2: ペイロード構築
           - proofMode / visibility は 'private' に絶対固定
           - title は clientName が空なら originalFile.name へフォールバック
        ──────────────────────────────────────────────────── */
        const title = modalPayload.clientName.trim() || originalFile.name;

        const requestBody = {
          // ── quarantine 昇格キー ──
          quarantinePath: modalPayload.quarantinePath,
          sha256:         modalPayload.fileHash,
          c2paManifest:   modalPayload.c2paManifest || null,

          // ── 表示・分類 ──
          title,
          proofMode:  'private' as const,   // 絶対固定
          visibility: 'private' as const,   // 絶対固定

          // ── ファイルメタデータ ──
          file_name: originalFile.name,
          file_size: originalFile.size,
          mime_type: originalFile.type || 'application/octet-stream',

          // ── 拡張メタ（API の metadataJson フィールドへ） ──
          metadataJson: {
            original_filename:    originalFile.name,
            original_size:        originalFile.size,
            is_preview_compressed: false,
          } as Record<string, unknown>,
        };

        /* ────────────────────────────────────────────────────
           Step 3: POST /api/certificates/create
        ──────────────────────────────────────────────────── */
        const res = await fetch(CREATE_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify(requestBody),
        });

        /* ────────────────────────────────────────────────────
           Step 4: レスポンスハンドリング
        ──────────────────────────────────────────────────── */
        let data: CreateCertificateResponse;
        try {
          data = (await res.json()) as CreateCertificateResponse;
        } catch {
          throw new Error(`サーバーからの応答を解析できませんでした (HTTP ${res.status})`);
        }

        /* ── HTTP 409: 重複証明書 ── */
        if (res.status === 409) {
          throw new Error('すでに同一の証明書が存在します。');
        }

        /* ── その他 HTTP エラー ── */
        if (!res.ok) {
          const detail = data.error || `不明なサーバーエラー (HTTP ${res.status})`;
          throw new Error(detail);
        }

        /* ── 成功: 正常終了 ── */
        // 呼び出し元が certificate 情報を必要とする場合は
        // return data.certificate 等に変更する。
        // 現仕様では void を返すのみ。
        return data;

      } catch (err) {
        /* ── エラー状態を state に記録し、呼び出し元にも re-throw ── */
        const msg = err instanceof Error ? err.message : '昇格処理中に不明なエラーが発生しました';
        setError(msg);
        throw err; // 呼び出し元 (Dashboard 等) でトースト通知が可能

      } finally {
        /* ── 成功・失敗どちらでも必ずミューテックスを解放 ── */
        setIsPromoting(false);
      }
    },
    [isPromoting],
  );

  return { promote, isPromoting, error };
}
