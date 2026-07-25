/**
 * src/lib/crypto/hasher.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * ProofMark Adaptive Streaming Hasher (Absolute Zero-Allocation OOM-Free)
 *
 * 絶対契約:
 *  1. 純粋なインクリメンタル SHA-256 クラスを内包し、全結合 (OOM) を物理的に排除。
 *  2. BYOB Reader (Zero-Allocation) を優先使用、非対応 (Safari) はフォールバック。
 *  3. フォールバック時はチャンクタイムを計測して自己適応的にサイズを調整。
 *  4. IDB への状態チェックポイントは SHA-256 の内部ステートを含み Fire-and-Forget (await しない)。
 *  5. 復帰時に IDB 上のチェックポイント (内部ステート) から自動再開する。
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Incremental SHA-256 ───────────────────────────────────────────────────────

const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

class IncrementalSHA256 {
    private H = new Uint32Array([
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ]);
    private block = new Uint8Array(64);
    private blockLen = 0;
    private totalBytes = 0;
    private W = new Uint32Array(64);

    public update(data: Uint8Array): void {
        let offset = 0;
        const len = data.length;
        this.totalBytes += len;

        while (offset < len) {
            const free = 64 - this.blockLen;
            const chunk = Math.min(free, len - offset);
            this.block.set(data.subarray(offset, offset + chunk), this.blockLen);
            this.blockLen += chunk;
            offset += chunk;

            if (this.blockLen === 64) {
                this.processBlock(this.block);
                this.blockLen = 0;
            }
        }
    }

    public digestHex(): string {
        const padBlock = new Uint8Array(64);
        padBlock.set(this.block.subarray(0, this.blockLen));
        padBlock[this.blockLen] = 0x80;
        
        if (this.blockLen >= 56) {
            this.processBlock(padBlock);
            padBlock.fill(0);
        } else {
            padBlock.fill(0, this.blockLen + 1);
        }

        const bitLen = this.totalBytes * 8;
        const bitLenHi = Math.floor(bitLen / 0x100000000) >>> 0;
        const bitLenLo = bitLen >>> 0;

        padBlock[56] = (bitLenHi >>> 24) & 0xff;
        padBlock[57] = (bitLenHi >>> 16) & 0xff;
        padBlock[58] = (bitLenHi >>>  8) & 0xff;
        padBlock[59] =  bitLenHi         & 0xff;
        padBlock[60] = (bitLenLo >>> 24) & 0xff;
        padBlock[61] = (bitLenLo >>> 16) & 0xff;
        padBlock[62] = (bitLenLo >>>  8) & 0xff;
        padBlock[63] =  bitLenLo         & 0xff;

        this.processBlock(padBlock);

        let hex = '';
        for (let i = 0; i < 8; i++) {
            hex += (this.H[i] >>> 0).toString(16).padStart(8, '0');
        }
        return hex;
    }

    private processBlock(buf: Uint8Array): void {
        const W = this.W;
        for (let i = 0; i < 16; i++) {
            W[i] = (buf[i * 4] << 24) | (buf[i * 4 + 1] << 16) | (buf[i * 4 + 2] << 8) | buf[i * 4 + 3];
        }
        for (let i = 16; i < 64; i++) {
            const w15 = W[i - 15], w2 = W[i - 2];
            const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
            const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
            W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
        }

        let [a, b, c, d, e, f, g, h] = this.H;

        for (let i = 0; i < 64; i++) {
            const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
            const ch = (e & f) ^ (~e & g);
            const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
            const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (S0 + maj) >>> 0;

            h = g; g = f; f = e; e = (d + t1) >>> 0;
            d = c; c = b; b = a; a = (t1 + t2) >>> 0;
        }

        this.H[0] = (this.H[0] + a) >>> 0;
        this.H[1] = (this.H[1] + b) >>> 0;
        this.H[2] = (this.H[2] + c) >>> 0;
        this.H[3] = (this.H[3] + d) >>> 0;
        this.H[4] = (this.H[4] + e) >>> 0;
        this.H[5] = (this.H[5] + f) >>> 0;
        this.H[6] = (this.H[6] + g) >>> 0;
        this.H[7] = (this.H[7] + h) >>> 0;
    }

    public exportState(): { H: number[]; remainder: number[]; totalBytes: number } {
        return {
            H: Array.from(this.H),
            remainder: Array.from(this.block.subarray(0, this.blockLen)),
            totalBytes: this.totalBytes
        };
    }

    public importState(state: { H: number[]; remainder: number[]; totalBytes: number }): void {
        this.H.set(state.H);
        this.blockLen = state.remainder.length;
        this.block.set(state.remainder);
        this.totalBytes = state.totalBytes;
    }
}

// ── Checkpoint IDB ─────────────────────────────────────────────────────────────

const CP_DB_NAME = 'proofmark-hasher-checkpoints';
const CP_STORE = 'checkpoints';

function openCpDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(CP_DB_NAME, 1);
        req.onupgradeneeded = () => {
            req.result.createObjectStore(CP_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function saveCheckpointFF(fileKey: string, state: HasherCheckpoint): void {
    openCpDB().then((db) => {
        const tx = db.transaction(CP_STORE, 'readwrite');
        tx.objectStore(CP_STORE).put(state, fileKey);
    }).catch(() => { /* silently ignored */ });
}

