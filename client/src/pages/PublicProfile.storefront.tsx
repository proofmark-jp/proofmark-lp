/**
 * PublicProfile.storefront.tsx — Sprint 4 Storefront ページ本体。
 *
 * 適用方法:
 *   既存の `PublicProfile.tsx` を**置き換えない**。`App.tsx` 側で
 *     <Route path="/u/:username" component={PublicProfileStorefront} />
 *   と差し替えるだけ。Free / Creator は Storefront のミニマル表現で
 *   描画され、Studio / Verified Studio は宝石化されたヘッダーへ昇格。
 *
 * Zero-Op:
 *   • サーバ側に Storefront データの集約 RPC (008 マイグレーション) を
 *     用意してあるため、フロントは1リクエストで完結。
 *   • Contact は外部 URL を開くだけ。内部メッセージ機能は持たない。
 *
 * Performance:
 *   • Dropzone と AuditDrawer は `lazy()` で遅延読み込み (LCP を阻害しない)。
 *   • 監査チェーン整合は **クリック時のみ** に取得 (60 件のカードで
 *     一斉 fetch しない)。
 */

import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useRoute } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowDownToLine, Layers3, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

import { VerifiedStudioHeader } from '../components/storefront/VerifiedStudioHeader';
import {
  StorefrontProofCard,
  type StorefrontCertModel,
} from '../components/storefront/StorefrontProofCard';
import {
  ProjectShowcaseRail,
  type ShowcaseProjectModel,
} from '../components/storefront/ProjectShowcaseRail';
import { ContactCta } from '../components/storefront/ContactCta';
import type { VerifiedTier } from '../lib/proofmark-storefront';

// 重量級コンポーネントは遅延ロード (LCP 最適化)
const ZeroKnowledgeDropzone = lazy(() =>
  import('../components/storefront/ZeroKnowledgeDropzone').then((m) => ({
    default: m.ZeroKnowledgeDropzone,
  })),
);
const AuditDrawer = lazy(() =>
  import('../components/ops/AuditDrawer').then((m) => ({ default: m.AuditDrawer })),
);

interface StorefrontProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  studio_name: string | null;
  studio_logo_url: string | null;
  studio_domain: string | null;
  studio_tagline: string | null;
  studio_bio: string | null;
  contact_url: string | null;
  contact_label: string | null;
  nda_default_mode: 'open' | 'masked' | 'hidden';
  verified_status: VerifiedTier;
  verified_at: string | null;
  verified_method: string | null;
  is_founder: boolean;
  plan_tier: string;
  storefront_theme: Record<string, unknown>;
}

interface KpiSummary {
  total_assets: number;
  public_assets: number;
  nda_masked_assets: number;
  trusted_tsa_count: number;
  audited_chain_count: number;
  latest_proven_at: string | null;
}

interface StorefrontApiResponse {
  profile: StorefrontProfile;
  kpi: KpiSummary | null;
  projects: ShowcaseProjectModel[];
  certificates: StorefrontCertModel[];
  activeProjectId: string | null;
}

const ALL_ID = '__all__';

