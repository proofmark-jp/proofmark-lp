"use client";
/**
 * src/hooks/useVerifier.ts
 * ──────────────────────────────────────────────────────────────────
 *  ProofMark Web Verifier — state machine hook
 *
 *  IDLE -> UNZIPPING -> HASHING -> VERIFYING_SIGNATURE -> SUCCESS | ERROR
 *                    \-> AWAITING_ORIGINAL -> (resume) -> HASHING -> ...
 *
 *  すべてブラウザ内。pkijs/JSZip/WebCrypto を逐次実行。
 *  途中エラーは VerifierError として捕捉し、人間可読メッセージへ変換。
 * ──────────────────────────────────────────────────────────────────
 */

import { useCallback, useRef, useState } from 'react';
import {
  computeSha256,
  extractHashFromHashTxt,
  loadEvidencePack,
  VerifierError,
  verifyTimestamp,
} from '@/lib/crypto-verifier';
import type {
  LoadedEvidencePack,
  VerificationFailureReason,
  VerificationSuccess,
  VerifierState,
} from '@/types/verifier';

const FAILURE_MESSAGES: Record<VerificationFailureReason, string> = {
  INVALID_ZIP:                       'ZIP アーカイブを展開できませんでした。',
  ZIP_SLIP_DETECTED:                 'ZIP に不正な相対パスが含まれています。',
  PACK_LAYOUT_INVALID:               'Evidence Pack の構造が認識できません。',
  MISSING_TIMESTAMP:                 'timestamp.tsr が同梱されていません。',
  MISSING_ORIGINAL:                  '原本ファイル (original/) が同梱されていません。',
  MISSING_HASH_TXT:                  'hash.txt が同梱されていません。',
  MISSING_TSA_CERT:                  'TSA 公開鍵証明書が同梱されていません。',
  MISSING_CA_CERT:                   'CA 公開鍵証明書が同梱されていません。',
  TIMESTAMP_EXPLICITLY_MISSING:      'このパックはタイムスタンプを意図的に含んでいません。',
  HASH_TXT_MALFORMED:                'hash.txt の形式が不正です。',
  HASH_MISMATCH_LOCAL_VS_HASH_TXT:   '原本のハッシュが hash.txt と一致しません。改ざんの可能性があります。',
  HASH_MISMATCH_LOCAL_VS_TSR:        '原本のハッシュがタイムスタンプ内のハッシュと一致しません。改ざんの可能性があります。',
  TSR_PARSE_FAILED:                  'タイムスタンプの形式を解釈できませんでした。',
  TSR_STATUS_REJECTED:               'TSA がタイムスタンプ要求を拒否したトークンです。',
  TSR_UNSUPPORTED_HASH_ALGORITHM:    'タイムスタンプのハッシュアルゴリズムが SHA-256 ではありません。',
  INVALID_TSA_SIGNATURE:             'TSA 署名が暗号学的に正当ではありません。',
  TSA_CERT_NOT_TRUSTED:              'TSA 証明書チェーンを CA まで遡れません。',
  TSA_CERT_EXPIRED_AT_GENTIME:       'タイムスタンプ発行時点で TSA 証明書が失効していました。',
  BROWSER_UNSUPPORTED:               'このブラウザはゼロ知識検証に必要な API をサポートしていません。',
  INTERNAL_ERROR:                    '内部エラーが発生しました。',
};

