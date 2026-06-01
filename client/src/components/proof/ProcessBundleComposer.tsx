import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  ImagePlus,
  Layers3,
  Loader2,
  Lock,
  Shield,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { createProcessBundle } from '../../lib/proofmark-api';
import type { BundleStepType, CertificateRecord, ProcessBundleDraftStep } from '../../lib/proofmark-types';

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

const STEP_TYPE_LABELS: Record<string, string> = {
  rough: 'ラフ',
  lineart: '線画',
  color: '着色',
  final: '完成',
  other: '途中工程', // より汎用的なデフォルト名
};

const STEP_TYPE_COLORS: Record<string, string> = {
  rough: '#F59E0B',
  lineart: '#818CF8',
  color: '#34D399',
  final: '#00D4AA',
  other: '#A8A0D8',
};

function fileBaseName(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

function guessStepType(name: string, index?: number, total?: number): string {
  const lower = name.toLowerCase();
  if (/rough|ラフ|draft|sketch/i.test(lower)) return 'rough';
  if (/line|lineart|線画|ink/i.test(lower)) return 'lineart';
  if (/color|着色|paint|塗/i.test(lower)) return 'color';
  if (/final|完成|finish|done/i.test(lower)) return 'final';
  // インデックスベースの強引な「完成」推測を廃止。ファイル名で判別できないものはすべて「途中工程」
  return 'other';
}

/** SHA-256 hash of File in browser using Web Crypto */
async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/* ═══════════════════════════════════════════════════════════════
   EXTENDED STEP TYPE — adds hash state for UI
   ═══════════════════════════════════════════════════════════════ */

type WorkspaceStep = ProcessBundleDraftStep & {
  /** 'idle' | 'hashing' | 'verified' */
  hashState: 'idle' | 'hashing' | 'verified';
  /** hex hash once computed */
  sha256?: string;
  /** If true, this is a locked root step from the parent certificate */
  isRoot?: boolean;
};

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export function ProcessBundleComposer({ certificate }: { certificate: CertificateRecord | null }) {
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

  /* ── file drag state (new files from OS) ── */
  const [globalDragOver, setGlobalDragOver] = useState(false);
  /** Index of insertion slot being hovered (-1 = none, 0..steps.length) */
  const [insertSlotIndex, setInsertSlotIndex] = useState(-1);

  /* ── card reorder drag state ── */
  const draggedIndexRef = useRef<number | null>(null);
  const [reorderOverIndex, setReorderOverIndex] = useState<number | null>(null);
  const [isDraggingCard, setIsDraggingCard] = useState(false);

  const onCardDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    draggedIndexRef.current = index;
    setIsDraggingCard(true);
    // Slight delay so the browser renders the drag ghost before we apply opacity
    requestAnimationFrame(() => {
      setIsDraggingCard(true);
    });
  }, []);

  const onCardDragEnter = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndexRef.current === null) return;
    if (index !== draggedIndexRef.current) {
      setReorderOverIndex(index);
    }
  }, []);

  const onCardDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onCardDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const fromIndex = draggedIndexRef.current;
    if (fromIndex === null || fromIndex === dropIndex) {
      draggedIndexRef.current = null;
      setReorderOverIndex(null);
      setIsDraggingCard(false);
      return;
    }
    setSteps((cur) => {
      const copy = [...cur];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(dropIndex > fromIndex ? dropIndex - 1 : dropIndex, 0, moved);
      return copy;
    });
    draggedIndexRef.current = null;
    setReorderOverIndex(null);
    setIsDraggingCard(false);
  }, []);

  const onCardDragEnd = useCallback((_e: React.DragEvent) => {
    // Always fully reset — prevents opacity-blur bug when drag is cancelled by Escape
    draggedIndexRef.current = null;
    setReorderOverIndex(null);
    setIsDraggingCard(false);
  }, []);

  /* ── click-based move (accessibility alternative to D&D) ── */
  const moveStep = useCallback((fromIndex: number, direction: -1 | 1) => {
    const toIndex = fromIndex + direction;
    setSteps((cur) => {
      if (toIndex < 0 || toIndex >= cur.length) return cur;
      const copy = [...cur];
      [copy[fromIndex], copy[toIndex]] = [copy[toIndex], copy[fromIndex]];
      return copy;
    });
  }, []);

  /* ── inline editing ── */
  const [editingField, setEditingField] = useState<{ stepId: string; field: 'title' | 'note' | 'type' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  /** ref to keep stable identity for object URLs across renders */
  const urlCacheRef = useRef<Map<string, string>>(new Map());

  const [isHydrating, setIsHydrating] = useState(true);

  /* ── derived ── */
  const readyCount = useMemo(
    () => steps.filter((s) => (s.isRoot || (s.file && s.title.trim()))).length,
    [steps],
  );
  const allVerified = useMemo(() => steps.every((s) => s.hashState === 'verified'), [steps]);
  // 新規画像がなくても（入れ替えだけでも）保存可能にする
  const canSubmit = !!certificate && steps.length > 0 && !submitting && allVerified;

  /* ── hydrate root step from parent certificate on mount ── */
  useEffect(() => {
    if (!certificate) return;

    let isMounted = true;
    const loadExistingChain = async () => {
      // そもそもチェーンが存在しない場合は即フォールバック
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
          }]);
        }
        return;
      }

      let fetchedSteps: any[] | null = null;

      // ── 戦略1：パブリックAPIからの取得（キャッシュ破壊＋超柔軟パーサー） ──
      if (certificate.public_verify_token) {
        try {
          const res = await fetch(`/api/certificates/public/${certificate.public_verify_token}?t=${Date.now()}`, {
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
            cache: 'no-store'
          });
          if (res.ok) {
            const data = await res.json();
            // step_indexが欠落していても、step_typeやsha256があればステップ配列とみなす全方位探索
            const traverse = (obj: any) => {
              if (fetchedSteps) return;
              if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === 'object') {
                if ('step_type' in obj[0] || 'sha256' in obj[0] || 'stepType' in obj[0]) {
                  fetchedSteps = obj;
                  return;
                }
              }
              if (obj && typeof obj === 'object') {
                for (const key in obj) traverse(obj[key]);
              }
            };
            traverse(data);
          }
        } catch (e) {
          console.error('Public API fetch failed:', e);
        }
      }

      // ── 戦略2：Supabaseへの直接ダイレクトフェッチ（PrivateでAPIが弾かれた場合の最強のフォールバック） ──
      if (!fetchedSteps && typeof window !== 'undefined') {
        try {
          const url = import.meta.env.VITE_SUPABASE_URL;
          const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
          if (url && key) {
            const res = await fetch(`${url}/rest/v1/process_bundle_steps?bundle_id=eq.${certificate.process_bundle_id}&select=*`, {
              headers: { apikey: key, Authorization: `Bearer ${key}` }
            });
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data) && data.length > 0) {
                fetchedSteps = data;
              }
            }
          }
        } catch (e) {
          console.error('Direct Supabase fetch failed:', e);
        }
      }

      // ── 最終的な復元とUIへの適用 ──
      if (fetchedSteps && Array.isArray(fetchedSteps) && fetchedSteps.length > 0 && isMounted) {
        // step_indexがない場合は配列の並び順（DBの格納順）を正とみなす
        const sortedSteps = [...fetchedSteps].sort((a, b) => (a.step_index || 0) - (b.step_index || 0));
        setSteps(sortedSteps.map((s) => ({
          id: `root-${s.id}`,
          stepType: s.step_type || s.stepType || 'other',
          title: s.title || '過去の工程',
          note: s.description || s.note || '',
          previewUrl: s.preview_url || s.previewUrl || s.image_url || certificate.public_image_url,
          sha256: s.sha256,
          hashState: 'verified',
          isRoot: true, // サーバー保存済みの証拠として完全ロック
        })));
        return;
      }

      // ── どこからも引けなかった場合の最後の命綱 ──
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
        }]);
      }
    };

    setSteps([]); // 初期化してロード開始
    loadExistingChain().finally(() => {
      if (isMounted) setIsHydrating(false);
    });

    return () => { isMounted = false; };
  }, [certificate]);

  /* ── stable preview URL helper ── */
  const getPreviewUrl = useCallback((stepId: string, file?: File): string | undefined => {
    if (!file) return undefined;
    const cache = urlCacheRef.current;
    if (cache.has(stepId)) return cache.get(stepId)!;
    const url = URL.createObjectURL(file);
    cache.set(stepId, url);
    return url;
  }, []);

  /* ── hash a single step & ULTIMATE DUPLICATE CHECK ── */
  const computeHash = useCallback(async (stepId: string, file: File) => {
    setSteps((cur) => cur.map((s) => (s.id === stepId ? { ...s, hashState: 'hashing' as const } : s)));
    try {
      const hash = await hashFile(file);
      // Small delay so the animation feels tactile
      await new Promise((r) => setTimeout(r, 400));

      setSteps((cur) => {
        // 究極の重複チェック：同じSHA256ハッシュ（原本含む）がすでに存在するか？
        const isDuplicate = cur.some((s) => s.id !== stepId && s.sha256 === hash);
        if (isDuplicate) {
          setMessage('※ 同じ画像（同一ハッシュ）がすでにキャンバスに存在するため、ブロックしました。');
          // キャッシュURLの安全な破棄
          const cache = urlCacheRef.current;
          const url = cache.get(stepId);
          if (url) {
            URL.revokeObjectURL(url);
            cache.delete(stepId);
          }
          // 重複カードを配列から消滅させる
          return cur.filter((s) => s.id !== stepId);
        }
        return cur.map((s) =>
          s.id === stepId ? { ...s, hashState: 'verified' as const, sha256: hash } : s,
        );
      });
    } catch {
      setSteps((cur) => cur.map((s) => (s.id === stepId ? { ...s, hashState: 'idle' as const } : s)));
    }
  }, []);

  /* ── add files at a specific insertion index ── */
  const addFilesAtIndex = useCallback(
    (files: FileList | File[], insertAt: number) => {
      // 複数ドロップされたファイルを lastModified (最終更新日時) の古い順（過去→現在）に自動ソート
      const fileArray = Array.from(files)
        .filter((f) => f.type.startsWith('image/'))
        .sort((a, b) => a.lastModified - b.lastModified);

      if (fileArray.length === 0) {
        setMessage('※ PSDやCLIPなどの作業ファイルは直接証明できません。PNGやJPEGに書き出してください。');
        return;
      }

      // 重複ファイルのブロック
      const duplicates = fileArray.filter((f) =>
        steps.some((s) => s.file && s.file.name === f.name && s.file.size === f.size)
      );
      if (duplicates.length > 0) {
        setMessage(`「${duplicates.map((f) => f.name).join(', ')}」はすでに追加済みです。同じ画像の重複登録はブロックされました。`);
        return;
      }

      const newSteps: WorkspaceStep[] = fileArray.map((file, i) => {
        const total = steps.length + fileArray.length;
        const idx = insertAt + i;
        const baseName = fileBaseName(file.name);
        const guessedType = guessStepType(file.name, idx, total);
        const id = crypto.randomUUID();
        return {
          id,
          stepType: guessedType,
          title: baseName || STEP_TYPE_LABELS[guessedType],
          note: '',
          file,
          previewUrl: getPreviewUrl(id, file),
          hashState: 'idle' as const,
        };
      });

      setSteps((cur) => {
        const copy = [...cur];
        copy.splice(insertAt, 0, ...newSteps);
        return copy;
      });

      // Kick off hashing for each new step
      newSteps.forEach((s) => {
        if (s.file) computeHash(s.id, s.file);
      });
    },
    [steps, getPreviewUrl, computeHash],
  );

  /* ── convenience: append to end ── */
  const addFilesAsSteps = useCallback(
    (files: FileList | File[]) => addFilesAtIndex(files, steps.length),
    [addFilesAtIndex, steps.length],
  );

  /* ── step mutations ── */
  function updateStep(id: string, patch: Partial<WorkspaceStep>) {
    setSteps((cur) => cur.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeStep(id: string) {
    // Revoke cached URL
    const cache = urlCacheRef.current;
    const url = cache.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      cache.delete(id);
    }
    setSteps((cur) => cur.filter((s) => s.id !== id));
  }

  /* ── global drag/drop on the workspace section ── */
  const onGlobalDragOver = useCallback((e: React.DragEvent) => {
    // 内部のカード並び替え（D&D）時は、画面全体を光らせる処理をキャンセルする
    if (!e.dataTransfer.types.includes('Files')) return;

    e.preventDefault();
    e.stopPropagation();
    setGlobalDragOver(true);
  }, []);

  const onGlobalDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only leave if we're leaving the entire container
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX <= rect.left || e.clientX >= rect.right || e.clientY <= rect.top || e.clientY >= rect.bottom) {
      setGlobalDragOver(false);
      setInsertSlotIndex(-1);
    }
  }, []);

  const onGlobalDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setGlobalDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        const idx = insertSlotIndex >= 0 ? insertSlotIndex : steps.length;
        addFilesAtIndex(e.dataTransfer.files, idx);
      }
      setInsertSlotIndex(-1);
    },
    [insertSlotIndex, steps.length, addFilesAtIndex],
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

  /* ── submit (preserved contract) ── */
  async function submit() {
    if (!certificate) return;
    // Include root steps (they have sha256 but no file) and normal steps
    const prepared = steps.filter((step) => {
      if (step.isRoot) return !!step.sha256 && step.title.trim();
      return !!step.file && step.title.trim();
    });

    setSubmitting(true);
    setMessage(null);
    setResult(null);

    try {
      const response = await createProcessBundle({
        certificateId: certificate.id,
        title,
        description,
        isPublic,
        steps: prepared,
      });
      setResult({
        chainDepth: response.chainDepth,
        chainHeadSha256: response.chainHeadSha256,
        certificateId: response.certificateId,
      });
      setMessage('Chain of Evidence を保存しました。3秒後に証明書ページへリダイレクトします...');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Chain of Evidence の保存に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  /* ── auto-redirect on success ── */
  useEffect(() => {
    if (result?.certificateId) {
      const timer = setTimeout(() => {
        setLocation(`/cert/${result.certificateId}`);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [result?.certificateId, setLocation]);

  /* ── cleanup object urls on unmount ── */
  useEffect(() => {
    return () => {
      urlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      urlCacheRef.current.clear();
    };
  }, []);

  /* ═══════════════════════════════════════════════════════════
     RENDER: SUCCESS
     ═══════════════════════════════════════════════════════════ */
  if (result) {
    return (
      <section className="w-full bg-[#0D0B24] border border-[#1C1A38] rounded-3xl p-6 md:p-10 shadow-[0_0_50px_rgba(108,62,244,0.08)]">
        <div className="flex flex-col items-center text-center gap-6 py-8">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-[#00D4AA]/20" />
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#00D4AA] to-[#00D4AA]/60 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-[#07061A]" />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white">Chain of Evidence 構築完了</h2>
            <p className="mt-2 text-sm text-[#A8A0D8]">
              {result.chainDepth}工程が暗号的に連結されました
            </p>
          </div>

          <div className="flex items-center gap-1.5 py-3">
            {Array.from({ length: result.chainDepth }).map((_, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6C3EF4] to-[#8B61FF] flex items-center justify-center text-xs font-black text-white shadow-[0_0_12px_rgba(108,62,244,0.4)]">
                  {i + 1}
                </div>
                {i < result.chainDepth - 1 && (
                  <div className="w-6 h-0.5 bg-gradient-to-r from-[#6C3EF4] to-[#00D4AA]" />
                )}
              </div>
            ))}
          </div>

          <code className="text-xs text-[#A8A0D8]/60 bg-[#07061A] border border-[#1C1A38] rounded-xl px-4 py-2 max-w-full overflow-x-auto">
            HEAD: {result.chainHeadSha256 ?? '—'}
          </code>

          <button
            onClick={() => setLocation(`/cert/${result.certificateId}`)}
            className="mt-2 flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-bold text-[#07061A] bg-gradient-to-r from-[#00D4AA] to-[#00D4AA]/80 rounded-2xl hover:shadow-[0_0_30px_rgba(0,212,170,0.4)] transition-all"
          >
            <Sparkles className="w-4 h-4" />
            証明書を見る
          </button>

          <p className="text-xs text-[#A8A0D8]/50 animate-pulse">3秒後に自動遷移します...</p>
        </div>
      </section>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER: NO CERTIFICATE
     ═══════════════════════════════════════════════════════════ */
  if (!certificate) {
    return (
      <section className="w-full bg-[#0D0B24] border border-[#1C1A38] rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(108,62,244,0.08)]">
        <div className="rounded-2xl border border-[#1C1A38] bg-[#07061A] p-5 text-sm text-[#A8A0D8]">
          まず先に証明書を1件発行すると、この作品に Chain of Evidence を接続できます。
        </div>
      </section>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER: LIVING TIMELINE WORKSPACE
     ═══════════════════════════════════════════════════════════ */
  return (
    <section
      className="w-full bg-[#0D0B24] border border-[#1C1A38] rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(108,62,244,0.08)] transition-all"
      onDragOver={onGlobalDragOver}
      onDragLeave={onGlobalDragLeave}
      onDrop={onGlobalDrop}
    >
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.28em] text-[#A8A0D8]">Chain of Evidence Studio</div>
        <h2 className="mt-2 text-xl md:text-2xl font-black tracking-tight text-white">
          制作プロセスを証拠化する
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#A8A0D8]/70">
          画像をキャンバスにドロップするだけ。1枚からOK — あとから工程を追加できます。
        </p>
      </div>

      {/* ── Loading State (Hydration) ── */}
      {isHydrating && (
        <div className="flex flex-col items-center justify-center py-20 md:py-28 rounded-3xl border border-[#1C1A38] bg-[#07061A]/40 backdrop-blur-sm animate-pulse">
          <Loader2 className="w-8 h-8 text-[#6C3EF4] animate-spin mb-4" />
          <div className="text-sm font-bold text-white tracking-widest uppercase">Restoring Timeline...</div>
          <div className="text-xs text-[#A8A0D8]/60 mt-2">過去の証明データを安全に復元しています</div>
        </div>
      )}

      {/* ── Empty Canvas (hero drop zone) ── */}
      {steps.length === 0 && !isHydrating && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative group cursor-pointer rounded-3xl border-2 border-dashed py-20 md:py-28
            transition-all duration-300 ease-out overflow-hidden
            ${globalDragOver
              ? 'border-[#6C3EF4] bg-[#6C3EF4]/10 shadow-[0_0_60px_rgba(108,62,244,0.2)]'
              : 'border-[#1C1A38] bg-[#07061A]/60 hover:border-[#6C3EF4]/40 hover:bg-[#6C3EF4]/5'
            }
          `}
        >
          {/* Dot pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'radial-gradient(circle, #6C3EF4 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          <div className="relative flex flex-col items-center gap-4 text-center px-4">
            <div
              className={`
                w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300
                ${globalDragOver
                  ? 'bg-[#6C3EF4] shadow-[0_0_40px_rgba(108,62,244,0.6)] scale-110'
                  : 'bg-[#6C3EF4]/10 group-hover:bg-[#6C3EF4]/20'
                }
              `}
            >
              {globalDragOver ? (
                <Upload className="w-8 h-8 text-white animate-bounce" />
              ) : (
                <ImagePlus className="w-8 h-8 text-[#6C3EF4]" />
              )}
            </div>

            <div>
              <div className="text-white font-bold text-lg">制作工程をドロップしてタイムラインを開始</div>
              <p className="mt-1 text-sm text-[#A8A0D8]/60 max-w-md mx-auto">
                1枚（ラフだけ）でもOK。あとから線画・着色・完成を追加できます。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Living Timeline ── */}
      {steps.length > 0 && (
        <div className="mt-2">
          {/* Status bar */}
          <div className="flex items-center justify-between mb-5">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#A8A0D8]">
              Evidence Chain — {readyCount} step{readyCount !== 1 ? 's' : ''}
            </div>
            <div className="flex items-center gap-1.5">
              {steps.map((s) => (
                <div
                  key={s.id}
                  className={`w-2 h-2 rounded-full transition-all duration-500 ${s.hashState === 'verified'
                    ? 'bg-[#00D4AA] shadow-[0_0_6px_rgba(0,212,170,0.5)]'
                    : s.hashState === 'hashing'
                      ? 'bg-[#6C3EF4] animate-pulse'
                      : 'bg-[#1C1A38]'
                    }`}
                />
              ))}
            </div>
          </div>

          {/* Scrollable canvas */}
          <div className="overflow-x-auto pb-6 -mx-2 px-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#1C1A38]">
            <div className="flex items-stretch w-max pr-8">
              {/* Insert slot BEFORE first step */}
              <InsertSlot
                index={0}
                active={insertSlotIndex === 0}
                visible={globalDragOver}
                onHover={setInsertSlotIndex}
              />

              {steps.map((step, index) => (
                <div key={step.id} className="flex items-stretch shrink-0">
                  {/* ── Reorder drop indicator (before card) ── */}
                  {isDraggingCard && reorderOverIndex === index && draggedIndexRef.current !== null && draggedIndexRef.current > index && (
                    <div className="w-1.5 rounded-full bg-[#6C3EF4] shadow-[0_0_12px_rgba(108,62,244,0.5)] mx-0.5 my-4 shrink-0 transition-all" />
                  )}
                  {/* ── Step Card ── */}
                  <StepCard
                    step={step}
                    index={index}
                    totalSteps={steps.length}
                    editingField={editingField}
                    onSetEditing={setEditingField}
                    onUpdate={updateStep}
                    onRemove={removeStep}
                    onMoveStep={(dir) => moveStep(index, dir)}
                    isDraggedOver={reorderOverIndex === index}
                    isDragging={isDraggingCard && draggedIndexRef.current === index}
                    onCardDragStart={(e) => onCardDragStart(e, index)}
                    onCardDragEnter={(e) => onCardDragEnter(e, index)}
                    onCardDragOver={onCardDragOver}
                    onCardDrop={(e) => onCardDrop(e, index)}
                    onCardDragEnd={onCardDragEnd}
                    onReplace={(file) => {
                      const cache = urlCacheRef.current;
                      const old = cache.get(step.id);
                      if (old) URL.revokeObjectURL(old);
                      cache.delete(step.id);
                      const newUrl = getPreviewUrl(step.id, file);
                      updateStep(step.id, {
                        file,
                        previewUrl: newUrl,
                        title: fileBaseName(file.name) || step.title,
                        hashState: 'idle',
                      });
                      computeHash(step.id, file);
                    }}
                  />
                  {/* ── Reorder drop indicator (after card) ── */}
                  {isDraggingCard && reorderOverIndex === index && draggedIndexRef.current !== null && draggedIndexRef.current < index && (
                    <div className="w-1.5 rounded-full bg-[#6C3EF4] shadow-[0_0_12px_rgba(108,62,244,0.5)] mx-0.5 my-4 shrink-0 transition-all" />
                  )}

                  {/* Chain connector + insert slot AFTER this step */}
                  {index < steps.length - 1 && (
                    <div className="relative flex items-center shrink-0">
                      <ChainConnector verified={step.hashState === 'verified' && steps[index + 1]?.hashState === 'verified'} />
                      <InsertSlot
                        index={index + 1}
                        active={insertSlotIndex === index + 1}
                        visible={globalDragOver}
                        onHover={setInsertSlotIndex}
                      />
                    </div>
                  )}

                  {/* After last step: connector to add button */}
                  {index === steps.length - 1 && (
                    <div className="relative flex items-center shrink-0">
                      <ChainConnectorGhost />
                      <InsertSlot
                        index={steps.length}
                        active={insertSlotIndex === steps.length}
                        visible={globalDragOver}
                        onHover={setInsertSlotIndex}
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Ghost add card */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-[190px] md:w-[210px] rounded-2xl border-2 border-dashed border-[#1C1A38] hover:border-[#6C3EF4]/30 bg-transparent hover:bg-[#6C3EF4]/5 flex flex-col items-center justify-center gap-2 py-14 transition-all group/add shrink-0"
              >
                <div className="w-10 h-10 rounded-xl bg-[#6C3EF4]/10 group-hover/add:bg-[#6C3EF4]/20 flex items-center justify-center transition-colors">
                  <ImagePlus className="w-5 h-5 text-[#6C3EF4]" />
                </div>
                <span className="text-xs font-bold text-[#A8A0D8]/50 group-hover/add:text-[#A8A0D8]">
                  工程を追加
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Global drag overlay ── */}
      {globalDragOver && steps.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-40">
          <div className="absolute inset-0 bg-[#6C3EF4]/5 backdrop-blur-[1px]" />
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={true}
        className="hidden"
        onChange={onFileInputChange}
      />

      {/* ── Meta (collapsible) ── */}
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
                <span className="mb-1.5 block text-[10px] uppercase tracking-widest text-[#A8A0D8]/50 font-bold">
                  Bundle title
                </span>
                <input
                  className="w-full bg-[#07061A] border border-[#1C1A38] text-white text-sm rounded-2xl px-4 py-2.5 focus:outline-none focus:border-[#6C3EF4]/60 placeholder-[#A8A0D8]/40 transition-colors"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] uppercase tracking-widest text-[#A8A0D8]/50 font-bold">
                  Description
                </span>
                <input
                  className="w-full bg-[#07061A] border border-[#1C1A38] text-white text-sm rounded-2xl px-4 py-2.5 focus:outline-none focus:border-[#6C3EF4]/60 placeholder-[#A8A0D8]/40 transition-colors"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-3 text-sm text-[#A8A0D8]/70 cursor-pointer md:col-span-2">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="accent-[#6C3EF4]"
                />
                公開ページに表示する
              </label>
            </div>
          )}
        </div>
      )}

      {/* ── Submit bar ── */}
      {steps.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-[#1C1A38]/50">
          <div className="text-sm text-[#A8A0D8]/50">
            <span className="text-white font-bold">{readyCount}</span> 工程が連結可能
            {!allVerified && (
              <span className="ml-2 text-xs text-[#6C3EF4] animate-pulse">
                <Loader2 className="inline w-3 h-3 animate-spin mr-1" />
                ハッシュ計算中...
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="flex items-center gap-2.5 px-7 py-3 text-sm font-bold text-white bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] rounded-2xl shadow-[0_0_24px_rgba(108,62,244,0.35)] hover:shadow-[0_0_40px_rgba(108,62,244,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:scale-100"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Layers3 className="h-4 w-4" />
            )}
            Chain of Evidence を保存
          </button>
        </div>
      )}

      {/* ── Message ── */}
      {message && !result && (
        <div className="mt-4 text-sm text-[#A8A0D8] bg-[#07061A] border border-[#1C1A38] rounded-2xl px-4 py-3">
          {message}
        </div>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

/** Visual drop insertion slot that appears between cards during drag */
function InsertSlot({
  index,
  active,
  visible,
  onHover,
}: {
  index: number;
  active: boolean;
  visible: boolean;
  onHover: (index: number) => void;
}) {
  if (!visible) return null;
  return (
    <div
      className="relative flex items-center justify-center shrink-0 z-30"
      style={{ width: active ? 48 : 16 }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onHover(index);
      }}
      onDragLeave={() => onHover(-1)}
    >
      <div
        className={`
          absolute inset-y-4 rounded-xl transition-all duration-200
          ${active
            ? 'w-12 bg-[#6C3EF4]/20 border-2 border-dashed border-[#6C3EF4] shadow-[0_0_20px_rgba(108,62,244,0.3)]'
            : 'w-1 bg-[#6C3EF4]/30'
          }
        `}
        style={{ left: '50%', transform: 'translateX(-50%)' }}
      />
      {active && (
        <div className="absolute z-10 bg-[#6C3EF4] text-white text-[9px] font-black px-1.5 py-0.5 rounded-md whitespace-nowrap">
          ここに挿入
        </div>
      )}
    </div>
  );
}

/** The verified chain connector between two steps */
function ChainConnector({ verified }: { verified: boolean }) {
  return (
    <div className="flex items-center justify-center w-8 md:w-10 shrink-0">
      <div className="flex flex-col items-center gap-0.5">
        <div
          className={`w-0.5 h-2.5 transition-colors duration-700 ${verified ? 'bg-gradient-to-b from-transparent to-[#00D4AA]' : 'bg-gradient-to-b from-transparent to-[#6C3EF4]/40'
            }`}
        />
        <div
          className={`
            w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-700
            ${verified
              ? 'border-[#00D4AA]/60 bg-[#00D4AA]/15 shadow-[0_0_10px_rgba(0,212,170,0.3)]'
              : 'border-[#6C3EF4]/30 bg-[#6C3EF4]/10'
            }
          `}
        >
          {verified ? (
            <Lock className="w-2.5 h-2.5 text-[#00D4AA]" />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-[#6C3EF4] animate-pulse" />
          )}
        </div>
        <div
          className={`w-0.5 h-2.5 transition-colors duration-700 ${verified ? 'bg-gradient-to-b from-[#00D4AA] to-transparent' : 'bg-gradient-to-b from-[#6C3EF4]/40 to-transparent'
            }`}
        />
      </div>
    </div>
  );
}

/** Ghost connector before the add button */
function ChainConnectorGhost() {
  return (
    <div className="flex items-center justify-center w-8 md:w-10 shrink-0">
      <div className="flex flex-col items-center gap-0.5">
        <div className="w-0.5 h-2.5 bg-gradient-to-b from-transparent to-[#1C1A38]" />
        <div className="w-5 h-5 rounded-full border border-dashed border-[#1C1A38] flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-[#1C1A38]" />
        </div>
        <div className="w-0.5 h-2.5 bg-gradient-to-b from-[#1C1A38] to-transparent" />
      </div>
    </div>
  );
}

/** Individual step card with inline editing, hash state, and drag-to-reorder */
function StepCard({
  step,
  index,
  totalSteps,
  editingField,
  onSetEditing,
  onUpdate,
  onRemove,
  onReplace,
  onMoveStep,
  isDraggedOver,
  isDragging,
  onCardDragStart,
  onCardDragEnter,
  onCardDragOver,
  onCardDrop,
  onCardDragEnd,
}: {
  step: WorkspaceStep;
  index: number;
  totalSteps: number;
  editingField: { stepId: string; field: 'title' | 'note' | 'type' } | null;
  onSetEditing: (v: { stepId: string; field: 'title' | 'note' | 'type' } | null) => void;
  onUpdate: (id: string, patch: Partial<WorkspaceStep>) => void;
  onRemove: (id: string) => void;
  onReplace: (file: File) => void;
  onMoveStep: (direction: -1 | 1) => void;
  isDraggedOver: boolean;
  isDragging: boolean;
  onCardDragStart: (e: React.DragEvent) => void;
  onCardDragEnter: (e: React.DragEvent) => void;
  onCardDragOver: (e: React.DragEvent) => void;
  onCardDrop: (e: React.DragEvent) => void;
  onCardDragEnd: (e: React.DragEvent) => void;
}) {
  const isEditingTitle = editingField?.stepId === step.id && editingField?.field === 'title';
  const isEditingNote = editingField?.stepId === step.id && editingField?.field === 'note';
  
  // Smart Auto-Labeling dynamically based on array index
  const isOrigin = index === 0;
  const isFinal = index === totalSteps - 1;

  const badgeText = isOrigin 
    ? '🎨 起点 (Origin)' 
    : isFinal 
      ? '✨ 完成 (Final)' 
      : '📝 途中工程';

  const badgeColor = isOrigin 
    ? '#F59E0B' 
    : isFinal 
      ? '#00D4AA' 
      : '#818CF8';

  const badgeBg = isOrigin 
    ? 'rgba(245, 158, 11, 0.12)' 
    : isFinal 
      ? 'rgba(0, 212, 170, 0.12)' 
      : 'rgba(129, 140, 248, 0.12)';

  const badgeBorder = isOrigin 
    ? '1px solid rgba(245, 158, 11, 0.3)' 
    : isFinal 
      ? '1px solid rgba(0, 212, 170, 0.3)' 
      : '1px solid rgba(129, 140, 248, 0.3)';

  return (
    <motion.div
      layout
      draggable
      onDragStart={onCardDragStart}
      onDragEnter={onCardDragEnter}
      onDragOver={onCardDragOver}
      onDrop={onCardDrop}
      onDragEnd={onCardDragEnd}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={`
        relative w-[190px] md:w-[210px] rounded-2xl border transition-[border-color,opacity,box-shadow] duration-300 shrink-0 group/card
        ${isDragging ? 'opacity-40 scale-95 ring-2 ring-[#6C3EF4]/50' : ''}
        ${step.hashState === 'hashing'
          ? 'border-[#6C3EF4]/50 shadow-[0_0_25px_rgba(108,62,244,0.15)]'
          : step.hashState === 'verified'
            ? 'border-[#00D4AA]/20 hover:border-[#00D4AA]/40'
            : 'border-[#1C1A38] hover:border-[#6C3EF4]/30'
        }
        bg-[#07061A]
      `}
    >
      {/* ── Grip handle for reordering ── */}
      <div className="absolute top-1/2 -translate-y-1/2 -left-0 z-20 flex items-center justify-center w-5 h-10 rounded-r-lg bg-[#07061A]/90 border border-l-0 border-[#1C1A38] opacity-0 hover:opacity-100 group-hover/thumb:opacity-60 cursor-grab active:cursor-grabbing transition-opacity">
        <GripVertical className="w-3 h-3 text-[#A8A0D8]/60" />
      </div>
      {/* ── Thumbnail area ── */}
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
            <label className="cursor-pointer flex flex-col items-center gap-2 text-[#A8A0D8]/40 hover:text-[#6C3EF4] transition-colors">
              <ImagePlus className="w-8 h-8" />
              <span className="text-xs font-medium">画像を選択</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onReplace(f);
                }}
              />
            </label>
          </div>
        )}

        {/* Hash state overlay */}
        {step.hashState === 'hashing' && (
          <div className="absolute inset-0 bg-[#07061A]/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
            {/* Pulsing ring */}
            <div className="relative">
              <div className="absolute inset-0 w-10 h-10 rounded-full border-2 border-[#6C3EF4] animate-ping opacity-30" />
              <div className="w-10 h-10 rounded-full border-2 border-t-[#6C3EF4] border-r-[#6C3EF4]/30 border-b-[#6C3EF4]/10 border-l-[#6C3EF4]/60 animate-spin" />
            </div>
            <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-[#6C3EF4] uppercase">
              Verifying…
            </span>
          </div>
        )}

        {/* Verified flash overlay (shows briefly via CSS animation) */}
        {step.hashState === 'verified' && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#6C3EF4] via-[#00D4AA] to-[#6C3EF4] opacity-60" />
        )}

        <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
          <div className="w-6 h-6 rounded-lg bg-[#07061A]/80 backdrop-blur-sm flex items-center justify-center border border-[#1C1A38]">
            <span className="text-[10px] font-black text-white">{index + 1}</span>
          </div>
          {step.isRoot && (
            <div className="px-1.5 py-0.5 rounded-lg bg-[#00D4AA]/20 backdrop-blur-sm border border-[#00D4AA]/30 flex items-center gap-1">
              <Shield className="w-2.5 h-2.5 text-[#00D4AA]" />
              <span className="text-[8px] font-black text-[#00D4AA] uppercase tracking-wider">Root</span>
            </div>
          )}
        </div>

        {/* Dynamic Context Badge — Smart Auto-Labeling with AnimatePresence */}
        <div className="absolute top-2 right-2 z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={badgeText}
              initial={{ opacity: 0, scale: 0.8, y: -2 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold backdrop-blur-sm shadow-md whitespace-nowrap"
              style={{
                color: badgeColor,
                backgroundColor: badgeBg,
                border: badgeBorder,
              }}
            >
              {badgeText}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Delete button — hidden for root steps */}
        {totalSteps > 1 && !step.isRoot && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(step.id);
            }}
            className="absolute bottom-2 right-2 w-7 h-7 rounded-lg bg-[#07061A]/80 backdrop-blur-sm border border-[#1C1A38] flex items-center justify-center text-[#A8A0D8]/50 hover:text-[#FF4D4D] hover:border-[#FF4D4D]/30 transition-colors opacity-0 group-hover/thumb:opacity-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Replace image button — hidden for root steps */}
        {step.previewUrl && !step.isRoot && (
          <label className="absolute bottom-2 left-2 w-7 h-7 rounded-lg bg-[#07061A]/80 backdrop-blur-sm border border-[#1C1A38] flex items-center justify-center text-[#A8A0D8]/50 hover:text-[#6C3EF4] hover:border-[#6C3EF4]/30 transition-colors opacity-0 group-hover/thumb:opacity-100 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onReplace(f);
              }}
            />
          </label>
        )}
      </div>

      {/* Type selector dropdown is removed since context badges are dynamic */}

      {/* ── Info row: inline editable title ── */}
      <div className="px-3 py-2.5">
        {isEditingTitle ? (
          <input
            autoFocus
            className="w-full bg-transparent border-b border-[#6C3EF4]/60 text-xs font-bold text-white pb-0.5 focus:outline-none"
            value={step.title}
            onChange={(e) => onUpdate(step.id, { title: e.target.value })}
            onBlur={() => onSetEditing(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSetEditing(null);
            }}
          />
        ) : (
          <p
            className="text-xs font-bold text-white truncate cursor-text hover:text-[#00D4AA] transition-colors"
            onClick={() => onSetEditing({ stepId: step.id, field: 'title' })}
            title="クリックして編集"
          >
            {step.title}
          </p>
        )}

        {/* Note (inline edit on click) */}
        {isEditingNote ? (
          <textarea
            autoFocus
            className="w-full mt-1 bg-transparent border-b border-[#6C3EF4]/60 text-[10px] text-[#A8A0D8] pb-0.5 focus:outline-none resize-none min-h-[32px]"
            value={step.note ?? ''}
            onChange={(e) => onUpdate(step.id, { note: e.target.value })}
            onBlur={() => onSetEditing(null)}
            placeholder="メモを追加..."
          />
        ) : (
          <p
            className="mt-0.5 text-[10px] text-[#A8A0D8]/40 truncate cursor-text hover:text-[#A8A0D8]/70 transition-colors"
            onClick={() => onSetEditing({ stepId: step.id, field: 'note' })}
          >
            {step.note || 'メモを追加...'}
          </p>
        )}

        {/* Hash micro-badge */}
        {step.hashState === 'verified' && step.sha256 && (
          <div className="mt-1.5 flex items-center gap-1">
            <Lock className="w-2.5 h-2.5 text-[#00D4AA]" />
            <span className="text-[8px] font-mono text-[#00D4AA]/60 tracking-wider">
              {step.sha256.slice(0, 8)}…{step.sha256.slice(-6)}
            </span>
          </div>
        )}

        {/* ── Click-based move buttons (visible on hover, hidden for single card) ── */}
        {totalSteps > 1 && (
          <div className="mt-2 flex items-center gap-1 opacity-40 group-hover/card:opacity-100 transition-opacity duration-200">
            <button
              type="button"
              disabled={index === 0}
              onClick={(e) => { e.stopPropagation(); onMoveStep(-1); }}
              className="flex items-center justify-center w-6 h-6 rounded-md bg-[#1C1A38] hover:bg-[#6C3EF4]/20 border border-[#1C1A38] hover:border-[#6C3EF4]/40 text-[#A8A0D8]/50 hover:text-[#A8A0D8] disabled:opacity-20 disabled:cursor-not-allowed transition-all"
              title="前へ移動"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button
              type="button"
              disabled={index === totalSteps - 1}
              onClick={(e) => { e.stopPropagation(); onMoveStep(1); }}
              className="flex items-center justify-center w-6 h-6 rounded-md bg-[#1C1A38] hover:bg-[#6C3EF4]/20 border border-[#1C1A38] hover:border-[#6C3EF4]/40 text-[#A8A0D8]/50 hover:text-[#A8A0D8] disabled:opacity-20 disabled:cursor-not-allowed transition-all"
              title="後へ移動"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
