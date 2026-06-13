/**
 * ProcessBundleComposer.tsx — Auto-Resolving Timeline v4 (Fluid UX / Git-for-Creators)
 * ─────────────────────────────────────────────────────────────────────────────────
 * v3 (Hybrid Payload) を完全保持しつつ、以下の Fluid UX を上書き実装。
 *
 *   ① Fork-on-Write
 *      sealed === true の最中でも、steps を編集（追加/削除/並び替え）した瞬間
 *      自動的に Draft へ復帰する。「Git for Creators」をUIで体現。
 *
 *   ② The Canvas (Draft)
 *      steps.length === 0 では Slide to Seal を物理無効化（opacity-30 + grayscale +
 *      pointer-events-none）。「Autosaved (ProofMark Secure Storage)」を控えめに添える。
 *
 *   ③ The Resolution (Sealed)
 *      sealed === true && submit 完了で、Slider を AnimatePresence で滑らかに消去し、
 *      Verified Badge を spring(stiffness:200, damping:20) で下から浮上させる。
 *
 *   ④ The Danger Zone
 *      ヘッダ右上に「破棄/アーカイブ」アフォーダンス placeholder を配置。
 *
 * 不変条件 (1ミリも壊さない):
 *  - hashWorker.ts への通信プロトコル
 *  - Reorder.Group / framer-motion / layoutId
 *  - 既存の certificate ベース・ハイドレーション
 *  - Ghost Upload Watcher の concurrency / abort 制御
 *  - Smart Upsell / Quota 表示
 *  - submitMagic / submit / runHybridCompression / reHashAfterCompression
 *  - /api/upload-url, /api/certificates/create, /api/user/quota
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'wouter';
import {
  AnimatePresence,
  Reorder,
  motion,
  useMotionValue,
  useTransform,
  animate,
} from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  CloudLightning,
  ExternalLink,
  GitBranch,
  ImagePlus,
  Layers3,
  Loader2,
  Lock,
  MoreHorizontal,
  RefreshCw,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  Zap,
  Wand2,
  ShieldCheck,
  Archive,
} from 'lucide-react';
const CloudAll = CheckCircle2;
import { createProcessBundle } from '../../lib/proofmark-api';
import type {
  BundleStepType,
  CertificateRecord,
  ProcessBundleDraftStep,
} from '../../lib/proofmark-types';
import type { HashRequest, HashResponse } from '../../workers/hashWorker';
import { compressProcessStepImage } from '../../lib/image-compression';
import { supabase } from '../../lib/supabase';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const THUMB_MAX_PX = 200;
const SEAL_THRESHOLD = 200;
const FLICK_VELOCITY_THRESHOLD = 400;
const MAX_CONCURRENT_UPLOADS = 5;
const COMPRESSION_YIELD_MS = 10;

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

async function generateThumb(file: File): Promise<{ url: string, blob: Blob }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const srcUrl = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, THUMB_MAX_PX / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(srcUrl); reject(new Error('no ctx')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(srcUrl);
        if (blob) resolve({ url: URL.createObjectURL(blob), blob });
        else reject(new Error('blob null'));
      }, 'image/webp', 0.7);
    };
    img.onerror = () => { URL.revokeObjectURL(srcUrl); reject(new Error('load fail')); };
    img.src = srcUrl;
  });
}

/** Fork-on-Write 判定用: steps の「形」を 1 文字列に圧縮するシグネチャ。 */
function stepsSignature(steps: WorkspaceStep[]): string {
  return steps.map((s, i) => `${i}:${s.id}:${s.sha256 ?? ''}`).join('|');
}


/* ═══════════════════════════════════════════════════════════════
   EXTENDED STEP TYPE — adds hash state for UI
   ═══════════════════════════════════════════════════════════════ */

type WorkspaceStep = ProcessBundleDraftStep & {
  hashState: 'idle' | 'hashing' | 'verified';
  hashProgress?: number;
  sha256?: string;
  isRoot?: boolean;
  thumbUrl?: string;
  sameTimestamp?: boolean;
  uploadState?: 'idle' | 'fetching_url' | 'uploading' | 'uploaded' | 'error';
  thumbBlob?: Blob;
  quarantinePath?: string;
  thumbQuarantinePath?: string;
  signedUrl?: string;
  thumbSignedUrl?: string;
  deferred?: boolean;
};

/* ═══════════════════════════════════════════════════════════════
   WORKER POOL — hashWorker をシングルトン管理 (変更禁止領域)
   ═══════════════════════════════════════════════════════════════ */

let _workerInstance: Worker | null = null;
const _workerCallbacks = new Map<
  string,
  { onProgress: (p: number) => void; onSuccess: (h: string) => void; onError: () => void }
>();

function getWorker(): Worker {
  if (!_workerInstance) {
    _workerInstance = new Worker(
      new URL('../../workers/hashWorker.ts', import.meta.url),
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
        _workerCallbacks.delete(msg.id);
      } else {
        cb.onError();
        _workerCallbacks.delete(msg.id);
      }
    };
  }
  return _workerInstance;
}

/* ═══════════════════════════════════════════════════════════════
   v3: Compression Progress State (継続)
   ═══════════════════════════════════════════════════════════════ */

type CompressionProgress = {
  phase: 'idle' | 'compressing' | 'rehashing' | 'uploading' | 'submitting' | 'done';
  current: number;
  total: number;
  caption: string;
};

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export interface ProcessBundleComposerProps {
  certificate: CertificateRecord | null;
  initialFiles?: File[];
  onComplete?: () => void;
  /** v4: 右上 Danger Zone の「破棄/アーカイブ」アクション。未指定なら placeholder のみ */
  onArchive?: () => void;
  onDiscard?: () => void;
}

