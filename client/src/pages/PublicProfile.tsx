import { useEffect, useState } from 'react';
import { useRoute, Link } from 'wouter';
import {
  ShieldCheck,
  ExternalLink,
  ImageIcon,
  Lock,
  ArrowLeft,
  Hash,
  Layers,
  FileText,
  Sparkles
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import navbarLogo from '../assets/logo/navbar/proofmark-navbar-symbol-dark.svg';
import founderBadge from '../assets/logo/badges/proofmark-badge-founder.svg';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/Navbar';
import FounderBadge from '../components/FounderBadge';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface CertRecord {
  id: string;
  file_hash: string;
  created_at: string;
  image_url?: string;
  file_url?: string;
  storage_path?: string;
  file_name?: string;
  original_filename?: string;
  public_image_url?: string;
  proof_mode?: string;
  visibility?: string;
  user_id?: string;
  metadata?: {
    show_in_gallery?: boolean;
    [key: string]: unknown;
  };
}

const LoadingScreen = () => (
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

const NotFoundScreen = ({ username }: { username: string }) => (
  <div className="min-h-screen bg-[#07061A] flex flex-col items-center justify-center gap-10 px-6 text-center relative overflow-hidden">
    {/* Background Decorative Orbs */}
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

      {/* Marketing CTA Section */}
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

const ZKPlaceholder = () => (
  <div className="w-full aspect-square flex flex-col items-center justify-center bg-[#0a0f1c] gap-3 p-4">
    <div className="w-12 h-12 rounded-xl bg-[#00D4AA]/10 border border-[#00D4AA]/30 flex items-center justify-center">
      <Lock className="w-6 h-6 text-[#00D4AA]" />
    </div>
    <span className="text-[#00D4AA] text-[10px] font-bold tracking-widest uppercase border border-[#00D4AA]/30 bg-[#00D4AA]/10 px-3 py-1.5 rounded-full">
      ZERO-KNOWLEDGE
    </span>
    <p className="text-[#A8A0D8]/60 text-xs text-center font-bold">Image Hidden</p>
  </div>
);

export default function PublicProfile() {
  const [match, params] = useRoute('/u/:username');
  const username = match && params ? params.username : null;

  const [certs, setCerts] = useState<CertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileExists, setProfileExists] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [isFounder, setIsFounder] = useState(false);
  const { user, signOut } = useAuth();

  useEffect(() => {
    let active = true;

    if (!username) {
      // ユーザー名が存在しない場合はNot Found画面ではなくローディングか何もしない状態にしておく
      return; 
    }

    async function loadPortfolio() {
      try {
        // 🌟 まずプロファイルテーブルからユーザー情報を取得
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, avatar_url, is_founder')
          .ilike('username', username)
          .maybeSingle();

        if (profileError || !profile) {
          setProfileExists(false);
          return;
        }

        setProfileExists(true);
        setUserAvatar(profile.avatar_url);
        setIsFounder(Boolean(profile.is_founder));

        // 🌟 user_id を使って、そのユーザーの証明書のみを直接取得（効率的）
        const { data: userCerts, error: certsError } = await supabase
          .from('certificates')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false });

        if (certsError || !userCerts) {
          return;
        }

        const galleryCerts = userCerts.filter((c) => {
          const meta = c.metadata as Record<string, unknown> | null;
          return !meta || meta.show_in_gallery !== false;
        });

        setCerts(galleryCerts);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadPortfolio();
  }, [username]);

  const formatFilename = (cert: CertRecord) => {
    const originalName = cert.original_filename || cert.file_name;
    if (originalName && originalName !== 'Untitled' && originalName !== 'unknown_file') return originalName;
    if (cert.storage_path) {
      const parts = cert.storage_path.split('/');
      return (parts[parts.length - 1] || '').replace(/^file_\d+_?/, '');
    }
    return 'Verified_Digital_Artwork';
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-[#00D4AA] font-bold tracking-widest">LOADING PROFILE...</div>;
  if (!username) return <NotFoundScreen username="unknown" />;
  if (!profileExists) return <NotFoundScreen username={username} />;

  return (
    <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] font-sans pb-24">
      <Navbar user={user} signOut={signOut} />

      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-10">
        <div className="flex flex-col md:flex-row items-center gap-8 bg-[#0D0B24] border border-[#1C1A38] rounded-[2rem] p-8 shadow-[0_0_40px_rgba(108,62,244,0.05)]">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#6C3EF4] to-[#00D4AA] flex items-center justify-center shadow-[0_0_30px_rgba(108,62,244,0.3)] overflow-hidden">
              {userAvatar ? (
                <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-extrabold text-white">{username.charAt(0).toUpperCase()}</span>
              )}
            </div>
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row items-center gap-4 mb-3">
              <h1 className="text-3xl font-extrabold text-white tracking-tight">@{username}</h1>
              {isFounder && <FounderBadge />}
            </div>
            <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm font-medium">
              <span className="flex items-center gap-1.5 text-white bg-[#151D2F] border border-[#2a2a4e] px-4 py-2 rounded-full">
                <Layers className="w-4 h-4 text-[#6C3EF4]" /> {certs.length} Protected Assets
              </span>
              <span className="flex items-center gap-1.5 text-[#00D4AA] bg-[#00D4AA]/10 border border-[#00D4AA]/30 px-4 py-2 rounded-full">
                <ShieldCheck className="w-4 h-4" /> All Artworks Verified
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Masonry Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {certs.length === 0 ? (
          <div className="text-center py-20 bg-[#0D0B24] border border-[#1C1A38] rounded-[2rem]">
            <ImageIcon className="w-12 h-12 text-[#2a2a4e] mx-auto mb-4" />
            <p className="text-[#A8A0D8] font-bold">まだ証明された作品がありません</p>
          </div>
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
            {certs.map((cert) => {
              const showImage = cert.proof_mode === 'shareable' && cert.public_image_url && (cert.visibility === 'public' || user?.id === cert.user_id);
              const imgUrl = showImage ? cert.public_image_url : null;
              const cleanFilename = formatFilename(cert);

              return (
                <Link key={cert.id} href={`/cert/${cert.id}`}>
                  <div className="break-inside-avoid relative group rounded-2xl overflow-hidden cursor-pointer border border-[#1C1A38] bg-[#0D0B24] transition-all duration-500 hover:border-[#00D4AA]/50 hover:shadow-[0_0_30px_rgba(0,212,170,0.2)] hover:-translate-y-1">

                    {imgUrl ? (
                      <img src={imgUrl} alt={cleanFilename} className="w-full h-auto object-cover" loading="lazy" />
                    ) : (
                      <ZKPlaceholder />
                    )}

                    {/* Default Top Badge */}
                    <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
                      <div className="flex items-center gap-1 bg-[#0a0f1c]/80 backdrop-blur-md border border-[#00D4AA]/30 px-2.5 py-1 rounded-full w-fit">
                        <ShieldCheck className="w-3 h-3 text-[#00D4AA]" />
                        <span className="text-[9px] font-bold text-[#00D4AA] tracking-widest uppercase">Verified</span>
                      </div>
                      
                      {/* 🌟 Mobile Only Info (Always Visible) */}
                      <div className="block sm:hidden bg-[#07061A]/90 backdrop-blur-md border border-[#1C1A38] px-3 py-2 rounded-xl shadow-xl max-w-[140px]">
                        <p className="text-white text-[10px] font-bold truncate mb-0.5">
                          {cleanFilename}
                        </p>
                        <p className="text-[#00D4AA] text-[8px] font-black tracking-tighter uppercase flex items-center gap-1">
                          <ExternalLink className="w-2.5 h-2.5" /> View Certificate
                        </p>
                      </div>
                    </div>

                    {/* Cyber Hover Overlay (Desktop Only) */}
                    <div className="absolute inset-0 bg-[#07061A]/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 hidden sm:flex flex-col items-center justify-center p-4">
                      <div className="w-12 h-12 rounded-full border-2 border-[#00D4AA] flex items-center justify-center mb-3 shadow-[0_0_15px_rgba(0,212,170,0.5)]">
                        <ExternalLink className="w-5 h-5 text-[#00D4AA]" />
                      </div>
                      <p className="text-white text-sm font-bold text-center px-2 line-clamp-2 mb-2 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#6C3EF4]" /> {cleanFilename}
                      </p>
                      <p className="text-[#A8A0D8] font-mono text-[9px] tracking-widest uppercase">
                        View Certificate
                      </p>
                    </div>

                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
