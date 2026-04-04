import { useEffect, useState } from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import { createClient } from '@supabase/supabase-js';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle, Clock, ShieldCheck, Image as ImageIcon, Copy, Check, FileText } from 'lucide-react';
import navbarLogo from '../assets/logo/navbar/proofmark-navbar-symbol-dark.svg';
import founderBadge from '../assets/logo/badges/proofmark-badge-founder.svg';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function CertificatePage() {
    const [match, params] = useRoute('/cert/:id');
    const id = match && params ? params.id : null;
    const [, setLocation] = useLocation();

    const [cert, setCert] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isHashCopied, setIsHashCopied] = useState(false);

    // 💡 複数ボタンに対応するためコピー状態を文字列で管理
    const [copiedType, setCopiedType] = useState<string | null>(null);

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
                setCert(data);
            }
            setLoading(false);
        }
        fetchCertificate();
    }, [id]);

    const handleHashCopy = () => {
        if (cert?.file_hash) {
            navigator.clipboard.writeText(cert.file_hash);
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

    const verifyUrl = `${window.location.origin}/cert/${cert.id}`;

    // 💡 プロ仕様にアップグレードされたテンプレート
    const templateFormal = `納品データ一式をお送りいたします。本作品は、AI生成ベースに当方で独自の加筆修正を施したオリジナル作品です。『ProofMark』にて制作日時と元データを暗号化・保全し、正当な制作プロセスを証明しております。\n証明書URL: ${verifyUrl}`;
    const templateSNS = `本作品の制作日時とオリジナルデータは『ProofMark』にて改ざん不能な状態で証明・保全されています。無断転載や自作発言等の不正利用はお控えください。\n証明書URL: ${verifyUrl}`;

    return (
        <>
            {/* 🖨️ ブラウザの印刷基本設定を強制（Tailwindと併用して最強にする） */}
            <style>{`
                @media print {
                    @page { size: A4 landscape; margin: 15mm; }
                    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: white !important; }
                }
            `}</style>

            {/* 💡 Tailwindの `print:` クラスを駆使して印刷時の見た目を完全にコントロール */}
            <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] flex flex-col items-center py-10 px-4 sm:px-8 font-sans print:min-h-0 print:bg-white print:py-0 print:px-0">

                <div className="print:hidden w-full max-w-5xl mb-8 flex items-center justify-between">
                    <a href="/" className="flex items-center gap-3 text-decoration-none">
                        <img src={navbarLogo} alt="ProofMark Logo" className="h-7 w-auto" />
                        <span className="font-['Syne'] text-xl font-extrabold text-[#F0EFF8]">
                            Proof<span className="text-[#00D4AA]">Mark</span>
                        </span>
                    </a>
                </div>

                {/* --- 📜 証明書カード本体 --- */}
                <div className="w-full max-w-5xl bg-[#0D0B24] border border-[#1C1A38] rounded-3xl p-8 sm:p-12 shadow-[0_0_50px_rgba(108,62,244,0.1)] relative overflow-hidden print:bg-white print:border-2 print:border-gray-200 print:shadow-none print:p-8 print:w-full print:max-w-none print:break-inside-avoid">

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
                                <div className="flex items-center gap-1.5 bg-[#1A1200] border border-[#F0BB38] text-[#F0BB38] px-4 py-2 rounded-full text-xs font-black tracking-widest uppercase print:bg-yellow-50 print:border-yellow-500 print:text-yellow-700">
                                    <img src={founderBadge} alt="Founder" className="w-4 h-4 print:hidden" />
                                    <span className="hidden print:inline-block w-4 h-4 text-center leading-4">👑</span>
                                    FOUNDER
                                </div>
                            </div>
                            {cert.metadata?.username && (
                                <div className="mt-4 no-print text-center lg:text-left">
                                    <Link href={`/u/${cert.metadata.username}`}>
                                        <span className="inline-flex items-center gap-2 text-sm font-bold text-[#00D4AA] hover:text-white transition-colors cursor-pointer bg-[#00D4AA]/10 border border-[#00D4AA]/20 px-4 py-2 rounded-full">
                                            👤 @{cert.metadata.username} の公開ギャラリーを見る
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
                                    {cert.image_url ? (
                                        <img src={cert.image_url} alt="Artwork" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-center p-6 flex flex-col items-center justify-center h-full w-full bg-gradient-to-br from-[#151D2F] to-[#07061A] print:bg-none print:bg-gray-50">
                                            <ImageIcon className="w-10 h-10 text-[#6C3EF4]/40 mb-3 print:text-gray-400" />
                                            <span className="text-[#00D4AA] text-[10px] sm:text-xs font-bold tracking-widest border border-[#00D4AA]/30 bg-[#00D4AA]/10 px-3 py-1 rounded-full mb-2 print:bg-gray-200 print:border-gray-400 print:text-gray-600">
                                                ZERO-KNOWLEDGE
                                            </span>
                                            <p className="text-[#A8A0D8] text-xs sm:text-sm font-bold mb-1 print:text-gray-700">Image Data Hidden</p>
                                            <p className="text-[#A8A0D8]/60 text-[10px] sm:text-xs leading-relaxed max-w-[200px] opacity-80 print:text-gray-500">
                                                運営すら原画を見られない<br />完全秘匿化状態で証明されています
                                            </p>
                                        </div>
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
                                        {(() => {
                                            // 1. DBにちゃんとしたファイル名 (file_name) があればそれを優先表示
                                            if (cert.file_name && cert.file_name !== 'Untitled') return cert.file_name;

                                            // 2. なければ、storage_path（例: "cert_1712345678/image.png"）から抽出
                                            if (cert.storage_path) {
                                                // スラッシュで分割して一番後ろ（ファイル名部分）を取得
                                                const parts = cert.storage_path.split('/');
                                                let rawName = parts[parts.length - 1] || 'Verified_Digital_Artwork';

                                                // "file_1775299275556.png" のような余計なタイムスタンプを除去する処理
                                                // 例: "file_1775..._オリジナル名.png" などの場合、綺麗にする
                                                rawName = rawName.replace(/^file_\d+_?/, '');

                                                return rawName;
                                            }
                                            return 'Verified_Digital_Artwork';
                                        })()}
                                    </p>
                                </div>

                                <div className="p-4 sm:p-5 rounded-2xl border border-[#00D4AA]/20 bg-gradient-to-r from-[#00D4AA]/10 to-transparent relative group print:bg-none print:bg-gray-50 print:border-gray-300 print:shadow-none">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle className="w-4 h-4 text-[#00D4AA] print:text-teal-600" />
                                        <h2 className="text-[10px] sm:text-xs font-bold text-[#00D4AA] uppercase tracking-widest print:text-teal-700">SHA-256 Hash Signature</h2>
                                    </div>
                                    <p className="font-mono text-[#F0EFF8] text-[10px] sm:text-xs break-all pr-8 leading-relaxed print:text-gray-800">{cert.file_hash}</p>
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

                {/* --- 🚫 ここから下は印刷時すべて非表示 (print:hidden) --- */}

                <div className="print:hidden w-full max-w-5xl mt-10 flex flex-col sm:flex-row gap-4 justify-center">
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

                {/* 💡 2パターンの強力なテンプレート */}
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
                    </div>
                </div>

            </div>
        </>
    );
}