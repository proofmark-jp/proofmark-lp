import { ReactNode, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '../../hooks/useAuth';
import { LayoutDashboard, Users, Activity, Settings, LogOut, FileText } from 'lucide-react';
// ロゴのパスは既存のNavbarに合わせています
import navbarLogo from '../../assets/logo/navbar/proofmark-navbar-symbol-dark.svg';

interface AdminLayoutProps {
    children: ReactNode;
    title: string;
}

export default function AdminLayout({ children, title }: AdminLayoutProps) {
    const { user, loading, signOut } = useAuth();
    const [location, navigate] = useLocation();

    useEffect(() => {
        // 開発用：現在のユーザーデータの中身をコンソールで確認できるようにします
        console.log("Current User Data:", user);

        // 💡 修正ポイント：判定条件を「ユーザー名が 'sinn'」または「メールアドレスに ogurishinya が含まれる」に変更
        const isAdmin =
            user?.user_metadata?.username === 'sinn' ||
            user?.email?.includes('ogurishinya') ||
            user?.user_metadata?.is_founder === true;

        if (!loading && (!user || !isAdmin)) {
            navigate('/dashboard'); // 権限がない場合は一般ダッシュボードへ弾く
        }
    }, [user, loading, navigate]);

    if (loading || !user) {
        return <div className="min-h-screen bg-[#07061A] flex items-center justify-center"><div className="w-8 h-8 border-4 border-[#6C3EF4] border-t-transparent rounded-full animate-spin" /></div>;
    }

    const navItems = [
        { name: 'Overview', path: '/admin', icon: LayoutDashboard },
        { name: 'Certificates', path: '/admin/certificates', icon: FileText },
        { name: 'Users', path: '/admin/users', icon: Users },
        { name: 'System Monitor', path: '/admin/monitor', icon: Activity },
        { name: 'Settings', path: '/admin/settings', icon: Settings },
    ];

    return (
        <div className="flex h-screen bg-[#07061A] text-[#F0EFF8] overflow-hidden font-sans">
            {/* サイドバー */}
            <aside className="w-64 bg-[#0D0B24] border-r border-[#1C1A38] flex flex-col h-full shrink-0 relative z-20">
                <div className="h-16 flex items-center px-6 border-b border-[#1C1A38]">
                    <Link href="/" className="flex items-center gap-3 text-decoration-none group">
                        <img src="/spa/logo.svg" alt="ProofMark" className="h-6 w-auto" />
                        <span className="font-['Syne'] text-lg font-extrabold tracking-tight">
                            Admin<span className="text-[#00D4AA]">Center</span>
                        </span>
                    </Link>
                </div>

                <nav className="flex-1 py-6 px-4 flex flex-col gap-2 overflow-y-auto">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location === item.path;
                        return (
                            <Link key={item.name} href={item.path}>
                                <span className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${isActive
                                    ? 'bg-[#6C3EF4]/20 text-[#00D4AA] border border-[#6C3EF4]/30'
                                    : 'text-[#A8A0D8] hover:text-white hover:bg-white/5 border border-transparent'
                                    }`}>
                                    <Icon className="w-5 h-5" />
                                    {item.name}
                                </span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-[#1C1A38]">
                    <button
                        onClick={signOut}
                        className="flex items-center justify-center w-full gap-2 px-4 py-3 text-sm font-bold text-[#A8A0D8] hover:text-[#FF4D4D] transition-all hover:bg-[#FF4D4D]/10 rounded-xl"
                    >
                        <LogOut className="w-4 h-4" /> Exit Admin
                    </button>
                </div>
            </aside>

            {/* メインコンテンツエリア */}
            <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#07061A] relative z-10">
                <header className="h-16 flex items-center px-8 border-b border-[#1C1A38] bg-[#07061A]/80 backdrop-blur-md shrink-0">
                    <h1 className="text-xl font-black tracking-tight">{title}</h1>
                </header>
                <div className="flex-1 overflow-auto p-8 relative">
                    {/* 背景のグロー効果 */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#6C3EF4]/10 blur-[120px] rounded-full pointer-events-none opacity-50" />
                    <div className="relative z-10 max-w-6xl mx-auto">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}