// client/src/hooks/useGhostUploader.ts
/**
 * useGhostUploader — Ghost Upload Queue (Semaphore + Zombie-Free)
 * ─────────────────────────────────────────────────────────────────────
 * INV-G1: activeUploads++ と activeUploads-- は必ず try/finally で対称
 * INV-G2: thumbBlob 欠損時は setSteps('error') → throw の順で処理
 * INV-G3: AbortController Map は CREATE/DELETE/CLEANUP を完全管理
 * INV-G4: リトライ待機は retryCount * 500ms（ジッター禁止）
 * INV-G5: AbortError は retryCount++ 対象外
 * INV-G6: cleanup 順序は abort→clear→revokeURL→clear
 * INV-G7: readyItems filter に s.thumbBlob !== undefined を含む（二重防衛）
 * INV-G8: AbortController は stepId ごとに個別インスタンス
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkspaceStep } from './useMediaPipeline';
import { supabase } from '../lib/supabase';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

/** ⭐ Decoupled Architecture: 最大同時アップロード数（ブラウザクラッシュ防衛） */
const MAX_CONCURRENT_UPLOADS = 4;
/** INV-G4: リトライ最大回数 */
const MAX_RETRY_COUNT = 3;
/** INV-G4: リトライ待機係数 (ms) — ジッター禁止 */
const RETRY_BACKOFF_MS = 500;

/* ═══════════════════════════════════════════════════════════════
   PUBLIC TYPES
   ═══════════════════════════════════════════════════════════════ */

export interface UseGhostUploaderOptions {
  steps: WorkspaceStep[];
  setSteps: React.Dispatch<React.SetStateAction<WorkspaceStep[]>>;
  urlCacheRef: React.MutableRefObject<Map<string, string>>;
  thumbCacheRef: React.MutableRefObject<Map<string, string>>;
  generateUploadThumbnail: (file: File, isHead: boolean) => Promise<Blob>;
  isPublic: boolean;
}

export interface UseGhostUploaderReturn {
  activeUploadsCount: number;
  abortControllersRef: React.MutableRefObject<Map<string, AbortController>>;
  abortStep: (stepId: string) => void;
  fetchUploadUrlsBulk: (targetSteps: WorkspaceStep[], bundleId: string) => Promise<void>;
  abortAll: () => void;
}

/* ═══════════════════════════════════════════════════════════════
   HOOK
   ═══════════════════════════════════════════════════════════════ */

