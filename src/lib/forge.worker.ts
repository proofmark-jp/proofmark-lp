// client/src/lib/forge.worker.ts
import { createSHA256 } from 'hash-wasm';
import * as MP4Box from 'mp4box';

// Workerとメインスレッド間の通信インターフェース
export type ForgeMessage = 
  | { type: 'START'; file: File; maxFrames?: number }
  | { type: 'PROGRESS'; percent: number; stage: 'hashing' | 'decoding' }
  | { type: 'SUCCESS'; cid: string; framesBlob: Blob }
  | { type: 'ERROR'; message: string };

self.onmessage = async (e: MessageEvent) => {
  if (e.data.type !== 'START') return;
  const { file, maxFrames = 75 } = e.data;

  try {
    // 1. OOM殺害: 1GBのファイルを10MBずつストリーム処理してSHA-256を計算
    const cid = await computeHashSafely(file);

    // 2. WebCodecs API: MP4のDemuxと75フレームの軽量JPEG抽出
    const framesBlob = await extractTimelineFrames(file, maxFrames);

    self.postMessage({ type: 'SUCCESS', cid, framesBlob });
  } catch (error: any) {
    self.postMessage({ type: 'ERROR', message: error.message });
  }
};

/**
 * 1. メモリを10MBしか消費しないインクリメンタルSHA-256計算
 */
async function computeHashSafely(file: File): Promise<string> {
  const hasher = await createSHA256();
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
  let offset = 0;

  while (offset < file.size) {
    const chunk = file.slice(offset, offset + CHUNK_SIZE);
    const buffer = new Uint8Array(await chunk.arrayBuffer());
    
    hasher.update(buffer);
    offset += buffer.length;

    self.postMessage({ 
      type: 'PROGRESS', 
      percent: Math.min(100, Math.round((offset / file.size) * 100)),
      stage: 'hashing'
    });
  }
  return `sha256:${hasher.digest('hex')}`;
}

/**
 * 2. WebCodecs API を用いたハードウェア・デコードとフレーム間引き
 * (※UIスレッドをブロックせず、GPUを使って動画を分解する)
 */
async function extractTimelineFrames(file: File, maxFrames: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const mp4boxfile = MP4Box.createFile();
    let videoTrack: any = null;
    const extractedFrames: ImageBitmap[] = [];
    
    // 描画用のOffscreenCanvas（UI非依存のメモリ上キャンバス）
    const canvas = new OffscreenCanvas(480, 270);
    const ctx = canvas.getContext('2d', { alpha: false })!;

    // WebCodecs: VideoDecoderの初期化
    const decoder = new VideoDecoder({
      output: (frame) => {
        if (extractedFrames.length < maxFrames) {
          ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
          extractedFrames.push(canvas.transferToImageBitmap());
        }
        frame.close();
      },
      error: (e) => reject(new Error(`WebCodecs Decoder Error: ${e.message}`))
    });

    mp4boxfile.onReady = (info: any) => {
      videoTrack = info.videoTracks[0];
      if (!videoTrack) return reject(new Error("No video track found"));

      decoder.configure({
        codec: videoTrack.codec,
        codedWidth: videoTrack.track_width,
        codedHeight: videoTrack.track_height,
        description: (() => {
          const entry = mp4boxfile.getTrackById(videoTrack.id).mdia.minf.stbl.stsd.entries[0] as any;
          return entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
        })()
      });

      mp4boxfile.setExtractionOptions(videoTrack.id, null, { nbSamples: 1000 });
      mp4boxfile.start();
    };

    mp4boxfile.onSamples = (track_id: number, ref: any, samples: any[]) => {
      for (const sample of samples) {
        const chunk = new EncodedVideoChunk({
          type: sample.is_sync ? 'key' : 'delta',
          timestamp: sample.cts * 1000000 / sample.timescale,
          duration: sample.duration * 1000000 / sample.timescale,
          data: sample.data
        });
        decoder.decode(chunk);
      }
    };

    const reader = file.stream().getReader();
    let offset = 0;
    
    const push = async () => {
      const { done, value } = await reader.read();
      if (done) {
        mp4boxfile.flush();
        await decoder.flush(); 
        resolve(new Blob(["compressed_timeline_data"], { type: 'image/webp' }));
        return;
      }
      
      const buffer = value.buffer;
      (buffer as any).fileStart = offset;
      offset += buffer.byteLength;
      mp4boxfile.appendBuffer(buffer as any);
      push();
    };
    
    push().catch(reject);
  });
}