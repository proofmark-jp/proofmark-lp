/**
 * src/components/lp/Navbar.tsx — Phase 1 (Task C)
 *
 * 「世界基準のミニマル」を体現する LP 専用 Navbar。
 *
 * 設計原則 (仕様書 §2 / 0):
 *   1. 導線は 3 リンク + Primary CTA に厳格に制限。
 *      - 仕組み (/how-it-works)
 *      - 料金プラン (/pricing)
 *      - C2PA比較 (/compare-c2pa)
 *      + Primary CTA「無料で始める」 → /auth?mode=signup
 *   2. スクロール 12px 以上で Blur + 半透明背景に遷移 (`pm-navbar.is-scrolled`)。
 *      初期状態は背景透明 (Hero と一体化)。
 *   3. Mobile はハンバーガで開閉。Drawer 内も同じ 3 リンク + CTA に絞る。
 *   4. /dashboard 等の既存 App ページは従来の `components/Navbar.tsx` を使い続け、
 *      この LP Navbar は **Home.tsx からのみ import** される。
 *   5. 認証状態 (useAuth) は読み取り専用。state を変えない。
 *   6. lucide-react と framer-motion は既存依存。新規パッケージなし。
 */

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import navbarLogo from '../../assets/logo/navbar/proofmark-navbar-symbol-dark.svg';

interface NavLinkSpec {
  href: string;
  label: string;
}

const NAV_LINKS: ReadonlyArray<NavLinkSpec> = [
  { href: '/how-it-works', label: '仕組み' },
  { href: '/pricing', label: '料金プラン' },
  { href: '/compare-c2pa', label: 'C2PA比較' },
];

const SCROLL_THRESHOLD_PX = 12;

export default function LpNavbar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  /* スクロール判定 — passive listener でメインスレッドを止めない */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onScroll = () => {
      const y = window.scrollY || window.pageYOffset || 0;
      setScrolled(y > SCROLL_THRESHOLD_PX);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Drawer open 中は body スクロールロック */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  /* ESC で Drawer 閉じ */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => setOpen(false);

  /* ロゴクリック時のルーティング（トップに戻る） */
  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (location === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    close();
  };

  /* ログイン済みなら CTA は「ダッシュボードへ」 */
  const ctaHref = user ? '/dashboard' : '/auth?mode=signup';
  const ctaLabel = user ? 'ダッシュボードへ' : '無料で始める';

  return (
    <nav
      aria-label="グローバルナビゲーション"
      className={`pm-navbar ${scrolled ? 'is-scrolled' : ''}`}
      style={{ zIndex: 110 }}
    >
      <div className="pm-container flex h-[72px] items-center justify-between">
        <Link href="/" onClick={handleLogoClick} className="group inline-flex items-center gap-2">
          <div className="relative">
            <div className="absolute inset-0 bg-[#00D4AA]/20 blur-lg rounded-full group-hover:bg-[#00D4AA]/40 transition-all opacity-0 group-hover:opacity-100" />
            <img src={navbarLogo} alt="ProofMark" className="h-7 w-auto relative z-10" />
          </div>
          <span className="text-[17px] font-extrabold tracking-tight text-white">
            Proof<span style={{ color: '#00D4AA' }}>Mark</span>
          </span>
        </Link>

        {/* Desktop links — 3 つのみ */}
        <ul className="hidden items-center gap-9 md:flex" role="list">
          {NAV_LINKS.map((link) => {
            const active = location === link.href;
            return (
              <li key={link.href}>
                <Link href={link.href}>
                  <span
                    className="group relative inline-flex items-center text-[14px] font-semibold tracking-tight transition-colors"
                    style={{ color: active ? '#FFFFFF' : 'rgba(255,255,255,0.62)' }}
                  >
                    {link.label}
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-1 left-0 h-px w-full origin-left transition-transform duration-300"
                      style={{
                        background: 'linear-gradient(90deg, #6C3EF4, #00D4AA)',
                        transform: active ? 'scaleX(1)' : 'scaleX(0)',
                      }}
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Desktop CTA — Primary 1 つのみ */}
        <div className="hidden items-center gap-3 md:flex">
          {!user && (
            <Link href="/auth">
              <span className="text-[13px] font-semibold tracking-tight text-white/65 transition-colors hover:text-white">
                ログイン
              </span>
            </Link>
          )}
          <Link href={ctaHref}>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-5 py-[10px] text-[13px] font-bold tracking-tight text-white transition-transform duration-200"
              style={{
                background: '#6C3EF4',
                boxShadow: '0 10px 28px -10px rgba(108,62,244,0.65)',
              }}
            >
              {ctaLabel}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </Link>
        </div>

        {/* Mobile burger */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls="pm-mobile-drawer"
          aria-label={open ? 'メニューを閉じる' : 'メニューを開く'}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Drawer — 同じ 3 リンク + CTA */}
      <div
        id="pm-mobile-drawer"
        role="dialog"
        aria-modal="true"
        hidden={!open}
        className="md:hidden"
        style={{
          position: 'fixed',
          inset: '72px 0 0 0',
          zIndex: 100, // Z-index bug fix
          background: 'rgba(7,6,26,0.96)',
          backdropFilter: 'saturate(160%) blur(18px)',
          WebkitBackdropFilter: 'saturate(160%) blur(18px)',
          padding: '32px 24px 40px',
          display: open ? 'flex' : 'none',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <ul className="mt-4 flex flex-col gap-1" role="list">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href}>
                <span
                  onClick={close}
                  className="block rounded-2xl px-4 py-4 text-[18px] font-semibold tracking-tight text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                  {link.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-col gap-3">
          <Link href={ctaHref}>
            <span
              onClick={close}
              className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold text-white"
              style={{
                background: '#6C3EF4',
                boxShadow: '0 14px 32px -12px rgba(108,62,244,0.75)',
              }}
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </Link>
          {!user && (
            <Link href="/auth">
              <span
                onClick={close}
                className="block py-3 text-center text-[14px] font-semibold text-white/65"
              >
                ログイン
              </span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
