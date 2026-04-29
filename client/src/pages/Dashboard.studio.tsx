/**
 * Dashboard.studio.tsx — Sprint 3「Creator First, Studio Ready」
 *
 * これは既存の `Dashboard.tsx` を**置き換えない**形の拡張ラッパーです。
 * Progressive Disclosure を厳守するため、以下の方針で書かれています：
 *
 *   1. Free / Creator ユーザー:
 *      - 既存と完全に同じ「フラットで身軽な」体験を保つ。
 *      - Project Composer / AttentionTray / AuditDrawer は描画されない。
 *      - 既存の `client_project` テキストフィールドはそのまま動作。
 *
 *   2. Studio / Business ユーザー:
 *      - 同じキャンバスの上に、案件フォルダ・要対応バンド・ステータス列・
 *        監査ドロワーが「自然な拡張」として乗る。
 *      - 別アプリ感ゼロ。配色・タイポ・モーションは既存と同一トークン。
 *
 *   3. データ整合性:
 *      - 案件付け替え／ステータス変更は `/api/certificates/assign-project`
 *        を経由し、サーバ側で監査ハッシュチェーンに必ず記録される。
 *      - フロントから直接 `supabase.from("certificates").update` は使わない。
 *
 * 適用方法:
 *   既存の `Dashboard.tsx` をそのまま残し、
 *     <Route path="/dashboard" component={DashboardStudioWrapper} />
 *   と差し替える。中身は plan_tier に応じて Creator / Studio を出し分けます。
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Plus, History, Layers3, ShieldCheck, FolderKanban } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useStudioOps, type ProjectRecord } from '../hooks/useStudioOps';
import { supabase } from '../lib/supabase';
import { ProjectRail, type ProjectChipModel } from '../components/projects/ProjectRail';
import { ProjectComposer } from '../components/projects/ProjectComposer';
import { AttentionTray } from '../components/ops/AttentionTray';
import { StatusMenu } from '../components/ops/StatusMenu';
import { AuditDrawer } from '../components/ops/AuditDrawer';
import {
  DELIVERY_STATUS_TOKENS,
  type DeliveryStatus,
  compareByAttention,
} from '../lib/proofmark-ops';

// 既存 Dashboard を遅延ロードして、Free / Creator にバンドル肥大化を波及させない。
const CreatorDashboard = lazy(() => import('./Dashboard'));

interface CertRow {
  id: string;
  user_id: string;
  title?: string | null;
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
  is_archived?: boolean | null;
  client_project?: string | null;
  /** Sprint 3 — Studio fields */
  project_id?: string | null;
  delivery_status?: DeliveryStatus | null;
  team_id?: string | null;
}

const ALL_PROJECTS_ID = '__all__';
const UNASSIGNED_ID = '__unassigned__';

export default function DashboardStudioWrapper() {
  const { user, loading: authLoading } = useAuth();
  const ops = useStudioOps();
  const [, navigate] = useLocation();

  // 1. 認証またはOpsデータのロード中はスピナーで完全待機（フラッシュ防止）
  if (authLoading || ops.loading) {
    return <MinimalSpinner />;
  }

  // 2. ロード完了後、Studio権限がない場合はCreator版を返す
  if (!ops.isStudio) {
    return (
      <Suspense fallback={<MinimalSpinner />}>
        <CreatorDashboard />
      </Suspense>
    );
  }

  // 3. Studio権限がある場合のみ、Ops拡張版をマウント
  return (
    <StudioDashboard
      ops={ops}
      authLoading={authLoading}
      onAuthRedirect={() => navigate('/auth')}
    />
  );
}

/* ───────────────────────────────────────────────────────────────────── */

interface StudioProps {
  ops: ReturnType<typeof useStudioOps>;
  authLoading: boolean;
  onAuthRedirect: () => void;
}

