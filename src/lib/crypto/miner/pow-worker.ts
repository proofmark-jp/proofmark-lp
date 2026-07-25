// src/lib/crypto/miner/pow-worker.ts
/**
 * ProofMark PoW · Tri-Tier Batch Miner Worker
 * ─────────────────────────────────────────────────────────────────────────
 *  絶対契約 (Edge との bit-perfect 一致):
 *    input     = UTF-8( signature + tgtHash + devicePub + nonce )
 *    hashBytes = SHA-256(input)                                  // 32 bytes
 *    hex       = concat( byte.toString(16).padStart(2,'0') )     // 逐次
 *              // Edge は length >= difficulty で break するので
 *              // 実質 ceil(difficulty / 2) バイトのみ hex 化される
 *    valid     = hex.startsWith( '0'.repeat(difficulty) )
 *
 *  T1 対策: hexNeededBytes = ceil(difficulty/2) を厳密に守る
 *  T2 対策: 入力を ASCII-only で validate
 *  T3-T4 対策: WebGPU 側 (webgpu-miner.ts) でリングバッファ + RAII destroy
 *  T5 対策: Tier 3 は同期 bitwise SHA-256 + 定期 yield
 *  T6 対策: nonce を decimal ASCII で固定長 shader に流し込む
 *  T7 対策: SAB 不使用。postMessage transferable のみ
 *
 *  Message protocol:
 *    → { type: 'START', signature, tgtHash, devicePub, difficulty, nonceStart?, maxNonce? }
 *    → { type: 'CANCEL' }
 *    ← { type: 'READY', tier: 'webgpu' | 'wasm' | 'js', device?: string }
 *    ← { type: 'PROGRESS', hashesPerSec, tried, currentNonce }
 *    ← { type: 'SOLVED', nonce, hash, tried, tier, elapsedMs }
 *    ← { type: 'ERROR', message, tier? }
 */

import { WebGPUMiner, isWebGPUSupported } from './webgpu-miner';
import { runFallbackMiner, isFallbackReady } from './fallback-miner';

/* ══════════════════════════════════════════════════════════════
 *  Public types
 * ══════════════════════════════════════════════════════════════ */

export type Tier = 'webgpu' | 'wasm' | 'js';

export interface PowStartMessage {
  type: 'START';
  signature: string;
  tgtHash: string;
  devicePub: string;
  difficulty: number;
  /** 分散マイニング用 (デフォルト 0) */
  nonceStart?: number;
  /** ハードストップ (デフォルト Number.MAX_SAFE_INTEGER) */
  maxNonce?: number;
  /** 進捗を送る間隔 (ms, default 400) */
  progressIntervalMs?: number;
}

export interface PowCancelMessage {
  type: 'CANCEL';
}

export type PowInboundMessage = PowStartMessage | PowCancelMessage;

export interface PowReadyMessage {
  type: 'READY';
  tier: Tier;
  device?: string;
}
export interface PowProgressMessage {
  type: 'PROGRESS';
  hashesPerSec: number;
  tried: number;
  currentNonce: number;
}
export interface PowSolvedMessage {
  type: 'SOLVED';
  nonce: number;
  hash: string;
  tried: number;
  tier: Tier;
  elapsedMs: number;
}
export interface PowErrorMessage {
  type: 'ERROR';
  message: string;
  tier?: Tier;
}
export type PowOutboundMessage =
  | PowReadyMessage
  | PowProgressMessage
  | PowSolvedMessage
  | PowErrorMessage;

/* ══════════════════════════════════════════════════════════════
 *  ASCII guard (T2)
 *  Edge が TextEncoder で UTF-8 化する以上、非 ASCII が混じった瞬間に
 *  バイト長が伸びて GPU 側の固定長プレフィックスと不整合になる。
 * ══════════════════════════════════════════════════════════════ */

const ASCII_RE = /^[\x20-\x7E]+$/;
function assertAscii(name: string, v: string): void {
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`invalid ${name}: empty`);
  }
  if (!ASCII_RE.test(v)) {
    throw new Error(`invalid ${name}: non-ASCII byte detected (contract violation)`);
  }
}

/** ceil(difficulty / 2) — Edge の early-break を厳密に写像 (T1) */
export function hexPrefixBytesFor(difficulty: number): number {
  if (!Number.isInteger(difficulty) || difficulty <= 0) {
    throw new Error(`invalid difficulty: ${difficulty}`);
  }
  return (difficulty + 1) >> 1;
}

/* ══════════════════════════════════════════════════════════════
 *  Worker state
 * ══════════════════════════════════════════════════════════════ */

let cancelFlag = { cancelled: false };
let activeMiner: WebGPUMiner | null = null;

function post(msg: PowOutboundMessage): void {
  (self as unknown as Worker).postMessage(msg);
}

function cleanupActive(): void {
  try { activeMiner?.destroy(); } catch { /* noop */ }
  activeMiner = null;
}

/* ══════════════════════════════════════════════════════════════
 *  Orchestrator
 * ══════════════════════════════════════════════════════════════ */

