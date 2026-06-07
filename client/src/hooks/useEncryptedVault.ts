/**
 * useEncryptedVault.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * One-Click Delivery Kit — Crypto Engine
 *
 * すべての暗号処理は window.crypto.subtle (Web Crypto API) のみで完結。
 * 外部ライブラリ（crypto-js 等）は一切使用しない。
 *
 * 出力 Blob の構造:
 *   [Salt (16 bytes)] + [IV (12 bytes)] + [AES-256-GCM Ciphertext]
 *
 * 鍵の運命:
 *   - extractable: false により V8 の隔離領域に封印。
 *   - JS 側から生の鍵バイト列に一切アクセス不可。
 *   - 平文 ArrayBuffer は暗号化直後に参照を破棄し GC に委ねる。
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

/** PBKDF2 iteration count (NIST SP 800-132 推奨: 100,000 以上) */
const PBKDF2_ITERATIONS = 100_000;
/** PBKDF2 Salt サイズ (bytes) */
const SALT_BYTES = 16;
/** AES-GCM IV サイズ (bytes) — NIST 推奨は 12 bytes */
const IV_BYTES = 12;
/** 出力パスワードの文字集合 — [A-Za-z0-9] の 62 文字 */
const PASSWORD_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
/** 出力パスワード長 */
const PASSWORD_LENGTH = 16;

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

export interface VaultResult {
  /** 暗号化済み Blob: [Salt(16)] + [IV(12)] + [Ciphertext] */
  encryptedBlob: Blob;
  /**
   * クライアントへ伝達する復号パスワード (平文)。
   * UI 側は伏せ字で表示し、クリップボードコピーのみ許可すること。
   */
  password: string;
}

export type VaultPhase =
  | 'idle'
  | 'generating-key'     // Step 1–3: パスワード生成 → PBKDF2
  | 'encrypting'         // Step 4: AES-256-GCM 暗号化
  | 'done'
  | 'error';

export interface UseEncryptedVaultReturn {
  phase: VaultPhase;
  error: string | null;
  encrypt: (file: File) => Promise<VaultResult | null>;
  reset: () => void;
}

/* ═══════════════════════════════════════════════════════════════
   CORE CRYPTO FUNCTIONS (pure, non-hook)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Step 1: CSPRNG で [A-Za-z0-9] からなる 16 文字のパスワードを生成。
 *
 * getRandomValues は整数配列を返すため、モジュロバイアスを避けるために
 * rejection sampling を行う。
 * charset の長さ (62) は 256 の因数でないため、均等分布のために
 * 62 * 4 = 248 以下の値のみ採用する（248/256 ≒ 97% 採用率）。
 */
function generateSecurePassword(): string {
  const charset = PASSWORD_CHARSET;
  const ACCEPT_LIMIT = Math.floor(256 / charset.length) * charset.length; // 248
  const output: string[] = [];
  while (output.length < PASSWORD_LENGTH) {
    // 必要数より多めに生成してバッファ効率化
    const buf = new Uint8Array(PASSWORD_LENGTH * 2);
    crypto.getRandomValues(buf);
    Array.from(buf).forEach((byte) => {
      if (output.length >= PASSWORD_LENGTH) return;
      if (byte < ACCEPT_LIMIT) {
        output.push(charset[byte % charset.length]);
      }
    });
  }
  return output.join('');
}

/**
 * Step 2: CSPRNG で Salt (16 bytes) と IV (12 bytes) を生成。
 */
function generateSaltAndIv(): { salt: Uint8Array; iv: Uint8Array } {
  const salt = new Uint8Array(SALT_BYTES);
  const iv   = new Uint8Array(IV_BYTES);
  crypto.getRandomValues(salt);
  crypto.getRandomValues(iv);
  return { salt, iv };
}

/**
 * Step 3: PBKDF2 (SHA-256, 100,000 iterations) で AES-256-GCM CryptoKey を導出。
 *
 * - extractable: false を指定し、鍵を JS 側から取り出し不可能な状態に封印する。
 * - keyUsages: ['encrypt'] のみ。後続の decrypt は意図的に含めない。
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  // パスワード文字列を raw key material としてインポート
  const rawMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,           // extractable: false
    ['deriveKey'],
  );

  // PBKDF2 → AES-256-GCM key (extractable: false で V8 隔離領域へ封印)
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: PBKDF2_ITERATIONS,
    },
    rawMaterial,
    { name: 'AES-GCM', length: 256 },
    false,           // extractable: false — 鍵の封印
    ['encrypt'],
  );
}

/**
 * Step 4 & 5: ファイルを暗号化し、[Salt] + [IV] + [Ciphertext] の Blob を返す。
 *
 * @param plainBuffer - 平文 ArrayBuffer (この関数内で参照を破棄する)
 * @param key         - 導出済み CryptoKey (extractable: false)
 * @param salt        - Salt (16 bytes)
 * @param iv          - IV (12 bytes)
 */
