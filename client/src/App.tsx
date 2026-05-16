/**
 * App.tsx — Route-level Code Splitting
 *
 * 設計:
 *   1. ルーティングのページコンポーネントは全て React.lazy() で動的 import
 *   2. /  と /auth はファーストビュー必須なので "preloadable" な lazy にする
 *   3. /dashboard は認証直後に必ず来るので、useAuth で login=true になった
 *      タイミングで prefetch する (ホバーや遷移待ちをゼロにする)
 *   4. Suspense は Router の外側に置き、ヘッダー/フッターは即時表示で CLS=0
 *   5. ErrorBoundary を Suspense の更に外側に置き、chunk fetch 失敗もキャッチ
 *
 * 維持:
 *   - ScrollToTop / RouteGuard / 既存ロジックは完全に温存
 *   - MobileActionBar / ScrollToTopFab は重要度高なので static import のまま
 *     (どちらも数 KB で route gate のため遅延させると逆効果)
 */

import { Suspense, lazy, useEffect } from 'react';
import type { ComponentType } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { Route, Switch, useLocation } from 'wouter';

import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './hooks/useAuth';
import LoadingFallback from './components/LoadingFallback';

// 🔒 重要度高: モバイル CRO 部品はファーストペイントで必要
import MobileActionBar from './components/MobileActionBar';
import ScrollToTopFab from './components/ScrollToTopFab';

// =============================================================================
//  Lazy Route Components
//  - import 文に webpackChunkName 代わりの何かは不要 (Vite が name を推論)
//  - 一部はモジュール参照を変数化して prefetch() に再利用する
// =============================================================================

