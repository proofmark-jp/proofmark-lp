import { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function CertificatePage() {
    // wouter の方式で URL から id を取得
    const [match, params] = useRoute('/cert/:id');
    const id = match && params ? params.id : null;

    // 画面遷移用
    const [, setLocation] = useLocation();

    const [cert, setCert] = useState<any>(null);
    const [loading, setLoading] = useState(true);

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

    if (loading) {
        return <div className="min-h-screen bg-[#0f172a] text-white flex justify-center items-center">Loading...</div>;
    }

    if (!cert) {
        return (
            <div className="min-h-screen bg-[#0f172a] text-white flex flex-col justify-center items-center gap-4">
                <h1 className="text-xl">証明書が見つかりません</h1>
                <button onClick={() => setLocation('/')} className="text-blue-400 underline">トップに戻る</button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center p-4 sm:p-8 font-sans">
            <div className="print-container max-w-3xl w-full bg-[#1e293b] border border-slate-700 rounded-2xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
                <h1 className="text-2xl sm:text-3xl font-bold text-blue-400 mb-1">ProofMark Digital Certificate</h1>
                <p className="text-slate-400 text-sm font-mono border-b border-slate-700 pb-6 mb-8">ID: {cert.id}</p>

                <div className="space-y-8">
                    <div>
                        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">SHA-256 Hash Signature</h2>
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                            <p className="font-mono text-emerald-400 break-all">{cert.file_hash}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div>
                            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Timestamp (JST)</h2>
                            <p className="text-xl font-semibold">
                                {new Date(cert.created_at).toLocaleString('ja-JP')}
                            </p>
                        </div>
                        <div>
                            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Storage Location</h2>
                            <p className="text-lg">Secure Cloud Storage</p>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-slate-700 flex gap-4">
                        <button 
                            onClick={() => window.print()} 
                            className="no-print bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-xl font-bold transition-all"
                        >
                            PDFとして保存
                        </button>
                        <button 
                            onClick={() => setLocation('/')} 
                            className="no-print bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-all"
                        >
                            トップに戻る
                        </button>
                    </div>
                </div>
            </div>

            {/* 利用シーン別・説明テンプレート */}
            <div className="no-print max-w-3xl w-full" style={{ marginTop: "40px", background: "#0D0B24", padding: "24px", borderRadius: "16px", border: "1px solid #1C1A38" }}>
                <h3 style={{ fontSize: "16px", color: "#00D4AA", marginBottom: "16px" }}>💡 クライアント・提出先向け 説明テンプレート</h3>
                <p style={{ fontSize: "13px", color: "#A8A0D8", marginBottom: "12px" }}>以下のテキストをコピーして、納品時やSNSでの作品公開時にご活用ください。</p>
                
                <div style={{ marginBottom: "20px" }}>
                    <p style={{ fontSize: "12px", color: "#F0EFF8", fontWeight: "bold", marginBottom: "8px" }}>▼ 納品時・コンテスト提出時</p>
                    <div style={{ background: "#07061A", padding: "12px", borderRadius: "8px", border: "1px solid #1C1A38", fontSize: "13px", color: "#D4D0F4", userSelect: "all", cursor: "pointer" }}>
                        納品データ一式をお送りいたします。本作品は、AIによる生成過程から当方での加筆修正を含め、制作日時とオリジナルデータを『ProofMark』にて保全・証明しております。証明書URL: {window.location.href}
                    </div>
                </div>

                <div>
                    <p style={{ fontSize: "12px", color: "#F0EFF8", fontWeight: "bold", marginBottom: "8px" }}>▼ SNSプロフィール・ポートフォリオ用</p>
                    <div style={{ background: "#07061A", padding: "12px", borderRadius: "8px", border: "1px solid #1C1A38", fontSize: "13px", color: "#D4D0F4", userSelect: "all", cursor: "pointer" }}>
                        当アカウントのAI作品はすべてProofMarkにてデジタル存在証明を取得し、無断転載・自作発言を監視・保護しています。
                    </div>
                </div>
            </div>
        </div>
    );
}