/**
 * Dashboard.studio.tsx — Phase Studio Repair (Stripe / Vercel-grade Console)
 *
 * 設計責任:
 *   1. Hero (上段): SlimUploadDock を常設マウント。画面を占有しない、
 *      Vercel "New Project" / Stripe "Quick Action" のような細い帯。
 *      展開時のみ既存 CertificateUpload.c2pa-patch.tsx をフルロードする。
 *   2. KPI (中段): 「管理中の証明数 / Trusted TSA / 要対応 / 直近発行」。
 *      "0/34件が証明済み" のような誤読されやすい文言を完全に廃止。
 *   3. Management (下段): 既存の強力な機能を温存・強化。
 *        - ProjectRail (案件チップ + 件数 + Trusted カウント)
 *        - Toolbar (検索 / 信頼 Tab / ソート / Grid・List 切替 / アーカイブ表示)
 *        - Studio plan のみ AttentionTray + StatusMenu + ProjectComposer + AuditDrawer
 *        - Free / Creator は CreatorDashboard に委譲することなく、ここで一括描画
 *
 * 厳守事項:
 *   - 既存型 (proofmark-types.ts) と pm.* デザイントークンを 1mm も壊さない。
 *   - any キャストは構造起因の境界 1 箇所のみに局所化し、残りは厳密推論。
 *   - useStudioOps / useC2pa / useAuth / supabase 直接呼び出しのロジックは温存。
 *   - 削除しない: 検索 / ソート / view モード / アーカイブ / 信頼バッジ / ProjectRail。
 *
 * 参考実装:
 *   - 既存 Dashboard.tsx の deriveTrustTier / TrustBadge / ProjectChip / Toolbar
 *   - 旧 Dashboard.studio.tsx の AttentionTray / StatusMenu / AuditDrawer / ProjectComposer
 *   - 新規 SlimUploadDock (Hero 部の slim shell)
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
import { motion } from 'framer-motion';
import {
  Archive,
  ArchiveRestore,
  ArrowUpDown,
  BadgeCheck,
  Check,
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
  Plus,
  Rows3,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
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

// Process Bundle Composer (Chain of Evidence) は Studio で開く可能性あり。Lazy load。
const ProcessBundleComposer = lazy(() =>
  import('../components/proof/ProcessBundleComposer').then((m) => ({
    default: m.ProcessBundleComposer,
  })),
);

/* ──────────────────────────────────────────────────────────────────────────
   Types — 既存テーブル列のスーパーセット (壊さない)
────────────────────────────────────────────────────────────────────────── */

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
  /** Sprint 3 — Studio fields */
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
    sublabel: provider ? provider.toUpperCase() : 'FREETSA',
    color: '#9BA3D4',
    border: 'rgba(155,163,212,0.35)',
    bg: 'rgba(155,163,212,0.10)',
    icon: ShieldAlert,
    description: 'β版TSAによる発行。RFC3161として有効ですがSLAなしです。',
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   Component — Single page, dual capability (Creator + Studio)
────────────────────────────────────────────────────────────────────────── */

