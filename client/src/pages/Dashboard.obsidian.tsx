/**
 * Dashboard.obsidian.tsx — The Obsidian Desk
 *
 * 「プロのクリエイターが毎日無心で作業に没頭できる、WeTransfer のような静寂な作業空間」
 * を実装する **新規ページ** です。既存 `Dashboard.tsx` および
 * `Dashboard.studio.tsx` を**置換しません**。ルーティング側で必要に応じて
 * `<Route path="/dashboard" component={DashboardObsidian} />` に切り替えます。
 *
 * 絶対遵守ルール（再掲）:
 *   - 提供された CertificateUpload.c2pa-patch.tsx の useEffect /
 *     handleIssueCertificate / supabase 呼び出し / state には**1文字も触らない**。
 *   - 既存の Navbar.tsx / index.css / pm.* トークン / shadcn UI を尊重し、
 *     独自ボタンや独自テーブルを乱立させない（フランケンシュタイン化禁止）。
 *
 * 機能:
 *   - 正規 Navbar.tsx を上部に配置（LP用 LpNavbar は使わない）
 *   - 画面中央に巨大なドロップゾーン（UploadShell が CertificateUpload を包む）
 *   - 下部に履歴テーブル（Skeleton / Empty / Verified バッジ完備）
 *   - データ取得は親 (=本ページ) で行い、UI コンポーネントは静的に保つ
 *
 * データ取得は提供 Dashboard.tsx と完全に同じ supabase クエリを採用しているため、
 * RLS / 列名の互換性は保証される。手を入れているのは **画面構造のみ**。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';

import Navbar from '@/components/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Certificate, CertificateStatus } from '@/lib/types';

// 保護対象（1文字も触れない）。c2pa パッチ版を直接マウントする。
import CertificateUpload from '@/components/CertificateUpload.c2pa-patch';

import { UploadShell } from '@/components/dashboard/UploadShell';
import { HistoryTable } from '@/components/dashboard/HistoryTable';
import { PM, EASE, D } from '@/components/dashboard/obsidian-tokens';

/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Supabase の certificates テーブル列を、フロント表示用 `Certificate` 型へ
 * **読み取り専用で**マッピングする純関数。書き込み・更新は一切行わない。
 *
 * 既存 Dashboard.tsx の Cert 構造とフィールド名を完全互換に保つ:
 *   sha256/file_hash, certified_at/created_at, public_verify_token/id, など。
 */
function mapToCertificate(row: Record<string, unknown>): Certificate {
  const id = String(row.id ?? '');
  const fileName =
    (row.title as string) ||
    (row.file_name as string) ||
    (row.original_filename as string) ||
    'Untitled';
  const fileHash =
    (row.sha256 as string) ||
    (row.file_hash as string) ||
    '';
  const issuedAt =
    (row.certified_at as string | null) ||
    (row.created_at as string | null) ||
    null;

  // 既存ロジックの整合: timestamp_token + certified_at が揃ったら verified
  const hasToken = Boolean(row.timestamp_token) && Boolean(row.certified_at);
  const isArchived = Boolean(row.is_archived);
  let status: CertificateStatus = 'idle';
  if (isArchived) status = 'idle';
  else if (hasToken) status = 'verified';
  else if (row.created_at) status = 'processing';

  return {
    id,
    user_id: String(row.user_id ?? ''),
    file_name: fileName,
    file_size: Number(row.file_size ?? 0),
    file_hash: fileHash,
    status,
    issued_at: issuedAt,
    tsa_receipt_id:
      (row.timestamp_token_id as string | undefined) ||
      (row.public_verify_token as string | undefined) ||
      undefined,
    has_c2pa_data: Boolean(row.c2pa_manifest ?? row.has_c2pa_data),
    verification_url: id ? `/cert/${id}` : undefined,
    evidence_pack_url: id ? `/api/generate-evidence-pack?cert=${id}` : undefined,
    client_project: (row.client_project as string) || undefined,
  } as any;
}

