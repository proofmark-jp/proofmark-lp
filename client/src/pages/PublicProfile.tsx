import { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import LoadingFallback from '../components/LoadingFallback';

const ZeroKnowledgeDropzone = lazy(() =>
  import('../components/storefront/ZeroKnowledgeDropzone').then((m) => ({
    default: m.ZeroKnowledgeDropzone,
  }))
);
import { useRoute, Link } from 'wouter';
import {
  ShieldCheck, ExternalLink, Lock, ArrowLeft, ArrowRight,
  Sparkles, Globe, Heart, Video, DollarSign, PenTool, Search, Layers, Edit3, Check,
} from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup, useReducedMotion, type Variants } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/Navbar';
import FounderBadge from '../components/FounderBadge';


interface CertRecord {
  id: string;
  file_hash: string;
  created_at: string;
  public_image_url?: string;
  proof_mode?: string;
  visibility?: string;
  user_id?: string;
  file_name?: string;
  original_filename?: string;
  storage_path?: string;
  is_starred?: boolean;
  metadata?: {
    title?: string;
    show_in_gallery?: boolean;
    is_starred?: boolean;
    step_type?: string;
    tags?: string[];
    process_bundle?: string[];
    [key: string]: unknown;
  };
}

/* ════════════════════════════════════════════════════════════════
 *  GOD MODE — Ported verbatim from PortfolioEmbedWidget.tsx
 *  (PM_EASE, deriveGenerativeArt, HashFingerprint, BreathingBadge)
 *
 *  These functions / components are mirrored 1:1 to keep visual DNA
 *  identical across the embed widget and the full-page gallery.
 * ════════════════════════════════════════════════════════════════ */

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

/**
 * Deterministic generative art derived from a hash string.
 * Same hash ⇒ same artwork. Pure, memoisable.
 */
function deriveGenerativeArt(hash: string): GenerativeArt {
  const seed = (hash || 'proofmark').padEnd(64, '0');
  const codeAt = (i: number) => seed.charCodeAt(i % seed.length);

  // Clamp hues to ProofMark brand: Teal (~160–180) or Purple (~250–270)
  const useTeal = codeAt(2) % 2 === 0;
  const hueA = useTeal ? 160 + (codeAt(2) % 22) : 252 + (codeAt(2) % 18);
  const hueB = useTeal ? 250 + (codeAt(11) % 18) : 160 + (codeAt(11) % 22);
  const hueC = 220 + (codeAt(23) % 20); // always cool blue-indigo

  const xA = 10 + (codeAt(5) % 70);
  const yA = 10 + (codeAt(7) % 70);
  const xB = 20 + (codeAt(13) % 60);
  const yB = 20 + (codeAt(19) % 60);

  const stripeAngle = codeAt(37) % 180;
  const dotGap = 18 + (codeAt(41) % 8);

  // Deep void base — never bright, saturation crushed
  const background = `
    radial-gradient(ellipse 60% 45% at ${xA}% ${yA}%, hsl(${hueA}, 55%, 14%) 0%, transparent 60%),
    radial-gradient(ellipse 50% 40% at ${xB}% ${yB}%, hsl(${hueB}, 45%, 10%) 0%, transparent 60%),
    linear-gradient(135deg, #07061A 0%, #0E0B22 55%, #07061A 100%)
  `;

  // Subtle scan-line overlay for cryptographic cold feel
  const overlay = `repeating-linear-gradient(${stripeAngle}deg,
    rgba(255,255,255,0.025) 0px,
    rgba(255,255,255,0.025) 1px,
    transparent 1px,
    transparent ${dotGap}px)`;

  return { background, overlay, hueA, hueB, hueC };
}

/**
 * Hash fingerprint — pure CSS generative thumbnail.
 * Flat composite (opacity 0.15) instead of mix-blend-mode for grid perf.
 */
