"use client";
/**
 * src/lib/zipStreamer.ts — The Native Stream Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * 【アーキテクチャの極致】
 * - AsyncGenerator を用いた完全なストリーミング (バケツリレー) 処理。
 * - Vercel(サーバー)のコンピュート/Egress原価: 0円。
 * - ブラウザのRAM消費: 常に数MBで固定（100GBのZIPでもクラッシュしない）。
 * - Chrome/Edge: OSネイティブの `showSaveFilePicker` を直叩き。
 * - Safari/Firefox: `StreamSaver.js` (Service Worker) へのフォールバック。
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { downloadZip } from 'client-zip';
import streamSaver from 'streamsaver';
import type { EvidencePackPayload } from '@/components/EvidencePackDownloadButton';

// 🚨 【防衛線1: Supply Chain 防衛】
// 外部のGitHub Pagesへの依存を断ち切り、自社ドメインのmitmを使用する。
if (typeof window !== 'undefined') {
  streamSaver.mitm = window.location.origin + '/mitm.html';
}

export interface StreamZipInput {
  filename: string;
  payload: EvidencePackPayload;
  certPdfBlob: Blob;
  coverPdfBlob: Blob;
  onProgress?: (fileName: string) => void;
  // 🚨 【防衛線2: Zombie Fetch 防衛】通信キャンセルのためのシグナル
  signal?: AbortSignal;
}

/**
 * 🚨 【防衛線】The Generator Pipeline
 * メモリダムの決壊を防ぐため、ファイルを配列ではなく「ストリーム」として順次供給する
 */
async function* generateZipFiles(
  input: StreamZipInput,
  cache?: Cache
): AsyncGenerator<any, void, unknown> {
  const { payload, certPdfBlob, coverPdfBlob, onProgress, signal } = input;

  onProgress?.('Certificate_of_Authenticity.pdf');
  yield { name: 'Certificate_of_Authenticity.pdf', lastModified: new Date(), input: certPdfBlob };

  onProgress?.('Cover_Letter.pdf');
  yield { name: 'Cover_Letter.pdf', lastModified: new Date(), input: coverPdfBlob };

  for (const f of payload.files) {
    // 🚨 ユーザーがキャンセルした瞬間にループを即時脱出する
    if (signal?.aborted) {
      console.warn('Zip streaming aborted by user.');
      break;
    }

    onProgress?.(f.name);

    if (f.type === 'text') {
      yield { name: f.name, lastModified: new Date(), input: f.content };
    }
    else if (f.type === 'base64') {
      // signalを渡して、裏側のデコードもキャンセル可能にする
      const res = await fetch(`data:application/octet-stream;base64,${f.content}`, { signal });
      const blob = await res.blob();
      yield { name: f.name, lastModified: new Date(), input: blob };
      URL.revokeObjectURL(URL.createObjectURL(blob));
    }
    else if (f.type === 'url') {
      try {
        let response = cache ? await cache.match(f.url) : undefined;

        if (!response) {
          // 🚨 signalを渡して、Supabaseからの重いダウンロードをいつでもKillできるようにする
          response = await fetch(f.url, { mode: 'cors', signal });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
        }

        yield { name: f.name, lastModified: new Date(), input: response };

      } catch (err: any) {
        if (err.name === 'AbortError') break; // キャンセル時は静かに終了
        const msg = err instanceof Error ? err.message : String(err);
        yield { name: `${f.name}.MISSING.txt`, lastModified: new Date(), input: `Fetch failed: ${msg}\n` };
      }
    }
  }
}

/**
 * 👑 The Native Stream Executor
 * ブラウザの能力を判定し、最適なストリーム書き込みルートを実行する
 */
export async function executeNativeStreamZip(input: StreamZipInput): Promise<void> {
  let cache: Cache | undefined;
  try {
    cache = await caches.open('proofmark-assets-v1');
  } catch (e) {
    console.warn('Cache API unavailable', e);
  }

  // ジェネレーターを起動し、client-zipのストリームパイプを構築 (この時点ではまだダウンロードは始まらない)
  const zipResponse = downloadZip(generateZipFiles(input, cache));
  const zipStream = zipResponse.body;

  if (!zipStream) {
    throw new Error('Failed to create ZIP stream pipe.');
  }

  // ── ルートA: File System Access API (Chrome / Edge / Opera) ──
  // OS標準の保存ダイアログを出し、ディスクへ直接バイト列を書き込む最強のAPI
  if ('showSaveFilePicker' in window) {
    try {
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: input.filename,
        types: [{
          description: 'ZIP Archive',
          accept: { 'application/zip': ['.zip'] },
        }],
      });
      const writable = await fileHandle.createWritable();
      await zipStream.pipeTo(writable);
      return;
    } catch (e: any) {
      // ユーザーが「キャンセル」を押した場合はエラーにせず静かに終了
      if (e.name === 'AbortError') return;
      console.warn('File System Access API failed, falling back to StreamSaver...', e);
    }
  }

  // ── ルートB: StreamSaver.js (Safari / Firefox / Fallback) ──
  // Service Workerを活用し、仮のダウンロードURLを発行してストリームを流し込む
  try {
    const fileStream = streamSaver.createWriteStream(input.filename);
    await zipStream.pipeTo(fileStream);
  } catch (e) {
    console.error('StreamSaver failed.', e);
    throw new Error('お使いのブラウザでは大容量ストリーミング保存がブロックされました。');
  }
}