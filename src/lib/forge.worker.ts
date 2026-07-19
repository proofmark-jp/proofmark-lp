// src/lib/forge.worker.ts
/**
 * ProofMark · Forge Worker (Apex Edition)
 * ─────────────────────────────────────────────────────────────────────────
 *  ミッション:
 *   - 数GB級の動画を 100% クライアントGPUで解体し、
 *     "純度100%のネイティブMP4 (All-Intra / ≤1MB)" を精製する
 *   - ハードウェアデコード (WebCodecs) + mp4-muxer で真のMP4を Mux
 *   - mp4box.js の onSamples ループで decodeQueueSize を厳格に監視し
 *     iOS Safari 等の GPU メモリ枯渇 (OOM) を物理的に殺害
 *   - 使用済み VideoFrame / ArrayBuffer は即座に close() / null 化して
 *     VRAM を完全解放
 *
 *  Message protocol:
 *    → { type: 'START', file, maxFrames? }
 *    ← { type: 'PROGRESS', percent, stage: 'hashing' | 'decoding' | 'muxing' }
 *    ← { type: 'SUCCESS', cid, framesBlob }   // framesBlob は video/mp4
 *    ← { type: 'ERROR', message }
 */

import { createSHA256 } from 'hash-wasm';
import * as MP4Box from 'mp4box';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

/* ══════════════════════════════════════════════════════════════
 *  Types & Strict Interfaces (No as any)
 * ══════════════════════════════════════════════════════════════ */

export type ForgeMessage =
  | { type: 'START'; file: File; maxFrames?: number }
  | { type: 'PROGRESS'; percent: number; stage: 'hashing' | 'decoding' | 'muxing' }
  | { type: 'SUCCESS'; cid: string; framesBlob: Blob }
  | { type: 'ERROR'; message: string };

export interface MP4BoxVideoTrack {
  id: number;
  codec: string;
  track_width: number;
  track_height: number;
  nb_samples?: number;
}

export interface MP4Info {
  videoTracks: MP4BoxVideoTrack[];
}

export interface MP4Sample {
  track_id: number;
  description: unknown;
  units: { data: Uint8Array }[];
  cts: number;
  dts: number;
  duration: number;
  timescale: number;
  is_sync: boolean;
  data: Uint8Array | null;
}

export interface MP4BoxFile {
  onReady?: (info: MP4Info) => void;
  onSamples?: (track_id: number, ref: unknown, samples: MP4Sample[]) => void;
  onError?: (err: unknown) => void;
  appendBuffer: (buf: ArrayBuffer) => number;
  setExtractionOptions: (track_id: number, ref?: unknown, options?: { nbSamples?: number }) => void;
  start: () => void;
  stop: () => void;
  flush: () => void;
  getTrackById: (id: number) => {
    mdia?: {
      minf?: {
        stbl?: {
          stsd?: {
            entries?: unknown[];
          };
        };
      };
    };
  } | undefined;
}

export interface DataStreamInstance {
  buffer: ArrayBuffer;
}

export interface DataStreamConstructor {
  new (
    buffer: undefined,
    byteOffset: number,
    byteLength: boolean
  ): DataStreamInstance;
  BIG_ENDIAN: boolean;
}

export interface MP4BoxModule {
  DataStream?: DataStreamConstructor;
}

export interface SafeVideoEncoderConfig extends VideoEncoderConfig {
  avc?: { format: 'avc' | 'annexb' };
  hevc?: { format: 'hevc' | 'annexb' };
}

/* ══════════════════════════════════════════════════════════════
 *  Constants — The Physics
 * ══════════════════════════════════════════════════════════════ */

/** Hash streaming chunk (10 MiB) */
const HASH_CHUNK = 10 * 1024 * 1024;
/** Reel resolution (縦タイムラプスも横も無難に飲み込む 16:9) */
const REEL_W = 480;
const REEL_H = 270;
/** All-Intra 出力の目標帯域 (bps): ~1.2Mbps を上限 → 75 frames × ~13KB */
const REEL_BITRATE = 1_200_000;
/** 出力フレームレート (擬似) */
const REEL_FPS = 15;
/** 1 フレーム分の μs */
const FRAME_INTERVAL_US = Math.round(1_000_000 / REEL_FPS);
/** Backpressure: decoder.decodeQueueSize がこの値を超えたら wait */
const DECODE_QUEUE_HIGH_WATERMARK = 6;
/** Backpressure の待機ポーリング間隔 (ms) */
const BACKPRESSURE_POLL_MS = 8;
/** 出力サイズのハードリミット (1 MiB) */
const OUTPUT_SIZE_LIMIT = 1 * 1024 * 1024;
/** progress の間引き (%) */
const PROGRESS_THROTTLE_PCT = 1;

