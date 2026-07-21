// client/src/hooks/useSubmitOrchestrator.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import type { CertificateRecord } from '../lib/proofmark-types';
import type { WorkspaceStep } from './useMediaPipeline';
import { supabase } from '../lib/supabase';

export interface UseSubmitOrchestratorOptions {
  certificate: CertificateRecord | null;
  steps: WorkspaceStep[];
  setSteps: React.Dispatch<React.SetStateAction<WorkspaceStep[]>>;
  title: string;
  description: string;
  isPublic: boolean;
  magicMode: boolean;
  revisionCount: number;
  setRevisionCount: React.Dispatch<React.SetStateAction<number>>;
  commitSealSnapshot: (steps?: WorkspaceStep[]) => void;
  runHybridCompression: (
    steps: WorkspaceStep[],
    urlCacheRef: React.MutableRefObject<Map<string, string>>,
    setSteps: React.Dispatch<React.SetStateAction<WorkspaceStep[]>>,
  ) => Promise<WorkspaceStep[]>;
  reHashAfterCompression: (postCompress: WorkspaceStep[]) => Promise<void>;
  fetchUploadUrlsBulk: (targetSteps: WorkspaceStep[], bundleId: string) => Promise<void>;
  urlCacheRef: React.MutableRefObject<Map<string, string>>;
  onComplete?: () => void;
}

export interface UseSubmitOrchestratorReturn {
  submitting: boolean;
  message: string | null;
  result: { chainDepth: number; chainHeadSha256: string; certificateId: string } | null;
  executeSubmit: () => Promise<void>;
}

