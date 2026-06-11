/**
 * ProcessBundleComposer.tsx — Auto-Resolving Timeline v3 (Hybrid Payload)
 * ────────────────────────────────────────────────────────────────────────
 * Drop-in 拡張。Props 契約は完全後方互換:
 *
 *   { certificate: CertificateRecord | null }                ← v2 までの呼び出し
 *   { certificate: null, initialFiles: File[], onComplete? } ← v3 Magic Mode
 *
 * v3 で追加された 1 つの責務:
 *  - `initialFiles` を起点に「証明書を持たないまま」タイムラインを開始可能。
 *  - Slide to Seal の瞬間に【ハイブリッド圧縮】を直列実行:
 *      index 0 .. length-2 → compressProcessStepImage で WebP 軽量化
 *      index length-1 (HEAD/完成品) → 絶対無変換
 *    その後、既存の Hash Worker + Ghost Upload + バルク送信フローへ合流する。
 *
 * 不変条件 (1 ミリも壊さない):
 *  - hashWorker.ts への通信プロトコル
 *  - Reorder.Group / framer-motion の挙動と layoutId
 *  - 既存の certificate ベース・ハイドレーション
 *  - Ghost Upload Watcher の concurrency / abort 制御
 *  - Smart Upsell / Quota 表示
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
  ImagePlus,
  Layers3,
  Loader2,
  Lock,
  RefreshCw,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  Zap,
  Wand2,
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

/** 圧縮ループでの強制 Yield (ms)。compressProcessStepImage 内部の Yield と二重防衛。 */
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
  /** v3: Magic Mode で投入された初期ステップ。Slide to Seal まで Ghost Upload を保留する */
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
   v3: Compression Progress State
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
  /** v3 Magic Mode: CertificateUpload から渡される初期工程ファイル列。最後の要素が HEAD */
  initialFiles?: File[];
  /** v3 Magic Mode: 完了時のコールバック（成功遷移は composer 内部で行う） */
  onComplete?: () => void;
}