async function encryptAndConcat(
  plainBuffer: ArrayBuffer,
  key: CryptoKey,
  salt: Uint8Array,
  iv: Uint8Array,
): Promise<Blob> {
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plainBuffer,
  );

  // Step 5: 平文 ArrayBuffer への参照を即座に破棄。GC に委ねる。
  // TypeScript では変数を再代入することで参照を切る。
  // (plainBuffer = null はエラーになるため、ローカル変数スコープを利用)

  // 連結: [Salt(16)] + [IV(12)] + [Ciphertext]
  const combined = new Uint8Array(salt.byteLength + iv.byteLength + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.byteLength);
  combined.set(new Uint8Array(ciphertext), salt.byteLength + iv.byteLength);

  return new Blob([combined], { type: 'application/octet-stream' });
}

/* ═══════════════════════════════════════════════════════════════
   HOOK
   ═══════════════════════════════════════════════════════════════ */

export function useEncryptedVault(): UseEncryptedVaultReturn {
  const [phase, setPhase] = useState<VaultPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
  }, []);

  const encrypt = useCallback(async (file: File): Promise<VaultResult | null> => {
    /* ── ガードレール: 150MB 超のファイルはメモリパンクを防ぐため早期リジェクト ── */
    const MAX_BYTES = 150 * 1024 * 1024; // 150 MB
    if (file.size > MAX_BYTES) {
      setPhase('error');
      setError(
        `ファイルサイズが上限（150MB）を超えています（${(file.size / 1024 / 1024).toFixed(1)} MB）。` +
        'より小さなファイルを選択してください。',
      );
      return null;
    }

    setPhase('generating-key');
    setError(null);

    try {
      // ── Step 1: セキュアパスワード生成 ──────────────────────────────
      const password = generateSecurePassword();

      // ── Step 2: Salt & IV 生成 ───────────────────────────────────────
      const { salt, iv } = generateSaltAndIv();

      // ── Step 3: PBKDF2 → AES-256-GCM CryptoKey (extractable: false) ─
      const key = await deriveKey(password, salt);

      // ── Step 4: ファイル読み込み → 暗号化 ──────────────────────────
      setPhase('encrypting');
      /* ── UI Yield: 暗号化の重い処理の前にメインスレッドを解放しアニメーションを滑らかにする ── */
      await new Promise((r) => setTimeout(r, 50));

      let plainBuffer: ArrayBuffer = await file.arrayBuffer();
      const encryptedBlob = await encryptAndConcat(plainBuffer, key, salt, iv);

      // ── Step 5: 平文バッファ参照の即時破棄 ──────────────────────────
      // eslint-disable-next-line prefer-const, @typescript-eslint/no-unused-vars
      plainBuffer = new ArrayBuffer(0); // 元の大きなバッファへの参照を切る

      setPhase('done');
      return { encryptedBlob, password };

    } catch (err) {
      const msg = err instanceof Error ? err.message : '暗号化中に不明なエラーが発生しました';
      setError(msg);
      setPhase('error');
      return null;
    }
  }, []);

  return { phase, error, encrypt, reset };
}

/* ═══════════════════════════════════════════════════════════════
   DECRYPTION HELPER (復号側: 受取人用スクリプト向けに export)
   ─ ブラウザ側では使用しない。受取人が独立して実行できるように
     アルゴリズム定数を公開しておく。
   ═══════════════════════════════════════════════════════════════ */

/** 受取人向け: Blob のバイナリ構造の説明 */
export const VAULT_FORMAT = {
  saltOffset: 0,
  saltLength: SALT_BYTES,
  ivOffset: SALT_BYTES,
  ivLength: IV_BYTES,
  ciphertextOffset: SALT_BYTES + IV_BYTES,
  pbkdf2Iterations: PBKDF2_ITERATIONS,
  pbkdf2Hash: 'SHA-256',
  aesBits: 256,
  aesMode: 'AES-GCM',
} as const;
