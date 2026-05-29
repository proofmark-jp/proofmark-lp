/**
 * PortfolioEmbedWidget — God Mode
 * ----------------------------------------------------------------------------
 * 他社サイトの iframe 内で動作する本番埋め込みウィジェット。
 *
 *  - Props / 型 / payload バインディングは100%維持
 *  - LP デモの神 UI (radial aura / breathing badge / generative hash thumb /
 *    layout motion / glow under-card / theme-aware glass) を完全移植
 *  - iframe overflow:hidden 環境を想定し、外周に十分な padding を確保し、
 *    hover の浮き上がりは最大 -2px、scale は ≤1.02 までに抑制
 *  - useReducedMotion で全アニメを完全フォールバック
 * ----------------------------------------------------------------------------
 */

import { useMemo, useState, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
  type Variants,
} from 'framer-motion';
import {
  Check,
  ExternalLink,
  Fingerprint,
  Layers3,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import FounderBadge from '../FounderBadge';

/* ───────────────── Public types (UNCHANGED) ───────────────── */

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

/* ───────────────── Tokens ───────────────── */

const PM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const ACCENT = {
  teal: { hex: '#00D4AA', rgb: '0,212,170' },
  purple: { hex: '#6C3EF4', rgb: '108,62,244' },
  gold: { hex: '#F0BB38', rgb: '240,187,56' },
} as const;

interface ThemeTokens {
  isLight: boolean;
  shellBg: string;
  shellBorder: string;
  headerBg: string;
  headerBorder: string;
  cardBg: string;
  cardBorder: string;
  cardBorderHover: string;
  textMain: string;
  textMuted: string;
  textSubtle: string;
  divider: string;
  innerSurface: string;
  innerBorder: string;
}

function buildTheme(isLight: boolean): ThemeTokens {
  return isLight
    ? {
        isLight: true,
        shellBg: '#FFFFFF',
        shellBorder: 'rgba(15,15,30,0.10)',
        headerBg: '#FAFAF7',
        headerBorder: 'rgba(15,15,30,0.08)',
        cardBg: '#FFFFFF',
        cardBorder: 'rgba(15,15,30,0.10)',
        cardBorderHover: 'rgba(15,15,30,0.18)',
        textMain: '#0F0F1A',
        textMuted: 'rgba(15,15,30,0.65)',
        textSubtle: 'rgba(15,15,30,0.40)',
        divider: 'rgba(15,15,30,0.08)',
        innerSurface: '#F4F3EE',
        innerBorder: 'rgba(15,15,30,0.08)',
      }
    : {
        isLight: false,
        shellBg: '#05041A',
        shellBorder: 'rgba(255,255,255,0.10)',
        headerBg:
          'linear-gradient(135deg,rgba(13,16,36,0.96) 0%,rgba(11,18,33,0.9) 55%,rgba(7,10,23,0.96) 100%)',
        headerBorder: 'rgba(255,255,255,0.08)',
        cardBg: 'rgba(255,255,255,0.035)',
        cardBorder: 'rgba(255,255,255,0.08)',
        cardBorderHover: 'rgba(255,255,255,0.18)',
        textMain: '#FFFFFF',
        textMuted: 'rgba(255,255,255,0.65)',
        textSubtle: 'rgba(255,255,255,0.40)',
        divider: 'rgba(255,255,255,0.08)',
        innerSurface: 'rgba(13,17,32,0.85)',
        innerBorder: 'rgba(255,255,255,0.08)',
      };
}

/* ───────────────── Helpers ───────────────── */

function getSafeUrl(url: string | null | undefined): string {
  if (!url) return '#';
  if (url.startsWith('/') || url.startsWith('#')) return url;
  try {
    const parsed = new URL(url);
    if (['http:', 'https:'].includes(parsed.protocol)) {
      return parsed.toString();
    }
  } catch {
    // Ignore
  }
  return '#';
}

function getOptimizedImageUrl(url: string | null | undefined, width = 800): string | undefined {
  if (!url) return undefined;
  const safeUrl = getSafeUrl(url);
  if (safeUrl === '#') return undefined;
  
  if (!safeUrl.includes('?')) {
    return `${safeUrl}?w=${width}&q=80&auto=format`;
  }
  return safeUrl;
}

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'Asia/Tokyo',
});

