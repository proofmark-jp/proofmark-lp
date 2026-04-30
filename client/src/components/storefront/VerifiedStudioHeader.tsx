/**
 * VerifiedStudioHeader — 「権威」を宿した法人プロフィール ヘッダー。
 *
 * Sprint 4 の最重要コンポーネント。Studio プランに移行した瞬間に、
 * デザインの重心が個人アバターから法人ロゴ＋独自ドメインへ滑らかに移動する。
 *
 * 設計の細部:
 *   • Verified バッジは VERIFIED_TOKENS の階層 (verified / pending / unverified)
 *     に応じて配色とコピーを切り替える。verified 時のみ、内部にアクセントの
 *     ライン（accent-line に相当）と微妙な glow を付与し、"宝石" の重みを出す。
 *   • Studio Name と独自ドメインがある場合は、ドメイン側を「公的識別子」と
 *     して並べる（Apple の "Designed by Apple in California" の論法）。
 *   • Free / Creator はアバター中心の従来 UI に自動でフォールバック。
 *     Progressive Disclosure を死守。
 *
 * 配色:
 *   完全に index.css の CSS 変数 (--card / --border / --primary / --accent) と
 *   ハードコード hex (#6c3ef4 / #00d4aa / #f0f0fa / #a0a0c0) のみを使用。
 */

import { motion } from 'framer-motion';
import { Globe, ShieldCheck, ShieldAlert, ShieldQuestion, Sparkles } from 'lucide-react';
import {
  VERIFIED_TOKENS,
  type VerifiedTier,
} from '../../lib/proofmark-storefront';

interface StorefrontProfile {
  username: string;
  avatar_url: string | null;
  studio_name: string | null;
  studio_logo_url: string | null;
  studio_domain: string | null;
  studio_tagline: string | null;
  studio_bio: string | null;
  verified_status: VerifiedTier;
  verified_at: string | null;
  verified_method: string | null;
  is_founder: boolean;
  plan_tier: string;
}

interface KpiSummary {
  total_assets: number;
  public_assets: number;
  nda_masked_assets: number;
  trusted_tsa_count: number;
  audited_chain_count: number;
}

interface Props {
  profile: StorefrontProfile;
  kpi: KpiSummary | null;
}

const TIER_ICON: Record<VerifiedTier, React.ComponentType<{ className?: string }>> = {
  verified: ShieldCheck,
  pending: ShieldAlert,
  unverified: ShieldQuestion,
};

