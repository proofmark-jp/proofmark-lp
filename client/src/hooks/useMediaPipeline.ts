// client/src/hooks/useMediaPipeline.ts
/**
 * useMediaPipeline — Canvas Mutex Formal State Machine Implementation
 * ─────────────────────────────────────────────────────────────────────
 * INV-M1: Canvas Mutex は acquireCanvasLock の spin-wait でのみ担保される
 * INV-M2: acquireCanvasLock resolve 直後から全経路を単一 try で囲む
 * INV-M3: canvas.width=0; canvas.height=0 は toBlob 後、finally で実行
 * INV-M4: createImageBitmap 使用禁止。loadImageAsync のみ使用
 * INV-M5: srcUrl は必ず finally で revokeObjectURL する
 * INV-M6: processInChunks 並列数は 5 固定
 * INV-M7: Worker callback は同一 stepId で二重登録しない
 * INV-M8: compressionProgress.current は単調非減少
 */

import { useCallback, useState } from 'react';
import type { BundleStepType } from '../lib/proofmark-types';
import type { HashRequest, HashResponse } from '../workers/hashWorker';
import { compressProcessStepImage } from '../lib/image-compression';

/* ═══════════════════════════════════════════════════════════════
   PUBLIC TYPES
   ═══════════════════════════════════════════════════════════════ */

export type HashState = 'idle' | 'hashing' | 'verified' | 'error';
export type UploadState = 'idle' | 'fetching_url' | 'uploading' | 'uploaded' | 'error';

export interface WorkspaceStep {
  id: string;
  stepType: BundleStepType;
  title: string;
  note?: string;
  file?: File;
  previewUrl?: string;
  hashState: HashState;
  hashProgress?: number;
  sha256?: string;
  isRoot?: boolean;
  thumbUrl?: string;
  sameTimestamp?: boolean;
  uploadState?: UploadState;
  /** UI表示用サムネイルBlob（軽量WebP）。アップロードにも再利用する。 */
  thumbBlob?: Blob;
  /** Publicバケットへのアップロード完了後に得られる storagePath */
  thumbnailPath?: string;
  /** Publicバケットの公開 URL */
  uploadedPreviewUrl?: string;
  /** 署名付きアップロードURL */
  signedUrl?: string;
  deferred?: boolean;
}

export type CompressionPhase =
  | 'idle'
  | 'compressing'
  | 'rehashing'
  | 'uploading'
  | 'submitting'
  | 'done';

export interface CompressionProgress {
  phase: CompressionPhase;
  current: number;
  total: number;
  caption: string;
}

export interface UseMediaPipelineReturn {
  compression: CompressionProgress;
  setCompression: React.Dispatch<React.SetStateAction<CompressionProgress>>;
  computeHash: (stepId: string, file: File) => Promise<void>;
  generateThumb: (file: File) => Promise<{ url: string; blob: Blob }>;
  generateUploadThumbnail: (file: File, isHead: boolean) => Promise<Blob>;
  generateAndAttachThumb: (
    stepId: string,
    file: File,
    updateStep: (id: string, patch: Partial<WorkspaceStep>) => void,
  ) => Promise<void>;
  runHybridCompression: (
    steps: WorkspaceStep[],
    urlCacheRef: React.MutableRefObject<Map<string, string>>,
    setSteps: React.Dispatch<React.SetStateAction<WorkspaceStep[]>>,
  ) => Promise<WorkspaceStep[]>;
  reHashAfterCompression: (
    postCompress: WorkspaceStep[],
  ) => Promise<void>;
  abortAll: () => void;
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

/** UI表示用サムネイルの長辺上限 (px) */
const THUMB_MAX_PX = 200;
/** 途中工程サムネイルの長辺上限 (px) */
const STEP_THUMB_MAX_PX = 1000;
/** HEAD（最新工程）サムネイルの画質 */
const HEAD_THUMB_QUALITY = 0.85;
/** 途中工程サムネイルの画質 */
const STEP_THUMB_QUALITY = 0.7;
/** 圧縮後の Yield インターバル (ms) */
const COMPRESSION_YIELD_MS = 10;
/** INV-M6: processInChunks 並列数固定値 */
const HASH_CHUNK_CONCURRENCY = 5;

/* ═══════════════════════════════════════════════════════════════
   CANVAS MUTEX — Module-level Singleton
   STATE MACHINE: FREE ⇆ LOCKED
   INV-M1: ∀t. (∑ LOCKED holders at t) ≤ 1
   ═══════════════════════════════════════════════════════════════ */

let _sharedCanvas: HTMLCanvasElement | null = null;
let _canvasMutex: Promise<void> = Promise.resolve();

/** 
 * Canvas Mutex を取得する（Promiseチェーンによる完全なFIFOキュー）
 * 呼び出し元は、返却された release() を必ず finally で呼び出すこと。
 */
async function acquireCanvasLock(): Promise<() => void> {
  let release!: () => void;
  const next = new Promise<void>((r) => {
    release = r;
  });
  const wait = _canvasMutex;
  _canvasMutex = _canvasMutex.then(() => next).catch(() => next);
  await wait;
  return release;
}

function getSharedCanvas(
  w: number,
  h: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  if (!_sharedCanvas) _sharedCanvas = document.createElement('canvas');
  _sharedCanvas.width = w;
  _sharedCanvas.height = h;
  const ctx = _sharedCanvas.getContext('2d', { alpha: true });
  if (!ctx) return null;
  return { canvas: _sharedCanvas, ctx };
}

/* ═══════════════════════════════════════════════════════════════
   INV-M4: loadImageAsync — createImageBitmap を完全に置換
   ═══════════════════════════════════════════════════════════════ */

function loadImageAsync(src: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = src;
  });
}