const layoutMap: Record<PortfolioWidgetLayout, string> = {
  grid: 'grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3',
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

/**
 * Generative thumbnail derived deterministically from a hash string.
 * No randomness, fully memoized → identical hash = identical artwork.
 */
interface GenerativeArt {
  background: string;
  overlay: string;
  hueA: number;
  hueB: number;
  hueC: number;
}

function deriveGenerativeArt(hash: string): GenerativeArt {
  // Defensive: if hash is empty/short, pad it deterministically.
  const seed = (hash || 'proofmark').padEnd(64, '0');

  // char-code helpers
  const codeAt = (i: number) => seed.charCodeAt(i % seed.length);

  // Hues (0..360) — three independent points in colour wheel
  const hueA = codeAt(2) % 360;
  const hueB = (codeAt(11) + codeAt(17)) % 360;
  const hueC = (codeAt(23) * 7) % 360;

  // Positions for radial gradients
  const xA = 10 + (codeAt(5) % 70);
  const yA = 10 + (codeAt(7) % 70);
  const xB = 10 + (codeAt(13) % 70);
  const yB = 10 + (codeAt(19) % 70);
  const xC = 10 + (codeAt(29) % 80);
  const yC = 10 + (codeAt(31) % 80);

  // Conic angle
  const conicAngle = codeAt(3) % 360;

  // Repeating stripe angle / spacing
  const stripeAngle = codeAt(37) % 180;
  const stripeGap = 6 + (codeAt(41) % 10);

  // Saturations / lightnesses (kept in tasteful range)
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

/* ───────────────── Breathing Verified Badge ───────────────── */

function BreathingBadge({
  reduce,
  size = 'normal',
  tone = 'teal',
}: {
  reduce: boolean;
  size?: 'normal' | 'mini';
  tone?: 'teal' | 'gold' | 'purple';
}) {
  const accent = ACCENT[tone];

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
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-mono uppercase tracking-[0.2em]"
        style={{
          background: `rgba(${accent.rgb}, 0.14)`,
          border: `1px solid rgba(${accent.rgb}, 0.5)`,
          color: accent.hex,
        }}
      >
        <ShieldCheck className="h-2.5 w-2.5" />
        Verified
      </motion.span>
    );
  }

  return (
    <motion.div
      className="relative inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-2.5 py-1"
      style={{
        background: 'rgba(7,6,26,0.72)',
        border: `1px solid rgba(${accent.rgb}, 0.55)`,
        backdropFilter: 'blur(10px)',
      }}
      animate={
        reduce
          ? undefined
          : {
              boxShadow: [
                `0 4px 14px rgba(0,0,0,0.3), 0 0 0 0 rgba(${accent.rgb}, 0.55)`,
                `0 4px 14px rgba(0,0,0,0.3), 0 0 0 6px rgba(${accent.rgb}, 0)`,
                `0 4px 14px rgba(0,0,0,0.3), 0 0 0 0 rgba(${accent.rgb}, 0.55)`,
              ],
            }
      }
      transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.span
        className="flex h-4 w-4 items-center justify-center rounded-full"
        style={{
          background: accent.hex,
          boxShadow: `0 0 8px rgba(${accent.rgb}, 0.7)`,
        }}
        animate={reduce ? undefined : { opacity: [1, 0.78, 1] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Check
          className="h-2.5 w-2.5"
          color={tone === 'gold' ? '#07061A' : '#FFFFFF'}
          strokeWidth={4}
        />
      </motion.span>
      <span
        className="text-[9.5px] font-mono uppercase tracking-[0.22em]"
        style={{ color: '#FFFFFF' }}
      >
        ProofMark
      </span>
    </motion.div>
  );
}

/* ───────────────── Avatar (with breathing dot) ───────────────── */

function Avatar({
  username = 'Unknown',
  avatarUrl,
  showBadge = false,
  isFounder = false,
  reduce = false,
}: {
  username?: string;
  avatarUrl?: string | null;
  showBadge?: boolean;
  isFounder?: boolean;
  reduce?: boolean;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="relative shrink-0">
      <div
        className="relative h-16 w-16 overflow-hidden rounded-[1.35rem]"
        style={{
          background:
            'linear-gradient(135deg, #6C3EF4 0%, #30215F 55%, rgba(0,212,170,0.7) 100%)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 18px 50px -10px rgba(108,62,244,0.45)',
        }}
      >
        {avatarUrl && !imgError ? (
          <img
            src={getOptimizedImageUrl(avatarUrl, 128)}
            alt={`${username} avatar`}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-xl font-black text-white"
            style={{ fontFamily: '"Poppins", "Inter", sans-serif' }}
          >
            {username.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.28),transparent_55%)]" />
      </div>

      {showBadge && (
        <div className="absolute -bottom-1.5 -right-1.5">
          <motion.div
            className="flex h-6 w-6 items-center justify-center rounded-full"
            style={{
              background: isFounder ? ACCENT.gold.hex : ACCENT.teal.hex,
              boxShadow: `0 0 10px rgba(${
                isFounder ? ACCENT.gold.rgb : ACCENT.teal.rgb
              }, 0.85), 0 0 0 2px #05041A`,
            }}
            animate={
              reduce
                ? undefined
                : {
                    scale: [1, 1.06, 1],
                  }
            }
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            aria-label="Verified"
          >
            <Check
              className="h-3 w-3"
              color={isFounder ? '#07061A' : '#FFFFFF'}
              strokeWidth={3.5}
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}

/* ───────────────── Stat Card ───────────────── */

function StatCard({
  label = 'Stat',
  value = '0',
  accent,
  theme,
}: {
  label?: string;
  value?: string;
  accent?: 'green' | 'purple' | 'gold';
  theme: ThemeTokens;
}) {
  const accentMap = {
    green: ACCENT.teal,
    purple: ACCENT.purple,
    gold: ACCENT.gold,
  } as const;
  const a = accent ? accentMap[accent] : null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl px-4 py-4"
      style={{
        background: a
          ? theme.isLight
            ? `rgba(${a.rgb}, 0.10)`
            : `rgba(${a.rgb}, 0.08)`
          : theme.isLight
            ? 'rgba(15,15,30,0.03)'
            : 'rgba(255,255,255,0.04)',
        border: `1px solid ${
          a
            ? theme.isLight
              ? `rgba(${a.rgb}, 0.30)`
              : `rgba(${a.rgb}, 0.22)`
            : theme.cardBorder
        }`,
        backdropFilter: 'blur(10px)',
      }}
    >
      {a && (
        <div
          aria-hidden
          className="absolute -top-8 -right-8 h-20 w-20 rounded-full blur-2xl pointer-events-none"
          style={{ background: a.hex, opacity: 0.35 }}
        />
      )}
      <div
        className="relative text-[10.5px] font-mono uppercase tracking-[0.22em]"
        style={{ color: theme.textSubtle }}
      >
        {label}
      </div>
      <div
        className="relative mt-2 text-xl font-black tracking-tight"
        style={{
          color: theme.textMain,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      {a && (
        <div
          className="relative mt-2.5 h-px w-full overflow-hidden rounded-full"
          style={{ background: theme.divider }}
        >
          <div
            className="h-full w-1/3"
            style={{
              background: a.hex,
              boxShadow: `0 0 8px rgba(${a.rgb}, 0.6)`,
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ───────────────── Proof Chip ───────────────── */

function ProofChip({
  children,
  accent = false,
  theme,
}: {
  children: ReactNode;
  accent?: boolean;
  theme: ThemeTokens;
}) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.18em]"
      style={
        accent
          ? {
              background: theme.isLight
                ? 'rgba(0,212,170,0.10)'
                : 'rgba(0,212,170,0.12)',
              borderColor: theme.isLight
                ? 'rgba(0,212,170,0.45)'
                : 'rgba(0,212,170,0.30)',
              color: theme.isLight ? '#008A6F' : '#8DF3DE',
            }
          : {
              background: theme.isLight
                ? 'rgba(15,15,30,0.05)'
                : 'rgba(255,255,255,0.05)',
              borderColor: theme.divider,
              color: theme.textMuted,
            }
      }
    >
      {children}
    </span>
  );
}

/* ───────────────── Generative Hash Fingerprint ───────────────── */

function HashFingerprint({
  hash,
  theme,
}: {
  hash: string;
  theme: ThemeTokens;
}) {
  // Memoised generative art — critical for perf inside iframes
  const art = useMemo(() => deriveGenerativeArt(hash), [hash]);

  return (
    <div
      className="relative aspect-[4/3] overflow-hidden rounded-[1.25rem] border"
      style={{
        background: art.background,
        backgroundBlendMode: 'screen',
        borderColor: theme.cardBorder,
      }}
    >
      {/* striped overlay (修正後：mixBlendModeを削除し、色でアルファを調整) */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: art.overlay,
          opacity: 0.15,
        }}
      />

      {/* film grain (修正後) */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 30%, rgba(255,255,255,1) 1px, transparent 1px), radial-gradient(circle at 70% 80%, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '6px 6px, 9px 9px',
        }}
      />

      {/* vignette */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.42) 100%)',
        }}
      />

      {/* center lock + hash */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-full"
          style={{
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(0,212,170,0.45)',
            backdropFilter: 'blur(6px)',
            boxShadow: '0 0 20px rgba(0,212,170,0.4)',
          }}
        >
          <Lock className="h-5 w-5 text-[#00D4AA]" strokeWidth={1.6} />
        </div>
        <div className="text-center">
          <p className="text-[9.5px] font-mono uppercase tracking-[0.28em] text-white/85">
            Confidential proof
          </p>
          <p
            className="mt-1 font-mono text-[10px] text-white/55 tracking-[0.18em]"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
          >
            {shortHash(hash, 8, 6)}
          </p>
        </div>
      </div>

      {/* hue chips bottom-right */}
      <div
        aria-hidden
        className="absolute bottom-2 right-2 flex gap-1 pointer-events-none"
      >
        {[art.hueA, art.hueB, art.hueC].map((h, i) => (
          <span
            key={i}
            className="block h-1.5 w-1.5 rounded-full"
            style={{
              background: `hsl(${h}, 80%, 60%)`,
              boxShadow: `0 0 6px hsl(${h}, 80%, 60%)`,
            }}
          />
        ))}
      </div>

      {/* signature mark */}
      <div
        aria-hidden
        className="absolute top-2 left-2 font-mono text-[8px] tracking-[0.3em]"
        style={{
          color: 'rgba(255,255,255,0.5)',
          textShadow: '0 1px 2px rgba(0,0,0,0.6)',
        }}
      >
        ✦ PM
      </div>
    </div>
  );
}

/* ───────────────── Certificate Card ───────────────── */

function CertificateCard({
  item,
  settings,
  theme,
  priority = false,
  index = 0,
  reduce = false,
}: {
  item: WidgetCertificate;
  settings: PortfolioWidgetSettings;
  theme: ThemeTokens;
  priority?: boolean;
  index?: number;
  reduce?: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const title = item?.title || 'Untitled proof';

  const variants: Variants = reduce
    ? {
        hidden: { opacity: 1 },
        visible: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        hidden: { opacity: 0, y: 12, scale: 0.985 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.45, ease: PM_EASE, delay: index * 0.05 },
        },
        exit: { opacity: 0, y: -6, scale: 0.985, transition: { duration: 0.22 } },
      };

  return (
    <motion.article
      layout
      variants={variants}
      initial="hidden"
      animate="visible"
      exit="exit"
      whileHover={
        reduce
          ? undefined
          : {
              y: -2,
              scale: 1.01, // 少しだけ強調
              zIndex: 10,  // ← 絶対に追加（隣のカードに踏まれるのを防ぐ）
              transition: { type: 'spring', stiffness: 320, damping: 24 },
            }
      }
      className="group relative overflow-hidden rounded-[1.6rem]"
      style={{
        background: theme.cardBg,
        border: `1px solid ${theme.cardBorder}`,
        backdropFilter: 'blur(10px)',
        boxShadow: theme.isLight
          ? '0 8px 40px rgba(15,15,30,0.06)'
          : '0 10px 50px rgba(0,0,0,0.32)',
        transition: 'border-color 240ms',
      }}
    >
      {/* under-card hover glow (contained, iframe-safe) */}
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-[1.6rem] pointer-events-none opacity-0 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(ellipse at 50% 100%, rgba(0,212,170,0.30), transparent 55%)',
          transition: 'opacity 400ms',
          mixBlendMode: theme.isLight ? 'multiply' : 'screen',
        }}
      />

      <div className="relative p-3">
        <a
          href={getSafeUrl(item?.verifyPath)}
          target="_blank"
          rel="noreferrer noopener"
          className="block focus:outline-none"
        >
          {item?.imageUrl && !imgError ? (
            <div
              className="overflow-hidden rounded-[1.25rem]"
              style={{
                border: `1px solid ${theme.cardBorder}`,
                background: theme.isLight ? '#F4F3EE' : 'rgba(0,0,0,0.25)',
              }}
            >
              <img
                src={getOptimizedImageUrl(item.imageUrl, 800)}
                alt={`${title} preview`}
                loading={priority ? 'eager' : 'lazy'}
                decoding="async"
                fetchPriority={priority ? 'high' : 'auto'}
                onError={() => setImgError(true)}
                className="aspect-[4/3] h-auto w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
            </div>
          ) : (
            <HashFingerprint hash={item?.hash || 'proofmark'} theme={theme} />
          )}
        </a>

        {/* breathing verified badge floats top-right of media */}
        {settings.showBadges && (
          <div className="pointer-events-none absolute right-5 top-5">
            <BreathingBadge reduce={reduce} />
          </div>
        )}

        {/* soft purple halo (dark only) */}
        {!theme.isLight && (
          <div className="pointer-events-none absolute inset-x-8 top-8 h-20 rounded-full bg-[#6C3EF4]/[0.18] blur-3xl" />
        )}
      </div>

      <div className="px-5 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              className="line-clamp-2 text-[15px] font-bold tracking-tight"
              style={{ color: theme.textMain }}
            >
              {title}
            </h3>
            <p
              className="mt-1 text-[12.5px] font-mono uppercase tracking-[0.18em]"
              style={{ color: theme.textSubtle }}
            >
              {formatDate(item?.issuedAt)}
            </p>
          </div>
          <a
            href={getSafeUrl(item?.verifyPath)}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`${title} の証明ページを開く`}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:text-[#00D4AA]"
            style={{
              background: theme.isLight
                ? 'rgba(15,15,30,0.04)'
                : 'rgba(255,255,255,0.05)',
              border: `1px solid ${theme.cardBorder}`,
              color: theme.textMuted,
            }}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {settings.showBadges ? (
            <ProofChip accent theme={theme}>
              {item.proofMode === 'shareable' ? 'Visual proof' : 'Private proof'}
            </ProofChip>
          ) : null}
          <ProofChip theme={theme}>{item.visibility}</ProofChip>
          {item.hasBundle ? <ProofChip theme={theme}>Chain attached</ProofChip> : null}
          {item.stepType ? <ProofChip theme={theme}>{item.stepType}</ProofChip> : null}
          {item.tags?.slice(0, 2).map((tag) => (
            <ProofChip key={tag} theme={theme}>
              #{tag}
            </ProofChip>
          ))}
        </div>
      </div>
    </motion.article>
  );
}

/* ───────────────── Bundle Card (god-mode) ───────────────── */

function BundleCard({
  bundle,
  theme,
  reduce = false,
}: {
  bundle: WidgetBundle;
  theme: ThemeTokens;
  reduce?: boolean;
}) {
  const orderedSteps = [...(bundle?.steps || [])]
    .sort((a, b) => (a?.stepIndex || 0) - (b?.stepIndex || 0))
    .slice(0, 4);
  const valid = bundle?.chainSummary?.valid !== false;
  const accent = valid ? ACCENT.teal : ACCENT.gold;

  return (
    <motion.article
      layout
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, ease: PM_EASE }}
      whileHover={reduce ? undefined : { y: -2 }}
      className="relative overflow-hidden rounded-[1.6rem]"
      style={{
        background: theme.cardBg,
        border: `1px solid ${theme.cardBorder}`,
        backdropFilter: 'blur(10px)',
        boxShadow: theme.isLight
          ? '0 12px 50px rgba(15,15,30,0.08)'
          : '0 14px 60px rgba(0,0,0,0.42)',
      }}
    >
      {/* top hairline */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(108,62,244,0.65), rgba(0,212,170,0.65), transparent)',
        }}
      />

      <div
        className="flex items-start justify-between gap-4 border-b px-5 py-5"
        style={{ borderColor: theme.divider }}
      >
        <div className="min-w-0 flex-1">
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-[0.22em]"
            style={{
              background: theme.isLight
                ? 'rgba(108,62,244,0.10)'
                : 'rgba(108,62,244,0.12)',
              border: '1px solid rgba(108,62,244,0.32)',
              color: theme.isLight ? '#5832C8' : '#BC78FF',
            }}
          >
            <Layers3 className="h-3 w-3" />
            Chain of Evidence
          </div>
          <h3
            className="mt-3 text-[17px] font-bold tracking-tight"
            style={{ color: theme.textMain }}
          >
            {bundle?.title || 'Untitled Chain'}
          </h3>
          {bundle?.description ? (
            <p
              className="mt-2 text-[13px] leading-6"
              style={{ color: theme.textMuted }}
            >
              {bundle.description}
            </p>
          ) : null}
        </div>

        <motion.div
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[10.5px] font-mono font-bold uppercase tracking-[0.20em]"
          style={{
            background: `rgba(${accent.rgb}, ${theme.isLight ? 0.10 : 0.12})`,
            border: `1px solid rgba(${accent.rgb}, 0.40)`,
            color: theme.isLight ? (valid ? '#00997A' : '#B38500') : accent.hex,
          }}
          animate={
            reduce
              ? undefined
              : {
                  boxShadow: [
                    `0 0 0 0 rgba(${accent.rgb}, 0.5)`,
                    `0 0 0 6px rgba(${accent.rgb}, 0)`,
                    `0 0 0 0 rgba(${accent.rgb}, 0.5)`,
                  ],
                }
          }
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          {valid ? (
            <ShieldCheck className="h-3.5 w-3.5" />
          ) : (
            <ShieldAlert className="h-3.5 w-3.5" />
          )}
          {valid ? 'Verified' : 'Review'}
        </motion.div>
      </div>

      <div className="grid gap-4 px-5 py-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
          {orderedSteps.map((step) => (
            <BundleStepTile key={step.id} step={step} theme={theme} />
          ))}
        </div>
        <div className="grid gap-2.5">
          <StatCard
            label="Linked steps"
            value={String(bundle?.chainDepth || bundle?.steps?.length || 0)}
            accent="purple"
            theme={theme}
          />
          <StatCard
            label="Head hash"
            value={shortHash(bundle?.headHash || '', 8, 6)}
            accent="green"
            theme={theme}
          />
          <StatCard
            label="Updated"
            value={formatDate(bundle?.createdAt || null)}
            accent="gold"
            theme={theme}
          />
        </div>
      </div>
    </motion.article>
  );
}