function StudioDashboard({ ops, authLoading, onAuthRedirect }: StudioProps) {
  const { user } = useAuth();
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState<string>(ALL_PROJECTS_ID);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerInitial, setComposerInitial] = useState<Partial<ProjectRecord> | null>(null);
  const [auditCertId, setAuditCertId] = useState<string | null>(null);
  const [auditCertTitle, setAuditCertTitle] = useState<string | null>(null);

  // ── auth gate ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) onAuthRedirect();
  }, [authLoading, user, onAuthRedirect]);

  // ── load certificates (RLS-filtered; Studio: own + team) ──────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoadingCerts(true);
      const { data, error } = await supabase
        .from('certificates')
        .select(
          'id, user_id, title, file_name, file_hash, sha256, thumbnail_url, public_image_url, ' +
          'proof_mode, visibility, created_at, certified_at, tsa_provider, timestamp_token, ' +
          'is_archived, client_project, project_id, delivery_status, team_id',
        )
        .order('created_at', { ascending: false })
        .limit(500);
      if (cancelled) return;
      if (error) {
        toast.error('証明書の取得に失敗しました', { description: error.message });
        setCerts([]);
      } else {
        setCerts((data ?? []) as CertRow[]);
      }
      setLoadingCerts(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // ── derived: project chips ────────────────────────────────────────────
  const projectChips: ProjectChipModel[] = useMemo(() => {
    const visible = certs.filter((c) => !c.is_archived);
    const projectMap = new Map(ops.projects.map((p) => [p.id, p]));

    const counters = new Map<string, ProjectChipModel>();
    counters.set(ALL_PROJECTS_ID, {
      id: ALL_PROJECTS_ID, name: 'すべての案件', count: visible.length, synthetic: true,
    });

    // 既存 Studio プロジェクトを必ず先に並べる（空でも見える）
    for (const p of ops.projects) {
      counters.set(p.id, {
        id: p.id,
        name: p.name,
        count: 0,
        color: p.color,
        dueAt: p.due_at,
        needsAttention: 0,
        trustedCount: 0,
      });
    }

    for (const c of visible) {
      const id = c.project_id || UNASSIGNED_ID;
      const existing = counters.get(id) ?? {
        id,
        name: id === UNASSIGNED_ID
          ? '未分類'
          : projectMap.get(id)?.name ?? c.client_project ?? '未分類',
        count: 0,
        color: id === UNASSIGNED_ID ? undefined : projectMap.get(id)?.color,
        synthetic: id === UNASSIGNED_ID,
        needsAttention: 0,
        trustedCount: 0,
        dueAt: id === UNASSIGNED_ID ? null : projectMap.get(id)?.due_at ?? null,
      };
      existing.count += 1;
      if (c.delivery_status === 'review' || c.delivery_status === 'ready') {
        existing.needsAttention = (existing.needsAttention ?? 0) + 1;
      }
      const provider = (c.tsa_provider ?? '').toLowerCase();
      if (['digicert', 'globalsign', 'seiko', 'sectigo'].includes(provider)) {
        existing.trustedCount = (existing.trustedCount ?? 0) + 1;
      }
      counters.set(id, existing);
    }
    return Array.from(counters.values());
  }, [certs, ops.projects]);

  // ── derived: filtered certificates for the grid ───────────────────────
  const visibleCerts = useMemo(() => {
    let r = certs.filter((c) => !c.is_archived);
    if (activeProjectId !== ALL_PROJECTS_ID) {
      r = r.filter((c) => (c.project_id || UNASSIGNED_ID) === activeProjectId);
    }
    // 要対応 → 進行中 → 納品準備 → … の順
    r.sort((a, b) => {
      const c = compareByAttention(a.delivery_status ?? null, b.delivery_status ?? null);
      if (c !== 0) return c;
      return (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0);
    });
    return r;
  }, [certs, activeProjectId]);

  // ── derived: AttentionTray feed ───────────────────────────────────────
  const attentionItems = useMemo(() => {
    const projectMap = new Map(ops.projects.map((p) => [p.id, p]));
    return certs
      .filter((c) => !c.is_archived)
      .map((c) => ({
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
  }, [certs, ops.projects]);

  // ── KPI ───────────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const total = certs.filter((c) => !c.is_archived).length;
    const trusted = certs.filter((c) => {
      const p = (c.tsa_provider ?? '').toLowerCase();
      return ['digicert', 'globalsign', 'seiko', 'sectigo'].includes(p);
    }).length;
    const review = certs.filter((c) => c.delivery_status === 'review').length;
    const ready = certs.filter((c) => c.delivery_status === 'ready').length;
    return { total, trusted, review, ready };
  }, [certs]);

  // ── handlers ──────────────────────────────────────────────────────────
  const handleStatusChange = useCallback(async (cert: CertRow, next: DeliveryStatus | null) => {
    const before = cert.delivery_status ?? null;
    setCerts((prev) => prev.map((c) => (c.id === cert.id ? { ...c, delivery_status: next ?? null } : c)));
    try {
      await ops.assignCertificate({
        certificate_id: cert.id,
        project_id: cert.project_id ?? null,
        delivery_status: next,
      });
      toast.success(next
        ? `ステータスを「${DELIVERY_STATUS_TOKENS[next].label}」に変更しました`
        : 'ステータスをクリアしました');
    } catch (e) {
      setCerts((prev) => prev.map((c) => (c.id === cert.id ? { ...c, delivery_status: before } : c)));
      toast.error('ステータス変更に失敗しました', { description: (e as Error).message });
    }
  }, [ops]);

  const handleAssignProject = useCallback(async (cert: CertRow, projectId: string | null) => {
    const before = cert.project_id ?? null;
    setCerts((prev) => prev.map((c) => (c.id === cert.id ? { ...c, project_id: projectId } : c)));
    try {
      await ops.assignCertificate({ certificate_id: cert.id, project_id: projectId });
      toast.success(projectId ? '案件に紐づけました' : '案件の紐づけを解除しました');
    } catch (e) {
      setCerts((prev) => prev.map((c) => (c.id === cert.id ? { ...c, project_id: before } : c)));
      toast.error('案件の更新に失敗しました', { description: (e as Error).message });
    }
  }, [ops]);

  const handleCreateProject = useCallback(async (input: Parameters<typeof ops.createProject>[0]) => {
    await ops.createProject(input);
    toast.success(`案件「${input.name}」を作成しました`);
  }, [ops]);

  const focusCertById = useCallback((id: string) => {
    const el = document.getElementById(`cert-row-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('pm-focus-pulse');
      setTimeout(() => el.classList.remove('pm-focus-pulse'), 1400);
    }
  }, []);

  if (authLoading || !user) return <MinimalSpinner />;

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(180deg, #0a0a0f 0%, #12121e 100%)' }}>
      {/* ─── Hero ─── */}
      <section className="max-w-[1200px] mx-auto px-6 pt-10 pb-2">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <div className="flex items-center gap-3 mb-2">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: 'rgba(108,62,244,0.12)',
                border: '1px solid rgba(108,62,244,0.35)',
                color: '#A8A0D8',
              }}
            >
              <Layers3 className="w-3 h-3" aria-hidden="true" />
              Studio Ops
            </span>
            <span className="text-[11px] text-white/40">{ops.planTier.toUpperCase()} プラン</span>
          </div>
          <h1 className="text-[28px] font-black tracking-tight">Evidence Operations</h1>
          <p className="text-[13px] text-white/55 mt-1 leading-relaxed">
            案件ごとに証拠を束ねる、納品・確認・監査の作業台。
          </p>
        </motion.div>

        <div
          className="mt-6 grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}
        >
          <KPI label="管理中の証明" value={String(kpi.total)} icon={<FolderKanban className="w-4 h-4" />} />
          <KPI label="要確認" value={String(kpi.review)} accent="#F0BB38" icon={<History className="w-4 h-4" />} />
          <KPI label="納品準備完了" value={String(kpi.ready)} accent="#00D4AA" icon={<ShieldCheck className="w-4 h-4" />} />
          <KPI label="Trusted TSA" value={String(kpi.trusted)} accent="#00D4AA" icon={<ShieldCheck className="w-4 h-4" />} />
        </div>
      </section>

      <main className="max-w-[1200px] mx-auto px-6 pb-20 pt-6">
        {/* ── Project rail ── */}
        <ProjectRail
          chips={projectChips}
          activeId={activeProjectId}
          onChange={setActiveProjectId}
          isStudio={true}
          onCreate={() => { setComposerInitial(null); setComposerOpen(true); }}
          projects={ops.projects}
        />

        {/* ── Attention tray ── */}
        <div className="mt-6">
          <AttentionTray items={attentionItems} onFocus={focusCertById} />
        </div>

        {/* ── Cert list (Studio table view) ── */}
        {loadingCerts ? (
          <SkeletonGrid />
        ) : visibleCerts.length === 0 ? (
          <EmptyStudio onCreate={() => setComposerOpen(true)} />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-md">
            <div className="min-w-[820px]">
              <div
                role="row"
                className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 text-[10px] uppercase tracking-widest text-white/40 border-b border-white/5"
              >
                <span role="columnheader">案件 / タイトル</span>
                <span role="columnheader">ステータス</span>
                <span role="columnheader">案件</span>
                <span role="columnheader">発行</span>
                <span role="columnheader" className="text-right">操作</span>
              </div>
              {visibleCerts.map((cert) => {
                const project = cert.project_id ? ops.projects.find((p) => p.id === cert.project_id) : null;
                return (
                  <div
                    key={cert.id}
                    id={`cert-row-${cert.id}`}
                    role="row"
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <div role="cell" className="min-w-0">
                      <p className="text-[13px] font-semibold text-white truncate">
                        {cert.title || cert.file_name || 'Untitled'}
                      </p>
                      <p className="text-[10px] text-white/40 font-mono truncate mt-0.5">
                        {(cert.sha256 || cert.file_hash || '').slice(0, 16)}…
                      </p>
                    </div>
                    <div role="cell">
                      <StatusMenu
                        current={cert.delivery_status ?? null}
                        onChange={(next) => handleStatusChange(cert, next)}
                      />
                    </div>
                    <div role="cell">
                      <ProjectAssignButton
                        currentProjectId={cert.project_id ?? null}
                        currentProjectColor={project?.color ?? null}
                        currentProjectName={project?.name ?? cert.client_project ?? null}
                        projects={ops.projects}
                        onAssign={(pid) => handleAssignProject(cert, pid)}
                      />
                    </div>
                    <div role="cell" className="text-[11px] text-white/55 tabular-nums">
                      {cert.certified_at
                        ? new Date(cert.certified_at).toLocaleDateString('ja-JP')
                        : '—'}
                    </div>
                    <div role="cell" className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAuditCertId(cert.id);
                          setAuditCertTitle(cert.title ?? cert.file_name ?? null);
                        }}
                        title="操作履歴を表示"
                        className="p-1.5 rounded-lg text-white/55 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4AA]"
                      >
                        <History className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <a
                        href={`/cert/${cert.id}`}
                        title="証明書を開く"
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white/80 border border-white/10 hover:bg-white/5 transition-colors"
                      >
                        開く
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ── Modals & drawers ── */}
      <ProjectComposer
        open={composerOpen}
        initial={composerInitial}
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
        onClose={() => { setAuditCertId(null); setAuditCertTitle(null); }}
      />

      <style>{`
        .pm-focus-pulse { animation: pm-focus-pulse 1.4s ease-out 1; }
        @keyframes pm-focus-pulse {
          0%   { background: rgba(108,62,244,0.20); }
          100% { background: transparent; }
        }
        .proofmark-scrollbar::-webkit-scrollbar { width: 10px; height: 10px; }
        .proofmark-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(108,62,244,0.5), rgba(0,212,170,0.4));
          border-radius: 999px;
        }
        .proofmark-scrollbar::-webkit-scrollbar-track { background: transparent; }
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

/* ───────────────────────────────────────────────────────────────────── */

function KPI({
  label, value, icon, accent = '#A8A0D8',
}: { label: string; value: string; icon: React.ReactNode; accent?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-md px-4 py-3.5">
      <span
        aria-hidden="true"
        style={{ color: accent, borderColor: `${accent}55` }}
        className="w-9 h-9 rounded-lg flex items-center justify-center border bg-white/[0.02]"
      >
        {icon}
      </span>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-white/40">{label}</p>
        <p className="text-[20px] font-bold tabular-nums text-white mt-0.5">{value}</p>
      </div>
    </div>
  );
}

interface ProjectAssignButtonProps {
  currentProjectId: string | null;
  currentProjectName: string | null;
  currentProjectColor: string | null;
  projects: ProjectRecord[];
  onAssign: (projectId: string | null) => void | Promise<void>;
}

function ProjectAssignButton({
  currentProjectId, currentProjectName, currentProjectColor, projects, onAssign,
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
        className={[
          'inline-flex items-center gap-1.5 px-2 py-1 rounded-lg',
          'border border-white/10 bg-white/[0.02] hover:bg-white/[0.05]',
          'text-[11px] text-white/75 transition-colors max-w-[180px]',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C3EF4]',
        ].join(' ')}
      >
        {currentProjectColor && (
          <span
            aria-hidden="true"
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: currentProjectColor }}
          />
        )}
        <FolderKanban className="w-3 h-3 opacity-60" aria-hidden="true" />
        <span className="truncate">{currentProjectName || '未分類'}</span>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute z-30 mt-1 w-56 max-h-[280px] overflow-y-auto proofmark-scrollbar rounded-xl border border-white/10 bg-[#12121e]/95 backdrop-blur-xl p-1.5 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)]"
        >
          <button
            type="button"
            role="option"
            aria-selected={currentProjectId === null}
            onClick={() => { void onAssign(null); setOpen(false); }}
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
              onClick={() => { void onAssign(p.id); setOpen(false); }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] text-white/80 hover:bg-white/[0.05] hover:text-white transition-colors"
            >
              <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MinimalSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-[#00D4AA] animate-spin" />
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="space-y-2 mt-2" role="status" aria-label="読み込み中">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] h-14 animate-pulse" />
      ))}
    </div>
  );
}

function EmptyStudio({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.015] py-14 text-center">
      <FolderKanban className="w-7 h-7 text-white/30 mx-auto mb-3" aria-hidden="true" />
      <p className="text-[14px] text-white/65 font-semibold">この案件にはまだ証明書がありません</p>
      <p className="text-[11px] text-white/40 mt-1">
        新規発行ページから証明書を発行するか、案件をひとつ作って整理を始めましょう。
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-[#6C3EF4] to-[#00D4AA] text-[#07061A] text-[12px] font-semibold hover:opacity-95"
      >
        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
        新規案件
      </button>
    </div>
  );
}
