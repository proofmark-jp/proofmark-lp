/**
 * Dashboard.tsx — ProofMark Evidence Operations Console (v2)
 *
 * 設計原則:
 *   1. "証明書一覧" から "案件運用の作業台" へ格上げする。
 *   2. Verified バッジは `tsa_provider` / `certified_at` / `timestamp_token` を
 *      信頼チェーン3段階（Beta / Trusted / Cross-anchored）として厳密に区別する。
 *      何をもって Verified なのかが一目で分かる状態を維持する。
 *   3. 案件 (ClientProject) 単位でまとめ、納品導線・Evidence Pack・監査可能性を
 *      ダッシュボードの一次行動に置く。
 *   4. 破壊的操作（削除）より、アーカイブ / 保護 / 証跡エクスポートを優先する。
 *   5. すべての状態表示を StyleObject ではなく設計トークン (tokens) で一貫管理する。
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import Navbar from "../components/Navbar";
import FounderBadge from "../components/FounderBadge";
import { ProcessBundleComposer } from "../components/proof/ProcessBundleComposer";
import type { CertificateRecord } from "../lib/proofmark-types";
import {
  Search,
  Star,
  ArrowUpDown,
  Shield,
  ShieldCheck,
  ShieldAlert,
  FolderKanban,
  FileDown,
  Link as LinkIcon,
  Archive,
  ArchiveRestore,
  Clock3,
  Sparkles,
  LayoutGrid,
  Rows3,
  Info,
  Copy,
  Check,
  Hash,
  BadgeCheck,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

/* ──────────────────────────────────────────────────────────────────────────
   Types
────────────────────────────────────────────────────────────────────────── */

interface Certificate {
  id: string;
  title?: string;
  is_starred?: boolean;
  file_name: string;
  file_hash: string;
  file_url?: string;
  thumbnail_url?: string;
  created_at: string;
  original_filename?: string;
  public_image_url?: string;
  proof_mode?: string;
  visibility?: string;
  sha256?: string;
  /** RFC3161 Timestamp Token (base64). 書き込み責任はサーバー。 */
  timestamp_token?: string | null;
  /** TSA が署名した genTime (ISO8601)。 */
  certified_at?: string | null;
  /** TSA プロバイダ識別子 (freetsa | digicert | globalsign | seiko | ...)。 */
  tsa_provider?: string | null;
  /** Cross-anchor（複数TSAに多重発行した場合）の参考情報。 */
  cross_anchors?: Array<{ provider: string; certified_at: string }> | null;
  /** 案件単位での束ね。null の場合は "未分類" バケツへ。 */
  client_project?: string | null;
  /** ユーザーが明示的にアーカイブしたか。 */
  is_archived?: boolean;
  metadata?: Record<string, unknown>;
}

type TrustTier = "beta" | "trusted" | "cross" | "pending";

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

/**
 * TSA プロバイダと cross_anchors の組合せから信頼階層を導出する唯一の関数。
 * UI 側では絶対にロジックを再定義しない（single source of truth）。
 */
