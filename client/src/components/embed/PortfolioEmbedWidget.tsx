import type { ReactNode } from 'react';
import { ExternalLink, Layers3, Lock, ShieldCheck, ShieldAlert, Sparkles } from 'lucide-react';
import FounderBadge from '../FounderBadge';

export type PortfolioWidgetTheme = 'dark' | 'light';
export type PortfolioWidgetLayout = 'grid' | 'list' | 'compact';

export interface PortfolioWidgetSettings {
  theme: PortfolioWidgetTheme;
  layout: PortfolioWidgetLayout;
  showBadges: boolean;
  showBundles: boolean;
  maxItems: number;
  bundleLimit: number;
}

interface WidgetCertificate {
  id: string;
  title: string;
  imageUrl: string | null;
  verifyPath: string;
  proofMode: string;
  visibility: string;
  issuedAt: string | null;
  hash: string;
  hasBundle: boolean;
  stepType: string | null;
  tags: string[];
}

interface WidgetBundleStep {
  id: string;
  stepIndex: number;
  stepType: string;
  title: string;
  previewUrl: string | null;
}

interface WidgetBundle {
  id: string;
  title: string;
  description: string | null;
  createdAt: string | null;
  chainDepth: number;
  headHash: string | null;
  chainSummary?: {
    valid?: boolean;
    mismatches?: string[];
  };
  steps: WidgetBundleStep[];
}

export interface PortfolioWidgetPayload {
  profile: {
    username: string;
    avatarUrl: string | null;
    bio: string | null;
    isFounder: boolean;
  };
  headline: string;
  stats: {
    certificateCount: number;
    bundleCount: number;
    verifiedChainCount: number;
    latestIssuedAt: string | null;
  };
  certificates: WidgetCertificate[];
  bundles: WidgetBundle[];
}

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const layoutMap: Record<PortfolioWidgetLayout, string> = {
  grid: 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3',
  compact: 'grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  list: 'grid gap-4 grid-cols-1',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateFormatter.format(date);
}

function shortHash(value: string, head = 10, tail = 8) {
  if (!value) return '—';
  return value.length > head + tail ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}

function Avatar({ username, avatarUrl }: { username: string; avatarUrl: string | null }) {
  return (
    <div className="relative h-16 w-16 overflow-hidden rounded-[1.35rem] border border-white/10 bg-gradient-to-br from-[#6C3EF4] via-[#30215F] to-[#00D4AA]/70 shadow-[0_20px_60px_rgba(108,62,244,0.35)]">
      {avatarUrl ? (
        <img src={avatarUrl} alt={`${username} avatar`} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xl font-black text-white">
          {username.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.26),transparent_55%)]" />
    </div>
  );
}