/* ═══════════════════════════════════════════════════════════════
   CANVAS OPERATIONS — Module-level (state machine verified)
   ═══════════════════════════════════════════════════════════════ */

/**
 * UI表示用の超軽量サムネイルを生成する。
 * INV-M2: acquireCanvasLock 直後から単一 try で全経路を囲む
 * INV-M3: canvas dims を toBlob 後 finally で reset
 * INV-M5: srcUrl を finally で必ず revoke
 */
async function _generateThumb(file: File): Promise<{ url: string; blob: Blob }> {
  if (!file.type.startsWith('image/')) throw new Error('not an image');

  const releaseLock = await acquireCanvasLock(); // FREE → LOCKED

  const srcUrl = URL.createObjectURL(file); // INV-M5: ALLOC here
  let shared: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;

  try {
    // INV-M4: loadImageAsync のみ使用
    const img = await loadImageAsync(srcUrl);

    const scale = Math.min(1, THUMB_MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    shared = getSharedCanvas(w, h);
    if (!shared) throw new Error('2D context unavailable');

    shared.ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((r) =>
      shared!.canvas.toBlob(r, 'image/webp', 0.7),
    );

    // INV-M3: toBlob 完了後に次元リセット（VRAM解放）
    shared.canvas.width = 0;
    shared.canvas.height = 0;
    shared = null;

    if (!blob) throw new Error('toBlob returned null');

    return { url: URL.createObjectURL(blob), blob };
  } finally {
    // INV-M3: finally で null check してから reset（早期 throw 時に shared が未代入の可能性）
    if (shared) {
      shared.canvas.width = 0;
      shared.canvas.height = 0;
    }
    // INV-M5: 成功・失敗・abort 全経路で revoke
    URL.revokeObjectURL(srcUrl);
    // INV-M2: releaseLock は finally 内でのみ
    releaseLock(); // LOCKED → FREE
  }
}

/**
 * アップロード用のサムネイルBlob（途中工程 or HEAD）を生成する。
 * INV-M4: createImageBitmap 禁止 — loadImageAsync のみ使用
 */
async function _generateUploadThumbnail(file: File, isHead: boolean): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('not an image');

  const releaseLock = await acquireCanvasLock(); // FREE → LOCKED

  const srcUrl = URL.createObjectURL(file); // INV-M5: ALLOC here
  let shared: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;

  try {
    const img = await loadImageAsync(srcUrl);

    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    let dstW = srcW;
    let dstH = srcH;

    if (!isHead) {
      const longEdge = Math.max(srcW, srcH);
      const scale = longEdge > STEP_THUMB_MAX_PX ? STEP_THUMB_MAX_PX / longEdge : 1;
      dstW = Math.max(1, Math.round(srcW * scale));
      dstH = Math.max(1, Math.round(srcH * scale));
    }

    shared = getSharedCanvas(dstW, dstH);
    if (!shared) throw new Error('2D context unavailable');

    shared.ctx.imageSmoothingEnabled = true;
    shared.ctx.imageSmoothingQuality = 'high';
    shared.ctx.drawImage(img, 0, 0, dstW, dstH);

    const quality = isHead ? HEAD_THUMB_QUALITY : STEP_THUMB_QUALITY;
    const blob = await new Promise<Blob | null>((r) =>
      shared!.canvas.toBlob(r, 'image/webp', quality),
    );

    // INV-M3: toBlob 完了後に次元リセット
    shared.canvas.width = 0;
    shared.canvas.height = 0;
    shared = null;

    if (!blob) throw new Error('toBlob returned null');

    return blob;
  } finally {
    // INV-M3: null check 必須
    if (shared) {
      shared.canvas.width = 0;
      shared.canvas.height = 0;
    }
    // INV-M5: 全経路で revoke
    URL.revokeObjectURL(srcUrl);
    // INV-M2: finally 内でのみ解放
    releaseLock(); // LOCKED → FREE
  }
}

