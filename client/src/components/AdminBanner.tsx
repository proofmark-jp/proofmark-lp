import { AlertTriangle, LogOut, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase"; // パスは環境に合わせて調整してください

export default function AdminBanner() {
    const isImpersonating = localStorage.getItem('proofmark_impersonating') === 'true';
    const adminEmail = localStorage.getItem('admin_email');

    if (!isImpersonating) return null;

    const handleExit = async () => {
        // 代理ログイン終了：フラグを消してログアウト
        localStorage.removeItem('proofmark_impersonating');
        localStorage.removeItem('admin_email');
        await supabase.auth.signOut();
        window.location.href = '/auth';
    };

    return (
        <div className="fixed top-0 left-0 w-full z-[9999] bg-red-600 text-white py-2 px-4 shadow-2xl flex items-center justify-between border-b-2 border-white/20 animate-pulse-slow">
            <div className="flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 animate-bounce" />
                <div className="text-xs md:text-sm font-black tracking-tighter uppercase">
                    <span className="opacity-80">Impersonation Mode:</span>
                    <span className="ml-2 text-yellow-300 underline decoration-2 offset-2">Admin[{adminEmail}]</span>
                    <span className="mx-2">is operating this account.</span>
                </div>
            </div>

            <button
                onClick={handleExit}
                className="bg-white text-red-600 hover:bg-red-50 px-4 py-1.5 rounded-full text-xs font-black transition-all shadow-lg flex items-center gap-2"
            >
                <LogOut className="w-3.5 h-3.5" /> EXIT & RETURN
            </button>
        </div>
    );
}