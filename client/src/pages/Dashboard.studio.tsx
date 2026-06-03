/**
 * Dashboard.studio.tsx — God Mode (PLG-grade Visual Console)
 *
 * 5つの絶対アーキテクチャ防衛線:
 *   1. Visual DNA Sync — deriveGenerativeArt / HashFingerprint / BreathingBadge を移植
 *   2. Bento Grid + Egress Defense — getOptimizedImageUrl + lazy/async decode
 *   3. The Inspector + Deep Link — chainCert modal を廃止し、右側ドロワー + URL同期
 *   4. Process Builder Trial Value — ProcessBundleComposer をそのままマウント + 美しいペイウォール
 *   5. Silent Processing — Pending を breathing ring に置換、10秒超で warning へ
 *
 * 既存ロジック (Supabase / SlimUploadDock / ProjectRail / useStudioOps) は1mmも変更しない。
 */

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'wouter';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  Archive,
  ArchiveRestore,
  ArrowUpDown,
  BadgeCheck,
  Check,
  CheckSquare2,
  Clock3,
  Copy,
  ExternalLink,
  FileDown,
  FolderKanban,
  Hash,
  History,
  Info,
  LayoutGrid,
  Link as LinkIcon,
  Loader2,
  Lock,
  Plus,
  Rows3,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  Star,
  Tag,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { useStudioOps } from '../hooks/useStudioOps';
import { supabase } from '../lib/supabase';
import {
  DELIVERY_STATUS_TOKENS,
  type DeliveryStatus,
  compareByAttention,
} from '../lib/proofmark-ops';
import type { CertificateRecord } from '../lib/proofmark-types';

import { ProjectRail, type ProjectChipModel } from '../components/projects/ProjectRail';
import { ProjectComposer } from '../components/projects/ProjectComposer';
import { AttentionTray } from '../components/ops/AttentionTray';
import { StatusMenu } from '../components/ops/StatusMenu';
import { AuditDrawer } from '../components/ops/AuditDrawer';
import { SlimUploadDock } from '../components/dashboard/SlimUploadDock';
import VisibilityToggle from '../components/VisibilityToggle';
import { executeEvidencePackDownload } from '../components/EvidencePackDownloadButton';

// Chain of Evidence builder (Inspector 内に常設マウント)
const ProcessBundleComposer = lazy(() =>
  import('../components/proof/ProcessBundleComposer').then((m) => ({
    default: m.ProcessBundleComposer,
  })),
);

/* ══════════════════════════════════════════════════════════════
 *  GOD MODE PORT — PublicProfile.tsx の Visual DNA を移植
 *    - PM_EASE
 *    - deriveGenerativeArt(hash)
 *    - HashFingerprint  (mix-blend-mode 廃止 / opacity 0.15 のフラット合成)
 *    - BreathingBadge   (reduce-motion対応, mini/normal/large)
 *  これらは PublicProfile と完全に同じ DNA を共有する。
 * ══════════════════════════════════════════════════════════════ */

const PM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const ACCENT = {
  teal: { hex: '#00D4AA', rgb: '0,212,170' },
  purple: { hex: '#6C3EF4', rgb: '108,62,244' },
  gold: { hex: '#F0BB38', rgb: '240,187,56' },
} as const;

interface GenerativeArt {
  background: string;
  overlay: string;
  hueA: number;
  hueB: number;
  hueC: number;
}

function deriveGenerativeArt(hash: string): GenerativeArt {
  const seed = (hash || 'proofmark').padEnd(64, '0');
  const codeAt = (i: number) => seed.charCodeAt(i % seed.length);

  const hueA = codeAt(2) % 360;
  const hueB = (codeAt(11) + codeAt(17)) % 360;
  const hueC = (codeAt(23) * 7) % 360;

  const xA = 10 + (codeAt(5) % 70);
  const yA = 10 + (codeAt(7) % 70);
  const xB = 10 + (codeAt(13) % 70);
  const yB = 10 + (codeAt(19) % 70);
  const xC = 10 + (codeAt(29) % 80);
  const yC = 10 + (codeAt(31) % 80);

  const conicAngle = codeAt(3) % 360;
  const stripeAngle = codeAt(37) % 180;
  const stripeGap = 6 + (codeAt(41) % 10);

  const satA = 70 + (codeAt(9) % 20);
  const satB = 60 + (codeAt(15) % 25);
  const lightA = 45 + (codeAt(21) % 15);
  const lightB = 35 + (codeAt(27) % 15);

  const background = `
    radial-gradient(ellipse 80% 60% at ${xA}% ${yA}%, hsl(${hueA}, ${satA}%, ${lightA}%) 0%, transparent 55%),
    radial-gradient(ellipse 65% 55% at ${xB}% ${yB}%, hsl(${hueB}, ${satB}%, ${lightB}%) 0%, transparent 55%),
    radial-gradient(circle at ${xC}% ${yC}%, hsl(${hueC}, 80%, 50%) 0%, transparent 45%),
    conic-gradient(from ${conicAngle}deg at 50% 50%,
      hsl(${hueA}, 60%, 12%) 0deg,
      hsl(${hueB}, 70%, 20%) 120deg,
      hsl(${hueC}, 70%, 16%) 240deg,
      hsl(${hueA}, 60%, 12%) 360deg)
  `;

  const overlay = `repeating-linear-gradient(${stripeAngle}deg,
    rgba(255,255,255,0.05) 0px,
    rgba(255,255,255,0.05) 1px,
    transparent 1px,
    transparent ${stripeGap}px)`;

  return { background, overlay, hueA, hueB, hueC };
}