export function useSubmitOrchestrator({
  certificate,
  steps,
  setSteps,
  title,
  description,
  isPublic,
  magicMode,
  revisionCount,
  setRevisionCount,
  commitSealSnapshot,
  runHybridCompression,
  reHashAfterCompression,
  fetchUploadUrlsBulk,
  urlCacheRef,
  onComplete,
}: UseSubmitOrchestratorOptions): UseSubmitOrchestratorReturn {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{
    chainDepth: number;
    chainHeadSha256: string;
    certificateId: string;
  } | null>(null);

  const stepsRef = useRef<WorkspaceStep[]>(steps);
  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  const isMounted = useRef(true);
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const executeSubmit = useCallback(async () => {
    if (stepsRef.current.length === 0 || submitting) return;

    // Wait for hashing complete automatically
    if (stepsRef.current.some((s) => !s.isRoot && s.file && s.hashState !== 'verified')) {
      setMessage('ハッシュ計算を待機しています...');
      setSubmitting(true);
      while (stepsRef.current.some((s) => !s.isRoot && s.file && s.hashState !== 'verified')) {
        if (!isMounted.current) return;
        if (stepsRef.current.some((s) => s.hashState === 'error')) {
          setMessage('ハッシュ計算中にエラーが発生しました。');
          setSubmitting(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      setMessage(null);
    } else {
      setSubmitting(true);
    }
    setResult(null);

    if (magicMode) {
      // Magic Mode flow
      try {
        const postCompress = await runHybridCompression(stepsRef.current, urlCacheRef, setSteps);
        await reHashAfterCompression(postCompress);

        const bundleId = crypto.randomUUID();

        const toUpload = stepsRef.current.filter(
          (s) => !s.isRoot && s.file && s.file.type.startsWith('image/') && s.uploadState !== 'uploaded',
        );
        if (toUpload.length > 0) {
          await fetchUploadUrlsBulk(toUpload, bundleId);
        }

        const startedAt = Date.now();
        const TIMEOUT_MS = 120_000;
        while (true) {
          const targets = stepsRef.current.filter((s) => !s.isRoot && s.file && s.file.type.startsWith('image/'));
          const done = targets.every((s) => s.uploadState === 'uploaded');
          const failed = targets.some((s) => s.uploadState === 'error');
          if (done || targets.length === 0) break;
          if (failed) throw new Error('一部のアップロードに失敗しました。再試行してください。');
          if (Date.now() - startedAt > TIMEOUT_MS) {
            throw new Error('アップロードがタイムアウトしました。ネットワークを確認してください。');
          }
          await new Promise((r) => setTimeout(r, 250));
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('認証トークンが見つかりません。再ログインしてください。');

        const jsonSteps = stepsRef.current.map((s, idx) => {
          const realId = s.id.startsWith('root-') ? s.id.replace('root-', '') : s.id;
          return {
            id: realId,
            stepType: s.stepType || 'other',
            title: s.title,
            note: s.note || '',
            sha256: s.sha256 ?? '',
            isRoot: s.isRoot ?? false,
            thumbnailPath: !s.isRoot && s.thumbnailPath ? s.thumbnailPath : undefined,
            previewUrl:
              !s.isRoot && s.uploadedPreviewUrl
                ? s.uploadedPreviewUrl
                : s.isRoot
                  ? s.previewUrl ?? undefined
                  : undefined,
            fileName: s.file?.name,
            fileSize: s.file?.size,
            mimeType: s.file?.type,
            proofMode: (isPublic ? 'shareable' : 'private') as 'shareable' | 'private',
            stepIndex: idx,
          };
        });

        const payload = {
          bundleId,
          title,
          description,
          isPublic,
          items: jsonSteps,
        };

        const res = await fetch('/api/process-bundles/create-json', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `API エラー (${res.status})`);
        }

        const data = await res.json();
        setSteps([...stepsRef.current]);

        const chainHeadSha256 =
          data.chainHeadSha256 ?? stepsRef.current[stepsRef.current.length - 1]?.sha256 ?? '';

        setResult({
          chainDepth: data.chainDepth ?? stepsRef.current.length,
          chainHeadSha256,
          certificateId: data.certificateId ?? 'unknown',
        });
        setMessage('Chain of Evidence を保存しました。3秒後に証明書ページへ遷移します...');

        commitSealSnapshot(stepsRef.current);

        if (isMounted.current) onComplete?.();
      } catch (error) {
        if (!isMounted.current) return;
        setMessage(error instanceof Error ? error.message : '保存に失敗しました');
      } finally {
        if (isMounted.current) setSubmitting(false);
      }
    } else {
      // Normal flow (with Certificate)
      if (!certificate) return;

      try {
        const bundleId = certificate.process_bundle_id || crypto.randomUUID();

        const toUpload = stepsRef.current.filter(
          (s) => !s.isRoot && s.file && s.file.type.startsWith('image/') && s.uploadState !== 'uploaded',
        );

        if (toUpload.length > 0) {
          const needsUrls = toUpload.filter((s) => !s.signedUrl);
          if (needsUrls.length > 0) {
            await fetchUploadUrlsBulk(needsUrls, bundleId);
          }

          setSteps((cur) =>
            cur.map((s) => {
              if (
                !s.isRoot &&
                s.file &&
                s.uploadState !== 'uploaded' &&
                s.uploadState !== 'uploading'
              ) {
                return { ...s, uploadState: 'idle' };
              }
              return s;
            }),
          );

          const startedAt = Date.now();
          const TIMEOUT_MS = 120_000;
          while (true) {
            const targets = stepsRef.current.filter((s) => !s.isRoot && s.file && s.file.type.startsWith('image/'));
            const done = targets.every((s) => s.uploadState === 'uploaded');
            const failed = targets.some((s) => s.uploadState === 'error');
            if (done || targets.length === 0) break;
            if (failed) throw new Error('一部のアップロードに失敗しました。再試行してください。');
            if (Date.now() - startedAt > TIMEOUT_MS) {
              throw new Error('アップロードがタイムアウトしました。ネットワークを確認してください。');
            }
            await new Promise((r) => setTimeout(r, 250));
          }
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('認証トークンが見つかりません。再ログインしてください。');

        const jsonSteps = stepsRef.current.map((s, idx) => {
          const realId = s.id.startsWith('root-') ? s.id.replace('root-', '') : s.id;
          return {
            id: realId,
            stepType: s.stepType || 'other',
            title: s.title,
            note: s.note || '',
            sha256: s.sha256 ?? '',
            isRoot: s.isRoot ?? false,
            thumbnailPath: !s.isRoot && s.thumbnailPath ? s.thumbnailPath : undefined,
            previewUrl:
              !s.isRoot && s.uploadedPreviewUrl
                ? s.uploadedPreviewUrl
                : s.isRoot
                  ? s.previewUrl ?? undefined
                  : undefined,
            fileName: s.file?.name ?? (certificate as any)?.file_name,
            fileSize: s.file?.size ?? (certificate as any)?.file_size,
            mimeType: s.file?.type ?? (certificate as any)?.mime_type,
            proofMode: (isPublic ? 'shareable' : 'private') as 'shareable' | 'private',
            stepIndex: idx,
          };
        });

        const payload = {
          certificateId: certificate.id,
          bundleId,
          title,
          description,
          isPublic,
          revision: revisionCount + 1,
          items: jsonSteps,
        };

        const res = await fetch('/api/process-bundles/create-json', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `API エラー (${res.status})`);
        }

        const data = await res.json();
        setSteps([...stepsRef.current]);

        const chainHeadSha256 =
          data.chainHeadSha256 ?? stepsRef.current[stepsRef.current.length - 1]?.sha256 ?? '';

        setResult({
          chainDepth: data.chainDepth ?? stepsRef.current.length,
          chainHeadSha256,
          certificateId: data.certificateId ?? certificate.id,
        });
        setMessage('Chain of Evidence を保存しました。');

        setRevisionCount((prev) => prev + 1);
        commitSealSnapshot(stepsRef.current);

        setTimeout(() => {
          if (isMounted.current && onComplete) onComplete();
        }, 2000);
      } catch (error) {
        if (!isMounted.current) return;
        setMessage(error instanceof Error ? error.message : '保存に失敗しました');
      } finally {
        if (isMounted.current) setSubmitting(false);
      }
    }
  }, [
    certificate,
    magicMode,
    submitting,
    title,
    description,
    isPublic,
    revisionCount,
    setRevisionCount,
    commitSealSnapshot,
    runHybridCompression,
    reHashAfterCompression,
    fetchUploadUrlsBulk,
    urlCacheRef,
    setSteps,
    onComplete,
  ]);

  return {
    submitting,
    message,
    result,
    executeSubmit,
  };
}
