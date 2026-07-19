// client/src/lib/forge.worker.ts
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
// mp4-muxer: Worker 内で動作する軽量 MP4 Muxer
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

/* ══════════════════════════════════════════════════════════════
 *  Types
 * ══════════════════════════════════════════════════════════════ */

export type ForgeMessage =
  | { type: 'START'; file: File; maxFrames?: number }
  | { type: 'PROGRESS'; percent: number; stage: 'hashing' | 'decoding' | 'muxing' }
  | { type: 'SUCCESS'; cid: string; framesBlob: Blob }
  | { type: 'ERROR'; message: string };

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
  mp4boxfile: ReturnType<typeof MP4Box.createFile>,
  trackId: number,
): Uint8Array | undefined {
  try {
    const track = (mp4boxfile as unknown as { getTrackById: (id: number) => unknown }).getTrackById(trackId);
    if (!track || typeof track !== 'object') return undefined;

    // stbl.stsd.entries[0] の avcC/hvcC/vpcC/av1C を安全に走査
    // MP4Box の型がゆるいため慎重に段階的に触る
    const entries: unknown =
      (track as { mdia?: { minf?: { stbl?: { stsd?: { entries?: unknown[] } } } } })
        ?.mdia?.minf?.stbl?.stsd?.entries;
    if (!Array.isArray(entries) || entries.length === 0) return undefined;

    const entry = entries[0] as Record<string, unknown>;
    const candidates: Array<'avcC' | 'hvcC' | 'vpcC' | 'av1C'> = ['avcC', 'hvcC', 'vpcC', 'av1C'];

    for (const key of candidates) {
      const box = entry[key] as unknown;
      if (!box) continue;

      // Case A: 一部の MP4Box フォークは write() 経由で DataStream にシリアライズが必要
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const DS = (MP4Box as unknown as { DataStream?: any }).DataStream;
        if (DS && typeof (box as { write?: (ds: unknown) => void }).write === 'function') {
          const ds = new DS(undefined, 0, DS.BIG_ENDIAN);
          (box as { write: (ds: unknown) => void }).write(ds);
          // avcC/hvcC ヘッダの直前 8byte (size + type) を削除
          const buf = new Uint8Array(ds.buffer as ArrayBuffer);
          if (buf.byteLength > 8) return buf.slice(8);
          return buf;
        }
      } catch { /* fallback */ }

      // Case B: 生の Uint8Array/ArrayBuffer プロパティがある実装
      if (box instanceof Uint8Array) return box;
      if (box instanceof ArrayBuffer) return new Uint8Array(box);

      // Case C: data フィールドを持つ実装
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
    // GC hint: 参照を切る
    // (次イテレーションで再バインドされる)
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
    const mp4boxfile = MP4Box.createFile();
    let videoTrack: { id: number; codec: string; track_width: number; track_height: number; nb_samples: number } | null = null;
    let sampledFramesCount = 0;    // decoder に投入したフレーム総数
    let outputFramesCount = 0;     // encoder に流し込んだフレーム数
    let encoderClosed = false;
    let decoderClosed = false;
    let finished = false;

    // Downscale canvas (transferControlToOffscreen 不要 · Worker 内で完結)
    const canvas = new OffscreenCanvas(REEL_W, REEL_H);
    const ctx = canvas.getContext('2d', { alpha: false }) as OffscreenCanvasRenderingContext2D | null;
    if (!ctx) {
      reject(new Error('OffscreenCanvas 2D context の取得に失敗しました'));
      return;
    }

    // Muxer は onReady で codec 判定後に構築する
    let muxer: Muxer<ArrayBufferTarget> | null = null;
    let encoder: VideoEncoder | null = null;
    let decoder: VideoDecoder | null = null;

    const safeReject = (err: Error) => {
      if (finished) return;
      finished = true;
      try { decoder?.close(); } catch { /* noop */ }
      try { encoder?.close(); } catch { /* noop */ }
      reject(err);
    };

    // ── Encoder 側の出力チャンクを Muxer へ流す ────────────
    const buildEncoder = (muxerCodec: 'avc' | 'hevc' | 'vp9' | 'av1'): VideoEncoder => {
      const enc = new VideoEncoder({
        output: (chunk, meta) => {
          if (finished) return;
          if (!muxer) return;
          try {
            muxer.addVideoChunk(chunk, meta);
          } catch (mErr) {
            safeReject(new Error(`Muxer 書き込み失敗: ${(mErr as Error).message}`));
          }
        },
        error: (e) => safeReject(new Error(`Encoder Error: ${e.message}`)),
      });

      // codec 文字列 for VideoEncoder.configure
      // "純度100%のネイティブ動画" として素直な AVC を第一選択
      // muxerCodec は Muxer 側の種別を決めるのみで、
      // encoder 側は avc1.42E01F (Baseline/L3.1) を採用
      const encoderCodec =
        muxerCodec === 'avc'
          ? 'avc1.42E01F'
          : muxerCodec === 'hevc'
            ? 'hvc1.1.6.L93.B0'
            : muxerCodec === 'vp9'
              ? 'vp09.00.10.08'
              : 'av01.0.04M.08';

      enc.configure({
        codec: encoderCodec,
        width: REEL_W,
        height: REEL_H,
        bitrate: REEL_BITRATE,
        framerate: REEL_FPS,
        // AVC は "annexb" ではなく "avc" (in-band nothing) にして
        // mp4-muxer が avcC を自動生成できる形式にする
        // hevc も同様に "hevc"
        // (Chrome の実装で "avc" bitstreamFormat は "description" を出力する)
        // - Safari では未対応キーの場合は無視される
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        avc: muxerCodec === 'avc' ? ({ format: 'avc' } as any) : undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hevc: muxerCodec === 'hevc' ? ({ format: 'hevc' } as any) : undefined,
      });

      return enc;
    };

    // ── Frame 制御 ────────────────────────────────────────
    // 均等サンプリングのための「n フレームごとに 1 枚採用」係数
    let sampleEveryN = 1;

    // decoder が吐いた VideoFrame を Downscale + Encode
    const handleDecodedFrame = (frame: VideoFrame) => {
      if (finished) {
        // finished 後に到着したフレームは即 close
        try { frame.close(); } catch { /* noop */ }
        return;
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
        // Downscale draw
        ctx.drawImage(frame, 0, 0, REEL_W, REEL_H);
      } catch (drawErr) {
        try { frame.close(); } catch { /* noop */ }
        safeReject(new Error(`Downscale 描画失敗: ${(drawErr as Error).message}`));
        return;
      }
      // 使用済み Source Frame の即時解放 (VRAM の即時 GC)
      try { frame.close(); } catch { /* noop */ }

      // Reel 用の VideoFrame を canvas から生成
      const outFrame = new VideoFrame(canvas, {
        timestamp: outputFramesCount * FRAME_INTERVAL_US,
        duration: FRAME_INTERVAL_US,
      });

      try {
        if (encoder && !encoderClosed) {
          // All-Intra: 全フレームをキーフレーム化
          encoder.encode(outFrame, { keyFrame: true });
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mp4boxfile as any).onReady = (info: any) => {
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

      // 動画が極端に短い場合 (0 サンプル) は明示的にエラー
      if (videoTrack.nb_samples <= 0) {
        safeReject(new Error('動画が短すぎるかフレームが検出できませんでした'));
        return;
      }

      // Downscale 比率と間引き係数を算出
      sampleEveryN = Math.max(1, Math.floor(videoTrack.nb_samples / maxFrames));

      // Muxer 種別を決定
      let muxerCodec: 'avc' | 'hevc' | 'vp9' | 'av1';
      try {
        muxerCodec = mapCodecForMuxer(videoTrack.codec);
      } catch (mapErr) {
        safeReject(mapErr as Error);
        return;
      }

      // Muxer / Encoder の構築
      try {
        muxer = new Muxer({
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
        encoder = buildEncoder(muxerCodec);
      } catch (encInitErr) {
        safeReject(new Error(`Encoder 初期化失敗: ${(encInitErr as Error).message}`));
        return;
      }

      // Decoder の構築
      decoder = new VideoDecoder({
        output: (frame) => handleDecodedFrame(frame),
        error: (e) => safeReject(new Error(`Decoder Error: ${e.message}`)),
      });

      // Extradata を堅牢に抽出 (失敗しても configure は継続)
      const description = extractCodecDescription(mp4boxfile, videoTrack.id);

      try {
        decoder.configure({
          codec: videoTrack.codec,
          codedWidth: videoTrack.track_width,
          codedHeight: videoTrack.track_height,
          ...(description ? { description } : {}),
          // ハードウェア優先 (Safari も尊重される)
          hardwareAcceleration: 'prefer-hardware',
        });
      } catch (cfgErr) {
        safeReject(new Error(`Decoder configure 失敗: ${(cfgErr as Error).message}`));
        return;
      }

      // 抽出開始
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mp4boxfile as any).setExtractionOptions(videoTrack.id, null, { nbSamples: 100 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mp4boxfile as any).start();
    };

    // ── MP4Box: onSamples (Backpressure 心臓部) ───────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mp4boxfile as any).onSamples = async (_track_id: number, _ref: unknown, samples: any[]) => {
      if (finished) return;
      if (!decoder || decoder.state !== 'configured') return;
      if (!videoTrack) return;

      try {
        for (const sample of samples) {
          if (finished) return;
          if (outputFramesCount >= maxFrames) return;

          // 🩸 Backpressure: decoder のキューが積み上がる前に待機
          if (decoder.decodeQueueSize > DECODE_QUEUE_HIGH_WATERMARK) {
            await waitForDecoderDrain(decoder);
            if (finished || decoder.state !== 'configured') return;
          }

          const timescale = sample.timescale || 90000;
          const timestamp = Math.round((sample.cts * 1_000_000) / timescale);
          const duration = Math.round(((sample.duration || 0) * 1_000_000) / timescale);

          const chunk = new EncodedVideoChunk({
            type: sample.is_sync ? 'key' : 'delta',
            timestamp,
            duration: duration > 0 ? duration : undefined,
            data: sample.data,
          });

          try {
            decoder.decode(chunk);
          } catch (decErr) {
            safeReject(new Error(`Decode 投入失敗: ${(decErr as Error).message}`));
            return;
          }

          // sample.data の参照を切って GC を促す
          sample.data = null;
        }
      } catch (loopErr) {
        safeReject(new Error(`onSamples 例外: ${(loopErr as Error).message}`));
      }
    };

    // ── MP4Box: onError ──────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mp4boxfile as any).onError = (err: unknown) => {
      safeReject(new Error(`MP4 コンテナ解析失敗: ${String(err)}`));
    };

    // ── File Stream → MP4Box.appendBuffer ─────────────────
    (async () => {
      try {
        const reader = file.stream().getReader();
        let offset = 0;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (finished) return;
          const { done, value } = await reader.read();
          if (done) break;
          if (!value || value.byteLength === 0) continue;

          // ArrayBuffer を切り出し fileStart を付与
          const ab = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer & { fileStart?: number };
          ab.fileStart = offset;
          offset += ab.byteLength;

          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (mp4boxfile as any).appendBuffer(ab);
          } catch (appendErr) {
            safeReject(new Error(`appendBuffer 失敗: ${(appendErr as Error).message}`));
            return;
          }

          // maxFrames 到達したら早期打ち切り (ロングファイル対応)
          if (outputFramesCount >= maxFrames) break;
        }

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (mp4boxfile as any).flush();
        } catch { /* noop */ }

        // ── Drain 待機 → decoder.flush → encoder.flush → mux finalize ──
        if (finished) return;

        try {
          if (decoder && decoder.state === 'configured') {
            // 残キューをすべて排出
            while (decoder.decodeQueueSize > 0 && decoder.state === 'configured') {
              await sleep(BACKPRESSURE_POLL_MS);
            }
            await decoder.flush();
          }
        } catch (dfErr) {
          safeReject(new Error(`Decoder flush 失敗: ${(dfErr as Error).message}`));
          return;
        }

        try { decoder?.close(); } catch { /* noop */ }
        decoderClosed = true;

        // フレームが 1 枚も出なかった → 短すぎる/壊れた動画
        if (outputFramesCount === 0) {
          safeReject(new Error('デコード可能なフレームが見つかりませんでした'));
          return;
        }

        // Encoder flush
        post({ type: 'PROGRESS', percent: 90, stage: 'muxing' });
        try {
          if (encoder && encoder.state !== 'closed') {
            await encoder.flush();
          }
        } catch (efErr) {
          safeReject(new Error(`Encoder flush 失敗: ${(efErr as Error).message}`));
          return;
        }
        try { encoder?.close(); } catch { /* noop */ }
        encoderClosed = true;

        // Muxer finalize
        try {
          if (!muxer) {
            safeReject(new Error('Muxer が初期化されていません'));
            return;
          }
          muxer.finalize();

          const target = muxer.target as ArrayBufferTarget;
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

    // 使用してない変数を警告抑制のため参照 (GC の意図明示)
    void encoderClosed;
    void decoderClosed;
  });
}
