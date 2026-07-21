// client/src/hooks/useWorkspaceState.ts
import { useState, useEffect, useCallback } from 'react';
import type { CertificateRecord, BundleStepType } from '../lib/proofmark-types';
import { supabase } from '../lib/supabase';
import type { WorkspaceStep } from './useMediaPipeline';

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function fileBaseName(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

function guessStepType(name: string): BundleStepType {
  const lower = name.toLowerCase();
  if (/rough|ラフ|draft|sketch/i.test(lower)) return 'rough';
  if (/line|lineart|線画|ink/i.test(lower)) return 'lineart';
  if (/color|着色|paint|塗/i.test(lower)) return 'color';
  if (/final|完成|finish|done/i.test(lower)) return 'final';
  return 'other';
}

function stepsSignature(steps: WorkspaceStep[]): string {
  let hash = 2166136261;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const chunk = `${i}:${s.id}:${s.sha256 ?? ''}`;
    for (let j = 0; j < chunk.length; j++) {
      hash ^= chunk.charCodeAt(j);
      hash = Math.imul(hash, 16777619);
    }
  }
  return hash.toString(16);
}

function generateMetaSignature(
  steps: WorkspaceStep[],
  bundleTitle: string,
  bundleDesc: string,
): string {
  return (
    steps.map((s) => `${s.title}:${s.note ?? ''}`).join('|') +
    `|${bundleTitle}|${bundleDesc}`
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════════════════════ */

export interface UseWorkspaceStateOptions {
  certificate: CertificateRecord | null;
  initialFiles?: File[];
  mediaActionsRef: React.MutableRefObject<{
    computeHash: (stepId: string, file: File) => Promise<void>;
    generateThumb: (file: File) => Promise<{ url: string; blob: Blob }>;
  } | null>;
  urlCacheRef: React.MutableRefObject<Map<string, string>>;
  thumbCacheRef: React.MutableRefObject<Map<string, string>>;
  quota: { remaining: number } | null;
  setUpsellIntent: (intent: { needed: number; targetPlan: string; currentRemaining: number } | null) => void;
  // Snapshots for dual state (passed down to update on hydration)
  onHydrated: (sig: string, metaSig: string, steps: WorkspaceStep[], title: string, desc: string) => void;
}

export interface UseWorkspaceStateReturn {
  steps: WorkspaceStep[];
  setSteps: React.Dispatch<React.SetStateAction<WorkspaceStep[]>>;
  title: string;
  description: string;
  isPublic: boolean;
  magicMode: boolean;
  isHydrating: boolean;
  setTitle: (t: string) => void;
  setDescription: (d: string) => void;
  setIsPublic: (p: boolean) => void;
  updateStep: (id: string, patch: Partial<WorkspaceStep>) => void;
  removeStep: (id: string, abortStepUpload: (id: string) => void) => void;
  addFilesAtIndex: (files: File[] | FileList, index: number) => Promise<void>;
}

/* ═══════════════════════════════════════════════════════════════
   HOOK
   ═══════════════════════════════════════════════════════════════ */

export function useWorkspaceState({
  certificate,
  initialFiles,
  mediaActionsRef,
  urlCacheRef,
  thumbCacheRef,
  quota,
  setUpsellIntent,
  onHydrated,
}: UseWorkspaceStateOptions): UseWorkspaceStateReturn {
  const metaJson = (certificate as Record<string, unknown> | null)?.metadata_json as Record<string, unknown> || {};

  const [steps, setSteps] = useState<WorkspaceStep[]>([]);
  const [title, setTitle] = useState(
    (metaJson.title as string) ?? certificate?.title ?? 'Chain of Evidence',
  );
  const [description, setDescription] = useState(
    (metaJson.description as string) ??
    ((certificate as Record<string, unknown> | null)?.description as string) ??
    '制作工程を時系列に連結し、人間の試行錯誤の痕跡そのものを証拠化します。',
  );
  const [isPublic, setIsPublic] = useState(
    certificate ? certificate.visibility === 'public' : true,
  );
  const [isHydrating, setIsHydrating] = useState(true);

  const magicMode = !certificate && Array.isArray(initialFiles) && initialFiles.length >= 1;

  const updateStep = useCallback((id: string, patch: Partial<WorkspaceStep>) => {
    setSteps((cur) => cur.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const removeStep = useCallback((id: string, abortStepUpload: (id: string) => void) => {
    abortStepUpload(id);

    const previewUrl = urlCacheRef.current.get(id);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      urlCacheRef.current.delete(id);
    }
    
    const thumbUrl = thumbCacheRef.current.get(id);
    if (thumbUrl) {
      URL.revokeObjectURL(thumbUrl);
      thumbCacheRef.current.delete(id);
    }

    setSteps((cur) => cur.filter((s) => s.id !== id));
  }, [urlCacheRef, thumbCacheRef]);

  const addFilesAtIndex = useCallback(
    async (files: File[] | FileList, insertAt: number) => {
      const fileArray = Array.from(files)
        .filter((f) => f.type.startsWith('image/'))
        .sort((a, b) => a.lastModified - b.lastModified);
      if (fileArray.length === 0) return;

      const existingKeys = new Set(
        steps.map((s) => (s.file ? `${s.file.name}-${s.file.size}-${s.file.lastModified}` : '')),
      );
      const uniqueFiles = fileArray.filter(
        (f) => !existingKeys.has(`${f.name}-${f.size}-${f.lastModified}`),
      );
      if (uniqueFiles.length === 0) return;

      const needed = steps.length + uniqueFiles.length;
      if (needed > 150) {
        alert('システムの物理上限（150枚）を超えるため追加できません。');
        return;
      }

      if (quota && needed > quota.remaining && !magicMode) {
        let targetPlan = 'creator';
        if (needed > 30) targetPlan = 'studio';
        setUpsellIntent({ needed, targetPlan, currentRemaining: quota.remaining });
        return;
      }

      const modifiedTimes = uniqueFiles.map((f) => f.lastModified);
      const hasDuplicateTimestamps =
        new Set(modifiedTimes).size !== modifiedTimes.length ||
        steps.some((s) => s.file && modifiedTimes.includes(s.file.lastModified));

      const baseSteps: WorkspaceStep[] = uniqueFiles.map((file) => ({
        id: crypto.randomUUID(),
        stepType: guessStepType(file.name),
        title: fileBaseName(file.name) || '途中工程',
        note: '',
        file,
        previewUrl: undefined,
        hashState: 'idle',
        uploadState: magicMode ? 'idle' : 'fetching_url',
        sameTimestamp: hasDuplicateTimestamps,
        deferred: magicMode,
      }));

      setSteps((cur) => {
        const copy = [...cur];
        copy.splice(insertAt, 0, ...baseSteps);
        return copy;
      });

      for (const s of baseSteps) {
        const purl = URL.createObjectURL(s.file!);
        urlCacheRef.current.set(s.id, purl);
        let thumb: { url: string; blob: Blob } | null = null;
        let thumbFailed = false;
        try {
          if (mediaActionsRef.current) {
            thumb = await mediaActionsRef.current.generateThumb(s.file!);
            thumbCacheRef.current.set(s.id, thumb.url);
          }
        } catch {
          thumbFailed = true;
        }

        setSteps((cur) =>
          cur.map((item) =>
            item.id === s.id
              ? {
                  ...item,
                  previewUrl: purl,
                  thumbUrl: thumb?.url,
                  thumbBlob: thumb?.blob,
                  ...(thumbFailed ? { uploadState: 'error' } : {}),
                }
              : item,
          ),
        );
        await new Promise((r) => setTimeout(r, 10)); // COMPRESSION_YIELD_MS
      }

      for (let i = 0; i < baseSteps.length; i++) {
        if (mediaActionsRef.current) {
          mediaActionsRef.current.computeHash(baseSteps[i].id, baseSteps[i].file!);
        }
        if (i % 5 === 4) await new Promise((r) => setTimeout(r, 10));
      }
    },
    [steps, mediaActionsRef, urlCacheRef, thumbCacheRef, quota, magicMode, setUpsellIntent],
  );

  // Hydration logic
  useEffect(() => {
    let isMounted = true;

    if (magicMode) {
      if (!initialFiles) return;
      const seedFromFiles = async () => {
        const seen = new Set<string>();
        const unique = initialFiles.filter((f) => {
          const k = `${f.name}-${f.size}-${f.lastModified}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });

        const baseSteps: WorkspaceStep[] = unique.map((f) => ({
          id: crypto.randomUUID(),
          stepType: guessStepType(f.name),
          title: fileBaseName(f.name) || '途中工程',
          note: '',
          file: f,
          previewUrl: undefined,
          hashState: 'idle',
          uploadState: 'idle',
          deferred: true,
        }));

        if (!isMounted) return;
        setSteps(baseSteps);
        setIsHydrating(false);

        for (const step of baseSteps) {
          if (!isMounted) break;
          const purl = URL.createObjectURL(step.file!);
          urlCacheRef.current.set(step.id, purl);
          let thumb: { url: string; blob: Blob } | null = null;
          try {
            if (mediaActionsRef.current) {
              thumb = await mediaActionsRef.current.generateThumb(step.file!);
              thumbCacheRef.current.set(step.id, thumb.url);
            }
          } catch { /* skip */ }
          if (!isMounted) {
            if (thumb) {
              URL.revokeObjectURL(thumb.url);
              thumbCacheRef.current.delete(step.id);
            }
            break;
          }
          setSteps((cur) =>
            cur.map((s) =>
              s.id === step.id
                ? { ...s, previewUrl: purl, thumbUrl: thumb?.url, thumbBlob: thumb?.blob }
                : s,
            ),
          );
          await new Promise((r) => setTimeout(r, 10));
        }

        baseSteps.forEach((s) => {
          if (mediaActionsRef.current) {
            mediaActionsRef.current.computeHash(s.id, s.file!);
          }
        });
      };

      setSteps([]);
      setIsHydrating(true);
      seedFromFiles();
      return () => {
        isMounted = false;
      };
    }

    if (!certificate) {
      setIsHydrating(false);
      return;
    }

    const loadExistingChain = async () => {
      const hydrateSealedSnapshot = (loadedSteps: WorkspaceStep[]) => {
        if (!isMounted) return;
        const sig = stepsSignature(loadedSteps);
        const metaSig = generateMetaSignature(
          loadedSteps,
          certificate.title ?? title,
          (certificate as any).description ?? description,
        );
        onHydrated(
          sig,
          metaSig,
          loadedSteps,
          certificate.title ?? title,
          (certificate as any).description ?? description,
        );
        if (certificate.title) setTitle(certificate.title);
        if ((certificate as any).description) setDescription((certificate as any).description);
      };

      if (!certificate.process_bundle_id) {
        const loadedSteps: WorkspaceStep[] = [
          {
            id: `root-${certificate.id}`,
            stepType: 'other',
            title: certificate.title || '原本 (Base Layer)',
            note: '証明書として登録済みの原本データ',
            previewUrl: certificate.public_image_url || undefined,
            sha256: certificate.sha256,
            hashState: 'verified',
            isRoot: true,
            uploadState: 'uploaded',
          },
        ];
        if (isMounted) {
          setSteps(loadedSteps);
          hydrateSealedSnapshot(loadedSteps);
        }
        return;
      }

      let fetchedSteps: any[] | null = null;
      try {
        const { data, error } = await supabase
          .from('process_bundle_steps')
          .select('*')
          .eq('bundle_id', certificate.process_bundle_id);

        if (!error && Array.isArray(data) && data.length > 0) {
          fetchedSteps = data;
        }
      } catch (e) {
        console.error('Supabase client fetch failed:', e);
      }

      if (fetchedSteps && Array.isArray(fetchedSteps) && fetchedSteps.length > 0 && isMounted) {
        const sorted = [...fetchedSteps].sort((a, b) => (a.step_index || 0) - (b.step_index || 0));
        const loadedSteps: WorkspaceStep[] = sorted.map((s) => ({
          id: `root-${s.id}`,
          stepType: s.step_type || s.stepType || 'other',
          title: s.title || '過去 of 工程',
          note: s.description || s.note || '',
          previewUrl: s.preview_url || s.previewUrl || s.image_url || certificate.public_image_url,
          sha256: s.sha256,
          hashState: 'verified',
          isRoot: true,
          uploadState: 'uploaded',
        }));
        setSteps(loadedSteps);
        hydrateSealedSnapshot(loadedSteps);
        return;
      }

      if (isMounted) {
        const loadedSteps: WorkspaceStep[] = [
          {
            id: `root-${certificate.id}`,
            stepType: 'other',
            title: certificate.title || '原本 (Base Layer)',
            note: '証明書として登録済みの原本データ',
            previewUrl: certificate.public_image_url || undefined,
            sha256: certificate.sha256,
            hashState: 'verified',
            isRoot: true,
            uploadState: 'uploaded',
          },
        ];
        setSteps(loadedSteps);
        hydrateSealedSnapshot(loadedSteps);
      }
    };

    setSteps([]);
    setIsHydrating(true);
    loadExistingChain().finally(() => {
      if (isMounted) setIsHydrating(false);
    });

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certificate, magicMode]);

  return {
    steps,
    setSteps,
    title,
    description,
    isPublic,
    magicMode,
    isHydrating,
    setTitle,
    setDescription,
    setIsPublic,
    updateStep,
    removeStep,
    addFilesAtIndex,
  };
}