function BundleStepTile({
  step,
  theme,
}: {
  step: WidgetBundleStep;
  theme: ThemeTokens;
}) {
  const [imgError, setImgError] = useState(false);
  const fallbackArt = useMemo(
    () => deriveGenerativeArt((step?.id || '') + (step?.stepType || '')),
    [step?.id, step?.stepType],
  );

  return (
    <div
      className="overflow-hidden rounded-[0.9rem]"
      style={{
        background: theme.innerSurface,
        border: `1px solid ${theme.innerBorder}`,
      }}
    >
      {step?.previewUrl && !imgError ? (
        <img
          src={getOptimizedImageUrl(step.previewUrl, 400)}
          alt={`${step?.title || 'Step'} preview`}
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
          className="aspect-square w-full object-cover"
        />
      ) : (
        <div
          className="relative aspect-square w-full"
          style={{ background: fallbackArt.background }}
        >
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: fallbackArt.overlay,
              mixBlendMode: 'overlay',
              opacity: 0.8,
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.45) 100%)',
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="font-mono text-[9.5px] uppercase tracking-[0.24em] px-2 py-0.5 rounded"
              style={{
                background: 'rgba(0,0,0,0.45)',
                color: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(4px)',
              }}
            >
              {step.stepType}
            </span>
          </div>
        </div>
      )}
      <div
        className="border-t px-3 py-2"
        style={{ borderColor: theme.innerBorder }}
      >
        <div
          className="line-clamp-1 text-[11.5px] font-semibold"
          style={{ color: theme.textMain }}
        >
          {step?.title || 'Unknown step'}
        </div>
        <div
          className="mt-1 text-[9.5px] font-mono uppercase tracking-[0.2em]"
          style={{ color: theme.textSubtle }}
        >
          Step {(step?.stepIndex || 0) + 1}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ Main ═══════════════════════ */