function deriveTrustTier(c: Certificate): TrustDescriptor {
  const provider = (c.tsa_provider || "").toLowerCase();
  const hasToken = Boolean(c.timestamp_token && c.certified_at);
  const anchors = c.cross_anchors?.length ?? 0;

  if (!hasToken) {
    return {
      tier: "pending",
      label: "Pending",
      sublabel: "TSA発行待ち",
      color: "#A8A0D8",
      border: "rgba(168,160,216,0.35)",
      bg: "rgba(168,160,216,0.10)",
      icon: Clock3,
      description:
        "タイムスタンプトークン未発行。数秒以内にTSAから署名が返る予定です。Trust Center §3 のフローを参照。",
    };
  }
  if (anchors >= 1) {
    return {
      tier: "cross",
      label: "Cross-anchored",
      sublabel: `${anchors + 1} 重TSA`,
      color: "#F0BB38",
      border: "rgba(240,187,56,0.40)",
      bg: "rgba(240,187,56,0.12)",
      icon: Sparkles,
      description:
        "複数のTSAで多重発行された証明。TSA単一障害や将来的な鍵失効に対する耐性を持ちます。",
    };
  }
  if (["digicert", "globalsign", "seiko", "sectigo"].includes(provider)) {
    return {
      tier: "trusted",
      label: "Trusted TSA",
      sublabel: provider.toUpperCase(),
      color: "#00D4AA",
      border: "rgba(0,212,170,0.40)",
      bg: "rgba(0,212,170,0.12)",
      icon: ShieldCheck,
      description:
        "主要トラストストアに収録された商用TSAによるRFC3161タイムスタンプ。SLAと長期検証 (LTV) が利用可能です。",
    };
  }
  return {
    tier: "beta",
    label: "Beta TSA",
    sublabel: provider ? provider.toUpperCase() : "FREETSA",
    color: "#9BA3D4",
    border: "rgba(155,163,212,0.35)",
    bg: "rgba(155,163,212,0.10)",
    icon: ShieldAlert,
    description:
      "β版TSA（FreeTSA.org）による発行。RFC3161として暗号的に有効ですが、主要OS/ブラウザのトラストストア未収録・SLAなしです。有料プランの正式リリースまでにTrusted TSAへ移行予定。",
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   Derived project grouping
────────────────────────────────────────────────────────────────────────── */

interface ProjectGroup {
  id: string;
  name: string;
  count: number;
  certs: Certificate[];
  latestAt: number;
  trustSummary: Record<TrustTier, number>;
}

function groupByProject(certs: Certificate[]): ProjectGroup[] {
  const map = new Map<string, ProjectGroup>();
  for (const c of certs) {
    const id = c.client_project?.trim() || "__unassigned__";
    const name = c.client_project?.trim() || "未分類";
    const g =
      map.get(id) ??
      ({
        id,
        name,
        count: 0,
        certs: [],
        latestAt: 0,
        trustSummary: { beta: 0, trusted: 0, cross: 0, pending: 0 },
      } as ProjectGroup);
    g.certs.push(c);
    g.count += 1;
    g.latestAt = Math.max(g.latestAt, new Date(c.created_at).getTime());
    g.trustSummary[deriveTrustTier(c).tier] += 1;
    map.set(id, g);
  }
  return Array.from(map.values()).sort((a, b) => b.latestAt - a.latestAt);
}

/* ──────────────────────────────────────────────────────────────────────────
   Component
────────────────────────────────────────────────────────────────────────── */

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [, navigate] = useLocation();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(true);
  const [composerCert, setComposerCert] = useState<CertificateRecord | null>(null);

  // ── 検索 / ソート / 表示モード / 案件フィルタ ──
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "starred" | "trust">("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [activeProjectId, setActiveProjectId] = useState<string>("__all__");
  const [showArchived, setShowArchived] = useState(false);
  const [trustFilter, setTrustFilter] = useState<TrustTier | "all">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleToggleStar = async (certId: string, currentStatus: boolean) => {
    // Optimistic UI Update (即時反映)
    setCerts((prev) => prev.map((c) => c.id === certId ? { ...c, is_starred: !currentStatus } : c));
    const { error } = await supabase.from("certificates").update({ is_starred: !currentStatus }).eq("id", certId);
    if (error) {
      // エラー時はロールバック
      setCerts((prev) => prev.map((c) => c.id === certId ? { ...c, is_starred: currentStatus } : c));
      toast.error("保護状態を更新できませんでした", { description: error.message });
    }
  };

  /* ── 派生状態 ─────────────────────────────────────────────── */

  const visibleCerts = useMemo(
    () => certs.filter((c) => (showArchived ? true : !c.is_archived)),
    [certs, showArchived]
  );

  const projectGroups = useMemo(() => groupByProject(visibleCerts), [visibleCerts]);

  const filteredSortedCerts = useMemo(() => {
    let result = [...visibleCerts];

    // 案件フィルタ
    if (activeProjectId !== "__all__") {
      result = result.filter((c) => {
        const key = c.client_project?.trim() || "__unassigned__";
        return key === activeProjectId;
      });
    }

    // 検索
    if (searchQuery.trim()) {
      const lowerQ = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          (c.title?.toLowerCase() || "").includes(lowerQ) ||
          (c.file_name?.toLowerCase() || "").includes(lowerQ) ||
          (c.client_project?.toLowerCase() || "").includes(lowerQ) ||
          (c.sha256 || c.file_hash || "").toLowerCase().includes(lowerQ)
      );
    }

    // 信頼フィルタ
    if (trustFilter !== "all") {
      result = result.filter((c) => deriveTrustTier(c).tier === trustFilter);
    }

    // ソート
    const rank: Record<TrustTier, number> = { cross: 0, trusted: 1, beta: 2, pending: 3 };
    result.sort((a, b) => {
      if (sortBy === "starred") {
        if (a.is_starred === b.is_starred)
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        return a.is_starred ? -1 : 1;
      }
      if (sortBy === "trust") {
        const d = rank[deriveTrustTier(a).tier] - rank[deriveTrustTier(b).tier];
        if (d !== 0) return d;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [visibleCerts, activeProjectId, searchQuery, sortBy, trustFilter]);

  /* ── 健全性KPI ────────────────────────────────────────────── */

  const kpi = useMemo(() => {
    const total = visibleCerts.length;
    const tierCount = visibleCerts.reduce(
      (acc, c) => {
        acc[deriveTrustTier(c).tier] += 1;
        return acc;
      },
      { beta: 0, trusted: 0, cross: 0, pending: 0 } as Record<TrustTier, number>
    );
    const last = visibleCerts[0]?.created_at ?? null;
    return { total, tierCount, last };
  }, [visibleCerts]);

  // 未認証時リダイレクト
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  // 証明書一覧取得
  useEffect(() => {
    if (!user) return;

    const fetchCerts = async () => {
      setLoadingCerts(true);
      const { data, error } = await supabase
        .from("certificates")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setCerts(data as Certificate[]);
      }
      setLoadingCerts(false);
    };

    fetchCerts();
  }, [user]);

  /* ── アクション ─────────────────────────────────────────── */

  const handleShare = (cert: Certificate) => {
    const certUrl = `${window.location.origin}/cert/${cert.id}`;
    const text = `ProofMarkで、この作品（${cert.file_name || "Untitled"}）の【デジタル存在証明】を発行しました！ #ProofMark #AIイラスト ${certUrl}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, "_blank", "noopener,noreferrer");
  };

  const handleCopyVerifyLink = useCallback(async (cert: Certificate) => {
    const url = `${window.location.origin}/cert/${cert.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(cert.id);
      toast.success("検証URLをコピーしました", { description: url });
      setTimeout(() => setCopiedId((id) => (id === cert.id ? null : id)), 1600);
    } catch {
      toast.error("コピーに失敗しました");
    }
  }, []);

  const handleDownloadEvidencePack = useCallback(async (cert: Certificate) => {
    // Evidence Pack: PDF証明書 + TST(.tsr) + 検証手順 + カバーレター草案 を ZIP で返す API。
    // 未実装でも UI から呼び出し先だけ固定しておくと、後続実装で UI 側差分がゼロになる。
    try {
      const res = await fetch(`/api/evidence-pack?certId=${cert.id}`, {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ""}`,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `proofmark-evidence-${cert.id.slice(0, 8)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Evidence Pack をダウンロードしました");
    } catch (e: any) {
      toast.error("Evidence Pack 生成に失敗しました", {
        description: e?.message ?? "API をご確認ください。",
      });
    }
  }, []);

  const handleArchive = async (cert: Certificate, next: boolean) => {
    try {
      // Authのセッショントークンを取得
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // バックエンドの完全消去APIを叩く
      const res = await fetch('/api/certificates/delete', {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: cert.id }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || '削除に失敗しました');
      }

      setCerts((prev) => prev.filter((c) => c.id !== cert.id));
      toast.success("証明書を完全に削除しました");
    } catch (error: any) {
      toast.error("削除エラー", { description: error.message });
    }
  };

  const handleAssignProject = async (cert: Certificate) => {
    const current = cert.client_project ?? "";
    const next = window.prompt(
      "この証明書を紐づける案件名（例: ACME社 / 表紙イラスト 2026-04）",
      current
    );
    if (next === null) return;
    const trimmed = next.trim() || null;
    setCerts((prev) => prev.map((c) => (c.id === cert.id ? { ...c, client_project: trimmed } : c)));
    const { error } = await supabase
      .from("certificates")
      .update({ client_project: trimmed })
      .eq("id", cert.id);
    if (error) {
      toast.error("案件の紐づけに失敗しました", { description: error.message });
    } else {
      toast.success(trimmed ? `「${trimmed}」に紐づけました` : "案件の紐づけを解除しました");
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const truncateHash = (hash: string) => {
    if (!hash) return "—";
    return hash.length > 16 ? `${hash.slice(0, 8)}…${hash.slice(-8)}` : hash;
  };

  if (authLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <style>{spinnerKeyframes}</style>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div style={styles.page}>
      <Navbar user={user} signOut={signOut} />

      {/* ═════════ Hero + KPI ═════════ */}
      <section style={styles.hero}>
        <div style={styles.heroRow}>
          <h1 className="text-3xl font-black" style={styles.heroTitle}>
            {user.user_metadata?.username ? `@${user.user_metadata.username}` : "Evidence Console"}
          </h1>
          {user.user_metadata?.is_founder && <FounderBadge />}
        </div>
        <p style={styles.heroSubtitle}>
          案件ごとに作品の存在事実を束ね、納品・説明・紛争予防に使える状態で管理します。
        </p>

        <div style={styles.kpiGrid} className="pm-kpi-grid">
          <KPI label="管理中の証明" value={String(kpi.total)} icon={<FolderKanban className="w-4 h-4" />} />
          <KPI
            label="Trusted TSA"
            value={String(kpi.tierCount.trusted + kpi.tierCount.cross)}
            icon={<ShieldCheck className="w-4 h-4" />}
            accent="#00D4AA"
          />
          <KPI
            label="Beta TSA"
            value={String(kpi.tierCount.beta)}
            icon={<ShieldAlert className="w-4 h-4" />}
            accent="#9BA3D4"
          />
          <KPI
            label="最終発行"
            value={kpi.last ? formatDate(kpi.last) : "—"}
            icon={<Clock3 className="w-4 h-4" />}
          />
        </div>
      </section>

      {/* ═════════ Main ═════════ */}
      <main style={styles.main}>
        {/* ── Project rail ─────────────────────────────────── */}
        {!loadingCerts && certs.length > 0 && (
          <nav style={styles.projectRail} aria-label="案件フィルタ">
            <ProjectChip
              active={activeProjectId === "__all__"}
              onClick={() => setActiveProjectId("__all__")}
              name="すべての案件"
              count={visibleCerts.length}
            />
            {projectGroups.map((g) => (
              <ProjectChip
                key={g.id}
                active={activeProjectId === g.id}
                onClick={() => setActiveProjectId(g.id)}
                name={g.name}
                count={g.count}
                trustSummary={g.trustSummary}
              />
            ))}
          </nav>
        )}

        {/* ── Toolbar ──────────────────────────────────────── */}
        {!loadingCerts && certs.length > 0 && (
          <div style={styles.toolbar} className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 mb-6">
            <div style={styles.searchWrap} className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A0D8]/50" />
              <input
                type="text"
                placeholder="案件名・ファイル名・ハッシュで検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchInput}
              />
            </div>

            <div style={styles.toolbarRight}>
              <TrustFilterTabs value={trustFilter} onChange={setTrustFilter} counts={kpi.tierCount} />

              <div style={styles.segGroup} role="tablist" aria-label="並び替え">
                <SegBtn active={sortBy === "newest"} onClick={() => setSortBy("newest")}>
                  <ArrowUpDown className="w-4 h-4" /> 最新
                </SegBtn>
                <SegBtn active={sortBy === "trust"} onClick={() => setSortBy("trust")}>
                  <ShieldCheck className="w-4 h-4" /> 信頼順
                </SegBtn>
                <SegBtn active={sortBy === "starred"} onClick={() => setSortBy("starred")}>
                  <Star className="w-4 h-4" /> 保護優先
                </SegBtn>
              </div>

              <div style={styles.segGroup} role="tablist" aria-label="表示モード">
                <SegBtn active={view === "grid"} onClick={() => setView("grid")} title="カード表示">
                  <LayoutGrid className="w-4 h-4" />
                </SegBtn>
                <SegBtn active={view === "list"} onClick={() => setView("list")} title="テーブル表示">
                  <Rows3 className="w-4 h-4" />
                </SegBtn>
              </div>

              <label style={styles.archiveToggle}>
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                />
                <span>アーカイブも表示</span>
              </label>
            </div>
          </div>
        )}

        {loadingCerts ? (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner} />
          </div>
        ) : certs.length === 0 ? (
          <EmptyState onGo={() => navigate("/")} />
        ) : filteredSortedCerts.length === 0 ? (
          <div style={styles.emptyMini}>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.55)" }}>
              条件に一致する証明書が見つかりません。フィルタをリセットしてください。
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setTrustFilter("all");
                setActiveProjectId("__all__");
              }}
              style={styles.resetBtn}
            >
              フィルタをリセット
            </button>
          </div>
        ) : view === "list" ? (
          <CertList
            certs={filteredSortedCerts}
            onShare={handleShare}
            onArchive={handleArchive}
            onAssignProject={handleAssignProject}
            onCopyLink={handleCopyVerifyLink}
            onEvidence={handleDownloadEvidencePack}
            onToggleStar={handleToggleStar}
            onOpenChain={(c) => setComposerCert(c as unknown as CertificateRecord)}
            copiedId={copiedId}
            formatDate={formatDate}
            truncateHash={truncateHash}
          />
        ) : (
          <div style={styles.grid}>
            {filteredSortedCerts.map((cert) => (
              <CertCard
                key={cert.id}
                cert={cert}
                user={user}
                copied={copiedId === cert.id}
                onShare={handleShare}
                onArchive={handleArchive}
                onAssignProject={handleAssignProject}
                onCopyLink={handleCopyVerifyLink}
                onEvidence={handleDownloadEvidencePack}
                onToggleStar={handleToggleStar}
                onOpenChain={(c) => setComposerCert(c as unknown as CertificateRecord)}
                formatDate={formatDate}
                truncateHash={truncateHash}
              />
            ))}
          </div>
        )}
      </main>

      <style>{spinnerKeyframes}</style>
      <style>{hoverStyles}</style>

      {/* ── Chain of Evidence モーダル ── */}
      {composerCert && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
          style={{ background: 'rgba(7, 6, 26, 0.92)', backdropFilter: 'blur(8px)' }}
        >
          <div className="w-full max-w-4xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#A8A0D8] mb-1">Chain of Evidence Studio</p>
                <h2 className="text-lg font-bold text-white">
                  {composerCert.title ?? composerCert.file_name ?? composerCert.id}
                </h2>
              </div>
              <button
                onClick={() => setComposerCert(null)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#A8A0D8] hover:text-white border border-[#1C1A38] hover:border-[#6C3EF4]/40 rounded-xl transition-all"
              >
                ✕ 閉じる
              </button>
            </div>
            <ProcessBundleComposer certificate={composerCert} />
          </div>
        </div>
      )}
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
  accent = "#A8A0D8",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div style={styles.kpi}>
      <div style={{ ...styles.kpiIcon, color: accent, borderColor: `${accent}55` }}>{icon}</div>
      <div>
        <div style={styles.kpiLabel}>{label}</div>
        <div style={styles.kpiValue}>{value}</div>
      </div>
    </div>
  );
}

function ProjectChip({
  active,
  onClick,
  name,
  count,
  trustSummary,
}: {
  active: boolean;
  onClick: () => void;
  name: string;
  count: number;
  trustSummary?: Record<TrustTier, number>;
}) {
  return (
    <button
      onClick={onClick}
      style={{ ...styles.projectChip, ...(active ? styles.projectChipActive : {}) }}
      aria-pressed={active}
    >
      <FolderKanban className="w-3.5 h-3.5" />
      <span style={{ fontWeight: 700 }}>{name}</span>
      <span style={styles.projectChipCount}>{count}</span>
      {trustSummary && trustSummary.trusted + trustSummary.cross > 0 && (
        <span style={styles.projectChipTrusted} title="Trusted TSA">
          <BadgeCheck className="w-3 h-3" /> {trustSummary.trusted + trustSummary.cross}
        </span>
      )}
    </button>
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
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ ...styles.segBtn, ...(active ? styles.segBtnActive : {}) }}
      role="tab"
      aria-selected={active}
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
  value: TrustTier | "all";
  onChange: (v: TrustTier | "all") => void;
  counts: Record<TrustTier, number>;
}) {
  const items: Array<{ key: TrustTier | "all"; label: string; color: string }> = [
    { key: "all", label: "すべて", color: "#A8A0D8" },
    { key: "cross", label: `Cross ${counts.cross}`, color: "#F0BB38" },
    { key: "trusted", label: `Trusted ${counts.trusted}`, color: "#00D4AA" },
    { key: "beta", label: `Beta ${counts.beta}`, color: "#9BA3D4" },
    { key: "pending", label: `Pending ${counts.pending}`, color: "#A8A0D8" },
  ];
  return (
    <div style={styles.trustTabs} role="tablist" aria-label="信頼レベルで絞り込み">
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          role="tab"
          aria-selected={value === it.key}
          style={{
            ...styles.trustTab,
            color: value === it.key ? it.color : "rgba(255,255,255,0.6)",
            borderColor: value === it.key ? `${it.color}66` : "rgba(255,255,255,0.08)",
            background: value === it.key ? `${it.color}14` : "transparent",
          }}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function TrustBadge({ cert, size = "md" }: { cert: Certificate; size?: "sm" | "md" }) {
  const t = deriveTrustTier(cert);
  const Icon = t.icon;
  const dims = size === "sm" ? { pad: "2px 8px", fs: 10, ic: 11 } : { pad: "4px 10px", fs: 11, ic: 14 };
  return (
    <span
      title={t.description}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: dims.pad,
        borderRadius: 999,
        background: t.bg,
        border: `1px solid ${t.border}`,
        color: t.color,
        fontSize: dims.fs,
        fontWeight: 800,
        letterSpacing: "0.04em",
        textTransform: "uppercase" as const,
        whiteSpace: "nowrap" as const,
      }}
    >
      <Icon style={{ width: dims.ic, height: dims.ic }} />
      {t.label}
      <span style={{ opacity: 0.7, fontWeight: 600, textTransform: "none" }}>· {t.sublabel}</span>
    </span>
  );
}