async function loadCheckpoint(fileKey: string): Promise<HasherCheckpoint | null> {
    try {
        const db = await openCpDB();
        return await new Promise<HasherCheckpoint | null>((resolve, reject) => {
            const tx = db.transaction(CP_STORE, 'readonly');
            const req = tx.objectStore(CP_STORE).get(fileKey);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror = () => reject(req.error);
        });
    } catch {
        return null;
    }
}

async function clearCheckpoint(fileKey: string): Promise<void> {
    try {
        const db = await openCpDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(CP_STORE, 'readwrite');
            const req = tx.objectStore(CP_STORE).delete(fileKey);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch { /* silently ignored */ }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface HasherCheckpoint {
    fileKey: string;
    processedBytes: number;
    // SHA-256 state components for seamless resume
    stateH: number[];
    remainder: number[];
    totalHashed: number;
}

export interface HashProgress {
    progress: number;
    processedBytes: number;
    totalBytes: number;
}

export type HashProgressCallback = (p: HashProgress) => void;

// ── Adaptive Chunk Calibration ─────────────────────────────────────────────────

const CHUNK_MIN = 64 * 1024;
const CHUNK_MAX = 512 * 1024;
const CHUNK_DEFAULT = 256 * 1024;
const TARGET_CHUNK_MS = 16;

function calibrateChunkSize(currentChunk: number, elapsedMs: number): number {
    if (elapsedMs <= 0) return currentChunk;
    const ratio = TARGET_CHUNK_MS / elapsedMs;
    const next = Math.round(currentChunk * ratio);
    return Math.max(CHUNK_MIN, Math.min(CHUNK_MAX, next));
}

function yield_(): Promise<void> {
    return new Promise((r) => setTimeout(r, 0));
}

function supportsBYOB(): boolean {
    try {
        return typeof ReadableStreamBYOBReader !== 'undefined';
    } catch {
        return false;
    }
}

function fileKey(file: File): string {
    return `${file.name}::${file.size}::${file.lastModified}`;
}

// ── Core Hash Computation ──────────────────────────────────────────────────────

async function hashWithBYOB(
    file: File,
    onProgress?: HashProgressCallback,
    signal?: AbortSignal,
): Promise<string> {
    const key = fileKey(file);
    const cp = await loadCheckpoint(key);
    
    const hasher = new IncrementalSHA256();
    let processedBytes = 0;

    if (cp) {
        hasher.importState({
            H: cp.stateH,
            remainder: cp.remainder,
            totalBytes: cp.totalHashed
        });
        processedBytes = cp.processedBytes;
    }

    const stream = file.slice(processedBytes).stream();
    const reader = stream.getReader({ mode: 'byob' }) as ReadableStreamBYOBReader;
    
    let buf = new ArrayBuffer(CHUNK_MAX);

    while (true) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const { done, value } = await reader.read(new Uint8Array(buf));
        if (done) break;

        buf = value.buffer;
        const chunk = value.subarray(0, value.byteLength);
        
        hasher.update(chunk);
        processedBytes += chunk.byteLength;

        const state = hasher.exportState();
        saveCheckpointFF(key, {
            fileKey: key,
            processedBytes,
            stateH: state.H,
            remainder: state.remainder,
            totalHashed: state.totalBytes
        });

        if (onProgress) {
            onProgress({
                progress: processedBytes / file.size,
                processedBytes,
                totalBytes: file.size,
            });
        }

        await yield_();
        buf = new ArrayBuffer(CHUNK_MAX);
    }

    await clearCheckpoint(key);
    return hasher.digestHex();
}

async function hashWithFallback(
    file: File,
    onProgress?: HashProgressCallback,
    signal?: AbortSignal,
): Promise<string> {
    const key = fileKey(file);
    const cp = await loadCheckpoint(key);

    const hasher = new IncrementalSHA256();
    let chunkSize = CHUNK_DEFAULT;
    let processedBytes = 0;

    if (cp) {
        hasher.importState({
            H: cp.stateH,
            remainder: cp.remainder,
            totalBytes: cp.totalHashed
        });
        processedBytes = cp.processedBytes;
    }

    while (processedBytes < file.size) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const end = Math.min(processedBytes + chunkSize, file.size);
        const chunkStart = performance.now();

        const ab = await file.slice(processedBytes, end).arrayBuffer();
        const chunk = new Uint8Array(ab);
        
        hasher.update(chunk);

        const elapsedMs = performance.now() - chunkStart;
        chunkSize = calibrateChunkSize(chunkSize, elapsedMs);
        processedBytes = end;

        const state = hasher.exportState();
        saveCheckpointFF(key, {
            fileKey: key,
            processedBytes,
            stateH: state.H,
            remainder: state.remainder,
            totalHashed: state.totalBytes
        });

        if (onProgress) {
            onProgress({
                progress: processedBytes / file.size,
                processedBytes,
                totalBytes: file.size,
            });
        }

        await yield_();
    }

    await clearCheckpoint(key);
    return hasher.digestHex();
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function computeFileHash(
    file: File,
    options?: {
        onProgress?: HashProgressCallback;
        signal?: AbortSignal;
    },
): Promise<string> {
    const { onProgress, signal } = options ?? {};

    if (supportsBYOB()) {
        try {
            return await hashWithBYOB(file, onProgress, signal);
        } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') throw e;
            console.warn('[Hasher] BYOB failed, using fallback:', e);
        }
    }

    return hashWithFallback(file, onProgress, signal);
}

export async function getHashCheckpoint(file: File): Promise<number | null> {
    const cp = await loadCheckpoint(fileKey(file));
    return cp?.processedBytes ?? null;
}