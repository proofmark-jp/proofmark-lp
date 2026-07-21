// client/src/hooks/useDualStateSignature.ts
import { useState, useMemo, useCallback } from 'react';
import type { WorkspaceStep } from './useMediaPipeline';
import { supabase } from '../lib/supabase';

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

export interface UseDualStateSignatureOptions {
  steps: WorkspaceStep[];
  setSteps: React.Dispatch<React.SetStateAction<WorkspaceStep[]>>;
  title: string;
  description: string;
  setTitle: (t: string) => void;
  setDescription: (d: string) => void;
  certificateId: string | null;
  initialRevision?: number;
  onSaveComplete?: (message: string) => void;
}

export interface UseDualStateSignatureReturn {
  sealed: boolean;
  isForkedDraft: boolean;
  hasUnsavedMeta: boolean;
  savingMeta: boolean;
  revisionCount: number;
  setRevisionCount: React.Dispatch<React.SetStateAction<number>>;
  // Snapshots updating for useWorkspaceState hydration
  setSealedSnapshots: (sig: string, metaSig: string, steps: WorkspaceStep[], title: string, desc: string) => void;
  handleRevertToSealed: () => void;
  handleRevertMetadata: () => void;
  handleSaveMetadata: () => Promise<void>;
  commitSealSnapshot: (newSteps?: WorkspaceStep[]) => void;
}

export function useDualStateSignature({
  steps,
  setSteps,
  title,
  description,
  setTitle,
  setDescription,
  certificateId,
  initialRevision = 1,
  onSaveComplete,
}: UseDualStateSignatureOptions): UseDualStateSignatureReturn {
  const [sealedSignatureSnapshot, setSealedSignatureSnapshot] = useState<string | null>(null);
  const [sealedMetaSignatureSnapshot, setSealedMetaSignatureSnapshot] = useState<string | null>(null);
  const [sealedStepsSnapshot, setSealedStepsSnapshot] = useState<WorkspaceStep[] | null>(null);
  const [sealedTitleSnapshot, setSealedTitleSnapshot] = useState<string>('');
  const [sealedDescriptionSnapshot, setSealedDescriptionSnapshot] = useState<string>('');
  const [revisionCount, setRevisionCount] = useState<number>(initialRevision);
  const [savingMeta, setSavingMeta] = useState(false);

  const currentSignature = useMemo(() => stepsSignature(steps), [steps]);
  const currentMetaSignature = useMemo(
    () => generateMetaSignature(steps, title, description),
    [steps, title, description],
  );

  const sealed = sealedSignatureSnapshot !== null && sealedSignatureSnapshot === currentSignature;
  const isForkedDraft = sealedSignatureSnapshot !== null && sealedSignatureSnapshot !== currentSignature;
  const hasUnsavedMeta =
    sealed &&
    sealedMetaSignatureSnapshot !== null &&
    sealedMetaSignatureSnapshot !== currentMetaSignature;

  const setSealedSnapshots = useCallback(
    (sig: string, metaSig: string, stepsSnap: WorkspaceStep[], t: string, d: string) => {
      setSealedSignatureSnapshot(sig);
      setSealedMetaSignatureSnapshot(metaSig);
      setSealedStepsSnapshot(stepsSnap.map((step) => ({ ...step })));
      setSealedTitleSnapshot(t);
      setSealedDescriptionSnapshot(d);
    },
    [],
  );

  const handleRevertToSealed = useCallback(() => {
    if (!sealedStepsSnapshot) return;
    setSteps(sealedStepsSnapshot.map((step) => ({ ...step })));
  }, [sealedStepsSnapshot, setSteps]);

  const handleRevertMetadata = useCallback(() => {
    if (!sealedStepsSnapshot) return;
    setSteps((cur) =>
      cur.map((s) => {
        const snap = sealedStepsSnapshot.find((ss) => ss.id === s.id);
        if (snap) return { ...s, title: snap.title, note: snap.note };
        return s;
      }),
    );
    setTitle(sealedTitleSnapshot);
    setDescription(sealedDescriptionSnapshot);
  }, [sealedStepsSnapshot, sealedTitleSnapshot, sealedDescriptionSnapshot, setSteps, setTitle, setDescription]);

  const handleSaveMetadata = useCallback(async () => {
    if (!certificateId || savingMeta) return;
    setSavingMeta(true);
    try {
      const { data: latestCert, error: fetchErr } = await supabase
        .from('certificates')
        .select('metadata_json')
        .eq('id', certificateId)
        .single();
      if (fetchErr) throw fetchErr;

      const currentMeta: Record<string, unknown> = {
        ...((latestCert?.metadata_json as Record<string, unknown>) || {}),
      };
      currentMeta.title = title;
      currentMeta.description = description;

      const nonRootSteps = steps.filter((s) => !s.isRoot);
      if (nonRootSteps.length > 0) {
        const existingHistMap = new Map<string, Record<string, unknown>>();
        if (Array.isArray(currentMeta.chain_history)) {
          for (const histStep of currentMeta.chain_history as Record<string, unknown>[]) {
            if (histStep.id) existingHistMap.set(histStep.id as string, histStep);
            if (histStep.sha256) existingHistMap.set(histStep.sha256 as string, histStep);
          }
        }
        currentMeta.chain_history = nonRootSteps.map((s) => {
          const existing = existingHistMap.get(s.id) ?? existingHistMap.get(s.sha256 ?? '') ?? {};
          return { ...existing, id: s.id, title: s.title, description: s.note || '' };
        });
      }

      const { error: updateErr } = await supabase
        .from('certificates')
        .update({ title, description, metadata_json: currentMeta })
        .eq('id', certificateId);
      if (updateErr) throw updateErr;

      const metaSig = generateMetaSignature(steps, title, description);
      setSealedMetaSignatureSnapshot(metaSig);
      setSealedStepsSnapshot(steps.map((step) => ({ ...step })));
      setSealedTitleSnapshot(title);
      setSealedDescriptionSnapshot(description);

      if (onSaveComplete) {
        onSaveComplete('✓ テキストの変更を保存しました (TSA 非消費)。');
      }
    } catch (err) {
      console.error('[useDualStateSignature] Save metadata failed:', err);
      throw err;
    } finally {
      setSavingMeta(false);
    }
  }, [certificateId, savingMeta, steps, title, description, onSaveComplete]);

  const commitSealSnapshot = useCallback(
    (newSteps?: WorkspaceStep[]) => {
      const activeSteps = newSteps || steps;
      const sig = stepsSignature(activeSteps);
      const metaSig = generateMetaSignature(activeSteps, title, description);

      setSealedSignatureSnapshot(sig);
      setSealedMetaSignatureSnapshot(metaSig);
      setSealedStepsSnapshot(activeSteps.map((step) => ({ ...step })));
      setSealedTitleSnapshot(title);
      setSealedDescriptionSnapshot(description);
    },
    [steps, title, description],
  );

  return {
    sealed,
    isForkedDraft,
    hasUnsavedMeta,
    savingMeta,
    revisionCount,
    setRevisionCount,
    setSealedSnapshots,
    handleRevertToSealed,
    handleRevertMetadata,
    handleSaveMetadata,
    commitSealSnapshot,
  };
}
