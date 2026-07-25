// src/lib/crypto/miner/webgpu-miner.ts
/**
 * ProofMark PoW · Tier 1 · WebGPU Batch Dispatcher
 * ─────────────────────────────────────────────────────────────────────────
 *  設計:
 *   - WGSL 内で SHA-256 を実装。文字列型は存在しないので、
 *     prefix bytes (signature+tgtHash+devicePub) を storage buffer で投入し、
 *     shader 内で nonce を 10進 ASCII に decimal-encode → suffix として連結。
 *   - dispatchWorkgroups(gridX, 1, 1) で 1 バッチ = WG_SIZE * gridX スレッド。
 *     GPU の TDR (Windows: 2s, macOS: 5s) を回避するため 1 バッチを
 *     ~30ms 目標にサイズ調整。
 *   - **リングバッファ 3 枚**で pipeline stall を回避 (T3):
 *       batch(n+2) を dispatch → batch(n+1) を submit 済み →
 *       batch(n)   を map して結果を CPU で確認、を並列進行。
 *   - Edge の hex prefix ロジック (⌈difficulty/2⌉ バイト) を shader 内で
 *     bit-perfect に写像し、GPU 側で uint32 として "prefix zeros count" を
 *     算出し、found フラグを atomic write。
 *   - RAII destroy (T4): buffers / bindGroups / pipeline すべてを
 *     try/finally で確実に destroy。Worker terminate 時にも呼ばれる。
 */

declare global {
  interface Navigator {
    gpu?: GPU;
  }
  interface GPU {
    requestAdapter(options?: { powerPreference?: string }): Promise<GPUAdapter | null>;
  }
  interface GPUAdapter {
    requestDevice(options?: any): Promise<GPUDevice | null>;
    requestAdapterInfo?(): Promise<{ vendor?: string; device?: string }>;
  }
  interface GPUDevice {
    queue: GPUQueue;
    createBindGroupLayout(descriptor: any): GPUBindGroupLayout;
    createPipelineLayout(descriptor: any): GPUPipelineLayout;
    createShaderModule(descriptor: any): GPUShaderModule;
    createComputePipelineAsync(descriptor: any): Promise<GPUComputePipeline>;
    createBuffer(descriptor: any): GPUBuffer;
    createBindGroup(descriptor: any): GPUBindGroup;
    createCommandEncoder(): GPUCommandEncoder;
    destroy(): void;
  }
  interface GPUQueue {
    writeBuffer(buffer: GPUBuffer, bufferOffset: number, data: BufferSource): void;
    submit(commandBuffers: GPUCommandBuffer[]): void;
  }
  interface GPUBuffer {
    mapAsync(mode: number): Promise<void>;
    getMappedRange(offset?: number, size?: number): ArrayBuffer;
    unmap(): void;
    destroy(): void;
  }
  interface GPUBindGroupLayout {}
  interface GPUPipelineLayout {}
  interface GPUShaderModule {}
  interface GPUComputePipeline {}
  interface GPUBindGroup {}
  interface GPUCommandEncoder {
    beginComputePass(): GPUComputePassEncoder;
    copyBufferToBuffer(source: GPUBuffer, sourceOffset: number, destination: GPUBuffer, destinationOffset: number, size: number): void;
    finish(): GPUCommandBuffer;
  }
  interface GPUComputePassEncoder {
    setPipeline(pipeline: GPUComputePipeline): void;
    setBindGroup(index: number, bindGroup: GPUBindGroup): void;
    dispatchWorkgroups(workgroupCountX: number, workgroupCountY?: number, workgroupCountZ?: number): void;
    end(): void;
  }
  interface GPUCommandBuffer {}

  var GPUShaderStage: {
    readonly COMPUTE: number;
    readonly VERTEX: number;
    readonly FRAGMENT: number;
  };
  var GPUBufferUsage: {
    readonly MAP_READ: number;
    readonly MAP_WRITE: number;
    readonly COPY_SRC: number;
    readonly COPY_DST: number;
    readonly INDEX: number;
    readonly VERTEX: number;
    readonly UNIFORM: number;
    readonly STORAGE: number;
    readonly INDIRECT: number;
    readonly QUERY_RESOLVE: number;
  };
  var GPUMapMode: {
    readonly READ: number;
    readonly WRITE: number;
  };
}

