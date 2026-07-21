// client/src/components/proof/ProcessBundleComposer.tsx
/**
 * ProcessBundleComposer.tsx — Orchestrator V2 (Thin Wiring Board)
 * ─────────────────────────────────────────────────────────────────────────────────
 * すべてのビジネスロジックはカスタムフック群に分離され、このファイルはPropsを配線する
 * だけの「極薄の配線盤」に徹しています。
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Archive,
  ChevronDown,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Trash2,
  Wand2,
  Zap,
} from 'lucide-react';
import type { CertificateRecord } from '../../lib/proofmark-types';
import { supabase } from '../../lib/supabase';
import VerifiedBadge from '../ui/VerifiedBadge';
import TimelineWorkspace from './TimelineWorkspace';
import ResolutionArea from './ResolutionArea';

// Hooks
import { useWorkspaceState } from '../../hooks/useWorkspaceState';
import { useMediaPipeline } from '../../hooks/useMediaPipeline';
import { useGhostUploader } from '../../hooks/useGhostUploader';
import { useDualStateSignature } from '../../hooks/useDualStateSignature';
import { useSubmitOrchestrator } from '../../hooks/useSubmitOrchestrator';

/* ═══════════════════════════════════════════════════════════════
   DangerZoneAffordance (右上3点メニュー)
   ═══════════════════════════════════════════════════════════════ */

interface DangerZoneAffordanceProps {
  open: boolean;
  onToggle: () => void;
  onArchive?: () => void;
  onDiscard: () => void;
  disabled?: boolean;
}