// ── critical (LP / auth) ─────────────────────────────────────────────────
const Home = lazy(() => import('./pages/Home'));
const Auth = lazy(() => import('./pages/Auth'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// ── post-login (auth 後に必ず必要) ───────────────────────────────────────
const importDashboard = () => import('./pages/Dashboard.studio');
const DashboardStudio = lazy(importDashboard);

// ── public marketing pages ──────────────────────────────────────────────
const Pricing = lazy(() => import('./pages/Pricing'));
const Business = lazy(() => import('./pages/Business'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const Faq = lazy(() => import('./pages/Faq'));
const WhatItProves = lazy(() => import('./pages/WhatItProves'));
const CompareC2PA = lazy(() => import('./pages/CompareC2PA'));
const LegalResources = lazy(() => import('./pages/LegalResources'));
const TrustCenter = lazy(() => import('./pages/TrustCenter'));
const Contact = lazy(() => import('./pages/Contact'));

// ── articles / blog ─────────────────────────────────────────────────────
const BlogIndex = lazy(() => import('./pages/BlogIndex'));
const ArticleCopyright = lazy(() => import('./pages/ArticleCopyright'));
const ArticleMonetization = lazy(() => import('./pages/ArticleMonetization'));

// ── certificate / profile ───────────────────────────────────────────────
const CertificatePage = lazy(() => import('./pages/CertificatePage'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const EmbedPortfolioPage = lazy(() => import('./pages/EmbedPortfolioPage'));

// ── settings ────────────────────────────────────────────────────────────
const Settings = lazy(() => import('./pages/Settings'));

// ── legal ───────────────────────────────────────────────────────────────
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Tokushoho = lazy(() => import('./pages/Tokushoho'));
const Security = lazy(() => import('./pages/Security'));

// ── ops ─────────────────────────────────────────────────────────────────
const SpotIssue = lazy(() => import('./pages/SpotIssue'));
const SpotIssueResult = lazy(() => import('./pages/SpotIssueResult'));
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'));

// ── admin (運営のみ。LP ユーザは絶対に読まないので最遅) ──────────────────
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminCertificates = lazy(() => import('./pages/admin/AdminCertificates'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminMonitor = lazy(() => import('./pages/admin/AdminMonitor'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminPlaceholder = lazy(() => import('./pages/admin/AdminPlaceholder'));

/* ─────────────────────────────────────────────
 *  Footer も lazy 化 (LP 以外では使わない場面も多い)
 * ───────────────────────────────────────────── */
const Footer = lazy(() => import('./components/Footer'));

// =============================================================================
//  Routing primitives — 既存ロジックは据え置き
// =============================================================================

function ScrollToTop(): null {
  const [location] = useLocation();
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash;
    if (hash) {
      let attempts = 0;
      const checkExist = window.setInterval(() => {
        const id = hash.substring(1);
        const element = document.getElementById(id);
        if (element) {
          const y = element.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top: y, behavior: 'smooth' });
          window.clearInterval(checkExist);
        }
        if (++attempts >= 10) window.clearInterval(checkExist);
      }, 100);
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [location]);
  return null;
}

function RouteGuard(): null {
  const [location, navigate] = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (location === '/dashboard' && !user) {
      navigate('/auth?redirect=/dashboard', { replace: true });
      return;
    }
    if (location === '/' && user) {
      navigate('/dashboard', { replace: true });
      return;
    }
  }, [location, user, loading, navigate]);

  return null;
}

/**
 * Prefetcher — login 済みなら Dashboard chunk を先読みする。
 * これにより「ログイン直後の白画面」を実質ゼロにできる。
 */
function Prefetcher(): null {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    // requestIdleCallback フォールバック付きで、メインスレッド空き時に prefetch
    const schedule =
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 200);

    schedule(() => {
      void importDashboard().catch(() => {
        /* network失敗時は実遷移時に再 fetch される */
      });
    });
  }, [user, loading]);

  return null;
}

// =============================================================================
//  Router
// =============================================================================

function Router(): JSX.Element {
  return (
    <Switch>
      <Route path="/" component={Home as ComponentType} />
      <Route path="/pricing" component={Pricing as ComponentType} />
      <Route path="/business" component={Business as ComponentType} />
      <Route path="/cert/:id" component={CertificatePage as ComponentType} />
      <Route path="/auth" component={Auth as ComponentType} />
      <Route path="/dashboard" component={DashboardStudio as ComponentType} />
      <Route path="/settings" component={Settings as ComponentType} />
      <Route path="/terms" component={Terms as ComponentType} />
      <Route path="/privacy" component={Privacy as ComponentType} />
      <Route path="/tokushoho" component={Tokushoho as ComponentType} />
      <Route path="/security" component={Security as ComponentType} />
      <Route path="/faq" component={Faq as ComponentType} />
      <Route path="/what-it-proves" component={WhatItProves as ComponentType} />
      <Route path="/how-it-works" component={HowItWorks as ComponentType} />
      <Route path="/compare-c2pa" component={CompareC2PA as ComponentType} />
      <Route path="/legal-resources" component={LegalResources as ComponentType} />
      <Route path="/trust-center" component={TrustCenter as ComponentType} />
      <Route path="/u/:username" component={PublicProfile as ComponentType} />
      <Route path="/embed/:username" component={EmbedPortfolioPage as ComponentType} />
      <Route path="/blog" component={BlogIndex as ComponentType} />
      <Route path="/blog/copyright" component={ArticleCopyright as ComponentType} />
      <Route path="/blog/monetization" component={ArticleMonetization as ComponentType} />
      <Route path="/spot-issue" component={SpotIssue as ComponentType} />
      <Route path="/spot-issue/result" component={SpotIssueResult as ComponentType} />
      <Route path="/contact" component={Contact as ComponentType} />
      <Route path="/invite" component={AcceptInvite as ComponentType} />
      <Route path="/admin" component={AdminDashboard as ComponentType} />
      <Route path="/admin/certificates" component={AdminCertificates as ComponentType} />
      <Route path="/admin/users" component={AdminUsers as ComponentType} />
      <Route path="/admin/monitor" component={AdminMonitor as ComponentType} />
      <Route path="/admin/settings" component={AdminSettings as ComponentType} />
      <Route path="/admin/placeholder" component={AdminPlaceholder as ComponentType} />
      <Route path="/404" component={NotFound as ComponentType} />
      <Route component={NotFound as ComponentType} />
    </Switch>
  );
}

// =============================================================================
//  Shell
// =============================================================================

function AppShell(): JSX.Element {
  const [location] = useLocation();
  const isEmbedRoute = location.startsWith('/embed/');
  const hideFooter = isEmbedRoute || location === '/dashboard';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ScrollToTop />
      <RouteGuard />
      <Prefetcher />
      <Toaster />

      {/*
        Suspense は Router を丸ごとラップする。
        各ページ chunk のロード中は LoadingFallback がページ部分のみを覆い、
        Toaster / MobileActionBar はそのまま表示される。
      */}
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback variant="page" label="route" />}>
          <Router />
        </Suspense>
      </ErrorBoundary>

      {!hideFooter ? (
        <Suspense fallback={<LoadingFallback variant="minimal" label="footer" />}>
          <Footer />
        </Suspense>
      ) : null}

      {/* Mobile CRO: 数 KB の小型 chunk のためここは static import のまま */}
      <ScrollToTopFab />
      <MobileActionBar />
    </div>
  );
}

function App(): JSX.Element {
  return (
    <HelmetProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <TooltipProvider>
              <AppShell />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </HelmetProvider>
  );
}

export default App;