export function ProcessBundleComposer({
  certificate,
  initialFiles,
  onComplete,
  onArchive,
  onDiscard,
}: ProcessBundleComposerProps) {
  /* ── core state ── */
  const [title, setTitle] = useState('Chain of Evidence');
  const [description, setDescription] = useState(
    '制作工程を時系列に連結し、人間の試行錯誤の痕跡そのものを証拠化します。',
  );
  const [isPublic, setIsPublic] = useState(true);
  const [steps, setSteps] = useState<WorkspaceStep[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{
    chainDepth: number;
    chainHeadSha256: string | null;
    certificateId: string;
  } | null>(null);
  const [, setLocation] = useLocation();
  const [showMeta, setShowMeta] = useState(false);

  const [globalDragOver, setGlobalDragOver] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [scrubIndex, setScrubIndex] = useState(0);

  /* ─────────────────────────────────────────────────────────────
   * 🚀 Upgrade 1: Derived State — Zero-Jitter Sealed Architecture
   *
   * 旧来の `sealed` boolean + Fork-on-Write useEffect を完全廃棄。
   * 封印時点のシグネチャをスナップショットとして保持し、現在の
   * `currentSignature` と比較することで Sealed / Draft / ForkedDraft を
   * シングルレンダで瞬時に判定する。Reactのダブルレンダリングを撲滅。
   * ─────────────────────────────────────────────────────────────
   */

  /** 封印時点のシグネチャ。null = Draft 状態 */
  const [sealedSignatureSnapshot, setSealedSignatureSnapshot] = useState<string | null>(null);

  /** 常に steps の最新形状を 1 文字列で表現 */
  const currentSignature = useMemo(() => stepsSignature(steps), [steps]);

  /** Sealed: 封印後に一切の変更がない純粋な封印状態 */
  const sealed = sealedSignatureSnapshot !== null && sealedSignatureSnapshot === currentSignature;

  /** ForkedDraft: 封印後に編集が加えられ、新リヴィジョンへ派生した状態 */
  const isForkedDraft = sealedSignatureSnapshot !== null && sealedSignatureSnapshot !== currentSignature;

  /* ─────────────────────────────────────────────────────────────
   * 🚀 Upgrade 2: Time-Travel Revert — Git Checkout for Creators
   *
   * 封印完了時に steps のディープコピーを保存。isForkedDraft 時に
   * Revert ボタンから呼び出すことで瞬時に Sealed 状態へ巻き戻す。
   * ─────────────────────────────────────────────────────────────
   */

  /** 封印完了時点の steps のディープコピー（Revert 用） */
  const [sealedStepsSnapshot, setSealedStepsSnapshot] = useState<WorkspaceStep[] | null>(null);

  /** Revert ボタンで封印状態の steps に巻き戻す */
  const handleRevertToSealed = useCallback(() => {
    if (!sealedStepsSnapshot) return;
    setSteps(sealedStepsSnapshot.map(step => ({ ...step })));
  }, [sealedStepsSnapshot]);

  /** Verified Badge 表示中のリヴィジョン番号 (将来は API から取得) */
  const [revisionLabel, setRevisionLabel] = useState<string>('v1');

  /* ── Magic Mode 判定 ── */
  const magicMode = useMemo(
    () => !certificate && Array.isArray(initialFiles) && initialFiles.length >= 2,
    [certificate, initialFiles],
  );

  const [compression, setCompression] = useState<CompressionProgress>({
    phase: 'idle', current: 0, total: 0, caption: '',
  });

  const [quota, setQuota] = useState<{ plan: string; limit: number; used: number; remaining: number } | null>(null);
  const [upsellIntent, setUpsellIntent] = useState<{ needed: number; targetPlan: string; currentRemaining: number } | null>(null);

  /* ── v4: Danger Zone confirmation popover ── */
  const [dangerOpen, setDangerOpen] = useState(false);

  useEffect(() => {
    const fetchQuota = async () => {
      try {
        const res = await fetch('/api/user/quota');
        if (res.ok) setQuota(await res.json());
        else if (res.status === 401) setQuota({ plan: 'guest', limit: 3, used: 0, remaining: 3 });
      } catch (e) { console.error(e); }
    };
    fetchQuota();
  }, []);

  const urlCacheRef = useRef<Map<string, string>>(new Map());
  const thumbCacheRef = useRef<Map<string, string>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploads = useRef(0);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const readyCount = useMemo(
    () => steps.filter((s) => s.isRoot || (s.file && s.title.trim())).length,
    [steps],
  );
  const allVerified = useMemo(() => steps.every((s) => s.hashState === 'verified'), [steps]);
  const allUploaded = useMemo(
    () => steps.every((s) => s.isRoot || s.uploadState === 'uploaded'),
    [steps],
  );

  /**
   * canSubmit:
   *  Magic Mode: 2 枚以上 + allVerified
   *  Normal: certificate あり + allVerified + allUploaded
   *  共通: steps.length > 0 && !isForkedDraft (封印スナップショットが存在しない Draft のみ)
   */
  const canSubmit =
    steps.length > 0 &&
    !submitting &&
    !sealed &&
    allVerified &&
    (magicMode
      ? steps.length >= 2
      : !!certificate && allUploaded);

  /* ═════════════════════════════════════════════════════════════
     Magic Mode — initialFiles から steps を構築
     ═════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!magicMode || !initialFiles) return;
    let isMounted = true;

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
        try { thumb = await generateThumb(step.file!); } catch { /* skip */ }
        if (!isMounted) {
          if (thumb) URL.revokeObjectURL(thumb.url);
          break;
        }
        setSteps((cur) => cur.map((s) =>
          s.id === step.id
            ? { ...s, previewUrl: purl, thumbUrl: thumb?.url, thumbBlob: thumb?.blob }
            : s,
        ));
        await new Promise((r) => setTimeout(r, COMPRESSION_YIELD_MS));
      }

      baseSteps.forEach((s) => computeHash(s.id, s.file!));
    };

    setSteps([]);
    setIsHydrating(true);
    seedFromFiles();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [magicMode, initialFiles]);

  /* ═════════════════════════════════════════════════════════════
     certificate ベース・ハイドレーション (Magic Mode 時はスキップ)
     ═════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (magicMode) return;
    if (!certificate) return;

    let isMounted = true;
    const loadExistingChain = async () => {
      if (!certificate.process_bundle_id) {
        if (isMounted) {
          setSteps([{
            id: `root-${certificate.id}`,
            stepType: 'other',
            title: certificate.title || '原本 (Base Layer)',
            note: '証明書として登録済みの原本データ',
            previewUrl: certificate.public_image_url || undefined,
            sha256: certificate.sha256,
            hashState: 'verified',
            isRoot: true,
            uploadState: 'uploaded',
          }]);
        }
        return;
      }

      let fetchedSteps: any[] | null = null;
      if (certificate.public_verify_token) {
        try {
          const res = await fetch(
            `/api/certificates/public/${certificate.public_verify_token}?t=${Date.now()}`,
            { headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }, cache: 'no-store' },
          );
          if (res.ok) {
            const data = await res.json();
            const traverse = (obj: any) => {
              if (fetchedSteps) return;
              if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === 'object') {
                if ('step_type' in obj[0] || 'sha256' in obj[0] || 'stepType' in obj[0]) {
                  fetchedSteps = obj; return;
                }
              }
              if (obj && typeof obj === 'object') for (const key in obj) traverse(obj[key]);
            };
            traverse(data);
          }
        } catch (e) { console.error('Public API fetch failed:', e); }
      }

      if (!fetchedSteps && typeof window !== 'undefined') {
        try {
          const url = import.meta.env.VITE_SUPABASE_URL;
          const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
          if (url && key) {
            const res = await fetch(
              `${url}/rest/v1/process_bundle_steps?bundle_id=eq.${certificate.process_bundle_id}&select=*`,
              { headers: { apikey: key, Authorization: `Bearer ${key}` } },
            );
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data) && data.length > 0) fetchedSteps = data;
            }
          }
        } catch (e) { console.error('Direct Supabase fetch failed:', e); }
      }

      if (fetchedSteps && Array.isArray(fetchedSteps) && fetchedSteps.length > 0 && isMounted) {
        const sorted = [...fetchedSteps].sort((a, b) => (a.step_index || 0) - (b.step_index || 0));
        setSteps(sorted.map((s) => ({
          id: `root-${s.id}`,
          stepType: s.step_type || s.stepType || 'other',
          title: s.title || '過去の工程',
          note: s.description || s.note || '',
          previewUrl: s.preview_url || s.previewUrl || s.image_url || certificate.public_image_url,
          sha256: s.sha256,
          hashState: 'verified',
          isRoot: true,
          uploadState: 'uploaded',
        })));
        return;
      }

      if (isMounted) {
        setSteps([{
          id: `root-${certificate.id}`,
          stepType: 'other',
          title: certificate.title || '原本 (Base Layer)',
          note: '証明書として登録済みの原本データ',
          previewUrl: certificate.public_image_url || undefined,
          sha256: certificate.sha256,
          hashState: 'verified',
          isRoot: true,
          uploadState: 'uploaded',
        }]);
      }
    };

    setSteps([]);
    loadExistingChain().finally(() => { if (isMounted) setIsHydrating(false); });
    return () => { isMounted = false; };
  }, [certificate, magicMode]);

  /* ── stable preview URL ── */
  const getPreviewUrl = useCallback((stepId: string, file?: File): string | undefined => {
    if (!file) return undefined;
    const cache = urlCacheRef.current;
    if (cache.has(stepId)) return cache.get(stepId)!;
    const url = URL.createObjectURL(file);
    cache.set(stepId, url);
    return url;
  }, []);

  /* ── hashWorker call (progress aware) ── */
  const computeHash = useCallback(async (stepId: string, file: File) => {
    setSteps((cur) => cur.map((s) => s.id === stepId ? { ...s, hashState: 'hashing', hashProgress: 0 } : s));

    return new Promise<void>((resolve) => {
      const req: HashRequest = { id: stepId, file };
      _workerCallbacks.set(stepId, {
        onProgress: (p) => {
          setSteps((cur) => cur.map((s) => s.id === stepId ? { ...s, hashProgress: p } : s));
        },
        onSuccess: (hash) => {
          setSteps((cur) => {
            const isDuplicate = cur.some((s) => s.id !== stepId && s.sha256 === hash);
            if (isDuplicate) {
              setMessage('※ 同じ画像（同一ハッシュ）がすでにキャンバスに存在するため、ブロックしました。');
              const url = urlCacheRef.current.get(stepId);
              if (url) { URL.revokeObjectURL(url); urlCacheRef.current.delete(stepId); }
              const turl = thumbCacheRef.current.get(stepId);
              if (turl) { URL.revokeObjectURL(turl); thumbCacheRef.current.delete(stepId); }
              return cur.filter((s) => s.id !== stepId);
            }
            return cur.map((s) =>
              s.id === stepId ? { ...s, hashState: 'verified', sha256: hash, hashProgress: 1 } : s,
            );
          });
          resolve();
        },
        onError: () => {
          setSteps((cur) => cur.map((s) => s.id === stepId ? { ...s, hashState: 'idle', hashProgress: undefined } : s));
          resolve();
        },
      });
      getWorker().postMessage(req);
    });
  }, []);

  /**
   * 🚀 Upgrade 3: OOM-Safe Concurrency Queue
   *
   * Promise.all による全件同時実行を廃棄。最大 `concurrency` 件まで
   * 並列に処理し、各チャンク完了後に `await new Promise(r => setTimeout(r, 0))`
   * を挟むことでメインスレッドに制御を返し、150枚ドロップ時のブラウザ
   * フリーズ（Jank）を物理的に防止する。
   */
  async function processInChunks<T, R>(
    items: T[],
    concurrency: number,
    processor: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += concurrency) {
      const chunk = items.slice(i, i + concurrency);
      // 最大 concurrency 件を並列実行（それ以上は次のイテレーションへ）
      const chunkResults = await Promise.all(chunk.map(processor));
      results.push(...chunkResults);
      // ✅ チャンク間でメインスレッドに制御を返す (Anti-Jank yield)
      await new Promise<void>((r) => setTimeout(r, 0));
    }
    return results;
  }

  /* ── fetchUploadUrls ── */
  const fetchUploadUrls = useCallback(async (newSteps: WorkspaceStep[]) => {
    try {
      const payloadItems = newSteps.flatMap(s => [
        { fileName: s.file!.name, mimeType: s.file!.type, fileSize: s.file!.size },
        { fileName: `thumb_${s.id}.webp`, mimeType: 'image/webp', fileSize: s.thumbBlob?.size ?? 0 }
      ]);
      const res = await fetch('/api/upload-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payloadItems, proofMode: isPublic ? 'shareable' : 'private' })
      });
      if (!res.ok) throw new Error('Failed to get upload URLs.');
      const { urls } = await res.json();
      setSteps(cur => cur.map(s => {
        const target = newSteps.find(ns => ns.id === s.id);
        if (!target) return s;
        const oIdx = payloadItems.findIndex(p => p.fileName === target.file!.name);
        const tIdx = payloadItems.findIndex(p => p.fileName === `thumb_${target.id}.webp`);
        return {
          ...s,
          signedUrl: urls[oIdx]?.signedUrl,
          quarantinePath: urls[oIdx]?.quarantinePath,
          thumbSignedUrl: urls[tIdx]?.signedUrl,
          thumbQuarantinePath: urls[tIdx]?.quarantinePath,
          uploadState: 'idle' as const,
          deferred: false,
        };
      }));
    } catch {
      setSteps(cur => cur.map(s => newSteps.some(ns => ns.id === s.id) ? { ...s, uploadState: 'error' as const } : s));
    }
  }, [isPublic]);

  const attachThumb = useCallback(async (stepId: string, file: File) => {
    try {
      const thumb = await generateThumb(file);
      setSteps(cur => {
        const target = cur.find(s => s.id === stepId);
        if (!target) return cur;
        const updated = { ...target, thumbUrl: thumb.url, thumbBlob: thumb.blob, uploadState: 'fetching_url' as const };
        if (!target.deferred) fetchUploadUrls([updated]);
        return cur.map(s => s.id === stepId ? updated : s);
      });
    } catch (e) {
      console.error('Thumbnail generation failed', e);
    }
  }, [fetchUploadUrls]);

  const addFilesAtIndex = useCallback(async (files: FileList | File[], insertAt: number) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/')).sort((a, b) => a.lastModified - b.lastModified);
    if (fileArray.length === 0) return;

    const existingKeys = new Set(steps.map(s => s.file ? `${s.file.name}-${s.file.size}-${s.file.lastModified}` : ''));
    const uniqueFiles = fileArray.filter(f => !existingKeys.has(`${f.name}-${f.size}-${f.lastModified}`));
    if (uniqueFiles.length === 0) return;

    const needed = steps.length + uniqueFiles.length;
    if (needed > 150) {
      alert("システムの物理上限（150枚）を超えるため追加できません。");
      return;
    }

    if (quota && needed > quota.remaining && !magicMode) {
      let targetPlan = 'creator';
      if (needed > 30) targetPlan = 'studio';
      setUpsellIntent({ needed, targetPlan, currentRemaining: quota.remaining });
      return;
    }

    const modifiedTimes = uniqueFiles.map((f) => f.lastModified);
    const hasDuplicateTimestamps = new Set(modifiedTimes).size !== modifiedTimes.length || steps.some((s) => s.file && modifiedTimes.includes(s.file.lastModified));

    let newSteps: WorkspaceStep[] = uniqueFiles.map((file) => ({
      id: crypto.randomUUID(), stepType: guessStepType(file.name), title: fileBaseName(file.name) || '途中工程', note: '',
      file, previewUrl: getPreviewUrl(crypto.randomUUID(), file), hashState: 'idle' as const,
      uploadState: magicMode ? 'idle' as const : 'fetching_url' as const,
      sameTimestamp: hasDuplicateTimestamps,
      deferred: magicMode,
    }));

    newSteps = await processInChunks(newSteps, 3, async (s) => {
      try {
        const thumb = await generateThumb(s.file!);
        return { ...s, thumbUrl: thumb.url, thumbBlob: thumb.blob };
      } catch { return s; }
    });

    setSteps((cur) => { const copy = [...cur]; copy.splice(insertAt, 0, ...newSteps); return copy; });

    newSteps.forEach((s) => computeHash(s.id, s.file!));
    if (!magicMode) fetchUploadUrls(newSteps);
  }, [steps, getPreviewUrl, computeHash, quota, magicMode, fetchUploadUrls]);

  const addFilesAsSteps = useCallback(
    (files: FileList | File[]) => addFilesAtIndex(files, steps.length),
    [addFilesAtIndex, steps.length],
  );

  /* ── Ghost Upload Watcher (deferred を除外) ── */
  useEffect(() => {
    const processUploadQueue = async () => {
      const readyItems = steps.filter(s =>
        !s.isRoot && !s.deferred && s.hashState === 'verified' && s.signedUrl && s.uploadState === 'idle'
      );
      if (readyItems.length === 0) return;
      const availableSlots = MAX_CONCURRENT_UPLOADS - activeUploads.current;
      if (availableSlots <= 0) return;

      const toProcess = readyItems.slice(0, availableSlots);
      toProcess.forEach(async (item) => {
        activeUploads.current++;
        setSteps(cur => cur.map(s => s.id === item.id ? { ...s, uploadState: 'uploading' as const } : s));

        const controller = new AbortController();
        abortControllersRef.current.set(item.id, controller);

        let retryCount = 0;
        let success = false;
        let isAborted = false;

        while (retryCount < 3 && !success && !isAborted) {
          try {
            await Promise.all([
              fetch(item.signedUrl!, { method: 'PUT', body: item.file, signal: controller.signal }),
              item.thumbSignedUrl ? fetch(item.thumbSignedUrl, { method: 'PUT', body: item.thumbBlob, signal: controller.signal }) : Promise.resolve()
            ]);
            success = true;
            setSteps(cur => cur.map(s => s.id === item.id ? { ...s, uploadState: 'uploaded' as const } : s));
          } catch (e: any) {
            if (e.name === 'AbortError') { isAborted = true; break; }
            retryCount++;
            if (retryCount >= 3) setSteps(cur => cur.map(s => s.id === item.id ? { ...s, uploadState: 'error' as const } : s));
            else await new Promise(res => setTimeout(res, retryCount * 500));
          }
        }

        abortControllersRef.current.delete(item.id);
        activeUploads.current--;
      });
    };
    processUploadQueue();
  }, [steps]);

  function updateStep(id: string, patch: Partial<WorkspaceStep>) {
    setSteps((cur) => cur.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeStep(id: string) {
    if (abortControllersRef.current.has(id)) {
      abortControllersRef.current.get(id)?.abort();
      abortControllersRef.current.delete(id);
    }
    setSteps((cur) => cur.filter((s) => s.id !== id));
  }

  /* ── global drag/drop ── */
  const onGlobalDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault(); e.stopPropagation();
    setGlobalDragOver(true);
  }, []);
  const onGlobalDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX <= rect.left || e.clientX >= rect.right || e.clientY <= rect.top || e.clientY >= rect.bottom) {
      setGlobalDragOver(false);
    }
  }, []);
  const onGlobalDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      setGlobalDragOver(false);
      if (e.dataTransfer.files.length > 0) addFilesAsSteps(e.dataTransfer.files);
    }, [addFilesAsSteps],
  );
  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFilesAsSteps(e.target.files);
        e.target.value = '';
      }
    }, [addFilesAsSteps],
  );

  /* ═════════════════════════════════════════════════════════════
     Hybrid Payload — Slide to Seal 起点の圧縮→再ハッシュ→upload→submit
     (v3 から無変更)
     ═════════════════════════════════════════════════════════════ */

  const runHybridCompression = useCallback(async (): Promise<WorkspaceStep[]> => {
    let snapshot: WorkspaceStep[] = [];
    setSteps((cur) => { snapshot = cur; return cur; });

    if (snapshot.length < 2) return snapshot;

    const lastIndex = snapshot.length - 1;
    const targetIndices: number[] = [];
    for (let i = 0; i <= lastIndex - 1; i++) {
      if (!snapshot[i].isRoot && snapshot[i].file && snapshot[i].uploadState !== 'uploaded') {
        targetIndices.push(i);
      }
    }

    setCompression({
      phase: 'compressing', current: 0, total: targetIndices.length,
      caption: '証拠データを最適化中...',
    });

    const updated: WorkspaceStep[] = [...snapshot];

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
      const oldPreview = urlCacheRef.current.get(step.id);
      if (oldPreview) URL.revokeObjectURL(oldPreview);
      urlCacheRef.current.set(step.id, newPreviewUrl);

      updated[idx] = {
        ...step, file: compressed, previewUrl: newPreviewUrl,
        hashState: 'idle', sha256: undefined, hashProgress: 0,
      };
      setSteps((cur) => cur.map((s) => s.id === step.id ? updated[idx] : s));
      setCompression((p) => ({
        ...p, current: k + 1,
        caption: `証拠データを最適化中... (${k + 1}/${targetIndices.length})`,
      }));
      await new Promise((r) => setTimeout(r, COMPRESSION_YIELD_MS));
    }
    return updated;
  }, []);

  const reHashAfterCompression = useCallback(async (postCompress: WorkspaceStep[]) => {
    setCompression({
      phase: 'rehashing', current: 0, total: postCompress.length,
      caption: 'ハッシュ値を再計算中...',
    });
    const promises = postCompress
      .filter((s) => !s.isRoot && s.file && s.hashState !== 'verified')
      .map((s) => computeHash(s.id, s.file!));
    await Promise.all(promises);
    setCompression((p) => ({ ...p, current: p.total }));
  }, [computeHash]);

  async function submitMagic() {
    if (!magicMode) return;
    setSubmitting(true);
    setMessage(null);
    setResult(null);

    try {
      const postCompress = await runHybridCompression();
      await reHashAfterCompression(postCompress);

      setCompression({
        phase: 'uploading', current: 0, total: postCompress.length,
        caption: 'クラウドへ安全に転送中...',
      });

      let latest: WorkspaceStep[] = [];
      setSteps((cur) => { latest = cur; return cur; });
      const toUpload = latest.filter((s) => !s.isRoot && s.file && s.uploadState !== 'uploaded');
      await fetchUploadUrls(toUpload);

      const startedAt = Date.now();
      const TIMEOUT_MS = 120_000;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let current: WorkspaceStep[] = [];
        setSteps((cur) => { current = cur; return cur; });
        const targets = current.filter((s) => !s.isRoot && s.file);
        const done = targets.every((s) => s.uploadState === 'uploaded');
        const failed = targets.some((s) => s.uploadState === 'error');
        if (done) break;
        if (failed) throw new Error('一部のアップロードに失敗しました。再試行してください。');
        if (Date.now() - startedAt > TIMEOUT_MS) {
          throw new Error('アップロードがタイムアウトしました。ネットワークを確認してください。');
        }
        const completed = targets.filter((s) => s.uploadState === 'uploaded').length;
        setCompression((p) => ({ ...p, current: completed, total: targets.length }));
        await new Promise((r) => setTimeout(r, 250));
      }

      setCompression({
        phase: 'submitting', current: 0, total: 1,
        caption: '証拠チェーンを台帳へ書き込み中...',
      });

      let finalSteps: WorkspaceStep[] = [];
      setSteps((cur) => { finalSteps = cur; return cur; });

      const itemsList = finalSteps
        .filter((s) => !s.isRoot && s.file)
        .map((s, idx) => ({
          quarantinePath: s.quarantinePath,
          thumbnailPath: s.thumbQuarantinePath,
          sha256: s.sha256,
          title: s.title,
          proofMode: isPublic ? 'shareable' : 'private',
          file_name: s.file!.name,
          file_size: s.file!.size,
          stepIndex: idx,
        }));
      // HEAD フラグを最後の要素に立てる（API 側で参照）
      const itemsWithHead = itemsList.map((it, i, arr) => ({
        ...it,
        isHead: i === arr.length - 1,
      }));

      const payload = {
        bundleId: crypto.randomUUID(),
        title,
        description,
        items: itemsWithHead,
      };

      const res = await fetch('/api/certificates/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('証明書の台帳記録に失敗しました。');

      const data = await res.json();
      const certificateId = data.certificates?.[0]?.id || data.certificate?.id || data.certificateId || 'unknown';

      setResult({
        chainDepth: payload.items.length,
        chainHeadSha256: finalSteps[finalSteps.length - 1]?.sha256 ?? null,
        certificateId,
      });
      setMessage('Chain of Evidence を保存しました。3秒後に証明書ページへリダイレクトします...');
      setCompression({ phase: 'done', current: 1, total: 1, caption: '完了' });
      onComplete?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存に失敗しました');
      setCompression({ phase: 'idle', current: 0, total: 0, caption: '' });
      // Derived State: Draft へ戻すにはスナップショットをクリアするだけ
      setSealedSignatureSnapshot(null);
      setSealedStepsSnapshot(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function submit() {
    if (!certificate) return;
    setSubmitting(true); setMessage(null); setResult(null);
    try {
      const payload = {
        bundleId: crypto.randomUUID(),
        items: steps.filter(s => !s.isRoot).map((s, idx) => ({
          quarantinePath: s.quarantinePath,
          thumbnailPath: s.thumbQuarantinePath,
          sha256: s.sha256,
          title: s.title,
          proofMode: isPublic ? 'shareable' : 'private',
          file_name: s.file!.name,
          file_size: s.file!.size,
          stepIndex: idx,
        })),
      };
      const res = await fetch('/api/certificates/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('証明書の台帳記録に失敗しました。');
      const data = await res.json();
      setResult({
        chainDepth: steps.length,
        chainHeadSha256: steps[steps.length - 1].sha256 ?? null,
        certificateId: data.certificates?.[0]?.id || data.certificate?.id || data.certificateId || 'unknown',
      });
      setMessage('Chain of Evidence を保存しました。3秒後に証明書ページへリダイレクトします...');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存に失敗しました');
      // Derived State: 失敗時はスナップショットをクリアして Draft へ即復帰
      setSealedSignatureSnapshot(null);
      setSealedStepsSnapshot(null);
    } finally {
      setSubmitting(false);
    }
  }

  /* ── auto-redirect on success ── */
  useEffect(() => {
    if (result?.certificateId) {
      const timer = setTimeout(() => setLocation(`/cert/${result.certificateId}`), 3000);
      return () => clearTimeout(timer);
    }
  }, [result?.certificateId, setLocation]);

  /* ── cleanup on unmount ── */
  useEffect(() => {
    return () => {
      urlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      urlCacheRef.current.clear();
      thumbCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      thumbCacheRef.current.clear();
    };
  }, []);

  /* ── keep scrubIndex in bounds ── */
  useEffect(() => {
    if (scrubIndex >= steps.length && steps.length > 0) {
      setScrubIndex(steps.length - 1);
    }
  }, [steps.length, scrubIndex]);

  /* ═════════════════════════════════════════════════════════════
     v4: Danger Zone ハンドラ
     ═════════════════════════════════════════════════════════════ */
  const handleDiscard = useCallback(() => {
    if (onDiscard) {
      onDiscard();
    } else {
      // Derived State: スナップショットをクリアするだけで Draft へ即復帰
      steps.forEach((s) => removeStep(s.id));
      setSealedSignatureSnapshot(null);
      setSealedStepsSnapshot(null);
      setResult(null);
      setMessage(null);
    }
    setDangerOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDiscard, steps]);

  const handleArchive = useCallback(() => {
    if (onArchive) onArchive();
    setDangerOpen(false);
  }, [onArchive]);

  /* ══════════════════════════════════════════════════════════════
     RENDER: SUCCESS (Verified Badge は下部に表示するためここでは出さず)
     ══════════════════════════════════════════════════════════════ */

  /* ══════════════════════════════════════════════════════════════
     RENDER: NO CERTIFICATE & NOT Magic Mode
     ══════════════════════════════════════════════════════════════ */
  if (!certificate && !magicMode) {
    return (
      <section className="w-full bg-[#0F0F11] border border-white/10 rounded-3xl p-6 md:p-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-5 text-sm text-[#A8A0D8]">
          まず先に証明書を1件発行すると、この作品に Chain of Evidence を接続できます。
        </div>
      </section>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER: TIMELINE WORKSPACE
     ══════════════════════════════════════════════════════════════ */
  return (
    <section
      className={`
        relative w-full bg-[#0F0F11] border rounded-3xl p-6 md:p-8 transition-all duration-300
        ${globalDragOver
          ? 'border-[#00D4AA]/50 shadow-[0_0_60px_rgba(0,212,170,0.15)] ring-1 ring-[#00D4AA]/20'
          : 'border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.4)]'}
      `}
      onDragOver={onGlobalDragOver}
      onDragLeave={onGlobalDragLeave}
      onDrop={onGlobalDrop /* v4: sealed でもドロップ可（Fork-on-Write） */}
    >
      {/* ─── v4: Danger Zone (右上アフォーダンス) ─── */}
      <DangerZoneAffordance
        open={dangerOpen}
        onToggle={() => setDangerOpen((v) => !v)}
        onArchive={onArchive ? handleArchive : undefined}
        onDiscard={handleDiscard}
        disabled={submitting}
      />

      {/* ─── Magic Mode Banner ─── */}
      {magicMode && !sealed && (
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
            <strong className="text-white">Magic Mode</strong> ・ 最後の <strong className="text-[#00D4AA]">HEAD（完成品）</strong> はオリジナル画質のまま、途中工程は封印時に WebP へ自動最適化されます。
          </span>
        </motion.div>
      )}

      {/* ─── Compression Progress ─── */}
      <AnimatePresence>
        {compression.phase !== 'idle' && compression.phase !== 'done' && (
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
                  <span className="text-sm font-bold text-white truncate">{compression.caption}</span>
                  {compression.total > 0 && (
                    <span className="text-[11px] font-mono text-[#A8A0D8] tabular-nums shrink-0 ml-3">
                      {compression.current} / {compression.total}
                    </span>
                  )}
                </div>
                <div className="h-1 rounded-full overflow-hidden bg-white/5">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #6C3EF4, #00D4AA)' }}
                    animate={{
                      width: compression.total > 0
                        ? `${Math.min(100, (compression.current / compression.total) * 100)}%`
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

      {/* ─── Header ─── */}
      <div className="mb-6 pr-12 /* avoid overlap with Danger Zone */">
        <div className="text-[11px] uppercase tracking-[0.28em] text-[#A8A0D8]/60">
          Auto-Resolving Timeline Studio
        </div>
        <h2 className="mt-2 text-xl md:text-2xl font-black tracking-tight text-white">
          制作プロセスを証拠化する
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#A8A0D8]/70">
          画像をドロップするだけ — 古い順に自動整列。フリックで削除、ドラッグで並び替え可能。
          <span className="text-[#A8A0D8]/40"> 封印後に編集すると自動で新リヴィジョン (Fork-on-Write) になります。</span>
        </p>
      </div>

      {/* ─── Loading State ─── */}
      {isHydrating && (
        <div className="flex flex-col items-center justify-center py-20 md:py-28 rounded-3xl border border-white/5 bg-white/5 backdrop-blur-md animate-pulse">
          <Loader2 className="w-8 h-8 text-[#00D4AA] animate-spin mb-4" />
          <div className="text-sm font-bold text-white tracking-widest uppercase">
            {magicMode ? 'Loading Timeline...' : 'Restoring Timeline...'}
          </div>
          <div className="text-xs text-[#A8A0D8]/60 mt-2">
            {magicMode ? '工程ファイルをタイムラインに展開しています' : '過去の証明データを安全に復元しています'}
          </div>
        </div>
      )}

      {/* ─── Empty Canvas ─── */}
      {steps.length === 0 && !isHydrating && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative group cursor-pointer rounded-3xl border-2 border-dashed py-20 md:py-28
            transition-all duration-300 overflow-hidden
            ${globalDragOver
              ? 'border-[#00D4AA] bg-[#00D4AA]/10 shadow-[0_0_60px_rgba(0,212,170,0.2)]'
              : 'border-white/10 bg-white/5 hover:border-[#00D4AA]/40 hover:bg-[#00D4AA]/5'}
          `}
        >
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage: 'radial-gradient(circle, #00D4AA 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          />
          <div className="relative flex flex-col items-center gap-4 text-center px-4">
            <div className={`
              w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300
              ${globalDragOver ? 'bg-[#00D4AA] shadow-[0_0_40px_rgba(0,212,170,0.6)] scale-110' : 'bg-[#00D4AA]/10 group-hover:bg-[#00D4AA]/20'}
            `}>
              {globalDragOver
                ? <Upload className="w-8 h-8 text-white animate-bounce" />
                : <ImagePlus className="w-8 h-8 text-[#00D4AA]" />}
            </div>
            <div>
              <div className="text-white font-bold text-lg">制作工程をドロップしてタイムラインを開始</div>
              <p className="mt-1 text-sm text-[#A8A0D8]/60 max-w-md mx-auto">
                複数枚でも OK — lastModified の古い順に自動整列されます。
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Living Timeline ─── */}
      {steps.length > 0 && !isHydrating && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-5">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#A8A0D8]/60">
              Evidence Chain — {readyCount} step{readyCount !== 1 ? 's' : ''}
              {sealed && (
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00D4AA]/15 border border-[#00D4AA]/30 text-[#00D4AA] text-[9px] font-black tracking-widest">
                  <Lock className="w-2.5 h-2.5" /> SEALED · {revisionLabel}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {steps.map((s) => (
                <div
                  key={s.id}
                  className={`w-2 h-2 rounded-full transition-all duration-500 ${
                    s.hashState === 'verified'
                      ? 'bg-[#00D4AA] shadow-[0_0_6px_rgba(0,212,170,0.5)]'
                      : s.hashState === 'hashing'
                        ? 'bg-[#6C3EF4] animate-pulse'
                        : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="overflow-x-auto pb-6 -mx-2 px-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
            <Reorder.Group
              axis="x"
              values={steps}
              /* v4: sealed でも並べ替え許可 → Fork-on-Write が発火して Draft へ */
              onReorder={setSteps}
              className="flex items-stretch w-max gap-0 pr-8"
              as="div"
            >
              {steps.map((step, index) => {
                const isSilentAnchor = step.isRoot && index === steps.length - 1 && steps.length > 1;
                const isHead = !step.isRoot && index === steps.length - 1 && steps.length > 1;
                const isLast = index === steps.length - 1;

                return (
                  <div key={step.id} className="flex items-stretch shrink-0">
                    <TimelineCard
                      step={step}
                      index={index}
                      totalSteps={steps.length}
                      isSilentAnchor={!!isSilentAnchor}
                      isHead={isHead}
                      /* ★ v4: Fork-on-Write — 常に sealed={false} を渡す */
                      sealed={false}
                      onUpdate={updateStep}
                      onRemove={removeStep}
                      onReplace={(file) => {
                        const cache = urlCacheRef.current;
                        const old = cache.get(step.id);
                        if (old) URL.revokeObjectURL(old);
                        cache.delete(step.id);
                        const newUrl = getPreviewUrl(step.id, file);
                        updateStep(step.id, {
                          file, previewUrl: newUrl,
                          title: fileBaseName(file.name) || step.title,
                          hashState: 'idle',
                          uploadState: 'idle',
                        });
                        computeHash(step.id, file);
                        attachThumb(step.id, file);
                      }}
                    />

                    {!isLast && (
                      <div className="flex items-center shrink-0 px-1">
                        <ChainConnector verified={
                          step.hashState === 'verified' && steps[index + 1]?.hashState === 'verified'
                        } />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Ghost add card — v4: sealed でも追加可（Fork-on-Write） */}
              <motion.button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-[150px] sm:w-[190px] md:w-[210px] rounded-2xl border-2 border-dashed border-white/10 hover:border-[#00D4AA]/30 bg-white/5 hover:bg-[#00D4AA]/5 backdrop-blur-md flex flex-col items-center justify-center gap-2 py-14 transition-all group/add shrink-0 ml-2"
              >
                <div className="w-10 h-10 rounded-xl bg-[#00D4AA]/10 group-hover/add:bg-[#00D4AA]/20 flex items-center justify-center transition-colors">
                  <ImagePlus className="w-5 h-5 text-[#00D4AA]" />
                </div>
                <span className="text-xs font-bold text-[#A8A0D8]/50 group-hover/add:text-[#A8A0D8]">工程を追加</span>
                {sealed && (
                  <span className="text-[8px] text-[#BC78FF]/80 font-mono tracking-wider">+ NEW REVISION</span>
                )}
              </motion.button>
            </Reorder.Group>
          </div>

          {steps.some((s) => s.thumbUrl || s.previewUrl) && (
            <EvolutionScrub
              steps={steps}
              scrubIndex={scrubIndex}
              onScrub={setScrubIndex}
            />
          )}
        </div>
      )}

      {globalDragOver && steps.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-40">
          <div className="absolute inset-0 bg-[#00D4AA]/5 backdrop-blur-[1px]" />
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={true}
        className="hidden"
        onChange={onFileInputChange}
      />

      {/* ─── Meta (collapsible). v4: sealed でも編集可 ─── */}
      {steps.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowMeta(!showMeta)}
            className="flex items-center gap-2 text-xs font-bold text-[#A8A0D8]/50 hover:text-[#A8A0D8] transition-colors"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${showMeta ? 'rotate-180' : ''}`} />
            タイトル・説明を編集
          </button>
          {showMeta && (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[10px] uppercase tracking-widest text-[#A8A0D8]/50 font-bold">Bundle title</span>
                <input
                  className="w-full bg-white/5 backdrop-blur-md border border-white/10 text-white text-sm rounded-2xl px-4 py-2.5 focus:outline-none focus:border-[#00D4AA]/60 placeholder-[#A8A0D8]/40 transition-colors"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] uppercase tracking-widest text-[#A8A0D8]/50 font-bold">Description</span>
                <input
                  className="w-full bg-white/5 backdrop-blur-md border border-white/10 text-white text-sm rounded-2xl px-4 py-2.5 focus:outline-none focus:border-[#00D4AA]/60 placeholder-[#A8A0D8]/40 transition-colors"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-3 text-sm text-[#A8A0D8]/70 cursor-pointer md:col-span-2">
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="accent-[#00D4AA]" />
                公開ページに表示する
              </label>
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════
          v4: The Resolution Area
          AnimatePresence で Slider ↔ VerifiedBadge をクロスフェード
         ═════════════════════════════════════════════════════════ */}
      <div className="mt-6 pt-6 border-t border-white/5">
        {/* ステータス行 (常に表示) */}
        <div className="flex items-center justify-between mb-4 gap-4">
          <div className="text-sm text-[#A8A0D8]/50 min-w-0 truncate">
            <span className="text-white font-bold">{readyCount}</span> 工程が連結可能
            {!allVerified && steps.length > 0 && (
              <span className="ml-2 text-xs text-[#6C3EF4] animate-pulse">
                <Loader2 className="inline w-3 h-3 animate-spin mr-1" />
                ハッシュ計算中...
              </span>
            )}
            {!magicMode && allVerified && !allUploaded && steps.length > 0 && (
              <span className="ml-2 text-xs text-[#00D4AA] animate-pulse">
                <CloudLightning className="inline w-3 h-3 mr-1" />
                クラウド同期中...
              </span>
            )}
          </div>
        </div>

        {/* Autosaved label (Draft 時のみ控えめに表示) */}
        <AnimatePresence>
          {!sealed && (
            <motion.div
              key="autosaved"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="mb-3 flex items-center justify-center gap-1.5 text-[10px] tracking-[0.16em] text-[#A8A0D8]/40 uppercase font-medium"
            >
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#00D4AA]/60"
                style={{ boxShadow: '0 0 6px rgba(0,212,170,0.5)' }}
              />
              Autosaved · ProofMark Secure Storage
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Slider ↔ VerifiedBadge クロスフェード ─── */}
        <AnimatePresence mode="wait">
          {!sealed ? (
            <motion.div
              key="slider"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <SlideToSeal
                /* v4: empty (steps 0) は物理無効化 + 視覚的グラスモーフィズム */
                empty={steps.length === 0}
                disabled={!canSubmit}
                onSealed={() => {
                  if (steps.length === 0) return; // 虚無の送信バグ防止
                  // 🚀 Upgrade 1: Derived State — スナップショットをセット
                  const sig = stepsSignature(steps);
                  setSealedSignatureSnapshot(sig);
                  // 🚀 Upgrade 2: Time-Travel Revert — steps のディープコピーを保存
                  setSealedStepsSnapshot(steps.map(step => ({ ...step })));
                  navigator.vibrate?.(40);
                  if (magicMode) submitMagic();
                  else submit();
                }}
              />

              {/* 🚀 Upgrade 2: Time-Travel Revert Button
                  isForkedDraft === true 時に滑らかに出現する救済UI。
                  封印状態のスナップショットへ即座に巻き戻す Git Checkout。
              */}
              <AnimatePresence>
                {isForkedDraft && (
                  <motion.button
                    key="revert-btn"
                    type="button"
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                    onClick={handleRevertToSealed}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all group"
                    style={{
                      background: 'rgba(168, 160, 216, 0.06)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255, 138, 133, 0.25)',
                      color: '#FF8A85',
                      boxShadow: '0 2px 16px rgba(255, 138, 133, 0.08)',
                    }}
                  >
                    <motion.span
                      animate={{ rotate: [0, -12, 0] }}
                      transition={{ delay: 0.3, duration: 0.4, ease: 'easeInOut' }}
                      style={{ display: 'inline-block' }}
                    >
                      ↩️
                    </motion.span>
                    <span className="tracking-wide">
                      変更を破棄して封印状態に戻す
                    </span>
                    <span
                      className="ml-auto text-[9px] font-mono uppercase tracking-widest opacity-50 group-hover:opacity-80 transition-opacity"
                      style={{ color: '#A8A0D8' }}
                    >
                      Revert to Sealed
                    </span>
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="verified"
              initial={{ opacity: 0, y: 28, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              /* ★ Spring: stiffness 200, damping 20 (要件) */
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              <VerifiedBadge
                submitting={submitting}
                caption={magicMode ? (compression.caption || '処理中...') : 'Chain of Evidence を保存中...'}
                revisionLabel={revisionLabel}
                headSha={result?.chainHeadSha256 ?? null}
                onViewCert={result?.certificateId ? () => setLocation(`/cert/${result.certificateId}`) : undefined}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Message ─── */}
      {message && !result && (
        <div className="mt-4 text-sm text-[#A8A0D8] bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3">
          {message}
        </div>
      )}

      {/* Smart Upsell Modal */}
      <AnimatePresence>
        {upsellIntent && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
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
                現在の残り枠（{upsellIntent.currentRemaining}枚）に対して、<strong className="text-white">{upsellIntent.needed}枚</strong> の証明書を発行しようとしています。
                全工程を連結するには、<strong className="text-[#00D4AA] capitalize">{upsellIntent.targetPlan} プラン</strong> へのアップグレードが必要です。
              </p>
              <div className="bg-[#121124] rounded-lg p-3 mb-6 border border-purple-500/30 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <p className="text-xs text-purple-200">
                  決済は別タブで開きます。<strong>決済完了後、この画面に戻ればそのまま続きから再開できます。</strong>
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

/* ═══════════════════════════════════════════════════════════════
   v4: VerifiedBadge — 封印完了時の達成感UI
   ─────────────────────────────────────────────────────────────
   - Linear / Stripe 級のグラスモーフィズム
   - #00D4AA × #6C3EF4 グラデーション
   - 「🔒 暗号封印済み (Verified by ProofMark)」
   - 「公的なThe Merkle Rollup ...」コピー
   ═══════════════════════════════════════════════════════════════ */

function VerifiedBadge({
  submitting,
  caption,
  revisionLabel,
  headSha,
  onViewCert,
}: {
  submitting: boolean;
  caption: string;
  revisionLabel: string;
  headSha: string | null;
  onViewCert?: () => void;
}) {
  return (
    <div className="relative">
      {/* ambient glow */}
      <div
        aria-hidden
        className="absolute -inset-px rounded-3xl pointer-events-none opacity-70"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 0%, rgba(0,212,170,0.18), transparent 70%), radial-gradient(60% 60% at 50% 100%, rgba(108,62,244,0.18), transparent 70%)',
          filter: 'blur(20px)',
        }}
      />

      <div
        className="relative overflow-hidden rounded-3xl border border-[#00D4AA]/30 backdrop-blur-xl"
        style={{
          background:
            'linear-gradient(135deg, rgba(0,212,170,0.10) 0%, rgba(13,11,36,0.55) 50%, rgba(108,62,244,0.12) 100%)',
          boxShadow:
            '0 1px 0 rgba(255,255,255,0.08) inset, 0 24px 60px rgba(0,212,170,0.10), 0 4px 16px rgba(0,0,0,0.4)',
        }}
      >
        {/* subtle grid */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative p-6 md:p-7">
          <div className="flex items-start gap-4">
            {/* Seal icon */}
            <motion.div
              initial={{ rotate: -8, scale: 0.85, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.06 }}
              className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #00D4AA 0%, #6C3EF4 100%)',
                boxShadow:
                  '0 8px 24px rgba(0,212,170,0.35), 0 0 1px rgba(255,255,255,0.5) inset',
              }}
            >
              <Lock className="w-7 h-7 text-white" strokeWidth={2.5} />
            </motion.div>

            {/* Texts */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg md:text-xl font-black tracking-tight text-white">
                  🔒 暗号封印済み
                </h3>
                <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-[#00D4AA]/80">
                  Verified by ProofMark
                </span>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase"
                  style={{
                    background: 'rgba(108,62,244,0.18)',
                    border: '1px solid rgba(108,62,244,0.35)',
                    color: '#BC78FF',
                  }}
                >
                  <GitBranch className="w-2.5 h-2.5" />
                  {revisionLabel}
                </span>
              </div>

              <p className="mt-2 text-sm leading-6 text-[#D4D0F4]/85 max-w-xl">
                公的な <strong className="text-white">The Merkle Rollup</strong> に記録されました。
                <span className="text-[#A8A0D8]">編集を加えると新しいリヴィジョン</span>
                <strong className="text-[#00D4AA]"> (v{((parseInt(revisionLabel.replace('v', ''), 10) || 1) + 1)}) </strong>
                <span className="text-[#A8A0D8]">として派生します。</span>
              </p>

              {/* HEAD SHA preview */}
              {headSha && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#07061A]/70 border border-white/10 backdrop-blur-md">
                  <ShieldCheck className="w-3 h-3 text-[#00D4AA]" />
                  <code className="text-[10px] font-mono text-[#A8A0D8] tracking-wider">
                    HEAD&nbsp;{headSha.slice(0, 10)}…{headSha.slice(-8)}
                  </code>
                </div>
              )}

              {/* Submitting state */}
              {submitting && (
                <div className="mt-4 flex items-center gap-2 text-xs text-[#A8A0D8]/80">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00D4AA]" />
                  <span>{caption}</span>
                </div>
              )}

              {/* Actions */}
              {!submitting && onViewCert && (
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={onViewCert}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-[#07061A]"
                    style={{
                      background: 'linear-gradient(135deg, #00D4AA 0%, #00B89A 100%)',
                      boxShadow: '0 6px 20px rgba(0,212,170,0.32)',
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    証明書を見る
                  </button>
                  <span className="text-[10px] text-[#A8A0D8]/40 font-mono tracking-wider">
                    Edits below auto-fork to new revision
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* bottom accent line */}
        <div
          aria-hidden
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(0,212,170,0.6) 30%, rgba(108,62,244,0.6) 70%, transparent 100%)',
          }}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   v4: Danger Zone Affordance — 右上の控えめなアクション
   ═══════════════════════════════════════════════════════════════ */

function DangerZoneAffordance({
  open,
  onToggle,
  onArchive,
  onDiscard,
  disabled,
}: {
  open: boolean;
  onToggle: () => void;
  onArchive?: () => void;
  onDiscard: () => void;
  disabled?: boolean;
}) {
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
   SUB-COMPONENTS (TimelineCard / Connector / EvolutionScrub / SlideToSeal)
   ═══════════════════════════════════════════════════════════════ */

function ChainConnector({ verified }: { verified: boolean }) {
  return (
    <div className="flex items-center justify-center w-8 shrink-0">
      <div className="flex flex-col items-center gap-0.5">
        <div className={`w-0.5 h-2.5 transition-colors duration-700 ${verified ? 'bg-gradient-to-b from-transparent to-[#00D4AA]' : 'bg-gradient-to-b from-transparent to-white/10'}`} />
        <div className={`
          w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-700
          ${verified ? 'border-[#00D4AA]/60 bg-[#00D4AA]/15 shadow-[0_0_10px_rgba(0,212,170,0.3)]' : 'border-white/10 bg-white/5'}
        `}>
          {verified
            ? <Lock className="w-2.5 h-2.5 text-[#00D4AA]" />
            : <div className="w-1.5 h-1.5 rounded-full bg-[#6C3EF4] animate-pulse" />}
        </div>
        <div className={`w-0.5 h-2.5 transition-colors duration-700 ${verified ? 'bg-gradient-to-b from-[#00D4AA] to-transparent' : 'bg-gradient-to-b from-white/10 to-transparent'}`} />
      </div>
    </div>
  );
}

function TimelineCard({
  step, index, totalSteps, isSilentAnchor, isHead, sealed,
  onUpdate, onRemove, onReplace,
}: {
  step: WorkspaceStep;
  index: number;
  totalSteps: number;
  isSilentAnchor: boolean;
  isHead: boolean;
  sealed: boolean;
  onUpdate: (id: string, patch: Partial<WorkspaceStep>) => void;
  onRemove: (id: string) => void;
  onReplace: (file: File) => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingNote, setEditingNote] = useState(false);

  const handleDragEnd = (_: any, info: { velocity: { y: number } }) => {
    if (step.isRoot) return;
    if (Math.abs(info.velocity.y) > FLICK_VELOCITY_THRESHOLD) {
      onRemove(step.id);
    }
  };

  const isOrigin = index === 0;
  const badgeIcon = isOrigin ? '🎨' : isSilentAnchor ? '' : isHead ? '🏁' : '📝';
  const badgeLabel = isOrigin ? '起点' : isSilentAnchor ? '' : isHead ? 'HEAD (完成品)' : '途中工程';
  const badgeColor = isOrigin ? '#F59E0B' : (isSilentAnchor || isHead) ? '#00D4AA' : '#818CF8';
  const badgeBg = isHead ? 'rgba(0,212,170,0.12)' : isOrigin ? 'rgba(245,158,11,0.12)' : 'rgba(129,140,248,0.12)';

  const confidencePulse = step.sameTimestamp;

  return (
    <Reorder.Item
      value={step}
      id={step.id}
      dragListener={(!isSilentAnchor && !editingTitle && !editingNote) as boolean}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.04, zIndex: 50, boxShadow: '0 20px 60px rgba(0,212,170,0.2)' }}
      layout
      layoutId={step.id}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, y: -20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className={`
        relative w-[150px] sm:w-[190px] md:w-[210px] rounded-2xl border backdrop-blur-md touch-pan-y
        transition-[border-color,box-shadow] duration-300 shrink-0 group/card cursor-grab active:cursor-grabbing
        bg-white/5
        ${isSilentAnchor || isHead
          ? 'border-[#00D4AA]/30 shadow-[0_0_30px_rgba(0,212,170,0.12)]'
          : step.hashState === 'hashing'
            ? 'border-[#6C3EF4]/50 shadow-[0_0_25px_rgba(108,62,244,0.15)]'
            : step.hashState === 'verified'
              ? 'border-[#00D4AA]/20 hover:border-[#00D4AA]/40'
              : 'border-white/10 hover:border-white/20'
        }
        ${confidencePulse && !isSilentAnchor && !isHead ? 'animate-confidence-pulse' : ''}
      `}
    >
      {confidencePulse && !isSilentAnchor && !isHead && (
        <motion.div
          className="absolute -inset-px rounded-2xl pointer-events-none"
          animate={{ borderColor: ['#F59E0B', '#00D4AA', '#F59E0B'] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ border: '1px solid' }}
        />
      )}

      <div className="relative aspect-[4/3] bg-[#0D0B24] overflow-hidden rounded-t-2xl group/thumb">
        {step.previewUrl ? (
          <img
            src={step.previewUrl}
            alt={step.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <label className="cursor-pointer flex flex-col items-center gap-2 text-[#A8A0D8]/40 hover:text-[#00D4AA] transition-colors">
              <ImagePlus className="w-8 h-8" />
              <span className="text-[10px] font-medium">画像を選択</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onReplace(f); }} />
            </label>
          </div>
        )}

        {step.hashState === 'hashing' && (
          <div className="absolute inset-0 bg-[#07061A]/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
            <div className="relative w-12 h-12">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(108,62,244,0.15)" strokeWidth="3" />
                <circle
                  cx="24" cy="24" r="20" fill="none" stroke="#6C3EF4" strokeWidth="3"
                  strokeDasharray={`${2 * Math.PI * 20}`}
                  strokeDashoffset={`${2 * Math.PI * 20 * (1 - (step.hashProgress ?? 0))}`}
                  strokeLinecap="round"
                  className="transition-all duration-200"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[9px] font-mono font-bold text-[#6C3EF4]">
                  {Math.round((step.hashProgress ?? 0) * 100)}%
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-[#6C3EF4] uppercase">Hashing…</span>
          </div>
        )}

        {step.hashState === 'verified' && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#6C3EF4] via-[#00D4AA] to-[#6C3EF4] opacity-70" />
        )}

        <div className="absolute top-2 inset-x-2 flex items-center justify-between gap-1 z-10 min-w-0">
          <div className="flex items-center gap-1 shrink-0">
            <div className="w-6 h-6 rounded-lg bg-[#07061A]/80 backdrop-blur-sm flex items-center justify-center border border-white/10 shrink-0">
              <span className="text-[10px] font-black text-white">{index + 1}</span>
            </div>
            {step.isRoot && (
              <div className="px-1.5 py-0.5 rounded-lg bg-[#00D4AA]/20 backdrop-blur-sm border border-[#00D4AA]/30 flex items-center gap-1 shrink-0">
                <Shield className="w-2.5 h-2.5 text-[#00D4AA]" />
                <span className="text-[8px] font-black text-[#00D4AA] uppercase tracking-wider hidden sm:inline">Root</span>
              </div>
            )}
          </div>
          {!isSilentAnchor && (
            <AnimatePresence mode="wait">
              <motion.div
                key={badgeLabel}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="px-2 py-0.5 rounded-lg text-[10px] font-bold backdrop-blur-sm shrink-0"
                style={{ color: badgeColor, backgroundColor: badgeBg, border: `1px solid ${badgeColor}30` }}
              >
                {badgeIcon} {badgeLabel}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {(isSilentAnchor || isHead) && (
          <div className="absolute bottom-2 right-2 z-20">
            <motion.div
              animate={{ boxShadow: ['0 0 10px rgba(0,212,170,0.4)', '0 0 24px rgba(0,212,170,0.8)', '0 0 10px rgba(0,212,170,0.4)'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-8 h-8 rounded-xl bg-[#00D4AA]/20 border border-[#00D4AA]/40 flex items-center justify-center"
              title={isHead ? 'HEAD: オリジナル画質を保持' : '原本アンカー'}
            >
              <Lock className="w-4 h-4 text-[#00D4AA]" />
            </motion.div>
          </div>
        )}

        {/* v4: Fork-on-Write — sealed でも常に削除可能（Trash アイコン） */}
        {!step.isRoot && totalSteps > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(step.id); }}
            className="absolute bottom-2 right-2 w-7 h-7 rounded-lg bg-[#07061A]/80 backdrop-blur-sm border border-white/10 flex items-center justify-center text-[#A8A0D8]/50 hover:text-[#FF4D4D] hover:border-[#FF4D4D]/30 transition-colors opacity-0 group-hover/thumb:opacity-100"
            style={isHead ? { right: 'auto', left: 8 } : undefined}
            title="削除（編集後は自動で新リヴィジョン）"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        {step.previewUrl && !step.isRoot && !isHead && (
          <label className="absolute bottom-2 left-2 w-7 h-7 rounded-lg bg-[#07061A]/80 backdrop-blur-sm border border-white/10 flex items-center justify-center text-[#A8A0D8]/50 hover:text-[#00D4AA] hover:border-[#00D4AA]/30 transition-colors opacity-0 group-hover/thumb:opacity-100 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onReplace(f); }} />
          </label>
        )}
      </div>

      {!isSilentAnchor && (
        <div className="px-3 py-2.5">
          {editingTitle ? (
            <input
              autoFocus
              className="w-full bg-transparent border-b border-[#00D4AA]/60 text-xs font-bold text-white pb-0.5 focus:outline-none"
              value={step.title}
              onChange={(e) => onUpdate(step.id, { title: e.target.value })}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => { if (e.key === 'Enter') setEditingTitle(false); }}
            />
          ) : (
            <div className="flex items-center justify-between mb-1 min-w-0 flex-1">
              <p
                className="text-xs font-bold text-white truncate cursor-text hover:text-[#00D4AA] transition-colors min-w-0 flex-1"
                onClick={() => setEditingTitle(true)}
              >{step.title}</p>
              {!step.isRoot && step.uploadState === 'uploading' && <CloudLightning className="w-3 h-3 text-[#00D4AA] animate-pulse ml-2 shrink-0" />}
              {!step.isRoot && step.uploadState === 'uploaded' && <CloudAll className="w-3 h-3 text-[#00D4AA] ml-2 shrink-0" />}
              {!step.isRoot && step.uploadState === 'error' && (
                <button onClick={() => onUpdate(step.id, { uploadState: 'idle' })} title="アップロード再試行" className="ml-2 shrink-0">
                  <RefreshCw className="w-3 h-3 text-[#FF4D4D]" />
                </button>
              )}
            </div>
          )}

          {editingNote ? (
            <textarea
              autoFocus
              className="w-full mt-1 bg-transparent border-b border-[#00D4AA]/60 text-[10px] text-[#A8A0D8] pb-0.5 focus:outline-none resize-none min-h-[32px]"
              value={step.note ?? ''}
              onChange={(e) => onUpdate(step.id, { note: e.target.value })}
              onBlur={() => setEditingNote(false)}
              placeholder="メモを追加..."
            />
          ) : (
            <p
              className="mt-0.5 text-[10px] text-[#A8A0D8]/40 truncate cursor-text hover:text-[#A8A0D8]/70 transition-colors"
              onClick={() => setEditingNote(true)}
            >{step.note || 'メモを追加...'}</p>
          )}

          {step.hashState === 'verified' && step.sha256 && (
            <div className="mt-1.5 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5 text-[#00D4AA]" />
              <span className="text-[8px] font-mono text-[#00D4AA]/60 tracking-wider">
                {step.sha256.slice(0, 8)}…{step.sha256.slice(-6)}
              </span>
            </div>
          )}

          {!step.isRoot && (
            isHead ? (
              <p className="mt-1.5 text-[8px] text-[#00D4AA]/60 font-bold tracking-wide">★ オリジナル画質保持</p>
            ) : (
              <p className="mt-1.5 text-[8px] text-white/20 font-medium">↕ フリックで削除</p>
            )
          )}
        </div>
      )}
    </Reorder.Item>
  );
}

function EvolutionScrub({
  steps, scrubIndex, onScrub,
}: {
  steps: WorkspaceStep[];
  scrubIndex: number;
  onScrub: (i: number) => void;
}) {
  const displayStep = steps[scrubIndex] ?? steps[0];
  const thumbSrc = displayStep?.thumbUrl ?? displayStep?.previewUrl;
  if (!thumbSrc) return null;

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4">
      <div className="text-[10px] uppercase tracking-[0.22em] text-[#A8A0D8]/50 mb-3 font-bold">
        Evolution Scrub — 工程 {scrubIndex + 1} / {steps.length}
      </div>
      <div className="flex items-center gap-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={scrubIndex}
            initial={{ opacity: 0, scale: 0.93 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.12 }}
            className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-[#0D0B24]"
          >
            <img src={thumbSrc} alt="scrub preview" className="w-full h-full object-cover" draggable={false} />
          </motion.div>
        </AnimatePresence>

        <div className="flex-1 flex flex-col gap-2">
          <input
            type="range"
            min={0}
            max={steps.length - 1}
            step={1}
            value={scrubIndex}
            onChange={(e) => onScrub(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-[#00D4AA] cursor-pointer"
            style={{ accentColor: '#00D4AA' }}
          />
          <div className="flex justify-between">
            <span className="text-[9px] text-[#A8A0D8]/40">{steps[0]?.title ?? '起点'}</span>
            <span className="text-[9px] text-[#A8A0D8]/70 font-bold">{displayStep?.title}</span>
            <span className="text-[9px] text-[#A8A0D8]/40">{steps[steps.length - 1]?.title ?? '完成'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SlideToSeal — v4
   - empty=true: 物理無効化（opacity-30 + grayscale + pointer-events-none）
   - disabled=true: 半透明だがクリック可（ただし発火条件未達）
   ═══════════════════════════════════════════════════════════════ */

function SlideToSeal({
  empty,
  disabled,
  onSealed,
}: {
  empty: boolean;
  disabled: boolean;
  onSealed: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(280);
  const x = useMotionValue(0);
  const sealed = useRef(false);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) setTrackWidth(containerRef.current.offsetWidth);
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const KNOB_W = 52;
  const MAX_X = Math.max(0, trackWidth - KNOB_W - 8);

  const trackBg = useTransform(x, [0, MAX_X], ['rgba(255,255,255,0.05)', 'rgba(0,212,170,0.18)']);
  const knobBg = useTransform(x, [0, MAX_X], ['#6C3EF4', '#00D4AA']);
  const labelOpacity = useTransform(x, [0, MAX_X * 0.5], [1, 0]);

  const handleDragEnd = () => {
    if (empty || sealed.current) return;
    if (x.get() >= MAX_X * 0.8) {
      sealed.current = true;
      animate(x, MAX_X, { type: 'spring', stiffness: 400, damping: 28 });
      onSealed();
    } else {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
    }
  };

  // empty/disabled の物理＋視覚ガード
  const hardLocked = empty; // 虚無の送信バグ防止
  const wrapperClass = [
    'w-full max-w-md mx-auto transition-all duration-300',
    hardLocked
      ? 'opacity-30 grayscale pointer-events-none'
      : disabled
        ? 'opacity-50'
        : 'opacity-100',
  ].join(' ');

  return (
    <div className={wrapperClass} aria-disabled={hardLocked || disabled}>
      <motion.div
        ref={containerRef}
        style={{ background: trackBg }}
        className="relative h-[56px] w-full rounded-2xl border border-white/10 backdrop-blur-md overflow-hidden flex items-center px-1"
      >
        <motion.div
          style={{ opacity: labelOpacity }}
          className="absolute inset-0 flex items-center justify-center gap-2 pointer-events-none select-none px-4"
        >
          <Layers3 className="w-4 h-4 text-[#A8A0D8]/60 shrink-0" />
          <span className="text-xs md:text-sm font-bold text-[#A8A0D8]/60 tracking-wide truncate">
            {hardLocked ? '画像を追加してください' : 'スライドして封印 (Seal)'}
          </span>
        </motion.div>

        <motion.div
          drag={hardLocked ? false : 'x'}
          dragConstraints={{ left: 0, right: MAX_X }}
          dragElastic={0.05}
          dragMomentum={false}
          style={{ x, background: knobBg }}
          onDragEnd={handleDragEnd}
          whileDrag={{ scale: 1.08 }}
          className="relative z-10 w-[52px] h-[48px] rounded-xl flex items-center justify-center cursor-grab active:cursor-grabbing shadow-[0_4px_16px_rgba(0,0,0,0.4)] shrink-0"
        >
          <Lock className="w-4 h-4 text-white" />
        </motion.div>
      </motion.div>
      <p className="mt-2 text-[10px] text-[#A8A0D8]/40 text-center font-medium tracking-wider">
        {hardLocked
          ? 'Empty Canvas — 何も封印できません'
          : '右端まで引いて封印 — 確定後も編集すれば自動で派生'}
      </p>
    </div>
  );
}