import { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { createClient } from '@supabase/supabase-js';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle, Clock, ShieldCheck, Image as ImageIcon, Copy } from 'lucide-react';
import navbarLogo from '../assets/logo/navbar/proofmark-navbar-symbol-dark.svg';
import founderBadge from '../assets/logo/badges/proofmark-badge-founder.svg';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function CertificatePage() {
    const [match, params] = useRoute('/cert/:id');
    const id = match && params ? params.id : null;
    const [, setLocation] = useLocation();

    const [cert, setCert] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        async function fetchCertificate() {
            if (!id) {
                setLoading(false);
                return;
            }
            const { data, error } = await supabase
                .from('certificates')
                .select('*')
                .eq('id', id)
                .single();

            if (!error && data) {
                setCert(data as Record<string, unknown>);
            }
            setLoading(false);
        }
        fetchCertificate();
    }, [id]);

    const handleCopy = () => {
        const hash = cert?.file_hash as string | undefined;
        if (hash) {
            navigator.clipboard.writeText(hash);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#07061A] text-[#00D4AA] flex justify-center items-center font-bold tracking-widest">
                VERIFYING...
            </div>
        );
    }

    if (!cert) {
        return (
            <div className="min-h-screen bg-[#07061A] text-white flex flex-col justify-center items-center gap-6">
                <ShieldCheck className="w-16 h-16 text-slate-600" />
                <h1 className="text-xl font-bold tracking-widest">証明書が見つかりません</h1>
                <button
                    onClick={() => setLocation('/')}
                    className="text-[#00D4AA] hover:text-white transition-colors border-b border-[#00D4AA] pb-1"
                >
                    トップに戻る
                </button>
            </div>
        );
    }

    const verifyUrl = `${window.location.origin}/cert/${cert.id as string}`;

    return (
        <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] flex flex-col items-center py-10 px-4 sm:px-8 font-sans">

            {/* ── Navbar ── */}
            <div className="no-print w-full max-w-5xl mb-8 flex items-center justify-between">
                <a href="/" className="flex items-center gap-3 no-underline">
                    <img src={navbarLogo} alt="ProofMark Logo" className="h-7 w-auto" />
                    <span className="font-['Syne'] text-xl font-extrabold text-[#F0EFF8]">
                        Proof<span className="text-[#00D4AA]">Mark</span>
                    </span>
                </a>
            </div>

            {/* ── Main Certificate Card ── */}
            <div className="print-container w-full max-w-5xl bg-[#0D0B24] border border-[#1C1A38] rounded-3xl p-8 sm:p-12 shadow-[0_0_50px_rgba(108,62,244,0.1)] relative overflow-hidden">

                {/* Glow Effects (Hidden on print) */}
                <div className="no-print absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                    <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#6C3EF4] opacity-10 blur-[100px] rounded-full" />
                    <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#00D4AA] opacity-10 blur-[100px] rounded-full" />
                </div>

                {/* Header Section */}
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10 border-b border-[#1C1A38] pb-8">
                    <div>
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tighter mb-2 leading-tight">
                            CERTIFICATE OF<br />AUTHENTICITY
                        </h1>
                        <p className="text-[#A8A0D8] font-bold text-sm tracking-widest uppercase">
                            ProofMark Digital Existence Certificate
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-[#00D4AA] px-4 py-2 rounded-full text-xs font-black tracking-widest uppercase shadow-[0_0_15px_rgba(0,212,170,0.2)]">
                            <ShieldCheck className="w-4 h-4" /> VERIFIED
                        </div>
                        <div className="flex items-center gap-1.5 bg-[#1A1200] border border-[#F0BB38] text-[#F0BB38] px-4 py-2 rounded-full text-xs font-black tracking-widest uppercase shadow-[0_0_15px_rgba(240,187,56,0.15)]">
                            <img src={founderBadge} alt="Founder" className="w-4 h-4" /> FOUNDER
                        </div>
                    </div>
                </div>

                {/* ── Content: Responsive Grid (Mobile: Col, PC: Row) ── */}
                <div className="relative z-10 flex flex-col md:flex-row gap-10">

                    {/* Left Column: Artwork area (40% width on PC) */}
                    <div className="w-full md:w-2/5 flex-shrink-0">
                        <div className="aspect-square w-full rounded-2xl border border-[#1C1A38] bg-[#07061A] flex flex-col items-center justify-center overflow-hidden relative shadow-inner">
                            {cert.image_url ? (
                                <img
                                    src={cert.image_url as string}
                                    alt="Artwork"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="text-center p-6 flex flex-col items-center justify-center h-full w-full bg-gradient-to-br from-[#151D2F] to-[#07061A]">
                                    <ImageIcon className="w-12 h-12 text-[#6C3EF4]/40 mb-4" />
                                    <span className="text-[#00D4AA] text-xs font-bold tracking-widest border border-[#00D4AA]/30 bg-[#00D4AA]/10 px-3 py-1 rounded-full mb-3">
                                        ZERO-KNOWLEDGE
                                    </span>
                                    <p className="text-[#A8A0D8] text-sm font-bold mb-1">Image Data Hidden</p>
                                    <p className="text-[#A8A0D8]/60 text-xs leading-relaxed max-w-[200px]">
                                        運営すら原画を見られない<br />完全秘匿化状態で証明されています
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Data area */}
                    <div className="w-full md:w-3/5 flex flex-col justify-center space-y-8">

                        {/* Certificate ID */}
                        <div>
                            <p className="text-xs font-bold text-[#A8A0D8] uppercase tracking-widest mb-1">Certificate ID</p>
                            <p className="font-mono text-sm sm:text-base text-white/80">{cert.id as string}</p>
                        </div>

                        {/* Hash Signature */}
                        <div className="p-5 rounded-2xl border border-[#00D4AA]/20 bg-gradient-to-r from-[#00D4AA]/10 to-transparent relative group">
                            <div className="flex items-center gap-2 mb-3">
                                <CheckCircle className="w-4 h-4 text-[#00D4AA]" />
                                <h2 className="text-xs font-bold text-[#00D4AA] uppercase tracking-widest">SHA-256 Hash Signature</h2>
                            </div>
                            <p className="font-mono text-[#F0EFF8] text-sm sm:text-base break-all pr-10">
                                {cert.file_hash as string}
                            </p>
                            <button
                                onClick={handleCopy}
                                className="no-print absolute top-1/2 -translate-y-1/2 right-4 p-2 rounded-lg bg-[#00D4AA]/10 hover:bg-[#00D4AA]/20 transition-colors"
                                title="Copy Hash"
                            >
                                {copied
                                    ? <CheckCircle className="w-4 h-4 text-[#00D4AA]" />
                                    : <Copy className="w-4 h-4 text-[#00D4AA]" />
                                }
                            </button>
                        </div>

                        {/* Timestamp & QR Code */}
                        <div className="flex flex-col sm:flex-row gap-8 items-start sm:items-center justify-between border-t border-[#1C1A38] pt-8">

                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <Clock className="w-4 h-4 text-[#F0BB38]" />
                                    <h2 className="text-xs font-bold text-[#F0BB38] uppercase tracking-widest">Digital Timestamp (JST)</h2>
                                </div>
                                <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                                    {new Date(cert.created_at as string).toLocaleString('ja-JP')}
                                </p>
                                <p className="text-xs text-[#A8A0D8] mt-2">改ざん不能な技術で真正性が担保されています</p>
                            </div>

                            <div className="flex-shrink-0 flex flex-col items-center gap-2">
                                <div className="p-3 bg-white rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                                    <QRCodeSVG
                                        value={verifyUrl}
                                        size={90}
                                        bgColor={"#ffffff"}
                                        fgColor={"#0D0B24"}
                                        level={"M"}
                                        includeMargin={false}
                                    />
                                </div>
                                <span className="text-[10px] font-bold text-[#A8A0D8] tracking-widest uppercase">Scan to Verify</span>
                            </div>

                        </div>

                    </div>
                </div>
            </div>

            {/* ── Actions ── */}
            <div className="no-print w-full max-w-5xl mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                <button
                    onClick={() => window.print()}
                    className="bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] hover:from-[#5A2BD4] hover:to-[#7948FF] text-white px-8 py-4 rounded-full font-bold transition-all shadow-[0_0_20px_rgba(108,62,244,0.4)] hover:scale-105"
                >
                    PDFとして保存・印刷
                </button>
                <button
                    onClick={() => setLocation('/')}
                    className="bg-[#151D2F] border border-[#1C1A38] hover:bg-[#1C263E] text-white px-8 py-4 rounded-full font-bold transition-all"
                >
                    トップに戻る
                </button>
            </div>

            {/* ── Templates ── */}
            <div className="no-print w-full max-w-5xl mt-16 bg-[#0D0B24] p-6 sm:p-8 rounded-2xl border border-[#1C1A38]">
                <h3 className="text-[#00D4AA] font-bold mb-4 flex items-center gap-2">
                    <span className="text-xl">💡</span> クライアント・提出先向け 説明テンプレート
                </h3>
                <p className="text-sm text-[#A8A0D8] mb-6">
                    以下のテキストをコピーして、納品時やSNSでの作品公開時にご活用ください。
                </p>

                <div className="space-y-6">
                    <div>
                        <p className="text-sm text-white font-bold mb-2">▼ 納品時・コンテスト提出時</p>
                        <div className="bg-[#07061A] p-4 rounded-xl border border-[#1C1A38] text-sm text-[#D4D0F4] leading-relaxed cursor-text">
                            納品データ一式をお送りいたします。本作品は、AIによる生成過程から当方での加筆修正を含め、制作日時とオリジナルデータを『ProofMark』にて保全・証明しております。証明書URL: {verifyUrl}
                        </div>
                    </div>

                    <div>
                        <p className="text-sm text-white font-bold mb-2">▼ SNSプロフィール・ポートフォリオ用</p>
                        <div className="bg-[#07061A] p-4 rounded-xl border border-[#1C1A38] text-sm text-[#D4D0F4] leading-relaxed cursor-text">
                            当アカウントのAI作品はすべてProofMarkにてデジタル存在証明を取得し、無断転載・自作発言を監視・保護しています。
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}