/* ═══════════════════════════════════════════════════════════════
   WORKER POOL — Module-level Singleton (INV-M7)
   ═══════════════════════════════════════════════════════════════ */

let _workerInstance: Worker | null = null;

interface WorkerCallbacks {
  onProgress: (p: number) => void;
  onSuccess: (hash: string) => void;
  onError: () => void;
}

const _workerCallbacks = new Map<string, WorkerCallbacks>();

function getWorker(): Worker {
  if (!_workerInstance) {
    _workerInstance = new Worker(
      new URL('../workers/hashWorker.ts', import.meta.url),
      { type: 'module' },
    );
    _workerInstance.onmessage = (e: MessageEvent<HashResponse>) => {
      const msg = e.data;
      const cb = _workerCallbacks.get(msg.id);
      if (!cb) return;
      if (msg.kind === 'progress') {
        cb.onProgress(msg.progress);
      } else if (msg.kind === 'success') {
        cb.onSuccess(msg.sha256);
        _workerCallbacks.delete(msg.id); // INV-M7: 成功後は即削除
      } else {
        cb.onError();
        _workerCallbacks.delete(msg.id); // INV-M7: エラー後は即削除
      }
    };
  }
  return _workerInstance;
}

/* ═══════════════════════════════════════════════════════════════
   processInChunks — INV-M6
   ═══════════════════════════════════════════════════════════════ */

async function processInChunks<T, R>(
  items: T[],
  concurrency: number,
  processor: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(processor));
    results.push(...chunkResults);
    // INV-M6: 各チャンク境界で rAF に呼吸を与える（150枚時のフリーズ防止）
    await new Promise<void>((r) => setTimeout(r, 0));
  }
  return results;
}

/* ═══════════════════════════════════════════════════════════════
   HOOK
   ═══════════════════════════════════════════════════════════════ */

