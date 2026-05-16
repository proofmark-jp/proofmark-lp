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
  Sparkles, Globe, Heart, Video, DollarSign, PenTool, Search, Layers, Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/Navbar';
import FounderBadge from '../components/FounderBadge';
import { TheVault, TranslucentVault, OwnerVault } from '../components/storefront/StorefrontProofCard';
import {
  STOREFRONT_AI_FILTERS,
  matchesAiFilter,
  type StorefrontAiFilter,
} from '../lib/proofmark-storefront';

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

// ── Custom Brand Icons (Lucide非依存・将来にわたって安全) ──
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

const formatFilename = (c: CertRecord) => {
  const originalName = c.original_filename || c.file_name;
  if (originalName && typeof originalName === 'string' && originalName !== 'Untitled' && originalName !== 'unknown_file') return originalName;
  if (c.storage_path && typeof c.storage_path === 'string') {
    const parts = c.storage_path.split('/');
    return (parts[parts.length - 1] || '').replace(/^file_\d+_?/, '');
  }
  return 'Verified_Digital_Artwork';
};

// ── 妥協なきマーケティングCTA (NotFound) ──
const NotFoundScreen = ({ username }: { username: string }) => (
  <div className="min-h-screen bg-[#07061A] flex flex-col items-center justify-center gap-10 px-6 text-center relative overflow-hidden">
    <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#6C3EF4] opacity-10 blur-[100px] rounded-full pointer-events-none" />
    <div className="absolute bottom-[10%] right-[-10%] w-[300px] h-[300px] bg-[#00D4AA] opacity-10 blur-[80px] rounded-full pointer-events-none" />
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

const SocialLink = ({ href, icon: Icon, label, colorClass = "hover:border-[#6C3EF4]/50 hover:bg-[#6C3EF4]/20", textClass = "text-white" }: { href: any, icon: any, label: string, colorClass?: string, textClass?: string }) => {
  if (!href || typeof href !== 'string') return null;
  return (
    <motion.a
      whileHover={{ y: -3, scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      href={href} target="_blank" rel="noopener noreferrer"
      className={`flex items-center justify-center gap-2 bg-[#151D2F]/50 border border-[#2a2a4e] ${colorClass} px-3 py-2 rounded-xl transition-colors backdrop-blur-md text-xs font-bold ${textClass} shadow-[0_4px_15px_rgba(0,0,0,0.2)] hover:shadow-[0_4px_25px_rgba(108,62,244,0.3)]`}
    >
      <Icon className="w-4 h-4" /> {label}
    </motion.a>
  );
};

export default function PublicProfile() {
  const [match, params] = useRoute('/u/:username');
  const username = match && params ? params.username : null;

  const [certs, setCerts] = useState<CertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [profileExists, setProfileExists] = useState(false);
  const { user, signOut } = useAuth();

  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [aiFilter, setAiFilter] = useState<StorefrontAiFilter>('all');

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
          .order('created_at', { ascending: false });

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
        const title = ((c.metadata?.title as string) || formatFilename(c)).toLowerCase();
        const hash = c.file_hash.toLowerCase();
        return title.includes(q) || hash.includes(q);
      });
    }

    // C2PA AI フィルタ: manifest 本体またはスカラーフラグでフォールバック
    if (aiFilter !== 'all') {
      result = result.filter(c => {
        const raw = (c as any).c2pa_manifest ?? {
          present: (c as any).c2pa_present,
          validity: (c as any).c2pa_valid === true ? 'valid' : (c as any).c2pa_valid === false ? 'invalid' : (c as any).c2pa_present ? 'unknown' : undefined,
          ai_used: (c as any).c2pa_ai_used ?? null,
          ai_provider: (c as any).c2pa_ai_provider ?? null,
          issuer: (c as any).c2pa_issuer ?? null,
        };
        return matchesAiFilter(raw, aiFilter);
      });
    }

    return result;
  }, [certs, activeCategory, searchQuery, aiFilter]);

  const featuredCerts = filteredCerts.filter(c => c.is_starred || c.metadata?.is_starred);
  const standardCerts = filteredCerts.filter(c => !c.is_starred && !c.metadata?.is_starred);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07061A] flex flex-col items-center justify-center gap-6">
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

  return (
    <div className="min-h-screen bg-[#050505] text-[#FFFFFF] font-sans selection:bg-[#00D4AA] selection:text-black">
      <Navbar user={user} signOut={signOut} />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-8 md:px-16 pt-12 pb-40">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-12 md:mb-20"
        >
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8 bg-[#0A0A0A]/80 backdrop-blur-xl border border-[#1A1A1A] rounded-[2rem] p-8 relative overflow-hidden group shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#6C3EF4]/5 right-0 to-transparent pointer-events-none" />
            
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#6C3EF4] to-[#00D4AA] flex items-center justify-center shadow-[0_0_30px_rgba(108,62,244,0.2)] overflow-hidden shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-extrabold text-white">{safeUsername.charAt(0).toUpperCase()}</span>
              )}
            </div>

            <div className="flex-1 text-center md:text-left z-10 w-full flex flex-col items-center md:items-start justify-center">
              <div className="flex flex-col md:flex-row items-center gap-4 mb-3">
                <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">@{safeUsername}</h1>
                {profileData?.is_founder && <FounderBadge />}
              </div>
              
              {hasBio ? (
                <p className="text-[#888] text-sm max-w-2xl mb-6 leading-relaxed whitespace-pre-wrap font-light tracking-wide">{profileData.bio}</p>
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

              <div className="flex flex-wrap justify-center md:justify-start gap-4 text-xs font-medium mb-6">
                <span className="flex items-center gap-1.5 text-[#EAEAEA] bg-[#111] border border-[#333] px-4 py-2 rounded-full shadow-inner">
                  <Layers className="w-3.5 h-3.5 text-[#6C3EF4]" /> {certs.length} Protected Assets
                </span>
                <span className="flex items-center gap-1.5 text-[#00D4AA] bg-[#00D4AA]/10 border border-[#00D4AA]/30 px-4 py-2 rounded-full shadow-[0_0_15px_rgba(0,212,170,0.1)]">
                  <ShieldCheck className="w-3.5 h-3.5" /> Cryptographically Verified
                </span>
              </div>

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

        <div className="flex flex-col lg:flex-row justify-between items-center gap-6 mb-12 sm:mb-20">
          {categories.length > 1 && (
            <motion.nav
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap justify-center sm:justify-start gap-4 sm:gap-8"
            >
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`text-[10px] sm:text-xs md:text-sm tracking-[0.15em] uppercase font-medium transition-colors duration-300 relative px-2 py-1 ${activeCategory === cat ? 'text-white' : 'text-[#555] hover:text-[#999]'}`}
                >
                  {cat}
                  {activeCategory === cat && (
                    <motion.div
                      layoutId="categoryIndicator"
                      className="absolute -bottom-2 left-0 right-0 h-[2px] bg-[#00D4AA] shadow-[0_0_10px_rgba(0,212,170,0.5)]"
                    />
                  )}
                </button>
              ))}
            </motion.nav>
          )}

          <div className="relative w-full lg:w-72 group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-[#666] group-focus-within:text-[#6C3EF4] transition-colors duration-300" />
            </div>
            <input type="text" placeholder="Search proofs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-11 pr-4 py-2.5 border border-[#333] hover:border-[#444] rounded-full leading-5 bg-[#111]/90 backdrop-blur-md text-white placeholder-[#666] focus:outline-none focus:border-[#6C3EF4] focus:ring-1 focus:ring-[#6C3EF4] sm:text-sm transition-all duration-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
            />
          </div>

          {/* C2PA AI フィルタ — 罠3対策: not-generated を「Human-first (暗号証明済)」に上書き */}
          <div className="flex flex-wrap gap-2 mt-3 lg:mt-0">
            {STOREFRONT_AI_FILTERS.map(f => {
              const displayLabel =
                f.value === 'not-generated' ? 'Human-first (暗号証明済)' : f.label;
              const isActive = aiFilter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setAiFilter(f.value)}
                  className={[
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider uppercase transition-all duration-200',
                    isActive
                      ? 'bg-[#6C3EF4]/20 border border-[#6C3EF4]/60 text-[#BC78FF] shadow-[0_0_10px_rgba(108,62,244,0.35)]'
                      : 'bg-[#111] border border-[#333] text-[#666] hover:border-[#555] hover:text-[#aaa]',
                  ].join(' ')}
                  title={
                    f.value === 'not-generated'
                      ? 'C2PA Content Credentialsによって「AI生成でない」ことが暗号的に証明された作品のみ表示します'
                      : undefined
                  }
                >
                  {f.value === 'ai-generated' && <span aria-hidden>✦</span>}
                  {f.value === 'not-generated' && <span aria-hidden>🔒</span>}
                  {displayLabel}
                </button>
              );
            })}
          </div>
        </div>

        <motion.div layout className="flex flex-col gap-16 sm:gap-24 md:gap-32">
          {/* Featured Section */}
          <AnimatePresence mode="popLayout">
            {featuredCerts.length > 0 && (
              <motion.section
                key="featured-section"
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 xl:grid-cols-2 gap-12 sm:gap-16 md:gap-24 items-center"
              >
                <AnimatePresence mode="popLayout">
                  {featuredCerts.map(cert => (
                    <GalleryItem key={cert.id} cert={cert} isFeatured user={user} />
                  ))}
                </AnimatePresence>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Standard Grid Section */}
          <motion.section
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 sm:gap-x-8 md:gap-x-12 gap-y-12 sm:gap-y-16 md:gap-y-20 mt-8 sm:mt-16"
          >
            <AnimatePresence mode="popLayout">
              {standardCerts.map(cert => (
                <GalleryItem key={cert.id} cert={cert} user={user} />
              ))}
            </AnimatePresence>
          </motion.section>
        </motion.div>

        <AnimatePresence>
          {filteredCerts.length === 0 && certs.length > 0 && (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex justify-center py-32 text-[#555555] tracking-[0.2em] text-xs uppercase font-light"
            >
              No works in this category.
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

// ----------------------
// Gallery Item Component (World-Class Grid & Aspect Ratio)
// ----------------------
function GalleryItem({ cert, isFeatured, user }: { cert: CertRecord; isFeatured?: boolean; user: any }) {
  const isOwner = user?.id === cert.user_id;
  const isMasked = cert.proof_mode === 'confidential' || cert.visibility === 'private';
  const title = (cert.metadata && typeof cert.metadata.title === 'string' ? cert.metadata.title : null) || formatFilename(cert);
  const processBundle = Array.isArray(cert.metadata?.process_bundle) ? cert.metadata!.process_bundle : [];

  const layoutClasses = isFeatured 
    ? "w-full aspect-[16/9] max-h-[600px]" 
    : "w-full aspect-[4/5]"; 

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="w-full"
    >
      <Link href={`/cert/${cert.id || ''}`}>
        <div className="relative group block cursor-pointer w-full">

          <div className={`relative overflow-hidden bg-[#0A0A0A] rounded-xl border border-[#111] group-hover:border-[#333] transition-all duration-500 ${layoutClasses} ${isFeatured ? 'shadow-[0_0_80px_rgba(255,255,255,0.03)] group-hover:shadow-[0_8px_40px_rgba(108,62,244,0.1)]' : 'group-hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]'}`}>
            
            {!isMasked && cert.public_image_url ? (
              <>
                <motion.img
                  whileHover={{ scale: 1.03 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  src={typeof cert.public_image_url === 'string' ? cert.public_image_url : ''}
                  alt={title}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-700"
                />
                {processBundle.length > 0 && (
                  <div className="absolute inset-0 bg-[#050505]/70 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center hidden md:flex">
                    <div className="flex flex-col gap-8 items-center w-full px-8 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500 ease-out">
                      <span className="text-[#888] text-[10px] tracking-[0.4em] uppercase font-light">Sequence</span>
                      <div className="flex items-center justify-center w-full max-w-[90%] mx-auto">
                        {processBundle.map((step, idx, arr) => (
                          <div key={idx} className="flex items-center flex-1 last:flex-none">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                              <span className="text-white text-[9px] font-light tracking-[0.2em] whitespace-nowrap uppercase">{typeof step === 'string' ? step : 'STEP'}</span>
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
            ) : isOwner && cert.public_image_url ? (
              <TranslucentVault imageUrl={cert.public_image_url} />
            ) : isOwner ? (
              <OwnerVault />
            ) : (
              <TheVault />
            )}
            
            {isFeatured && (
              <div className="absolute top-4 left-4 bg-[#050505]/80 backdrop-blur-md border border-[#333] px-3 py-1.5 rounded-full z-20 flex items-center gap-2">
                <span className="text-[#FFD700] text-[9px] font-bold tracking-[0.2em] uppercase flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-[#FFD700]" /> Featured</span>
              </div>
            )}
          </div>

          {/* Responsive Meta Data (Mobile Safe) */}
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