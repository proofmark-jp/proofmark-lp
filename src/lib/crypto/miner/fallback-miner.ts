// src/lib/crypto/miner/fallback-miner.ts
/**
 * ProofMark PoW · Tier 2/3 · Fallback Miner
 * ─────────────────────────────────────────────────────────────────────────
 *  Tier 2 (優先): AssemblyScript ライクな極小 SHA-256 の同期実装。
 *    - CSP (unsafe-eval 不可) 環境でも動くよう、Base64 埋め込み WASM ではなく
 *      "純 JS だが SIMD で最適化できる形" にした 32bit bitwise 実装を用いる。
 *      ※ WebAssembly.instantiate は動的なので、CSP で 'wasm-eval' が
 *         許可されていない環境 (デフォルト Vite PWA) では起動不能。
 *         よって、ここでは wasm を "使わない" ことが最大の防弾。
 *      ※ もし将来 wasm を許すなら tryWasmBackend() の中で instantiate 可。
 *
 *  Tier 3 (主軸): Pure JS bitwise SHA-256 同期ループ + 定期 yield (T5)。
 *    - crypto.subtle.digest は使わない (microtask 渋滞 & 熱暴走の温床)。
 *    - 8192 nonce 毎に setTimeout(0) で yield し、cancel と進捗を反映。
 */

import type { MineOptions, MineResult } from './webgpu-miner';

export type FallbackTier = 'wasm' | 'js';

export interface FallbackResult extends MineResult {
  tier: FallbackTier;
}

/** 常に true — このモジュールが読めていれば fallback 可能 */
export function isFallbackReady(): boolean {
  return true;
}

/* ══════════════════════════════════════════════════════════════
 *  Tier 2 探査: WASM が使えるかを "静的に" 判定
 *  (CSP で 'wasm-eval' が拒否されていれば false)
 * ══════════════════════════════════════════════════════════════ */

let wasmProbedResult: boolean | null = null;
async function tryWasmBackend(): Promise<boolean> {
  if (wasmProbedResult !== null) return wasmProbedResult;
  try {
    if (typeof WebAssembly === 'undefined' || typeof WebAssembly.instantiate !== 'function') {
      wasmProbedResult = false;
      return false;
    }
    // 最小 wasm ("empty module") で instantiate が通るかだけ試す
    // \x00asm\x01\x00\x00\x00 の 8 バイト
    const bytes = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    await WebAssembly.instantiate(bytes);
    // 通っても、本実装では JS bitwise が既に十分速いので JS を使う。
    // wasmProbedResult = true にしても、mine 側では js を選ぶ。
    wasmProbedResult = true;
    return true;
  } catch {
    wasmProbedResult = false;
    return false;
  }
}

/* ══════════════════════════════════════════════════════════════
 *  Pure JS bitwise SHA-256 (T3 主軸)
 *  - 事前アロケートされた Uint32Array で GC 圧を消す
 *  - inline hot-path: safe_add 等の関数コールを排除
 * ══════════════════════════════════════════════════════════════ */

// eslint-disable-next-line prefer-const
let K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);

/**
 * SHA-256 single-shot on a byte buffer.
 * out: Uint8Array(32)
 */
