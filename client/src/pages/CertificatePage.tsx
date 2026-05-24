import { useEffect, useState, useMemo } from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle, Clock, ShieldCheck, Image as ImageIcon, Copy, Check, FileText, Lock, ShieldAlert, Flag, Package, Gavel } from 'lucide-react';
import { motion } from 'framer-motion';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useAuth } from '../hooks/useAuth';
import EvidencePackDownloadButton from '@/components/EvidencePackDownloadButton';
import Navbar from '../components/Navbar';
import SEO from '../components/SEO';
import { ProofBundleTimelineCard } from '../components/proof/ProofBundleTimelineCard';
import type { ProcessBundlePublic } from '../lib/proofmark-types';
import { getProcessBundleByVerifyToken } from '../lib/proofmark-api';
import navbarLogo from '../assets/logo/navbar/proofmark-navbar-symbol-dark.svg';
import founderBadge from '../assets/logo/badges/proofmark-badge-founder.svg';
import { supabase } from '../lib/supabase';
import { getC2paSummary } from '../lib/c2pa-schema';
import { ContentCredentialsSection } from '../components/cert/ContentCredentialsSection';
import VerifyDropzone from '../components/VerifyDropzone';
import TakedownNoticeModal from '../components/proof/TakedownNoticeModal'; // 🚨 追加: DMCAモーダル



