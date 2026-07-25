/**
 * src/lib/crypto/identity.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * ProofMark Shadow Identity — Ed25519 / WebCrypto / IndexedDB / Web Locks
 *
 * 絶対契約:
 *  1. 秘密鍵は extractable: false。JS空間への流出は物理的に不可能。
 *  2. IDB保存失敗時はメモリ降格を一切せず、HardBlockError を throw する。
 *  3. 複数タブ衝突を navigator.locks.request で排他制御する。
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── IndexedDB thin wrapper (idb-keyval は未搭載なので raw API で実装) ──────────

const IDB_NAME = 'proofmark-identity';
const IDB_STORE = 'keys';
const IDB_KEY_PUB = 'device-pub';
const IDB_KEY_PRIV = 'device-priv';

function openIDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => {
            req.result.createObjectStore(IDB_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
    });
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const req = tx.objectStore(IDB_STORE).put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ShadowIdentity {
    /** Raw Ed25519 public key bytes as hex (32 bytes = 64 hex chars) */
    devicePub: string;
    /** The non-extractable CryptoKey pair for signing within this session */
    keyPair: CryptoKeyPair;
}

export class HardBlockError extends Error {
    constructor(reason: string) {
        super(`[ProofMark Identity] HARD BLOCK: ${reason}`);
        this.name = 'HardBlockError';
    }
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function bufferToHex(buf: ArrayBuffer): string {
    return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

async function exportPublicKeyHex(pub: CryptoKey): Promise<string> {
    // Ed25519 public key exports as raw 32-byte buffer
    const raw = await crypto.subtle.exportKey('raw', pub);
    return bufferToHex(raw);
}

async function generateEd25519KeyPair(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(
        { name: 'Ed25519' } as unknown as EcKeyGenParams,
        false, // extractable: false — 秘密鍵の JS空間流出を物理的に不可能にする
        ['sign', 'verify'],
    ) as Promise<CryptoKeyPair>;
}

/**
 * IDB への永続化を試みる。
 * QuotaExceededError 等、いかなる失敗時も HardBlockError を throw する。
 * メモリ降格は絶対に行わない。
 */
async function persistIdentity(db: IDBDatabase, identity: ShadowIdentity): Promise<void> {
    // storage.persist() — ブラウザがデータを積極保護するよう要求
    if ('storage' in navigator && 'persist' in navigator.storage) {
        const granted = await navigator.storage.persist().catch(() => false);
        if (!granted) {
            // Safari プライベートモード等では false が返る → Hard Block
            throw new HardBlockError(
                'navigator.storage.persist() が拒否されました。この環境ではデバイス鍵を安全に保存できません。通常モードでご利用ください。',
            );
        }
    }

    try {
        await idbPut(db, IDB_KEY_PUB, identity.devicePub);
        // 秘密鍵は CryptoKey のまま IDB に格納 (structured clone で保持される)
        await idbPut(db, IDB_KEY_PRIV, identity.keyPair.privateKey);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new HardBlockError(
            `IndexedDB への鍵保存に失敗しました (${msg})。この環境では安全な鍵管理ができません。`,
        );
    }
}

/**
 * IDB から既存の鍵ペアを復元する。
 * 復元できない場合は null を返す（初回 or IDB 破損）。
 */
async function loadPersistedIdentity(db: IDBDatabase): Promise<ShadowIdentity | null> {
    try {
        const pubHex = await idbGet<string>(db, IDB_KEY_PUB);
        const privKey = await idbGet<CryptoKey>(db, IDB_KEY_PRIV);

        if (!pubHex || !privKey) return null;

        // Public key を raw bytes から再インポート
        const pubKeyBytes = new Uint8Array(pubHex.length / 2);
        for (let i = 0; i < pubHex.length; i += 2) {
            pubKeyBytes[i / 2] = parseInt(pubHex.slice(i, i + 2), 16);
        }
        const pubKey = await crypto.subtle.importKey(
            'raw',
            pubKeyBytes,
            { name: 'Ed25519' } as unknown as EcKeyImportParams,
            true, // public key は exportable で問題ない
            ['verify'],
        );

        return {
            devicePub: pubHex,
            keyPair: { privateKey: privKey, publicKey: pubKey },
        };
    } catch {
        // IDB 破損時は静かに null を返し、再生成させる
        return null;
    }
}

// ── Public API ─────────────────────────────────────────────────────────────────

const LOCK_NAME = 'proofmark-identity-init';

/**
 * Shadow Identity をロード、または新規生成して永続化する。
 *
 * Web Locks で排他制御し、複数タブでの IDB 衝突を完全に防ぐ。
 * IDB 保存に失敗した場合は HardBlockError を throw する（降格なし）。
 */
export async function loadOrCreateIdentity(): Promise<ShadowIdentity> {
    // Web Locks API が使える環境かチェック
    if (!('locks' in navigator)) {
        throw new HardBlockError(
            'Web Locks API が未サポートです。この環境ではデバイス鍵の排他制御ができません。',
        );
    }

    return navigator.locks.request(LOCK_NAME, { mode: 'exclusive' }, async () => {
        const db = await openIDB().catch((e: unknown) => {
            throw new HardBlockError(
                `IndexedDB のオープンに失敗しました: ${e instanceof Error ? e.message : String(e)}`,
            );
        });

        // 既存の鍵ペアを復元試行
        const existing = await loadPersistedIdentity(db);
        if (existing) return existing;

        // 新規生成
        const keyPair = await generateEd25519KeyPair();
        const devicePub = await exportPublicKeyHex(keyPair.publicKey);
        const identity: ShadowIdentity = { devicePub, keyPair };

        // 永続化 (失敗時は HardBlockError を throw)
        await persistIdentity(db, identity);

        return identity;
    });
}

/**
 * 保存済みの devicePub hex のみをクイック取得する。
 * キーペア全体を使う必要がない UI 表示用。
 */
export async function getDevicePubHex(): Promise<string | null> {
    try {
        const db = await openIDB();
        return (await idbGet<string>(db, IDB_KEY_PUB)) ?? null;
    } catch {
        return null;
    }
}

/**
 * IDB から identity を完全削除（デバッグ / ログアウト用）。
 */
export async function clearIdentity(): Promise<void> {
    const db = await openIDB();
    await idbPut(db, IDB_KEY_PUB, undefined);
    await idbPut(db, IDB_KEY_PRIV, undefined);
}
