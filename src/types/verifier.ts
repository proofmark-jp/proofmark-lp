/**
 * types/verifier.ts
 * ──────────────────────────────────────────────────────────────────
 *  ProofMark Web Verifier — strict type definitions
 *
 *  すべての検証フェーズと失敗理由を discriminated union で表現する。
 *  UI 側は exhaustive switch でメッセージを描画する。
 * ──────────────────────────────────────────────────────────────────
 */

/* ─────────────────────────────────────────────
 *  State machine
 * ───────────────────────────────────────────── */

export type VerifierState =
  | { kind: 'IDLE' }
  | { kind: 'UNZIPPING';            archiveName: string }
  | { kind: 'HASHING';               progress: number;   fileName: string }
  | { kind: 'VERIFYING_SIGNATURE';   progress: number }
  | { kind: 'AWAITING_ORIGINAL';     archiveName: string }
  | { kind: 'SUCCESS';               result: VerificationSuccess }
  | { kind: 'ERROR';                 reason: VerificationFailureReason; message: string; detail?: string };


/* ─────────────────────────────────────────────
 *  Success payload
 * ───────────────────────────────────────────── */

export interface VerificationSuccess {
  /** 原本ファイル名 (original/ 配下) */
  originalFileName: string;
  /** 原本ファイルサイズ (bytes) */
  originalFileSize: number;
  /** ローカルで計算した SHA-256 (hex, lowercase) */
  computedSha256Hex: string;
  /** TSR から取り出した messageImprint (hex, lowercase) — TSA未付与時は省略 */
  tsrSha256Hex?: string;
  /** TSR が示すタイムスタンプ発行時刻 (UTC, ISO 8601) — TSA未付与時は省略 */
  timestampUtcIso?: string;
  /** 人間に見せる JST フォーマット */
  timestampJstHuman: string;
  /** TSA の証明書 Subject DN (人間可読) — TSA未付与時は省略 */
  tsaSubject?: string;
  /** TSA 証明書のシリアル (hex) — TSA未付与時は省略 */
  tsaSerialHex?: string;
  /** 同梱されていたか — 検証完了時のスナップショット */
  hadC2pa: boolean;
  hadChain: boolean;
  /** TSR の serialNumber (hex) — 監査ログ用、TSA未付与時は省略 */
  tsrSerialHex?: string;
  /** 検証に要した時間 (ms) */
  durationMs: number;
  /** TSA が未発行の Primary Proof のみ (SHA-256 台帳照合成功) */
  isPrimaryProofOnly?: boolean;
}

/* ─────────────────────────────────────────────
 *  Failure taxonomy
 * ───────────────────────────────────────────── */

export type VerificationFailureReason =
  /* — Pack layout — */
  | 'INVALID_ZIP'
  | 'ZIP_SLIP_DETECTED'
  | 'PACK_LAYOUT_INVALID'
  | 'MISSING_TIMESTAMP'
  | 'MISSING_ORIGINAL'
  | 'MISSING_HASH_TXT'
  | 'MISSING_TSA_CERT'
  | 'MISSING_CA_CERT'
  | 'TIMESTAMP_EXPLICITLY_MISSING'

  /* — Crypto / hash — */
  | 'HASH_TXT_MALFORMED'
  | 'HASH_MISMATCH_LOCAL_VS_HASH_TXT'
  | 'HASH_MISMATCH_LOCAL_VS_TSR'

  /* — TSR / PKI — */
  | 'TSR_PARSE_FAILED'
  | 'TSR_STATUS_REJECTED'
  | 'TSR_UNSUPPORTED_HASH_ALGORITHM'
  | 'INVALID_TSA_SIGNATURE'
  | 'TSA_CERT_NOT_TRUSTED'
  | 'TSA_CERT_EXPIRED_AT_GENTIME'

  /* — Misc — */
  | 'BROWSER_UNSUPPORTED'
  | 'INTERNAL_ERROR';

export interface ParsedTimestamp {
  /** TSR の messageImprint.hashedMessage (hex) */
  hashHex: string;
  /** 使用ハッシュアルゴリズム OID (確認用) */
  hashAlgorithmOid: string;
  /** TSA 発行時刻 */
  genTime: Date;
  /** TSA cert の Subject CN ベース文字列 */
  tsaSubject: string;
  /** TSA cert のシリアル (hex) */
  tsaSerialHex: string;
  /** TSR の serialNumber */
  tsrSerialHex: string;
  /** SignedData 検証の結果 */
  signatureValid: boolean;
  /** 証明書チェーン検証の結果 */
  chainValid: boolean;
}

/* ─────────────────────────────────────────────
 *  Loaded Evidence Pack (in-memory)
 * ───────────────────────────────────────────── */

export interface LoadedEvidencePack {
  archiveName: string;
  originalFile: { name: string; bytes: ArrayBuffer };
  /** TSA 未付与パックでは null */
  tsrBytes: ArrayBuffer | null;
  tsaCertDerOrPem: ArrayBuffer | null;
  caCertDerOrPem: ArrayBuffer | null;
  /** hash.txt の本文 (存在すれば) */
  hashTxt: string | null;
  /** c2pa.json / chain.json はメタ情報のみ追跡 */
  hasC2paJson: boolean;
  hasChainJson: boolean;
  /** timestamp.MISSING.txt が同梱されていた — TSA 発行待ちとして正常扱い */
  timestampMissingSentinel: boolean;
  /** TSA トークンが未発行の Primary Proof パック */
  isPendingTsa?: boolean;
}