export default function DashboardStudioWrapper() {
  const { user, loading: authLoading, signOut } = useAuth();
  const ops = useStudioOps();
  const [, navigate] = useLocation();

  // 認証ガード
  useEffect(() => {
    if (!authLoading && !user) navigate('/auth?redirect=/dashboard');
  }, [authLoading, user, navigate]);

  if (authLoading || ops.loading) return <MinimalSpinner />;
  if (!user) return null;

  const isStudio = ops.isStudio;

  return (
    <StudioCanvas
      user={user}
      signOut={signOut}
      ops={ops}
      isStudio={isStudio}
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

interface StudioCanvasProps {
  user: ReturnType<typeof useAuth>['user'];
  signOut: ReturnType<typeof useAuth>['signOut'];
  ops: ReturnType<typeof useStudioOps>;
  isStudio: boolean;
}

function StudioCanvas({ user, signOut, ops, isStudio }: StudioCanvasProps) {
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(true);

  // フィルタ / ソート / 表示モード — Dashboard.tsx と完全互換
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'starred' | 'trust'>('newest');
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [activeProjectId, setActiveProjectId] = useState<string>(ALL_PROJECTS_ID);
  const [showArchived, setShowArchived] = useState(false);
  const [trustFilter, setTrustFilter] = useState<TrustTier | 'all'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Studio 専用ドロワー
  const [composerOpen, setComposerOpen] = useState(false);
  const [auditCertId, setAuditCertId] = useState<string | null>(null);
  const [auditCertTitle, setAuditCertTitle] = useState<string | null>(null);
  const [chainCert, setChainCert] = useState<CertificateRecord | null>(null);

  /* ── データ取得 (Studio: 自分 + チーム / Creator: 自分のみ) ── */
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

  /* ── 派生: フィルタ済み + 案件適用 ── */
  const visibleCerts = useMemo(
    () => (showArchived ? certs : certs.filter((c) => !c.is_archived)),
    [certs, showArchived],
  );

  const filteredSortedCerts = useMemo(() => {
    let r = [...visibleCerts];

    // 検索 (Studio時のプロジェクト名検索漏れを修正)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      // Studio用にプロジェクトIDから名前を引けるMapを事前作成
      const projectMap = isStudio ? new Map(ops.projects.map((p) => [p.id, p.name.toLowerCase()])) : new Map();
      
      r = r.filter((c) => {
        // StudioならMapから名前を取得、Creatorならclient_projectを直接使用
        const projectName = isStudio && c.project_id 
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

    // 案件フィルタ — Studio は project_id, Creator は client_project
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

    // 信頼フィルタ
    if (trustFilter !== 'all') {
      r = r.filter((c) => deriveTrustTier(c).tier === trustFilter);
    }

    // ソート (パフォーマンスチューニング: Dateパースを最小限に)
    const rank: Record<TrustTier, number> = { cross: 0, trusted: 1, beta: 2, pending: 3 };
    
    // 事前にタイムスタンプを計算してキャッシュ (Schwartzian transform的アプローチ)
    const sorted = r.map(c => ({
      cert: c,
      time: new Date(c.created_at).getTime() || 0,
      trustRank: rank[deriveTrustTier(c).tier]
    })).sort((a, b) => {
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

    return sorted.map(item => item.cert);
  }, [visibleCerts, activeProjectId, searchQuery, trustFilter, sortBy, isStudio, ops.projects]);

  /* ── 派生: ProjectRail の chips ── */
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
      // Creator: client_project 文字列でグルーピング
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

  /* ── 派生: KPI (ロード時のチラつき防止) ── */
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

  /* ── 派生: AttentionTray (Studio only) ── */
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

  /* ── handlers ── */
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

  const handleEvidence = useCallback(async (cert: CertRow) => {
    try {
      toast.loading('Evidence Pack を生成しています...', { id: `evidence-${cert.id}` });
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/generate-evidence-pack?cert=${cert.id}`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        credentials: 'omit',
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; reqId?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const cd = res.headers.get('content-disposition') || '';
      const m5987 = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cd);
      const mPlain = /filename\s*=\s*"?([^";]+)"?/i.exec(cd);
      const filename = m5987
        ? decodeURIComponent(m5987[1])
        : mPlain
          ? mPlain[1]
          : `proofmark-evidence-${cert.id.slice(0, 8)}.zip`;
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      toast.success('Evidence Pack をダウンロードしました', { id: `evidence-${cert.id}` });
    } catch (e) {
      toast.error('Evidence Pack 生成に失敗', {
        id: `evidence-${cert.id}`,
        description: e instanceof Error ? e.message : 'API をご確認ください。',
      });
    }
  }, []);

  const handleAssignClientProject = useCallback(async (cert: CertRow) => {
    const current = cert.client_project ?? '';
    const next = window.prompt(
      'この証明書を紐づける案件名 (例: ACME社 / 表紙イラスト)',
      current,
    );
    if (next === null) return;
    const trimmed = next.trim() || null;
    setCerts((prev) =>
      prev.map((c) => (c.id === cert.id ? { ...c, client_project: trimmed } : c)),
    );
    const { error } = await supabase
      .from('certificates')
      .update({ client_project: trimmed })
      .eq('id', cert.id);
    if (error) {
      setCerts((prev) =>
        prev.map((c) => (c.id === cert.id ? { ...c, client_project: current } : c)),
      );
      toast.error('案件の紐づけに失敗', { description: error.message });
    } else {
      toast.success(trimmed ? `「${trimmed}」に紐づけました` : '案件の紐づけを解除しました');
    }
  }, []);

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

  /* ───────────────── Render ───────────────── */

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background:
          'radial-gradient(1200px 600px at 50% -10%, rgba(108,62,244,0.06), transparent 60%), linear-gradient(180deg, #07061A 0%, #0a0a16 100%)',
      }}
    >
      <Navbar user={user} signOut={signOut} />

      <main className="max-w-[1240px] mx-auto px-4 sm:px-6 pb-24">
        {/* ───────── Hero: Slim Upload Dock + Title ───────── */}
        <section className="pt-8 pb-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mb-5 flex items-baseline justify-between gap-3"
          >
            <div className="min-w-0">
              <p
                className="text-[10px] font-bold tracking-[0.3em] uppercase"
                style={{ color: 'rgba(255,255,255,0.45)' }}
              >
                {isStudio ? 'Evidence Operations · Studio' : 'Evidence Console'}
              </p>
              <h1 className="text-[26px] sm:text-[28px] font-black tracking-tight mt-1">
                {user?.user_metadata?.username ? `@${user.user_metadata.username}` : 'Dashboard'}
              </h1>
            </div>
            <span className="hidden md:inline text-[11px] text-white/40">
              {ops.planTier ? `${ops.planTier.toUpperCase()} プラン` : ''}
            </span>
          </motion.div>

          {/* Slim Upload Dock — 既存 CertificateUpload を温存しつつ薄い帯で配置 */}
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

        {/* ───────── Attention Tray (Studio only) ───────── */}
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
                beta: kpi.beta,
                trusted: visibleCerts.filter((c) => deriveTrustTier(c).tier === 'trusted').length,
                cross: visibleCerts.filter((c) => deriveTrustTier(c).tier === 'cross').length,
                pending: kpi.pending,
              }}
            />

            <SegGroup ariaLabel="並び替え">
              <SegBtn active={sortBy === 'newest'} onClick={() => setSortBy('newest')}>
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">最新</span>
              </SegBtn>
              <SegBtn active={sortBy === 'trust'} onClick={() => setSortBy('trust')}>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">信頼順</span>
              </SegBtn>
              <SegBtn active={sortBy === 'starred'} onClick={() => setSortBy('starred')}>
                <Star className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">保護優先</span>
              </SegBtn>
            </SegGroup>

            <SegGroup ariaLabel="表示モード">
              <SegBtn active={view === 'list'} onClick={() => setView('list')} title="テーブル表示">
                <Rows3 className="w-3.5 h-3.5" />
              </SegBtn>
              <SegBtn active={view === 'grid'} onClick={() => setView('grid')} title="カード表示">
                <LayoutGrid className="w-3.5 h-3.5" />
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
              onCopyLink={handleCopyLink}
              onEvidence={handleEvidence}
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
              onOpenChain={(cert) => setChainCert(toCertificateRecord(cert))}
            />
          ) : (
            <CertGridView
              certs={filteredSortedCerts}
              copiedId={copiedId}
              onCopyLink={handleCopyLink}
              onEvidence={handleEvidence}
              onArchive={handleArchive}
              onToggleStar={handleToggleStar}
              onAssignClientProject={handleAssignClientProject}
              onOpenChain={(cert) => setChainCert(toCertificateRecord(cert))}
            />
          )}
        </section>
      </main>

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

      {/* ── Chain of Evidence modal ── */}
      {chainCert && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
          style={{ background: 'rgba(7,6,26,0.92)', backdropFilter: 'blur(8px)' }}
        >
          <div className="w-full max-w-4xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#A8A0D8] mb-1">
                  Chain of Evidence Studio
                </p>
                <h2 className="text-lg font-bold text-white">
                  {chainCert.title ?? chainCert.file_name ?? chainCert.id}
                </h2>
              </div>
              <button
                onClick={() => setChainCert(null)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#A8A0D8] hover:text-white border border-[#1C1A38] hover:border-[#6C3EF4]/40 rounded-xl transition-colors"
              >
                ✕ 閉じる
              </button>
            </div>
            <Suspense fallback={<MinimalSpinner />}>
              <ProcessBundleComposer certificate={chainCert} />
            </Suspense>
          </div>
        </div>
      )}

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

/* ──────────────────────────────────────────────────────────────────────────
   Subcomponents
────────────────────────────────────────────────────────────────────────── */

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
    { key: 'cross', label: `Cross ${counts.cross}`, color: '#F0BB38' },
    { key: 'trusted', label: `Trusted ${counts.trusted}`, color: '#00D4AA' },
    { key: 'beta', label: `Beta ${counts.beta}`, color: '#9BA3D4' },
    { key: 'pending', label: `Pending ${counts.pending}`, color: '#A8A0D8' },
  ];
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

function TrustBadge({ cert, size = 'md' }: { cert: CertRow; size?: 'sm' | 'md' }) {
  const t = deriveTrustTier(cert);
  const Icon = t.icon;
  const dims = size === 'sm' ? { pad: '2px 8px', fs: 10, ic: 11 } : { pad: '4px 10px', fs: 11, ic: 14 };
  return (
    <span
      title={t.description}
      className="inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wider whitespace-nowrap"
      style={{
        padding: dims.pad,
        background: t.bg,
        border: `1px solid ${t.border}`,
        color: t.color,
        fontSize: dims.fs,
      }}
    >
      <Icon style={{ width: dims.ic, height: dims.ic }} />
      {t.label}
      <span className="opacity-70 font-normal normal-case">· {t.sublabel}</span>
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*   List view (table) — Studio で StatusMenu / Audit を露出                 */
/* ──────────────────────────────────────────────────────────────────────── */

interface ListViewProps {
  certs: CertRow[];
  isStudio: boolean;
  ops: ReturnType<typeof useStudioOps>;
  copiedId: string | null;
  onCopyLink: (cert: CertRow) => void;
  onEvidence: (cert: CertRow) => void;
  onArchive: (cert: CertRow, next: boolean) => void;
  onToggleStar: (id: string, current: boolean) => void;
  onAssignClientProject: (cert: CertRow) => void;
  onAssignProjectId: (cert: CertRow, projectId: string | null) => void;
  onStatusChange: (cert: CertRow, next: DeliveryStatus | null) => void;
  onOpenAudit: (cert: CertRow) => void;
  onOpenChain: (cert: CertRow) => void;
}

function CertListTable(props: ListViewProps) {
  const {
    certs,
    isStudio,
    ops,
    copiedId,
    onCopyLink,
    onEvidence,
    onArchive,
    onToggleStar,
    onAssignClientProject,
    onAssignProjectId,
    onStatusChange,
    onOpenAudit,
    onOpenChain,
  } = props;

  const cols = isStudio
    ? '2fr 1fr 1fr 0.9fr auto'
    : '2.2fr 1fr 1fr 0.9fr auto';

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-md">
      <div className="min-w-[920px]">
        <div
          role="row"
          className="grid gap-3 px-4 py-3 text-[10px] uppercase tracking-widest text-white/40 border-b border-white/5"
          style={{ gridTemplateColumns: cols }}
        >
          <span role="columnheader">案件 / タイトル</span>
          <span role="columnheader">{isStudio ? 'ステータス' : '信頼レベル'}</span>
          <span role="columnheader">案件</span>
          <span role="columnheader">発行</span>
          <span role="columnheader" className="text-right">
            操作
          </span>
        </div>
        {certs.map((cert) => {
          const project =
            isStudio && cert.project_id
              ? ops.projects.find((p) => p.id === cert.project_id)
              : null;
          return (
            <div
              key={cert.id}
              id={`cert-row-${cert.id}`}
              role="row"
              className="grid gap-3 px-4 py-3 border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors"
              style={{ gridTemplateColumns: cols }}
            >
              {/* タイトル + ハッシュ */}
              <div role="cell" className="min-w-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleStar(cert.id, !!cert.is_starred)}
                    className="shrink-0 text-white/35 hover:text-[#F0BB38] transition-colors"
                    title={cert.is_starred ? '保護を解除' : '保護'}
                  >
                    <Star
                      className="w-3.5 h-3.5"
                      fill={cert.is_starred ? '#F0BB38' : 'transparent'}
                    />
                  </button>
                  <p className="text-[13px] font-semibold text-white truncate">
                    {cert.title || cert.file_name || 'Untitled'}
                  </p>
                  {!isStudio && <TrustBadge cert={cert} size="sm" />}
                </div>
                <p className="text-[10.5px] text-white/40 font-mono truncate mt-0.5 ml-5">
                  <Hash className="inline w-2.5 h-2.5 mr-1" />
                  {(cert.sha256 || cert.file_hash || '').slice(0, 24)}…
                </p>
              </div>

              {/* ステータス or 信頼バッジ */}
              <div role="cell" className="self-center">
                {isStudio ? (
                  <StatusMenu
                    current={cert.delivery_status ?? null}
                    onChange={(next) => onStatusChange(cert, next)}
                  />
                ) : (
                  <TrustBadge cert={cert} size="sm" />
                )}
              </div>

              {/* 案件 (Studio: project_id, Creator: client_project) */}
              <div role="cell" className="self-center">
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

              {/* 発行 */}
              <div role="cell" className="self-center text-[11px] text-white/55 tabular-nums">
                {cert.certified_at
                  ? formatDate(cert.certified_at)
                  : cert.created_at
                    ? formatDate(cert.created_at)
                    : '—'}
              </div>

              {/* 操作 */}
              <div role="cell" className="flex items-center justify-end gap-1">
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
      onClick={onClick}
      title={title}
      aria-label={title}
      className="p-1.5 rounded-lg text-white/55 hover:text-white hover:bg-white/[0.05] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4AA]"
    >
      {children}
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*   Grid view — 軽量なカード                                                */
/* ──────────────────────────────────────────────────────────────────────── */

interface GridViewProps {
  certs: CertRow[];
  copiedId: string | null;
  onCopyLink: (cert: CertRow) => void;
  onEvidence: (cert: CertRow) => void;
  onArchive: (cert: CertRow, next: boolean) => void;
  onToggleStar: (id: string, current: boolean) => void;
  onAssignClientProject: (cert: CertRow) => void;
  onOpenChain: (cert: CertRow) => void;
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
    onOpenChain,
  } = props;
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
    >
      {certs.map((cert) => (
        <article
          key={cert.id}
          id={`cert-row-${cert.id}`}
          className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-md overflow-hidden hover:border-[#6C3EF4]/40 transition-colors"
        >
          <div
            className="relative aspect-[4/3]"
            style={{ background: 'linear-gradient(135deg, rgba(108,62,244,0.08), rgba(0,212,170,0.05))' }}
          >
            {cert.proof_mode === 'shareable' && cert.public_image_url ? (
              <img
                src={cert.public_image_url}
                alt={cert.original_filename || cert.file_name || 'Artwork'}
                loading="lazy"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <ShieldCheck className="w-10 h-10 text-white/20" />
              </div>
            )}
            <div className="absolute top-2 left-2">
              <TrustBadge cert={cert} size="sm" />
            </div>
            <button
              type="button"
              onClick={() => onToggleStar(cert.id, !!cert.is_starred)}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white/70 hover:text-[#F0BB38] transition-colors"
              title={cert.is_starred ? '保護解除' : '保護'}
            >
              <Star className="w-3.5 h-3.5" fill={cert.is_starred ? '#F0BB38' : 'transparent'} />
            </button>
            {cert.is_archived && (
              <div className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/55 text-[9px] font-bold uppercase text-white/70">
                <Archive className="w-2.5 h-2.5" />
                Archived
              </div>
            )}
          </div>

          <div className="p-3.5 space-y-2.5">
            <div className="flex items-baseline justify-between gap-2 min-w-0">
              <p className="text-[13px] font-semibold text-white truncate">
                {cert.title || cert.original_filename || cert.file_name || 'Untitled'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onAssignClientProject(cert)}
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

            <div className="grid grid-cols-2 gap-1.5 pt-1.5">
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
            <div className="flex items-center justify-between pt-1">
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
        </article>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*   Project Assign popover (Studio)                                         */
/* ──────────────────────────────────────────────────────────────────────── */

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

/* ──────────────────────────────────────────────────────────────────────── */
/*   States                                                                  */
/* ──────────────────────────────────────────────────────────────────────── */

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
    <div className="space-y-2 mt-2" role="status" aria-label="読み込み中">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-white/5 bg-white/[0.02] h-14 animate-pulse"
        />
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

/* ──────────────────────────────────────────────────────────────────────── */
/*   Helpers                                                                 */
/* ──────────────────────────────────────────────────────────────────────── */

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

/**
 * CertRow を CertificateRecord 互換のオブジェクトに射影する。
 * ProcessBundleComposer が要求するフィールドのみを満たすようマップし、
 * 必須でないものは null/既定値で埋める。`any` キャストは構造起因の境界 1 箇所に局所化。
 */
function toCertificateRecord(cert: CertRow): CertificateRecord {
  return {
    id: cert.id,
    title: cert.title ?? null,
    sha256: cert.sha256 ?? cert.file_hash ?? '',
    proof_mode: (cert.proof_mode === 'shareable' ? 'shareable' : 'private'),
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