function sha256(msg: Uint8Array, msgLen: number, W: Uint32Array, out: Uint8Array): void {
  // padding: msg[msgLen..paddedLen+8) must be writable in caller
  const bitLen = msgLen * 8;
  const bitLenLo = (bitLen >>> 0);
  const bitLenHi = Math.floor(bitLen / 0x100000000) >>> 0;

  msg[msgLen] = 0x80;
  let paddedLen = msgLen + 1;
  const rem = paddedLen % 64;
  const need = rem <= 56 ? 56 - rem : 120 - rem;
  for (let i = 0; i < need; i++) msg[paddedLen + i] = 0;
  paddedLen += need;
  // length in bits (BE, 8 bytes)
  msg[paddedLen + 0] = (bitLenHi >>> 24) & 0xff;
  msg[paddedLen + 1] = (bitLenHi >>> 16) & 0xff;
  msg[paddedLen + 2] = (bitLenHi >>> 8) & 0xff;
  msg[paddedLen + 3] = bitLenHi & 0xff;
  msg[paddedLen + 4] = (bitLenLo >>> 24) & 0xff;
  msg[paddedLen + 5] = (bitLenLo >>> 16) & 0xff;
  msg[paddedLen + 6] = (bitLenLo >>> 8) & 0xff;
  msg[paddedLen + 7] = bitLenLo & 0xff;
  const total = paddedLen + 8;

  let H0 = 0x6a09e667 | 0, H1 = 0xbb67ae85 | 0, H2 = 0x3c6ef372 | 0, H3 = 0xa54ff53a | 0;
  let H4 = 0x510e527f | 0, H5 = 0x9b05688c | 0, H6 = 0x1f83d9ab | 0, H7 = 0x5be0cd19 | 0;

  for (let chunk = 0; chunk < total; chunk += 64) {
    for (let i = 0; i < 16; i++) {
      const j = chunk + i * 4;
      W[i] = ((msg[j] << 24) | (msg[j + 1] << 16) | (msg[j + 2] << 8) | msg[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const w15 = W[i - 15], w2 = W[i - 2];
      const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
      const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
      W[i] = ((W[i - 16] + s0 + W[i - 7] + s1) >>> 0);
    }
    let a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H0 = (H0 + a) >>> 0; H1 = (H1 + b) >>> 0; H2 = (H2 + c) >>> 0; H3 = (H3 + d) >>> 0;
    H4 = (H4 + e) >>> 0; H5 = (H5 + f) >>> 0; H6 = (H6 + g) >>> 0; H7 = (H7 + h) >>> 0;
  }

  out[0]  = (H0 >>> 24) & 0xff; out[1]  = (H0 >>> 16) & 0xff; out[2]  = (H0 >>> 8) & 0xff; out[3]  = H0 & 0xff;
  out[4]  = (H1 >>> 24) & 0xff; out[5]  = (H1 >>> 16) & 0xff; out[6]  = (H1 >>> 8) & 0xff; out[7]  = H1 & 0xff;
  out[8]  = (H2 >>> 24) & 0xff; out[9]  = (H2 >>> 16) & 0xff; out[10] = (H2 >>> 8) & 0xff; out[11] = H2 & 0xff;
  out[12] = (H3 >>> 24) & 0xff; out[13] = (H3 >>> 16) & 0xff; out[14] = (H3 >>> 8) & 0xff; out[15] = H3 & 0xff;
  out[16] = (H4 >>> 24) & 0xff; out[17] = (H4 >>> 16) & 0xff; out[18] = (H4 >>> 8) & 0xff; out[19] = H4 & 0xff;
  out[20] = (H5 >>> 24) & 0xff; out[21] = (H5 >>> 16) & 0xff; out[22] = (H5 >>> 8) & 0xff; out[23] = H5 & 0xff;
  out[24] = (H6 >>> 24) & 0xff; out[25] = (H6 >>> 16) & 0xff; out[26] = (H6 >>> 8) & 0xff; out[27] = H6 & 0xff;
  out[28] = (H7 >>> 24) & 0xff; out[29] = (H7 >>> 16) & 0xff; out[30] = (H7 >>> 8) & 0xff; out[31] = H7 & 0xff;
}

/* Edge の hex early-break を厳密に写像した prefix check */
const HEX = '0123456789abcdef';
function matchesPrefix(hash: Uint8Array, hexBytes: number, difficulty: number): string | null {
  // 完全 zero バイト数 = difficulty >> 1
  const full = difficulty >> 1;
  for (let i = 0; i < full; i++) {
    if (hash[i] !== 0) return null;
  }
  if ((difficulty & 1) === 1) {
    if ((hash[full] >>> 4) !== 0) return null;
  }
  // hex を hexBytes だけ生成 (Edge の break を bit-perfect に模倣)
  let hex = '';
  for (let i = 0; i < hexBytes; i++) {
    const b = hash[i];
    hex += HEX[b >>> 4] + HEX[b & 0x0f];
    if (hex.length >= difficulty) break;
  }
  return hex.startsWith('0'.repeat(difficulty)) ? hex : null;
}

/* ══════════════════════════════════════════════════════════════
 *  Yield helper (T5)
 *  setTimeout(0) は iOS で最短 4ms にクランプされるが、
 *  熱暴走を防ぐには十分。MessageChannel より予測可能。
 * ══════════════════════════════════════════════════════════════ */

const YIELD_INTERVAL = 8192;
function yieldToLoop(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

/* ══════════════════════════════════════════════════════════════
 *  Runner
 * ══════════════════════════════════════════════════════════════ */

export async function runFallbackMiner(opt: MineOptions): Promise<FallbackResult | null> {
  // WASM が使えるかは統計目的で probe するのみ。実際の hot loop は
  // 最速な pure JS bitwise を使う (小サイズメッセージでは JS が勝つ)。
  await tryWasmBackend();
  const tier: FallbackTier = 'js';

  const prefixBytes = new TextEncoder().encode(opt.signature + opt.tgtHash + opt.devicePub);
  const prefixLen = prefixBytes.length;

  // 事前アロケート: prefix + 最大20桁 nonce + 72 byte pad space
  const MSG_CAP = prefixLen + 20 + 72;
  const msg = new Uint8Array(MSG_CAP);
  msg.set(prefixBytes, 0);

  const W = new Uint32Array(64);
  const hashOut = new Uint8Array(32);

  const startedAt = performance.now();
  let lastProgressAt = startedAt;
  let tried = 0;
  let nonce = opt.nonceStart;

  // 事前計算: nonce ASCII 書き込みの最適化用
  const DIGIT0 = 0x30;

  while (!opt.cancelFlag.cancelled && nonce < opt.maxNonce) {
    // encode nonce as decimal ASCII directly into msg after prefix
    let n = nonce;
    let dcount: number;
    if (n === 0) {
      msg[prefixLen] = DIGIT0;
      dcount = 1;
    } else {
      // write digits from the right, then reverse
      let tmp = n;
      // count digits without allocation
      dcount = 0;
      while (tmp > 0) { dcount++; tmp = Math.floor(tmp / 10); }
      let idx = prefixLen + dcount - 1;
      tmp = n;
      while (tmp > 0) {
        msg[idx--] = DIGIT0 + (tmp - Math.floor(tmp / 10) * 10);
        tmp = Math.floor(tmp / 10);
      }
    }

    // padding は sha256() が上書きするので clean 不要
    sha256(msg, prefixLen + dcount, W, hashOut);
    const hex = matchesPrefix(hashOut, opt.hexBytes, opt.difficulty);
    if (hex) {
      return { nonce, hash: hex, tried: tried + 1, tier };
    }

    nonce++;
    tried++;

    if ((tried & (YIELD_INTERVAL - 1)) === 0) {
      const now = performance.now();
      if (now - lastProgressAt >= opt.progressIntervalMs) {
        const elapsed = (now - startedAt) / 1000;
        const hps = elapsed > 0 ? tried / elapsed : 0;
        opt.onProgress(hps, tried, nonce);
        lastProgressAt = now;
      }
      // T5: microtask 渋滞 & 熱暴走を止める
      await yieldToLoop();
    }
  }

  return null;
}