/* ══════════════════════════════════════════════════════════════
 *  Utilities
 * ══════════════════════════════════════════════════════════════ */

function post(msg: ForgeMessage) {
  (self as unknown as Worker).postMessage(msg);
}

/** μs 単位待機 (Backpressure 用) */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** decoder のキューが hi-water を下回るまで await */
async function waitForDecoderDrain(decoder: VideoDecoder): Promise<void> {
  // decoder が閉じられていたら即抜け
  while (decoder.state === 'configured' && decoder.decodeQueueSize > DECODE_QUEUE_HIGH_WATERMARK) {
    await sleep(BACKPRESSURE_POLL_MS);
  }
}

/**
 * MP4Box のトラック entry から堅牢に codec description (Extradata) を抽出。
 * avcC / hvcC / vpcC / av1C 何が来ても壊れないよう、深い try/catch で無害化。
 * 抽出できなくても configure() に description を渡さないことで
 * "Annex-B / in-band-config" ストリームでも継続動作を試みる。
 */
function extractCodecDescription(
  mp4boxfile: MP4BoxFile,
  trackId: number,
): Uint8Array | undefined {
  try {
    const track = mp4boxfile.getTrackById(trackId);
    if (!track || typeof track !== 'object') return undefined;

    const entries = track.mdia?.minf?.stbl?.stsd?.entries;
    if (!Array.isArray(entries) || entries.length === 0) return undefined;

    const entry = entries[0];
    if (!entry || typeof entry !== 'object') return undefined;
    const entryRecord = entry as Record<string, unknown>;
    const candidates: Array<'avcC' | 'hvcC' | 'vpcC' | 'av1C'> = ['avcC', 'hvcC', 'vpcC', 'av1C'];

    for (const key of candidates) {
      const box = entryRecord[key];
      if (!box) continue;

      try {
        const mp4boxModule = MP4Box as unknown as MP4BoxModule;
        let DS: DataStreamConstructor | undefined;
        try {
          DS = mp4boxModule.DataStream;
        } catch (dsErr) {
          DS = undefined;
        }
        
        if (DS && typeof (box as { write?: (ds: unknown) => void }).write === 'function') {
          const ds = new DS(undefined, 0, DS.BIG_ENDIAN);
          (box as { write: (ds: unknown) => void }).write(ds);
          const buf = new Uint8Array(ds.buffer);
          if (buf.byteLength > 8) return buf.slice(8);
          return buf;
        }
      } catch (err) {
        console.warn('MP4Box.DataStream fallback triggered:', err);
      }

      if (box instanceof Uint8Array) return box;
      if (box instanceof ArrayBuffer) return new Uint8Array(box);

      const maybeData = (box as { data?: unknown }).data;
      if (maybeData instanceof Uint8Array) return maybeData;
      if (maybeData instanceof ArrayBuffer) return new Uint8Array(maybeData);
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * mp4-muxer の codec 種別に、mp4box.js の codec 文字列を写像。
 * 未対応 codec はここで throw して UI エラーへ美しく逃がす。
 */
function mapCodecForMuxer(codec: string): 'avc' | 'hevc' | 'vp9' | 'av1' {
  const c = (codec || '').toLowerCase();
  if (c.startsWith('avc1') || c.startsWith('avc3') || c.startsWith('h264')) return 'avc';
  if (c.startsWith('hev1') || c.startsWith('hvc1') || c.startsWith('h265')) return 'hevc';
  if (c.startsWith('vp09') || c.startsWith('vp9')) return 'vp9';
  if (c.startsWith('av01') || c.startsWith('av1')) return 'av1';
  throw new Error(`未対応のコーデックです: ${codec}`);
}

/* ══════════════════════════════════════════════════════════════
 *  Message pump
 * ══════════════════════════════════════════════════════════════ */

self.onmessage = async (e: MessageEvent) => {
  if (e.data?.type !== 'START') return;
  const { file, maxFrames = 75 } = e.data as { file: File; maxFrames?: number };

  try {
    // ── 1) SHA-256 (Streaming) ─────────────────────────────
    const cid = await computeHashSafely(file);

    // ── 2) Reel 精製 (WebCodecs decode → mp4-muxer で MP4 Mux) ─
    const framesBlob = await forgeReelMp4(file, maxFrames);

    post({ type: 'SUCCESS', cid, framesBlob });
  } catch (err) {
    post({
      type: 'ERROR',
      message: err instanceof Error ? err.message : 'unknown worker error',
    });
  }
};

/* ══════════════════════════════════════════════════════════════
 *  ① Streaming SHA-256 (定常メモリ 10MiB)
 * ══════════════════════════════════════════════════════════════ */

async function computeHashSafely(file: File): Promise<string> {
  if (!file || file.size <= 0) {
    throw new Error('空のファイルはハッシュできません');
  }
  const hasher = await createSHA256();
  hasher.init();

  let offset = 0;
  let lastPct = -PROGRESS_THROTTLE_PCT;

  while (offset < file.size) {
    const end = Math.min(offset + HASH_CHUNK, file.size);
    const chunk = file.slice(offset, end);
    const ab = await chunk.arrayBuffer();
    const view = new Uint8Array(ab);
    hasher.update(view);
    offset += ab.byteLength;

    const pct = Math.min(100, Math.round((offset / file.size) * 100));
    if (pct - lastPct >= PROGRESS_THROTTLE_PCT || pct === 100) {
      lastPct = pct;
      post({ type: 'PROGRESS', percent: pct, stage: 'hashing' });
    }
  }

  return `sha256:${hasher.digest('hex')}`;
}

/* ══════════════════════════════════════════════════════════════
 *  ② WebCodecs Decode → mp4-muxer Encode (All-Intra ≤ 1MB)
 * ══════════════════════════════════════════════════════════════ */

async function forgeReelMp4(file: File, maxFrames: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    // ── Guards ────────────────────────────────────────────
    if (typeof (self as unknown as { VideoDecoder?: unknown }).VideoDecoder === 'undefined') {
      reject(new Error('この環境は WebCodecs (VideoDecoder) 非対応です'));
      return;
    }
    if (typeof (self as unknown as { VideoEncoder?: unknown }).VideoEncoder === 'undefined') {
      reject(new Error('この環境は WebCodecs (VideoEncoder) 非対応です'));
      return;
    }
    if (typeof OffscreenCanvas === 'undefined') {
      reject(new Error('この環境は OffscreenCanvas 非対応です'));
      return;
    }

    // ── State ────────────────────────────────────────────
    const mp4boxfile = MP4Box.createFile() as unknown as MP4BoxFile;
    let videoTrack: { id: number; codec: string; track_width: number; track_height: number; nb_samples: number } | null = null;
    let sampledFramesCount = 0;    // decoder に投入したフレーム総数
    let outputFramesCount = 0;     // encoder に流し込んだフレーム数
    let encoderClosed = false;
    let decoderClosed = false;
    let finished = false;
    
    // 🛡️ メタデータ非依存の非同期ロック (Race Condition 防衛線)
    let activeSampleJobs = 0; 

    // Downscale canvas (transferControlToOffscreen 不要 · Worker 内で完結)
    const canvas = new OffscreenCanvas(REEL_W, REEL_H);
    const ctx = canvas.getContext('2d', { alpha: false }) as OffscreenCanvasRenderingContext2D | null;
    if (!ctx) {
      reject(new Error('OffscreenCanvas 2D context の取得に失敗しました'));
      return;
    }

    // Object wrapper to completely bypass TypeScript control flow analysis narrowing variables to 'never'
    const pipeline: {
      decoder: VideoDecoder | null;
      encoder: VideoEncoder | null;
      muxer: Muxer<ArrayBufferTarget> | null;
    } = {
      decoder: null,
      encoder: null,
      muxer: null,
    };

    const safeReject = (err: Error) => {
      if (finished) return;
      finished = true;
      try { pipeline.decoder?.close(); } catch { /* noop */ }
      try { pipeline.encoder?.close(); } catch { /* noop */ }
      reject(err);
    };

    // ── Encoder 側の出力チャンクを Muxer へ流す ────────────
    const buildEncoder = (muxerCodec: 'avc' | 'hevc' | 'vp9' | 'av1'): VideoEncoder => {
      const enc = new VideoEncoder({
        output: (chunk, meta) => {
          if (finished) return;
          if (!pipeline.muxer) return;
          try {
            pipeline.muxer.addVideoChunk(chunk, meta);
          } catch (mErr) {
            safeReject(new Error(`Muxer 書き込み失敗: ${(mErr as Error).message}`));
          }
        },
        error: (e) => safeReject(new Error(`Encoder Error: ${e.message}`)),
      });

      // codec 文字列 for VideoEncoder.configure
      const encoderCodec =
        muxerCodec === 'avc'
          ? 'avc1.42E01F'
          : muxerCodec === 'hevc'
            ? 'hvc1.1.6.L93.B0'
            : muxerCodec === 'vp9'
              ? 'vp09.00.10.08'
              : 'av01.0.04M.08';

      const config: SafeVideoEncoderConfig = {
        codec: encoderCodec,
        width: REEL_W,
        height: REEL_H,
        bitrate: REEL_BITRATE,
        framerate: REEL_FPS,
        // AVC は "annexb" ではなく "avc" (in-band nothing) にして
        // mp4-muxer が avcC を自動生成できる形式にする
        avc: muxerCodec === 'avc' ? { format: 'avc' } : undefined,
        hevc: muxerCodec === 'hevc' ? { format: 'hevc' } : undefined,
      };

      enc.configure(config);
      return enc;
    };

    // ── Frame 制御 ────────────────────────────────────────
    let sampleEveryN = 1;

    // decoder が吐いた VideoFrame を Downscale + Encode
    const handleDecodedFrame = (frame: VideoFrame) => {
      if (finished) {
        try { frame.close(); } catch { /* noop */ }
        return;
      }

      if (outputFramesCount === 0) {
        console.log('[ForgeWorker] 🟢 初回フレームのデコードに成功しました！');
      }

      // 間引き: sampledFramesCount が sampleEveryN の倍数のときだけ採用
      const idx = sampledFramesCount;
      sampledFramesCount += 1;

      const shouldTake =
        outputFramesCount < maxFrames &&
        (sampleEveryN <= 1 || idx % sampleEveryN === 0);

      if (!shouldTake) {
        try { frame.close(); } catch { /* noop */ }
        return;
      }

      try {
        ctx.drawImage(frame, 0, 0, REEL_W, REEL_H);
      } catch (drawErr) {
        try { frame.close(); } catch { /* noop */ }
        safeReject(new Error(`Downscale 描画失敗: ${(drawErr as Error).message}`));
        return;
      }
      try { frame.close(); } catch { /* noop */ }

      const outFrame = new VideoFrame(canvas, {
        timestamp: outputFramesCount * FRAME_INTERVAL_US,
        duration: FRAME_INTERVAL_US,
      });

      try {
        if (pipeline.encoder && !encoderClosed) {
          pipeline.encoder.encode(outFrame, { keyFrame: true });
        }
      } catch (encErr) {
        try { outFrame.close(); } catch { /* noop */ }
        safeReject(new Error(`Encode 失敗: ${(encErr as Error).message}`));
        return;
      }
      try { outFrame.close(); } catch { /* noop */ }

      outputFramesCount += 1;

      // decoding 進捗を post
      if (videoTrack && videoTrack.nb_samples > 0) {
        const pct = Math.min(100, Math.round((sampledFramesCount / videoTrack.nb_samples) * 100));
        post({ type: 'PROGRESS', percent: pct, stage: 'decoding' });
      }
    };

    // ── MP4Box: onReady ──────────────────────────────────
    mp4boxfile.onReady = (info: MP4Info) => {
      const track = info?.videoTracks?.[0];
      if (!track) {
        safeReject(new Error('この動画には映像トラックが見つかりませんでした'));
        return;
      }
      videoTrack = {
        id: track.id,
        codec: track.codec,
        track_width: track.track_width,
        track_height: track.track_height,
        nb_samples: track.nb_samples ?? 0,
      };

      if (videoTrack.nb_samples <= 0) {
        safeReject(new Error('動画が短すぎるかフレームが検出できませんでした'));
        return;
      }

      sampleEveryN = Math.max(1, Math.floor(videoTrack.nb_samples / maxFrames));

      let muxerCodec: 'avc' | 'hevc' | 'vp9' | 'av1';
      try {
        muxerCodec = mapCodecForMuxer(videoTrack.codec);
      } catch (mapErr) {
        safeReject(mapErr as Error);
        return;
      }

      try {
        pipeline.muxer = new Muxer({
          target: new ArrayBufferTarget(),
          video: {
            codec: muxerCodec,
            width: REEL_W,
            height: REEL_H,
            frameRate: REEL_FPS,
          },
          fastStart: 'in-memory',
        });
      } catch (muxErr) {
        safeReject(new Error(`Muxer 初期化失敗: ${(muxErr as Error).message}`));
        return;
      }

      try {
        pipeline.encoder = buildEncoder(muxerCodec);
      } catch (encInitErr) {
        safeReject(new Error(`Encoder 初期化失敗: ${(encInitErr as Error).message}`));
        return;
      }

      pipeline.decoder = new VideoDecoder({
        output: (frame) => handleDecodedFrame(frame),
        error: (e) => {
          console.error('[ForgeWorker] 🚨 WebCodecs Decoder 致命的エラー:', e);
          safeReject(new Error(`Decoder Error: ${e.message}`));
        },
      });

      const description = extractCodecDescription(mp4boxfile, videoTrack.id);

      // 👁️ 観測用ログ
      console.log(`[ForgeWorker] 🎬 トラック検出: codec=${videoTrack.codec}, size=${videoTrack.track_width}x${videoTrack.track_height}, frames=${videoTrack.nb_samples}`);
      console.log(`[ForgeWorker] 📦 Extradata 抽出: ${description ? `成功 (${description.byteLength} bytes)` : '失敗 (undefined)'}`);

      if (!description) {
        const c = videoTrack.codec.toLowerCase();
        if (c.includes('avc') || c.includes('hvc') || c.includes('hevc')) {
          safeReject(new Error('コーデックの初期化データ(Extradata)の抽出に失敗しました。'));
          return;
        }
      }

      try {
        pipeline.decoder.configure({
          codec: videoTrack.codec,
          codedWidth: videoTrack.track_width,
          codedHeight: videoTrack.track_height,
          ...(description ? { description } : {}),
          hardwareAcceleration: 'prefer-hardware',
        });
      } catch (cfgErr) {
        safeReject(new Error(`Decoder configure 失敗: ${(cfgErr as Error).message}`));
        return;
      }

      mp4boxfile.setExtractionOptions(videoTrack.id, null, { nbSamples: 100 });
      mp4boxfile.start();
    };

    // ── MP4Box: onSamples (Backpressure 心臓部) ───────────
    mp4boxfile.onSamples = async (_track_id: number, _ref: unknown, samples: MP4Sample[]) => {
      if (finished) return;
      activeSampleJobs++; // 🛡️ 非同期ジョブのロックを取得

      // 👁️ 観測用ログ
      console.log(`[ForgeWorker] 🧩 チャンクデコード投入: ${samples.length} frames`);

      try {
        if (!pipeline.decoder || pipeline.decoder.state !== 'configured') return;
        if (!videoTrack) return;

        for (const sample of samples) {
          if (finished) return;
          if (outputFramesCount >= maxFrames) return;

          if (pipeline.decoder.decodeQueueSize > DECODE_QUEUE_HIGH_WATERMARK) {
            await waitForDecoderDrain(pipeline.decoder);
            if (finished || pipeline.decoder.state !== 'configured') return;
          }

          const timescale = sample.timescale || 90000;
          const timestamp = Math.round((sample.cts * 1_000_000) / timescale);
          const duration = Math.round(((sample.duration || 0) * 1_000_000) / timescale);

          // 🩸 真実のみを申告する。mp4boxがsync(キーフレーム)と判定したものだけを'key'にする。
          const chunk = new EncodedVideoChunk({
            type: sample.is_sync ? 'key' : 'delta',
            timestamp,
            duration: duration > 0 ? duration : undefined,
            data: sample.data || new Uint8Array(0),
          });

          try {
            pipeline.decoder.decode(chunk);
          } catch (decErr) {
            safeReject(new Error(`Decode 投入失敗: ${(decErr as Error).message}`));
            return;
          }

          sample.data = null;
        }
      } catch (loopErr) {
        safeReject(new Error(`onSamples 例外: ${(loopErr as Error).message}`));
      } finally {
        activeSampleJobs--; // 🛡️ 非同期ジョブのロックを解放
      }
    };

    // ── MP4Box: onError ──────────────────────────────────
    mp4boxfile.onError = (err: unknown) => {
      safeReject(new Error(`MP4 コンテナ解析失敗: ${String(err)}`));
    };

    // ── File Stream (Chunked + Seekable) → MP4Box ─────────────────
    (async () => {
      try {
        let offset = 0;
        const CHUNK_SIZE = 5 * 1024 * 1024; // 5MBチャンク

        while (offset < file.size) {
          if (finished) return;
          if (outputFramesCount >= maxFrames) break;

          const end = Math.min(offset + CHUNK_SIZE, file.size);
          const chunk = file.slice(offset, end);
          const ab = await chunk.arrayBuffer();
          (ab as ArrayBuffer & { fileStart?: number }).fileStart = offset;

          // MP4Boxにチャンクをフィードし、次に読み込むべきファイル位置(nextOffset)を受け取る
          const nextOffset = mp4boxfile.appendBuffer(ab);

          // 🩸 非 Fast-Start (moovアトムが末尾にある) MP4 への絶対防衛線
          // メタデータ読込後、MP4Boxはメディアデータを抽出するため、自動的にファイル先頭付近への「シーク要求」を出す。
          // 一方通行のリーダーを捨て、要求された nextOffset へ確実にジャンプして再度データを流し込む。
          if (typeof nextOffset === 'number' && nextOffset !== offset + ab.byteLength) {
            console.log(`[ForgeWorker] 🔄 MP4Boxからのシーク要求を検知: 現在位置 ${offset} -> 移動先 ${nextOffset}`);
            offset = nextOffset;
          } else {
            offset += ab.byteLength;
          }
        }

        try {
          mp4boxfile.flush();
        } catch { /* noop */ }

        if (finished) return;

        // 🛡️ 防衛線: すべての onSamples (非同期) が完全に終わるのを待機する
        await sleep(50);
        let waitLoops = 0;
        const MAX_WAIT_LOOPS = 500;
        
        while (activeSampleJobs > 0 && !finished && waitLoops < MAX_WAIT_LOOPS) {
          await sleep(10);
          waitLoops++;
        }
        
        if (activeSampleJobs > 0 && !finished) {
          safeReject(new Error(`フレーム抽出がタイムアウトしました (Race Condition: ${activeSampleJobs} pending)`));
          return;
        }

        try {
          if (pipeline.decoder && pipeline.decoder.state === 'configured') {
            while (pipeline.decoder.decodeQueueSize > 0 && pipeline.decoder.state === 'configured') {
              await sleep(BACKPRESSURE_POLL_MS);
            }
            await pipeline.decoder.flush();
          }
        } catch (dfErr) {
          safeReject(new Error(`Decoder flush 失敗: ${(dfErr as Error).message}`));
          return;
        }

        try { pipeline.decoder?.close(); } catch { /* noop */ }
        decoderClosed = true;

        if (outputFramesCount === 0) {
          safeReject(new Error('このデバイス・ブラウザではデコードできない動画形式（HDR等）です'));
          return;
        }

        // Encoder flush
        post({ type: 'PROGRESS', percent: 90, stage: 'muxing' });
        try {
          if (pipeline.encoder && pipeline.encoder.state !== 'closed') {
            await pipeline.encoder.flush();
          }
        } catch (efErr) {
          safeReject(new Error(`Encoder flush 失敗: ${(efErr as Error).message}`));
          return;
        }
        try { pipeline.encoder?.close(); } catch { /* noop */ }
        encoderClosed = true;

        // Muxer finalize
        try {
          const mux = pipeline.muxer;
          if (!mux) {
            safeReject(new Error('Muxer が初期化されていません'));
            return;
          }
          mux.finalize();

          const target = mux.target;
          const buf: ArrayBuffer = target.buffer;

          if (!buf || buf.byteLength === 0) {
            safeReject(new Error('MP4 の生成結果が空でした'));
            return;
          }
          if (buf.byteLength > OUTPUT_SIZE_LIMIT) {
            safeReject(
              new Error(
                `生成されたMP4が上限 (1MiB) を超過しました (${buf.byteLength} B)`,
               ),
            );
            return;
          }

          post({ type: 'PROGRESS', percent: 100, stage: 'muxing' });
          const blob = new Blob([buf], { type: 'video/mp4' });
          finished = true;
          resolve(blob);
        } catch (finErr) {
          safeReject(new Error(`Muxer finalize 失敗: ${(finErr as Error).message}`));
          return;
        }
      } catch (streamErr) {
        safeReject(new Error(`ストリーム読取失敗: ${(streamErr as Error).message}`));
      }
    })().catch((err) => safeReject(err instanceof Error ? err : new Error(String(err))));

    void encoderClosed;
    void decoderClosed;
  });
}