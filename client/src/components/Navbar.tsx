import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  LogOut, 
  LayoutDashboard, 
  Image as ImageIcon, 
  Settings, 
  Menu, 
  X, 
  FileText, 
  Shield, 
  Info,
  ExternalLink,
  Zap,
  Scale,
  CreditCard
} from 'lucide-react';
import navbarLogo from '../assets/logo/navbar/proofmark-navbar-symbol-dark.svg';
import { useAuth } from '../hooks/useAuth';

export default function Navbar({ user, signOut }: { user: any, signOut: () => void }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [location] = useLocation();
  const displayUsername = user?.user_metadata?.username || user?.email?.split('@')[0] || 'sinn';

  const closeMenu = () => setIsMenuOpen(false);

  const NavLink = ({ href, children, icon: Icon, active, onClick }: any) => (
    <Link href={href}>
      <span 
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap
          ${active 
            ? 'bg-[#6C3EF4]/10 text-[#00D4AA] border border-[#6C3EF4]/30' 
            : 'text-[#A8A0D8] hover:text-white hover:bg-white/5 border border-transparent'
          }`}
      >
        {Icon && <Icon className="w-4 h-4" />}
        {children}
      </span>
    </Link>
  );

  return (
    <nav className="w-full border-b border-[#1C1A38] bg-[#0D0B24]/80 backdrop-blur-md sticky top-0 z-50 no-print transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 sm:gap-3 text-decoration-none group">
          <div className="relative">
            <div className="absolute inset-0 bg-[#00D4AA]/20 blur-lg rounded-full group-hover:bg-[#00D4AA]/40 transition-all opacity-0 group-hover:opacity-100" />
            <img src={navbarLogo} alt="ProofMark" className="h-7 w-auto relative z-10" />
          </div>
          <span className="font-['Syne'] text-xl font-extrabold text-[#F0EFF8] tracking-tight">
            Proof<span className="text-[#00D4AA]">Mark</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-4 mr-auto ml-8">
          <Link href="/how-it-works">
            <span className={`text-sm font-bold transition-all cursor-pointer ${location === '/how-it-works' ? 'text-[#00D4AA]' : 'text-[#A8A0D8] hover:text-white'}`}>仕組み</span>
          </Link>
          <Link href="/compare-c2pa">
            <span className={`text-sm font-bold transition-all cursor-pointer ${location === '/compare-c2pa' ? 'text-[#00D4AA]' : 'text-[#A8A0D8] hover:text-white'}`}>C2PA比較</span>
          </Link>
          <Link href="/pricing">
            <span className={`text-sm font-bold transition-all cursor-pointer ${location === '/pricing' ? 'text-[#00D4AA]' : 'text-[#A8A0D8] hover:text-white'}`}>料金プラン</span>
          </Link>
        </div>

        <div className="hidden lg:flex items-center gap-2">
          {user ? (
            <>
              <NavLink href="/dashboard" icon={LayoutDashboard} active={location === '/dashboard'}>管理画面</NavLink>
              <NavLink href={`/u/${displayUsername}`} icon={ImageIcon} active={location.startsWith('/u/')}>公開ギャラリー</NavLink>
              <NavLink href="/settings" icon={Settings} active={location === '/settings'}>設定</NavLink>
              <button 
                onClick={signOut}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#A8A0D8] hover:text-[#FF4D4D] transition-all hover:bg-[#FF4D4D]/10 rounded-xl"
              >
                <LogOut className="w-4 h-4" /> ログアウト
              </button>
            </>
          ) : (
            <div className="flex items-center gap-4">
              <Link href="/auth">
                <span className="text-sm font-bold text-[#A8A0D8] hover:text-white transition-colors cursor-pointer">ログイン</span>
              </Link>
              <Link href="/auth?mode=signup">
                <button className="bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-[0_0_20px_rgba(108,62,244,0.4)] hover:scale-105 transition-all">
                  無料で始める
                </button>
              </Link>
            </div>
          )}
        </div>

        {/* Tablet/Mobile Action & Hamburger */}
        <div className="flex items-center gap-2 lg:hidden">
          {user && (
            <Link href="/dashboard">
              <span className="w-10 h-10 flex items-center justify-center bg-[#6C3EF4]/10 rounded-xl text-[#00D4AA] border border-[#6C3EF4]/30">
                <LayoutDashboard className="w-5 h-5" />
              </span>
            </Link>
          )}
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-10 h-10 flex items-center justify-center bg-[#1C1A38]/50 rounded-xl text-white border border-[#1C1A38] hover:bg-[#1C1A38] transition-all"
          >
            {isMenuOpen ? <X className="w-6 h-6 text-[#00D4AA]" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full bg-[#0D0B24]/95 backdrop-blur-2xl border-b border-[#1C1A38] p-6 shadow-2xl animate-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col gap-6">
            {user ? (
              <div className="grid grid-cols-1 gap-2">
                <p className="text-[10px] font-black text-[#6C3EF4] tracking-[0.2em] uppercase mb-1">Navigation</p>
                <NavLink href="/dashboard" icon={LayoutDashboard} active={location === '/dashboard'} onClick={closeMenu}>管理画面</NavLink>
                <NavLink href={`/u/${displayUsername}`} icon={ImageIcon} active={location.startsWith('/u/')} onClick={closeMenu}>公開ギャラリー</NavLink>
                <NavLink href="/settings" icon={Settings} active={location === '/settings'} onClick={closeMenu}>プロフィール設定</NavLink>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Link href="/auth?mode=signup">
                  <button onClick={closeMenu} className="w-full bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] text-white py-4 rounded-2xl font-bold">無料で始める</button>
                </Link>
                <Link href="/auth">
                  <button onClick={closeMenu} className="w-full py-4 text-[#A8A0D8] font-bold">既にアカウントをお持ちの方</button>
                </Link>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2">
              <p className="text-[10px] font-black text-[#6C3EF4] tracking-[0.2em] uppercase mb-1">Resources</p>
              <Link href="/how-it-works">
                <span onClick={closeMenu} className="flex items-center gap-3 p-4 hover:bg-white/5 rounded-2xl transition-all">
                  <Zap className="w-5 h-5 text-[#ffd966]" />
                  <span className="text-sm font-bold text-[#A8A0D8]">ProofMarkの仕組み</span>
                </span>
              </Link>
              <Link href="/compare-c2pa">
                <span onClick={closeMenu} className="flex items-center gap-3 p-4 hover:bg-white/5 rounded-2xl transition-all">
                  <Scale className="w-5 h-5 text-[#00D4AA]" />
                  <span className="text-sm font-bold text-[#A8A0D8]">C2PAとの比較</span>
                </span>
              </Link>
              <Link href="/pricing">
                <span onClick={closeMenu} className="flex items-center gap-3 p-4 hover:bg-white/5 rounded-2xl transition-all">
                  <CreditCard className="w-5 h-5 text-[#6C3EF4]" />
                  <span className="text-sm font-bold text-[#A8A0D8]">料金プラン</span>
                </span>
              </Link>
              <Link href="/blog">
                <span onClick={closeMenu} className="flex items-center justify-between p-4 bg-[#151D2F] border border-[#2a2a4e] rounded-2xl group active:scale-95 transition-all">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-[#00D4AA]" />
                    <span className="text-sm font-bold text-white">公式ブログ</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#A8A0D8] group-hover:text-[#00D4AA] transition-colors" />
                </span>
              </Link>
              <Link href="/terms">
                <span onClick={closeMenu} className="flex items-center gap-3 p-4 hover:bg-white/5 rounded-2xl transition-all">
                  <Shield className="w-5 h-5 text-[#A8A0D8]" />
                  <span className="text-sm font-bold text-[#A8A0D8]">利用規約・プライバシー</span>
                </span>
              </Link>
            </div>

            {user && (
              <button 
                onClick={() => { signOut(); closeMenu(); }}
                className="flex items-center justify-center gap-2 p-4 text-[#FF4D4D] font-bold border border-[#FF4D4D]/20 rounded-2xl bg-[#FF4D4D]/5 active:scale-95 transition-all"
              >
                <LogOut className="w-4 h-4" /> ログアウト
              </button>
            )}

            <div className="text-center pt-4 border-t border-[#1C1A38] relative z-50 bg-[#0D0B24] py-4 -mx-6 mt-4">
              <p className="text-[10px] text-[#A8A0D8] flex items-center justify-center gap-1.5 font-bold">
                © 2026 ProofMark. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