export function useMediaPipeline(
  setSteps: React.Dispatch<React.SetStateAction<WorkspaceStep[]>>,
  urlCacheRef: React.MutableRefObject<Map<string, string>>,
  thumbCacheRef: React.MutableRefObject<Map<string, string>>,
): UseMediaPipelineReturn {

  const [compression, setCompression] = useState<CompressionProgress>({
    phase: 'idle',
    current: 0,
    total: 0,
    caption: '',
  });

  /* ── computeHash (INV-M7 準拠) ── */
  const computeHash = useCallback(async (stepId: string, file: File): Promise<void> => {
    // INV-M7: 同一 stepId の既存 callback を削除してから再登録
    if (_workerCallbacks.has(stepId)) {
      _workerCallbacks.delete(stepId);
      getWorker().postMessage({ kind: 'abort', id: stepId });
    }

    setSteps((cur) =>
      cur.map((s) =>
        s.id === stepId ? { ...s, hashState: 'hashing', hashProgress: 0 } : s,
      ),
    );

    return new Promise<void>((resolve) => {
      const req: HashRequest = { id: stepId, file };
      _workerCallbacks.set(stepId, {
        onProgress: (p) => {
          setSteps((cur) =>
            cur.map((s) => (s.id === stepId ? { ...s, hashProgress: p } : s)),
          );
        },
        onSuccess: (hash) => {
          setSteps((cur) => {
            const isDuplicate = cur.some((s) => s.id !== stepId && s.sha256 === hash);
            if (isDuplicate) {
              return cur.filter((s) => s.id !== stepId);
            }
            return cur.map((s) =>
              s.id === stepId
                ? { ...s, hashState: 'verified', sha256: hash, hashProgress: 1 }
                : s,
            );
          });
          resolve();
        },
        onError: () => {
          setSteps((cur) =>
            cur.map((s) =>
              s.id === stepId ? { ...s, hashState: 'error', hashProgress: undefined } : s,
            ),
          );
          resolve();
        },
      });
      getWorker().postMessage(req);
    });
  }, [setSteps]);

  /* ── generateThumb (public wrapper) ── */
  const generateThumb = useCallback(
    (file: File) => _generateThumb(file),
    [],
  );

  /* ── generateUploadThumbnail (public wrapper) ── */
  const generateUploadThumbnail = useCallback(
    (file: File, isHead: boolean) => _generateUploadThumbnail(file, isHead),
    [],
  );

  /**
   * サムネイル生成 + Step への単一 setState によるアトミックな書き込み。
   * INV-X1: thumbBlob と thumbUrl を必ず同一 setState 呼び出しで書き込む。
   * INV-X2: 失敗時のみ uploadState: 'error' を書き込む権限を持つ。
   */
  const generateAndAttachThumb = useCallback(
    async (
      stepId: string,
      file: File,
      updateStep: (id: string, patch: Partial<WorkspaceStep>) => void,
    ): Promise<void> => {
      try {
        const thumb = await _generateThumb(file);
        thumbCacheRef.current.set(stepId, thumb.url); // メモリリーク防止：キャッシュに登録
        // INV-X1: 両フィールドを単一 setState で同時書き込み（中間状態を観測させない）
        updateStep(stepId, { thumbUrl: thumb.url, thumbBlob: thumb.blob });
      } catch {
        // INV-X2: useMediaPipeline は uploadState: 'error' にのみ書き込む権限を持つ
        updateStep(stepId, { uploadState: 'error' });
      }
    },
    [thumbCacheRef],
  );

  /* ── runHybridCompression ── */
  const runHybridCompression = useCallback(
    async (
      steps: WorkspaceStep[],
      _urlCacheRef: React.MutableRefObject<Map<string, string>>,
      _setSteps: React.Dispatch<React.SetStateAction<WorkspaceStep[]>>,
    ): Promise<WorkspaceStep[]> => {
      if (steps.length < 2) return steps;

      const lastIndex = steps.length - 1;
      const targetIndices: number[] = [];
      for (let i = 0; i <= lastIndex - 1; i++) {
        if (!steps[i].isRoot && steps[i].file && steps[i].uploadState !== 'uploaded') {
          targetIndices.push(i);
        }
      }

      setCompression({
        phase: 'compressing',
        current: 0,
        total: targetIndices.length,
        caption: '証拠データを最適化中...',
      });

      const updated: WorkspaceStep[] = [...steps];

      for (let k = 0; k < targetIndices.length; k++) {
        const idx = targetIndices[k];
        const step = updated[idx];
        const originalFile = step.file!;
        let compressed: File;
        try {
          compressed = await compressProcessStepImage(originalFile);
        } catch (err) {
          console.warn('[HybridPayload] compression failed; fallback to original', err);
          compressed = originalFile;
        }

        const newPreviewUrl = URL.createObjectURL(compressed);
        const oldPreview = _urlCacheRef.current.get(step.id);
        if (oldPreview) URL.revokeObjectURL(oldPreview);
        _urlCacheRef.current.set(step.id, newPreviewUrl);

        updated[idx] = {
          ...step,
          file: compressed,
          previewUrl: newPreviewUrl,
          hashState: 'idle',
          sha256: undefined,
          hashProgress: 0,
        };

        _setSteps((cur) => cur.map((s) => (s.id === step.id ? updated[idx] : s)));

        // INV-M8: current は単調非減少で更新
        setCompression((prev) => ({
          ...prev,
          current: Math.max(prev.current, k + 1),
          caption: `証拠データを最適化中... (${k + 1}/${targetIndices.length})`,
        }));

        await new Promise<void>((r) => setTimeout(r, COMPRESSION_YIELD_MS));
      }

      return updated;
    },
    [],
  );

  /**
   * 圧縮後の再ハッシュ処理。
   * INV-M6: processInChunks 並列数 5 固定（Promise.all 使用禁止）
   * INV-M8: compressionProgress.current は単調非減少
   */
  const reHashAfterCompression = useCallback(
    async (postCompress: WorkspaceStep[]): Promise<void> => {
      const targets = postCompress.filter(
        (s) => !s.isRoot && s.file && s.hashState !== 'verified',
      );

      setCompression({
        phase: 'rehashing',
        current: 0,
        total: postCompress.length,
        caption: 'ハッシュ値を再計算中...',
      });

      // INV-M6: Promise.all 禁止 — processInChunks(concurrency=5) のみ
      await processInChunks(targets, HASH_CHUNK_CONCURRENCY, (s) =>
        computeHash(s.id, s.file!),
      );

      // INV-M8: Math.max で単調非減少を保証
      setCompression((prev) => ({
        ...prev,
        current: Math.max(prev.current, prev.total),
      }));
    },
    [computeHash],
  );

  const abortAll = useCallback(() => {
    _workerCallbacks.clear();
    if (_workerInstance) {
      _workerInstance.terminate();
      _workerInstance = null;
    }
  }, []);

  return {
    compression,
    setCompression,
    computeHash,
    generateThumb,
    generateUploadThumbnail,
    generateAndAttachThumb,
    runHybridCompression,
    reHashAfterCompression,
    abortAll,
  };
}