export default function CertificatePage() {
    const [match, params] = useRoute('/cert/:id');
    const id = match && params ? params.id : null;
    const [, setLocation] = useLocation();

    const [cert, setCert] = useState<any>(null);
    const [bundle, setBundle] = useState<ProcessBundlePublic | null>(null);
    const [authorProfile, setAuthorProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isHashCopied, setIsHashCopied] = useState(false);

    // 💡 複数ボタンに対応するためコピー状態を文字列で管理
    const [copiedType, setCopiedType] = useState<string | null>(null);
    const [isTakedownOpen, setTakedownOpen] = useState(false); // 🚨 追加: DMCAモーダル開閉ステート
    const { user, profile, signOut } = useAuth(); // profileを追加
    
    // この証明書の作成者（クリエイター）本人かどうかを判定
    const isOwner = user && user.id === cert?.user_id;

    // 違法・悪質コンテンツの通報ハンドラー（お守り機能）
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
            setBundle(null); // Reset the timeline on page change
            if (!id) {
                setLoading(false);
                return;
            }

            // 1. 証明書データの取得
            const { data: certData, error: certError } = await supabase
                .from('certificates')
                .select('*')
                .eq('id', id)
                .single();

            if (!certError && certData) {
                // 🚨 Opusのダウンローダー(SpotIssueApiResponse)が必要とするデータを既存のcertDataからマッピングして統合
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
                    tsr_token_base64: certData.tsr_token_base64 || '', // Supabaseのレコードから直接Base64を取得
                    thumbnail_data_url: certData.public_image_url || undefined,
                    // 🚨 シングルクォートをバッククォートに変更し、末尾にカンマを追加
                    creator_display_name: authorProfile?.username ? `@${authorProfile.username}` : 'ProofMark Verified Creator',
                    legal_name: authorProfile?.legal_name || '',
                    default_persona: authorProfile?.default_persona || 'creator'
                };
                
                setCert(extendedCertData);

                // 2. 最新のプロフィール情報を取得（ユーザー名変更に対応）
                if (certData.user_id) {
                    // 🚨 セキュリティ: 閲覧者が「所有者本人」の場合のみ、非公開情報（本名・設定）をフェッチする
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

                // 3. Chain of Evidence バンドルの取得
                if (certData.process_bundle_id && certData.public_verify_token) {
                    try {
                        const bundle = await getProcessBundleByVerifyToken(certData.public_verify_token);
                        if (bundle) setBundle(bundle);
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
        return <div className="min-h-screen bg-[#07061A] text-[#00D4AA] flex justify-center items-center font-bold tracking-widest print:bg-white print:text-black">VERIFYING...</div>;
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

    const templateFormal = `納品データ一式をお送りいたします。本作品は、AI生成ベースに当方で独自の加筆修正を施したオリジナル作品です。『ProofMark』にて制作日時と元データを暗号化・保全し、正当な制作プロセスを証明しております。\n証明書URL: ${verifyUrl}`;
    const templateSNS = `本作品の制作日時とオリジナルデータは『ProofMark』にて改ざん不能な状態で証明・保全されています。無断転載や自作発言等の不正利用はお控えください。\n証明書URL: ${verifyUrl}`;

    // --- 動的OGP用のパラメータ抽出 ---
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

    return (
        <>
            <SEO
                title={`証明書: ${ogTitle}`}
                description={`この作品の存在と制作日時はProofMarkによって暗号学的に証明されています。`}
                image={ogpUrl}
                url={verifyUrl}
            />
            {/* 🖨️ ブラウザの印刷基本設定を強制（Tailwindと併用して最強にする） */}
            <style>{`
                @media print {
                    @page { size: A4 landscape; margin: 10mm; }
                    body { 
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important; 
                        background: white !important; 
                        zoom: 0.88; 
                    }
                    /* 余分な空白を詰める */
                    .print-compact { padding: 1rem !important; margin-bottom: 0 !important; }
                }
            `}</style>

            {/* 💡 Tailwindの `print:` クラスを駆使して印刷時の見た目を完全にコントロール */}
            <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] flex flex-col items-center py-10 px-4 sm:px-8 font-sans print:min-h-0 print:bg-white print:py-0 print:px-0">

                <Navbar user={user} signOut={signOut} />

                {/* --- 📜 証明書カード本体 --- */}
                <div className="print-compact w-full max-w-5xl bg-[#0D0B24] border border-[#1C1A38] rounded-3xl p-8 sm:p-12 shadow-[0_0_50px_rgba(108,62,244,0.1)] relative overflow-hidden print:bg-white print:border-2 print:border-gray-200 print:shadow-none print:p-4 print:w-full print:max-w-none print:break-inside-avoid">

                    <div className="print:hidden absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#6C3EF4] opacity-10 blur-[100px] rounded-full"></div>
                        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#00D4AA] opacity-10 blur-[100px] rounded-full"></div>
                    </div>

                    <div className="w-full relative z-10">
                        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 border-b border-[#1C1A38] pb-6 print:border-gray-300">
                            <div>
                                <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tighter mb-2 leading-tight print:text-black">
                                    CERTIFICATE OF<br />AUTHENTICITY
                                </h1>
                                <p className="text-[#A8A0D8] font-bold text-sm tracking-widest uppercase print:text-gray-500">ProofMark Digital Existence Certificate</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-1.5 bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-[#00D4AA] px-4 py-2 rounded-full text-xs font-black tracking-widest uppercase print:bg-teal-50 print:border-teal-500 print:text-teal-700">
                                    <ShieldCheck className="w-4 h-4" /> VERIFIED
                                </div>
                                {c2pa.present && (
                                    <div className="flex items-center gap-1.5 bg-[#6C3EF4]/10 border border-[#6C3EF4]/50 shadow-[0_0_12px_rgba(108,62,244,0.4)] text-[#BC78FF] px-4 py-2 rounded-full text-xs font-black tracking-widest uppercase print:bg-purple-50 print:border-purple-500 print:text-purple-700">
                                        <ShieldCheck className="w-4 h-4" /> C2PA VERIFIED
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5 bg-[#6C3EF4]/10 border border-[#6C3EF4]/50 shadow-[0_0_12px_rgba(108,62,244,0.4)] text-[#BC78FF] px-4 py-2 rounded-full text-xs font-black tracking-widest uppercase print:bg-purple-50 print:border-purple-500 print:text-purple-700">
                                    <img src={founderBadge} alt="Founder" className="w-4 h-4 print:hidden" />
                                    <span className="hidden print:inline-block w-4 h-4 text-center leading-4">🚀</span>
                                    FOUNDER
                                </div>
                            </div>
                            {authorProfile?.username && (
                                <div className="mt-4 no-print text-center lg:text-left">
                                    <Link href={`/u/${authorProfile.username}`}>
                                        <span className="inline-flex items-center gap-2 text-sm font-bold text-[#00D4AA] hover:text-white transition-colors cursor-pointer bg-[#00D4AA]/10 border border-[#00D4AA]/20 px-4 py-2 rounded-full">
                                            👤 @{authorProfile.username} の公開ギャラリーを見る
                                        </span>
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* 💡 print:flex-row を追加して印刷時に横並びを強制 */}
                        <div className="flex flex-col md:flex-row gap-10 print:flex-row print:gap-8 print:items-center">

                            {/* 左側：アートワーク または ZK表示 */}
                            <div className="w-full md:w-2/5 flex-shrink-0 print:w-[38%]">
                                <div className="aspect-square w-full rounded-2xl border border-[#1C1A38] bg-[#07061A] flex flex-col items-center justify-center overflow-hidden relative shadow-inner print:border-gray-300 print:bg-gray-50 print:shadow-none">
                                    {cert.is_asset_purged === true ? (
                                        <PurgedVaultFull />
                                    ) : cert.proof_mode === 'shareable' && cert.public_image_url && (cert.visibility === 'public' || (user && user.id === cert.user_id)) ? (
                                        <img src={secureImageUrl} alt="Artwork" className="w-full h-full object-cover" />
                                    ) : user && user.id === cert.user_id && cert.public_image_url ? (
                                        <TranslucentVaultFull imageUrl={secureImageUrl} />
                                    ) : user && user.id === cert.user_id ? (
                                        <OwnerVaultFull />
                                    ) : (
                                        <TheVaultFull />
                                    )}
                                </div>
                            </div>

                            {/* 右側：データ表示 */}
                            <div className="w-full md:w-3/5 flex flex-col justify-center space-y-6 print:w-[62%] print:space-y-4">

                                <div>
                                    <p className="text-[10px] sm:text-xs font-bold text-[#A8A0D8] uppercase tracking-widest mb-1 print:text-gray-500">Certificate ID</p>
                                    <p className="font-mono text-xs sm:text-sm text-white/80 print:text-black">{cert.id}</p>
                                </div>

                                {/* 💡 【NEW】ファイル名を表示して作品との紐付けを明確化 */}
                                <div>
                                    <p className="text-[10px] sm:text-xs font-bold text-[#A8A0D8] uppercase tracking-widest mb-1 flex items-center gap-1 print:text-gray-500">
                                        <FileText className="w-3 h-3" /> Protected Asset
                                    </p>
                                    <p className="font-medium text-sm sm:text-base text-white print:text-black">
                                        {ogTitle}
                                    </p>
                                </div>

                                <div className="p-4 sm:p-5 rounded-2xl border border-[#00D4AA]/20 bg-gradient-to-r from-[#00D4AA]/10 to-transparent relative group print:bg-none print:bg-gray-50 print:border-gray-300 print:shadow-none">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle className="w-4 h-4 text-[#00D4AA] print:text-teal-600" />
                                        <h2 className="text-[10px] sm:text-xs font-bold text-[#00D4AA] uppercase tracking-widest print:text-teal-700">SHA-256 Hash Signature</h2>
                                    </div>
                                    <p className="font-mono text-[#F0EFF8] text-[10px] sm:text-xs break-all pr-8 leading-relaxed print:text-gray-800">{cert.sha256}</p>
                                    <button
                                        onClick={handleHashCopy}
                                        className="print:hidden absolute top-1/2 -translate-y-1/2 right-3 p-2 rounded-lg bg-[#00D4AA]/10 hover:bg-[#00D4AA]/20 transition-colors"
                                    >
                                        {isHashCopied ? <CheckCircle className="w-4 h-4 text-[#00D4AA]" /> : <Copy className="w-4 h-4 text-[#00D4AA]" />}
                                    </button>
                                </div>

                                <div className="flex flex-row gap-6 items-center justify-between border-t border-[#1C1A38] pt-6 print:border-gray-300 print:pt-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Clock className="w-4 h-4 text-[#F0BB38] print:text-yellow-600" />
                                            <h2 className="text-[10px] sm:text-xs font-bold text-[#F0BB38] uppercase tracking-widest print:text-gray-600">Digital Timestamp (JST)</h2>
                                        </div>
                                        <p className="text-xl sm:text-2xl font-bold text-white tracking-tight print:text-black">
                                            {new Date(cert.created_at).toLocaleString('ja-JP')}
                                        </p>
                                        {cert?.certified_at && (
                                            <div className="mt-2 flex items-center space-x-1.5 text-[#00D4AA] bg-[#00D4AA]/10 border border-[#00D4AA]/20 px-3 py-1 rounded-full w-fit print:bg-teal-50 print:border-teal-200 print:text-teal-700">
                                                <ShieldCheck className="w-3.5 h-3.5" />
                                                <span className="text-[10px] font-black tracking-widest uppercase">
                                                    RFC3161 Verified
                                                </span>
                                            </div>
                                        )}
                                        <p className="text-[10px] sm:text-xs text-[#A8A0D8] mt-1 print:text-gray-500">改ざん不能な技術で真正性が担保されています</p>
                                    </div>

                                    <div className="flex-shrink-0 flex flex-col items-center gap-1">
                                        <div className="p-2 sm:p-3 bg-white rounded-xl shadow-lg border border-gray-100 print:shadow-none print:border-gray-300">
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
                </div>

                <div className="w-full max-w-5xl mt-8">
                    <ContentCredentialsSection manifest={cert?.c2pa_manifest} />
                </div>

                {/* --- 🚫 ここから下は印刷時すべて非表示 (print:hidden) --- */}



                <div className="pt-8 border-t border-slate-700 flex flex-wrap gap-4">
                    <button
                        onClick={shareOnX}
                        className="no-print bg-[#0f1419] hover:bg-[#272c30] text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 border border-slate-700"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 22.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.008 3.827H5.078z"></path></svg>
                        Xで証明をシェア
                    </button>
                    {/* 有料プラン、または user_id が存在しない（＝未ログインで決済を突破したSpotユーザー）場合は開放 */}
                    {isPaidPlan || !cert.user_id ? (
                        <>
                            {/* 「PDFとして保存」はUXの混乱を避けるため完全削除し、Evidence Packボタンへ一本化 */}
                            <div className="no-print w-full sm:w-auto sm:min-w-[280px]">
                                <EvidencePackDownloadButton certId={cert.id} apiData={cert} />
                            </div>
                        </>
                    ) : (
                        <button
                            onClick={() => {
                                alert('PDF証明書と Evidence Pack ダウンロードは Creator / Studio プラン限定の機能です。今すぐ、プランをアップグレードしてください。');
                                window.location.href = '/pricing#creator';
                            }}
                            className="no-print bg-slate-800 text-slate-400 px-6 py-3 rounded-xl font-bold border border-slate-700 flex items-center gap-2 hover:bg-slate-700 hover:text-white transition-all cursor-pointer relative group"
                        >
                            <Lock className="w-4 h-4" /> PDF・Evidence Pack をロック解除
                            <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#F0BB38] text-[#1A1200] text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                Creatorプラン限定
                            </span>
                        </button>
                    )}
                    <button
                        onClick={() => setLocation('/')}
                        className="no-print bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-all"
                    >
                        トップに戻る
                    </button>
                </div>

                {/* 作成者（オーナー）本人にしか見せない「マジックの裏側」のUI */}
                {isOwner && (
                    <div className="print:hidden w-full max-w-5xl mt-16 bg-[#0D0B24] p-6 sm:p-8 rounded-2xl border border-[#1C1A38] mb-20">
                        <h3 className="text-[#00D4AA] font-bold mb-4 flex items-center gap-2">
                            <span className="text-xl">💡</span> クライアント・提出先向け 説明テンプレート
                        </h3>
                        <p className="text-sm text-[#A8A0D8] mb-6">用途に合わせて以下のテキストをコピーし、納品時やSNSでの作品公開時にご活用ください。</p>

                        <div className="space-y-6">
                            {/* パターン1: 納品用 */}
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

                            {/* パターン2: SNS用 */}
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

                            {/* 🚨 パターン3: 法的削除要請（DMCA） */}
                            <div className="pt-6 mt-2 border-t border-[#1C1A38]">
                                <p className="text-sm text-[#FF453A] font-bold mb-2 flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4" /> ▼ 無断転載への法的措置（DMCA / 送信防止措置）
                                </p>
                                <p className="text-xs text-[#A8A0D8] mb-4">
                                    プラットフォーム（X, Google, 各種プロバイダ等）に対して、法的効力を持つ削除要請書（Takedown Notice）を即時生成します。
                                </p>
                                <button
                                    onClick={() => setTakedownOpen(true)}
                                    className="bg-[#FF453A]/10 hover:bg-[#FF453A]/20 border border-[#FF453A]/30 text-[#FF453A] px-5 py-3 rounded-xl font-bold transition-all flex items-center gap-2 text-sm"
                                >
                                    <Gavel className="w-4 h-4" />
                                    法的削除要請書 (PDF) を作成する
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Chain of Evidence タイムライン */}
                {bundle && (
                    <div className="w-full max-w-5xl mt-12 print:hidden relative isolate">
                        <div className="absolute inset-0 bg-gradient-to-b from-[#6C3EF4]/5 to-transparent blur-3xl -z-10 rounded-[3rem]"></div>
                        <ProofBundleTimelineCard bundle={bundle} />
                    </div>
                )}

                {/* ✨ Zero-Knowledge Web Verifier (ブラウザ内オフライン検証) ✨ */}
                {/* 🚨 ID `verify-section` とスムーススクロール用の `scroll-mt-24` を追加 */}
                <div id="verify-section" className="w-full max-w-5xl mt-24 print:hidden scroll-mt-24">
                    <div className="bg-[#f5f5f7] rounded-[2.5rem] py-16 px-4 sm:px-12 shadow-[0_20px_80px_rgba(0,0,0,0.5)] border border-[#e5e5e7]/10 relative overflow-hidden transition-all hover:shadow-[0_20px_100px_rgba(0,212,170,0.15)]">
                        {/* 上部に落ちる淡い光沢（ガラス表現） */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-12 bg-gradient-to-b from-white/80 to-transparent blur-xl pointer-events-none"></div>
                        
                        {/* Verifier 本体 */}
                        <VerifyDropzone />
                    </div>
                </div>

                {/* 🚨 通報導線 (Report Abuse) */}
                <div className="mt-12 text-center pb-8 print:hidden">
                    <button
                        onClick={handleReportAbuse}
                        className="text-xs text-gray-500 underline hover:text-gray-300 transition-colors flex items-center justify-center gap-1 mx-auto"
                    >
                        <Flag className="w-3 h-3" />
                        違法・悪質なコンテンツを通報する (Report Abuse)
                    </button>
                </div>

                {/* 🚨 DMCA / Takedown Notice Modal */}
                {isOwner && cert && (
                    <TakedownNoticeModal
                        open={isTakedownOpen}
                        onClose={() => setTakedownOpen(false)}
                        certificate={{
                            certificateId: cert.id,
                            timestampJst: new Date(cert.certified_at || cert.created_at).toLocaleString('ja-JP'),
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

/* ─── Vault components (CertificatePage local) ─────────────── */

const PurgedVaultFull = () => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 p-8 text-center relative overflow-hidden border border-zinc-800/50 rounded-xl">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,212,170,0.03)_0%,transparent_70%)] pointer-events-none" />
    
    <div className="relative z-10 flex flex-col items-center max-w-md">
      <div className="w-20 h-20 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center mb-6 shadow-lg shadow-black/50 backdrop-blur-sm">
        <svg className="w-10 h-10 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      
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
    return (
        <Tooltip.Provider delayDuration={200}>
            <Tooltip.Root>
                <Tooltip.Trigger asChild>
                    <div
                        className="flex flex-col items-center justify-center w-full h-full cursor-default overflow-hidden"
                        style={{
                            backgroundColor: '#0a0e27',
                            backgroundImage: 'radial-gradient(circle at center, rgba(108,62,244,0.08) 0%, transparent 60%)',
                        }}
                    >
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.02) 2px, rgba(255,255,255,0.02) 4px)',
                                mixBlendMode: 'overlay' as const,
                            }}
                        />
                        <Lock className="w-10 h-10 text-[#6c3ef4]/50 mb-4" />
                        <h4 className="font-bold tracking-wide text-[#f0f0fa] text-base mb-1.5 opacity-90">NDA Protected</h4>
                        <p className="font-mono text-[10px] tracking-widest text-[#00d4aa] opacity-70">ZERO-KNOWLEDGE ENCRYPTION</p>
                    </div>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                    <Tooltip.Content
                        sideOffset={8}
                        className="z-50 max-w-[280px] px-4 py-3 rounded-xl shadow-2xl text-xs leading-relaxed"
                        style={{ backgroundColor: '#151d2f', border: '1px solid #2a2a4e', color: '#a0a0c0' }}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                        >
                            この作品は機密保持契約（NDA）に基づき、高度な暗号化技術で保護されています。元の画像はクリエイターのローカル環境から一切送信されていません。
                        </motion.div>
                        <Tooltip.Arrow className="fill-[#2a2a4e] w-3 h-1.5" />
                    </Tooltip.Content>
                </Tooltip.Portal>
            </Tooltip.Root>
        </Tooltip.Provider>
    );
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
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0e27]/40">
                <Lock className="w-8 h-8 text-[#f0f0fa]/50 mb-3" />
                <span className="font-bold text-xs tracking-wider text-[#f0f0fa]/70 uppercase">Owner Preview</span>
                <span className="font-mono text-[10px] tracking-widest text-[#00d4aa]/50 uppercase mt-1">NDA Protected</span>
            </div>
        </div>
    );
}

function OwnerVaultFull() {
    return (
        <div
            className="flex flex-col items-center justify-center w-full h-full cursor-default overflow-hidden"
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
            <Lock className="w-10 h-10 text-[#6c3ef4] mb-4" />
            <h4 className="font-bold tracking-wide text-[#f0f0fa] text-base mb-1 opacity-90">NDA Protected</h4>
            <span className="font-mono text-[10px] tracking-widest text-[#6c3ef4] opacity-70 uppercase">Owner View</span>
        </div>
    );
}