export default function PublicProfileStorefront() {
  const [, params] = useRoute<{ username: string }>('/u/:username');
  const username = (params?.username ?? '').trim();

  const [data, setData] = useState<StorefrontApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState<string>(ALL_ID);
  const [auditCertId, setAuditCertId] = useState<string | null>(null);
  const [auditCertTitle, setAuditCertTitle] = useState<string | null>(null);

  const { user } = useAuth();
  const isOwner = !!(user && data?.profile && user.id === data.profile.id);

  // ── データフェッチ ─────────────────────────────────────────
  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const url = new URL('/api/profiles/storefront', window.location.origin);
        url.searchParams.set('username', username);
        const res = await fetch(url.toString(), { credentials: 'omit' });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 404) {
          setError('not_found');
          setData(null);
          return;
        }
        if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
        setData(body as StorefrontApiResponse);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [username]);

  // ── 派生: 表示する証明書 ──────────────────────────────────
  const certs = useMemo<StorefrontCertModel[]>(() => {
    if (!data) return [];
    if (activeProjectId === ALL_ID) return data.certificates;
    return data.certificates.filter((c) => c.project_id === activeProjectId);
  }, [data, activeProjectId]);

  // ── SEO meta (内製、依存ライブラリ追加なし) ────────────────
  useEffect(() => {
    if (!data?.profile) return;
    const p = data.profile;
    const titleName = p.studio_name ?? `@${p.username}`;
    const description =
      p.studio_tagline ??
      p.studio_bio ??
      `${titleName} — ProofMark Verified Studio. 暗号学的に検証可能な作品証明を公開しています。`;
    document.title = `${titleName} | ProofMark Studio`;
    setMeta('description', description);
    setMeta('og:title', titleName);
    setMeta('og:description', description);
    setMeta('og:type', 'profile');
    setMeta('og:url', window.location.href);
    if (p.studio_logo_url) setMeta('og:image', p.studio_logo_url);
    setMeta('twitter:card', 'summary_large_image');
  }, [data?.profile]);

  if (loading) return <PageSkeleton />;

  if (error === 'not_found' || !data) {
    return <NotFoundState username={username} />;
  }

  const { profile, kpi, projects } = data;
  const totalCount = data.certificates.length;

  return (
    <div
      className="min-h-screen text-[#f0f0fa]"
      style={{
        background:
          'radial-gradient(circle at 20% -10%, rgba(108,62,244,0.10), transparent 50%), radial-gradient(circle at 80% 0%, rgba(0,212,170,0.08), transparent 55%), #0a0e27',
      }}
    >
      <div className="container mx-auto py-10 sm:py-14 max-w-[1280px]">
        {/* ── Header ────────────────────────────────────────── */}
        <VerifiedStudioHeader profile={profile} kpi={kpi} />

        {/* ── Trust strip ──────────────────────────────────── */}
        {kpi && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[#a0a0c0]"
            aria-label="Storefront のトラストサマリ"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#00D4AA]" aria-hidden="true" />
            <span>
              {kpi.public_assets} 件の公開実績 ・ NDA 締結中の機密案件 {kpi.nda_masked_assets} 件
              {kpi.audited_chain_count > 0 && (
                <> ・ 監査チェーンに裏付けられた {kpi.audited_chain_count} 件</>
              )}
            </span>
          </motion.div>
        )}

        {/* ── Contact CTA (有効な URL がある場合のみ描画) ─── */}
        <div className="mt-6">
          <ContactCta
            url={profile.contact_url}
            label={profile.contact_label}
            studioName={profile.studio_name ?? `@${profile.username}`}
            verified={profile.verified_status === 'verified'}
          />
        </div>

        {/* ── Project rail ────────────────────────────────── */}
        <div className="mt-8">
          <ProjectShowcaseRail
            projects={projects}
            activeId={activeProjectId}
            onChange={setActiveProjectId}
            totalCount={totalCount}
          />
        </div>

        {/* ── Cert grid ───────────────────────────────────── */}
        <main className="mt-6">
          {certs.length === 0 ? (
            <EmptyGrid />
          ) : (
            <ul
              className="grid gap-5 sm:gap-6"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              }}
            >
              {certs.map((c) => (
                <li key={c.id}>
                  <StorefrontProofCard
                    cert={c}
                    ndaMode={profile.nda_default_mode}
                    isOwner={isOwner}
                    onOpenAudit={(cert) => {
                      setAuditCertId(cert.id);
                      setAuditCertTitle(cert.title);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </main>

        {/* ── Zero-Knowledge Dropzone (lazy) ────────────────── */}
        <section className="mt-12" aria-label="ファイル検証">
          <Suspense fallback={<DropzoneSkeleton />}>
            <ZeroKnowledgeDropzone username={profile.username} />
          </Suspense>
        </section>

        {/* ── Storefront footer (法的境界) ──────────────────── */}
        <footer className="mt-12 pt-8 border-t border-[#2a2a4e] text-center">
          <p className="text-[11px] text-[#a0a0c0] leading-relaxed">
            このページは ProofMark Storefront によって配信されています。
            表示されている全ての作品は <code className="text-[#f0f0fa]/80 font-mono">SHA-256</code> ハッシュと
            <code className="text-[#f0f0fa]/80 font-mono"> RFC3161</code> タイムスタンプで存在事実が記録されています。
          </p>
          <a
            href="/trust-center"
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#00D4AA] hover:underline"
          >
            <Layers3 className="w-3 h-3" aria-hidden="true" />
            検証手順と信頼境界 (Trust Center)
          </a>
        </footer>
      </div>

      {/* ── Audit Drawer (lazy, on-demand) ─────────────────── */}
      <Suspense fallback={null}>
        <AuditDrawer
          open={!!auditCertId}
          certificateId={auditCertId}
          certificateTitle={auditCertTitle}
          onClose={() => {
            setAuditCertId(null);
            setAuditCertTitle(null);
          }}
        />
      </Suspense>

      <style>{`
        .proofmark-scrollbar::-webkit-scrollbar { height: 8px; }
        .proofmark-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(90deg, rgba(108,62,244,0.5), rgba(0,212,170,0.4));
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

/* ─────────────────────────────────────────────────────────── */

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-[#0a0e27]">
      <div className="container mx-auto py-12 max-w-[1280px]" role="status" aria-live="polite">
        <div className="rounded-[calc(0.65rem+4px)] border border-[#2a2a4e] bg-[#151d2f] h-44 animate-pulse" />
        <div className="mt-6 flex gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 w-28 rounded-full bg-[#151d2f] border border-[#2a2a4e] animate-pulse" />
          ))}
        </div>
        <div
          className="mt-8 grid gap-5"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="aspect-[4/3] rounded-[calc(0.65rem+2px)] bg-[#151d2f] border border-[#2a2a4e] animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

function DropzoneSkeleton() {
  return (
    <div className="rounded-[calc(0.65rem+4px)] border border-[#2a2a4e] bg-[#151d2f] h-[260px] animate-pulse" aria-hidden="true" />
  );
}

function EmptyGrid() {
  return (
    <div className="rounded-[calc(0.65rem+4px)] border border-dashed border-[#2a2a4e] bg-[#151d2f]/40 py-16 text-center">
      <ShieldCheck className="w-7 h-7 mx-auto text-[#a0a0c0]" aria-hidden="true" />
      <p className="mt-3 text-[14px] font-semibold text-[#f0f0fa]/85">公開された実績はまだありません</p>
      <p className="mt-1 text-[11px] text-[#a0a0c0]">
        スタジオが作品を公開すると、ここに宝石のように配置されます。
      </p>
    </div>
  );
}

function NotFoundState({ username }: { username: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0e27] text-[#f0f0fa]">
      <div className="text-center max-w-md px-6">
        <ArrowDownToLine className="w-8 h-8 mx-auto text-[#a0a0c0] mb-3" aria-hidden="true" />
        <h1 className="font-display font-extrabold text-[28px] tracking-tight">
          Storefront が見つかりません
        </h1>
        <p className="mt-2 text-[13px] text-[#a0a0c0]">
          @{username || '—'} のプロフィールは公開されていないか、存在しません。
          URL をご確認ください。
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center gap-1.5 rounded-[calc(0.65rem-2px)] px-4 py-2 text-[13px] font-semibold"
          style={{
            background: 'linear-gradient(135deg, #6c3ef4 0%, #00d4aa 100%)',
            color: '#0a0e27',
          }}
        >
          ProofMark トップへ
        </a>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

function setMeta(name: string, content: string) {
  if (!content) return;
  const isOg = name.startsWith('og:');
  const sel = isOg ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(sel);
  if (!el) {
    el = document.createElement('meta');
    if (isOg) el.setAttribute('property', name);
    else el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}
