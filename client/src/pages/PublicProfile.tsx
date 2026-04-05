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
  FileText
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import navbarLogo from '../assets/logo/navbar/proofmark-navbar-symbol-dark.svg';
import founderBadge from '../assets/logo/badges/proofmark-badge-founder.svg';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/Navbar';

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
  <div className="min-h-screen bg-[#07061A] flex flex-col items-center justify-center gap-6 px-4 text-center">
    <div className="w-20 h-20 rounded-2xl bg-[#0D0B24] border border-[#1C1A38] flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(108,62,244,0.1)]">
      <ShieldCheck className="w-10 h-10 text-[#6C3EF4]" />
    </div>
    <h1 className="text-2xl font-extrabold text-white tracking-tight">
      @{username} は存在しません
    </h1>
    <p className="text-[#A8A0D8] text-sm max-w-sm">
      このユーザー名は登録されていないか、ポートフォリオが非公開に設定されています。
    </p>
    <Link href="/">
      <span className="inline-flex items-center gap-2 text-sm font-bold text-[#00D4AA] hover:text-white transition-colors cursor-pointer border-b border-[#00D4AA]/40 pb-0.5 mt-4">
        <ArrowLeft className="w-4 h-4" /> ProofMarkトップへ
      </span>
    </Link>
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
  const { user, signOut } = useAuth();

  useEffect(() => {
    if (!username) {
      setLoading(false); return;
    }
    async function loadPortfolio() {
      const { data: allCerts, error } = await supabase
        .from('certificates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !allCerts) {
        setLoading(false); return;
      }

      const userCerts = allCerts.filter((c) => {
        const meta = c.metadata as Record<string, unknown> | null;
        if (!meta) return false;
        return (
          (typeof meta.username === 'string' && meta.username.toLowerCase() === username!.toLowerCase()) ||
          (typeof meta.display_name === 'string' && meta.display_name.toLowerCase() === username!.toLowerCase())
        );
      });

      if (userCerts.length === 0) {
        setProfileExists(false); setLoading(false); return;
      }

      setProfileExists(true);
      const galleryCerts = userCerts.filter((c) => {
        const meta = c.metadata as Record<string, unknown> | null;
        return !meta || meta.show_in_gallery !== false;
      });

      setCerts(galleryCerts);
      setLoading(false);
    }
    loadPortfolio();
  }, [username]);

  const formatFilename = (cert: CertRecord) => {
    if (cert.file_name && cert.file_name !== 'Untitled') return cert.file_name;
    if (cert.storage_path) {
      const parts = cert.storage_path.split('/');
      return (parts[parts.length - 1] || '').replace(/^file_\d+_?/, '');
    }
    return 'Verified_Digital_Artwork';
  };

  if (loading) return <LoadingScreen />;
  if (!username || !profileExists) return <NotFoundScreen username={username || 'unknown'} />;

  return (
    <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] font-sans pb-24">
      <Navbar user={user} signOut={signOut} />

      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-10">
        <div className="flex flex-col md:flex-row items-center gap-8 bg-[#0D0B24] border border-[#1C1A38] rounded-[2rem] p-8 shadow-[0_0_40px_rgba(108,62,244,0.05)]">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#6C3EF4] to-[#00D4AA] flex items-center justify-center shadow-[0_0_30px_rgba(108,62,244,0.3)]">
              <span className="text-4xl font-extrabold text-white">{username.charAt(0).toUpperCase()}</span>
            </div>
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row items-center gap-4 mb-3">
              <h1 className="text-3xl font-extrabold text-white tracking-tight">@{username}</h1>
              <div className="flex items-center gap-1.5 bg-[#1A1200] border border-[#F0BB38] px-4 py-1.5 rounded-full">
                <img src={founderBadge} alt="Founder" className="w-4 h-4" />
                <span className="text-[10px] font-black text-[#F0BB38] tracking-widest uppercase">Founder</span>
              </div>
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
              const imgUrl = cert.file_url || cert.image_url;
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
                    <div className="absolute top-3 left-3 flex items-center gap-1 bg-[#0a0f1c]/80 backdrop-blur-md border border-[#00D4AA]/30 px-2.5 py-1 rounded-full z-10">
                      <ShieldCheck className="w-3 h-3 text-[#00D4AA]" />
                      <span className="text-[9px] font-bold text-[#00D4AA] tracking-widest uppercase">Verified</span>
                    </div>

                    {/* Cyber Hover Overlay */}
                    <div className="absolute inset-0 bg-[#07061A]/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center p-4">
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