const JST_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export function useVerifier() {
  const [state, setState] = useState<VerifierState>({ kind: 'IDLE' });
  const runIdRef = useRef(0);
  // 原本待ちの間、展開済み pack を保持する
  const [pendingPack, setPendingPack] = useState<LoadedEvidencePack | null>(null);

  const reset = useCallback((): void => {
    runIdRef.current += 1; // 進行中ジョブをキャンセル
    setPendingPack(null);
    setState({ kind: 'IDLE' });
  }, []);

  /* ──────────────────────────────────────────────────────────────
   *  共通: HASHING 以降の検証コア
   *  pack.originalFile が確定している状態で呼ぶ
   * ────────────────────────────────────────────────────────────── */
  const runVerification = useCallback(async (
    pack: LoadedEvidencePack,
    runId: number,
    startedAt: number,
    safeSet: (next: VerifierState) => void,
  ): Promise<void> => {
    /* ── 2. SHA-256 計算 ────────────────────────────────── */
    safeSet({ kind: 'HASHING', progress: 0, fileName: pack.originalFile.name });
    const computedHex = await computeSha256(pack.originalFile.bytes, (p) => {
      safeSet({ kind: 'HASHING', progress: p, fileName: pack.originalFile.name });
    });

    /* ── 2-b. hash.txt との一致確認 ──────────────────────── */
    if (!pack.hashTxt) {
      throw new VerifierError('MISSING_HASH_TXT', 'hash.txt が同梱されていません。');
    }
    const declaredHex = extractHashFromHashTxt(pack.hashTxt, pack.originalFile.name);
    if (declaredHex.toLowerCase() !== computedHex.toLowerCase()) {
      throw new VerifierError(
        'HASH_MISMATCH_LOCAL_VS_HASH_TXT',
        '原本のハッシュが hash.txt と一致しません。改ざんの可能性があります。',
        `local=${computedHex} declared=${declaredHex}`,
      );
    }

    /* ── 2-c. Primary Proof (TSA 未付与) の早期成功 ────────── */
    if (pack.isPendingTsa || !pack.tsrBytes) {
      safeSet({ kind: 'SUCCESS', result: {
        originalFileName: pack.originalFile.name,
        originalFileSize: pack.originalFile.bytes.byteLength,
        computedSha256Hex: computedHex,
        timestampJstHuman: 'ProofMark 内部台帳に記録済 (TSA発行待ち)',
        hadC2pa: pack.hasC2paJson,
        hadChain: pack.hasChainJson,
        durationMs: Math.round(performance.now() - startedAt),
        isPrimaryProofOnly: true,
      }});
      return;
    }

    /* ── 3. RFC3161 署名 + チェーン検証 ─────────────────── */
    safeSet({ kind: 'VERIFYING_SIGNATURE', progress: 0 });
    const parsed = await verifyTimestamp(
      pack.tsrBytes,
      pack.tsaCertDerOrPem!,
      pack.caCertDerOrPem!,
      computedHex,
      (p) => safeSet({ kind: 'VERIFYING_SIGNATURE', progress: p }),
    );

    /* ── 4. SUCCESS ──────────────────────────────────────── */
    const result: VerificationSuccess = {
      originalFileName: pack.originalFile.name,
      originalFileSize: pack.originalFile.bytes.byteLength,
      computedSha256Hex: computedHex,
      tsrSha256Hex: parsed.hashHex,
      timestampUtcIso: parsed.genTime.toISOString(),
      timestampJstHuman: `${JST_FORMATTER.format(parsed.genTime)} (JST)`,
      tsaSubject: parsed.tsaSubject,
      tsaSerialHex: parsed.tsaSerialHex,
      tsrSerialHex: parsed.tsrSerialHex,
      hadC2pa: pack.hasC2paJson,
      hadChain: pack.hasChainJson,
      durationMs: Math.round(performance.now() - startedAt),
    };

    safeSet({ kind: 'SUCCESS', result });
  }, []);

  /* ──────────────────────────────────────────────────────────────
   *  verify: ZIP を受け取り展開 → 原本あれば即検証、なければ待機
   * ────────────────────────────────────────────────────────────── */
  const verify = useCallback(async (archive: File, externalOriginal?: File): Promise<void> => {
    const runId = ++runIdRef.current;
    const startedAt = performance.now();

    const safeSet = (next: VerifierState): void => {
      if (runId !== runIdRef.current) return;
      setState(next);
    };

    try {
      /* ── 1. ZIP 展開 ────────────────────────────────────── */
      safeSet({ kind: 'UNZIPPING', archiveName: archive.name });
      const pack = await loadEvidencePack(archive);

      if (!pack.hashTxt) {
        throw new VerifierError(
          'MISSING_HASH_TXT',
          'hash.txt が同梱されていません。',
        );
      }

      // 原本が ZIP 内に存在しない（Private Proof）
      if (pack.originalFile.bytes.byteLength === 0) {
        if (externalOriginal) {
          // 同時ドロップで原本が添えられていた場合はそのまま検証へ
          const bytes = await externalOriginal.arrayBuffer();
          pack.originalFile = { name: externalOriginal.name, bytes };
        } else {
          // 原本待ち状態へ遷移
          setPendingPack(pack);
          safeSet({ kind: 'AWAITING_ORIGINAL', archiveName: archive.name });
          return;
        }
      }

      await runVerification(pack, runId, startedAt, safeSet);
    } catch (err) {
      if (err instanceof VerifierError) {
        safeSet({
          kind: 'ERROR',
          reason: err.reason,
          message: FAILURE_MESSAGES[err.reason] ?? err.message,
          detail: err.detail,
        });
        return;
      }
      // eslint-disable-next-line no-console
      console.error('[useVerifier] unexpected', err);
      safeSet({
        kind: 'ERROR',
        reason: 'INTERNAL_ERROR',
        message: FAILURE_MESSAGES.INTERNAL_ERROR,
        detail: (err as Error)?.message,
      });
    }
  }, [runVerification]);

  /* ──────────────────────────────────────────────────────────────
   *  resumeWithOriginal: AWAITING_ORIGINAL から再開
   * ────────────────────────────────────────────────────────────── */
  const resumeWithOriginal = useCallback(async (original: File): Promise<void> => {
    if (!pendingPack) return;

    const runId = ++runIdRef.current;
    const startedAt = performance.now();
    const pack = pendingPack;

    const safeSet = (next: VerifierState): void => {
      if (runId !== runIdRef.current) return;
      setState(next);
    };

    // 原本を pack に注入
    const bytes = await original.arrayBuffer();
    pack.originalFile = { name: original.name, bytes };
    setPendingPack(null);

    try {
      await runVerification(pack, runId, startedAt, safeSet);
    } catch (err) {
      if (err instanceof VerifierError) {
        safeSet({
          kind: 'ERROR',
          reason: err.reason,
          message: FAILURE_MESSAGES[err.reason] ?? err.message,
          detail: err.detail,
        });
        return;
      }
      console.error('[useVerifier] unexpected', err);
      safeSet({
        kind: 'ERROR',
        reason: 'INTERNAL_ERROR',
        message: FAILURE_MESSAGES.INTERNAL_ERROR,
        detail: (err as Error)?.message,
      });
    }
  }, [pendingPack, runVerification]);

  return { state, verify, reset, resumeWithOriginal };
}