function DangerZoneAffordance({
  open,
  onToggle,
  onArchive,
  onDiscard,
  disabled,
}: DangerZoneAffordanceProps) {
  return (
    <div className="absolute top-5 right-5 z-30">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        title="操作メニュー"
        aria-label="操作メニュー"
        aria-expanded={open}
        className="w-8 h-8 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 backdrop-blur-md text-[#A8A0D8]/70 hover:text-white hover:border-white/20 hover:bg-white/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 mt-2 w-60 rounded-2xl border border-white/10 backdrop-blur-xl overflow-hidden"
            style={{
              background: 'rgba(15,15,17,0.88)',
              boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div className="px-3 py-2 border-b border-white/5">
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#A8A0D8]/60">
                Workspace Actions
              </p>
            </div>

            {onArchive && (
              <button
                type="button"
                onClick={onArchive}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#A8A0D8] hover:bg-white/5 hover:text-white transition-colors text-left"
              >
                <Archive className="w-3.5 h-3.5 text-[#A8A0D8]/70" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">アーカイブへ移動</div>
                  <div className="text-[10px] text-[#A8A0D8]/50">後から復元できます</div>
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={onDiscard}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#FF8A85] hover:bg-[#FF4D4D]/10 hover:text-[#FF8A85] transition-colors text-left"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold">この Workspace を破棄</div>
                <div className="text-[10px] text-[#FF8A85]/60">ローカル状態をクリア・取り消し不可</div>
              </div>
            </button>

            <div className="px-3 py-2 border-t border-white/5 bg-white/[0.02]">
              <p className="text-[9px] text-[#A8A0D8]/40 leading-relaxed">
                封印済みの証明書を実際に削除するには、ダッシュボードのアーカイブから操作してください。
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════════════════════ */

export interface ProcessBundleComposerProps {
  certificate: CertificateRecord | null;
  initialFiles?: File[];
  onComplete?: () => void;
  onArchive?: () => void;
  onDiscard?: () => void;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN ORCHESTRATOR
   ═══════════════════════════════════════════════════════════════ */

export function ProcessBundleComposer({
  certificate,
  initialFiles,
  onComplete,
  onArchive,
  onDiscard,
}: ProcessBundleComposerProps) {
  const [, setLocation] = useLocation();

  // Local state that is shared across hooks but not in a single hook
  const [showMeta, setShowMeta] = useState(false);
  const [globalDragOver, setGlobalDragOver] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [upsellIntent, setUpsellIntent] = useState<{
    needed: number;
    targetPlan: string;
    currentRemaining: number;
  } | null>(null);
  const [quota, setQuota] = useState<{
    plan: string;
    limit: number;
    used: number;
    remaining: number;
  } | null>(null);

  // Shared Ref caches for image URLs
  const urlCacheRef = useRef<Map<string, string>>(new Map());
  const thumbCacheRef = useRef<Map<string, string>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Avoid circular dependency with mediaActionsRef
  const mediaActionsRef = useRef<{
    computeHash: (stepId: string, file: File) => Promise<void>;
    generateThumb: (file: File) => Promise<{ url: string; blob: Blob }>;
  } | null>(null);

  const handleHydrationUpdate = useCallback(
    (sig: string, metaSig: string, steps: any[], t: string, d: string) => {
      dualState.setSealedSnapshots(sig, metaSig, steps, t, d);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // 1. Workspace State Hook (CRUD / Hydration)
  const workspace = useWorkspaceState({
    certificate,
    initialFiles,
    mediaActionsRef,
    urlCacheRef,
    thumbCacheRef,
    quota,
    setUpsellIntent,
    onHydrated: handleHydrationUpdate,
  });

  // 2. Media Pipeline Hook (Mutex / WebP / Hashing)
  const mediaPipeline = useMediaPipeline(workspace.setSteps, urlCacheRef, thumbCacheRef);

  // Sync ref with actual pipeline methods
  mediaActionsRef.current = {
    computeHash: mediaPipeline.computeHash,
    generateThumb: mediaPipeline.generateThumb,
  };

  // 3. Ghost Uploader Hook (Semaphore queue & signed URLs)
  const ghostUploader = useGhostUploader({
    steps: workspace.steps,
    setSteps: workspace.setSteps,
    urlCacheRef,
    thumbCacheRef,
    generateUploadThumbnail: mediaPipeline.generateUploadThumbnail,
    isPublic: workspace.isPublic,
  });

  // 4. Dual State Signature Hook (Tracks modifications to signatures)
  const metaJson = (certificate as Record<string, unknown> | null)?.metadata_json as Record<string, unknown> || {};
  const initialRevision = (metaJson.revision as number) ?? 1;

  const dualState = useDualStateSignature({
    steps: workspace.steps,
    setSteps: workspace.setSteps,
    title: workspace.title,
    description: workspace.description,
    setTitle: workspace.setTitle,
    setDescription: workspace.setDescription,
    certificateId: certificate?.id ?? null,
    initialRevision,
    onSaveComplete: (msg) => {
      submitOrchestrator.executeSubmit(); // Trigger automatic metadata updates if needed
    },
  });

  // 5. Submit Orchestrator Hook (Flow control for submit / submitMagic)
  const submitOrchestrator = useSubmitOrchestrator({
    certificate,
    steps: workspace.steps,
    setSteps: workspace.setSteps,
    title: workspace.title,
    description: workspace.description,
    isPublic: workspace.isPublic,
    magicMode: workspace.magicMode,
    revisionCount: dualState.revisionCount,
    setRevisionCount: dualState.setRevisionCount,
    commitSealSnapshot: dualState.commitSealSnapshot,
    runHybridCompression: mediaPipeline.runHybridCompression,
    reHashAfterCompression: mediaPipeline.reHashAfterCompression,
    fetchUploadUrlsBulk: ghostUploader.fetchUploadUrlsBulk,
    urlCacheRef,
    onComplete,
  });

  // Derived calculations
  const readyCount = workspace.steps.filter((s) => s.isRoot || (s.file && s.title.trim())).length;
  const allVerified = workspace.steps.every((s) => s.hashState === 'verified');
  const allUploaded = workspace.steps.every((s) => s.isRoot || s.uploadState === 'uploaded');
  const revisionLabel = `v${dualState.revisionCount}`;
  const canSubmit = readyCount > 0 && allVerified && allUploaded;

  /* ── Handlers: Menus & File Uploads ── */
  const handleDiscard = useCallback(() => {
    if (onDiscard) {
      onDiscard();
    } else {
      workspace.setSteps([]);
      dualState.commitSealSnapshot([]);
    }
    setDangerOpen(false);
  }, [onDiscard, workspace, dualState]);

  const handleArchive = useCallback(() => {
    if (onArchive) onArchive();
    setDangerOpen(false);
  }, [onArchive]);

  const handleReplaceFile = useCallback(
    (stepId: string, file: File) => {
      const cache = urlCacheRef.current;
      const old = cache.get(stepId);
      if (old) URL.revokeObjectURL(old);
      cache.delete(stepId);

      const tCache = thumbCacheRef.current;
      const oldThumb = tCache.get(stepId);
      if (oldThumb) URL.revokeObjectURL(oldThumb);
      tCache.delete(stepId);

      const newUrl = URL.createObjectURL(file);
      cache.set(stepId, newUrl);

      workspace.updateStep(stepId, {
        file,
        previewUrl: newUrl,
        title: file.name.replace(/\.[^.]+$/, '') || '工程ステップ',
        hashState: 'idle',
        uploadState: 'idle',
      });

      mediaPipeline.computeHash(stepId, file);
      mediaPipeline.generateAndAttachThumb(stepId, file, workspace.updateStep);
    },
    [workspace, mediaPipeline],
  );

  const onGlobalDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    setGlobalDragOver(true);
  }, []);

  const onGlobalDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (
      e.clientX <= rect.left ||
      e.clientX >= rect.right ||
      e.clientY <= rect.top ||
      e.clientY >= rect.bottom
    ) {
      setGlobalDragOver(false);
    }
  }, []);

  const onGlobalDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setGlobalDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        workspace.addFilesAtIndex(e.dataTransfer.files, workspace.steps.length);
      }
    },
    [workspace],
  );

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        workspace.addFilesAtIndex(e.target.files, workspace.steps.length);
        e.target.value = '';
      }
    },
    [workspace],
  );

  // Fetch Quota
  useEffect(() => {
    const fetchQuota = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const res = await fetch('/api/user/quota', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) setQuota(await res.json());
        else if (res.status === 401) {
          setQuota({ plan: 'guest', limit: 3, used: 0, remaining: 3 });
        }
      } catch { /* noop */ }
    };
    fetchQuota();
  }, []);

  // 7. Global Teardown
  useEffect(() => {
    return () => {
      ghostUploader.abortAll();
      mediaPipeline.abortAll();

      urlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      urlCacheRef.current.clear();

      thumbCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      thumbCacheRef.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ══════════════════════════════════════════════════════════════
     EARLY RETURN: NO CERTIFICATE & NOT Magic Mode
     ══════════════════════════════════════════════════════════════ */
  if (!certificate && !workspace.magicMode) {
    return (
      <section className="w-full bg-[#0F0F11] border border-white/10 rounded-3xl p-6 md:p-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-5 text-sm text-[#A8A0D8]">
          まず先に証明書を1件発行すると、この作品に Chain of Evidence を接続できます。
        </div>
      </section>
    );
  }

  return (
    <section
      className={`
        relative w-full bg-[#0F0F11] border rounded-3xl p-6 md:p-8 transition-all duration-300
        ${
          globalDragOver
            ? 'border-[#00D4AA]/50 shadow-[0_0_60px_rgba(0,212,170,0.15)] ring-1 ring-[#00D4AA]/20'
            : 'border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.4)]'
        }
      `}
      onDragOver={onGlobalDragOver}
      onDragLeave={onGlobalDragLeave}
      onDrop={onGlobalDrop}
    >
      {/* VerifiedBadge */}
      <AnimatePresence>
        {dualState.sealed && (
          <motion.div
            key="external-verified-badge"
            initial={{ opacity: 0, scale: 0.85, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: -4 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            className="absolute z-40 pointer-events-none top-3 right-3"
            style={{ marginRight: 44 }}
          >
            <div className="pointer-events-auto relative" style={{ width: 134, height: 28 }}>
              <VerifiedBadge isMasked={!workspace.isPublic} reduce={false} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Danger Zone menu */}
      <DangerZoneAffordance
        open={dangerOpen}
        onToggle={() => setDangerOpen((v) => !v)}
        onArchive={onArchive ? handleArchive : undefined}
        onDiscard={handleDiscard}
        disabled={submitOrchestrator.submitting}
      />

      {/* Magic Mode Banner */}
      {workspace.magicMode && !dualState.sealed && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(108,62,244,0.12), rgba(0,212,170,0.08))',
            border: '1px solid rgba(108,62,244,0.30)',
          }}
        >
          <Wand2 className="w-4 h-4 text-[#BC78FF] shrink-0" />
          <span className="text-sm text-[#D4D0F4] leading-relaxed">
            <strong className="text-white">Magic Mode</strong> ・ 最後の{' '}
            <strong className="text-[#00D4AA]">HEAD（完成品）</strong> はオリジナル画質のまま、途中工程は封印時に WebP へ自動最適化されます。
          </span>
        </motion.div>
      )}

      {/* Compression Progress */}
      <AnimatePresence>
        {mediaPipeline.compression.phase !== 'idle' && mediaPipeline.compression.phase !== 'done' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-4 rounded-2xl border border-[#6C3EF4]/30 bg-[#6C3EF4]/10 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-[#BC78FF] animate-spin shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-bold text-white truncate">
                    {mediaPipeline.compression.caption}
                  </span>
                  {mediaPipeline.compression.total > 0 && (
                    <span className="text-[11px] font-mono text-[#A8A0D8] tabular-nums shrink-0 ml-3">
                      {mediaPipeline.compression.current} / {mediaPipeline.compression.total}
                    </span>
                  )}
                </div>
                <div className="h-1 rounded-full overflow-hidden bg-white/5">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #6C3EF4, #00D4AA)' }}
                    animate={{
                      width:
                        mediaPipeline.compression.total > 0
                          ? `${Math.min(
                              100,
                              (mediaPipeline.compression.current / mediaPipeline.compression.total) * 100,
                            )}%`
                          : '40%',
                    }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="mb-6 pr-12">
        <div className="text-[11px] uppercase tracking-[0.28em] text-[#A8A0D8]/60">
          Auto-Resolving Timeline Studio
        </div>
        <h2 className="mt-2 text-xl md:text-2xl font-black tracking-tight text-white">
          制作プロセスを証拠化する
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#A8A0D8]/70">
          画像をドロップするだけ — 古い順に自動整列。フリックで削除、ドラッグで並び替え可能。
          <span className="text-[#A8A0D8]/40">
            {' '}
            封印後に編集すると自動で新リヴィジョン (Fork-on-Write) になります。
          </span>
        </p>
      </div>

      {/* Timeline Workspace Component */}
      <TimelineWorkspace
        steps={workspace.steps}
        isHydrating={workspace.isHydrating}
        magicMode={workspace.magicMode}
        sealed={dualState.sealed}
        revisionLabel={revisionLabel}
        globalDragOver={globalDragOver}
        onReorder={workspace.setSteps}
        onRemove={(id) => workspace.removeStep(id, ghostUploader.abortStep)}
        onUpdate={workspace.updateStep}
        onReplace={handleReplaceFile}
        onOpenFileDialog={() => fileInputRef.current?.click()}
        fileInputRef={fileInputRef}
        onFileInputChange={onFileInputChange}
      />

      {/* Metadata Collapsible Area */}
      {workspace.steps.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowMeta(!showMeta)}
            className="flex items-center gap-2 text-xs font-bold text-[#A8A0D8]/50 hover:text-[#A8A0D8] transition-colors"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${showMeta ? 'rotate-180' : ''}`} />
            タイトル・説明を編集
            {dualState.hasUnsavedMeta && (
              <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#00D4AA]/15 border border-[#00D4AA]/30 text-[#00D4AA] text-[9px] font-black tracking-widest">
                UNSAVED
              </span>
            )}
          </button>
          {showMeta && (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[10px] uppercase tracking-widest text-[#A8A0D8]/50 font-bold">
                  Bundle title
                </span>
                <input
                  className="w-full bg-white/5 backdrop-blur-md border border-white/10 text-white text-sm rounded-2xl px-4 py-2.5 focus:outline-none focus:border-[#00D4AA]/60 placeholder-[#A8A0D8]/40 transition-colors"
                  value={workspace.title}
                  onChange={(e) => workspace.setTitle(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] uppercase tracking-widest text-[#A8A0D8]/50 font-bold">
                  Description
                </span>
                <input
                  className="w-full bg-white/5 backdrop-blur-md border border-white/10 text-white text-sm rounded-2xl px-4 py-2.5 focus:outline-none focus:border-[#00D4AA]/60 placeholder-[#A8A0D8]/40 transition-colors"
                  value={workspace.description}
                  onChange={(e) => workspace.setDescription(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-3 text-sm text-[#A8A0D8]/70 cursor-pointer md:col-span-2">
                <input
                  type="checkbox"
                  checked={workspace.isPublic}
                  onChange={(e) => workspace.setIsPublic(e.target.checked)}
                  className="accent-[#00D4AA]"
                />
                公開ページに表示する
              </label>
            </div>
          )}
        </div>
      )}

      {/* Resolution Area Component */}
      <ResolutionArea
        stepCount={workspace.steps.length}
        readyCount={readyCount}
        allVerified={allVerified}
        allUploaded={allUploaded}
        magicMode={workspace.magicMode}
        sealed={dualState.sealed}
        isForkedDraft={dualState.isForkedDraft}
        hasUnsavedMeta={dualState.hasUnsavedMeta}
        savingMeta={dualState.savingMeta}
        canSubmit={canSubmit}
        submitting={submitOrchestrator.submitting}
        compressionCaption={
          workspace.magicMode
            ? mediaPipeline.compression.caption || '処理中...'
            : 'Chain of Evidence を保存中...'
        }
        revisionLabel={revisionLabel}
        headSha={submitOrchestrator.result?.chainHeadSha256 ?? null}
        onSealed={submitOrchestrator.executeSubmit}
        onRevertToSealed={dualState.handleRevertToSealed}
        onRevertMetadata={dualState.handleRevertMetadata}
        onSaveMetadata={dualState.handleSaveMetadata}
        onViewCert={
          submitOrchestrator.result?.certificateId
            ? () => setLocation(`/cert/${submitOrchestrator.result.certificateId}`)
            : undefined
        }
      />

      {/* Submit message */}
      {submitOrchestrator.message && !submitOrchestrator.result && (
        <div className="mt-4 text-sm text-[#A8A0D8] bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3">
          {submitOrchestrator.message}
        </div>
      )}

      {/* Smart Upsell Modal */}
      <AnimatePresence>
        {upsellIntent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#07061A] border border-white/10 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-[#00D4AA]" />
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="text-xl font-bold text-white">アップグレードが必要です</h3>
              </div>
              <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                現在の残り枠（{upsellIntent.currentRemaining}枚）に対して、
                <strong className="text-white">{upsellIntent.needed}枚</strong> の証明書を発行しようとしています。
                全工程を連結するには、
                <strong className="text-[#00D4AA] capitalize">{upsellIntent.targetPlan} プラン</strong>{' '}
                へのアップグレードが必要です。
              </p>
              <div className="bg-[#121124] rounded-lg p-3 mb-6 border border-purple-500/30 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <p className="text-xs text-purple-200">
                  決済は別タブで開きます。
                  <strong>決済完了後、この画面に戻ればそのまま続きから再開できます。</strong>
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <a
                  href={`/pricing?plan=${upsellIntent.targetPlan}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setUpsellIntent(null)}
                  className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-600 to-[#00D4AA] text-white font-bold tracking-wide hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  {upsellIntent.targetPlan} にアップグレード <ExternalLink className="w-4 h-4 opacity-50" />
                </a>
                <button
                  onClick={() => setUpsellIntent(null)}
                  className="w-full py-3 rounded-lg bg-white/5 text-gray-400 font-medium hover:bg-white/10 transition-colors"
                >
                  今はやめておく（枚数を減らす）
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default ProcessBundleComposer;