function EmptyState({ onGo }: { onGo: () => void }) {
  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyIcon}>📁</div>
      <p style={styles.emptyText}>まだ証明済み作品がありません。</p>
      <button onClick={onGo} style={styles.primaryBtn}>
        最初の作品を証明する →
      </button>
    </div>
  );
}

interface RowActions {
  onShare: (c: Certificate) => void;
  onArchive: (c: Certificate, next: boolean) => void;
  onAssignProject: (c: Certificate) => void;
  onCopyLink: (c: Certificate) => void;
  onEvidence: (c: Certificate) => void;
  onToggleStar: (id: string, current: boolean) => void;
  onOpenChain: (c: Certificate) => void;
  formatDate: (iso: string) => string;
  truncateHash: (hash: string) => string;
}

function CertCard(
  props: RowActions & { cert: Certificate; user: any; copied: boolean }
) {
  const { cert, user, copied, formatDate, truncateHash } = props;

  return (
    <article style={styles.card} className="pm-card" aria-label={cert.file_name || "Untitled"}>
      <div style={styles.thumbWrap}>
        {cert.proof_mode === "shareable" &&
        cert.public_image_url &&
        (cert.visibility === "public" || (user && user.id === (cert as any).user_id)) ? (
          <img
            src={cert.public_image_url}
            alt={cert.original_filename || cert.file_name || "Artwork"}
            style={styles.thumbImg}
            loading="lazy"
          />
        ) : (
          <div style={styles.thumbPlaceholder}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}

        <button
          onClick={(e) => {
            e.preventDefault();
            props.onToggleStar(cert.id, !!cert.is_starred);
          }}
          style={{ ...styles.starBtn, ...(cert.is_starred ? styles.starBtnActive : {}) }}
          title={cert.is_starred ? "保護を解除" : "保護（誤操作からロック）"}
        >
          <Star
            className="w-4 h-4"
            fill={cert.is_starred ? "#F59E0B" : "transparent"}
            color={cert.is_starred ? "#F59E0B" : "rgba(255,255,255,0.5)"}
          />
        </button>

        <div style={styles.trustBadgeSlot}>
          <TrustBadge cert={cert} />
        </div>

        {cert.is_archived && (
          <div style={styles.archivedRibbon}>
            <Archive className="w-3 h-3" /> Archived
          </div>
        )}
      </div>

      <div style={styles.cardBody}>
        <div style={styles.fileTitleRow}>
          <p style={styles.fileName}>
            {cert.title || cert.original_filename || cert.file_name || "Untitled"}
          </p>
          <button
            onClick={() => props.onAssignProject(cert)}
            style={styles.projectPill}
            title="案件名を設定"
          >
            <FolderKanban className="w-3 h-3" />
            {cert.client_project || "未分類"}
          </button>
        </div>

        <div style={styles.metaRow}>
          <span style={styles.metaLabel}>
            <Hash className="w-3 h-3" /> Hash
          </span>
          <code style={styles.hashValue}>{truncateHash(cert.sha256 || cert.file_hash)}</code>
        </div>

        <div style={styles.metaRow}>
          <span style={styles.metaLabel}>
            <Clock3 className="w-3 h-3" /> Certified
          </span>
          <span style={styles.metaValue}>
            {cert.certified_at ? formatDate(cert.certified_at) : "— 未発行"}
          </span>
        </div>

        <details style={styles.trustDetails}>
          <summary style={styles.trustDetailsSummary}>
            <Info className="w-3 h-3" /> この証明の信頼レベルは何を意味するか
          </summary>
          <p style={styles.trustDetailsBody}>
            {deriveTrustTier(cert).description}{" "}
            <a href="/trust-center#s4" style={{ color: "#00D4AA" }}>
              Trust Center §4 <ExternalLink className="inline w-3 h-3" />
            </a>
          </p>
        </details>

        <div style={styles.primaryActions}>
          <button onClick={() => props.onCopyLink(cert)} style={styles.primaryAction}>
            {copied ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
            {copied ? "コピー済" : "検証URLをコピー"}
          </button>
          <button onClick={() => props.onEvidence(cert)} style={styles.evidenceAction}>
            <FileDown className="w-4 h-4" /> Evidence Pack
          </button>
        </div>

        <div style={styles.secondaryActions}>
          <a href={`/cert/${cert.id}`} style={styles.secondaryBtn}>
            証明書
          </a>
          <button onClick={() => props.onOpenChain(cert)} style={styles.secondaryBtn} title="証拠の連鎖を作成">
            🔗 Chain
          </button>
          <button onClick={() => props.onShare(cert)} style={styles.secondaryBtn} title="𝕏でシェア">
            𝕏
          </button>
          <button
            onClick={() => props.onArchive(cert, !cert.is_archived)}
            style={styles.secondaryBtn}
            title={cert.is_archived ? "アーカイブから戻す" : "アーカイブ"}
          >
            {cert.is_archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </article>
  );
}

function CertList(
  props: RowActions & { certs: Certificate[]; copiedId: string | null }
) {
  const { certs, copiedId, formatDate, truncateHash } = props;
  return (
    <div style={styles.tableWrap} role="table" aria-label="証明書一覧">
      <div style={styles.tableHead} role="row">
        <span role="columnheader" style={styles.th}>案件 / タイトル</span>
        <span role="columnheader" style={styles.th}>信頼</span>
        <span role="columnheader" style={styles.th}>ハッシュ</span>
        <span role="columnheader" style={styles.th}>発行時刻</span>
        <span role="columnheader" style={styles.th}>操作</span>
      </div>
      {certs.map((cert) => (
        <div key={cert.id} style={styles.tr} role="row">
          <div role="cell" style={styles.tdTitle}>
            <div style={styles.tdTitleMain}>
              {cert.title || cert.original_filename || cert.file_name || "Untitled"}
            </div>
            <button
              onClick={() => props.onAssignProject(cert)}
              style={styles.projectPillSmall}
              title="案件を編集"
            >
              <FolderKanban className="w-3 h-3" /> {cert.client_project || "未分類"}
            </button>
          </div>
          <div role="cell">
            <TrustBadge cert={cert} size="sm" />
          </div>
          <code role="cell" style={styles.hashValue}>
            {truncateHash(cert.sha256 || cert.file_hash)}
          </code>
          <span role="cell" style={styles.metaValue}>
            {cert.certified_at ? formatDate(cert.certified_at) : "—"}
          </span>
          <div role="cell" style={styles.tdActions}>
            <button onClick={() => props.onCopyLink(cert)} style={styles.iconBtn} title="検証URLをコピー">
              {copiedId === cert.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
            <button onClick={() => props.onEvidence(cert)} style={styles.iconBtn} title="Evidence Pack">
              <FileDown className="w-4 h-4" />
            </button>
            <a href={`/cert/${cert.id}`} style={styles.iconBtn} title="証明書を開く">
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={() => props.onArchive(cert, !cert.is_archived)}
              style={styles.iconBtn}
              title={cert.is_archived ? "戻す" : "アーカイブ"}
            >
              {cert.is_archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const spinnerKeyframes = `
  @keyframes pm-spin { to { transform: rotate(360deg); } }
  @keyframes pm-fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

const hoverStyles = `
  .pm-card:hover {
    border-color: rgba(108, 62, 244, 0.4) !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 8px 32px rgba(108, 62, 244, 0.15) !important;
  }
  .pm-kpi-grid > * { min-width: 0; }
`;

/* ──────────────────────────────────────────────────────────────────────────
   Design tokens → styles
────────────────────────────────────────────────────────────────────────── */

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #0a0a0f 0%, #12121e 100%)",
    color: "#fff",
  },

  // Hero + KPI
  hero: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "40px 24px 8px",
    animation: "pm-fadeUp 0.5s ease-out",
  },
  heroRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 4 },
  heroTitle: {
    fontSize: 28,
    fontWeight: 900,
    color: "#fff",
    margin: 0,
    letterSpacing: "-0.02em",
  },
  heroSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.55)",
    margin: "0 0 24px",
    lineHeight: 1.6,
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    marginBottom: 24,
  },
  kpi: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "1px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.04)",
  },
  kpiLabel: {
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: "0.08em",
    color: "rgba(255,255,255,0.55)",
    textTransform: "uppercase" as const,
    marginBottom: 2,
  },
  kpiValue: { fontSize: 18, fontWeight: 900, color: "#fff" },

  // Main
  main: { maxWidth: 1200, margin: "0 auto", padding: "8px 24px 80px" },

  // Project rail
  projectRail: {
    display: "flex",
    gap: 8,
    overflowX: "auto" as const,
    padding: "4px 2px 12px",
    marginBottom: 12,
    scrollbarWidth: "thin" as const,
  },
  projectChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.75)",
    fontSize: 12.5,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    transition: "all 0.2s",
  },
  projectChipActive: {
    background: "rgba(108,62,244,0.15)",
    border: "1px solid rgba(108,62,244,0.45)",
    color: "#fff",
  },
  projectChipCount: {
    fontSize: 11,
    padding: "1px 7px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.75)",
  },
  projectChipTrusted: {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    fontSize: 10.5,
    padding: "1px 7px",
    borderRadius: 999,
    background: "rgba(0,212,170,0.12)",
    color: "#00D4AA",
    fontWeight: 700,
  },

  // Toolbar
  toolbar: { padding: "0 2px" },
  toolbarRight: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as const },
  segGroup: {
    display: "inline-flex",
    padding: 3,
    borderRadius: 10,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  segBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 8,
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    transition: "all 0.15s",
  },
  segBtnActive: { background: "rgba(108,62,244,0.22)", color: "#fff" },
  trustTabs: {
    display: "inline-flex",
    gap: 6,
    padding: 3,
    borderRadius: 10,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  trustTab: {
    padding: "5px 10px",
    borderRadius: 8,
    border: "1px solid",
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: "0.03em",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  archiveToggle: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    userSelect: "none" as const,
    cursor: "pointer",
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
  },

  // Grid
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 },
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    overflow: "hidden",
    transition: "all 0.25s ease",
    animation: "pm-fadeUp 0.4s ease-out both",
    display: "flex",
    flexDirection: "column" as const,
  },

  // Thumbnail
  thumbWrap: { position: "relative" as const, width: "100%", paddingTop: "62%", background: "rgba(0,0,0,0.3)", overflow: "hidden" },
  thumbImg: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain" as const,
    padding: 8,
  },
  thumbPlaceholder: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.02)",
  },
  trustBadgeSlot: { position: "absolute" as const, bottom: 10, left: 10, zIndex: 2 },
  archivedRibbon: {
    position: "absolute" as const,
    top: 10,
    right: 10,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 8px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.1)",
    backdropFilter: "blur(8px)",
    color: "#fff",
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
  },

  // Card body
  cardBody: { padding: "14px 16px 16px", display: "flex", flexDirection: "column" as const, gap: 10, flex: 1 },
  fileTitleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  fileName: { fontSize: 14.5, fontWeight: 700, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, flex: 1, minWidth: 0 },
  projectPill: { display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: "rgba(108,62,244,0.14)", border: "1px solid rgba(108,62,244,0.35)", color: "#B8A8FF", cursor: "pointer", whiteSpace: "nowrap" as const, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" as const },
  projectPillSmall: { display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: "rgba(108,62,244,0.12)", border: "1px solid rgba(108,62,244,0.3)", color: "#B8A8FF", cursor: "pointer", whiteSpace: "nowrap" as const, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" as const, marginTop: 4 },
  metaRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  metaLabel: {
    fontSize: 10.5,
    fontWeight: 700,
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  },
  hashValue: {
    fontSize: 11.5,
    color: "#B8A8FF",
    background: "rgba(108,62,244,0.1)",
    padding: "2px 7px",
    borderRadius: 4,
    fontFamily: "'Space Mono', 'SF Mono', 'Fira Code', monospace",
  },
  metaValue: { fontSize: 12, color: "rgba(255,255,255,0.6)" },

  trustDetails: { borderTop: "1px dashed rgba(255,255,255,0.06)", paddingTop: 8, marginTop: 2 },
  trustDetailsSummary: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "rgba(255,255,255,0.55)", cursor: "pointer", listStyle: "none" as const },
  trustDetailsBody: { margin: "6px 0 0", fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 },

  primaryActions: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 },
  primaryAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "9px 0",
    borderRadius: 10,
    background: "rgba(108,62,244,0.18)",
    border: "1px solid rgba(108,62,244,0.4)",
    color: "#fff",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  evidenceAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "9px 0",
    borderRadius: 10,
    background: "linear-gradient(135deg, rgba(0,212,170,0.22), rgba(108,62,244,0.22))",
    border: "1px solid rgba(0,212,170,0.4)",
    color: "#fff",
    fontSize: 12.5,
    fontWeight: 800,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  secondaryActions: { display: "flex", gap: 6 },
  secondaryBtn: {
    flex: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: "7px 0",
    borderRadius: 8,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: 600,
    textDecoration: "none",
    cursor: "pointer",
    transition: "all 0.15s",
  },

  // Table view
  tableWrap: { border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden" },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "minmax(220px,2fr) minmax(180px,1fr) minmax(180px,1fr) minmax(160px,1fr) minmax(160px,auto)",
    padding: "12px 16px",
    background: "rgba(255,255,255,0.04)",
    fontSize: 10.5,
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: "rgba(255,255,255,0.55)",
  },
  th: {},
  tr: {
    display: "grid",
    gridTemplateColumns: "minmax(220px,2fr) minmax(180px,1fr) minmax(180px,1fr) minmax(160px,1fr) minmax(160px,auto)",
    alignItems: "center",
    padding: "12px 16px",
    borderTop: "1px solid rgba(255,255,255,0.05)",
    gap: 12,
  },
  tdTitle: { display: "flex", flexDirection: "column" as const, minWidth: 0 },
  tdTitleMain: { color: "#fff", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  tdActions: { display: "flex", gap: 6, justifyContent: "flex-end" },
  iconBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    color: "rgba(255,255,255,0.8)",
    textDecoration: "none",
    cursor: "pointer",
  },

  // Empty state
  emptyState: { textAlign: "center" as const, padding: "80px 20px", animation: "pm-fadeUp 0.5s ease-out" },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 16, color: "rgba(255,255,255,0.4)", margin: "0 0 16px" },
  primaryBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 999, background: "linear-gradient(135deg,#6c3ef4,#00d4aa)", color: "#fff", fontWeight: 800, border: "none", cursor: "pointer" },
  emptyMini: { padding: "40px 20px", textAlign: "center" as const, border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 14, display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 12 },
  resetBtn: { padding: "8px 14px", borderRadius: 10, background: "rgba(108,62,244,0.18)", border: "1px solid rgba(108,62,244,0.4)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" },

  // Loading
  loadingContainer: { minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" },
  spinner: {
    width: 32,
    height: 32,
    border: "3px solid rgba(108, 62, 244, 0.2)",
    borderTopColor: "#6c3ef4",
    borderRadius: "50%",
    animation: "pm-spin 0.8s linear infinite",
  },

  searchWrap: { position: "relative" as const },
  searchInput: {
    width: "100%",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "9px 14px 9px 36px",
    color: "#fff",
    fontSize: 13.5,
    outline: "none",
    transition: "all 0.2s",
  },
  starBtn: {
    position: "absolute" as const,
    top: 10,
    left: 10,
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    background: "rgba(0, 0, 0, 0.4)",
    backdropFilter: "blur(4px)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  starBtnActive: {
    background: "rgba(245, 158, 11, 0.15)",
    border: "1px solid rgba(245, 158, 11, 0.4)",
  },
};