function StatCard({ label, value, accent, isLight }: { label: string; value: string; accent?: 'green' | 'purple' | 'gold'; isLight?: boolean }) {
  let accentClass = '';
  if (accent === 'green') {
    accentClass = isLight ? 'border-[#00D4AA]/30 bg-[#00D4AA]/10 text-[#008A6F]' : 'border-[#00D4AA]/20 bg-[#00D4AA]/[0.08] text-[#CFFCF2]';
  } else if (accent === 'gold') {
    accentClass = isLight ? 'border-[#F0BB38]/40 bg-[#F0BB38]/10 text-[#B38500]' : 'border-[#F0BB38]/20 bg-[#F0BB38]/[0.08] text-[#FFF4C4]';
  } else {
    accentClass = isLight ? 'border-slate-200 bg-slate-50 text-slate-800' : 'border-white/[0.08] bg-white/[0.04] text-white';
  }

  return (
    <div className={`rounded-[1.25rem] border px-4 py-4 backdrop-blur-md ${accentClass}`}>
      <div className={`text-[11px] uppercase tracking-[0.24em] ${isLight ? 'text-slate-500' : 'text-white/[0.55]'}`}>{label}</div>
      <div className={`mt-2 text-xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>{value}</div>
    </div>
  );
}

function ProofChip({ children, accent = false, isLight = false }: { children: ReactNode; accent?: boolean; isLight?: boolean }) {
  return (
    <span className={[
      'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]',
      accent ? (isLight ? 'border-[#00D4AA]/40 bg-[#00D4AA]/10 text-[#00997A]' : 'border-[#00D4AA]/25 bg-[#00D4AA]/[0.12] text-[#8DF3DE]')
             : (isLight ? 'border-slate-300 bg-slate-100 text-slate-600' : 'border-white/10 bg-white/5 text-white/70'),
    ].join(' ')}>
      {children}
    </span>
  );
}

function SecurePlaceholder({ hash, isLight }: { hash: string; isLight?: boolean }) {
  return (
    <div className={['flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[1.25rem] border', isLight ? 'border-slate-200 bg-slate-100' : 'border-white/[0.08] bg-[linear-gradient(180deg,#0E1025_0%,#0A0E1F_100%)]'].join(' ')}>
      <div className="flex flex-col items-center gap-4 px-6 text-center">
        <div className={['flex h-12 w-12 items-center justify-center rounded-full border', isLight ? 'border-slate-300 bg-white text-[#00D4AA]' : 'border-white/10 bg-white/5 text-[#00D4AA]'].join(' ')}>
          <Lock className="h-5 w-5" />
        </div>
        <div>
          <div className={['text-sm font-semibold', isLight ? 'text-slate-700' : 'text-white'].join(' ')}>Confidential proof</div>
          <div className={['mt-1 text-xs tracking-[0.24em]', isLight ? 'text-slate-400' : 'text-white/[0.45]'].join(' ')}>{shortHash(hash, 12, 10)}</div>
        </div>
      </div>
    </div>
  );
}

function CertificateCard({ item, settings, priority }: { item: WidgetCertificate; settings: PortfolioWidgetSettings; priority?: boolean; }) {
  const title = item.title || 'Untitled proof';
  const isLight = settings.theme === 'light';

  return (
    <article className={['group overflow-hidden rounded-[1.6rem] border shadow-[0_10px_60px_rgba(0,0,0,0.22)] backdrop-blur-md transition-transform duration-300 hover:-translate-y-1',
      isLight ? 'border-slate-200 bg-white hover:border-slate-300' : 'border-white/[0.08] bg-white/[0.035] hover:border-white/[0.14]'].join(' ')}>
      <div className="relative p-3">
        {/* 👑 UX改善: 小さなボタンだけでなく、画像全体を検証ページへのリンクで包む */}
        <a href={item.verifyPath} target="_blank" rel="noreferrer noopener" className="block focus:outline-none">
          {item.imageUrl ? (
            <div className={['overflow-hidden rounded-[1.25rem] border', isLight ? 'border-slate-200 bg-slate-100' : 'border-white/[0.08] bg-black/20'].join(' ')}>
              {/* 👑 コード改善: fetchPriorityをReact18のネイティブ構文にクリーンアップ */}
              <img src={item.imageUrl} alt={`${title} preview`} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} className="aspect-[4/3] h-auto w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
            </div>
          ) : <SecurePlaceholder hash={item.hash} isLight={isLight} />}
        </a>
        {!isLight && <div className="pointer-events-none absolute inset-x-8 top-8 h-20 rounded-full bg-[#6C3EF4]/[0.18] blur-3xl" />}
      </div>

      <div className="px-5 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className={['line-clamp-2 text-base font-bold tracking-tight', isLight ? 'text-slate-900' : 'text-white'].join(' ')}>{title}</h3>
            <p className={['mt-1 text-sm', isLight ? 'text-slate-500' : 'text-white/[0.55]'].join(' ')}>{formatDate(item.issuedAt)}</p>
          </div>
          <a href={item.verifyPath} target="_blank" rel="noreferrer noopener" aria-label={`${title} の証明ページを開く`}
            className={['inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors hover:border-[#00D4AA]/30 hover:text-[#00D4AA]',
              isLight ? 'border-slate-300 bg-slate-50 text-slate-500' : 'border-white/10 bg-white/5 text-white/80'].join(' ')}>
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {settings.showBadges ? <ProofChip accent isLight={isLight}>{item.proofMode === 'shareable' ? 'Visual proof' : 'Private proof'}</ProofChip> : null}
          <ProofChip isLight={isLight}>{item.visibility}</ProofChip>
          {item.hasBundle ? <ProofChip isLight={isLight}>Chain attached</ProofChip> : null}
          {item.stepType ? <ProofChip isLight={isLight}>{item.stepType}</ProofChip> : null}
          {/* 👑 追加: 埋もれていたタグデータを最大2つまで表示し、クリエイターのアピール力を高める */}
          {item.tags?.slice(0, 2).map(tag => (
            <ProofChip key={tag} isLight={isLight}>#{tag}</ProofChip>
          ))}
        </div>
      </div>
    </article>
  );
}

function BundleCard({ bundle, isLight }: { bundle: WidgetBundle; isLight?: boolean }) {
  const orderedSteps = [...bundle.steps].sort((a, b) => a.stepIndex - b.stepIndex).slice(0, 4);
  const valid = bundle.chainSummary?.valid !== false;

  return (
    <article className={['overflow-hidden rounded-[1.6rem] border shadow-[0_10px_60px_rgba(0,0,0,0.22)] backdrop-blur-md', isLight ? 'border-slate-200 bg-white' : 'border-white/[0.08] bg-white/[0.035]'].join(' ')}>
      <div className={['flex items-start justify-between gap-4 border-b px-5 py-5', isLight ? 'border-slate-200' : 'border-white/[0.08]'].join(' ')}>
        <div className="min-w-0">
          <div className={['text-[11px] uppercase tracking-[0.24em]', isLight ? 'text-slate-400' : 'text-white/[0.45]'].join(' ')}>Chain of Evidence</div>
          <h3 className={['mt-2 text-lg font-bold tracking-tight', isLight ? 'text-slate-900' : 'text-white'].join(' ')}>{bundle.title}</h3>
          {bundle.description ? <p className={['mt-2 text-sm leading-6', isLight ? 'text-slate-500' : 'text-white/60'].join(' ')}>{bundle.description}</p> : null}
        </div>
        <div className={['inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em]',
          valid ? (isLight ? 'border-[#00D4AA]/30 bg-[#00D4AA]/10 text-[#00997A]' : 'border-[#00D4AA]/20 bg-[#00D4AA]/10 text-[#9BF8E5]') : 'border-[#F0BB38]/20 bg-[#F0BB38]/10 text-[#F6D986]'].join(' ')}>
          {valid ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
          {valid ? 'Verified' : 'Review'}
        </div>
      </div>

      <div className="grid gap-4 px-5 py-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
          {orderedSteps.map((step) => (
            <div key={step.id} className={['overflow-hidden rounded-[1rem] border', isLight ? 'border-slate-200 bg-slate-50' : 'border-white/[0.08] bg-[#0D1120]'].join(' ')}>
              {step.previewUrl ? <img src={step.previewUrl} alt={`${step.title} preview`} loading="lazy" className="aspect-square w-full object-cover" /> : <div className={['flex aspect-square items-center justify-center px-3 text-center text-xs', isLight ? 'text-slate-400' : 'text-white/[0.45]'].join(' ')}>{step.stepType}</div>}
              <div className={['border-t px-3 py-2', isLight ? 'border-slate-200' : 'border-white/[0.08]'].join(' ')}>
                <div className={['line-clamp-1 text-xs font-semibold', isLight ? 'text-slate-800' : 'text-white'].join(' ')}>{step.title}</div>
                <div className={['mt-1 text-[10px] uppercase tracking-[0.2em]', isLight ? 'text-slate-400' : 'text-white/40'].join(' ')}>Step {step.stepIndex + 1}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-3">
          <StatCard label="Linked steps" value={String(bundle.chainDepth || bundle.steps.length)} accent="purple" isLight={isLight} />
          <StatCard label="Head hash" value={shortHash(bundle.headHash || '', 8, 6)} accent="green" isLight={isLight} />
          <StatCard label="Updated" value={formatDate(bundle.createdAt)} accent="gold" isLight={isLight} />
        </div>
      </div>
    </article>
  );
}

export default function PortfolioEmbedWidget({ payload, settings }: { payload: PortfolioWidgetPayload; settings: PortfolioWidgetSettings; }) {
  const certificates = payload.certificates.slice(0, settings.maxItems);
  const bundles = settings.showBundles ? payload.bundles.slice(0, settings.bundleLimit) : [];
  const isLight = settings.theme === 'light';

  return (
    <main className={['proofmark-widget-shell proofmark-widget-grid relative overflow-hidden rounded-[2rem] border px-4 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7',
      isLight ? 'border-slate-200 bg-white text-slate-950 shadow-[0_20px_100px_rgba(2,12,27,0.12)]' : 'border-white/10 bg-[#050816] text-white shadow-[0_24px_120px_rgba(2,8,24,0.45)]'].join(' ')}>
      {!isLight && <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(108,62,244,.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(0,212,170,.12),transparent_28%)]" />}

      <section className={['relative overflow-hidden rounded-[1.8rem] border px-5 py-5 sm:px-6 sm:py-6',
        isLight ? 'border-slate-200 bg-slate-50' : 'border-white/[0.08] bg-[linear-gradient(135deg,rgba(13,16,36,.96)_0%,rgba(11,18,33,.9)_55%,rgba(7,10,23,.96)_100%)]'].join(' ')}>
        {!isLight && <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,.08),transparent_42%)]" />}
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar username={payload.profile.username} avatarUrl={payload.profile.avatarUrl} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={['inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em]',
                    isLight ? 'border-[#00D4AA]/30 bg-[#00D4AA]/10 text-[#00997A]' : 'border-white/10 bg-white/5 text-white/70'].join(' ')}>
                    <Sparkles className="h-3.5 w-3.5 text-[#00D4AA]" /> Verified Portfolio
                  </span>
                  {payload.profile.isFounder ? <FounderBadge className="!py-1 !px-3" /> : null}
                </div>
                <h1 className={['mt-3 text-2xl font-black tracking-tight sm:text-[2rem]', isLight ? 'text-slate-900' : 'text-white'].join(' ')}>@{payload.profile.username}</h1>
                <p className={['mt-2 max-w-3xl text-sm leading-6 sm:text-[15px] whitespace-pre-wrap', isLight ? 'text-slate-600' : 'text-white/[0.65]'].join(' ')}>{payload.headline}</p>
              </div>
            </div>
          </div>
          <a href={`/u/${payload.profile.username}`} target="_blank" rel="noreferrer noopener"
            className={['inline-flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition-colors hover:border-[#00D4AA]/30 hover:text-[#00D4AA]',
              isLight ? 'border-slate-300 bg-white text-slate-700 shadow-sm' : 'border-white/10 bg-white/5 text-white'].join(' ')}>
            Open full profile <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Verified works" value={String(payload.stats.certificateCount)} isLight={isLight} />
          <StatCard label="Evidence chains" value={String(payload.stats.bundleCount)} accent="purple" isLight={isLight} />
          <StatCard label="Integrity verified" value={String(payload.stats.verifiedChainCount)} accent="green" isLight={isLight} />
          <StatCard label="Latest proof" value={formatDate(payload.stats.latestIssuedAt)} accent="gold" isLight={isLight} />
        </div>
      </section>

      <section className="relative mt-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className={['text-lg font-bold tracking-tight', isLight ? 'text-slate-900' : 'text-white'].join(' ')}>Verified works</h2>
            <p className={['mt-1 text-sm', isLight ? 'text-slate-500' : 'text-white/[0.55]'].join(' ')}>公開設定とプライバシー設定を保ったまま、検証導線だけを綺麗に見せる埋め込みです。</p>
          </div>
        </div>
        {certificates.length > 0 ? (
          <div className={layoutMap[settings.layout]}>
            {certificates.map((item, index) => <CertificateCard key={item.id} item={item} settings={settings} priority={index < 2} />)}
          </div>
        ) : (
          <div className={['rounded-[1.4rem] border px-5 py-8 text-sm', isLight ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-white/[0.08] bg-white/[0.035] text-white/[0.55]'].join(' ')}>
            公開中の作品はまだありません。
          </div>
        )}
      </section>

      {bundles.length > 0 ? (
        <section className="relative mt-5">
          <div className="mb-4 flex items-center gap-2">
            <Layers3 className="h-4 w-4 text-[#00D4AA]" />
            <h2 className={['text-lg font-bold tracking-tight', isLight ? 'text-slate-900' : 'text-white'].join(' ')}>Chain of Evidence</h2>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {bundles.map((bundle) => <BundleCard key={bundle.id} bundle={bundle} isLight={isLight} />)}
          </div>
        </section>
      ) : null}

      <div className={['relative mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border px-4 py-3 text-xs',
        isLight ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-white/[0.08] bg-white/[0.03] text-white/50'].join(' ')}>
        <span>Powered by ProofMark · creator-first verification</span>
        <a href="https://www.proofmark.jp/what-it-proves" target="_blank" rel="noreferrer noopener" className={['inline-flex items-center gap-2 font-semibold transition-colors hover:text-[#00D4AA]', isLight ? 'text-slate-700' : 'text-white/75'].join(' ')}>
          What ProofMark proves <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </main>
  );
}
