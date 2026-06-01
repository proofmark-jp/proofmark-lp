import { useEffect, useState, useMemo } from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import { QRCodeSVG } from 'qrcode.react';
import {
    CheckCircle, Clock, ShieldCheck, Image as ImageIcon, Copy, Check, FileText,
    Lock, ShieldAlert, Flag, Package, Gavel, Sparkles, ChevronRight, Layers3,
} from 'lucide-react';
import { motion } from 'framer-motion';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useAuth } from '../hooks/useAuth';
import EvidencePackDownloadButton from '@/components/EvidencePackDownloadButton';
import Navbar from '../components/Navbar';
import SEO from '../components/SEO';
import type { ProcessBundlePublic } from '../lib/proofmark-types';
import { getProcessBundleByVerifyToken } from '../lib/proofmark-api';
import navbarLogo from '../assets/logo/navbar/proofmark-navbar-symbol-dark.svg';
import founderBadge from '../assets/logo/badges/proofmark-badge-founder.svg';
import { supabase } from '../lib/supabase';
import { getC2paSummary } from '../lib/c2pa-schema';
import { ContentCredentialsSection } from '../components/cert/ContentCredentialsSection';
import VerifyDropzone from '../components/VerifyDropzone';
import TakedownNoticeModal from '../components/proof/TakedownNoticeModal';

/* ═══════════════════════════════════════════════
 *   God-Mode shared easing / tokens
 * ═══════════════════════════════════════════════ */
const PM_EASE = [0.16, 1, 0.3, 1] as const;