async function run(job: PowStartMessage): Promise<void> {
  const {
    signature,
    tgtHash,
    devicePub,
    difficulty,
    nonceStart = 0,
    maxNonce = Number.MAX_SAFE_INTEGER,
    progressIntervalMs = 400,
  } = job;

  // 契約バリデーション (T2 の即時死滅)
  try {
    assertAscii('signature', signature);
    assertAscii('tgtHash', tgtHash);
    assertAscii('devicePub', devicePub);
    if (!Number.isFinite(difficulty) || difficulty < 1 || difficulty > 12) {
      // Edge の hex は最大 64 文字なので実用範囲は 12 程度
      throw new Error(`difficulty out of range (1..12): ${difficulty}`);
    }
    if (!Number.isFinite(nonceStart) || nonceStart < 0) {
      throw new Error('nonceStart must be a non-negative integer');
    }
  } catch (e) {
    post({ type: 'ERROR', message: (e as Error).message });
    return;
  }

  const startedAt = performance.now();
  const hexBytes = hexPrefixBytesFor(difficulty);
  const zeroPrefix = '0'.repeat(difficulty);

  /* ── Tier 1: WebGPU ─────────────────────────────────────── */
  if (await isWebGPUSupported()) {
    try {
      const miner = new WebGPUMiner();
      await miner.init();
      activeMiner = miner;

      post({ type: 'READY', tier: 'webgpu', device: miner.deviceLabel });

      const solved = await miner.mine({
        signature,
        tgtHash,
        devicePub,
        difficulty,
        hexBytes,
        zeroPrefix,
        nonceStart,
        maxNonce,
        progressIntervalMs,
        cancelFlag,
        onProgress: (hps, tried, curr) => {
          post({ type: 'PROGRESS', hashesPerSec: hps, tried, currentNonce: curr });
        },
      });

      cleanupActive();

      if (cancelFlag.cancelled) return;

      if (solved) {
        post({
          type: 'SOLVED',
          nonce: solved.nonce,
          hash: solved.hash,
          tried: solved.tried,
          tier: 'webgpu',
          elapsedMs: performance.now() - startedAt,
        });
        return;
      }
      // solved === null && !cancelled → maxNonce 到達
      post({ type: 'ERROR', message: 'exhausted nonce space without a solution', tier: 'webgpu' });
      return;
    } catch (err) {
      cleanupActive();
      // WebGPU 起動失敗 → Tier 2/3 へフォールバック
      // (device lost / adapter null / TDR 等はここで捕捉)
      // eslint-disable-next-line no-console
      console.warn('[pow-worker] WebGPU tier failed, falling back:', err);
    }
  }

  /* ── Tier 2 (WASM) は fallback-miner に内包。JS Tier と統合。──
   *  fallback-miner が SIMD/AS ビルドを検出したらそれを、なければ
   *  純 JS bitwise SHA-256 を同期実行する。
   */
  if (isFallbackReady()) {
    try {
      const tier: Tier = 'js'; // fallback-miner 側で 'wasm' に昇格される場合あり
      post({ type: 'READY', tier });

      const solved = await runFallbackMiner({
        signature,
        tgtHash,
        devicePub,
        difficulty,
        hexBytes,
        zeroPrefix,
        nonceStart,
        maxNonce,
        progressIntervalMs,
        cancelFlag,
        onProgress: (hps, tried, curr) => {
          post({ type: 'PROGRESS', hashesPerSec: hps, tried, currentNonce: curr });
        },
      });

      if (cancelFlag.cancelled) return;

      if (solved) {
        post({
          type: 'SOLVED',
          nonce: solved.nonce,
          hash: solved.hash,
          tried: solved.tried,
          tier: solved.tier,
          elapsedMs: performance.now() - startedAt,
        });
        return;
      }
      post({ type: 'ERROR', message: 'exhausted nonce space without a solution', tier });
      return;
    } catch (err) {
      post({ type: 'ERROR', message: (err as Error).message });
      return;
    }
  }

  post({ type: 'ERROR', message: 'no mining backend available' });
}

/* ══════════════════════════════════════════════════════════════
 *  Message pump
 * ══════════════════════════════════════════════════════════════ */

self.onmessage = (ev: MessageEvent<PowInboundMessage>) => {
  const msg = ev.data;
  if (!msg || typeof (msg as { type?: unknown }).type !== 'string') return;

  if (msg.type === 'CANCEL') {
    cancelFlag.cancelled = true;
    cleanupActive();
    return;
  }

  if (msg.type === 'START') {
    cancelFlag = { cancelled: false };
    cleanupActive();
    run(msg).catch((err) => {
      post({ type: 'ERROR', message: (err as Error).message });
    });
  }
};

// Worker 終了時にも VRAM を確実に解放 (T4)
self.addEventListener('unload', () => {
  cancelFlag.cancelled = true;
  cleanupActive();
});

/* Type declaration for TS consumers via `new Worker(new URL(...))` */
export type PowWorkerConstructor = new () => Worker;