/* ══════════════════════════════════════════════════════════════
 *  Feature detection
 * ══════════════════════════════════════════════════════════════ */

export async function isWebGPUSupported(): Promise<boolean> {
  try {
    const gpu = navigator.gpu;
    if (!gpu) return false;
    const adapter = await gpu.requestAdapter();
    if (!adapter) return false;
    return true;
  } catch {
    return false;
  }
}

/* ══════════════════════════════════════════════════════════════
 *  Types
 * ══════════════════════════════════════════════════════════════ */

export interface MineOptions {
  signature: string;
  tgtHash: string;
  devicePub: string;
  difficulty: number;
  hexBytes: number;         // ceil(difficulty / 2)
  zeroPrefix: string;       // '0'.repeat(difficulty)
  nonceStart: number;
  maxNonce: number;
  progressIntervalMs: number;
  cancelFlag: { cancelled: boolean };
  onProgress: (hashesPerSec: number, tried: number, currentNonce: number) => void;
}

export interface MineResult {
  nonce: number;
  hash: string;
  tried: number;
}

/* ══════════════════════════════════════════════════════════════
 *  WGSL — SHA-256 + nonce decimal encoder + prefix check
 *  (ASCII only. decimal encode is fixed-width up to 20 digits.)
 * ══════════════════════════════════════════════════════════════ */

const WG_SIZE = 64;
/** shader 内で扱える prefix 最大長 (bytes). 3 入力合計 = signature + tgtHash + devicePub */
const MAX_PREFIX_BYTES = 512;
/** nonce の10進 ASCII 最大桁数 (2^53 は 16 桁だが余裕を持たせて 20) */
const MAX_NONCE_DIGITS = 20;