function HashFingerprint({
  hash,
  className = '',
  showLabel = true,
}: {
  hash: string;
  className?: string;
  showLabel?: boolean;
}) {
  const art = useMemo(() => deriveGenerativeArt(hash), [hash]);

  // Pre-build a clipped hash string for the cryptographic text grid
  const hashDisplay = (hash || '').padEnd(64, '0');

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={{ background: art.background }}
    >
      {/* Scan-line overlay */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: art.overlay, opacity: 0.18 }}
      />

      {/* Dot-grid — cryptographic cold texture */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          opacity: 0.09,
        }}
      />

      {/* Hash text grid — hash chars tiled very faintly */}
      <div
        aria-hidden
        className="absolute inset-0 flex flex-wrap content-start overflow-hidden select-none pointer-events-none"
        style={{ opacity: 0.055, lineHeight: '1.6', padding: '6px' }}
      >
        {Array.from({ length: 120 }).map((_, i) => (
          <span
            key={i}
            className="font-mono text-[8px] text-white"
            style={{ letterSpacing: '0.05em' }}
          >
            {hashDisplay[(i * 2) % hashDisplay.length]}
            {hashDisplay[(i * 2 + 1) % hashDisplay.length]}{' '}
          </span>
        ))}
      </div>

      {/* Edge vignette */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.6) 100%)',
        }}
      />

      {/* Brand accent hairline — top */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{
          background: `linear-gradient(90deg, transparent, hsl(${art.hueA}, 55%, 38%), transparent)`,
          opacity: 0.5,
        }}
      />

      {/* Center lock + hash */}
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{
              background: 'rgba(7,6,26,0.72)',
              border: `1px solid hsl(${art.hueA}, 55%, 35%)`,
              backdropFilter: 'blur(8px)',
              boxShadow: `0 0 18px hsl(${art.hueA}, 55%, 25%)`,
            }}
          >
            <Lock className="h-4 w-4" style={{ color: `hsl(${art.hueA}, 65%, 62%)` }} strokeWidth={1.8} />
          </div>
          <div className="text-center">
            <p
              className="text-[9px] font-mono uppercase tracking-[0.32em]"
              style={{ color: `hsl(${art.hueA}, 50%, 65%)` }}
            >
              Cryptographic Proof
            </p>
            <p
              className="mt-1 font-mono text-[9.5px] tracking-[0.15em]"
              style={{ color: 'rgba(255,255,255,0.38)', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
            >
              {hash ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : '—'}
            </p>
          </div>
        </div>
      )}

      {/* PM mark */}
      <div
        aria-hidden
        className="absolute top-2 left-2 font-mono text-[7.5px] tracking-[0.32em]"
        style={{ color: 'rgba(255,255,255,0.22)' }}
      >
        ✦ PM
      </div>

      {/* Hue accent chips */}
      <div
        aria-hidden
        className="absolute bottom-2 right-2 flex gap-1 pointer-events-none"
      >
        {[art.hueA, art.hueB].map((h, i) => (
          <span
            key={i}
            className="block h-1 w-1 rounded-full"
            style={{
              background: `hsl(${h}, 55%, 50%)`,
              boxShadow: `0 0 4px hsl(${h}, 55%, 40%)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Breathing Badge — reduced-motion aware, multi-tone, multi-size.
 */
function BreathingBadge({
  reduce,
  size = 'normal',
  tone = 'teal',
  label = 'ProofMark',
}: {
  reduce: boolean;
  size?: 'normal' | 'mini' | 'large';
  tone?: 'teal' | 'gold' | 'purple';
  label?: string;
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
        </span>
      </motion.div>
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
        {label}
      </span>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════
 *  Brand SVG icons (unchanged)
 * ════════════════════════════════════════════════════════════════ */

const XIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.005 4.005H5.059z" />
  </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const YouTubeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
  </svg>
);

/* ════════════════════════════════════════════════════════════════
 *  Helpers
 * ════════════════════════════════════════════════════════════════ */

const formatFilename = (c: CertRecord) => {
  const originalName = c.original_filename || c.file_name;
  if (originalName && typeof originalName === 'string' && originalName !== 'Untitled' && originalName !== 'unknown_file') return originalName;
  if (c.storage_path && typeof c.storage_path === 'string') {
    const parts = c.storage_path.split('/');
    return (parts[parts.length - 1] || '').replace(/^file_\d+_?/, '');
  }
  return 'Verified_Digital_Artwork';
};

const getSafeUrl = (url?: string | null): string => {
  if (!url) return '#';
  return url.startsWith('http://') || url.startsWith('https://') ? url : '#';
};

const getOptimizedImageUrl = (url: string | null): string | undefined => {
  // Return the raw URL unchanged — Supabase Storage rejects unknown query params.
  // Lazy-load and decoding="async" on the <img> handle performance instead.
  if (!url) return undefined;
  return url;
};

/* ════════════════════════════════════════════════════════════════
 *  Not Found Screen (refined with aura)
 * ════════════════════════════════════════════════════════════════ */

const NotFoundScreen = ({ username }: { username: string }) => {
  const reduce = useReducedMotion() ?? false;
  return (
    <div className="min-h-screen bg-[#07061A] flex flex-col items-center justify-center gap-10 px-6 text-center relative overflow-hidden">
      <motion.div
        className="absolute top-[-10%] left-[-10%] w-[460px] h-[460px] bg-[#6C3EF4] opacity-[0.10] blur-[110px] rounded-full pointer-events-none"
        style={{ willChange: 'opacity' }}
        animate={reduce ? undefined : { opacity: [0.08, 0.14, 0.08] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-[10%] right-[-10%] w-[340px] h-[340px] bg-[#00D4AA] opacity-[0.10] blur-[90px] rounded-full pointer-events-none"
        style={{ willChange: 'opacity' }}
        animate={reduce ? undefined : { opacity: [0.07, 0.13, 0.07] }}
        transition={{ duration: 8, delay: 0.6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="relative z-10 flex flex-col items-center max-w-lg">
        <div className="w-24 h-24 rounded-[2rem] bg-[#0D0B24] border border-[#1C1A38] flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(108,62,244,0.15)] relative group cursor-default">
          <div className="absolute inset-0 bg-[#6C3EF4]/10 rounded-[2rem] blur-2xl opacity-100" />
          <Sparkles className="w-12 h-12 text-[#6C3EF4] relative z-10 animate-pulse" />
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight mb-4">
          @{username} は、<br />まだ誰のものでもありません。
        </h1>
        <p className="text-[#A8A0D8] text-lg leading-relaxed mb-12">
          このクリエイターIDは現在取得可能です。<br className="hidden sm:block" />
          ProofMarkで、あなたの創作を保護する最初のステップを踏み出しませんか？
        </p>
        <div className="w-full p-8 rounded-3xl bg-gradient-to-br from-[#0D0B24] to-[#151D2F] border border-[#1C1A38] shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-[#6C3EF4]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <h2 className="text-xl font-bold text-white mb-3">あなただけの証拠、あなただけのID。</h2>
          <p className="text-[#A8A0D8] text-sm mb-8 leading-relaxed">
            作品の改ざん不能な「制作事実」を、一生消えない記録として。<br />
            今なら、このIDを確保してすぐに始められます。
          </p>
          <div className="flex flex-col gap-4 relative z-50">
            <Link href={`/auth?mode=signup&username=${username}`}>
              <button className="w-full bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] text-white py-4 rounded-2xl font-black tracking-tight shadow-[0_10px_25px_rgba(108,62,244,0.4)] hover:shadow-[0_15px_35px_rgba(108,62,244,0.6)] hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer">
                このIDで無料で始める
              </button>
            </Link>
            <Link href="/">
              <button className="w-full py-2 text-sm font-bold text-[#A8A0D8] hover:text-white transition-colors flex items-center justify-center gap-2 cursor-pointer">
                <ArrowLeft className="w-4 h-4" /> ProofMark トップへ
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
 *  Social link
 * ════════════════════════════════════════════════════════════════ */

const SocialLink = ({ href, icon: Icon, label, colorClass = "hover:border-[#6C3EF4]/50 hover:bg-[#6C3EF4]/20", textClass = "text-white" }: { href: any, icon: any, label: string, colorClass?: string, textClass?: string }) => {
  if (!href || typeof href !== 'string') return null;
  return (
    <motion.a
      whileHover={{ y: -3, scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      href={getSafeUrl(href)} target="_blank" rel="noopener noreferrer"
      className={`flex items-center justify-center gap-2 bg-[#151D2F]/50 border border-[#2a2a4e] ${colorClass} px-3 py-2 rounded-xl transition-colors backdrop-blur-md text-xs font-bold ${textClass} shadow-[0_4px_15px_rgba(0,0,0,0.2)] hover:shadow-[0_4px_25px_rgba(108,62,244,0.3)]`}
    >
      <Icon className="w-4 h-4" /> {label}
    </motion.a>
  );
};

/* ════════════════════════════════════════════════════════════════
 *  Page
 * ════════════════════════════════════════════════════════════════ */

export default function PublicProfile() {
  const [match, params] = useRoute('/u/:username');
  const username = match && params ? params.username : null;
  const reduce = useReducedMotion() ?? false;

  const [certs, setCerts] = useState<CertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [profileExists, setProfileExists] = useState(false);
  const { user, signOut } = useAuth();

  const isFounder = profileData?.is_founder || user?.user_metadata?.is_founder || user?.user_metadata?.username === 'sinn' || user?.email?.includes('ogurishinya');

  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let active = true;
    if (!username) return;

    async function loadPortfolio() {
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .ilike('username', username)
          .maybeSingle();

        if (profileError || !profile) {
          setProfileExists(false);
          return;
        }

        setProfileExists(true);
        setProfileData(profile);

        const { data: userCerts } = await supabase
          .from('certificates')
          .select('*')
          .eq('user_id', profile.id)
          .eq('visibility', 'public')
          .order('created_at', { ascending: false })
          .limit(100);

        if (userCerts) {
          const galleryCerts = userCerts.filter((c: any) => {
            const meta = (c && typeof c.metadata === 'object' && c.metadata !== null) ? c.metadata : {};
            return meta.show_in_gallery !== false;
          });
          setCerts(galleryCerts);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadPortfolio();
    return () => { active = false; };
  }, [username]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    certs.forEach(cert => {
      if (cert.metadata?.step_type && typeof cert.metadata.step_type === 'string') cats.add(cert.metadata.step_type);
      if (Array.isArray(cert.metadata?.tags)) {
        cert.metadata!.tags.forEach(t => {
          if (typeof t === 'string') cats.add(t);
        });
      }
    });
    return ['ALL', 'VISUAL', 'CONFIDENTIAL', ...Array.from(cats)];
  }, [certs]);

  const filteredCerts = useMemo(() => {
    let result = certs;
    if (activeCategory === 'VISUAL') {
      result = result.filter(c => c.proof_mode === 'shareable' && c.public_image_url);
    } else if (activeCategory === 'CONFIDENTIAL') {
      result = result.filter(c => !(c.proof_mode === 'shareable' && c.public_image_url));
    } else if (activeCategory !== 'ALL') {
      result = result.filter(cert => {
        const step = typeof cert.metadata?.step_type === 'string' ? cert.metadata.step_type : null;
        const tags = Array.isArray(cert.metadata?.tags) ? cert.metadata!.tags : [];
        return step === activeCategory || tags.includes(activeCategory);
      });
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => {
        const title = ((c.metadata?.title as string) || formatFilename(c) || '').toLowerCase();
        const hash = (c.file_hash || '').toLowerCase();
        return title.includes(q) || hash.includes(q);
      });
    }

    return result;
  }, [certs, activeCategory, searchQuery]);

  const featuredCerts = filteredCerts.filter(c => c.is_starred || c.metadata?.is_starred);
  const standardCerts = filteredCerts.filter(c => !c.is_starred && !c.metadata?.is_starred);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-6 relative overflow-hidden">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-[#6C3EF4]/15 blur-[120px]"
          style={{ willChange: 'opacity' }}
          animate={reduce ? undefined : { opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] rounded-full bg-[#00D4AA]/12 blur-[100px]"
          style={{ willChange: 'opacity' }}
          animate={reduce ? undefined : { opacity: [0.3, 0.65, 0.3] }}
          transition={{ duration: 3.4, delay: 0.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-[#6C3EF4]/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#6C3EF4] animate-spin" />
          <div className="absolute inset-2 rounded-full border border-transparent border-t-[#00D4AA] animate-spin [animation-duration:1.5s] [animation-direction:reverse]" />
        </div>
        <p className="text-[#A8A0D8] text-sm font-bold tracking-[0.3em] uppercase animate-pulse">
          Verifying Portfolio...
        </p>
      </div>
    );
  }

  if (!username || !profileExists) return <NotFoundScreen username={typeof username === 'string' ? username : 'unknown'} />;

  const avatarUrl = profileData && typeof profileData.avatar_url === 'string' && profileData.avatar_url !== '' ? profileData.avatar_url : null;
  const safeUsername = typeof username === 'string' && username.length > 0 ? username : '?';

  const isOwner = user?.id === profileData?.id;
  const hasBio = profileData?.bio && typeof profileData.bio === 'string' && profileData.bio.trim() !== '';
  const hasLinks = profileData?.x_url || profileData?.instagram_url || profileData?.youtube_url || profileData?.pixiv_url || profileData?.fanbox_url || profileData?.website_url;
  const verifiedCount = certs.length;

  return (
    <div className="min-h-screen bg-[#050505] text-[#FFFFFF] font-sans selection:bg-[#00D4AA] selection:text-black relative overflow-x-hidden">
      {/* ─────────────── Global ambient aura ─────────────── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <motion.div
          className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-[#6C3EF4] opacity-[0.10] blur-[160px]"
          style={{ willChange: 'opacity' }}
          animate={reduce ? undefined : { opacity: [0.07, 0.13, 0.07] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-40 -right-40 w-[700px] h-[700px] rounded-full bg-[#00D4AA] opacity-[0.10] blur-[160px]"
          style={{ willChange: 'opacity' }}
          animate={reduce ? undefined : { opacity: [0.07, 0.13, 0.07] }}
          transition={{ duration: 9, delay: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(0deg, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          }}
        />
      </div>

      <Navbar user={user} signOut={signOut} />

      <main className="relative max-w-[1600px] mx-auto px-4 sm:px-8 md:px-16 pt-12 pb-40 z-10">

        {/* ═══════════════ HERO ═══════════════ */}
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: PM_EASE }}
          className="mb-12 md:mb-20"
        >
          <div
            className="relative flex flex-col md:flex-row items-center md:items-start gap-8 rounded-[2rem] p-8 overflow-hidden group"
            style={{
              background:
                'linear-gradient(165deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.012) 55%, rgba(0,0,0,0.4) 100%)',
              border: '1px solid rgba(255,255,255,0.10)',
              backdropFilter: 'blur(20px)',
              boxShadow:
                '0 30px 80px -40px rgba(108,62,244,0.45), 0 0 0 1px rgba(255,255,255,0.03) inset',
            }}
          >
            {/* top hairline */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(108,62,244,0.7), rgba(0,212,170,0.7), rgba(240,187,56,0.5), transparent)',
              }}
            />

            {/* hero radial auras */}
            <motion.div
              aria-hidden
              className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-[#6C3EF4] opacity-[0.18] blur-[120px] pointer-events-none"
              style={{ willChange: 'opacity' }}
              animate={reduce ? undefined : { opacity: [0.14, 0.22, 0.14] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              aria-hidden
              className="absolute -bottom-32 -right-32 w-[420px] h-[420px] rounded-full bg-[#00D4AA] opacity-[0.14] blur-[120px] pointer-events-none"
              style={{ willChange: 'opacity' }}
              animate={reduce ? undefined : { opacity: [0.10, 0.20, 0.10] }}
              transition={{ duration: 7, delay: 0.8, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Avatar */}
            <div className="relative shrink-0">
              <div
                className="w-24 h-24 rounded-[1.6rem] flex items-center justify-center overflow-hidden relative"
                style={{
                  background: 'linear-gradient(135deg, #6C3EF4 0%, #30215F 55%, rgba(0,212,170,0.7) 100%)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  boxShadow: '0 22px 60px -10px rgba(108,62,244,0.55), 0 0 30px rgba(0,212,170,0.15)',
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span
                    className="text-4xl font-black text-white"
                    style={{ fontFamily: '"Poppins", "Inter", sans-serif' }}
                  >
                    {safeUsername.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.28),transparent_55%)]" />
              </div>

              {/* breathing verified dot */}
              <div className="absolute -bottom-2 -right-2">
                <motion.div
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{
                    background: profileData?.is_founder ? ACCENT.gold.hex : ACCENT.teal.hex,
                    boxShadow: `0 0 14px rgba(${profileData?.is_founder ? ACCENT.gold.rgb : ACCENT.teal.rgb}, 0.85), 0 0 0 3px #050505`,
                  }}
                  animate={reduce ? undefined : { scale: [1, 1.06, 1] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                  aria-label="Verified"
                >
                  <Check
                    className="h-4 w-4"
                    color={profileData?.is_founder ? '#07061A' : '#FFFFFF'}
                    strokeWidth={3.5}
                  />
                </motion.div>
              </div>
            </div>

            {/* Identity */}
            <div className="flex-1 text-center md:text-left z-10 w-full flex flex-col items-center md:items-start justify-center min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-3 justify-center md:justify-start">
                <h1
                  className="text-3xl md:text-4xl font-extrabold text-white tracking-tight flex flex-wrap items-center gap-3"
                  style={{ fontFamily: '"Poppins", "Inter", sans-serif' }}
                >
                  <span>@{safeUsername}</span>
                  {isFounder && <FounderBadge />}
                </h1>
                <BreathingBadge reduce={reduce} size="normal" tone="teal" label="ProofMark" />
              </div>

              {hasBio ? (
                <p className="text-[#A8A0D8] text-sm max-w-2xl mb-6 leading-relaxed whitespace-pre-wrap font-light tracking-wide">
                  {profileData.bio}
                </p>
              ) : (
                isOwner ? (
                  <Link href="/settings">
                    <button className="flex items-center gap-2 text-[#6C3EF4] text-xs font-bold bg-[#6C3EF4]/10 hover:bg-[#6C3EF4]/20 border border-[#6C3EF4]/30 px-4 py-2 rounded-full mb-6 transition-all">
                      <Edit3 className="w-3.5 h-3.5" /> プロフィールを完成させる
                    </button>
                  </Link>
                ) : (
                  <div className="h-4" />
                )
              )}

              {/* Stat chips */}
              <div className="flex flex-wrap justify-center md:justify-start gap-3 text-xs font-medium mb-6">
                <span
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#EAEAEA',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <Layers className="w-3.5 h-3.5 text-[#6C3EF4]" />
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{verifiedCount}</span> Protected Assets
                </span>
                <motion.span
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full font-mono uppercase tracking-[0.18em] text-[11px]"
                  style={{
                    background: 'rgba(0,212,170,0.10)',
                    border: '1px solid rgba(0,212,170,0.30)',
                    color: '#00D4AA',
                  }}
                  animate={reduce ? undefined : {
                    boxShadow: [
                      '0 0 0 0 rgba(0,212,170,0.45)',
                      '0 0 0 6px rgba(0,212,170,0)',
                      '0 0 0 0 rgba(0,212,170,0.45)',
                    ],
                  }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Cryptographically Verified
                </motion.span>
                {profileData?.is_founder && (
                  <span
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full font-mono uppercase tracking-[0.18em] text-[11px]"
                    style={{
                      background: 'rgba(240,187,56,0.10)',
                      border: '1px solid rgba(240,187,56,0.32)',
                      color: '#F0BB38',
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Founder
                  </span>
                )}
              </div>

              {/* Social links */}
              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                <SocialLink href={profileData?.x_url} icon={XIcon} label="X" />
                <SocialLink href={profileData?.instagram_url} icon={InstagramIcon} label="Instagram" colorClass="hover:border-pink-500/50 hover:bg-pink-500/20" />
                <SocialLink href={profileData?.youtube_url} icon={YouTubeIcon} label="YouTube" colorClass="hover:border-red-500/50 hover:bg-red-500/20" />
                <SocialLink href={profileData?.tiktok_url} icon={Video} label="TikTok" />
                <SocialLink href={profileData?.pixiv_url} icon={PenTool} label="Pixiv" colorClass="hover:border-[#0096fa]/50 hover:bg-[#0096fa]/20" />
                <SocialLink href={profileData?.fanbox_url} icon={Heart} label="FANBOX" colorClass="hover:border-[#fffb8f]/50 hover:bg-[#fffb8f]/20" />
                <SocialLink href={profileData?.patreon_url} icon={DollarSign} label="Patreon" colorClass="hover:border-[#f96854]/50 hover:bg-[#f96854]/20" />
                <SocialLink href={profileData?.website_url} icon={Globe} label="Website" colorClass="hover:border-[#00D4AA]/50 hover:bg-[#00D4AA]/20" />
              </div>
            </div>
          </div>
        </motion.header>

        {/* ═══════════════ Filters ═══════════════ */}
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6 mb-12 sm:mb-20">
          {categories.length > 1 && (
            <motion.nav
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap justify-center sm:justify-start gap-4 sm:gap-8"
            >
              <LayoutGroup id="public-profile-tabs">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`text-[10px] sm:text-xs md:text-sm tracking-[0.15em] uppercase font-medium transition-colors duration-300 relative px-2 py-1 ${activeCategory === cat ? 'text-white' : 'text-[#555] hover:text-[#999]'}`}
                  >
                    {cat === 'ALL' ? 'All Proofs' :
                     cat === 'VISUAL' ? '🖼️ Public Works' :
                     cat === 'CONFIDENTIAL' ? '🔒 Sealed Proofs' : cat}
                    {activeCategory === cat && (
                      <motion.div
                        layoutId="categoryIndicator"
                        className="absolute -bottom-2 left-0 right-0 h-[2px]"
                        style={{
                          background: 'linear-gradient(90deg, #00D4AA, #6C3EF4)',
                          boxShadow: '0 0 12px rgba(0,212,170,0.55)',
                        }}
                        transition={{ type: 'spring', stiffness: 460, damping: 32 }}
                      />
                    )}
                  </button>
                ))}
              </LayoutGroup>
            </motion.nav>
          )}

          <div className="relative w-full lg:w-72 group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-[#666] group-focus-within:text-[#6C3EF4] transition-colors duration-300" />
            </div>
            <input
              type="text"
              placeholder="Search proofs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-11 pr-4 py-2.5 border border-[#333] hover:border-[#444] rounded-full leading-5 bg-[#111]/90 backdrop-blur-md text-white placeholder-[#666] focus:outline-none focus:border-[#6C3EF4] focus:ring-1 focus:ring-[#6C3EF4] sm:text-sm transition-all duration-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
            />
          </div>

        </div>

        {/* ═══════════════ Gallery ═══════════════ */}
        <motion.div layout className="flex flex-col gap-16 sm:gap-24 md:gap-32">
          <AnimatePresence mode="popLayout">
            {featuredCerts.length > 0 && (
              <motion.section
                key="featured-section"
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: PM_EASE }}
                className="grid grid-cols-1 xl:grid-cols-2 gap-12 sm:gap-16 md:gap-24 items-center"
              >
                <LayoutGroup id="featured-grid">
                  <AnimatePresence mode="popLayout">
                    {featuredCerts.map((cert, idx) => (
                      <GalleryItem key={cert.id} cert={cert} isFeatured user={user} index={idx} reduce={reduce} />
                    ))}
                  </AnimatePresence>
                </LayoutGroup>
              </motion.section>
            )}
          </AnimatePresence>

          <motion.section
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 sm:gap-x-8 md:gap-x-12 gap-y-12 sm:gap-y-16 md:gap-y-20 mt-8 sm:mt-16"
            transition={{ layout: { duration: 0.55, ease: PM_EASE } }}
          >
            <LayoutGroup id="standard-grid">
              <AnimatePresence mode="popLayout">
                {standardCerts.map((cert, idx) => (
                  <GalleryItem key={cert.id} cert={cert} user={user} index={idx} reduce={reduce} />
                ))}
              </AnimatePresence>
            </LayoutGroup>
          </motion.section>
        </motion.div>

        <AnimatePresence>
          {filteredCerts.length === 0 && certs.length > 0 && (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: PM_EASE }}
              className="flex flex-col items-center justify-center py-32 gap-3"
            >
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <Search className="h-5 w-5 text-[#555]" />
              </div>
              <p className="text-[#555555] tracking-[0.2em] text-xs uppercase font-light">
                No works in this category.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-16">
          <Suspense fallback={<LoadingFallback variant="inline" />}>
            <ZeroKnowledgeDropzone username={profileData?.username || ''} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
 *  Gallery Item — God Mode
 * ════════════════════════════════════════════════════════════════ */

function GalleryItem({
  cert,
  isFeatured,
  user,
  index,
  reduce,
}: {
  cert: CertRecord;
  isFeatured?: boolean;
  user: any;
  index: number;
  reduce: boolean;
}) {
  const isOwner = user?.id === cert.user_id;
  const isMasked = cert.proof_mode === 'confidential' || cert.visibility === 'private';
  const title = (cert.metadata && typeof cert.metadata.title === 'string' ? cert.metadata.title : null) || formatFilename(cert);
  const processBundle = Array.isArray(cert.metadata?.process_bundle) ? cert.metadata!.process_bundle : [];

  const layoutClasses = isFeatured
    ? 'w-full aspect-[16/9] max-h-[600px]'
    : 'w-full aspect-[4/5]';

  // ── Graceful Degradation (Widget仕様準拠)
  const [imgError, setImgError] = useState(false);

  const hasRealImage =
    !isMasked && typeof cert.public_image_url === 'string' && cert.public_image_url !== '' && !imgError;

  const variants: Variants = reduce
    ? {
        hidden: { opacity: 1 },
        visible: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        hidden: { opacity: 0, y: 28, scale: 0.96 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.7, ease: PM_EASE, delay: Math.min(index * 0.05, 0.4) },
        },
        exit: { opacity: 0, scale: 0.95, transition: { duration: 0.3, ease: PM_EASE } },
      };

  return (
    <motion.div
      layout
      variants={variants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="w-full"
    >
      <Link href={`/cert/${cert.id || ''}`}>
        <div className="relative group block cursor-pointer w-full">

          {/* Under-card aurora glow — only for real images */}
          {hasRealImage && (
            <motion.div
              aria-hidden
              className="absolute -inset-4 rounded-[24px] blur-3xl pointer-events-none opacity-0 group-hover:opacity-100 -z-10"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 80%, rgba(0,212,170,0.32), transparent 55%), radial-gradient(ellipse at 50% 20%, rgba(108,62,244,0.28), transparent 55%)',
                transition: 'opacity 500ms',
              }}
            />
          )}

          <motion.div
            whileHover={hasRealImage && !reduce ? { y: -4 } : undefined}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className={`relative overflow-hidden bg-[#0A0A0A] rounded-xl border border-[#111] group-hover:border-[#1C1A38] transition-all duration-500 ${layoutClasses}`}
            style={{
              boxShadow: isFeatured
                ? '0 0 80px rgba(255,255,255,0.03)'
                : '0 8px 30px rgba(0,0,0,0.45)',
            }}
          >

            {hasRealImage ? (
              <>
                <motion.img
                  whileHover={reduce ? undefined : { scale: 1.04 }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                  src={getOptimizedImageUrl(typeof cert.public_image_url === 'string' ? cert.public_image_url : '')}
                  alt={title}
                  loading="lazy"
                  decoding="async"
                  onError={() => setImgError(true)}
                  className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-700"
                />

                {/* Verified breathing badge on hover (real images only) */}
                <div className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                  <BreathingBadge reduce={reduce} size="mini" tone="teal" />
                </div>

                {/* Process bundle overlay */}
                {processBundle.length > 0 && (
                  <div className="absolute inset-0 bg-[#050505]/70 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center hidden md:flex">
                    <div className="flex flex-col gap-8 items-center w-full px-8 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500 ease-out">
                      <span className="text-[#888] text-[10px] tracking-[0.4em] uppercase font-light">Sequence</span>
                      <div className="flex items-center justify-center w-full max-w-[90%] mx-auto">
                        {processBundle.map((step, idx, arr) => (
                          <div key={idx} className="flex items-center flex-1 last:flex-none">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                              <span className="text-white text-[9px] font-light tracking-[0.2em] whitespace-nowrap uppercase">
                                {typeof step === 'string' ? step : 'STEP'}
                              </span>
                            </div>
                            {idx < arr.length - 1 && (
                              <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent mx-3 self-start mt-[2px]" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /*
               * Graceful degradation:
               *  - Masked Confidential
               *  - imgError fallback (real image failed to load)
               *  - Owner-only previews (still show fingerprint when no public image)
               *
               * Generative Hash Fingerprint replaces the boring vault icon.
               */
              <HashFingerprint
                hash={cert.file_hash || cert.id || 'proofmark'}
                className="absolute inset-0"
              />
            )}

            {/* Subtle corner brackets */}
            <div className="absolute top-2 left-2 h-4 w-4 border-t border-l border-white/10 pointer-events-none" />
            <div className="absolute top-2 right-2 h-4 w-4 border-t border-r border-white/10 pointer-events-none" />
            <div className="absolute bottom-2 left-2 h-4 w-4 border-b border-l border-white/10 pointer-events-none" />
            <div className="absolute bottom-2 right-2 h-4 w-4 border-b border-r border-white/10 pointer-events-none" />

            {/* Featured marker */}
            {isFeatured && (
              <div className="absolute top-4 left-4 bg-[#050505]/80 backdrop-blur-md border border-[#333] px-3 py-1.5 rounded-full z-20 flex items-center gap-2">
                <span className="text-[#FFD700] text-[9px] font-bold tracking-[0.2em] uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-[#FFD700]" /> Featured
                </span>
              </div>
            )}

            {/* Owner-preview marker (when imgError fell back to fingerprint) */}
            {!hasRealImage && isOwner && cert.public_image_url && (
              <div className="absolute top-3 left-3 z-20">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-mono uppercase tracking-[0.2em]"
                  style={{
                    background: 'rgba(108,62,244,0.14)',
                    border: '1px solid rgba(108,62,244,0.45)',
                    color: '#BC78FF',
                    backdropFilter: 'blur(6px)',
                  }}
                >
                  Owner Preview
                </span>
              </div>
            )}
          </motion.div>

          {/* Meta */}
          <div className="mt-4 sm:mt-6 flex justify-between items-center relative z-10 w-full px-1 overflow-hidden">
            <span className="text-[#888] text-xs sm:text-sm font-medium tracking-[0.1em] uppercase line-clamp-1 truncate max-w-[80%] group-hover:text-white transition-colors duration-500">
              {title}
            </span>
            <span className="text-[#00D4AA] text-[10px] font-mono tracking-[0.2em] uppercase opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] whitespace-nowrap hidden sm:flex items-center">
              VIEW <ArrowRight className="w-3 h-3 ml-1" />
            </span>
          </div>

        </div>
      </Link>
    </motion.div>
  );
}