/* ──────────────────────────────────────────────────────────────────────── */

export default function DashboardObsidian() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [, navigate] = useLocation();

  // 履歴テーブル用の **読み取り専用** state。保護対象とは完全に別領域。
  const [rows, setRows] = useState<Certificate[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  const plan_tier = (user?.user_metadata?.plan_tier as string) || 'free';

  // ドロップゾーンへのスムーススクロール用
  const dropZoneRef = useRef<HTMLDivElement | null>(null);

  /* ── 未認証ガード（提供 Dashboard.tsx と同一の挙動） ────────────────── */
  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, user, navigate]);

  /* ── 履歴データ取得（読み取りのみ。supabase クエリは既存と同等） ─── */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoadingRows(true);
      let query = supabase
        .from('certificates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (!showArchived) {
        query = query.eq('is_archived', false);
      }

      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        // 静寂を保つ。テーブル側で空状態を表示する。
        setRows([]);
      } else {
        setRows((data ?? []).map(mapToCertificate));
      }
      setLoadingRows(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, showArchived]);

  /* ── アクションハンドラ（Dashboard.tsx から移植） ────────────────── */
  const handleDownloadEvidencePack = async (cert: Certificate) => {
    try {
      toast.loading("Evidence Packを生成しています...", { id: `evidence-${cert.id}` });
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(`/api/generate-evidence-pack?cert=${cert.id}`, {
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        credentials: "omit",
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          if (j?.error) msg = `${j.error}${j.reqId ? ` (req: ${j.reqId})` : ""}`;
        } catch { }
        throw new Error(msg);
      }

      const cd = res.headers.get("content-disposition") || "";
      const m5987 = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cd);
      const mPlain = /filename\s*=\s*"?([^";]+)"?/i.exec(cd);
      const filename = m5987
        ? decodeURIComponent(m5987[1])
        : mPlain
        ? mPlain[1]
        : `proofmark-evidence-${cert.id.slice(0, 8)}.zip`;

      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);

      toast.success("Evidence Pack をダウンロードしました", { id: `evidence-${cert.id}` });
    } catch (e: any) {
      toast.error("Evidence Pack 生成に失敗しました", {
        id: `evidence-${cert.id}`,
        description: e?.message ?? "API をご確認ください。",
      });
    }
  };

  const handleAssignProject = async (cert: Certificate) => {
    const current = (cert as any).client_project ?? "";
    const next = window.prompt(
      "この証明書を紐づける案件名（例: ACME社 / 表紙イラスト 2026-04）",
      current
    );
    if (next === null) return;
    const trimmed = next.trim() || null;

    setRows((prev) => prev.map((r) => (r.id === cert.id ? { ...r, client_project: trimmed } : r)));

    const { error } = await supabase
      .from("certificates")
      .update({ client_project: trimmed })
      .eq("id", cert.id);

    if (error) {
      setRows((prev) => prev.map((r) => (r.id === cert.id ? { ...r, client_project: current } : r)));
      toast.error("案件の紐づけに失敗しました", { description: error.message });
    } else {
      toast.success(trimmed ? `「${trimmed}」に紐づけました` : "案件の紐づけを解除しました");
    }
  };

  /* ── 履歴件数・KPI 表示は意図的に省略（マーケ装飾の排除） ───────── */
  const headline = useMemo(() => {
    const verified = rows.filter((r) => r.status === 'verified').length;
    if (loadingRows) return '読み込み中…';
    if (rows.length === 0) return '最初の証明を、ここで。';
    if (verified === rows.length) return `${verified} 件の証明が、静かに守られています。`;
    return `${verified} / ${rows.length} 件が証明済み。`;
  }, [rows, loadingRows]);

  /* ── ローディング中は最小スピナーで完全待機（フラッシュ防止） ─── */
  if (authLoading) return <FullPageQuiet />;
  if (!user) return null; // navigate('/auth') 進行中

  /* ── 本体 ───────────────────────────────────────────────────────── */
  return (
    <div
      className="min-h-screen"
      style={{
        background: PM.bg,
        color: PM.textMain,
        // 黒曜石の机：上部にごく僅かな冷たさ、下部はインク色へ
        backgroundImage:
          'radial-gradient(1200px 600px at 50% -10%, rgba(108,62,244,0.07), transparent 60%), linear-gradient(180deg, #07061A 0%, #07061A 100%)',
      }}
    >
      {/* 正規 Navbar（LP 用 LpNavbar は不使用。仕様準拠） */}
      <Navbar user={user} signOut={signOut} />

      <main
        className="relative mx-auto px-4 sm:px-6"
        style={{ maxWidth: 1080 }}
      >
        {/* ── Hero（無音の挨拶。長文マーケコピーは削除） ──────────── */}
        <section
          aria-labelledby="obsidian-headline"
          className="pt-12 sm:pt-16 pb-6 sm:pb-8 text-center"
        >
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: D.slow / 1000, ease: EASE }}
            className="text-[10px] font-bold tracking-[0.3em] uppercase"
            style={{ color: PM.textSubtle }}
          >
            The Obsidian Desk
          </motion.p>
          <motion.h1
            id="obsidian-headline"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: D.hero / 1000, ease: EASE, delay: 0.05 }}
            className="mt-3 font-semibold tracking-tight"
            style={{
              fontSize: 'clamp(22px, 3.4vw, 30px)',
              color: PM.textMain,
              letterSpacing: '-0.01em',
            }}
          >
            {headline}
          </motion.h1>
        </section>

        {/* ── 中央：巨大ドロップゾーン（UploadShell が CertificateUpload を包む） ── */}
        <section
          ref={dropZoneRef}
          aria-label="証明書を発行する"
          className="pb-10 sm:pb-14"
        >
          <UploadShell hint="証明したいファイルをドロップ" maxSizeMB={15}>
            {/*
              ★ ここが絶対保護対象。
              提供された CertificateUpload.c2pa-patch.tsx をそのままマウントする。
              props も渡さない（既存実装に合わせ、内部で useAuth/useC2pa/supabase を使う）。
            */}
            <CertificateUpload />
          </UploadShell>
        </section>

        {/* ── 履歴テーブル（Immutable History） ──────────────────────── */}
        <section
          aria-label="発行済み証明書"
          className="pb-24 pt-4"
        >
          <header className="flex items-baseline justify-between mb-4 px-1">
            <div className="flex items-center gap-4">
              <h2
                className="text-[13px] font-semibold tracking-[0.18em] uppercase"
                style={{ color: PM.textMuted }}
              >
                発行履歴
              </h2>
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] hover:opacity-80 transition-opacity" style={{ color: PM.textSubtle }}>
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  style={{ accentColor: PM.primary }}
                />
                アーカイブも表示
              </label>
            </div>
            {!loadingRows && rows.length > 0 && (
              <span
                className="text-[11px] tabular-nums"
                style={{ color: PM.textSubtle }}
              >
                直近 {rows.length} 件
              </span>
            )}
          </header>
          <HistoryTable
            certificates={rows}
            loading={loadingRows}
            planTier={plan_tier}
            onEvidence={handleDownloadEvidencePack}
            onAssignProject={handleAssignProject}
          />
        </section>
      </main>

      {/* グローバル静寂スタイル（reduced-motion 配慮） */}
      <style>{`
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

/* ──────────────────────────────────────────────────────────────────────── */

function FullPageQuiet() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: PM.bg }}
    >
      <span
        className="w-5 h-5 rounded-full border-2 animate-spin"
        style={{
          borderColor: PM.border,
          borderTopColor: PM.success,
        }}
        aria-label="読み込み中"
      />
    </div>
  );
}