const WGSL_SHADER = /* wgsl */`
struct Params {
  prefix_len   : u32,   // bytes
  nonce_base   : u32,   // 下位 32bit
  nonce_base_hi: u32,   // 上位 21bit (合計 53bit 対応)
  difficulty   : u32,
  hex_bytes    : u32,   // ceil(difficulty/2)
  pad0         : u32,
  pad1         : u32,
  pad2         : u32,
};

@group(0) @binding(0) var<uniform>              params  : Params;
@group(0) @binding(1) var<storage, read>        prefix  : array<u32>; // packed u8 in u32
@group(0) @binding(2) var<storage, read_write>  found   : atomic<u32>;
@group(0) @binding(3) var<storage, read_write>  outLo   : atomic<u32>;
@group(0) @binding(4) var<storage, read_write>  outHi   : atomic<u32>;

/* ── SHA-256 constants ─────────────────────────────────── */
const K : array<u32, 64> = array<u32, 64>(
  0x428a2f98u,0x71374491u,0xb5c0fbcfu,0xe9b5dba5u,0x3956c25bu,0x59f111f1u,0x923f82a4u,0xab1c5ed5u,
  0xd807aa98u,0x12835b01u,0x243185beu,0x550c7dc3u,0x72be5d74u,0x80deb1feu,0x9bdc06a7u,0xc19bf174u,
  0xe49b69c1u,0xefbe4786u,0x0fc19dc6u,0x240ca1ccu,0x2de92c6fu,0x4a7484aau,0x5cb0a9dcu,0x76f988dau,
  0x983e5152u,0xa831c66du,0xb00327c8u,0xbf597fc7u,0xc6e00bf3u,0xd5a79147u,0x06ca6351u,0x14292967u,
  0x27b70a85u,0x2e1b2138u,0x4d2c6dfcu,0x53380d13u,0x650a7354u,0x766a0abbu,0x81c2c92eu,0x92722c85u,
  0xa2bfe8a1u,0xa81a664bu,0xc24b8b70u,0xc76c51a3u,0xd192e819u,0xd6990624u,0xf40e3585u,0x106aa070u,
  0x19a4c116u,0x1e376c08u,0x2748774cu,0x34b0bcb5u,0x391c0cb3u,0x4ed8aa4au,0x5b9cca4fu,0x682e6ff3u,
  0x748f82eeu,0x78a5636fu,0x84c87814u,0x8cc70208u,0x90befffau,0xa4506cebu,0xbef9a3f7u,0xc67178f2u,
);

fn rotr(x: u32, n: u32) -> u32 { return (x >> n) | (x << (32u - n)); }

/* prefix[] は u32 pack (little-endian byte-order in u32). byte-wise read helper. */
fn prefix_byte(i: u32) -> u32 {
  let w = prefix[i >> 2u];
  let sh = (i & 3u) * 8u;
  return (w >> sh) & 0xffu;
}

/* fixed-width decimal ASCII encoder — writes digits into digitBuf (LSB first)
   returns digit count (>=1). */
fn encode_dec(n_lo: u32, n_hi: u32, digitBuf: ptr<function, array<u32, ${MAX_NONCE_DIGITS}>>) -> u32 {
  var lo = n_lo;
  var hi = n_hi;
  var d : u32 = 0u;
  if (lo == 0u && hi == 0u) {
    (*digitBuf)[0] = 0x30u; // '0'
    return 1u;
  }
  // 53bit を保つ long-division: hi:lo を 10 で割る
  loop {
    if (lo == 0u && hi == 0u) { break; }
    // rem = ((hi % 10) * 2^32 + lo) % 10, quot handled via successive digit extraction
    // WGSL は 64bit を持たないので 32bit 反復除算を手実装する
    var rem : u32 = 0u;
    // hi
    let a_hi = hi;
    let q_hi = a_hi / 10u;
    rem = a_hi - q_hi * 10u;
    // lo (high 16 bits of lo + rem carried)
    let lo_hi = (lo >> 16u) | (rem << 16u);
    let q_lo_hi = lo_hi / 10u;
    let r2 = lo_hi - q_lo_hi * 10u;
    let lo_lo = (lo & 0xffffu) | (r2 << 16u);
    let q_lo_lo = lo_lo / 10u;
    let r3 = lo_lo - q_lo_lo * 10u;

    let new_lo = (q_lo_hi << 16u) | q_lo_lo;
    let new_hi = q_hi;

    (*digitBuf)[d] = 0x30u + r3;   // ASCII '0'..'9'
    d = d + 1u;
    if (d >= ${MAX_NONCE_DIGITS}u) { break; }
    lo = new_lo;
    hi = new_hi;
  }
  return d;
}

/* SHA-256 (single-call). msg is a flat byte-array constructed on stack. */
fn sha256(msg: ptr<function, array<u32, ${MAX_PREFIX_BYTES + MAX_NONCE_DIGITS + 72}>>, len: u32, out: ptr<function, array<u32, 8>>) {
  // padding
  let bit_len_lo : u32 = len << 3u;
  let bit_len_hi : u32 = len >> 29u;
  var padded_len : u32 = len + 1u;
  padded_len = padded_len + ((56u - (padded_len % 64u) + 64u) % 64u);
  (*msg)[len] = 0x80u;
  for (var i : u32 = len + 1u; i < padded_len; i = i + 1u) {
    (*msg)[i] = 0u;
  }
  // length in bits, big-endian, 8 bytes
  (*msg)[padded_len + 0u] = (bit_len_hi >> 24u) & 0xffu;
  (*msg)[padded_len + 1u] = (bit_len_hi >> 16u) & 0xffu;
  (*msg)[padded_len + 2u] = (bit_len_hi >>  8u) & 0xffu;
  (*msg)[padded_len + 3u] =  bit_len_hi         & 0xffu;
  (*msg)[padded_len + 4u] = (bit_len_lo >> 24u) & 0xffu;
  (*msg)[padded_len + 5u] = (bit_len_lo >> 16u) & 0xffu;
  (*msg)[padded_len + 6u] = (bit_len_lo >>  8u) & 0xffu;
  (*msg)[padded_len + 7u] =  bit_len_lo         & 0xffu;
  let total = padded_len + 8u;

  var H : array<u32, 8> = array<u32, 8>(
    0x6a09e667u, 0xbb67ae85u, 0x3c6ef372u, 0xa54ff53au,
    0x510e527fu, 0x9b05688cu, 0x1f83d9abu, 0x5be0cd19u
  );

  var W : array<u32, 64>;
  var chunk : u32 = 0u;
  loop {
    if (chunk >= total) { break; }
    // load 16 big-endian words
    for (var i : u32 = 0u; i < 16u; i = i + 1u) {
      let b0 = (*msg)[chunk + i*4u + 0u];
      let b1 = (*msg)[chunk + i*4u + 1u];
      let b2 = (*msg)[chunk + i*4u + 2u];
      let b3 = (*msg)[chunk + i*4u + 3u];
      W[i] = (b0 << 24u) | (b1 << 16u) | (b2 << 8u) | b3;
    }
    for (var i : u32 = 16u; i < 64u; i = i + 1u) {
      let s0 = rotr(W[i-15u], 7u)  ^ rotr(W[i-15u], 18u) ^ (W[i-15u] >> 3u);
      let s1 = rotr(W[i- 2u], 17u) ^ rotr(W[i- 2u], 19u) ^ (W[i- 2u] >> 10u);
      W[i] = W[i-16u] + s0 + W[i-7u] + s1;
    }

    var a = H[0]; var b = H[1]; var c = H[2]; var d = H[3];
    var e = H[4]; var f = H[5]; var g = H[6]; var h = H[7];

    for (var i : u32 = 0u; i < 64u; i = i + 1u) {
      let S1 = rotr(e, 6u) ^ rotr(e, 11u) ^ rotr(e, 25u);
      let ch = (e & f) ^ ((~e) & g);
      let temp1 = h + S1 + ch + K[i] + W[i];
      let S0 = rotr(a, 2u) ^ rotr(a, 13u) ^ rotr(a, 22u);
      let mj = (a & b) ^ (a & c) ^ (b & c);
      let temp2 = S0 + mj;
      h = g; g = f; f = e; e = d + temp1;
      d = c; c = b; b = a; a = temp1 + temp2;
    }

    H[0] = H[0] + a; H[1] = H[1] + b; H[2] = H[2] + c; H[3] = H[3] + d;
    H[4] = H[4] + e; H[5] = H[5] + f; H[6] = H[6] + g; H[7] = H[7] + h;

    chunk = chunk + 64u;
  }

  for (var i : u32 = 0u; i < 8u; i = i + 1u) {
    (*out)[i] = H[i];
  }
}

/* Edge の hex prefix ロジックを bit-perfect に再現:
   - full_zero_bytes = difficulty / 2
   - if difficulty is odd, the (full_zero_bytes)-th byte's high nibble must be 0
   ハッシュ H は big-endian で 32 bytes として並ぶ。
*/
fn matches_prefix(hash: ptr<function, array<u32, 8>>, difficulty: u32) -> bool {
  let full = difficulty >> 1u;
  // check full zero bytes
  for (var i : u32 = 0u; i < full; i = i + 1u) {
    let word = (*hash)[i >> 2u];
    let sh = (3u - (i & 3u)) * 8u;   // big-endian byte extract
    let b = (word >> sh) & 0xffu;
    if (b != 0u) { return false; }
  }
  if ((difficulty & 1u) == 1u) {
    let word = (*hash)[full >> 2u];
    let sh = (3u - (full & 3u)) * 8u;
    let b = (word >> sh) & 0xffu;
    if ((b >> 4u) != 0u) { return false; }
  }
  return true;
}

@compute @workgroup_size(${WG_SIZE})
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  // 既に見つかっていれば即抜け
  if (atomicLoad(&found) != 0u) { return; }

  let idx = gid.x;
  // nonce = base + idx  (53bit long-add)
  var lo = params.nonce_base + idx;
  var hi = params.nonce_base_hi + select(0u, 1u, lo < params.nonce_base);

  // ── build message on-stack ────────────────────────────
  var msg : array<u32, ${MAX_PREFIX_BYTES + MAX_NONCE_DIGITS + 72}>;
  var w : u32 = 0u;
  // copy prefix bytes
  for (var i : u32 = 0u; i < params.prefix_len; i = i + 1u) {
    msg[w] = prefix_byte(i);
    w = w + 1u;
  }
  // encode nonce as decimal ASCII (LSB first) → reverse into msg
  var digits : array<u32, ${MAX_NONCE_DIGITS}>;
  let dcount = encode_dec(lo, hi, &digits);
  for (var i : u32 = 0u; i < dcount; i = i + 1u) {
    msg[w + i] = digits[dcount - 1u - i];
  }
  w = w + dcount;

  // ── SHA-256 ──────────────────────────────────────────
  var out : array<u32, 8>;
  sha256(&msg, w, &out);

  // ── prefix check ─────────────────────────────────────
  if (matches_prefix(&out, params.difficulty)) {
    // 最初に見つけた 1 スレッドだけ書き込む
    if (atomicCompareExchangeWeak(&found, 0u, 1u).exchanged) {
      atomicStore(&outLo, lo);
      atomicStore(&outHi, hi);
    }
  }
}
`;

