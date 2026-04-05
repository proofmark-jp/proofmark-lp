import { Link } from 'wouter';
import { LogOut, LayoutDashboard, Image as ImageIcon, Settings } from 'lucide-react';
import navbarLogo from '../assets/logo/navbar/proofmark-navbar-symbol-dark.svg';
import { useAuth } from '../hooks/useAuth';

export default function Navbar({ user, signOut }: { user: any, signOut: () => void }) {
  const displayUsername = user?.user_metadata?.username || user?.email?.split('@')[0] || 'sinn';

  return (
    <div className="w-full border-b border-[#1C1A38] bg-[#0D0B24]/90 backdrop-blur-xl sticky top-0 z-50 no-print">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 text-decoration-none">
          <img src={navbarLogo} alt="ProofMark" className="h-6 w-auto" />
          <span className="font-['Syne'] text-lg font-extrabold text-[#F0EFF8]">
            Proof<span className="text-[#00D4AA]">Mark</span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-5">
          {user ? (
            <>
              <Link href="/dashboard">
                <span className="flex items-center gap-1.5 text-sm font-bold text-[#A8A0D8] hover:text-white transition-colors cursor-pointer whitespace-nowrap">
                  <LayoutDashboard className="w-4 h-4" /> <span className="hidden sm:inline">管理画面</span>
                </span>
              </Link>
              <Link href={`/u/${displayUsername}`}>
                <span className="flex items-center gap-1.5 text-sm font-bold text-[#00D4AA] hover:text-white transition-colors cursor-pointer whitespace-nowrap">
                  <ImageIcon className="w-4 h-4" /> <span className="hidden sm:inline">公開ギャラリー</span>
                </span>
              </Link>
              <Link href="/settings">
                <span className="flex items-center gap-1.5 text-sm font-bold text-[#A8A0D8] hover:text-white transition-colors cursor-pointer whitespace-nowrap">
                  <Settings className="w-4 h-4" /> <span className="hidden sm:inline">設定</span>
                </span>
              </Link>
              <button onClick={signOut} className="flex items-center gap-1.5 text-sm text-[#A8A0D8] hover:text-white transition-colors whitespace-nowrap">
                <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">ログアウト</span>
              </button>
            </>
          ) : (
            <>
              <Link href="/auth">
                <span className="text-sm font-bold text-[#A8A0D8] hover:text-white transition-colors cursor-pointer whitespace-nowrap">ログイン</span>
              </Link>
              <Link href="/auth">
                <button className="bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold shadow-[0_0_15px_rgba(108,62,244,0.3)] hover:scale-105 transition-all whitespace-nowrap">
                  無料で始める
                </button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