function HashFingerprint({
  hash,
  className = '',
  showLabel = true,
}: {
  hash: string;
  className?: string;
  showLabel?: boolean;
}) {
  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-[#0D0B24] ${className}`}
      style={{
        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 1px, transparent 1px), radial-gradient(circle at 50% 30%, rgba(108,62,244,0.15) 0%, transparent 60%)',
        backgroundSize: '8px 8px, 100% 100%',
      }}
    >
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(168,160,216,0.15)',
              boxShadow: '0 0 20px rgba(0,0,0,0.5)',
            }}
          >
            <Lock className="h-5 w-5 text-[#A8A0D8]" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <p className="text-xs text-[#A8A0D8]/70 tracking-[0.25em] font-mono uppercase">
              CONFIDENTIAL PROOF
            </p>
            <p className="mt-1 font-mono text-[10px] text-white/30 tracking-[0.2em]">
              {hash ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : '—'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function BreathingBadge({
  reduce,
  size = 'normal',
  tone = 'teal',
  label,
  icon,
  sublabel,
}: {
  reduce: boolean;
  size?: 'mini' | 'normal' | 'large';
  tone?: 'teal' | 'gold' | 'purple';
  label: string;
  icon?: ReactNode;
  sublabel?: string;
}) {
  const accent = ACCENT[tone];
  const Icon = icon ?? <ShieldCheck className="h-3 w-3" />;

  if (size === 'mini') {
    return (
      <motion.span
        animate={
          reduce
            ? undefined
            : {
                boxShadow: [
                  `0 0 0 0 rgba(${accent.rgb}, 0.55)`,
                  `0 0 0 6px rgba(${accent.rgb}, 0)`,
                  `0 0 0 0 rgba(${accent.rgb}, 0.55)`,
                ],
              }
        }
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-mono uppercase tracking-[0.2em] whitespace-nowrap"
        style={{
          background: `rgba(${accent.rgb}, 0.14)`,
          border: `1px solid rgba(${accent.rgb}, 0.5)`,
          color: accent.hex,
        }}
      >
        {Icon}
        {label}
      </motion.span>
    );
  }

  if (size === 'large') {
    return (
      <motion.div
        className="relative inline-flex items-center gap-2 rounded-full pl-2 pr-3.5 py-1.5"
        style={{
          background: 'rgba(7,6,26,0.78)',
          border: `1px solid rgba(${accent.rgb}, 0.55)`,
          backdropFilter: 'blur(10px)',
        }}
        animate={
          reduce
            ? undefined
            : {
                boxShadow: [
                  `0 4px 18px rgba(0,0,0,0.35), 0 0 0 0 rgba(${accent.rgb}, 0.55)`,
                  `0 4px 18px rgba(0,0,0,0.35), 0 0 0 8px rgba(${accent.rgb}, 0)`,
                  `0 4px 18px rgba(0,0,0,0.35), 0 0 0 0 rgba(${accent.rgb}, 0.55)`,
                ],
              }
        }
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.span
          className="flex h-5 w-5 items-center justify-center rounded-full"
          style={{
            background: accent.hex,
            boxShadow: `0 0 10px rgba(${accent.rgb}, 0.7)`,
          }}
          animate={reduce ? undefined : { opacity: [1, 0.78, 1] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Check
            className="h-3 w-3"
            color={tone === 'gold' ? '#07061A' : '#FFFFFF'}
            strokeWidth={4}
          />
        </motion.span>
        <span
          className="text-[10.5px] font-mono uppercase tracking-[0.24em]"
          style={{ color: '#FFFFFF' }}
        >
          {label}
          {sublabel && (
            <span className="opacity-65 font-normal normal-case ml-1.5">· {sublabel}</span>
          )}
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="relative inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-2.5 py-1 whitespace-nowrap"
      style={{
        background: `rgba(${accent.rgb}, 0.10)`,
        border: `1px solid rgba(${accent.rgb}, 0.45)`,
        color: accent.hex,
        backdropFilter: 'blur(8px)',
      }}
      animate={
        reduce
          ? undefined
          : {
              boxShadow: [
                `0 0 0 0 rgba(${accent.rgb}, 0.45)`,
                `0 0 0 6px rgba(${accent.rgb}, 0)`,
                `0 0 0 0 rgba(${accent.rgb}, 0.45)`,
              ],
            }
      }
      transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.span
        className="flex items-center justify-center"
        style={{ color: accent.hex }}
        animate={reduce ? undefined : { opacity: [1, 0.78, 1] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        {Icon}
      </motion.span>
      <span
        className="text-[10px] font-mono uppercase tracking-[0.22em]"
        style={{ color: accent.hex }}
      >
        {label}
        {sublabel && (
          <span className="opacity-65 font-normal normal-case ml-1">· {sublabel}</span>
        )}
      </span>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
 *  Egress Defense — 画像URL最適化ヘルパー
 *    Supabase Storage Image Transformation を尊重しつつ、
 *    既にクエリがある場合は破壊しない。
 * ══════════════════════════════════════════════════════════════ */

/**
 * Supabase Image Transform を利用して超軽量サムネイルを返す。
 *
 * Supabase Storage の Public URL に対して以下のクエリパラメータを付与:
 *   width   — リサイズ幅 (px)
 *   quality — JPEG/WebP 品質 (1-100)
 *   format  — 出力フォーマット ('webp' | 'jpeg' | 'origin')
 *
 * Supabase 以外のドメイン（CDN等）はそのまま返す（変換不要）。
 * 既にパラメータが付いている URL は再付与しない（冪等）。
 *
 * @see https://supabase.com/docs/guides/storage/serving/image-transformations
 */
function getOptimizedImageUrl(
  url: string | null | undefined,
  opts: { width?: number; quality?: number; format?: string } = {},
): string {
  if (!url) return '';

  // Supabase Storage URL かどうかを判定
  // 形式: https://<project>.supabase.co/storage/v1/object/public/...
  const isSupabaseStorage =
    url.includes('.supabase.co/storage/') ||
    url.includes('.supabase.in/storage/');

  if (!isSupabaseStorage) return url;

  // 既に transform パラメータが付いている場合は再付与しない
  if (url.includes('width=') || url.includes('format=')) return url;

  const params = new URLSearchParams();
  if (opts.width)   params.set('width',   String(opts.width));
  if (opts.quality) params.set('quality', String(opts.quality));
  params.set('format', opts.format ?? 'webp');

  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${params.toString()}`;
}


/* ══════════════════════════════════════════════════════════════
 *  Types
 * ══════════════════════════════════════════════════════════════ */

type TrustTier = 'beta' | 'trusted' | 'cross' | 'pending';

interface CertRow {
  id: string;
  user_id: string;
  title?: string | null;
  is_starred?: boolean | null;
  file_name?: string | null;
  file_hash?: string | null;
  sha256?: string | null;
  thumbnail_url?: string | null;
  public_image_url?: string | null;
  proof_mode?: string | null;
  visibility?: string | null;
  created_at: string;
  certified_at?: string | null;
  tsa_provider?: string | null;
  timestamp_token?: string | null;
  cross_anchors?: Array<{ provider: string; certified_at: string }> | null;
  is_archived?: boolean | null;
  client_project?: string | null;
  project_id?: string | null;
  delivery_status?: DeliveryStatus | null;
  team_id?: string | null;
  original_filename?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface TrustDescriptor {
  tier: TrustTier;
  label: string;
  sublabel: string;
  color: string;
  border: string;
  bg: string;
  icon: typeof ShieldCheck;
  description: string;
}

const TRUSTED_PROVIDERS: ReadonlySet<string> = new Set([
  'digicert',
  'globalsign',
  'seiko',
  'sectigo',
]);
const ALL_PROJECTS_ID = '__all__';
const UNASSIGNED_ID = '__unassigned__';

/* ペイウォール閾値 (10秒) */
const PENDING_WARN_THRESHOLD_MS = 20_000;

function deriveTrustTier(c: CertRow): TrustDescriptor {
  const provider = (c.tsa_provider || '').toLowerCase();
  const hasToken = Boolean(c.timestamp_token && c.certified_at);
  const anchors = c.cross_anchors?.length ?? 0;

  if (!hasToken) {
    return {
      tier: 'pending',
      label: 'Pending',
      sublabel: 'TSA発行待ち',
      color: '#A8A0D8',
      border: 'rgba(168,160,216,0.35)',
      bg: 'rgba(168,160,216,0.10)',
      icon: Clock3,
      description: 'タイムスタンプトークン未発行。数秒以内にTSAから署名が返る予定です。',
    };
  }
  if (anchors >= 1) {
    return {
      tier: 'cross',
      label: 'Cross-anchored',
      sublabel: `${anchors + 1} 重TSA`,
      color: '#F0BB38',
      border: 'rgba(240,187,56,0.40)',
      bg: 'rgba(240,187,56,0.12)',
      icon: Sparkles,
      description: '複数のTSAで多重発行された証明。鍵失効耐性あり。',
    };
  }
  if (TRUSTED_PROVIDERS.has(provider)) {
    return {
      tier: 'trusted',
      label: 'Trusted TSA',
      sublabel: provider.toUpperCase(),
      color: '#00D4AA',
      border: 'rgba(0,212,170,0.40)',
      bg: 'rgba(0,212,170,0.12)',
      icon: ShieldCheck,
      description: '主要トラストストアに収録された商用TSAによるRFC3161タイムスタンプ。',
    };
  }
  return {
    tier: 'beta',
    label: 'Beta TSA',
    sublabel: '',
    color: '#9BA3D4',
    border: 'rgba(155,163,212,0.35)',
    bg: 'rgba(155,163,212,0.10)',
    icon: ShieldAlert,
    description: 'β版TSAによる発行。RFC3161として有効ですがSLAなしです。',
  };
}

/* ══════════════════════════════════════════════════════════════
 *  Wrapper
 * ══════════════════════════════════════════════════════════════ */

export default function DashboardStudioWrapper() {
  const { user, loading: authLoading, signOut } = useAuth();
  const ops = useStudioOps();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth?redirect=/dashboard');
  }, [authLoading, user, navigate]);

  if (authLoading || ops.loading) return <MinimalSpinner />;
  if (!user) return null;

  return (
    <StudioCanvas
      user={user}
      signOut={signOut}
      ops={ops}
      isStudio={ops.isStudio}
    />
  );
}

/* ══════════════════════════════════════════════════════════════
 *  Studio Canvas
 * ══════════════════════════════════════════════════════════════ */

interface StudioCanvasProps {
  user: ReturnType<typeof useAuth>['user'];
  signOut: ReturnType<typeof useAuth>['signOut'];
  ops: ReturnType<typeof useStudioOps>;
  isStudio: boolean;
}

function StudioCanvas({ user, signOut, ops, isStudio }: StudioCanvasProps) {
  const reduce = useReducedMotion() ?? false;
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'starred' | 'trust'>('newest');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [activeProjectId, setActiveProjectId] = useState<string>(ALL_PROJECTS_ID);
  const [showArchived, setShowArchived] = useState(false);
  const [trustFilter, setTrustFilter] = useState<TrustTier | 'all'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /* ── Bulk selection ── */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [groupByProject, setGroupByProject] = useState(false);

  /* ── Client Project Dialog (replaces window.prompt) ── */
  const [cpDialog, setCpDialog] = useState<{
    open: boolean;
    cert: CertRow | null;
    initialValue: string;
  } | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [auditCertId, setAuditCertId] = useState<string | null>(null);
  const [auditCertTitle, setAuditCertTitle] = useState<string | null>(null);

  /* ━━━━━━━━━━━━━━━━ The Inspector (deep-link enabled) ━━━━━━━━━━━━━━━━ */
  const [inspectorCertId, setInspectorCertId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'overview' | 'chain'>('overview');

  // ── URL → state (初回マウント & popstate)
  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      const asset = params.get('asset');
      const tab = params.get('tab');
      setInspectorCertId(asset || null);
      if (tab === 'chain' || tab === 'overview') setInspectorTab(tab);
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  // ── state → URL (history push/replace)
  const syncInspectorToUrl = useCallback((id: string | null, tab: 'overview' | 'chain' = 'overview', replace = false) => {
    const params = new URLSearchParams(window.location.search);
    if (id) {
      params.set('asset', id);
      params.set('tab', tab);
    } else {
      params.delete('asset');
      params.delete('tab');
    }
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
    if (replace) {
      window.history.replaceState(null, '', next);
    } else {
      window.history.pushState(null, '', next);
    }
  }, []);

  const openInspector = useCallback(
    (cert: CertRow, tab: 'overview' | 'chain' = 'overview') => {
      setInspectorCertId(cert.id);
      setInspectorTab(tab);
      // 開く時は pushState で履歴に追加（ブラウザバック対応）
      syncInspectorToUrl(cert.id, tab, false);
    },
    [syncInspectorToUrl],
  );

  const closeInspector = useCallback(() => {
    setInspectorCertId(null);
    setInspectorTab('overview');
    // 閉じる時は replace で URL を戻す（あるいは history.back() でも可）
    syncInspectorToUrl(null, 'overview', true);
  }, [syncInspectorToUrl]);

  const setInspectorTabAndUrl = useCallback(
    (tab: 'overview' | 'chain') => {
      setInspectorTab(tab);
      // タブ切替は replace (履歴を汚さない)
      if (inspectorCertId) syncInspectorToUrl(inspectorCertId, tab, true);
    },
    [inspectorCertId, syncInspectorToUrl],
  );

  /* ━━━━━━━━━━━━━━━━ Data fetch ━━━━━━━━━━━━━━━━ */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoadingCerts(true);
      let q = supabase
        .from('certificates')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (!isStudio) q = q.eq('user_id', user.id);
      if (!showArchived) q = q.eq('is_archived', false);

      const { data, error } = await q;
      if (cancelled) return;
      if (error) {
        toast.error('証明書の取得に失敗しました', { description: error.message });
        setCerts([]);
      } else {
        setCerts((data ?? []) as CertRow[]);
      }
      setLoadingCerts(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isStudio, showArchived]);

  const visibleCerts = useMemo(
    () => (showArchived ? certs : certs.filter((c) => !c.is_archived)),
    [certs, showArchived],
  );

  const filteredSortedCerts = useMemo(() => {
    let r = [...visibleCerts];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const projectMap = isStudio
        ? new Map(ops.projects.map((p) => [p.id, p.name.toLowerCase()]))
        : new Map();
      r = r.filter((c) => {
        const projectName =
          isStudio && c.project_id
            ? projectMap.get(c.project_id) || ''
            : (c.client_project || '').toLowerCase();
        return (
          (c.title ?? '').toLowerCase().includes(q) ||
          (c.file_name ?? '').toLowerCase().includes(q) ||
          projectName.includes(q) ||
          (c.sha256 ?? c.file_hash ?? '').toLowerCase().includes(q)
        );
      });
    }

    if (activeProjectId !== ALL_PROJECTS_ID) {
      if (isStudio) {
        r = r.filter((c) => (c.project_id || UNASSIGNED_ID) === activeProjectId);
      } else {
        r = r.filter((c) => {
          const key = c.client_project?.trim() || UNASSIGNED_ID;
          return key === activeProjectId;
        });
      }
    }

    if (trustFilter !== 'all') {
      r = r.filter((c) => deriveTrustTier(c).tier === trustFilter);
    }

    const rank: Record<TrustTier, number> = { cross: 0, trusted: 1, beta: 2, pending: 3 };
    const sorted = r
      .map((c) => ({
        cert: c,
        time: new Date(c.created_at).getTime() || 0,
        trustRank: rank[deriveTrustTier(c).tier],
      }))
      .sort((a, b) => {
        if (sortBy === 'starred') {
          const av = a.cert.is_starred ? 1 : 0;
          const bv = b.cert.is_starred ? 1 : 0;
          if (av !== bv) return bv - av;
        }
        if (sortBy === 'trust') {
          const d = a.trustRank - b.trustRank;
          if (d !== 0) return d;
        }
        if (isStudio) {
          const diff = compareByAttention(a.cert.delivery_status ?? null, b.cert.delivery_status ?? null);
          if (diff !== 0) return diff;
        }
        return b.time - a.time;
      });

    return sorted.map((item) => item.cert);
  }, [visibleCerts, activeProjectId, searchQuery, trustFilter, sortBy, isStudio, ops.projects]);

  const projectChips: ProjectChipModel[] = useMemo(() => {
    const chips = new Map<string, ProjectChipModel>();
    chips.set(ALL_PROJECTS_ID, {
      id: ALL_PROJECTS_ID,
      name: 'すべての案件',
      count: visibleCerts.length,
      synthetic: true,
    });

    if (isStudio) {
      const projectMap = new Map(ops.projects.map((p) => [p.id, p]));
      for (const p of ops.projects) {
        chips.set(p.id, {
          id: p.id,
          name: p.name,
          count: 0,
          color: p.color,
          dueAt: p.due_at,
          needsAttention: 0,
          trustedCount: 0,
        });
      }
      for (const c of visibleCerts) {
        const id = c.project_id || UNASSIGNED_ID;
        const existing =
          chips.get(id) ??
          ({
            id,
            name:
              id === UNASSIGNED_ID
                ? '未分類'
                : projectMap.get(id)?.name ?? c.client_project ?? '未分類',
            count: 0,
            synthetic: id === UNASSIGNED_ID,
            needsAttention: 0,
            trustedCount: 0,
            color: id === UNASSIGNED_ID ? undefined : projectMap.get(id)?.color,
          } as ProjectChipModel);
        existing.count += 1;
        if (c.delivery_status === 'review' || c.delivery_status === 'ready') {
          existing.needsAttention = (existing.needsAttention ?? 0) + 1;
        }
        if (TRUSTED_PROVIDERS.has((c.tsa_provider ?? '').toLowerCase())) {
          existing.trustedCount = (existing.trustedCount ?? 0) + 1;
        }
        chips.set(id, existing);
      }
    } else {
      for (const c of visibleCerts) {
        const key = c.client_project?.trim() || UNASSIGNED_ID;
        const existing =
          chips.get(key) ??
          ({
            id: key,
            name: key === UNASSIGNED_ID ? '未分類' : key,
            count: 0,
            synthetic: key === UNASSIGNED_ID,
            trustedCount: 0,
          } as ProjectChipModel);
        existing.count += 1;
        if (TRUSTED_PROVIDERS.has((c.tsa_provider ?? '').toLowerCase())) {
          existing.trustedCount = (existing.trustedCount ?? 0) + 1;
        }
        chips.set(key, existing);
      }
    }
    return Array.from(chips.values());
  }, [visibleCerts, ops.projects, isStudio]);

  const kpi = useMemo(() => {
    if (loadingCerts) {
      return { total: '-', trusted: '-', beta: '-', pending: '-', review: '-', ready: '-', last: null };
    }
    const tierCount = visibleCerts.reduce(
      (acc, c) => {
        acc[deriveTrustTier(c).tier] += 1;
        return acc;
      },
      { beta: 0, trusted: 0, cross: 0, pending: 0 } as Record<TrustTier, number>,
    );
    const review = visibleCerts.filter((c) => c.delivery_status === 'review').length;
    const ready = visibleCerts.filter((c) => c.delivery_status === 'ready').length;
    const lastIso = visibleCerts[0]?.certified_at ?? visibleCerts[0]?.created_at ?? null;
    return {
      total: visibleCerts.length,
      trusted: tierCount.trusted + tierCount.cross,
      beta: tierCount.beta,
      pending: tierCount.pending,
      review,
      ready,
      last: lastIso,
    };
  }, [visibleCerts, loadingCerts]);

  const attentionItems = useMemo(() => {
    if (!isStudio) return [];
    const projectMap = new Map(ops.projects.map((p) => [p.id, p]));
    return visibleCerts.map((c) => ({
      id: c.id,
      title: c.title ?? c.file_name ?? 'Untitled',
      projectName: c.project_id
        ? projectMap.get(c.project_id)?.name ?? c.client_project ?? '未分類'
        : c.client_project ?? '未分類',
      projectColor: c.project_id ? projectMap.get(c.project_id)?.color ?? null : null,
      deliveryStatus: c.delivery_status ?? null,
      dueAt: c.project_id ? projectMap.get(c.project_id)?.due_at ?? null : null,
      certifiedAt: c.certified_at ?? c.created_at,
    }));
  }, [visibleCerts, ops.projects, isStudio]);

  /* ━━━━━━━━━━━━━━━━ Handlers ━━━━━━━━━━━━━━━━ */
  const handleToggleStar = useCallback(async (certId: string, current: boolean) => {
    setCerts((prev) =>
      prev.map((c) => (c.id === certId ? { ...c, is_starred: !current } : c)),
    );
    const { error } = await supabase
      .from('certificates')
      .update({ is_starred: !current })
      .eq('id', certId);
    if (error) {
      setCerts((prev) =>
        prev.map((c) => (c.id === certId ? { ...c, is_starred: current } : c)),
      );
      toast.error('保護状態を更新できませんでした', { description: error.message });
    }
  }, []);

  const handleArchive = useCallback(async (cert: CertRow, next: boolean) => {
    setCerts((prev) =>
      prev.map((c) => (c.id === cert.id ? { ...c, is_archived: next } : c)),
    );
    const { error } = await supabase
      .from('certificates')
      .update({ is_archived: next })
      .eq('id', cert.id);
    if (error) {
      setCerts((prev) =>
        prev.map((c) => (c.id === cert.id ? { ...c, is_archived: cert.is_archived ?? false } : c)),
      );
      toast.error(next ? 'アーカイブに失敗' : '復元に失敗', { description: error.message });
    } else {
      toast.success(next ? 'アーカイブしました' : 'アーカイブから戻しました');
    }
  }, []);

  const handleCopyLink = useCallback(async (cert: CertRow) => {
    const url = `${window.location.origin}/cert/${cert.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(cert.id);
      toast.success('検証URLをコピーしました', { description: url });
      window.setTimeout(() => setCopiedId((id) => (id === cert.id ? null : id)), 1600);
    } catch {
      toast.error('コピーに失敗しました');
    }
  }, []);

  const handleResync = useCallback(async (certId: string) => {
    try {
      // 1. DBから最新データを引く
      const { data: cert, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('id', certId)
        .single();
      if (error) throw error;
      if (!cert) throw new Error('証明書が見つかりません');

      let updatedCert = cert;

      // タイムスタンプがまだない場合はTSA発行をリトライ
      if (!cert.timestamp_token || !cert.certified_at) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('セッションがありません');

        const fileHash = cert.sha256 || cert.file_hash;
        if (!fileHash) throw new Error('ハッシュが存在しません');

        toast.loading('TSAタイムスタンプを再同期中...', { id: `resync-${certId}` });

        const res = await fetch('/api/timestamp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ certId, hash: fileHash }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || '再同期APIエラー');
        }

        // 成功したら再度DBから最新の状態を取得
        const { data: freshCert, error: freshError } = await supabase
          .from('certificates')
          .select('*')
          .eq('id', certId)
          .single();
        if (freshError) throw freshError;
        if (freshCert) {
          updatedCert = freshCert;
        }
      }

      // parent state を更新
      setCerts((prev) =>
        prev.map((c) => (c.id === certId ? (updatedCert as CertRow) : c)),
      );

      toast.success('再同期が完了しました', { id: `resync-${certId}` });
    } catch (err: any) {
      console.error('[Resync Error]', err);
      toast.error('再同期に失敗しました', {
        id: `resync-${certId}`,
        description: err.message,
      });
    }
  }, []);

  const handleEvidence = useCallback(async (cert: CertRow) => {
    try {
      toast.loading('Evidence Pack を生成しています…', { id: `evidence-${cert.id}` });
      await executeEvidencePackDownload({ certId: cert.id });
    } catch (e) {
      toast.error('Evidence Pack の生成に失敗しました', {
        id: `evidence-${cert.id}`,
        description: e instanceof Error ? e.message : 'ネットワーク接続を確認してください。',
      });
    }
  }, []);

  /* ── Open the custom dialog (replaces window.prompt) ── */
  const handleAssignClientProject = useCallback((cert: CertRow) => {
    setCpDialog({ open: true, cert, initialValue: cert.client_project ?? '' });
  }, []);

  /* ── Dialog confirm: handles both single-cert and bulk mode ── */
  const handleCpDialogConfirm = useCallback(async (value: string | null) => {
    if (!cpDialog) return;
    const { cert } = cpDialog;
    setCpDialog(null);
    const trimmed = value?.trim() || null;

    if (cert) {
      // Single mode
      const original = cert.client_project ?? null;
      setCerts((prev) =>
        prev.map((c) => (c.id === cert.id ? { ...c, client_project: trimmed } : c)),
      );
      const { error } = await supabase
        .from('certificates')
        .update({ client_project: trimmed })
        .eq('id', cert.id);
      if (error) {
        setCerts((prev) =>
          prev.map((c) => (c.id === cert.id ? { ...c, client_project: original } : c)),
        );
        toast.error('案件の紐づけに失敗', { description: error.message });
      } else {
        toast.success(trimmed ? `「${trimmed}」に紐づけました` : '案件の紐づけを解除しました');
      }
    } else {
      // Bulk mode
      const ids = Array.from(selectedIds);
      setCerts((prev) =>
        prev.map((c) => (selectedIds.has(c.id) ? { ...c, client_project: trimmed } : c)),
      );
      const { error } = await supabase
        .from('certificates')
        .update({ client_project: trimmed })
        .in('id', ids);
      if (error) {
        toast.error('一括分類に失敗しました', { description: error.message });
      } else {
        toast.success(trimmed ? `${ids.length}件を「${trimmed}」に分類しました` : `${ids.length}件の案件分類を解除しました`);
      }
      setSelectedIds(new Set());
    }
  }, [cpDialog, selectedIds]);

  /* ── Bulk: star all selected ── */
  const handleBulkStar = useCallback(async () => {
    const ids = Array.from(selectedIds);
    setCerts((prev) => prev.map((c) => (selectedIds.has(c.id) ? { ...c, is_starred: true } : c)));
    const { error } = await supabase.from('certificates').update({ is_starred: true }).in('id', ids);
    if (error) {
      toast.error('一括保護に失敗しました', { description: error.message });
    } else {
      toast.success(`${ids.length}件を保護しました`);
    }
    setSelectedIds(new Set());
  }, [selectedIds]);

  /* ── Bulk: archive all selected ── */
  const handleBulkArchive = useCallback(async () => {
    const ids = Array.from(selectedIds);
    setCerts((prev) => prev.map((c) => (selectedIds.has(c.id) ? { ...c, is_archived: true } : c)));
    const { error } = await supabase.from('certificates').update({ is_archived: true }).in('id', ids);
    if (error) {
      toast.error('一括アーカイブに失敗しました', { description: error.message });
    } else {
      toast.success(`${ids.length}件をアーカイブしました`);
    }
    setSelectedIds(new Set());
  }, [selectedIds]);

  /* ── Toggle single cert selection ── */
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /* ── Select/deselect all visible certs ── */
  const handleSelectAll = useCallback(
    (certs: CertRow[]) => {
      setSelectedIds((prev) => {
        if (prev.size === certs.length && certs.every((c) => prev.has(c.id))) {
          return new Set();
        }
        return new Set(certs.map((c) => c.id));
      });
    },
    [],
  );

  const handleStatusChange = useCallback(
    async (cert: CertRow, next: DeliveryStatus | null) => {
      if (!isStudio) return;
      const before = cert.delivery_status ?? null;
      setCerts((prev) =>
        prev.map((c) => (c.id === cert.id ? { ...c, delivery_status: next ?? null } : c)),
      );
      try {
        await ops.assignCertificate({
          certificate_id: cert.id,
          project_id: cert.project_id ?? null,
          delivery_status: next,
        });
        toast.success(
          next
            ? `ステータスを「${DELIVERY_STATUS_TOKENS[next].label}」に変更しました`
            : 'ステータスをクリアしました',
        );
      } catch (e) {
        setCerts((prev) =>
          prev.map((c) => (c.id === cert.id ? { ...c, delivery_status: before } : c)),
        );
        toast.error('ステータス変更に失敗', {
          description: e instanceof Error ? e.message : '不明なエラー',
        });
      }
    },
    [ops, isStudio],
  );

  const handleCreateProject = useCallback(
    async (input: Parameters<typeof ops.createProject>[0]) => {
      await ops.createProject(input);
      toast.success(`案件「${input.name}」を作成しました`);
    },
    [ops],
  );

  const focusCertById = useCallback((id: string) => {
    const el = document.getElementById(`cert-row-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('pm-focus-pulse');
      window.setTimeout(() => el.classList.remove('pm-focus-pulse'), 1400);
    }
  }, []);

  // 現在の Inspector 対象
  const inspectorCert = useMemo(
    () => (inspectorCertId ? certs.find((c) => c.id === inspectorCertId) ?? null : null),
    [inspectorCertId, certs],
  );

  // PLG 権限フラグ — ops の privileges を尊重し、足りない場合は plan tier で fallback
  const canExportEvidencePack = useMemo<boolean>(() => {
    const priv = (ops as any).userPrivileges as
      | { can_export_evidence_pack?: boolean }
      | undefined;
    if (priv && typeof priv.can_export_evidence_pack === 'boolean') {
      return priv.can_export_evidence_pack;
    }
    const tier = (ops.planTier ?? '').toLowerCase();
    return ['creator', 'studio', 'admin'].includes(tier);
  }, [ops]);

  /* ━━━━━━━━━━━━━━━━ Render ━━━━━━━━━━━━━━━━ */

  return (
    <div
      className="min-h-screen text-white relative"
      style={{
        background:
          'radial-gradient(1200px 600px at 50% -10%, rgba(108,62,244,0.06), transparent 60%), linear-gradient(180deg, #07061A 0%, #0a0a16 100%)',
      }}
    >
      {/* Global ambient aura — God Mode */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <motion.div
          className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-[#6C3EF4] opacity-[0.08] blur-[160px]"
          style={{ willChange: 'opacity' }}
          animate={reduce ? undefined : { opacity: [0.05, 0.11, 0.05] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-40 -right-40 w-[700px] h-[700px] rounded-full bg-[#00D4AA] opacity-[0.08] blur-[160px]"
          style={{ willChange: 'opacity' }}
          animate={reduce ? undefined : { opacity: [0.05, 0.11, 0.05] }}
          transition={{ duration: 9, delay: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <Navbar user={user} signOut={signOut} />

      <main className="relative z-10 max-w-[1240px] mx-auto px-4 sm:px-6 pb-24">
        {/* ───────── Hero ───────── */}
        <section className="pt-8 pb-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: PM_EASE }}
            className="mb-5 flex items-baseline justify-between gap-3"
          >
            <div className="min-w-0">
              <p
                className="text-[10px] font-bold tracking-[0.3em] uppercase"
                style={{ color: 'rgba(255,255,255,0.45)' }}
              >
                {isStudio ? 'Evidence Operations · Studio' : 'Evidence Console'}
              </p>
              <h1
                className="text-[26px] sm:text-[28px] font-black tracking-tight mt-1"
                style={{ fontFamily: '"Poppins", "Inter", sans-serif' }}
              >
                {user?.user_metadata?.username ? `@${user.user_metadata.username}` : 'Dashboard'}
              </h1>
            </div>
            <span className="hidden md:inline text-[11px] text-white/40 font-mono uppercase tracking-[0.2em]">
              {ops.planTier ? `${ops.planTier.toUpperCase()} プラン` : ''}
            </span>
          </motion.div>

          <SlimUploadDock isPaidPlan={isStudio} />
        </section>

        {/* ───────── KPI ───────── */}
        <section
          className="mt-6 grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
        >
          <KPI
            label="管理中の証明"
            value={String(kpi.total)}
            icon={<FolderKanban className="w-4 h-4" />}
          />
          <KPI
            label="Trusted TSA"
            value={String(kpi.trusted)}
            accent="#00D4AA"
            icon={<ShieldCheck className="w-4 h-4" />}
          />
          {isStudio ? (
            <>
              <KPI
                label="要対応"
                value={String(kpi.review)}
                accent="#F0BB38"
                icon={<History className="w-4 h-4" />}
              />
              <KPI
                label="納品準備完了"
                value={String(kpi.ready)}
                accent="#00D4AA"
                icon={<ShieldCheck className="w-4 h-4" />}
              />
            </>
          ) : (
            <>
              <KPI
                label="Beta TSA"
                value={String(kpi.beta)}
                accent="#9BA3D4"
                icon={<ShieldAlert className="w-4 h-4" />}
              />
              <KPI
                label="最終発行"
                value={kpi.last ? formatDate(kpi.last) : '—'}
                icon={<Clock3 className="w-4 h-4" />}
              />
            </>
          )}
        </section>

        {/* ───────── Project Rail ───────── */}
        <section className="mt-7">
          <ProjectRail
            chips={projectChips}
            activeId={activeProjectId}
            onChange={setActiveProjectId}
            isStudio={isStudio}
            onCreate={isStudio ? () => setComposerOpen(true) : undefined}
            projects={ops.projects}
          />
        </section>

        {/* ───────── Attention Tray ───────── */}
        {isStudio && attentionItems.length > 0 && (
          <section className="mt-5">
            <AttentionTray items={attentionItems} onFocus={focusCertById} />
          </section>
        )}

        {/* ───────── Toolbar ───────── */}
        <section className="mt-6 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="案件名・ファイル名・ハッシュで検索…"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-[13px] text-white placeholder:text-white/35 focus:outline-none focus:border-[#6C3EF4]/60 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <TrustFilterTabs
              value={trustFilter}
              onChange={setTrustFilter}
              counts={{
                beta: typeof kpi.beta === 'number' ? kpi.beta : 0,
                trusted: visibleCerts.filter((c) => deriveTrustTier(c).tier === 'trusted').length,
                cross: visibleCerts.filter((c) => deriveTrustTier(c).tier === 'cross').length,
                pending: typeof kpi.pending === 'number' ? kpi.pending : 0,
              }}
            />

            <SegGroup ariaLabel="並び替え">
              <SegBtn active={sortBy === 'newest'} onClick={() => setSortBy('newest')}>
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">最新</span>
              </SegBtn>
              <SegBtn active={sortBy === 'trust'} onClick={() => setSortBy('trust')}>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">証明強度順</span>
              </SegBtn>
              <SegBtn active={sortBy === 'starred'} onClick={() => setSortBy('starred')}>
                <Star className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">保護優先</span>
              </SegBtn>
            </SegGroup>

            <SegGroup ariaLabel="表示モード">
              <SegBtn active={view === 'grid'} onClick={() => setView('grid')} title="Bentoカード">
                <LayoutGrid className="w-3.5 h-3.5" />
              </SegBtn>
              <SegBtn active={view === 'list'} onClick={() => setView('list')} title="テーブル">
                <Rows3 className="w-3.5 h-3.5" />
              </SegBtn>
            </SegGroup>

            <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-white/45 hover:text-white/70 transition-colors px-2 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="accent-[#6C3EF4]"
              />
              <Archive className="w-3 h-3" />
              アーカイブ
            </label>

            {/* Group-by toggle */}
            <button
              type="button"
              onClick={() => setGroupByProject((v) => !v)}
              className={[
                'inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors border',
                groupByProject
                  ? 'text-[#6C3EF4] border-[#6C3EF4]/40 bg-[#6C3EF4]/10'
                  : 'text-white/45 border-white/[0.06] bg-white/[0.02] hover:text-white/70',
              ].join(' ')}
              title="案件ごとにグループ表示"
            >
              <Tag className="w-3 h-3" />
              <span className="hidden sm:inline">案件分類</span>
            </button>
          </div>
        </section>

        {/* ───────── Cert Body ───────── */}
        <section className="mt-5">
          {loadingCerts ? (
            <SkeletonGrid />
          ) : certs.length === 0 ? (
            <EmptyState />
          ) : filteredSortedCerts.length === 0 ? (
            <NoMatch
              onReset={() => {
                setSearchQuery('');
                setTrustFilter('all');
                setActiveProjectId(ALL_PROJECTS_ID);
              }}
            />
          ) : view === 'list' ? (
            <CertListTable
              certs={filteredSortedCerts}
              isStudio={isStudio}
              ops={ops}
              copiedId={copiedId}
              selectedIds={selectedIds}
              groupByProject={groupByProject}
              onToggleSelect={handleToggleSelect}
              onSelectAll={() => handleSelectAll(filteredSortedCerts)}
              onCopyLink={handleCopyLink}
              // ▼ 権限がない場合は、エラーではなく InspectorのChainタブ（ペイウォール）を開いて課金誤導する
              onEvidence={(cert) => canExportEvidencePack ? handleEvidence(cert) : openInspector(cert, 'chain')}
              onArchive={handleArchive}
              onToggleStar={handleToggleStar}
              onAssignClientProject={handleAssignClientProject}
              onAssignProjectId={async (cert, pid) => {
                await ops.assignCertificate({
                  certificate_id: cert.id,
                  project_id: pid,
                });
                setCerts((prev) =>
                  prev.map((c) => (c.id === cert.id ? { ...c, project_id: pid } : c)),
                );
              }}
              onStatusChange={handleStatusChange}
              onOpenAudit={(cert) => {
                setAuditCertId(cert.id);
                setAuditCertTitle(cert.title ?? cert.file_name ?? null);
              }}
              onOpenInspector={(cert) => openInspector(cert, 'overview')}
              onOpenChain={(cert) => openInspector(cert, 'chain')}
              reduce={reduce}
            />
          ) : (
            <CertGridView
              certs={filteredSortedCerts}
              copiedId={copiedId}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onCopyLink={handleCopyLink}
              // ▼ 権限ガードを適用
              onEvidence={(cert) => canExportEvidencePack ? handleEvidence(cert) : openInspector(cert, 'chain')}
              onArchive={handleArchive}
              onToggleStar={handleToggleStar}
              onAssignClientProject={handleAssignClientProject}
              onOpenInspector={(cert) => openInspector(cert, 'overview')}
              onOpenChain={(cert) => openInspector(cert, 'chain')}
              onResync={handleResync}
              reduce={reduce}
            />
          )}
        </section>
      </main>

      {/* ── Floating Action Bar (bulk selection) ── */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <FloatingActionBar
            count={selectedIds.size}
            onBulkAssign={() => setCpDialog({ open: true, cert: null, initialValue: '' })}
            onBulkStar={handleBulkStar}
            onBulkArchive={handleBulkArchive}
            onClear={() => setSelectedIds(new Set())}
          />
        )}
      </AnimatePresence>

      {/* ── Client Project Dialog (replaces window.prompt) ── */}
      <AnimatePresence>
        {cpDialog?.open && (
          <ClientProjectDialog
            cert={cpDialog.cert}
            bulkCount={selectedIds.size}
            initialValue={cpDialog.initialValue}
            onConfirm={handleCpDialogConfirm}
            onCancel={() => setCpDialog(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Studio modals & drawers ── */}
      {isStudio && (
        <>
          <ProjectComposer
            open={composerOpen}
            initial={null}
            teams={ops.teams}
            onClose={() => setComposerOpen(false)}
            onSubmit={async (input) => {
              await handleCreateProject(input);
            }}
          />
          <AuditDrawer
            open={!!auditCertId}
            certificateId={auditCertId}
            certificateTitle={auditCertTitle}
            onClose={() => {
              setAuditCertId(null);
              setAuditCertTitle(null);
            }}
          />
        </>
      )}

      {/* ─────────── THE INSPECTOR (right slide-in drawer) ─────────── */}
      <Inspector
        open={!!inspectorCert}
        cert={inspectorCert}
        tab={inspectorTab}
        onTabChange={setInspectorTabAndUrl}
        onClose={closeInspector}
        onCopyLink={handleCopyLink}
        // ▼ 権限ガードを適用し、なければChainタブ（ペイウォール）へ美しいアニメーションと共に遷移させる
        onEvidence={(cert) => canExportEvidencePack ? handleEvidence(cert) : setInspectorTabAndUrl('chain')}
        onArchive={handleArchive}
        onToggleStar={handleToggleStar}
        copiedId={copiedId}
        canExportEvidencePack={canExportEvidencePack}
        onResync={handleResync}
        reduce={reduce}
      />

      <style>{`
        .pm-focus-pulse { animation: pm-focus-pulse 1.4s ease-out 1; }
        @keyframes pm-focus-pulse {
          0%   { background: rgba(108,62,244,0.20); }
          100% { background: transparent; }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
 *  KPI / Toolbar primitives
 * ══════════════════════════════════════════════════════════════ */

function KPI({
  label,
  value,
  icon,
  accent = '#A8A0D8',
}: {
  label: string;
  value: string;
  icon: ReactNode;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-md px-4 py-3.5">
      <span
        aria-hidden="true"
        className="w-9 h-9 rounded-lg flex items-center justify-center border bg-white/[0.02]"
        style={{ color: accent, borderColor: `${accent}55` }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-white/45">{label}</p>
        <p className="text-[20px] font-bold tabular-nums text-white mt-0.5 truncate">{value}</p>
      </div>
    </div>
  );
}

function SegGroup({ children, ariaLabel }: { children: ReactNode; ariaLabel: string }) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 p-0.5 rounded-xl border border-white/[0.06] bg-white/[0.02]"
    >
      {children}
    </div>
  );
}

function SegBtn({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      role="tab"
      aria-selected={active}
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold transition-colors',
        active
          ? 'bg-white/[0.07] text-white'
          : 'text-white/55 hover:text-white hover:bg-white/[0.04]',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function TrustFilterTabs({
  value,
  onChange,
  counts,
}: {
  value: TrustTier | 'all';
  onChange: (v: TrustTier | 'all') => void;
  counts: Record<TrustTier, number>;
}) {
  const items: Array<{ key: TrustTier | 'all'; label: string; color: string }> = [
    { key: 'all', label: 'すべて', color: '#A8A0D8' },
    { key: 'cross', label: `CROSS ${counts?.cross ?? 0}`, color: '#F0BB38' },
    { key: 'trusted', label: `TRUSTED ${counts?.trusted ?? 0}`, color: '#00D4AA' },
    { key: 'beta', label: `BETA ${counts?.beta ?? 0}`, color: '#9BA3D4' },
    { key: 'pending', label: `PENDING ${counts?.pending ?? 0}`, color: '#A8A0D8' },
  ].filter((it) => it.key === 'all' || (counts && (counts[it.key as TrustTier] ?? 0) > 0));
  return (
    <div role="tablist" aria-label="信頼レベル" className="flex flex-wrap items-center gap-1">
      {items.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.key)}
            className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-colors"
            style={{
              color: active ? it.color : 'rgba(255,255,255,0.55)',
              borderColor: active ? `${it.color}66` : 'rgba(255,255,255,0.08)',
              background: active ? `${it.color}14` : 'transparent',
              border: '1px solid',
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
 *  Trust Badge — BreathingBadge inspired
 * ══════════════════════════════════════════════════════════════ */

function TrustBadgeMotion({
  cert,
  size = 'md',
  reduce,
}: {
  cert: CertRow;
  size?: 'sm' | 'md';
  reduce: boolean;
}) {
  const t = deriveTrustTier(cert);
  const Icon = t.icon;
  const dims = size === 'sm' ? { pad: '2px 8px', fs: 10, ic: 11 } : { pad: '4px 10px', fs: 11, ic: 14 };

  // RGB抽出 (ペリメータグロー用)
  const rgb = useMemo(() => {
    const hex = t.color.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `${r},${g},${b}`;
  }, [t.color]);

  return (
    <motion.span
      title={t.description}
      className="inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wider whitespace-nowrap"
      style={{
        padding: dims.pad,
        background: t.bg,
        border: `1px solid ${t.border}`,
        color: t.color,
        fontSize: dims.fs,
      }}
      animate={
        reduce
          ? undefined
          : {
              boxShadow: [
                `0 0 0 0 rgba(${rgb}, 0.45)`,
                `0 0 0 4px rgba(${rgb}, 0)`,
                `0 0 0 0 rgba(${rgb}, 0.45)`,
              ],
            }
      }
      transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.span
        className="flex items-center"
        animate={reduce ? undefined : { opacity: [1, 0.8, 1] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Icon style={{ width: dims.ic, height: dims.ic }} />
      </motion.span>
      <span className="hidden sm:inline">{t.label}</span>
      <span className="hidden sm:inline opacity-70 font-normal normal-case ml-1.5">· {t.sublabel}</span>
    </motion.span>
  );
}

/* ══════════════════════════════════════════════════════════════
 *  Pending Ring — Silent Processing
 * ══════════════════════════════════════════════════════════════ */

function PendingRing({
  cert,
  reduce,
  onResync,
}: {
  cert: CertRow;
  reduce: boolean;
  onResync?: (certId: string) => Promise<void>;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [resyncing, setResyncing] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1500);
    return () => window.clearInterval(t);
  }, []);

  const elapsed = useMemo(() => {
    const start = new Date(cert.created_at).getTime();
    return Number.isNaN(start) ? 0 : now - start;
  }, [cert.created_at, now]);

  const isWarn = elapsed >= PENDING_WARN_THRESHOLD_MS;
  const accent = '#00D4AA';
  const rgb = '0,212,170';

  if (isWarn) {
    return (
      <button
        type="button"
        disabled={resyncing}
        onClick={async (e) => {
          e.stopPropagation();
          if (resyncing) return;
          setResyncing(true);
          if (onResync) {
            await onResync(cert.id);
          }
          setResyncing(false);
        }}
        className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/55 transition-colors cursor-pointer group"
        style={{
          backdropFilter: 'blur(2px)',
        }}
        title="バックグラウンドで処理中。クリックして再同期"
        aria-label="再同期"
      >
        <div
          className="flex flex-col items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-2xl border border-white/10 bg-[#07061A]/90 hover:border-[#00D4AA]/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
          style={{
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <Clock3 className={`w-4 h-4 text-[#A8A0D8] group-hover:text-[#00D4AA] ${resyncing ? 'animate-spin' : 'animate-pulse'}`} />
          <span className="text-[9px] font-mono text-[#A8A0D8] group-hover:text-[#00D4AA] uppercase tracking-[0.15em] transition-colors">
            {resyncing ? '再同期中...' : '↻ 再同期'}
          </span>
        </div>
      </button>
    );
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{
        background:
          'radial-gradient(circle at 50% 50%, rgba(7,6,26,0.45) 0%, rgba(7,6,26,0.25) 60%, transparent 100%)',
        backdropFilter: 'blur(1px)',
      }}
      title="タイムスタンプを発行中…"
      aria-label="タイムスタンプを発行中…"
    >
      <motion.div
        className="relative h-14 w-14 rounded-full flex items-center justify-center"
        style={{
          background: 'rgba(7,6,26,0.65)',
          border: `1px solid rgba(${rgb}, 0.55)`,
          backdropFilter: 'blur(6px)',
        }}
        animate={
          reduce
            ? undefined
            : {
                boxShadow: [
                  `0 0 0 0 rgba(${rgb}, 0.45)`,
                  `0 0 0 10px rgba(${rgb}, 0)`,
                  `0 0 0 0 rgba(${rgb}, 0.45)`,
                ],
              }
        }
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* spinning ring */}
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            border: `2px solid transparent`,
            borderTopColor: accent,
            borderRightColor: `rgba(${rgb}, 0.4)`,
          }}
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
        />
        {/* breathing dot */}
        <motion.span
          className="block h-2 w-2 rounded-full"
          style={{ background: accent, boxShadow: `0 0 12px ${accent}` }}
          animate={reduce ? undefined : { opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
 *  List View
 * ══════════════════════════════════════════════════════════════ */

interface ListViewProps {
  certs: CertRow[];
  isStudio: boolean;
  ops: ReturnType<typeof useStudioOps>;
  copiedId: string | null;
  selectedIds: Set<string>;
  groupByProject: boolean;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onCopyLink: (cert: CertRow) => void;
  onEvidence: (cert: CertRow) => void;
  onArchive: (cert: CertRow, next: boolean) => void;
  onToggleStar: (id: string, current: boolean) => void;
  onAssignClientProject: (cert: CertRow) => void;
  onAssignProjectId: (cert: CertRow, projectId: string | null) => void;
  onStatusChange: (cert: CertRow, next: DeliveryStatus | null) => void;
  onOpenAudit: (cert: CertRow) => void;
  onOpenInspector: (cert: CertRow) => void;
  onOpenChain: (cert: CertRow) => void;
  reduce: boolean;
}

function CertListTable(props: ListViewProps) {
  const {
    certs,
    isStudio,
    ops,
    copiedId,
    selectedIds,
    groupByProject,
    onToggleSelect,
    onSelectAll,
    onCopyLink,
    onEvidence,
    onArchive,
    onToggleStar,
    onAssignClientProject,
    onAssignProjectId,
    onStatusChange,
    onOpenAudit,
    onOpenInspector,
    onOpenChain,
    reduce,
  } = props;

  const allSelected = certs.length > 0 && certs.every((c) => selectedIds.has(c.id));
  const someSelected = !allSelected && certs.some((c) => selectedIds.has(c.id));

  const cols = isStudio
    ? '28px 2fr 1fr 1fr 0.9fr auto'
    : '28px 2.2fr 1fr 1fr 0.9fr auto';

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-md">
      <div className="min-w-[960px]">
        {/* Table header */}
        <div
          role="row"
          className="grid gap-3 px-4 py-3 text-[10px] uppercase tracking-widest text-white/40 border-b border-white/5"
          style={{ gridTemplateColumns: cols }}
        >
          {/* Select-all checkbox */}
          <span role="columnheader" onClick={(e) => { e.stopPropagation(); onSelectAll(); }} className="cursor-pointer flex items-center">
            {allSelected ? (
              <CheckSquare2 className="w-3.5 h-3.5 text-[#6C3EF4]" />
            ) : someSelected ? (
              <div className="w-3.5 h-3.5 rounded border-2 border-[#6C3EF4] flex items-center justify-center">
                <div className="w-1.5 h-0.5 bg-[#6C3EF4] rounded" />
              </div>
            ) : (
              <Square className="w-3.5 h-3.5 text-white/20 hover:text-white/50 transition-colors" />
            )}
          </span>
          <span role="columnheader">案件 / タイトル</span>
          <span role="columnheader">{isStudio ? 'ステータス' : '信頼レベル'}</span>
          <span role="columnheader">案件</span>
          <span role="columnheader">発行</span>
          <span role="columnheader" className="text-right">
            操作
          </span>
        </div>

        {/* Rows, optionally grouped by client_project */}
        {(() => {
          let lastGroup: string | null = undefined as unknown as null;
          const rows: React.ReactNode[] = [];

          certs.forEach((cert) => {
            const project = isStudio && cert.project_id
              ? ops.projects.find((p) => p.id === cert.project_id)
              : null;

            const groupKey = isStudio
              ? (project?.name ?? cert.client_project ?? '未分類')
              : (cert.client_project?.trim() || '未分類');

            // Group header separator
            if (groupByProject && groupKey !== lastGroup) {
              lastGroup = groupKey;
              rows.push(
                <div
                  key={`group-${groupKey}-${cert.id}`}
                  className="px-4 py-2 flex items-center gap-2 border-b border-white/5 bg-white/[0.01]"
                >
                  <Tag className="w-3 h-3 text-[#6C3EF4]/70" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                    {groupKey}
                  </span>
                </div>,
              );
            }

            const isSelected = selectedIds.has(cert.id);
            rows.push(
              <div
                key={cert.id}
                id={`cert-row-${cert.id}`}
                role="row"
                className={[
                  'grid gap-3 px-4 py-3 border-b border-white/5 last:border-b-0 transition-colors cursor-pointer',
                  isSelected
                    ? 'bg-[#6C3EF4]/[0.06] hover:bg-[#6C3EF4]/[0.09]'
                    : 'hover:bg-white/[0.02]',
                ].join(' ')}
                style={{ gridTemplateColumns: cols }}
                onClick={() => onOpenInspector(cert)}
              >
                {/* Checkbox */}
                <div
                  role="cell"
                  className="self-center flex items-center"
                  onClick={(e) => { e.stopPropagation(); onToggleSelect(cert.id); }}
                >
                  {isSelected ? (
                    <CheckSquare2 className="w-3.5 h-3.5 text-[#6C3EF4]" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-white/20 hover:text-white/50 transition-colors" />
                  )}
                </div>

                <div role="cell" className="min-w-0">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar(cert.id, !!cert.is_starred);
                      }}
                      className="shrink-0 text-white/35 hover:text-[#F0BB38] transition-colors"
                      title={cert.is_starred ? '保護を解除' : '保護'}
                    >
                      <Star
                        className="w-3.5 h-3.5"
                        fill={cert.is_starred ? '#F0BB38' : 'transparent'}
                      />
                    </button>
                    <p
                      className="text-[13px] font-semibold text-white whitespace-nowrap overflow-hidden max-w-[140px] sm:max-w-full"
                      style={{ WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)', maskImage: 'linear-gradient(to right, black 85%, transparent 100%)' }}
                    >
                      {cert.title || cert.file_name || 'Untitled'}
                    </p>
                  </div>
                  <p className="text-[10.5px] text-white/40 font-mono truncate mt-0.5 ml-5">
                    <Hash className="inline w-2.5 h-2.5 mr-1" />
                    {(cert.sha256 || cert.file_hash || '').slice(0, 24)}…
                  </p>
                </div>

                <div role="cell" className="self-center" onClick={(e) => e.stopPropagation()}>
                  {isStudio ? (
                    <StatusMenu
                      current={cert.delivery_status ?? null}
                      onChange={(next) => onStatusChange(cert, next)}
                    />
                  ) : (
                    <TrustBadgeMotion cert={cert} size="sm" reduce={reduce} />
                  )}
                </div>

                <div role="cell" className="self-center" onClick={(e) => e.stopPropagation()}>
                  {isStudio ? (
                    <ProjectAssignButton
                      currentProjectId={cert.project_id ?? null}
                      currentProjectColor={project?.color ?? null}
                      currentProjectName={project?.name ?? cert.client_project ?? null}
                      projects={ops.projects}
                      onAssign={(pid) => onAssignProjectId(cert, pid)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAssignClientProject(cert)}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] text-[11px] text-white/75 transition-colors max-w-[180px]"
                      title="案件を編集"
                    >
                      <FolderKanban className="w-3 h-3 opacity-60" />
                      <span className="truncate">{cert.client_project || '未分類'}</span>
                    </button>
                  )}
                </div>

                <div role="cell" className="self-center text-[11px] text-white/55 tabular-nums">
                  {cert.certified_at
                    ? formatDate(cert.certified_at)
                    : cert.created_at
                      ? formatDate(cert.created_at)
                      : '—'}
                </div>

                <div role="cell" className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <div className="mr-2">
                    <VisibilityToggle assetId={cert.id} initialVisibility={(cert.visibility as 'public' | 'private') || 'public'} />
                  </div>
                  <IconBtn
                    title={copiedId === cert.id ? 'コピー済' : '検証URLをコピー'}
                    onClick={() => onCopyLink(cert)}
                  >
                    {copiedId === cert.id ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </IconBtn>
                  <IconBtn title="Evidence Pack" onClick={() => onEvidence(cert)}>
                    <FileDown className="w-3.5 h-3.5" />
                  </IconBtn>
                  <IconBtn title="Chain of Evidence" onClick={() => onOpenChain(cert)}>
                    <LinkIcon className="w-3.5 h-3.5" />
                  </IconBtn>
                  {isStudio && (
                    <IconBtn title="操作履歴" onClick={() => onOpenAudit(cert)}>
                      <History className="w-3.5 h-3.5" />
                    </IconBtn>
                  )}
                  <IconBtn
                    title={cert.is_archived ? 'アーカイブから戻す' : 'アーカイブ'}
                    onClick={() => onArchive(cert, !cert.is_archived)}
                  >
                    {cert.is_archived ? (
                      <ArchiveRestore className="w-3.5 h-3.5" />
                    ) : (
                      <Archive className="w-3.5 h-3.5" />
                    )}
                  </IconBtn>
                  <a
                    href={`/cert/${cert.id}`}
                    title="証明書を開く"
                    onClick={(e) => e.stopPropagation()}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white/80 border border-white/10 hover:bg-white/5 transition-colors inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    開く
                  </a>
                </div>
              </div>,
            );
          });

          return rows;
        })()}

function IconBtn({
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleStar(cert.id, !!cert.is_starred);
                    }}
                    className="shrink-0 text-white/35 hover:text-[#F0BB38] transition-colors"
                    title={cert.is_starred ? '保護を解除' : '保護'}
                  >
                    <Star
                      className="w-3.5 h-3.5"
                      fill={cert.is_starred ? '#F0BB38' : 'transparent'}
                    />
                  </button>
                  <p 
                    className="text-[13px] font-semibold text-white whitespace-nowrap overflow-hidden max-w-[140px] sm:max-w-full"
                    style={{ WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)', maskImage: 'linear-gradient(to right, black 85%, transparent 100%)' }}
                  >
                    {cert.title || cert.file_name || 'Untitled'}
                  </p>
                </div>
                <p className="text-[10.5px] text-white/40 font-mono truncate mt-0.5 ml-5">
                  <Hash className="inline w-2.5 h-2.5 mr-1" />
                  {(cert.sha256 || cert.file_hash || '').slice(0, 24)}…
                </p>
              </div>

              <div role="cell" className="self-center" onClick={(e) => e.stopPropagation()}>
                {isStudio ? (
                  <StatusMenu
                    current={cert.delivery_status ?? null}
                    onChange={(next) => onStatusChange(cert, next)}
                  />
                ) : (
                  <TrustBadgeMotion cert={cert} size="sm" reduce={reduce} />
                )}
              </div>

              <div role="cell" className="self-center" onClick={(e) => e.stopPropagation()}>
                {isStudio ? (
                  <ProjectAssignButton
                    currentProjectId={cert.project_id ?? null}
                    currentProjectColor={project?.color ?? null}
                    currentProjectName={project?.name ?? cert.client_project ?? null}
                    projects={ops.projects}
                    onAssign={(pid) => onAssignProjectId(cert, pid)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => onAssignClientProject(cert)}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] text-[11px] text-white/75 transition-colors max-w-[180px]"
                    title="案件を編集"
                  >
                    <FolderKanban className="w-3 h-3 opacity-60" />
                    <span className="truncate">{cert.client_project || '未分類'}</span>
                  </button>
                )}
              </div>

              <div role="cell" className="self-center text-[11px] text-white/55 tabular-nums">
                {cert.certified_at
                  ? formatDate(cert.certified_at)
                  : cert.created_at
                    ? formatDate(cert.created_at)
                    : '—'}
              </div>

              <div role="cell" className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <div className="mr-2">
                  <VisibilityToggle assetId={cert.id} initialVisibility={(cert.visibility as 'public' | 'private') || 'public'} />
                </div>
                <IconBtn
                  title={copiedId === cert.id ? 'コピー済' : '検証URLをコピー'}
                  onClick={() => onCopyLink(cert)}
                >
                  {copiedId === cert.id ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </IconBtn>
                <IconBtn title="Evidence Pack" onClick={() => onEvidence(cert)}>
                  <FileDown className="w-3.5 h-3.5" />
                </IconBtn>
                <IconBtn title="Chain of Evidence" onClick={() => onOpenChain(cert)}>
                  <LinkIcon className="w-3.5 h-3.5" />
                </IconBtn>
                {isStudio && (
                  <IconBtn title="操作履歴" onClick={() => onOpenAudit(cert)}>
                    <History className="w-3.5 h-3.5" />
                  </IconBtn>
                )}
                <IconBtn
                  title={cert.is_archived ? 'アーカイブから戻す' : 'アーカイブ'}
                  onClick={() => onArchive(cert, !cert.is_archived)}
                >
                  {cert.is_archived ? (
                    <ArchiveRestore className="w-3.5 h-3.5" />
                  ) : (
                    <Archive className="w-3.5 h-3.5" />
                  )}
                </IconBtn>
                <a
                  href={`/cert/${cert.id}`}
                  title="証明書を開く"
                  onClick={(e) => e.stopPropagation()}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white/80 border border-white/10 hover:bg-white/5 transition-colors inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  開く
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      aria-label={title}
      className="p-1.5 rounded-lg text-white/55 hover:text-white hover:bg-white/[0.05] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4AA]"
    >
      {children}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
 *  Visual-First Bento Grid View
 * ══════════════════════════════════════════════════════════════ */

interface GridViewProps {
  certs: CertRow[];
  copiedId: string | null;
  onCopyLink: (cert: CertRow) => void;
  onEvidence: (cert: CertRow) => void;
  onArchive: (cert: CertRow, next: boolean) => void;
  onToggleStar: (id: string, current: boolean) => void;
  onAssignClientProject: (cert: CertRow) => void;
  onOpenInspector: (cert: CertRow) => void;
  onOpenChain: (cert: CertRow) => void;
  onResync?: (certId: string) => Promise<void>;
  reduce: boolean;
}

function CertGridView(props: GridViewProps) {
  const {
    certs,
    copiedId,
    onCopyLink,
    onEvidence,
    onArchive,
    onToggleStar,
    onAssignClientProject,
    onOpenInspector,
    onOpenChain,
    onResync,
    reduce,
  } = props;

  return (
    <div
      className="grid gap-4 sm:gap-5"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
    >
      {certs.map((cert, index) => (
        <BentoCard
          key={cert.id}
          cert={cert}
          index={index}
          copiedId={copiedId}
          onCopyLink={onCopyLink}
          onEvidence={onEvidence}
          onArchive={onArchive}
          onToggleStar={onToggleStar}
          onAssignClientProject={onAssignClientProject}
          onOpenInspector={onOpenInspector}
          onOpenChain={onOpenChain}
          onResync={onResync}
          reduce={reduce}
        />
      ))}
    </div>
  );
}

function BentoCard({
  cert,
  index,
  copiedId,
  onCopyLink,
  onEvidence,
  onArchive,
  onToggleStar,
  onAssignClientProject,
  onOpenInspector,
  onOpenChain,
  onResync,
  reduce,
}: {
  cert: CertRow;
  index: number;
  copiedId: string | null;
  onCopyLink: (cert: CertRow) => void;
  onEvidence: (cert: CertRow) => void;
  onArchive: (cert: CertRow, next: boolean) => void;
  onToggleStar: (id: string, current: boolean) => void;
  onAssignClientProject: (cert: CertRow) => void;
  onOpenInspector: (cert: CertRow) => void;
  onOpenChain: (cert: CertRow) => void;
  onResync?: (certId: string) => Promise<void>;
  reduce: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const trust = useMemo(() => deriveTrustTier(cert), [cert]);
  const isPending = trust.tier === 'pending' || cert.delivery_status === 'in_progress';
  const hasRealImage =
    cert.proof_mode === 'shareable' &&
    typeof cert.public_image_url === 'string' &&
    cert.public_image_url !== '' &&
    !imgError;

  const optimizedSrc = useMemo(
    () => (hasRealImage ? getOptimizedImageUrl(cert.public_image_url, { width: 400, quality: 80, format: 'webp' }) : ''),
    [hasRealImage, cert.public_image_url],
  );

  const variants: Variants = reduce
    ? { hidden: { opacity: 1 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        hidden: { opacity: 0, y: 14, scale: 0.985 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.5, ease: PM_EASE, delay: Math.min(index * 0.04, 0.32) },
        },
        exit: { opacity: 0, y: -6, transition: { duration: 0.25 } },
      };

  return (
    <motion.article
      layout
      variants={variants}
      initial="hidden"
      animate="visible"
      exit="exit"
      id={`cert-row-${cert.id}`}
      onClick={() => onOpenInspector(cert)}
      whileHover={reduce ? undefined : { y: -3 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className="group relative rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-md overflow-hidden hover:border-[#6C3EF4]/40 transition-colors cursor-pointer"
    >
      {/* under-card glow (real images only) */}
      {hasRealImage && (
        <div
          aria-hidden
          className="absolute -inset-3 rounded-[24px] blur-3xl pointer-events-none opacity-0 group-hover:opacity-100 -z-10"
          style={{
            background:
              'radial-gradient(ellipse at 50% 80%, rgba(0,212,170,0.32), transparent 55%), radial-gradient(ellipse at 50% 20%, rgba(108,62,244,0.26), transparent 55%)',
            transition: 'opacity 500ms',
          }}
        />
      )}

      <div className="relative aspect-[4/3] overflow-hidden">
        {hasRealImage ? (
          <img
            src={optimizedSrc}
            alt={cert.original_filename || cert.file_name || 'Artwork'}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          <HashFingerprint
            hash={cert.sha256 || cert.file_hash || cert.id}
            className="absolute inset-0"
          />
        )}

        {/* Silent Processing — Pending Ring */}
        {isPending && <PendingRing cert={cert} reduce={reduce} onResync={onResync} />}

        {/* trust badge — breathing */}
        <div className="absolute top-2 left-2 z-10">
          <TrustBadgeMotion cert={cert} size="sm" reduce={reduce} />
        </div>

        {/* star toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar(cert.id, !!cert.is_starred);
          }}
          className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/45 backdrop-blur flex items-center justify-center text-white/70 hover:text-[#F0BB38] transition-colors"
          title={cert.is_starred ? '保護解除' : '保護'}
        >
          <Star className="w-3.5 h-3.5" fill={cert.is_starred ? '#F0BB38' : 'transparent'} />
        </button>

        {cert.is_archived && (
          <div className="absolute bottom-2 right-2 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/55 text-[9px] font-bold uppercase text-white/70">
            <Archive className="w-2.5 h-2.5" />
            Archived
          </div>
        )}

        {/* Visual-first hover veil with title */}
        {hasRealImage && (
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-2/5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background:
                'linear-gradient(180deg, transparent 0%, rgba(7,6,26,0.78) 70%, rgba(7,6,26,0.92) 100%)',
            }}
          />
        )}
      </div>

      <div className="p-3.5 space-y-2.5">
        <div className="flex items-baseline justify-between gap-2 min-w-0">
          <p 
            className="text-[13px] font-semibold text-white whitespace-nowrap overflow-hidden max-w-[200px] sm:max-w-full"
            style={{ WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)', maskImage: 'linear-gradient(to right, black 85%, transparent 100%)' }}
          >
            {cert.title || cert.original_filename || cert.file_name || 'Untitled'}
          </p>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAssignClientProject(cert);
          }}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] text-[10.5px] text-white/65 transition-colors max-w-full"
          title="案件を編集"
        >
          <FolderKanban className="w-3 h-3 opacity-60" />
          <span className="truncate">{cert.client_project || '未分類'}</span>
        </button>

        <div className="flex items-center justify-between text-[10.5px] text-white/50 font-mono">
          <span className="inline-flex items-center gap-1">
            <Hash className="w-2.5 h-2.5" />
            {(cert.sha256 || cert.file_hash || '').slice(0, 12)}…
          </span>
          <span className="tabular-nums inline-flex items-center gap-1">
            <Clock3 className="w-2.5 h-2.5" />
            {cert.certified_at
              ? formatDate(cert.certified_at)
              : cert.created_at
                ? formatDate(cert.created_at)
                : '—'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 pt-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onCopyLink(cert)}
            className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-white/80 border border-white/10 hover:bg-white/[0.04] transition-colors"
          >
            {copiedId === cert.id ? (
              <>
                <Check className="w-3 h-3" /> コピー済
              </>
            ) : (
              <>
                <LinkIcon className="w-3 h-3" /> URL
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => onEvidence(cert)}
            className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-[#07061A] bg-gradient-to-r from-[#6C3EF4] to-[#00D4AA] hover:opacity-95 transition-opacity"
          >
            <FileDown className="w-3 h-3" />
            Evidence
          </button>
        </div>
        <div className="flex items-center justify-between pt-1" onClick={(e) => e.stopPropagation()}>
          <div className="scale-90 origin-left">
            <VisibilityToggle assetId={cert.id} initialVisibility={(cert.visibility as 'public' | 'private') || 'public'} />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChain(cert)}
              className="text-[10.5px] text-white/45 hover:text-white/80 transition-colors inline-flex items-center gap-1"
              title="Chain of Evidence"
            >
              <LinkIcon className="w-2.5 h-2.5" />
              Chain
            </button>
            <button
              type="button"
              onClick={() => onArchive(cert, !cert.is_archived)}
              className="text-[10.5px] text-white/45 hover:text-white/80 transition-colors inline-flex items-center gap-1"
              title={cert.is_archived ? '戻す' : 'アーカイブ'}
            >
              {cert.is_archived ? (
                <>
                  <ArchiveRestore className="w-2.5 h-2.5" /> 戻す
                </>
              ) : (
                <>
                  <Archive className="w-2.5 h-2.5" /> アーカイブ
                </>
              )}
            </button>
            <a
              href={`/cert/${cert.id}`}
              className="text-[10.5px] text-white/45 hover:text-white/80 transition-colors inline-flex items-center gap-1"
            >
              <ExternalLink className="w-2.5 h-2.5" /> 開く
            </a>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

/* ══════════════════════════════════════════════════════════════
 *  THE INSPECTOR (right slide-in drawer)
 * ══════════════════════════════════════════════════════════════ */

interface InspectorProps {
  open: boolean;
  cert: CertRow | null;
  tab: 'overview' | 'chain';
  onTabChange: (t: 'overview' | 'chain') => void;
  onClose: () => void;
  onCopyLink: (cert: CertRow) => void;
  onEvidence: (cert: CertRow) => void;
  onArchive: (cert: CertRow, next: boolean) => void;
  onToggleStar: (id: string, current: boolean) => void;
  copiedId: string | null;
  canExportEvidencePack: boolean;
  onResync?: (certId: string) => Promise<void>;
  reduce: boolean;
}

function Inspector({
  open,
  cert,
  tab,
  onTabChange,
  onClose,
  onCopyLink,
  onEvidence,
  onArchive,
  onToggleStar,
  copiedId,
  canExportEvidencePack,
  onResync,
  reduce,
}: InspectorProps) {
  // ESC で閉じる
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && cert && (
        <>
          {/* scrim */}
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40"
            style={{
              background: 'rgba(7,6,26,0.62)',
              backdropFilter: 'blur(8px)',
            }}
            onClick={onClose}
            aria-hidden
          />

          {/* drawer */}
          <motion.aside
            key="drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`Inspector — ${cert.title ?? cert.file_name ?? cert.id}`}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 36, mass: 0.9 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-[860px] flex flex-col"
            style={{
              background:
                'linear-gradient(165deg, rgba(15,12,32,0.96) 0%, rgba(7,6,26,0.94) 60%, rgba(7,6,26,0.98) 100%)',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '-40px 0 80px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03) inset',
              backdropFilter: 'blur(24px)',
            }}
          >
            {/* top hairline */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(108,62,244,0.7), rgba(0,212,170,0.7), transparent)',
              }}
            />

            {/* ambient aura */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-[#6C3EF4] opacity-[0.10] blur-[120px]"
            />

            {/* header */}
            <header className="relative px-6 py-4 border-b border-white/[0.06] flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-[#A8A0D8] mb-1.5">
                  Inspector · {cert.id.slice(0, 8)}…
                </p>
                <h2 className="text-[18px] sm:text-[20px] font-bold text-white truncate">
                  {cert.title ?? cert.file_name ?? 'Untitled'}
                </h2>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <TrustBadgeMotion cert={cert} size="sm" reduce={reduce} />
                  {cert.proof_mode === 'shareable' ? (
                    <BreathingBadge reduce={reduce} size="mini" tone="teal" label="Visual" />
                  ) : (
                    <BreathingBadge reduce={reduce} size="mini" tone="purple" label="Private" />
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onToggleStar(cert.id, !!cert.is_starred)}
                className="shrink-0 p-2 rounded-lg text-white/55 hover:text-[#F0BB38] hover:bg-white/[0.04] transition-colors"
                title={cert.is_starred ? '保護を解除' : '保護'}
              >
                <Star className="w-4 h-4" fill={cert.is_starred ? '#F0BB38' : 'transparent'} />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="shrink-0 p-2 rounded-lg text-white/55 hover:text-white hover:bg-white/[0.04] transition-colors"
                aria-label="閉じる"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {/* tabs */}
            <div className="relative px-6 pt-3 border-b border-white/[0.06]">
              <div role="tablist" className="inline-flex items-center gap-1">
                <InspectorTab
                  active={tab === 'overview'}
                  onClick={() => onTabChange('overview')}
                  label="Overview"
                />
                <InspectorTab
                  active={tab === 'chain'}
                  onClick={() => onTabChange('chain')}
                  label="Chain of Evidence"
                  badge={canExportEvidencePack ? undefined : 'PRO'}
                />
              </div>
            </div>

            {/* body */}
            <div className="relative flex-1 overflow-y-auto">
              {tab === 'overview' && (
                <InspectorOverview
                  cert={cert}
                  copiedId={copiedId}
                  onCopyLink={onCopyLink}
                  onEvidence={onEvidence}
                  onArchive={onArchive}
                  canExportEvidencePack={canExportEvidencePack}
                  onResync={onResync}
                  reduce={reduce}
                />
              )}

              {tab === 'chain' && (
                <InspectorChain
                  cert={cert}
                  canExportEvidencePack={canExportEvidencePack}
                  reduce={reduce}
                />
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function InspectorTab({
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        'relative inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold tracking-wide rounded-t-lg transition-colors',
        active ? 'text-white' : 'text-white/55 hover:text-white/85',
      ].join(' ')}
    >
      {label}
      {badge && (
        <span
          className="px-1.5 py-0.5 rounded text-[8.5px] font-mono uppercase tracking-[0.18em]"
          style={{
            background: 'linear-gradient(135deg, rgba(108,62,244,0.18), rgba(0,212,170,0.18))',
            border: '1px solid rgba(108,62,244,0.45)',
            color: '#BC78FF',
          }}
        >
          {badge}
        </span>
      )}
      {active && (
        <motion.span
          layoutId="inspector-tab-underline"
          className="absolute -bottom-px left-0 right-0 h-[2px]"
          style={{
            background: 'linear-gradient(90deg, #6C3EF4, #00D4AA)',
            boxShadow: '0 0 10px rgba(0,212,170,0.55)',
          }}
          transition={{ type: 'spring', stiffness: 460, damping: 32 }}
        />
      )}
    </button>
  );
}

/* ── Overview tab body ── */
function InspectorOverview({
  cert,
  copiedId,
  onCopyLink,
  onEvidence,
  onArchive,
  canExportEvidencePack,
  onResync,
  reduce,
}: {
  cert: CertRow;
  copiedId: string | null;
  onCopyLink: (cert: CertRow) => void;
  onEvidence: (cert: CertRow) => void;
  onArchive: (cert: CertRow, next: boolean) => void;
  canExportEvidencePack: boolean;
  onResync?: (certId: string) => Promise<void>;
  reduce: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const hasRealImage =
    cert.proof_mode === 'shareable' &&
    typeof cert.public_image_url === 'string' &&
    cert.public_image_url !== '' &&
    !imgError;
  const optimizedSrc = useMemo(
    () => (hasRealImage ? getOptimizedImageUrl(cert.public_image_url, { width: 800, quality: 80, format: 'webp' }) : ''),
    [hasRealImage, cert.public_image_url],
  );

  return (
    <div className="px-6 py-5 space-y-5">
      {/* Hero asset */}
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          aspectRatio: '4 / 3',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 60px -20px rgba(0,0,0,0.6)',
        }}
      >
        {hasRealImage ? (
          <img
            src={optimizedSrc}
            alt={cert.title ?? cert.file_name ?? 'Artwork'}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <HashFingerprint
            hash={cert.sha256 || cert.file_hash || cert.id}
            className="absolute inset-0"
          />
        )}
        {(deriveTrustTier(cert).tier === 'pending') && (
          <PendingRing cert={cert} reduce={reduce} onResync={onResync} />
        )}
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MetaRow label="Certificate ID" mono value={cert.id} />
        <MetaRow
          label="SHA-256"
          mono
          value={
            <span className="break-all">
              {(cert.sha256 || cert.file_hash || '—').slice(0, 32)}…{(cert.sha256 || cert.file_hash || '').slice(-8)}
            </span>
          }
        />
        <MetaRow label="Proof Mode" value={cert.proof_mode ?? '—'} />
        <MetaRow label="Visibility" value={cert.visibility ?? '—'} />
        <MetaRow
          label="TSA Provider"
          value={cert.tsa_provider ? cert.tsa_provider.toUpperCase() : '—'}
        />
        <MetaRow
          label="Certified"
          value={cert.certified_at ? formatDate(cert.certified_at) : '—'}
        />
        <MetaRow label="Created" value={formatDate(cert.created_at)} />
        <MetaRow label="案件" value={cert.client_project || '未分類'} />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          onClick={() => onCopyLink(cert)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold text-white border border-white/10 hover:bg-white/[0.05] transition-colors"
        >
          {copiedId === cert.id ? (
            <>
              <Check className="w-3.5 h-3.5" /> コピー済
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" /> 検証URL
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => onEvidence(cert)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold text-[#07061A] bg-gradient-to-r from-[#6C3EF4] to-[#00D4AA] hover:opacity-95 transition-opacity"
          title="Evidence Pack をダウンロード"
        >
          <FileDown className="w-3.5 h-3.5" />
          Evidence Pack
        </button>
        <button
          type="button"
          onClick={() => onArchive(cert, !cert.is_archived)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold text-white/80 border border-white/10 hover:bg-white/[0.05] transition-colors"
        >
          {cert.is_archived ? (
            <>
              <ArchiveRestore className="w-3.5 h-3.5" /> 戻す
            </>
          ) : (
            <>
              <Archive className="w-3.5 h-3.5" /> アーカイブ
            </>
          )}
        </button>
        <a
          href={`/cert/${cert.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold text-white/80 border border-white/10 hover:bg-white/[0.05] transition-colors ml-auto"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          証明書を開く
        </a>
      </div>
    </div>
  );
}

function MetaRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      className="rounded-xl px-3.5 py-2.5"
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <p className="text-[9.5px] font-mono uppercase tracking-[0.22em] text-white/45">
        {label}
      </p>
      <p
        className={[
          'mt-1 text-[12px] text-white/90',
          mono ? 'font-mono break-all text-[11.5px]' : '',
        ].join(' ')}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </p>
    </div>
  );
}

/* ── Chain tab body ── */
const STEP_TYPE_LABELS: Record<string, string> = {
  rough: 'ラフ',
  lineart: '線画',
  color: '着色',
  final: '完成',
  other: '途中工程',
};

const STEP_TYPE_COLORS: Record<string, string> = {
  rough: '#F59E0B',
  lineart: '#818CF8',
  color: '#34D399',
  final: '#00D4AA',
  other: '#A8A0D8',
};

interface ProcessBundleStep {
  id: string;
  step_index: number;
  step_type: string;
  title: string;
  description: string;
  preview_url?: string;
  sha256: string;
  issued_at?: string;
  created_at: string;
}

function EvidenceChainViewer({ cert }: { cert: CertRow }) {
  const [steps, setSteps] = useState<ProcessBundleStep[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchTimeline = async () => {
      const bundleId = (cert as any).process_bundle_id;
      if (!bundleId) {
        setSteps([]);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('process_bundle_steps')
          .select('*')
          .eq('bundle_id', bundleId)
          .order('step_index', { ascending: true });

        if (error) throw error;
        if (active) {
          setSteps((data as ProcessBundleStep[]) || []);
        }
      } catch (err) {
        console.error('Failed to fetch timeline steps:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchTimeline();
    return () => {
      active = false;
    };
  }, [cert]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-white/40 justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-[#6C3EF4]" />
        <span className="text-xs font-mono">Fetching timeline history...</span>
      </div>
    );
  }

  if (steps.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.01] p-4 shrink-0">
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-[#00D4AA]" />
        <h4 className="text-xs font-mono uppercase tracking-[0.2em] text-[#00D4AA]">
          Evidence Timeline ({steps.length} Steps)
        </h4>
      </div>

      <div className="relative pl-4 border-l border-white/10 space-y-4">
        {steps.map((step) => {
          const color = STEP_TYPE_COLORS[step.step_type] || '#A8A0D8';
          const label = STEP_TYPE_LABELS[step.step_type] || step.step_type;
          
          return (
            <div key={step.id} className="relative group">
              <div 
                className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border border-[#07061A]"
                style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
              />
              
              <div className="flex items-start gap-3">
                {step.preview_url && (
                  <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-black/40">
                    <img src={step.preview_url} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white group-hover:text-[#00D4AA] transition-colors">
                      {step.title}
                    </span>
                    <span 
                      className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded tracking-wider"
                      style={{ backgroundColor: `${color}15`, color: color, border: `1px solid ${color}30` }}
                    >
                      {label}
                    </span>
                  </div>
                  
                  {step.description && (
                    <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed">
                      {step.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-3 mt-1 text-[9px] font-mono text-white/30">
                    <span>SHA-256: {step.sha256.slice(0, 8)}…{step.sha256.slice(-6)}</span>
                    {step.created_at && (
                      <span>{new Date(step.created_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InspectorChain({
  cert,
  canExportEvidencePack,
  reduce,
}: {
  cert: CertRow;
  canExportEvidencePack: boolean;
  reduce: boolean;
}) {
  const record = useMemo(() => toCertificateRecord(cert), [cert]);

  return (
    <div className="relative px-6 py-5 flex flex-col h-full">
      {/* Header copy */}
      <div className="mb-4 shrink-0">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-[#A8A0D8] mb-1.5">
          Chain of Evidence Studio
        </p>
        <h3 className="text-[16px] font-bold text-white">
          制作プロセスの暗号証明を組み立てる
        </h3>
        <p className="mt-1.5 text-[12.5px] text-white/55 leading-relaxed max-w-2xl">
          ラフ → 線画 → 着色 → 完成 まで、各工程のSHA-256ハッシュをチェーンして単一の不可逆な存在証明を構築します。
        </p>
      </div>

      {/* Evidence Timeline */}
      <EvidenceChainViewer cert={cert} />

      {/* The composer & Shield */}
      <div className="relative flex-1 min-h-[500px]">
        <Suspense fallback={<MinimalSpinner />}>
          <ProcessBundleComposer certificate={record} />
        </Suspense>

        {/* 🚨 THE ABSOLUTE SHIELD: 漆黒のグラデーションで本来のボタンを物理的に封殺する */}
        {!canExportEvidencePack && (
          <div
            className="absolute bottom-0 left-0 right-0 z-20 flex flex-col justify-end pt-40 pb-4 pointer-events-none"
            style={{
              background: 'linear-gradient(to bottom, rgba(7,6,26,0) 0%, rgba(7,6,26,0.85) 40%, rgba(7,6,26,1) 100%)',
              margin: '0 -24px', // px-6の余白を打ち消して画面幅いっぱいにシールドを張る
              paddingLeft: '24px',
              paddingRight: '24px',
            }}
          >
            {/* この中身だけはクリック可能（pointer-events-auto）にする */}
            <div className="pointer-events-auto w-full">
              <PaywallTrialValue reduce={reduce} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
 *  Paywall — Trial Value (体験先導型)
 * ══════════════════════════════════════════════════════════════ */

function PaywallTrialValue({ reduce }: { reduce: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: PM_EASE, delay: 0.15 }}
      className="relative z-10 w-full max-w-3xl mx-auto"
    >
      <div
        className="relative overflow-hidden rounded-2xl p-5 sm:p-6"
        style={{
          background:
            'linear-gradient(165deg, rgba(108,62,244,0.16) 0%, rgba(0,212,170,0.10) 50%, rgba(7,6,26,0.92) 100%)',
          border: '1px solid rgba(108,62,244,0.45)',
          boxShadow: '0 20px 60px -20px rgba(108,62,244,0.55), inset 0 0 0 1px rgba(255,255,255,0.04)',
          backdropFilter: 'blur(18px)',
        }}
      >
        {/* top hairline */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(108,62,244,0.85), rgba(0,212,170,0.85), transparent)',
          }}
        />

        <div className="flex items-start gap-4">
          {/* Locked gradient icon */}
          <motion.div
            className="relative shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #6C3EF4 0%, #00D4AA 100%)',
              boxShadow: '0 12px 30px -8px rgba(108,62,244,0.65)',
            }}
            animate={
              reduce
                ? undefined
                : {
                    boxShadow: [
                      '0 12px 30px -8px rgba(108,62,244,0.65), 0 0 0 0 rgba(0,212,170,0.55)',
                      '0 12px 30px -8px rgba(108,62,244,0.65), 0 0 0 12px rgba(0,212,170,0)',
                      '0 12px 30px -8px rgba(108,62,244,0.65), 0 0 0 0 rgba(0,212,170,0.55)',
                    ],
                  }
            }
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Lock className="w-6 h-6 text-white" strokeWidth={2} />
          </motion.div>

          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-[#BC78FF]">
              Trial Value · 体験できています
            </p>
            <h4 className="mt-1 text-[16px] sm:text-[17px] font-bold text-white leading-snug">
              過程の暗号証明 (Evidence Pack エクスポート) は
              <span
                className="bg-clip-text text-transparent ml-1.5"
                style={{ backgroundImage: 'linear-gradient(90deg, #BC78FF, #00D4AA)' }}
              >
                Creator プラン
              </span>
              限定です。
            </h4>
            <p className="mt-2 text-[12.5px] text-white/65 leading-relaxed">
              チェーンの組み立てはご自由にお試しください。発行可能になると、ラフ→完成の全工程が
              <strong className="text-white"> RFC3161 タイムスタンプ </strong>
              で封印され、ZIP一発で納品できるようになります。
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <a
                href="/pricing#creator"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12.5px] font-bold text-white"
                style={{
                  background: 'linear-gradient(135deg, #6C3EF4 0%, #8B61FF 100%)',
                  boxShadow: '0 14px 32px -10px rgba(108,62,244,0.7)',
                }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Creatorプランで解放する
              </a>
              <a
                href="/what-it-proves#chain"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold text-white/75 hover:text-white border border-white/10 hover:bg-white/[0.05] transition-colors"
              >
                チェーン証明の仕組みを見る
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
 *  Project Assign popover
 * ══════════════════════════════════════════════════════════════ */

interface ProjectAssignButtonProps {
  currentProjectId: string | null;
  currentProjectName: string | null;
  currentProjectColor: string | null;
  projects: ReturnType<typeof useStudioOps>['projects'];
  onAssign: (projectId: string | null) => void | Promise<void>;
}

function ProjectAssignButton({
  currentProjectId,
  currentProjectName,
  currentProjectColor,
  projects,
  onAssign,
}: ProjectAssignButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] text-[11px] text-white/75 transition-colors max-w-[180px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C3EF4]"
      >
        {currentProjectColor && (
          <span
            aria-hidden="true"
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: currentProjectColor }}
          />
        )}
        <FolderKanban className="w-3 h-3 opacity-60" />
        <span className="truncate">{currentProjectName || '未分類'}</span>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute z-30 mt-1 w-56 max-h-[280px] overflow-y-auto rounded-xl border border-white/10 bg-[#12121e]/95 backdrop-blur-xl p-1.5 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)]"
        >
          <button
            type="button"
            role="option"
            aria-selected={currentProjectId === null}
            onClick={() => {
              void onAssign(null);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] text-white/60 hover:bg-white/[0.05] hover:text-white transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-white/30" aria-hidden="true" />
            未分類
          </button>
          <div className="my-1 mx-2 border-t border-white/5" />
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={currentProjectId === p.id}
              onClick={() => {
                void onAssign(p.id);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] text-white/80 hover:bg-white/[0.05] hover:text-white transition-colors"
            >
              <span
                aria-hidden="true"
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: p.color }}
              />
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
 *  States
 * ══════════════════════════════════════════════════════════════ */

function MinimalSpinner() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#07061A' }}
    >
      <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-[#00D4AA] animate-spin" />
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div
      className="grid gap-4 mt-2"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
      role="status"
      aria-label="読み込み中"
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden"
        >
          <div className="aspect-[4/3] bg-white/[0.03] animate-pulse" />
          <div className="p-3.5 space-y-2">
            <div className="h-3 w-2/3 rounded bg-white/[0.04] animate-pulse" />
            <div className="h-2.5 w-1/2 rounded bg-white/[0.03] animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.015] py-14 text-center">
      <BadgeCheck className="w-7 h-7 text-white/30 mx-auto mb-3" aria-hidden="true" />
      <p className="text-[14px] text-white/65 font-semibold">
        まだ証明書がありません
      </p>
      <p className="text-[11px] text-white/40 mt-1">
        上の「新しい証明を発行」からファイルをドロップするだけで、最初の証明が記録されます。
      </p>
    </div>
  );
}

function NoMatch({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] py-10 text-center">
      <Info className="w-5 h-5 text-white/40 mx-auto mb-2" aria-hidden="true" />
      <p className="text-[13px] text-white/65">
        条件に一致する証明書が見つかりません。
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-4 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold text-white border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
      >
        <Plus className="w-3 h-3 rotate-45" />
        フィルタをリセット
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
 *  Helpers
 * ══════════════════════════════════════════════════════════════ */

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toCertificateRecord(cert: CertRow): CertificateRecord {
  return {
    id: cert.id,
    title: cert.title ?? null,
    sha256: cert.sha256 ?? cert.file_hash ?? '',
    proof_mode: cert.proof_mode === 'shareable' ? 'shareable' : 'private',
    visibility:
      cert.visibility === 'public' || cert.visibility === 'unlisted'
        ? cert.visibility
        : 'private',
    public_verify_token: cert.id,
    public_image_url: cert.public_image_url ?? null,
    storage_path: null,
    file_name: cert.file_name ?? null,
    mime_type: null,
    file_size: null,
    width_px: null,
    height_px: null,
    badge_tier: 'basic',
    process_bundle_id: null,
    metadata_json: cert.metadata ?? null,
    proven_at: cert.certified_at ?? cert.created_at,
    created_at: cert.created_at,
  };
}