/* ══════════════════════════════════════════════════════════════
 *  Class
 * ══════════════════════════════════════════════════════════════ */

interface RingSlot {
  paramsBuf: GPUBuffer;
  foundBuf: GPUBuffer;
  outLoBuf: GPUBuffer;
  outHiBuf: GPUBuffer;
  readBuf: GPUBuffer;   // MAP_READ, 12 bytes: found, outLo, outHi
  bindGroup: GPUBindGroup;
  inFlight: boolean;
}

const RING_COUNT = 3;

export class WebGPUMiner {
  private adapter: GPUAdapter | null = null;
  private device: GPUDevice | null = null;
  private queue: GPUQueue | null = null;
  private pipeline: GPUComputePipeline | null = null;
  private layout: GPUBindGroupLayout | null = null;
  private prefixBuf: GPUBuffer | null = null;
  private ring: RingSlot[] = [];
  public deviceLabel = 'webgpu';

  async init(): Promise<void> {
    const gpu = navigator.gpu;
    if (!gpu) throw new Error('WebGPU unavailable');
    this.adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!this.adapter) throw new Error('no GPUAdapter');
    // 一部の環境で device が lost する。lost ハンドラを取り付けて即 abort に繋げる。
    this.device = await this.adapter.requestDevice();
    if (!this.device) throw new Error('no GPUDevice');
    this.queue = this.device.queue;
    // adapter.info は Chrome 126+ でのみ利用可
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const info = await (this.adapter as any).requestAdapterInfo?.();
      if (info?.vendor || info?.device) this.deviceLabel = `${info.vendor ?? ''} ${info.device ?? ''}`.trim();
    } catch { /* noop */ }

    // pipeline layout & pipeline
    this.layout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    });
    const pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [this.layout] });
    const module = this.device.createShaderModule({ code: WGSL_SHADER });
    this.pipeline = await this.device.createComputePipelineAsync({
      layout: pipelineLayout,
      compute: { module, entryPoint: 'main' },
    });
  }

  destroy(): void {
    // T4: RAII 解放
    for (const s of this.ring) {
      try { s.paramsBuf.destroy(); } catch { /* noop */ }
      try { s.foundBuf.destroy(); } catch { /* noop */ }
      try { s.outLoBuf.destroy(); } catch { /* noop */ }
      try { s.outHiBuf.destroy(); } catch { /* noop */ }
      try { s.readBuf.destroy(); } catch { /* noop */ }
    }
    this.ring = [];
    try { this.prefixBuf?.destroy(); } catch { /* noop */ }
    this.prefixBuf = null;
    try { this.device?.destroy(); } catch { /* noop */ }
    this.device = null;
    this.queue = null;
    this.pipeline = null;
    this.layout = null;
    this.adapter = null;
  }

  private buildRing(): void {
    if (!this.device || !this.layout || !this.prefixBuf) throw new Error('device not ready');
    this.ring = [];
    for (let i = 0; i < RING_COUNT; i++) {
      const paramsBuf = this.device.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const foundBuf = this.device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      });
      const outLoBuf = this.device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      });
      const outHiBuf = this.device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      });
      const readBuf = this.device.createBuffer({
        size: 12,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });
      const bindGroup = this.device.createBindGroup({
        layout: this.layout,
        entries: [
          { binding: 0, resource: { buffer: paramsBuf } },
          { binding: 1, resource: { buffer: this.prefixBuf } },
          { binding: 2, resource: { buffer: foundBuf } },
          { binding: 3, resource: { buffer: outLoBuf } },
          { binding: 4, resource: { buffer: outHiBuf } },
        ],
      });
      this.ring.push({ paramsBuf, foundBuf, outLoBuf, outHiBuf, readBuf, bindGroup, inFlight: false });
    }
  }

  async mine(opt: MineOptions): Promise<MineResult | null> {
    if (!this.device || !this.pipeline || !this.queue) throw new Error('not initialized');

    // ── prefix bytes を pack ──────────────────────────────
    const prefixStr = opt.signature + opt.tgtHash + opt.devicePub;
    const prefixBytes = new TextEncoder().encode(prefixStr);
    if (prefixBytes.length > MAX_PREFIX_BYTES) {
      throw new Error(`prefix too large: ${prefixBytes.length} > ${MAX_PREFIX_BYTES}`);
    }
    // pack into u32 array (LE within each word)
    const wordCount = Math.max(1, Math.ceil(prefixBytes.length / 4));
    const packed = new Uint32Array(wordCount);
    for (let i = 0; i < prefixBytes.length; i++) {
      packed[i >> 2] |= prefixBytes[i] << ((i & 3) * 8);
    }
    this.prefixBuf = this.device.createBuffer({
      size: packed.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.queue.writeBuffer(this.prefixBuf, 0, packed);
    this.buildRing();

    // ── バッチサイズ (TDR 30ms 目安) ──────────────────────
    // 初期 1 << 14 threads → 動的に上下 (0.5x ~ 4x)
    let gridWorkgroups = 1 << 8; // 256 wg → 16384 threads
    const MIN_WG = 1 << 5;
    const MAX_WG = 1 << 13;
    const TARGET_BATCH_MS = 30;

    const startedAt = performance.now();
    let lastProgressAt = startedAt;
    let tried = 0;
    let nonceCursor = opt.nonceStart;
    let ringIdx = 0;

    // In-flight batch metadata (for correct GPU->CPU stitching)
    const inflight: Array<{ base: number; batchSize: number; slot: number; startedAt: number } | null> = [null, null, null];

    try {
      while (!opt.cancelFlag.cancelled && nonceCursor < opt.maxNonce) {
        const slot = this.ring[ringIdx];

        // 前回この slot が inflight なら結果を回収
        if (inflight[ringIdx]) {
          const meta = inflight[ringIdx]!;
          const batchMs = performance.now() - meta.startedAt;
          const foundHash = await this.harvestSlot(slot, meta.base, meta.batchSize, opt);
          inflight[ringIdx] = null;
          tried += meta.batchSize;

          // 適応バッチサイズ (T3)
          if (batchMs < TARGET_BATCH_MS * 0.6 && gridWorkgroups < MAX_WG) gridWorkgroups <<= 1;
          else if (batchMs > TARGET_BATCH_MS * 1.6 && gridWorkgroups > MIN_WG) gridWorkgroups >>= 1;

          if (foundHash) return foundHash;
        }

        if (opt.cancelFlag.cancelled) break;

        // 新バッチ dispatch
        const batchSize = gridWorkgroups * WG_SIZE;
        const remaining = opt.maxNonce - nonceCursor;
        if (remaining <= 0) break;
        const useBatch = Math.min(batchSize, remaining);
        const useGrid = Math.max(1, Math.ceil(useBatch / WG_SIZE));

        // params
        const base = nonceCursor;
        const params = new Uint32Array(8);
        params[0] = prefixBytes.length;
        params[1] = base >>> 0;
        params[2] = Math.floor(base / 0x100000000) >>> 0;
        params[3] = opt.difficulty;
        params[4] = opt.hexBytes;
        // 3 pads = 0
        this.queue.writeBuffer(slot.paramsBuf, 0, params);
        // reset atomics
        this.queue.writeBuffer(slot.foundBuf, 0, new Uint32Array([0]));
        this.queue.writeBuffer(slot.outLoBuf, 0, new Uint32Array([0]));
        this.queue.writeBuffer(slot.outHiBuf, 0, new Uint32Array([0]));

        const enc = this.device.createCommandEncoder();
        const pass = enc.beginComputePass();
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, slot.bindGroup);
        pass.dispatchWorkgroups(useGrid, 1, 1);
        pass.end();
        // 結果を read-buffer にコピー
        enc.copyBufferToBuffer(slot.foundBuf, 0, slot.readBuf, 0, 4);
        enc.copyBufferToBuffer(slot.outLoBuf, 0, slot.readBuf, 4, 4);
        enc.copyBufferToBuffer(slot.outHiBuf, 0, slot.readBuf, 8, 4);
        this.queue.submit([enc.finish()]);

        inflight[ringIdx] = { base, batchSize: useBatch, slot: ringIdx, startedAt: performance.now() };
        nonceCursor += useBatch;
        ringIdx = (ringIdx + 1) % RING_COUNT;

        // Progress
        const now = performance.now();
        if (now - lastProgressAt >= opt.progressIntervalMs) {
          const elapsed = (now - startedAt) / 1000;
          const hps = elapsed > 0 ? tried / elapsed : 0;
          opt.onProgress(hps, tried, nonceCursor);
          lastProgressAt = now;
        }
      }

      // Drain remaining in-flight (順序を守る)
      for (let i = 0; i < RING_COUNT; i++) {
        const idx = (ringIdx + i) % RING_COUNT;
        const meta = inflight[idx];
        if (!meta) continue;
        const slot = this.ring[idx];
        const foundHash = await this.harvestSlot(slot, meta.base, meta.batchSize, opt);
        inflight[idx] = null;
        tried += meta.batchSize;
        if (foundHash) return foundHash;
      }

      return null;
    } finally {
      // In-flight readBuf の未 unmap を強制解放 (T4)
      for (let i = 0; i < RING_COUNT; i++) {
        const s = this.ring[i];
        try { s.readBuf.unmap(); } catch { /* not mapped */ }
      }
    }
  }

  private async harvestSlot(
    slot: RingSlot,
    base: number,
    batchSize: number,
    opt: MineOptions,
  ): Promise<MineResult | null> {
    await slot.readBuf.mapAsync(GPUMapMode.READ);
    try {
      const view = new Uint32Array(slot.readBuf.getMappedRange().slice(0));
      const found = view[0] >>> 0;
      const lo = view[1] >>> 0;
      const hi = view[2] >>> 0;
      if (found !== 0) {
        // 53bit 復元
        const nonce = hi * 0x100000000 + lo;
        // GPU の主張を CPU で厳密に再検証 (バイト整合 & Edge の early-break)
        const verified = await verifyOnCpu(opt.signature, opt.tgtHash, opt.devicePub, nonce, opt.difficulty);
        if (verified) return { nonce, hash: verified, tried: base + batchSize - base };
        // GPU が false positive を出したケース (計算誤差はないが、
        // decimal encoder のバグ耐性として保険). そのバッチは無効化。
        // eslint-disable-next-line no-console
        console.warn('[webgpu-miner] GPU claim rejected by CPU verify. skipping batch.', { base, batchSize });
        return null;
      }
      return null;
    } finally {
      try { slot.readBuf.unmap(); } catch { /* noop */ }
    }
  }
}

/* ══════════════════════════════════════════════════════════════
 *  CPU verifier (uses SubtleCrypto — Edge と bit-perfect)
 * ══════════════════════════════════════════════════════════════ */

async function verifyOnCpu(
  signature: string,
  tgtHash: string,
  devicePub: string,
  nonce: number,
  difficulty: number,
): Promise<string | null> {
  const input = new TextEncoder().encode(signature + tgtHash + devicePub + String(nonce));
  const buf = await crypto.subtle.digest('SHA-256', input);
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
    if (hex.length >= difficulty) break;
  }
  return hex.startsWith('0'.repeat(difficulty)) ? hex : null;
}