export function ProcessBundleComposer({
  certificate,
  initialFiles,
  onComplete,
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

  /* ── global drag-over (OS file) ── */
  const [globalDragOver, setGlobalDragOver] = useState(false);

  /* ── hydration ── */
  const [isHydrating, setIsHydrating] = useState(true);

  /* ── sealed state (Slide to Seal) ── */
  const [sealed, setSealed] = useState(false);

  /* ── Evolution Scrub ── */
  const [scrubIndex, setScrubIndex] = useState(0);

  /* ── v3: Magic Mode 判定 ── */
  const magicMode = useMemo(
    () => !certificate && Array.isArray(initialFiles) && initialFiles.length >= 2,
    [certificate, initialFiles],
  );

  /* ── v3: 圧縮 → ハッシュ → アップロード → 送信 の段階表示 ── */
  const [compression, setCompression] = useState<CompressionProgress>({
    phase: 'idle', current: 0, total: 0, caption: '',
  });

  // Quota & Upsell
  const [quota, setQuota] = useState<{ plan: string; limit: number; used: number; remaining: number } | null>(null);
  const [upsellIntent, setUpsellIntent] = useState<{ needed: number; targetPlan: string; currentRemaining: number } | null>(null);

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

  /* ── ref caches ── */
  const urlCacheRef = useRef<Map<string, string>>(new Map());
  const thumbCacheRef = useRef<Map<string, string>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploads = useRef(0);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  /* ── Fix 2: stepsRef — always-current snapshot, safe in async contexts ── */
  const stepsRef = useRef<WorkspaceStep[]>(steps);
  useEffect(() => { stepsRef.current = steps; }, [steps]);

  /* ── derived ── */
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
   * canSubmit の判定:
   *  - 通常モード: allVerified && allUploaded
   *  - Magic Mode: 圧縮〜送信は Slide to Seal が起点で内部実行するため、
   *    allVerified のみで開放（uploadState は seal 後に走る）。
   */
  const canSubmit = magicMode
    ? steps.length >= 2 && !submitting && allVerified && !sealed
    : !!certificate && steps.length > 0 && !submitting && allVerified && !sealed && allUploaded;

  /* ═════════════════════════════════════════════════════════════
     v3: Magic Mode — initialFiles から steps を構築（既存 hydrate と排他）
     ═════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!magicMode || !initialFiles) return;
    let isMounted = true;

    const seedFromFiles = async () => {
      // 重複除去（同一名/サイズ/lastModified）
      const seen = new Set<string>();
      const unique = initialFiles.filter((f) => {
        const k = `${f.name}-${f.size}-${f.lastModified}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      // initialFiles の配列順を保持する（CertificateUpload 側で dropzone 順を尊重）
      // 既存 addFilesAtIndex の lastModified ソートは適用しない。
      const baseSteps: WorkspaceStep[] = unique.map((f) => ({
        id: crypto.randomUUID(),
        stepType: guessStepType(f.name),
        title: fileBaseName(f.name) || '途中工程',
        note: '',
        file: f,
        previewUrl: undefined,
        hashState: 'idle',
        uploadState: 'idle',
        deferred: true, // ← Ghost Upload を保留
      }));

      if (!isMounted) return;
      setSteps(baseSteps);
      setIsHydrating(false);

      // サムネ生成 + プレビュー URL（直列で OOM 回避）
      for (const step of baseSteps) {
        if (!isMounted) break;
        // preview URL
        const purl = URL.createObjectURL(step.file!);
        urlCacheRef.current.set(step.id, purl);
        // thumb
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
        // 直列 + Yield (OOM 防衛)
        await new Promise((r) => setTimeout(r, COMPRESSION_YIELD_MS));
      }

      // 既存 Hash Worker で並列ハッシュを走らせる（worker 側で順次処理）
      baseSteps.forEach((s) => computeHash(s.id, s.file!));
    };

    setSteps([]);
    setIsHydrating(true);
    seedFromFiles();
    return () => { isMounted = false; };
    // computeHash は安定参照
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [magicMode, initialFiles]);

  /* ═════════════════════════════════════════════════════════════
     既存: certificate ベース・ハイドレーション (Magic Mode 時はスキップ)
     ═════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (magicMode) return; // ← v3: Magic Mode は排他
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

  /* ── stable preview URL helper ── */
  const getPreviewUrl = useCallback((stepId: string, file?: File): string | undefined => {
    if (!file) return undefined;
    const cache = urlCacheRef.current;
    if (cache.has(stepId)) return cache.get(stepId)!;
    const url = URL.createObjectURL(file);
    cache.set(stepId, url);
    return url;
  }, []);

  /* ── compute hash via hashWorker (progress aware) ── */
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

  /* ── processInChunks helper (OOM Defense) ── */
  async function processInChunks<T, R>(items: T[], chunkSize: number, processor: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(chunk.map(processor));
      results.push(...chunkResults);
    }
    return results;
  }

  /* 🚨 究極の洗練: クラウド破産(429)を防ぐバルク(一括)リクエストの完全復活 */
  const fetchUploadUrls = useCallback(async (newSteps: WorkspaceStep[]) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('No token');

      // 1. ファイルが存在するステップを抽出（deferredフラグは無視して一斉処理）
      const targets = newSteps.filter((s) => !!s.file);
      if (targets.length === 0) return;

      // 2. 150枚の工程(最大300リクエスト)を「1つの配列」に圧縮（ペイロードの構築）
      const payloadItems = targets.flatMap((s) => {
        const items = [
          { fileName: s.file!.name, mimeType: s.file!.type || 'application/octet-stream', fileSize: s.file!.size }
        ];
        if (s.thumbBlob) {
          items.push({ fileName: `thumb_${s.id}.webp`, mimeType: 'image/webp', fileSize: s.thumbBlob.size });
        }
        return items;
      });

      // 3. バルクエンドポイントへ「1回だけ」通信する（429レートリミットを物理的に回避）
      const res = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: payloadItems, proofMode: isPublic ? 'shareable' : 'private' })
      });

      if (!res.ok) throw new Error('Bulk URL fetch failed');
      const { urls } = await res.json();

      // 4. 取得したURL群を各ステップにマッピングしてStateを更新
      setSteps(cur => cur.map(s => {
        const target = targets.find(t => t.id === s.id);
        if (!target) return s;

        const origIdx = payloadItems.findIndex(p => p.fileName === target.file!.name);
        const thumbIdx = payloadItems.findIndex(p => p.fileName === `thumb_${target.id}.webp`);

        return {
          ...s,
          signedUrl: urls[origIdx]?.signedUrl,
          quarantinePath: urls[origIdx]?.quarantinePath,
          thumbSignedUrl: thumbIdx !== -1 ? urls[thumbIdx]?.signedUrl : undefined,
          thumbQuarantinePath: thumbIdx !== -1 ? urls[thumbIdx]?.quarantinePath : undefined,
          uploadState: 'idle' as const,
          deferred: false, // 🚨 ゴーストアップロードを許可し、一気にクラウドへ流し込む
        };
      }));
    } catch (err) {
      console.error('Upload URL fetch error:', err);
      setSteps(cur => cur.map(s => newSteps.some(ns => ns.id === s.id) ? { ...s, uploadState: 'error' as const } : s));
    }
  }, [isPublic]);

  /* ── attachThumb helper (for replaced images) ── */
  const attachThumb = useCallback(async (stepId: string, file: File) => {
    try {
      const thumb = await generateThumb(file);
      setSteps(cur => {
        const target = cur.find(s => s.id === stepId);
        if (!target) return cur;
        const updated = { ...target, thumbUrl: thumb.url, thumbBlob: thumb.blob, uploadState: 'fetching_url' as const };
        // Magic Mode 中は upload URL を取得しない（seal 時に一括取得）
        if (!target.deferred) fetchUploadUrls([updated]);
        return cur.map(s => s.id === stepId ? updated : s);
      });
    } catch (e) {
      console.error('Thumbnail generation failed', e);
    }
  }, [fetchUploadUrls]);

  /* ── add files at a specific insertion index (通常モード用) ── */
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

  /* ── Ghost Upload Watcher (Magic Mode の deferred は除外) ── */
  useEffect(() => {
    const processUploadQueue = async () => {
      const readyItems = steps.filter(s =>
        !s.isRoot &&
        !s.deferred &&                        // ← v3: deferred は seal までスキップ
        s.hashState === 'verified' &&
        s.signedUrl &&
        s.uploadState === 'idle'
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
    const url = urlCacheRef.current.get(id);
    if (url) { URL.revokeObjectURL(url); urlCacheRef.current.delete(id); }
    const turl = thumbCacheRef.current.get(id);
    if (turl) { URL.revokeObjectURL(turl); thumbCacheRef.current.delete(id); }

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
    },
    [addFilesAsSteps],
  );

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFilesAsSteps(e.target.files);
        e.target.value = '';
      }
    },
    [addFilesAsSteps],
  );

  /* ═════════════════════════════════════════════════════════════
     v3: Hybrid Payload — Slide to Seal 起点の圧縮 → 再ハッシュ → upload → submit
     ═════════════════════════════════════════════════════════════ */

  /**
   * 直列圧縮ループ。indices [0..length-2] のみ圧縮、length-1 は触らない。
   * 各 iteration で setTimeout 10ms の Yield を必ず挟む（OOM + RAF 阻害対策）。
   */
  const runHybridCompression = useCallback(async (): Promise<WorkspaceStep[]> => {
    // Fix 2: stepsRef.current で安全・瞬時に最新スナップショットを取得
    const snapshot = stepsRef.current;

    if (snapshot.length < 2) return snapshot;

    const lastIndex = snapshot.length - 1;
    const targetIndices: number[] = [];
    for (let i = 0; i <= lastIndex - 1; i++) {
      // root（既存証明書）は触らない方針。Magic Mode では root は無いが、防御的に除外
      if (!snapshot[i].isRoot && snapshot[i].file) targetIndices.push(i);
    }

    setCompression({
      phase: 'compressing',
      current: 0,
      total: targetIndices.length,
      caption: '証拠データを最適化中...',
    });

    const updated: WorkspaceStep[] = [...snapshot];

    for (let k = 0; k < targetIndices.length; k++) {
      const idx = targetIndices[k];
      const step = updated[idx];
      const originalFile = step.file!;

      // ── 1. 圧縮 (内部でも EXIF/Yield/メタ剥離が走る) ──────────
      let compressed: File;
      try {
        compressed = await compressProcessStepImage(originalFile);
      } catch (err) {
        // 失敗時は原本でフォールバック（チェーン全体を壊さない）
        console.warn('[HybridPayload] compression failed; fallback to original', err);
        compressed = originalFile;
      }

      // ── 2. ステップを差し替え（hash はやり直し、prev preview を破棄） ─
      const newPreviewUrl = URL.createObjectURL(compressed);
      const oldPreview = urlCacheRef.current.get(step.id);
      if (oldPreview) URL.revokeObjectURL(oldPreview);
      urlCacheRef.current.set(step.id, newPreviewUrl);

      updated[idx] = {
        ...step,
        file: compressed,
        previewUrl: newPreviewUrl,
        hashState: 'idle',
        sha256: undefined,
        hashProgress: 0,
      };

      // state にも即時反映（UI 進捗）
      setSteps((cur) => cur.map((s) => s.id === step.id ? updated[idx] : s));

      setCompression((p) => ({
        ...p,
        current: k + 1,
        caption: `証拠データを最適化中... (${k + 1}/${targetIndices.length})`,
      }));

      // ── 3. 直列の強制 Yield (compress 内部の Yield と二重防衛) ──
      await new Promise((r) => setTimeout(r, COMPRESSION_YIELD_MS));
    }

    return updated;
  }, []);

  /**
   * 圧縮後の steps に対して、Hash Worker で再ハッシュ → 完了を await する。
   */
  const reHashAfterCompression = useCallback(async (postCompress: WorkspaceStep[]) => {
    setCompression({
      phase: 'rehashing',
      current: 0,
      total: postCompress.length,
      caption: 'ハッシュ値を再計算中...',
    });

    const promises = postCompress
      .filter((s) => !s.isRoot && s.file && s.hashState !== 'verified')
      .map((s) => computeHash(s.id, s.file!));

    await Promise.all(promises);

    // 進捗インクリメント（cosmetic）
    setCompression((p) => ({ ...p, current: p.total }));
  }, [computeHash]);

  /**
   * Magic Mode 用 Submit:
   *   compress → rehash → fetchUploadUrls → wait uploads → POST create
   */
  async function submitMagic() {
    if (!magicMode) return;
    setSubmitting(true);
    setMessage(null);
    setResult(null);

    try {
      // 1. Hybrid Compression
      const postCompress = await runHybridCompression();

      // 2. Re-hash compressed steps
      await reHashAfterCompression(postCompress);

      // 3. Fetch upload URLs (deferred 解除)
      setCompression({
        phase: 'uploading',
        current: 0,
        total: postCompress.length,
        caption: 'クラウドへ安全に転送中...',
      });

      // Fix 2: stepsRef.current で最新スナップショットを安全に取得
      const toUpload = stepsRef.current.filter((s) => !s.isRoot && s.file);
      await fetchUploadUrls(toUpload);

      // 4. Ghost Upload Watcher が deferred 解除を検知してアップロード開始
      //    全アップロード完了まで待機（タイムアウト 2 分）
      const startedAt = Date.now();
      const TIMEOUT_MS = 120_000;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Fix 2: stepsRef.current でポーリング中の最新状態を安全に読み取る
        const targets = stepsRef.current.filter((s) => !s.isRoot && s.file);
        const done = targets.every((s) => s.uploadState === 'uploaded');
        const failed = targets.some((s) => s.uploadState === 'error');

        if (done) break;
        if (failed) throw new Error('一部のアップロードに失敗しました。再試行してください。');
        if (Date.now() - startedAt > TIMEOUT_MS) {
          throw new Error('アップロードがタイムアウトしました。ネットワークを確認してください。');
        }

        // 完了数を進捗に反映
        const completed = targets.filter((s) => s.uploadState === 'uploaded').length;
        setCompression((p) => ({ ...p, current: completed, total: targets.length }));

        await new Promise((r) => setTimeout(r, 250));
      }

      // 5. Submit metadata (既存の /api/certificates/create バルク送信)
      setCompression({
        phase: 'submitting',
        current: 0,
        total: 1,
        caption: '証拠チェーンを台帳へ書き込み中...',
      });

      // Fix 2: stepsRef.current で最終状態を安全に読み取る
      const targets = stepsRef.current.filter((s) => !s.isRoot && s.file);
      const headStep = targets[targets.length - 1];

      const payload = {
        bundleId: crypto.randomUUID(),
        title: title || headStep.title || 'Chain of Evidence',
        description: description,
        items: targets.map((s, idx) => ({
          quarantinePath: s.quarantinePath,
          thumbnailPath: s.thumbQuarantinePath,
          sha256: s.sha256,
          title: s.title,
          proofMode: isPublic ? 'shareable' : 'private',
          visibility: isPublic ? 'public' : 'private',
          file_name: s.file!.name,
          file_size: s.file!.size,
          mime_type: s.file!.type || 'application/octet-stream',
          stepIndex: idx,
          isHead: idx === targets.length - 1
        }))
      };

      // JWT取得 — /api/certificates/create への認証ヘッダーに使用
      const { data: sessionData } = await supabase.auth.getSession();
      const jwtToken = sessionData.session?.access_token;
      if (!jwtToken) throw new Error('認証セッションが切れました。再度ログインしてください。');

      const res = await fetch('/api/certificates/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || '証明書の台帳記録に失敗しました。');
      }

      const data = await res.json();
      const certificateId = data.certificates?.[0]?.id || data.certificate?.id || data.certificateId || 'unknown';
      // 🚨 バックグラウンドで商用TSA（タイムスタンプ）を打刻するトリガーを引く
      if (jwtToken && certificateId !== 'unknown') {
         sessionStorage.setItem('tsa_syncing_' + certificateId, 'true');
         fetch('/api/timestamp', {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
             Authorization: `Bearer ${jwtToken}`,
           },
           body: JSON.stringify({ certId: certificateId, hash: headStep.sha256 }),
           keepalive: true,
         }).catch(err => console.error('[Background TSA] Failed to trigger:', err));
      }

      setResult({
        chainDepth: targets.length,
        chainHeadSha256: headStep.sha256 ?? null,
        certificateId,
      });
      setMessage('Chain of Evidence を保存しました。3秒後に証明書ページへリダイレクトします...');
      setCompression({ phase: 'done', current: 1, total: 1, caption: '完了' });
      onComplete?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存に失敗しました');
      setCompression({ phase: 'idle', current: 0, total: 0, caption: '' });
      // seal を解除して再試行可能にする
      setSealed(false);
    } finally {
      setSubmitting(false);
    }
  }

  /* ── submit (既存: certificate ベース) ── */
  async function submit() {
    if (!certificate) return;
    setSubmitting(true); setMessage(null); setResult(null);
    try {
      const targets = stepsRef.current.filter((s) => !s.isRoot && s.file);
      if (targets.length === 0) throw new Error('追加する工程がありません。');
      const headStep = targets[targets.length - 1];

      const payload = {
        bundleId: certificate.process_bundle_id || crypto.randomUUID(),
        items: targets.map((s, idx) => ({
          quarantinePath: s.quarantinePath,
          thumbnailPath: s.thumbQuarantinePath,
          sha256: s.sha256,
          title: s.title,
          proofMode: isPublic ? 'shareable' : 'private',
          visibility: isPublic ? 'public' : 'private',
          file_name: s.file!.name,
          file_size: s.file!.size,
          mime_type: s.file!.type || 'application/octet-stream',
          stepIndex: idx,
          isHead: idx === targets.length - 1
        }))
      };

      const { data: authData } = await supabase.auth.getSession();
      const jwtToken = authData.session?.access_token;
      if (!jwtToken) throw new Error('認証セッションが切れました。再度ログインしてください。');

      const res = await fetch('/api/certificates/create', { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwtToken}` 
        }, 
        body: JSON.stringify(payload) 
      });
      if (!res.ok) throw new Error('証明書の台帳記録に失敗しました。');
      const data = await res.json();
      setResult({ chainDepth: steps.length, chainHeadSha256: steps[steps.length - 1].sha256 ?? null, certificateId: data.certificates?.[0]?.id || data.certificate?.id || data.certificateId || 'unknown' });
      setMessage('Chain of Evidence を保存しました。3秒後に証明書ページへリダイレクトします...');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存に失敗しました');
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

  /* ══════════════════════════════════════════════════════════════
     RENDER: SUCCESS
     ══════════════════════════════════════════════════════════════ */
  if (result) {
    return (
      <section className="w-full bg-[#0F0F11] border border-white/10 rounded-3xl p-6 md:p-10 shadow-[0_0_50px_rgba(0,212,170,0.06)]">
        <div className="flex flex-col items-center text-center gap-6 py-8">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-[#00D4AA]/20" />
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#00D4AA] to-[#00D4AA]/60 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-[#07061A]" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">Chain of Evidence 構築完了</h2>
            <p className="mt-2 text-sm text-[#A8A0D8]">{result.chainDepth}工程が暗号的に連結されました</p>
          </div>
          <div className="flex items-center gap-1.5 py-3">
            {Array.from({ length: result.chainDepth }).map((_, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6C3EF4] to-[#8B61FF] flex items-center justify-center text-xs font-black text-white shadow-[0_0_12px_rgba(108,62,244,0.4)]">
                  {i + 1}
                </div>
                {i < result.chainDepth - 1 && <div className="w-6 h-0.5 bg-gradient-to-r from-[#6C3EF4] to-[#00D4AA]" />}
              </div>
            ))}
          </div>
          <code className="text-xs text-[#A8A0D8]/60 bg-[#07061A] border border-white/10 rounded-xl px-4 py-2 max-w-full overflow-x-auto">
            HEAD: {result.chainHeadSha256 ?? '—'}
          </code>
          <button
            onClick={() => setLocation(`/cert/${result.certificateId}`)}
            className="mt-2 flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-bold text-[#07061A] bg-gradient-to-r from-[#00D4AA] to-[#00D4AA]/80 rounded-2xl hover:shadow-[0_0_30px_rgba(0,212,170,0.4)] transition-all"
          >
            <Sparkles className="w-4 h-4" /> 証明書を見る
          </button>
          <p className="text-xs text-[#A8A0D8]/50 animate-pulse">3秒後に自動遷移します...</p>
        </div>
      </section>
    );
  }

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
        w-full bg-[#0F0F11] border rounded-3xl p-6 md:p-8 transition-all duration-300
        ${globalDragOver
          ? 'border-[#00D4AA]/50 shadow-[0_0_60px_rgba(0,212,170,0.15)] ring-1 ring-[#00D4AA]/20'
          : 'border-white/10 shadow-[0_0_50px_rgba(0,212,170,0.04)]'}
        ${sealed ? 'opacity-95' : ''}
      `}
      onDragOver={onGlobalDragOver}
      onDragLeave={onGlobalDragLeave}
      onDrop={sealed ? undefined : onGlobalDrop}
    >
      {/* ── v3: Magic Mode Banner ── */}
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

      {/* ── Sealed Freeze Banner ── */}
      <AnimatePresence>
        {sealed && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#00D4AA]/10 border border-[#00D4AA]/30"
          >
            <Lock className="w-4 h-4 text-[#00D4AA] shrink-0" />
            <span className="text-sm font-bold text-[#00D4AA]">タイムラインがシールされました — 提出待機中</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── v3: Compression Progress (Slide to Seal 後の段階表示) ── */}
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
                {/* 進捗バー: width のみ。compositor で走るので main thread ブロック中も滑らかに見える */}
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

      {/* ── Header ── */}
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.28em] text-[#A8A0D8]/60">Auto-Resolving Timeline Studio</div>
        <h2 className="mt-2 text-xl md:text-2xl font-black tracking-tight text-white">
          制作プロセスを証拠化する
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#A8A0D8]/70">
          画像をドロップするだけ — 古い順に自動整列。フリックで削除、ドラッグで並び替え可能。
        </p>
      </div>

      {/* ── Loading State ── */}
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

      {/* ── Empty Canvas ── */}
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

      {/* ── Living Timeline ── */}
      {steps.length > 0 && !isHydrating && (
        <div className="mt-2">
          {/* Status bar */}
          <div className="flex items-center justify-between mb-5">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#A8A0D8]/60">
              Evidence Chain — {readyCount} step{readyCount !== 1 ? 's' : ''}
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

          {/* Horizontal Reorder canvas */}
          <div className="overflow-x-auto pb-6 -mx-2 px-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
            <Reorder.Group
              axis="x"
              values={steps}
              onReorder={sealed ? () => {} : setSteps}
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
                      sealed={sealed}
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

              {/* Ghost add card */}
              {!sealed && (
                <motion.button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-[190px] md:w-[210px] rounded-2xl border-2 border-dashed border-white/10 hover:border-[#00D4AA]/30 bg-white/5 hover:bg-[#00D4AA]/5 backdrop-blur-md flex flex-col items-center justify-center gap-2 py-14 transition-all group/add shrink-0 ml-2"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#00D4AA]/10 group-hover/add:bg-[#00D4AA]/20 flex items-center justify-center transition-colors">
                    <ImagePlus className="w-5 h-5 text-[#00D4AA]" />
                  </div>
                  <span className="text-xs font-bold text-[#A8A0D8]/50 group-hover/add:text-[#A8A0D8]">工程を追加</span>
                </motion.button>
              )}
            </Reorder.Group>
          </div>

          {/* ── Evolution Scrub ── */}
          {steps.some((s) => s.thumbUrl || s.previewUrl) && (
            <EvolutionScrub
              steps={steps}
              scrubIndex={scrubIndex}
              onScrub={setScrubIndex}
            />
          )}
        </div>
      )}

      {/* ── Global drag overlay ── */}
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
        disabled={sealed}
      />

      {/* ── Meta (collapsible) ── */}
      {steps.length > 0 && !sealed && (
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

      {/* ── Submit area: Slide to Seal ── */}
      {steps.length > 0 && (
        <div className="mt-6 pt-6 border-t border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-[#A8A0D8]/50">
              <span className="text-white font-bold">{readyCount}</span> 工程が連結可能
              {!allVerified && (
                <span className="ml-2 text-xs text-[#6C3EF4] animate-pulse">
                  <Loader2 className="inline w-3 h-3 animate-spin mr-1" />
                  ハッシュ計算中...
                </span>
              )}
              {/* 通常モードのクラウド同期表示。Magic Mode では seal 後に進捗バーで表現するため出さない */}
              {!magicMode && allVerified && !allUploaded && (
                <span className="ml-2 text-xs text-[#00D4AA] animate-pulse">
                  <CloudLightning className="inline w-3 h-3 mr-1" />
                  クラウド同期中...
                </span>
              )}
            </div>
          </div>

          {!sealed ? (
            <SlideToSeal
              disabled={!canSubmit}
              onSealed={() => {
                setSealed(true);
                navigator.vibrate?.(40);
                if (magicMode) submitMagic();
                else submit();
              }}
            />
          ) : (
            <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/5 border border-white/10">
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin text-[#00D4AA]" /><span className="text-sm text-[#A8A0D8]">
                    {magicMode ? (compression.caption || '処理中...') : 'Chain of Evidence を保存中...'}
                  </span></>
                : <><Layers3 className="w-4 h-4 text-[#00D4AA]" /><span className="text-sm text-[#00D4AA] font-bold">封印済み — 保存完了後に自動遷移します</span></>
              }
            </div>
          )}
        </div>
      )}

      {/* ── Message ── */}
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
   SUB-COMPONENTS
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
  step,
  index,
  totalSteps,
  isSilentAnchor,
  isHead,
  sealed,
  onUpdate,
  onRemove,
  onReplace,
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
    if (sealed || step.isRoot) return;
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
      dragListener={(!isSilentAnchor && !sealed && !editingTitle && !editingNote) as boolean}
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

      {/* Thumbnail */}
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

        {/* Silent Anchor: Lock glow — right bottom (Magic Mode の HEAD にも同じ装飾) */}
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

        {!step.isRoot && !sealed && totalSteps > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(step.id); }}
            className="absolute bottom-2 right-2 w-7 h-7 rounded-lg bg-[#07061A]/80 backdrop-blur-sm border border-white/10 flex items-center justify-center text-[#A8A0D8]/50 hover:text-[#FF4D4D] hover:border-[#FF4D4D]/30 transition-colors opacity-0 group-hover/thumb:opacity-100"
            style={{ // HEAD は Lock グロウと位置がぶつかるため hover 時のみ表示
              ...(isHead ? { right: 'auto', left: 8 } : {}),
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        {step.previewUrl && !step.isRoot && !sealed && !isHead && (
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
                onClick={() => !sealed && setEditingTitle(true)}
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
              onClick={() => !sealed && setEditingNote(true)}
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

          {/* HEAD はオリジナル保持ヒント、それ以外は flick hint */}
          {!step.isRoot && !sealed && (
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
  steps,
  scrubIndex,
  onScrub,
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

function SlideToSeal({ disabled, onSealed }: { disabled: boolean; onSealed: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(280);
  const x = useMotionValue(0);
  const sealed = useRef(false);

  // 🚨 画面幅に合わせてスライダーの長さを動的に計算（モバイル対応）
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
    if (sealed.current) return;
    // 🚨 80% まで引けば確定 (スマホの適当なフリックでも発火するUXの魔法)
    if (x.get() >= MAX_X * 0.8) {
      sealed.current = true;
      animate(x, MAX_X, { type: 'spring', stiffness: 400, damping: 28 });
      onSealed();
    } else {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
    }
  };

  return (
    <div className={`transition-opacity duration-300 w-full max-w-md mx-auto ${disabled ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
      <motion.div
        ref={containerRef}
        style={{ background: trackBg }}
        className="relative h-[56px] w-full rounded-2xl border border-white/10 overflow-hidden flex items-center px-1"
      >
        <motion.div
          style={{ opacity: labelOpacity }}
          className="absolute inset-0 flex items-center justify-center gap-2 pointer-events-none select-none px-4"
        >
          <Layers3 className="w-4 h-4 text-[#A8A0D8]/60 shrink-0" />
          <span className="text-xs md:text-sm font-bold text-[#A8A0D8]/60 tracking-wide truncate">
            スライドして封印 (Seal)
          </span>
        </motion.div>

        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: MAX_X }}
          dragElastic={0.05}
          dragMomentum={false}
          style={{ x, background: knobBg }}
          onDragEnd={handleDragEnd}
          whileDrag={{ scale: 1.08 }}
          className="relative z-10 w-[52px] h-[48px] rounded-xl flex items-center justify-center cursor-grab active:cursor-grabbing shadow-[0_4px_16px_rgba(0,0,0,0.3)] shrink-0"
        >
          <Lock className="w-4 h-4 text-white" />
        </motion.div>
      </motion.div>
      <p className="mt-2 text-[10px] text-[#A8A0D8]/40 text-center font-medium">
        右端まで引いて封印 — 確定後は変更不可
      </p>
    </div>
  );
}