export function VerifiedStudioHeader({ profile, kpi }: Props) {
  const isStudio = profile.plan_tier === 'studio' || profile.plan_tier === 'business';
  const tier: VerifiedTier =
    profile.verified_status && (['verified', 'pending', 'unverified'] as const).includes(profile.verified_status as VerifiedTier)
      ? (profile.verified_status as VerifiedTier)
      : 'unverified';
  const tierToken = VERIFIED_TOKENS[tier];
  const TierIcon = TIER_ICON[tier];

  // 表示名: Studio が設定されていればそれを最優先、無ければ @username
  const displayName = isStudio && profile.studio_name ? profile.studio_name : `@${profile.username}`;
  const subtitle =
    isStudio && profile.studio_tagline
      ? profile.studio_tagline
      : profile.studio_bio ??
        '暗号学的に検証可能な作品証明を、案件ごとに整理して公開しています。';

  return (
    <motion.header
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-[calc(0.65rem+4px)] border border-[#2a2a4e] bg-[#151d2f]"
      aria-label="Studio Profile Header"
    >
      {/* グラデーションのアクセントライン (Manus DNA: gradient-primary 135deg) */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(108,62,244,0.7) 30%, rgba(0,212,170,0.7) 70%, transparent 100%)',
        }}
      />
      {tier === 'verified' && (
        <div
          aria-hidden="true"
          className="absolute -top-10 -right-10 w-48 h-48 rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at center, rgba(0,212,170,0.18), transparent 70%)',
            filter: 'blur(24px)',
          }}
        />
      )}

      <div className="relative flex flex-col gap-6 p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
        {/* ── 左: ロゴ / アバター + 名称 ─────────────────────── */}
        <div className="flex items-start gap-5 min-w-0">
          <StudioMark
            isStudio={isStudio}
            logoUrl={profile.studio_logo_url}
            avatarUrl={profile.avatar_url}
            displayName={displayName}
            verified={tier === 'verified'}
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className="font-display font-extrabold text-[28px] sm:text-[34px] tracking-tight text-[#f0f0fa] leading-[1.05] truncate"
                style={{ letterSpacing: '-0.02em' }}
              >
                {displayName}
              </h1>
              {profile.is_founder && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    color: '#FFD966',
                    background: 'rgba(255,217,102,0.10)',
                    border: '1px solid rgba(255,217,102,0.40)',
                  }}
                  title="ProofMark Founder"
                >
                  <Sparkles className="w-3 h-3" aria-hidden="true" />
                  Founder
                </span>
              )}
            </div>

            {/* 公的識別子: 独自ドメイン or @handle */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#a0a0c0]">
              {isStudio && profile.studio_domain && (
                <a
                  href={`https://${profile.studio_domain}`}
                  target="_blank"
                  rel="noopener noreferrer ugc"
                  className="inline-flex items-center gap-1.5 hover:text-[#00D4AA] transition-colors"
                >
                  <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                  {profile.studio_domain}
                </a>
              )}
              {isStudio && profile.studio_domain && (
                <span aria-hidden="true" className="text-[#2a2a4e]">·</span>
              )}
              <span className="text-[#a0a0c0]/70">@{profile.username}</span>
            </div>

            <p className="mt-3 text-[14px] leading-relaxed text-[#a0a0c0] max-w-prose">
              {subtitle}
            </p>
          </div>
        </div>

        {/* ── 右: Verified バッジ + ミニ KPI ──────────────────── */}
        <div className="flex flex-col items-stretch md:items-end gap-3 shrink-0">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 320, damping: 28 }}
            className="inline-flex items-center gap-2.5 self-start md:self-end rounded-[calc(0.65rem-2px)] px-3 py-2"
            style={{
              background: tierToken.bg,
              border: `1px solid ${tierToken.border}`,
              color: tierToken.color,
              boxShadow:
                tier === 'verified'
                  ? '0 0 24px rgba(0,212,170,0.18), inset 0 0 0 1px rgba(0,212,170,0.15)'
                  : 'none',
            }}
            role="status"
            aria-label={`${tierToken.label} — ${tierToken.description}`}
            title={tierToken.description}
          >
            <TierIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="flex flex-col leading-tight">
              <span className="text-[12px] font-bold tracking-wide">{tierToken.label}</span>
              <span className="text-[10px] font-medium opacity-80">{tierToken.sublabel}</span>
            </span>
          </motion.div>

          {kpi && (
            <div className="flex flex-wrap gap-2 md:justify-end">
              <KpiPill label="証明済" value={kpi.total_assets} />
              {kpi.trusted_tsa_count > 0 && (
                <KpiPill label="Trusted TSA" value={kpi.trusted_tsa_count} accent="#00D4AA" />
              )}
              {kpi.audited_chain_count > 0 && (
                <KpiPill
                  label="監査チェーン"
                  value={kpi.audited_chain_count}
                  accent="#6C3EF4"
                />
              )}
              {kpi.nda_masked_assets > 0 && (
                <KpiPill
                  label="NDA案件"
                  value={kpi.nda_masked_assets}
                  accent="#FFD966"
                  title="NDA 締結中の機密案件件数"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </motion.header>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

interface StudioMarkProps {
  isStudio: boolean;
  logoUrl: string | null;
  avatarUrl: string | null;
  displayName: string;
  verified: boolean;
}

function StudioMark({ isStudio, logoUrl, avatarUrl, displayName, verified }: StudioMarkProps) {
  const showLogo = isStudio && logoUrl;
  const initials = displayName
    .replace(/^@/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s.charAt(0).toUpperCase())
    .join('') || '◇';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="relative shrink-0"
    >
      <div
        className="relative w-[76px] h-[76px] sm:w-[88px] sm:h-[88px] rounded-[calc(0.65rem)] overflow-hidden flex items-center justify-center"
        style={{
          background: showLogo
            ? '#0a0e27'
            : 'linear-gradient(135deg, rgba(108,62,244,0.20), rgba(0,212,170,0.18))',
          border: '1px solid #2a2a4e',
          boxShadow: verified
            ? '0 0 24px rgba(0,212,170,0.25), inset 0 0 0 1px rgba(0,212,170,0.20)'
            : '0 8px 24px -16px rgba(108,62,244,0.45)',
        }}
        aria-hidden="true"
      >
        {showLogo ? (
          // 法人ロゴは contain で歪ませない
          <img
            src={logoUrl}
            alt=""
            className="w-full h-full object-contain p-2"
            loading="eager"
            decoding="async"
          />
        ) : avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" loading="eager" decoding="async" />
        ) : (
          <span className="font-display font-extrabold text-[24px] text-[#f0f0fa] tracking-tight">
            {initials}
          </span>
        )}
      </div>
      {verified && (
        <span
          className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
          style={{
            background: '#00D4AA',
            color: '#0a0e27',
            boxShadow: '0 0 0 2px #151d2f, 0 4px 12px rgba(0,212,170,0.45)',
          }}
          aria-label="Verified"
        >
          <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
        </span>
      )}
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

interface KpiPillProps {
  label: string;
  value: number | string;
  accent?: string;
  title?: string;
}

function KpiPill({ label, value, accent = '#a0a0c0', title }: KpiPillProps) {
  return (
    <span
      title={title ?? label}
      className="inline-flex items-baseline gap-1.5 rounded-full px-2.5 py-1 border border-[#2a2a4e] bg-[#0a0e27] text-[11px]"
    >
      <span className="font-bold tabular-nums" style={{ color: accent }}>
        {value}
      </span>
      <span className="text-[#a0a0c0]">{label}</span>
    </span>
  );
}
