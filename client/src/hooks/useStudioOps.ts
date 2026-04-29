/**
 * useStudioOps — single hook that powers Progressive Disclosure.
 *
 * Returns:
 *   • isStudio   : true when the user's plan_tier is 'studio' or 'business'.
 *   • teams      : list of teams the user belongs to (RPC fn_list_my_teams).
 *   • projects   : list of projects the user can see (RLS-filtered).
 *   • activeTeamId / setActiveTeamId : optional team scope.
 *   • createProject / updateProject / deleteProject / assignProject
 *   • refresh()  : refetch projects (used after mutations).
 *
 * Design:
 *   • Free / Creator users keep `isStudio=false` → Dashboard hides every
 *     Studio surface (project rail, status column, audit drawer, team chips).
 *   • Studio users see the full Ops OS layered on the *same* canvas — no
 *     route change, no app split.
 *   • All mutations go through the API layer (never raw supabase.from()) so
 *     audit + plan-gating stay server-authoritative.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import { clearAuditCache } from '../components/ops/AuditDrawer';

export type PlanTier = 'free' | 'creator' | 'studio' | 'business' | 'spot' | string;

export interface ProjectRecord {
  id: string;
  owner_id: string;
  team_id: string | null;
  name: string;
  client_name: string | null;
  color: string;
  status: 'active' | 'on_hold' | 'delivered' | 'archived';
  due_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamRecord {
  team_id: string;
  team_name: string;
  role: 'owner' | 'admin' | 'member';
  max_seats: number;
  member_count: number;
}

interface UseStudioOpsResult {
  loading: boolean;
  isStudio: boolean;
  planTier: PlanTier;
  teams: TeamRecord[];
  projects: ProjectRecord[];
  activeTeamId: string | null;
  setActiveTeamId: (id: string | null) => void;

  createProject: (input: {
    name: string;
    client_name?: string | null;
    color?: string;
    team_id?: string | null;
    due_at?: string | null;
    notes?: string | null;
  }) => Promise<ProjectRecord>;

  updateProject: (id: string, patch: Partial<Pick<ProjectRecord,
    'name' | 'client_name' | 'color' | 'status' | 'due_at' | 'notes'
  >>) => Promise<ProjectRecord>;

  deleteProject: (id: string) => Promise<void>;

  assignCertificate: (input: {
    certificate_id: string;
    project_id: string | null;
    delivery_status?:
      | 'draft' | 'in_progress' | 'review' | 'ready' | 'delivered' | 'on_hold'
      | null;
  }) => Promise<{ id: string; project_id: string | null; delivery_status: string | null }>;

  refresh: () => Promise<void>;
}

async function authedFetch(url: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? '';
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('content-type') && init.body) headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  const res = await fetch(url, { ...init, headers, credentials: 'omit' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((body as { error?: string })?.error ?? `HTTP ${res.status}`);
    (err as Error & { status: number; reqId?: string }).status = res.status;
    (err as Error & { status: number; reqId?: string }).reqId = (body as { reqId?: string })?.reqId;
    throw err;
  }
  return body as Record<string, unknown>;
}

export function useStudioOps(): UseStudioOpsResult {
  const { user, profile, loading: authLoading } = useAuth();

  const planTier: PlanTier = (profile?.plan_tier as PlanTier) ?? 'free';
  const isSelfStudio = planTier === 'studio' || planTier === 'business';
  
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  // 自身のプランがStudio以上、または何らかのチームに所属していればUIを開放
  const isStudio = isSelfStudio || teams.length > 0;

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // ── fetch teams + projects (ordered to avoid isStudio deadlock) ────────
  const refresh = useCallback(async () => {
    if (!user) return;
    setLoadingProjects(true);
    try {
      // 1. まず「所属チーム」を全員無条件で取得する（軽量な通信）
      const { data: fetchedTeams } = await supabase.rpc('fn_list_my_teams', { p_user_id: user.id });
      const currentTeams = (fetchedTeams ?? []) as TeamRecord[];
      setTeams(currentTeams);

      // 2. チーム取得後に、改めてStudio権限を評価する
      const hasStudioAccess = isSelfStudio || currentTeams.length > 0;

      // 3. 権限がなければ、重いプロジェクトデータは取得せずに早期リターン（コスト削減）
      if (!hasStudioAccess) {
        setProjects([]);
        return;
      }

      // 4. 権限があるユーザーのみ、プロジェクト一覧を取得する
      const body = await authedFetch('/api/projects', { method: 'GET' });
      setProjects((body.projects as ProjectRecord[]) ?? []);
    } catch (err) {
      console.error('Ops fetch error:', err);
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, [user, isSelfStudio]);


  useEffect(() => {
    if (authLoading || !user) return;
    void refresh();
  }, [authLoading, user, refresh]);

  // ── mutations ──────────────────────────────────────────────────────────
  const createProject: UseStudioOpsResult['createProject'] = useCallback(async (input) => {
    const body = await authedFetch('/api/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const proj = body.project as ProjectRecord;
    setProjects((prev) => [proj, ...prev]);
    return proj;
  }, []);

  const updateProject: UseStudioOpsResult['updateProject'] = useCallback(async (id, patch) => {
    const body = await authedFetch(`/api/projects/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    const proj = body.project as ProjectRecord;
    setProjects((prev) => prev.map((p) => (p.id === id ? proj : p)));
    return proj;
  }, []);

  const deleteProject: UseStudioOpsResult['deleteProject'] = useCallback(async (id) => {
    await authedFetch(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const assignCertificate: UseStudioOpsResult['assignCertificate'] = useCallback(async (input) => {
    const body = await authedFetch('/api/certificates/assign-project', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    // 変更があった証明書の監査ログキャッシュを破棄
    clearAuditCache(input.certificate_id);
    return body.certificate as { id: string; project_id: string | null; delivery_status: string | null };
  }, []);

  // ── filtered view (when an active team scope is selected) ──────────────
  const filteredProjects = useMemo(() => {
    if (!activeTeamId) return projects;
    return projects.filter((p) => p.team_id === activeTeamId);
  }, [projects, activeTeamId]);

  return {
    loading: authLoading || loadingProjects,
    isStudio,
    planTier,
    teams,
    projects: filteredProjects,
    activeTeamId,
    setActiveTeamId,
    createProject,
    updateProject,
    deleteProject,
    assignCertificate,
    refresh,
  };
}