export function useGhostUploader({
  steps,
  setSteps,
  urlCacheRef,
  thumbCacheRef,
  generateUploadThumbnail,
  isPublic,
}: UseGhostUploaderOptions): UseGhostUploaderReturn {

  /** アクティブなアップロード数のセマフォ（ミュータブルRef、Reactレンダリングと非同期） */
  const activeUploads = useRef<number>(0);
  const [activeUploadsCount, setActiveUploadsCount] = useState<number>(0);

  /**
   * INV-G3: AbortController Map
   * CREATE: fetch 発火直前に .set(id, controller)
   * DELETE: terminal 遷移直前に .delete(id)
   * CLEANUP: forEach(abort) → clear()
   * INV-G8: stepId ごとに個別インスタンス
   */
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  /* ── Ghost Upload Watcher ── */
  useEffect(() => {
    const processUploadQueue = async () => {
      // INV-G7: filter 述語（thumbBlob 欠損を物理的に阻止する二重防衛）
      const readyItems = steps.filter(
        (s) =>
          !s.isRoot &&
          !s.deferred &&
          s.hashState === 'verified' &&
          s.signedUrl !== undefined &&
          s.uploadState === 'idle' &&
          s.thumbBlob !== undefined, // INV-G7: thumbBlob チェックで Case 2 を物理阻止
      );

      if (readyItems.length === 0) return;

      // B-3: DEADLOCK 予防 — スロット不足時は早期 return
      const availableSlots = MAX_CONCURRENT_UPLOADS - activeUploads.current;
      if (availableSlots <= 0) return;

      const toProcess = readyItems.slice(0, availableSlots);

      // 各 step を並列でアップロード（forEach + async IIFE）
      toProcess.forEach((item) => {
        // IIFE で非同期処理をカプセル化（forEach は await できないため）
        (async () => {
          // INV-G1: ACQUIRE — 必ず対応する finally で RELEASE する
          activeUploads.current++;
          setActiveUploadsCount(activeUploads.current);

          setSteps((cur) =>
            cur.map((s) => (s.id === item.id ? { ...s, uploadState: 'uploading' } : s)),
          );

          // INV-G8: stepId ごとに個別インスタンスを生成
          const controller = new AbortController();
          // INV-G3: CREATE — fetch 発火直前に Map に登録
          abortControllersRef.current.set(item.id, controller);

          let retryCount = 0;
          let success = false;
          let isAborted = false;

          try {
            // INV-G2: thumbBlob 欠損の二重チェック（readyItems filter が通り抜けた場合の保険）
            if (!item.thumbBlob) {
              // INV-G2: setSteps('error') → throw の順序を厳守
              setSteps((cur) =>
                cur.map((s) => (s.id === item.id ? { ...s, uploadState: 'error' } : s)),
              );
              throw new Error(`thumbBlob is missing for step ${item.id}`);
            }

            // INV-G4: リトライループ（最大 MAX_RETRY_COUNT 回）
            while (retryCount < MAX_RETRY_COUNT && !success && !isAborted) {
              try {
                // INV-G8: この step 専用 of signal のみを渡す（他 step を巻き添えにしない）
                await fetch(item.signedUrl!, {
                  method: 'PUT',
                  body: item.thumbBlob,
                  headers: { 'Content-Type': 'image/webp' },
                  signal: controller.signal,
                });

                success = true;
                setSteps((cur) =>
                  cur.map((s) =>
                    s.id === item.id ? { ...s, uploadState: 'uploaded' } : s,
                  ),
                );
              } catch (e: unknown) {
                // INV-G5: AbortError は retryCount++ 対象外 — break して finally へ直行
                if (e instanceof Error && e.name === 'AbortError') {
                  isAborted = true;
                  break; // uploadState を変更しない（INV-G5）
                }

                // INV-G4: それ以外のエラーのみ retryCount を進める
                retryCount++;
                if (retryCount >= MAX_RETRY_COUNT) {
                  // リトライ上限到達 → terminal state
                  setSteps((cur) =>
                    cur.map((s) =>
                      s.id === item.id ? { ...s, uploadState: 'error' } : s,
                    ),
                  );
                } else {
                  // INV-G4: 決定的待機（ジッター禁止）
                  await new Promise<void>((r) => setTimeout(r, retryCount * RETRY_BACKOFF_MS));
                }
              }
            }
          } finally {
            // INV-G3: DELETE — terminal 遷移完了後に Map から必ず削除
            abortControllersRef.current.delete(item.id);
            // INV-G1: RELEASE — 必ず実行（デッドロック防止の絶対保証）
            activeUploads.current--;
            setActiveUploadsCount(activeUploads.current);
          }
        })();
      });
    };

    processUploadQueue();
  }, [steps, setSteps]);

  const abortAll = useCallback(() => {
    abortControllersRef.current.forEach((controller) => controller.abort());
    abortControllersRef.current.clear();
    activeUploads.current = 0;
    setActiveUploadsCount(0);
  }, []);

  /* ── 外部からの個別 Abort 操作 ── */
  const abortStep = useCallback((stepId: string) => {
    const controller = abortControllersRef.current.get(stepId);
    if (controller) {
      controller.abort();
      // INV-G3: abort 後は即座に Map から削除
      abortControllersRef.current.delete(stepId);
    }
  }, []);

  /* ── fetchUploadUrlsBulk ── */
  const fetchUploadUrlsBulk = useCallback(
    async (newSteps: WorkspaceStep[], bundleId: string) => {
      const stepsToUpload = newSteps.filter((s) => !s.isRoot && s.file && s.file.type.startsWith('image/'));
      if (stepsToUpload.length === 0) return;

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('認証トークンが見つかりません。再ログインしてください。');

        const lastIdx = stepsToUpload.length - 1;

        const stepsWithBlob: (WorkspaceStep & { _uploadBlob: Blob; _isHead: boolean })[] = [];
        for (let i = 0; i < stepsToUpload.length; i++) {
          const s = stepsToUpload[i];
          const isHead = i === lastIdx;
          let blob: Blob;
          if (s.thumbBlob && !isHead) {
            blob = s.thumbBlob;
          } else {
            try {
              blob = await generateUploadThumbnail(s.file!, isHead);
            } catch {
              setSteps((cur) => cur.map((item) => item.id === s.id ? { ...item, uploadState: 'error' } : item));
              continue;
            }
          }
          stepsWithBlob.push({ ...s, _uploadBlob: blob, _isHead: isHead });
        }

        if (stepsWithBlob.length === 0) return;

        const fileDescriptors = stepsWithBlob.map((s) => ({
          fileName: `thumb_${s.id}.webp`,
          mimeType: 'image/webp',
          fileSize: s._uploadBlob.size,
          isHead: s._isHead,
        }));

        const CHUNK_SIZE = 20;
        const allUrls: Array<{ signedUrl: string; storagePath: string; publicUrl: string; isHead: boolean }> = [];
        for (let i = 0; i < fileDescriptors.length; i += CHUNK_SIZE) {
          const chunk = fileDescriptors.slice(i, i + CHUNK_SIZE);
          const res = await fetch('/api/upload-url', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              bundleId,
              proofMode: isPublic ? 'shareable' : 'private',
              files: chunk,
            }),
          });
          if (!res.ok) throw new Error(`署名付きURLの取得に失敗しました (chunk ${Math.floor(i / CHUNK_SIZE) + 1}).`);
          const { urls } = await res.json();
          allUrls.push(...urls);
        }

        setSteps((cur) =>
          cur.map((s) => {
            const idx = stepsWithBlob.findIndex((sw) => sw.id === s.id);
            if (idx === -1) return s;
            const urlInfo = allUrls[idx];
            if (!urlInfo) return { ...s, uploadState: 'error' };
            return {
              ...s,
              signedUrl: urlInfo.signedUrl,
              thumbnailPath: urlInfo.storagePath,
              uploadedPreviewUrl: urlInfo.publicUrl,
              thumbBlob: stepsWithBlob[idx]._uploadBlob,
              uploadState: 'idle',
              deferred: false,
            };
          }),
        );
      } catch (err) {
        console.error('[fetchUploadUrlsBulk] failed:', err);
        setSteps((cur) =>
          cur.map((s) =>
            stepsToUpload.some((ns) => ns.id === s.id) ? { ...s, uploadState: 'error' } : s,
          ),
        );
        throw err;
      }
    },
    [generateUploadThumbnail, isPublic, setSteps],
  );

  return {
    activeUploadsCount,
    abortControllersRef,
    abortStep,
    fetchUploadUrlsBulk,
    abortAll,
  };
}