export default function PortfolioEmbedWidget({
  payload: rawPayload,
  settings: rawSettings,
}: {
  payload?: PortfolioWidgetPayload;
  settings?: PortfolioWidgetSettings;
}) {
  const reduce = useReducedMotion() ?? false;
  const containerRef = useRef<HTMLDivElement>(null);

  // Defensive defaults
  const settings: PortfolioWidgetSettings = {
    theme: rawSettings?.theme || 'dark',
    layout: rawSettings?.layout || 'grid',
    showBadges: rawSettings?.showBadges ?? true,
    showBundles: rawSettings?.showBundles ?? true,
    maxItems: rawSettings?.maxItems || 6,
    bundleLimit: rawSettings?.bundleLimit || 2,
  };

  const payload: PortfolioWidgetPayload = {
    profile: rawPayload?.profile || { username: 'creator', avatarUrl: null, bio: null, isFounder: false },
    headline: rawPayload?.headline || '',
    stats: rawPayload?.stats || { certificateCount: 0, bundleCount: 0, verifiedChainCount: 0, latestIssuedAt: null },
    certificates: rawPayload?.certificates || [],
    bundles: rawPayload?.bundles || [],
  };

  const certificates = payload.certificates.slice(0, settings.maxItems);
  const bundles = settings.showBundles
    ? payload.bundles.slice(0, settings.bundleLimit)
    : [];
  const theme = buildTheme(settings.theme === 'light');

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.target.getBoundingClientRect().height;
        window.parent?.postMessage(
          { type: 'PROOFMARK_EMBED_RESIZE', height },
          '*'
        );
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  /* Iframe-safe outer padding so hover glow / -2px lift never clips */
  const outerPadding: CSSProperties = {
    padding: '14px 16px 18px',
  };

  return (
    <div ref={containerRef} className="proofmark-widget-outer relative" style={outerPadding}>
      <main
        className="proofmark-widget-shell proofmark-widget-grid relative overflow-hidden rounded-[2rem] px-4 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7"
        style={{
          background: theme.shellBg,
          border: `1px solid ${theme.shellBorder}`,
          boxShadow: theme.isLight
            ? '0 24px 100px rgba(2,12,27,0.10)'
            : '0 28px 120px rgba(2,8,24,0.50)',
          color: theme.textMain,
        }}
      >
        {/* ─────── Ambient aura (dark only — keeps light theme crisp) ─────── */}
        {!theme.isLight && (
          <>
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full"
              style={{ background: '#6C3EF4', opacity: 0.16, filter: 'blur(120px)', willChange: 'opacity' }}
              animate={reduce ? undefined : { opacity: [0.12, 0.20, 0.12] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -bottom-32 -right-32 h-[420px] w-[420px] rounded-full"
              style={{ background: '#00D4AA', opacity: 0.14, filter: 'blur(120px)', willChange: 'opacity' }}
              animate={reduce ? undefined : { opacity: [0.10, 0.18, 0.10] }}
              transition={{ duration: 9, delay: 0.6, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        )}

        {/* light theme: faint colour wash so it still reads ProofMark */}
        {theme.isLight && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at top left, rgba(108,62,244,0.06), transparent 30%), radial-gradient(ellipse at bottom right, rgba(0,212,170,0.06), transparent 30%)',
            }}
          />
        )}

        {/* ─────── Header section ─────── */}
        <section
          className="relative overflow-hidden rounded-[1.8rem] border px-5 py-5 sm:px-6 sm:py-6"
          style={{
            background: theme.headerBg,
            borderColor: theme.headerBorder,
          }}
        >
          {!theme.isLight && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 42%)',
              }}
            />
          )}

          {/* top hairline */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(108,62,244,0.65), rgba(0,212,170,0.65), rgba(240,187,56,0.45), transparent)',
            }}
          />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start gap-4">
                <Avatar
                  username={payload.profile.username}
                  avatarUrl={payload.profile.avatarUrl}
                  showBadge={settings.showBadges}
                  isFounder={payload.profile.isFounder}
                  reduce={reduce}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10.5px] font-mono font-bold uppercase tracking-[0.22em]"
                      style={{
                        background: theme.isLight
                          ? 'rgba(0,212,170,0.10)'
                          : 'rgba(0,212,170,0.10)',
                        border: '1px solid rgba(0,212,170,0.32)',
                        color: theme.isLight ? '#00997A' : '#8DF3DE',
                      }}
                    >
                      <Sparkles className="h-3 w-3 text-[#00D4AA]" />
                      Verified Portfolio
                    </span>

                    {settings.showBadges && (
                      <BreathingBadge reduce={reduce} size="mini" tone="teal" />
                    )}

                    {payload.profile.isFounder ? (
                      <FounderBadge className="!py-1 !px-3" />
                    ) : null}
                  </div>

                  <h1
                    className="mt-3 text-2xl font-black tracking-tight sm:text-[2rem]"
                    style={{
                      color: theme.textMain,
                      fontFamily: '"Poppins", "Inter", sans-serif',
                    }}
                  >
                    @{payload.profile.username}
                  </h1>
                  <p
                    className="mt-2 max-w-3xl text-[13.5px] leading-6 sm:text-[14.5px] whitespace-pre-wrap"
                    style={{ color: theme.textMuted }}
                  >
                    {payload.headline}
                  </p>
                </div>
              </div>
            </div>

            <a
              href={getSafeUrl(`/u/${payload.profile.username}`)}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-colors hover:text-[#00D4AA]"
              style={{
                background: theme.isLight
                  ? '#FFFFFF'
                  : 'rgba(255,255,255,0.05)',
                border: `1px solid ${theme.cardBorder}`,
                color: theme.textMain,
                boxShadow: theme.isLight
                  ? '0 2px 8px rgba(15,15,30,0.05)'
                  : 'none',
              }}
            >
              Open full profile
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          <div className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Verified works"
              value={String(payload.stats.certificateCount)}
              theme={theme}
            />
            <StatCard
              label="Evidence chains"
              value={String(payload.stats.bundleCount)}
              accent="purple"
              theme={theme}
            />
            <StatCard
              label="Integrity verified"
              value={String(payload.stats.verifiedChainCount)}
              accent="green"
              theme={theme}
            />
            <StatCard
              label="Latest proof"
              value={formatDate(payload.stats.latestIssuedAt)}
              accent="gold"
              theme={theme}
            />
          </div>
        </section>

        {/* ─────── Verified Works ─────── */}
        <section className="relative mt-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2
                className="text-lg font-bold tracking-tight"
                style={{ color: theme.textMain }}
              >
                Verified works
              </h2>
              <p
                className="mt-1 text-[13px]"
                style={{ color: theme.textMuted }}
              >
                公開設定とプライバシー設定を保ったまま、検証導線だけを綺麗に見せる埋め込みです。
              </p>
            </div>
            <span
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.22em]"
              style={{
                background: 'rgba(0,212,170,0.10)',
                border: '1px solid rgba(0,212,170,0.30)',
                color: '#00D4AA',
              }}
            >
              <motion.span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: '#00D4AA', boxShadow: '0 0 8px #00D4AA' }}
                animate={reduce ? undefined : { opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              />
              {settings.layout === 'compact' ? 'compact reel' : settings.layout === 'list' ? 'list view' : 'editorial grid'}
            </span>
          </div>

          {certificates.length > 0 ? (
            <LayoutGroup>
              <motion.div
                layout
                className={layoutMap[settings.layout]}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { layout: { duration: 0.55, ease: PM_EASE } }
                }
              >
                <AnimatePresence mode="popLayout">
                  {certificates.map((item, index) => (
                    <CertificateCard
                      key={item.id}
                      item={item}
                      settings={settings}
                      theme={theme}
                      priority={index < 2}
                      index={index}
                      reduce={reduce}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            </LayoutGroup>
          ) : (
            <div
              className="rounded-[1.4rem] px-5 py-8 text-sm"
              style={{
                background: theme.isLight
                  ? 'rgba(15,15,30,0.03)'
                  : 'rgba(255,255,255,0.035)',
                border: `1px solid ${theme.cardBorder}`,
                color: theme.textMuted,
              }}
            >
              公開中の作品はまだありません。
            </div>
          )}
        </section>

        {/* ─────── Chain of Evidence ─────── */}
        {bundles.length > 0 ? (
          <section className="relative mt-5">
            <div className="mb-4 flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-[#00D4AA]" />
              <h2
                className="text-lg font-bold tracking-tight"
                style={{ color: theme.textMain }}
              >
                Chain of Evidence
              </h2>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {bundles.map((bundle) => (
                <BundleCard
                  key={bundle.id}
                  bundle={bundle}
                  theme={theme}
                  reduce={reduce}
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* ─────── Footer ─────── */}
        <div
          className="relative mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] px-4 py-3 text-xs"
          style={{
            background: theme.isLight
              ? 'rgba(15,15,30,0.03)'
              : 'rgba(255,255,255,0.03)',
            border: `1px solid ${theme.cardBorder}`,
            color: theme.textMuted,
          }}
        >
          <span className="inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.18em]">
            <Fingerprint className="h-3.5 w-3.5 text-[#00D4AA]" />
            Powered by ProofMark · creator-first verification
          </span>
          <a
            href={getSafeUrl("https://www.proofmark.jp/what-it-proves")}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 font-semibold transition-colors hover:text-[#00D4AA]"
            style={{ color: theme.textMain }}
          >
            What ProofMark proves
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </main>
    </div>
  );
}