export default function CertificatePage() {
    const [match, params] = useRoute('/cert/:id');
    const id = match && params ? params.id : null;
    const [, setLocation] = useLocation();

    const [cert, setCert] = useState<any>(null);
    const [bundle, setBundle] = useState<ProcessBundlePublic | null>(null);
    const [authorProfile, setAuthorProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isHashCopied, setIsHashCopied] = useState(false);

    const [copiedType, setCopiedType] = useState<string | null>(null);
    const [isTakedownOpen, setTakedownOpen] = useState(false);
    const { user, profile, signOut } = useAuth();

    const isOwner = user && user.id === cert?.user_id;

    const handleReportAbuse = () => {
        const subject = encodeURIComponent(`【通報】違法・悪質なコンテンツについて (ID: ${cert?.id})`);
        const body = encodeURIComponent(
            `以下の証明書ページにて、違法または悪質なコンテンツを確認しました。\n\n` +
            `証明書URL: ${window.location.href}\n\n` +
            `通報の理由（詳細をご記入ください）:\n`
        );
        window.location.href = `mailto:support@proofmark.jp?subject=${subject}&body=${body}`;
    };

    const actualPlanVariable = user?.user_metadata?.plan_type;
    const currentPlan = (actualPlanVariable || '').toLowerCase();
    const isPaidPlan = ['light', 'creator', 'studio', 'admin'].includes(currentPlan);
    const c2pa = useMemo(() => getC2paSummary(cert?.c2pa_manifest), [cert?.c2pa_manifest]);

    useEffect(() => {
        async function fetchCertificate() {
            setBundle(null);
            if (!id) {
                setLoading(false);
                return;
            }

            const { data: certData, error: certError } = await supabase
                .from('certificates')
                .select('*')
                .eq('id', id)
                .single();

            if (!certError && certData) {
                const extendedCertData = {
                    ...certData,
                    certificate_id: certData.id,
                    original_file_name: certData.original_filename || 'unknown_asset',
                    original_file_size: certData.file_size || 0,
                    sha256_hash: certData.sha256,
                    timestamp_jst: new Date(certData.certified_at || certData.created_at).toLocaleString('ja-JP'),
                    timestamp_iso: certData.certified_at || certData.created_at,
                    verification_url: `${window.location.origin}/cert/${certData.id}`,
                    proof_mode: certData.proof_mode || 'private',
                    tsr_token_base64: certData.tsr_token_base64 || '',
                    thumbnail_data_url: certData.public_image_url || undefined,
                    creator_display_name: authorProfile?.username ? `@${authorProfile.username}` : 'ProofMark Verified Creator',
                    legal_name: authorProfile?.legal_name || '',
                    default_persona: authorProfile?.default_persona || 'creator'
                };

                setCert(extendedCertData);

                if (certData.user_id) {
                    const isOwnerFetch = user && user.id === certData.user_id;
                    const selectQuery = isOwnerFetch
                        ? 'username, avatar_url, legal_name, default_persona'
                        : 'username, avatar_url';

                    const { data: profileData } = await supabase
                        .from('profiles')
                        .select(selectQuery)
                        .eq('id', certData.user_id)
                        .maybeSingle();

                    if (profileData) {
                        setAuthorProfile(profileData);
                    }
                }

                if (certData.process_bundle_id && certData.public_verify_token) {
                    try {
                        const bundleData = await getProcessBundleByVerifyToken(certData.public_verify_token);
                        if (bundleData) setBundle(bundleData);
                    } catch (err) {
                        console.error('Failed to load process bundle:', err);
                    }
                }
            }
            setLoading(false);
        }
        fetchCertificate();
    }, [id]);

    const handleHashCopy = () => {
        if (cert?.sha256) {
            navigator.clipboard.writeText(cert.sha256);
            setIsHashCopied(true);
            setTimeout(() => setIsHashCopied(false), 2000);
        }
    };

    const handleCopy = async (textToCopy: string, type: string) => {
        try {
            await navigator.clipboard.writeText(textToCopy);
            setCopiedType(type);
            setTimeout(() => setCopiedType(null), 2000);
        } catch (err) {
            console.error("コピーに失敗しました", err);
        }
    };

    const shareOnX = () => {
        const text = encodeURIComponent("AI作品のデジタル存在証明を『ProofMark』で取得しました。\n無断転載・自作発言を防止し、作品のオリジナリティを保護しています。");
        const url = encodeURIComponent(window.location.href);
        const hashtags = "ProofMark,AIart,デジタル存在証明";
        window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}&hashtags=${hashtags}`, '_blank');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#07061A] text-[#00D4AA] flex justify-center items-center font-bold tracking-widest print:bg-white print:text-black relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <motion.div
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-[#6C3EF4]/15 blur-[120px]"
                        animate={{ opacity: [0.4, 0.8, 0.4] }}
                        transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.div
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] rounded-full bg-[#00D4AA]/12 blur-[100px]"
                        animate={{ opacity: [0.3, 0.65, 0.3] }}
                        transition={{ duration: 3.4, delay: 0.6, repeat: Infinity, ease: 'easeInOut' }}
                    />
                </div>
                <div className="relative flex items-center gap-3">
                    <motion.span
                        className="block h-2 w-2 rounded-full bg-[#00D4AA]"
                        animate={{ opacity: [1, 0.2, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    VERIFYING...
                </div>
            </div>
        );
    }

    if (!cert) {
        return (
            <div className="min-h-screen bg-[#07061A] text-white flex flex-col justify-center items-center gap-6 print:bg-white print:text-black">
                <ShieldCheck className="w-16 h-16 text-slate-600" />
                <h1 className="text-xl font-bold tracking-widest">証明書が見つかりません</h1>
                <button onClick={() => setLocation('/')} className="text-[#00D4AA] hover:text-white transition-colors border-b border-[#00D4AA] pb-1 print:hidden">トップに戻る</button>
            </div>
        );
    }

    if (cert.moderation_status === 'suspended') {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-red-950/20 border border-red-900/50 rounded-2xl p-8 text-center">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShieldAlert className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-red-400 mb-2">この証明書は凍結されています</h2>
                    <p className="text-sm text-slate-400">
                        利用規約違反、または第三者からの権利侵害の申し立てにより、この証明書の公開は一時的または恒久的に停止されています。
                    </p>
                </div>
            </div>
        );
    }

    const verifyUrl = `${window.location.origin}/cert/${cert.id}`;

    const secureImageUrl = cert?.public_image_url
        ? `/api/delivery?url=${encodeURIComponent(cert.public_image_url)}`
        : undefined;

    const templateFormal = `納品データ一式をお送りいたします。本作品は当方が制作したオリジナル作品です。制作日時および元データの同一性を担保するため、『ProofMark』にて存在証明を取得・保全しております。\n証明書URL: ${verifyUrl}`;
    const templateSNS = `本作品の制作日時とオリジナルデータは『ProofMark』にて改ざん不能な状態で証明・保全されています。無断転載や自作発言等の不正利用はお控えください。\n証明書URL: ${verifyUrl}`;

    const getDisplayTitle = () => {
        if (cert.title) return cert.title;
        if (cert.original_filename && cert.original_filename !== 'unknown_file') return cert.original_filename;
        if (cert.storage_path) {
            const parts = cert.storage_path.split('/');
            let rawName = parts[parts.length - 1] || 'Verified_Digital_Artwork';
            rawName = rawName.replace(/^file_\\d+_?/, '');
            return rawName;
        }
        return 'Verified_Digital_Artwork';
    };

    const ogTitle = getDisplayTitle();
    const ogThumb = cert.public_image_url || '';
    const ogHash = cert.sha256 ? cert.sha256.substring(0, 12) : '000000000000';
    const ogTimestamp = cert?.certified_at || cert?.created_at || '';
    const formattedTimestamp = new Date(ogTimestamp).toLocaleString('ja-JP');
    const ogCreator = authorProfile?.username || 'Anonymous';

    const ogpUrl = `https://proofmark.jp/api/og?id=${cert.id}&title=${encodeURIComponent(ogTitle)}&thumb=${encodeURIComponent(ogThumb)}&hash=${ogHash}&timestamp=${encodeURIComponent(formattedTimestamp)}&creator=${encodeURIComponent(ogCreator)}`;

    const hasVisualAsset = !cert.is_asset_purged &&
        cert.proof_mode === 'shareable' &&
        cert.public_image_url &&
        (cert.visibility === 'public' || (user && user.id === cert.user_id));

    return (
        <>
            <SEO
                title={`証明書: ${ogTitle}`}
                description={`この作品の存在と制作日時はProofMarkによって暗号学的に証明されています。`}
                image={ogpUrl}
                url={verifyUrl}
            />
            <style>{`
                @media print {
                    @page { size: A4 landscape; margin: 10mm; }
                    body { 
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important; 
                        background: white !important; 
                        zoom: 0.88; 
                    }
                    .print-compact { padding: 1rem !important; margin-bottom: 0 !important; }
                }

                /* ───────── God-Mode shimmer for primary CTA ───────── */
                @keyframes pm-shimmer {
                  0%   { transform: translateX(-120%) skewX(-12deg); }
                  100% { transform: translateX(220%)  skewX(-12deg); }
                }
                .pm-shimmer-host { position: relative; overflow: hidden; isolation: isolate; }
                .pm-shimmer-host::after {
                  content: '';
                  position: absolute;
                  inset: 0;
                  background: linear-gradient(90deg,
                    transparent 0%,
                    rgba(255,255,255,0.0) 30%,
                    rgba(255,255,255,0.45) 50%,
                    rgba(255,255,255,0.0) 70%,
                    transparent 100%);
                  transform: translateX(-120%) skewX(-12deg);
                  animation: pm-shimmer 3.4s ease-in-out infinite;
                  animation-delay: 1.2s;
                  pointer-events: none;
                  z-index: 1;
                }

                /* SEALED stamp rotation breathing */
                @keyframes pm-seal-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes pm-seal-orbit-rev { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }

                /* ───────── Provenance Filmstrip — hide scrollbar but keep scroll-snap ───────── */
                .pm-filmstrip {
                  scroll-snap-type: x mandatory;
                  scroll-padding-left: 1.25rem;
                  -webkit-overflow-scrolling: touch;
                  scrollbar-width: thin;
                  scrollbar-color: rgba(108,62,244,0.5) transparent;
                }
                .pm-filmstrip::-webkit-scrollbar { height: 6px; }
                .pm-filmstrip::-webkit-scrollbar-track { background: transparent; }
                .pm-filmstrip::-webkit-scrollbar-thumb {
                  background: linear-gradient(90deg, rgba(108,62,244,0.55), rgba(0,212,170,0.55));
                  border-radius: 999px;
                }
                .pm-filmstrip > * { scroll-snap-align: start; }

                @media (prefers-reduced-motion: reduce) {
                  .pm-filmstrip { scroll-behavior: auto; }
                }
            `}</style>

            <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] flex flex-col items-center py-10 px-4 sm:px-8 font-sans print:min-h-0 print:bg-white print:py-0 print:px-0 relative overflow-x-hidden">

                {/* ═══════════ Abyss Aura (background) ═══════════ */}
                <div aria-hidden className="print:hidden pointer-events-none fixed inset-0 -z-0 overflow-hidden">
                    <motion.div
                        className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-[#6C3EF4] opacity-[0.10] blur-[160px]"
                        style={{ willChange: 'opacity, transform' }}
                        animate={{ opacity: [0.07, 0.13, 0.07], scale: [1, 1.04, 1] }}
                        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.div
                        className="absolute -bottom-40 -right-40 w-[700px] h-[700px] rounded-full bg-[#00D4AA] opacity-[0.10] blur-[160px]"
                        style={{ willChange: 'opacity, transform' }}
                        animate={{ opacity: [0.07, 0.13, 0.07], scale: [1, 1.05, 1] }}
                        transition={{ duration: 9, delay: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.div
                        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-[#F0BB38] opacity-[0.04] blur-[140px]"
                        style={{ willChange: 'opacity' }}
                        animate={{ opacity: [0.02, 0.06, 0.02] }}
                        transition={{ duration: 10, delay: 0.6, repeat: Infinity, ease: 'easeInOut' }}
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

                {/* ═══════════ Certificate Card ═══════════ */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: PM_EASE }}
                    className="print-compact w-full max-w-5xl relative overflow-hidden rounded-3xl print:bg-white print:border-2 print:border-gray-200 print:shadow-none print:p-4 print:w-full print:max-w-none print:break-inside-avoid"
                    style={{
                        background:
                            'linear-gradient(165deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.012) 55%, rgba(7,6,26,0.85) 100%), #0D0B24',
                        border: '1px solid rgba(255,255,255,0.10)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        boxShadow:
                            '0 0 0 1px rgba(255,255,255,0.03) inset, 0 40px 100px -40px rgba(108,62,244,0.45), 0 24px 70px -30px rgba(0,212,170,0.22)',
                        padding: 'clamp(2rem, 4vw, 3rem)',
                    }}
                >
                    {/* top RGB hairline */}
                    <div
                        aria-hidden
                        className="print:hidden absolute inset-x-8 top-0 h-px"
                        style={{
                            background:
                                'linear-gradient(90deg, transparent, rgba(108,62,244,0.85), rgba(0,212,170,0.85), rgba(240,187,56,0.6), transparent)',
                        }}
                    />

                    {/* corner brackets */}
                    <CornerBracket pos="tl" />
                    <CornerBracket pos="tr" />
                    <CornerBracket pos="bl" />
                    <CornerBracket pos="br" />

                    {/* internal orbs */}
                    <div className="print:hidden absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                        <motion.div
                            className="absolute -top-32 -left-32 w-96 h-96 bg-[#6C3EF4] opacity-10 blur-[100px] rounded-full"
                            style={{ willChange: 'opacity' }}
                            animate={{ opacity: [0.08, 0.14, 0.08] }}
                            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        <motion.div
                            className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#00D4AA] opacity-10 blur-[100px] rounded-full"
                            style={{ willChange: 'opacity' }}
                            animate={{ opacity: [0.08, 0.14, 0.08] }}
                            transition={{ duration: 6, delay: 1, repeat: Infinity, ease: 'easeInOut' }}
                        />
                    </div>

                    <div className="w-full relative z-10">
                        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 border-b border-white/[0.08] pb-6 print:border-gray-300">
                            <div>
                                <p className="text-[10px] font-mono uppercase tracking-[0.32em] text-[#A8A0D8] mb-3 print:text-gray-500">
                                    ProofMark · Verifiable Existence
                                </p>
                                <h1
                                    className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tighter mb-2 leading-tight print:text-black"
                                    style={{ fontFamily: '"Poppins", "Inter", sans-serif' }}
                                >
                                    CERTIFICATE OF<br />AUTHENTICITY
                                </h1>
                                <p className="text-[#A8A0D8] font-bold text-sm tracking-widest uppercase print:text-gray-500">ProofMark Digital Existence Certificate</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <BreathingBadge
                                    color="#00D4AA"
                                    rgb="0,212,170"
                                    icon={<ShieldCheck className="w-4 h-4" />}
                                    label="VERIFIED"
                                    printClass="print:bg-teal-50 print:border-teal-500 print:text-teal-700"
                                />

                                {c2pa.present && (
                                    <BreathingBadge
                                        color="#BC78FF"
                                        rgb="188,120,255"
                                        icon={<ShieldCheck className="w-4 h-4" />}
                                        label="C2PA VERIFIED"
                                        printClass="print:bg-purple-50 print:border-purple-500 print:text-purple-700"
                                    />
                                )}

                                <BreathingBadge
                                    color="#F0BB38"
                                    rgb="240,187,56"
                                    icon={
                                        <>
                                            <img src={founderBadge} alt="Founder" className="w-4 h-4 print:hidden" />
                                            <span className="hidden print:inline-block w-4 h-4 text-center leading-4">🚀</span>
                                        </>
                                    }
                                    label="FOUNDER"
                                    printClass="print:bg-amber-50 print:border-amber-500 print:text-amber-700"
                                />
                            </div>
                            {authorProfile?.username && (
                                <div className="mt-4 no-print text-center lg:text-left">
                                    <Link href={`/u/${authorProfile.username}`}>
                                        <motion.span
                                            whileHover={{ scale: 1.03 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="inline-flex items-center gap-2 text-sm font-bold text-[#00D4AA] hover:text-white transition-colors cursor-pointer bg-[#00D4AA]/10 border border-[#00D4AA]/30 px-4 py-2 rounded-full"
                                            style={{ boxShadow: '0 0 24px rgba(0,212,170,0.15)' }}
                                        >
                                            👤 @{authorProfile.username} の公開ギャラリーを見る
                                        </motion.span>
                                    </Link>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col md:flex-row gap-10 print:flex-row print:gap-8 print:items-center">

                            {/* 左側: アートワーク or SEALED Stamp */}
                            <div className="w-full md:w-2/5 flex-shrink-0 print:w-[38%]">
                                <div
                                    className="aspect-square w-full rounded-2xl flex flex-col items-center justify-center overflow-hidden relative shadow-inner print:border-gray-300 print:bg-gray-50 print:shadow-none group"
                                    style={{
                                        background: '#07061A',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        boxShadow: hasVisualAsset
                                            ? '0 30px 80px -30px rgba(0,212,170,0.45), 0 0 0 1px rgba(255,255,255,0.04) inset'
                                            : '0 30px 80px -30px rgba(240,187,56,0.35), 0 0 0 1px rgba(255,255,255,0.04) inset',
                                    }}
                                >
                                    {hasVisualAsset && (
                                        <motion.div
                                            aria-hidden
                                            className="print:hidden absolute -inset-6 rounded-[28px] blur-3xl pointer-events-none -z-10"
                                            style={{
                                                background:
                                                    'radial-gradient(ellipse at 50% 80%, rgba(0,212,170,0.35) 0%, transparent 60%), radial-gradient(ellipse at 50% 20%, rgba(108,62,244,0.25) 0%, transparent 55%)',
                                                willChange: 'opacity',
                                            }}
                                            animate={{ opacity: [0.7, 1, 0.7] }}
                                            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                                        />
                                    )}

                                    {cert.is_asset_purged === true ? (
                                        <PurgedVaultFull />
                                    ) : cert.proof_mode === 'shareable' && cert.public_image_url && (cert.visibility === 'public' || (user && user.id === cert.user_id)) ? (
                                        <motion.img
                                            src={secureImageUrl}
                                            alt="Artwork"
                                            className="w-full h-full object-cover"
                                            initial={{ opacity: 0, scale: 1.02 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ duration: 0.8, ease: PM_EASE }}
                                        />
                                    ) : user && user.id === cert.user_id && cert.public_image_url ? (
                                        <TranslucentVaultFull imageUrl={secureImageUrl} />
                                    ) : user && user.id === cert.user_id ? (
                                        <OwnerVaultFull />
                                    ) : (
                                        <SealedStampVault />
                                    )}
                                </div>
                            </div>

                            {/* 右側: data */}
                            <div className="w-full md:w-3/5 flex flex-col justify-center space-y-6 print:w-[62%] print:space-y-4">

                                <div>
                                    <p className="text-[10px] sm:text-xs font-bold text-[#A8A0D8] uppercase tracking-widest mb-1 print:text-gray-500">Certificate ID</p>
                                    <p className="font-mono text-xs sm:text-sm text-white/85 print:text-black">{cert.id}</p>
                                </div>

                                <div>
                                    <p className="text-[10px] sm:text-xs font-bold text-[#A8A0D8] uppercase tracking-widest mb-1 flex items-center gap-1 print:text-gray-500">
                                        <FileText className="w-3 h-3" /> Protected Asset
                                    </p>
                                    <p className="font-medium text-sm sm:text-base text-white print:text-black">
                                        {ogTitle}
                                    </p>
                                </div>

                                {/* SHA-256 panel */}
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: 0.2, ease: PM_EASE }}
                                    className="relative p-4 sm:p-5 rounded-2xl group overflow-hidden print:bg-none print:bg-gray-50 print:border-gray-300 print:shadow-none"
                                    style={{
                                        background:
                                            'linear-gradient(135deg, rgba(0,212,170,0.10) 0%, rgba(0,212,170,0) 70%)',
                                        border: '1px solid rgba(0,212,170,0.28)',
                                        boxShadow: '0 0 0 1px rgba(0,212,170,0.04) inset',
                                    }}
                                >
                                    <div
                                        aria-hidden
                                        className="print:hidden absolute -inset-px rounded-2xl pointer-events-none"
                                        style={{
                                            background:
                                                'conic-gradient(from var(--a, 0deg), transparent 0deg, rgba(0,212,170,0.4) 60deg, transparent 120deg, transparent 360deg)',
                                            opacity: 0.18,
                                        }}
                                    />
                                    <div className="relative">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CheckCircle className="w-4 h-4 text-[#00D4AA] print:text-teal-600" />
                                            <h2 className="text-[10px] sm:text-xs font-bold text-[#00D4AA] uppercase tracking-widest print:text-teal-700">SHA-256 Hash Signature</h2>
                                        </div>
                                        <p className="font-mono text-[#F0EFF8] text-[10px] sm:text-xs break-all pr-8 leading-relaxed print:text-gray-800">{cert.sha256}</p>
                                        <button
                                            onClick={handleHashCopy}
                                            className="print:hidden absolute top-1/2 -translate-y-1/2 right-0 p-2 rounded-lg bg-[#00D4AA]/10 hover:bg-[#00D4AA]/25 transition-colors"
                                            aria-label="ハッシュをコピー"
                                        >
                                            {isHashCopied ? <CheckCircle className="w-4 h-4 text-[#00D4AA]" /> : <Copy className="w-4 h-4 text-[#00D4AA]" />}
                                        </button>
                                    </div>
                                </motion.div>

                                <div className="flex flex-row gap-6 items-center justify-between border-t border-white/[0.08] pt-6 print:border-gray-300 print:pt-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Clock className="w-4 h-4 text-[#F0BB38] print:text-yellow-600" />
                                            <h2 className="text-[10px] sm:text-xs font-bold text-[#F0BB38] uppercase tracking-widest print:text-gray-600">Digital Timestamp (JST)</h2>
                                        </div>
                                        <p
                                            className="text-xl sm:text-2xl font-bold text-white tracking-tight print:text-black"
                                            style={{ fontVariantNumeric: 'tabular-nums' }}
                                        >
                                            {new Date(cert.created_at).toLocaleString('ja-JP')}
                                        </p>
                                        {cert?.certified_at && (
                                            <motion.div
                                                className="mt-2 flex items-center space-x-1.5 text-[#00D4AA] bg-[#00D4AA]/10 border border-[#00D4AA]/30 px-3 py-1 rounded-full w-fit print:bg-teal-50 print:border-teal-200 print:text-teal-700"
                                                animate={{
                                                    boxShadow: [
                                                        '0 0 0 0 rgba(0,212,170,0.5)',
                                                        '0 0 0 6px rgba(0,212,170,0)',
                                                        '0 0 0 0 rgba(0,212,170,0.5)',
                                                    ],
                                                }}
                                                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                                            >
                                                <ShieldCheck className="w-3.5 h-3.5" />
                                                <span className="text-[10px] font-black tracking-widest uppercase">
                                                    RFC3161 Verified
                                                </span>
                                            </motion.div>
                                        )}
                                        <p className="text-[10px] sm:text-xs text-[#A8A0D8] mt-1 print:text-gray-500">改ざん不能な技術で真正性が担保されています</p>
                                    </div>

                                    <div className="flex-shrink-0 flex flex-col items-center gap-1">
                                        <div
                                            className="p-2 sm:p-3 bg-white rounded-xl border border-gray-100 print:shadow-none print:border-gray-300"
                                            style={{ boxShadow: '0 8px 24px rgba(0,212,170,0.18)' }}
                                        >
                                            <QRCodeSVG
                                                value={verifyUrl}
                                                size={70}
                                                bgColor={"#ffffff"}
                                                fgColor={"#000000"}
                                                level={"M"}
                                                includeMargin={false}
                                            />
                                        </div>
                                        <span className="text-[8px] sm:text-[10px] font-bold text-[#A8A0D8] tracking-widest uppercase print:text-gray-500">Scan to Verify</span>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </motion.div>

                <div className="w-full max-w-5xl mt-8 relative z-10">
                    <ContentCredentialsSection manifest={cert?.c2pa_manifest} />
                </div>

                {/* ═══════════ Actions ═══════════ */}
                <div className="pt-8 mt-4 border-t border-slate-700/40 flex flex-wrap gap-4 relative z-10 w-full max-w-5xl justify-start">
                    <motion.button
                        onClick={shareOnX}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        className="no-print bg-[#0f1419] hover:bg-[#272c30] text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 border border-slate-700"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 22.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.008 3.827H5.078z"></path></svg>
                        Xで証明をシェア
                    </motion.button>

                    {isPaidPlan || !cert.user_id ? (
                        <div className="no-print w-full sm:w-auto sm:min-w-[280px] pm-shimmer-host rounded-xl">
                            <EvidencePackDownloadButton certId={cert.id} apiData={cert} />
                        </div>
                    ) : (
                        <motion.button
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => {
                                alert('PDF証明書と Evidence Pack ダウンロードは Creator / Studio プラン限定の機能です。今すぐ、プランをアップグレードしてください。');
                                window.location.href = '/pricing#creator';
                            }}
                            className="no-print bg-slate-800/80 text-slate-300 px-6 py-3 rounded-xl font-bold border border-slate-700 flex items-center gap-2 hover:bg-slate-700 hover:text-white transition-all cursor-pointer relative group backdrop-blur"
                        >
                            <Lock className="w-4 h-4" /> PDF・Evidence Pack をロック解除
                            <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#F0BB38] text-[#1A1200] text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-mono">
                                Creatorプラン限定
                            </span>
                        </motion.button>
                    )}

                    <motion.button
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setLocation('/')}
                        className="no-print bg-gradient-to-br from-[#6C3EF4] to-[#8B61FF] hover:brightness-110 text-white px-6 py-3 rounded-xl font-bold transition-all"
                        style={{ boxShadow: '0 12px 32px -10px rgba(108,62,244,0.65)' }}
                    >
                        トップに戻る
                    </motion.button>
                </div>

                {/* Owner-only block */}
                {isOwner && (
                    <div
                        className="print:hidden w-full max-w-5xl mt-16 p-6 sm:p-8 rounded-2xl mb-20 relative z-10"
                        style={{
                            background:
                                'linear-gradient(165deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 55%, rgba(7,6,26,0.85) 100%)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            backdropFilter: 'blur(16px)',
                            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03), 0 24px 60px -30px rgba(0,212,170,0.20)',
                        }}
                    >
                        <h3 className="text-[#00D4AA] font-bold mb-4 flex items-center gap-2">
                            <span className="text-xl">💡</span> クライアント・提出先向け 説明テンプレート
                        </h3>
                        <p className="text-sm text-[#A8A0D8] mb-6">用途に合わせて以下のテキストをコピーし、納品時やSNSでの作品公開時にご活用ください。</p>

                        <div className="space-y-6">
                            <div>
                                <p className="text-sm text-white font-bold mb-2">▼ 納品・コンテスト提出用（フォーマル）</p>
                                <div className="relative p-4 rounded-lg bg-[#0f1629] border border-[#2a2a4e]">
                                    <button
                                        onClick={() => handleCopy(templateFormal, 'formal')}
                                        className="absolute top-3 right-3 p-2 rounded-md bg-[#1a233a] hover:bg-[#2a3655] transition-colors flex items-center gap-2 text-xs font-bold text-white border border-[#2a2a4e]"
                                    >
                                        {copiedType === 'formal' ? (
                                            <><Check className="w-4 h-4 text-[#00d4aa]" /> コピー完了！</>
                                        ) : (
                                            <><Copy className="w-4 h-4 text-[#6c3ef4]" /> コピーする</>
                                        )}
                                    </button>
                                    <p className="text-sm text-gray-300 whitespace-pre-wrap pr-28 leading-relaxed">
                                        {templateFormal}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <p className="text-sm text-white font-bold mb-2">▼ SNS公開用（無断転載・自作発言対策）</p>
                                <div className="relative p-4 rounded-lg bg-[#0f1629] border border-[#2a2a4e]">
                                    <button
                                        onClick={() => handleCopy(templateSNS, 'sns')}
                                        className="absolute top-3 right-3 p-2 rounded-md bg-[#1a233a] hover:bg-[#2a3655] transition-colors flex items-center gap-2 text-xs font-bold text-white border border-[#2a2a4e]"
                                    >
                                        {copiedType === 'sns' ? (
                                            <><Check className="w-4 h-4 text-[#00d4aa]" /> コピー完了！</>
                                        ) : (
                                            <><Copy className="w-4 h-4 text-[#6c3ef4]" /> コピーする</>
                                        )}
                                    </button>
                                    <p className="text-sm text-gray-300 whitespace-pre-wrap pr-28 leading-relaxed">
                                        {templateSNS}
                                    </p>
                                </div>
                            </div>

                            <div className="pt-6 mt-2 border-t border-[#1C1A38]">
                                <p className="text-sm text-[#FF453A] font-bold mb-2 flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4" /> ▼ 無断転載への法的措置（DMCA / 送信防止措置）
                                </p>
                                <p className="text-xs text-[#A8A0D8] mb-4">
                                    プラットフォーム（X, Google等）に対して、送信防止措置（DMCA等）の法的要件を満たした削除要請書を即時生成します。
                                </p>
                                <motion.button
                                    whileHover={{ y: -1, scale: 1.01 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setTakedownOpen(true)}
                                    className="bg-[#FF453A]/10 hover:bg-[#FF453A]/20 border border-[#FF453A]/30 text-[#FF453A] px-5 py-3 rounded-xl font-bold transition-all flex items-center gap-2 text-sm"
                                    style={{ boxShadow: '0 12px 32px -16px rgba(255,69,58,0.55)' }}
                                >
                                    <Gavel className="w-4 h-4" />
                                    法的削除要請書 (PDF) を作成する
                                </motion.button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══════════ Provenance Gallery ═══════════ */}
                {bundle && (
                    <ProvenanceGallery bundle={bundle} />
                )}

                {/* ═══════════ Verifier (optical scanner) ═══════════ */}
                <div id="verify-section" className="w-full max-w-5xl mt-24 print:hidden scroll-mt-24 relative z-10">
                    <VerifyDropzone />
                </div>

                <div className="mt-12 text-center pb-8 print:hidden relative z-10">
                    <button
                        onClick={handleReportAbuse}
                        className="text-xs text-gray-500 underline hover:text-gray-300 transition-colors flex items-center justify-center gap-1 mx-auto"
                    >
                        <Flag className="w-3 h-3" />
                        違法・悪質なコンテンツを通報する (Report Abuse)
                    </button>
                </div>

                {isOwner && cert && (
                    <TakedownNoticeModal
                        open={isTakedownOpen}
                        onClose={() => setTakedownOpen(false)}
                        certificate={{
                            certificateId: cert.id,
                            timestampJst: new Date(cert.created_at).toLocaleString('ja-JP'),
                            verificationUrl: `${window.location.origin}/cert/${cert.id}`,
                            originalFileName: cert.original_filename || 'unknown_asset',
                        }}
                        claimant={{
                            creatorDisplayName: cert.creator_display_name || 'ProofMark Verified Creator',
                            legalName: cert.legal_name || null,
                            email: user?.email || '',
                            defaultPersona: cert.default_persona || 'creator',
                        }}
                        defaultLanguage="ja"
                    />
                )}

            </div>
        </>
    );
}

/* ═══════════════════════════════════════════════
 *   Corner bracket for the Bento glass card
 * ═══════════════════════════════════════════════ */
function CornerBracket({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
    const base = 'print:hidden absolute w-5 h-5 pointer-events-none';
    let cls = base;
    if (pos === 'tl') cls += ' top-3 left-3 border-t border-l';
    if (pos === 'tr') cls += ' top-3 right-3 border-t border-r';
    if (pos === 'bl') cls += ' bottom-3 left-3 border-b border-l';
    if (pos === 'br') cls += ' bottom-3 right-3 border-b border-r';
    return <div className={cls} style={{ borderColor: 'rgba(255,255,255,0.16)' }} />;
}

/* ═══════════════════════════════════════════════
 *   God-Mode: Breathing Badge (波紋アニメーション)
 * ═══════════════════════════════════════════════ */
function BreathingBadge({
    color,
    rgb,
    icon,
    label,
    printClass = '',
}: {
    color: string;
    rgb: string;
    icon: React.ReactNode;
    label: string;
    printClass?: string;
}) {
    return (
        <motion.div
            className={`relative flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black tracking-widest uppercase ${printClass}`}
            style={{
                background: `rgba(${rgb}, 0.10)`,
                border: `1px solid rgba(${rgb}, 0.45)`,
                color,
                backdropFilter: 'blur(8px)',
            }}
            animate={{
                boxShadow: [
                    `0 0 0 0 rgba(${rgb}, 0.45)`,
                    `0 0 0 8px rgba(${rgb}, 0)`,
                    `0 0 0 0 rgba(${rgb}, 0.45)`,
                ],
            }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        >
            <motion.span
                className="flex items-center"
                animate={{ opacity: [1, 0.78, 1] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            >
                {icon}
            </motion.span>
            <span className="relative">{label}</span>
        </motion.div>
    );
}

/* ═══════════════════════════════════════════════
 *   Visual DNA: deriveGenerativeArt (PortfolioEmbedWidget完全互換)
 *   hash文字コードから決定論的に色相・座標を算出。同じハッシュ→同じアート。
 * ═══════════════════════════════════════════════ */
interface GenerativeArt {
    background: string;
    overlay: string;
    hueA: number;
    hueB: number;
    hueC: number;
}

function deriveGenerativeArt(hash: string): GenerativeArt {
    const seed = (hash || 'proofmark').padEnd(64, '0');
    const codeAt = (i: number) => seed.charCodeAt(i % seed.length);

    const hueA = codeAt(2) % 360;
    const hueB = (codeAt(11) + codeAt(17)) % 360;
    const hueC = (codeAt(23) * 7) % 360;

    const xA = 10 + (codeAt(5) % 70);
    const yA = 10 + (codeAt(7) % 70);
    const xB = 10 + (codeAt(13) % 70);
    const yB = 10 + (codeAt(19) % 70);
    const xC = 10 + (codeAt(29) % 80);
    const yC = 10 + (codeAt(31) % 80);

    const conicAngle = codeAt(3) % 360;
    const stripeAngle = codeAt(37) % 180;
    const stripeGap = 6 + (codeAt(41) % 10);

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

/* ═══════════════════════════════════════════════
 *   Visual DNA: HashFingerprint
 *   flat composite (opacity 0.15) — mix-blend-mode 排除でグリッド軽量
 * ═══════════════════════════════════════════════ */
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

    return (
        <div
            className={`relative h-full w-full overflow-hidden ${className}`}
            style={{ background: art.background }}
        >
            <div
                aria-hidden
                className="absolute inset-0"
                style={{ background: art.overlay, opacity: 0.15 }}
            />
            <div
                aria-hidden
                className="absolute inset-0"
                style={{
                    backgroundImage:
                        'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.55) 1px, transparent 1px), radial-gradient(circle at 70% 80%, rgba(255,255,255,0.45) 1px, transparent 1px)',
                    backgroundSize: '6px 6px, 9px 9px',
                    opacity: 0.15,
                }}
            />
            <div
                aria-hidden
                className="absolute inset-0"
                style={{
                    background:
                        'radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.45) 100%)',
                }}
            />

            {showLabel && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4">
                    <div
                        className="flex h-11 w-11 items-center justify-center rounded-full"
                        style={{
                            background: 'rgba(0,0,0,0.5)',
                            border: '1px solid rgba(0,212,170,0.45)',
                            backdropFilter: 'blur(6px)',
                            boxShadow: '0 0 22px rgba(0,212,170,0.4)',
                        }}
                    >
                        <Lock className="h-5 w-5 text-[#00D4AA]" strokeWidth={1.6} />
                    </div>
                    <div className="text-center">
                        <p className="text-[9.5px] font-mono uppercase tracking-[0.28em] text-white/85">
                            Confidential Proof
                        </p>
                        <p
                            className="mt-1 font-mono text-[10px] text-white/55 tracking-[0.18em]"
                            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
                        >
                            {hash ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : '—'}
                        </p>
                    </div>
                </div>
            )}

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

            <div
                aria-hidden
                className="absolute top-2 left-2 font-mono text-[8px] tracking-[0.3em]"
                style={{
                    color: 'rgba(255,255,255,0.55)',
                    textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                }}
            >
                ✦ PM
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════
 *   Provenance Gallery — Horizontal Bento Scroll
 *   (旧 ProofBundleTimelineCard の置き換え)
 *
 *   UX哲学: 透明性レポート / Apple Filmstrip
 *   - scroll-snap-type: x mandatory で滑らかな水平スクロール
 *   - 各ステップは Bento-Glassmorphism カード
 *   - step_type で起点(オレンジ) / 途中(パープル) / 完成(ティール) を色分け
 *   - preview_url が無ければ HashFingerprint で暗号金庫UIを描画
 * ═══════════════════════════════════════════════ */

type StepTone = {
    label: string;
    color: string;
    rgb: string;
    bg: string;
    border: string;
};

function getStepTone(step: ProcessBundlePublic['steps'][number], index: number, total: number): StepTone {
    const stepType = (step.step_type || '').toLowerCase();

    // index ベースの fallback
    const isFirst = index === 0;
    const isLast = index === total - 1;

    // 完成 (final or 最後)
    if (stepType === 'final' || isLast) {
        return {
            label: 'FINAL',
            color: '#00D4AA',
            rgb: '0,212,170',
            bg: 'rgba(0,212,170,0.12)',
            border: 'rgba(0,212,170,0.45)',
        };
    }
    // 起点 (rough or index 0)
    if (stepType === 'rough' || isFirst) {
        return {
            label: 'ORIGIN',
            color: '#F59E0B',
            rgb: '245,158,11',
            bg: 'rgba(245,158,11,0.12)',
            border: 'rgba(245,158,11,0.45)',
        };
    }
    // 途中 (lineart, color, other)
    return {
        label: stepType ? stepType.toUpperCase() : 'STEP',
        color: '#A8A0D8',
        rgb: '108,62,244',
        bg: 'rgba(108,62,244,0.12)',
        border: 'rgba(108,62,244,0.40)',
    };
}

function formatStepDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('ja-JP', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function ProvenanceGallery({ bundle }: { bundle: ProcessBundlePublic }) {
    const sortedSteps = useMemo(
        () => [...bundle.steps].sort((a, b) => a.step_index - b.step_index),
        [bundle.steps],
    );
    const total = sortedSteps.length;

    return (
        <motion.section
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.15, ease: PM_EASE }}
            aria-labelledby="provenance-gallery-title"
            className="w-full max-w-5xl mt-12 print:hidden relative isolate z-10"
        >
            {/* ambient halo */}
            <div
                aria-hidden
                className="absolute -inset-x-12 -top-8 h-48 bg-gradient-to-b from-[#6C3EF4]/12 via-[#00D4AA]/8 to-transparent blur-3xl -z-10 rounded-[3rem]"
            />

            {/* outer glass shell */}
            <div
                className="relative overflow-hidden rounded-3xl"
                style={{
                    background:
                        'linear-gradient(165deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.012) 55%, rgba(7,6,26,0.85) 100%)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    boxShadow:
                        '0 0 0 1px rgba(255,255,255,0.03) inset, 0 30px 80px -30px rgba(108,62,244,0.40), 0 16px 50px -20px rgba(0,212,170,0.15)',
                }}
            >
                {/* RGB hairline */}
                <div
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-px"
                    style={{
                        background:
                            'linear-gradient(90deg, transparent, rgba(245,158,11,0.65), rgba(108,62,244,0.85), rgba(0,212,170,0.85), transparent)',
                    }}
                />

                {/* header */}
                <header className="px-5 sm:px-7 pt-6 sm:pt-7 pb-4 sm:pb-5 border-b border-white/[0.06]">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                            <p className="text-[10px] font-mono uppercase tracking-[0.32em] text-[#A8A0D8] mb-2 flex items-center gap-1.5">
                                <Layers3 className="w-3 h-3 text-[#6C3EF4]" />
                                Provenance Gallery · Chain of Evidence
                            </p>
                            <h2
                                id="provenance-gallery-title"
                                className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-tight"
                                style={{ fontFamily: '"Poppins", "Inter", sans-serif' }}
                            >
                                制作プロセスは、暗号証明されています。
                            </h2>
                            <p className="mt-2 text-[13px] leading-relaxed text-[#A8A0D8] max-w-2xl">
                                ラフから完成までの各工程が SHA-256 でハッシュチェーンされ、RFC3161 タイムスタンプで
                                改ざん不能に保全されています。← → でスクロールしてご確認ください。
                            </p>
                        </div>

                        {/* breathing transparency badge */}
                        <BreathingBadge
                            color="#BC78FF"
                            rgb="188,120,255"
                            icon={<Sparkles className="w-3.5 h-3.5" />}
                            label="TRANSPARENCY"
                        />
                    </div>

                    {/* meta strip */}
                    <div className="mt-4 flex flex-wrap items-center gap-2.5 text-[10px] font-mono uppercase tracking-[0.22em]">
                        <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
                            style={{
                                background: 'rgba(245,158,11,0.10)',
                                border: '1px solid rgba(245,158,11,0.35)',
                                color: '#F59E0B',
                            }}
                        >
                            <span className="block h-1.5 w-1.5 rounded-full" style={{ background: '#F59E0B' }} />
                            起点
                        </span>
                        <ChevronRight className="w-3 h-3 text-white/30" />
                        <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
                            style={{
                                background: 'rgba(108,62,244,0.10)',
                                border: '1px solid rgba(108,62,244,0.35)',
                                color: '#BC78FF',
                            }}
                        >
                            <span className="block h-1.5 w-1.5 rounded-full" style={{ background: '#6C3EF4' }} />
                            工程
                        </span>
                        <ChevronRight className="w-3 h-3 text-white/30" />
                        <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
                            style={{
                                background: 'rgba(0,212,170,0.10)',
                                border: '1px solid rgba(0,212,170,0.35)',
                                color: '#00D4AA',
                            }}
                        >
                            <span className="block h-1.5 w-1.5 rounded-full" style={{ background: '#00D4AA' }} />
                            完成
                        </span>
                        <span className="text-white/30 mx-1">·</span>
                        <span className="text-white/50" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {total} STEPS
                        </span>
                        {typeof bundle.chain_head_sha256 === 'string' && bundle.chain_head_sha256 && (
                            <>
                                <span className="text-white/30 mx-1">·</span>
                                <span className="text-[#00D4AA]">
                                    HEAD {bundle.chain_head_sha256.slice(0, 10)}…
                                </span>
                            </>
                        )}
                    </div>
                </header>

                {/* horizontal filmstrip */}
                <div className="relative">
                    {/* fade gradients (edge) */}
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 left-0 w-12 z-10"
                        style={{ background: 'linear-gradient(90deg, rgba(7,6,26,0.7), transparent)' }}
                    />
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 right-0 w-12 z-10"
                        style={{ background: 'linear-gradient(-90deg, rgba(7,6,26,0.7), transparent)' }}
                    />

                    <div
                        className="pm-filmstrip flex gap-4 sm:gap-5 px-5 sm:px-7 py-6 sm:py-7 overflow-x-auto"
                        role="list"
                        aria-label="制作プロセスのステップ"
                    >
                        {sortedSteps.map((step, index) => {
                            const tone = getStepTone(step, index, total);
                            return (
                                <ProvenanceStepCard
                                    key={step.id}
                                    step={step}
                                    index={index}
                                    total={total}
                                    tone={tone}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* footer assurance */}
                <footer className="px-5 sm:px-7 py-4 border-t border-white/[0.06] flex items-center justify-between gap-3 text-[11px] text-[#A8A0D8] font-mono">
                    <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#00D4AA]" />
                        各ステップは前ステップのハッシュとチェーンされています
                    </span>
                    <span className="hidden sm:inline uppercase tracking-[0.2em] text-white/35">
                        SHA-256 · RFC 3161
                    </span>
                </footer>
            </div>
        </motion.section>
    );
}

/* ── Step card (filmstrip member) ── */
function ProvenanceStepCard({
    step,
    index,
    total,
    tone,
}: {
    step: ProcessBundlePublic['steps'][number];
    index: number;
    total: number;
    tone: StepTone;
}) {
    const [imgError, setImgError] = useState(false);
    const hasPreview = typeof step.preview_url === 'string' && step.preview_url !== '' && !imgError;
    const isLast = index === total - 1;

    return (
        <motion.article
            role="listitem"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, delay: Math.min(index * 0.06, 0.5), ease: PM_EASE }}
            whileHover={{ y: -3 }}
            className="group relative shrink-0 w-[280px] sm:w-[320px] overflow-hidden rounded-2xl"
            style={{
                background:
                    'linear-gradient(165deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.012) 60%, rgba(7,6,26,0.85) 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 14px 40px -20px rgba(0,0,0,0.6)',
                willChange: 'transform',
            }}
        >
            {/* tone hairline */}
            <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-px"
                style={{
                    background: `linear-gradient(90deg, transparent, ${tone.color}, transparent)`,
                    opacity: 0.7,
                }}
            />

            {/* under-card glow on hover */}
            <div
                aria-hidden
                className="absolute -inset-2 rounded-[20px] blur-2xl pointer-events-none opacity-0 group-hover:opacity-100 -z-10"
                style={{
                    background: `radial-gradient(ellipse at 50% 80%, rgba(${tone.rgb}, 0.35), transparent 55%)`,
                    transition: 'opacity 400ms',
                    willChange: 'opacity',
                }}
            />

            {/* preview area */}
            <div className="relative aspect-[4/5] overflow-hidden">
                {hasPreview ? (
                    <img
                        src={step.preview_url as string}
                        alt={step.title}
                        loading="lazy"
                        decoding="async"
                        onError={() => setImgError(true)}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                ) : (
                    <HashFingerprint
                        hash={step.sha256 || step.id}
                        className="absolute inset-0"
                    />
                )}

                {/* step index badge (top-left) */}
                <div
                    className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-[0.22em]"
                    style={{
                        background: 'rgba(7,6,26,0.78)',
                        border: `1px solid ${tone.border}`,
                        color: tone.color,
                        backdropFilter: 'blur(8px)',
                        boxShadow: `0 6px 18px rgba(0,0,0,0.4)`,
                    }}
                >
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
                    </span>
                </div>

                {/* tone badge (top-right) */}
                <motion.div
                    className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-mono font-bold uppercase tracking-[0.22em]"
                    style={{
                        background: tone.bg,
                        border: `1px solid ${tone.border}`,
                        color: tone.color,
                        backdropFilter: 'blur(8px)',
                    }}
                    animate={{
                        boxShadow: [
                            `0 0 0 0 rgba(${tone.rgb}, 0.45)`,
                            `0 0 0 5px rgba(${tone.rgb}, 0)`,
                            `0 0 0 0 rgba(${tone.rgb}, 0.45)`,
                        ],
                    }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                >
                    {tone.label}
                </motion.div>

                {/* completion ribbon for final step */}
                {isLast && (
                    <div
                        className="absolute bottom-3 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-mono font-bold uppercase tracking-[0.22em]"
                        style={{
                            background: 'rgba(0,212,170,0.18)',
                            border: '1px solid rgba(0,212,170,0.5)',
                            color: '#FFFFFF',
                            backdropFilter: 'blur(8px)',
                            boxShadow: '0 6px 18px rgba(0,212,170,0.35)',
                        }}
                    >
                        <CheckCircle className="w-3 h-3" />
                        Delivered
                    </div>
                )}
            </div>

            {/* meta */}
            <div className="px-4 py-3.5">
                <p
                    className="text-[13.5px] font-bold text-white leading-snug line-clamp-2"
                    title={step.title}
                >
                    {step.title || `Step ${index + 1}`}
                </p>

                <div className="mt-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-white/55">
                    <Clock className="w-3 h-3" style={{ color: tone.color }} />
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatStepDate(step.issued_at)}
                    </span>
                </div>

                {/* hash strip */}
                <div
                    className="mt-3 rounded-lg px-2.5 py-1.5"
                    style={{
                        background: 'rgba(0,0,0,0.25)',
                        border: '1px solid rgba(255,255,255,0.06)',
                    }}
                >
                    <p className="text-[8.5px] font-mono uppercase tracking-[0.24em] text-white/40">
                        SHA-256
                    </p>
                    <p
                        className="mt-0.5 font-mono text-[10.5px] truncate"
                        style={{
                            color: tone.color,
                            textShadow: `0 0 8px rgba(${tone.rgb}, 0.3)`,
                            fontVariantNumeric: 'tabular-nums',
                        }}
                        title={step.sha256}
                    >
                        {step.sha256 ? `${step.sha256.slice(0, 12)}…${step.sha256.slice(-6)}` : '—'}
                    </p>
                </div>
            </div>

            {/* chain connector — except last */}
            {!isLast && (
                <div
                    aria-hidden
                    className="hidden sm:flex absolute top-1/2 -right-3 -translate-y-1/2 items-center justify-center z-20"
                    style={{ pointerEvents: 'none' }}
                >
                    <div
                        className="h-6 w-6 rounded-full flex items-center justify-center"
                        style={{
                            background: 'rgba(7,6,26,0.92)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                        }}
                    >
                        <ChevronRight className="w-3 h-3 text-white/55" />
                    </div>
                </div>
            )}
        </motion.article>
    );
}

/* ═══════════════════════════════════════════════
 *   God-Mode: SEALED Stamp Vault
 * ═══════════════════════════════════════════════ */
function SealedStampVault() {
    return (
        <Tooltip.Provider delayDuration={200}>
            <Tooltip.Root>
                <Tooltip.Trigger asChild>
                    <div
                        className="flex flex-col items-center justify-center w-full h-full cursor-default overflow-hidden relative"
                        style={{
                            background:
                                'radial-gradient(circle at center, rgba(240,187,56,0.12) 0%, rgba(108,62,244,0.05) 50%, transparent 80%), #050310',
                        }}
                    >
                        <div
                            className="absolute inset-0 pointer-events-none opacity-40"
                            style={{
                                backgroundImage:
                                    'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.02) 2px, rgba(255,255,255,0.02) 4px)',
                                mixBlendMode: 'overlay' as const,
                            }}
                        />

                        <motion.div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                background:
                                    'radial-gradient(circle at center, rgba(240,187,56,0.22) 0%, transparent 55%)',
                                willChange: 'opacity',
                            }}
                            animate={{ opacity: [0.45, 0.85, 0.45] }}
                            transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
                        />

                        <motion.div
                            initial={{ scale: 2.4, rotate: -22, opacity: 0 }}
                            animate={{ scale: 1, rotate: -8, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 280, damping: 14, mass: 0.9, delay: 0.15 }}
                            className="relative"
                            style={{
                                filter:
                                    'drop-shadow(0 0 24px rgba(240,187,56,0.45)) drop-shadow(0 14px 30px rgba(0,0,0,0.7))',
                            }}
                        >
                            <motion.span
                                aria-hidden
                                className="absolute inset-0 rounded-full"
                                style={{ border: '2px solid rgba(240,187,56,0.5)' }}
                                initial={{ scale: 1, opacity: 0.6 }}
                                animate={{ scale: 1.8, opacity: 0 }}
                                transition={{ duration: 0.9, delay: 0.35, ease: 'easeOut' }}
                            />
                            <motion.span
                                aria-hidden
                                className="absolute inset-0 rounded-full"
                                style={{ border: '2px solid rgba(240,187,56,0.35)' }}
                                initial={{ scale: 1, opacity: 0.4 }}
                                animate={{ scale: 2.5, opacity: 0 }}
                                transition={{ duration: 1.2, delay: 0.5, ease: 'easeOut' }}
                            />

                            <SealedStampSVG />
                        </motion.div>

                        <motion.div
                            className="absolute bottom-5 left-0 right-0 text-center"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.9, duration: 0.6, ease: PM_EASE }}
                        >
                            <p className="font-mono text-[9.5px] tracking-[0.32em] text-[#F0BB38]/85 uppercase">
                                Zero-Knowledge · NDA Sealed
                            </p>
                            <p className="font-mono text-[9px] tracking-[0.24em] text-[#A8A0D8]/60 mt-1">
                                hash imprint · sha-256 · rfc 3161
                            </p>
                        </motion.div>
                    </div>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                    <Tooltip.Content
                        sideOffset={8}
                        className="z-50 max-w-[300px] px-4 py-3 rounded-xl shadow-2xl text-xs leading-relaxed"
                        style={{ backgroundColor: '#151d2f', border: '1px solid #2a2a4e', color: '#a0a0c0' }}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                        >
                            この作品は機密保持契約（NDA）に基づき、ゼロ知識封印（Zero-Knowledge Seal）が施されています。原本はクリエイターのローカル環境から一切送信されておらず、暗号学的ハッシュのみがブロックチェーン級の改ざん耐性で保全されています。
                        </motion.div>
                        <Tooltip.Arrow className="fill-[#2a2a4e] w-3 h-1.5" />
                    </Tooltip.Content>
                </Tooltip.Portal>
            </Tooltip.Root>
        </Tooltip.Provider>
    );
}

/* The SEALED stamp itself: inline SVG */
function SealedStampSVG() {
    return (
        <div className="relative w-[210px] h-[210px] sm:w-[230px] sm:h-[230px]">
            <div
                aria-hidden
                className="absolute inset-0 rounded-full"
                style={{
                    border: '1px dashed rgba(240,187,56,0.5)',
                    animation: 'pm-seal-orbit 36s linear infinite',
                }}
            />
            <div
                aria-hidden
                className="absolute inset-4 rounded-full"
                style={{
                    border: '1px dashed rgba(108,62,244,0.32)',
                    animation: 'pm-seal-orbit-rev 48s linear infinite',
                }}
            />

            <svg
                viewBox="0 0 240 240"
                width="100%"
                height="100%"
                className="relative"
            >
                <defs>
                    <radialGradient id="pm-seal-bg" cx="50%" cy="35%" r="70%">
                        <stop offset="0%" stopColor="#FFE39A" stopOpacity="0.95" />
                        <stop offset="55%" stopColor="#F0BB38" stopOpacity="0.85" />
                        <stop offset="100%" stopColor="#7A5512" stopOpacity="0.9" />
                    </radialGradient>
                    <linearGradient id="pm-seal-rim" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FFE39A" />
                        <stop offset="100%" stopColor="#A37512" />
                    </linearGradient>
                    <radialGradient id="pm-seal-highlight" cx="35%" cy="25%" r="40%">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
                        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                    </radialGradient>
                    <filter id="pm-seal-inner-shadow">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" />
                        <feOffset dy="2" />
                        <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="shadowDiff" />
                        <feColorMatrix in="shadowDiff" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0   0 0 0 0.5 0" />
                    </filter>
                    <path
                        id="pm-seal-arc-top"
                        d="M 30,120 A 90,90 0 0 1 210,120"
                        fill="none"
                    />
                    <path
                        id="pm-seal-arc-bot"
                        d="M 210,120 A 90,90 0 0 1 30,120"
                        fill="none"
                    />
                </defs>

                <circle cx="120" cy="120" r="108" fill="url(#pm-seal-bg)" />
                <circle cx="120" cy="120" r="108" fill="none" stroke="url(#pm-seal-rim)" strokeWidth="2.5" />
                <circle cx="120" cy="120" r="108" fill="url(#pm-seal-highlight)" />

                <circle cx="120" cy="120" r="98" fill="none" stroke="rgba(80,50,0,0.55)" strokeWidth="0.5" strokeDasharray="2 5" />

                <circle cx="120" cy="120" r="74" fill="rgba(60,30,0,0.18)" filter="url(#pm-seal-inner-shadow)" />
                <circle cx="120" cy="120" r="74" fill="none" stroke="rgba(255,210,120,0.55)" strokeWidth="1" />

                <text fill="rgba(40,20,0,0.85)" fontSize="11" fontWeight="900" letterSpacing="4">
                    <textPath href="#pm-seal-arc-top" startOffset="50%" textAnchor="middle">
                        ★ PROOFMARK ★ SEALED ★
                    </textPath>
                </text>
                <text fill="rgba(40,20,0,0.7)" fontSize="9" fontWeight="700" letterSpacing="3.5">
                    <textPath href="#pm-seal-arc-bot" startOffset="50%" textAnchor="middle">
                        RFC 3161 · SHA-256 · ZERO-KNOWLEDGE
                    </textPath>
                </text>

                <g transform="translate(120,124)">
                    <circle r="36" fill="rgba(50,25,0,0.22)" />
                    <circle r="36" fill="none" stroke="rgba(255,225,140,0.6)" strokeWidth="0.75" />
                    <path
                        d="M -16,-22 L -16,22 M -16,-22 L 4,-22 C 16,-22 16,-2 4,-2 L -16,-2"
                        stroke="#3C1F00"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                    />
                    <path
                        d="M 6,22 L 6,-2 L 14,8 L 22,-2 L 22,22"
                        stroke="#3C1F00"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                    />
                    <g fill="#3C1F00" opacity="0.75">
                        <polygon points="-26,0 -24,-2 -22,0 -24,2" />
                        <polygon points="26,0 24,-2 22,0 24,2" />
                    </g>
                </g>

                <g transform="translate(120,184)">
                    <rect x="-44" y="-9" width="88" height="18" rx="3" fill="rgba(40,20,0,0.7)" />
                    <text
                        x="0"
                        y="4"
                        textAnchor="middle"
                        fill="#FFE39A"
                        fontSize="11"
                        fontWeight="900"
                        letterSpacing="5"
                    >
                        SEALED
                    </text>
                </g>
            </svg>

            <div
                aria-hidden
                className="absolute inset-0 rounded-full -z-10 blur-2xl"
                style={{ background: 'radial-gradient(circle, rgba(240,187,56,0.35), transparent 65%)' }}
            />
        </div>
    );
}

/* ─── Vault components (preserved) ─────────────── */

const PurgedVaultFull = () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 p-8 text-center relative overflow-hidden border border-zinc-800/50 rounded-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,212,170,0.03)_0%,transparent_70%)] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center max-w-md">
            <motion.div
                className="w-20 h-20 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center mb-6 shadow-lg shadow-black/50 backdrop-blur-sm"
                animate={{ boxShadow: ['0 0 20px rgba(0,212,170,0.08)', '0 0 40px rgba(0,212,170,0.18)', '0 0 20px rgba(0,212,170,0.08)'] }}
                transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
            >
                <svg className="w-10 h-10 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
            </motion.div>

            <h3 className="text-xl font-semibold text-zinc-200 mb-3 tracking-wide">
                原本ストレージ期間終了
            </h3>

            <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                Freeプランの保存期間（30日）が終了したため、表示用の原本ファイルはサーバーから完全に削除されました。
            </p>

            <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-5 w-full backdrop-blur-sm text-left">
                <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <div>
                        <p className="text-sm text-emerald-400 font-medium">暗号学的なハッシュ台帳は永久です</p>
                        <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                            お手元の原本ファイルを専用の検証エリア（Verify）にドロップすれば、いつでも改ざんされていないことの存在証明が可能です。
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

function TheVaultFull() {
    return <SealedStampVault />;
}

function TranslucentVaultFull({ imageUrl }: { imageUrl: string }) {
    return (
        <div className="relative w-full h-full">
            <img
                src={imageUrl}
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover"
                style={{ filter: 'blur(16px) grayscale(100%) opacity(0.6)' }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0e27]/40 backdrop-blur-[2px]">
                <motion.div
                    animate={{
                        boxShadow: [
                            '0 0 0 0 rgba(108,62,244,0.5)',
                            '0 0 0 14px rgba(108,62,244,0)',
                            '0 0 0 0 rgba(108,62,244,0.5)',
                        ],
                    }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                    className="rounded-full p-3 mb-3"
                >
                    <Lock className="w-8 h-8 text-[#f0f0fa]/80" />
                </motion.div>
                <span className="font-bold text-xs tracking-wider text-[#f0f0fa]/85 uppercase">Owner Preview</span>
                <span className="font-mono text-[10px] tracking-widest text-[#00d4aa]/60 uppercase mt-1">NDA Protected</span>
            </div>
        </div>
    );
}

function OwnerVaultFull() {
    return (
        <div
            className="flex flex-col items-center justify-center w-full h-full cursor-default overflow-hidden relative"
            style={{
                backgroundColor: '#0a0e27',
                backgroundImage: 'radial-gradient(circle at center, rgba(108,62,244,0.12) 0%, transparent 60%)',
            }}
        >
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.02) 2px, rgba(255,255,255,0.02) 4px)',
                    mixBlendMode: 'overlay' as const,
                }}
            />
            <motion.div
                animate={{
                    boxShadow: [
                        '0 0 0 0 rgba(108,62,244,0.55)',
                        '0 0 0 16px rgba(108,62,244,0)',
                        '0 0 0 0 rgba(108,62,244,0.55)',
                    ],
                }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                className="rounded-full p-3 mb-4"
            >
                <Lock className="w-10 h-10 text-[#6c3ef4]" />
            </motion.div>
            <h4 className="font-bold tracking-wide text-[#f0f0fa] text-base mb-1 opacity-90">NDA Protected</h4>
            <span className="font-mono text-[10px] tracking-widest text-[#6c3ef4] opacity-80 uppercase">Owner View</span>
        </div>
    );
}
