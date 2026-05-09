/**
 * App.tsx — Phase 1 完全分離モデル (LP / App ルーティング)
 *
 * 変更ポイント (Task A):
 *   1. <RouteGuard /> を導入し、未ログイン時に /dashboard を /auth へリダイレクト。
 *   2. ログイン済みユーザーが / (LP) にアクセスした場合は /dashboard へ強制遷移。
 *      → 既存ユーザーにマーケティング LP を再提示しない (世界基準のSaaSの作法)。
 *   3. 既存の Route 定義・コンポーネント import は **1 行も削除しない**。
 *      認証ロジック (useAuth) と API 呼び出しには一切触れない。
 *
 * 注意:
 *   - useAuth() の `loading` フラグが false になるまでリダイレクト判定を遅延し、
 *     チラつきと「未ログイン誤判定 → 即 /auth」を防止する。
 *   - /auth, /spot-issue, /cert/:id, /u/:username, /embed/:username,
 *     /trust-center, /pricing, /how-it-works, /compare-c2pa, /legal-resources,
 *     /faq, /what-it-proves, /terms, /privacy, /tokushoho, /security, /contact,
 *     /blog 系, /invite, /admin/*, /404 は **どちらの状態でも自由にアクセス可能**。
 *     LP/App リダイレクトの対象は「/」と「/dashboard」だけに限定する。
 */

import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Home from "./pages/Home";
import CertificatePage from './pages/CertificatePage';
import Auth from './pages/Auth';
import DashboardObsidian from './pages/Dashboard.obsidian';
// import Dashboard from './pages/Dashboard';
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Tokushoho from "./pages/Tokushoho";
import Security from "./pages/Security";
import BlogIndex from "./pages/BlogIndex";
import Settings from "./pages/Settings";
import ArticleCopyright from "./pages/ArticleCopyright";
import ArticleMonetization from "./pages/ArticleMonetization";
import PublicProfile from "./pages/PublicProfile";
import EmbedPortfolioPage from "./pages/EmbedPortfolioPage";
import Faq from "./pages/Faq";
import WhatItProves from "./pages/WhatItProves";
import HowItWorks from "./pages/HowItWorks";
import CompareC2PA from "./pages/CompareC2PA";
import Footer from "./components/Footer";
import Pricing from "./pages/Pricing";
import Business from "./pages/Business";
import LegalResources from "./pages/LegalResources";
import TrustCenter from "./pages/TrustCenter";
import SpotIssue from "./pages/SpotIssue";
import SpotIssueResult from "./pages/SpotIssueResult";
import Contact from "./pages/Contact";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminPlaceholder from "./pages/admin/AdminPlaceholder";
import AdminCertificates from "./pages/admin/AdminCertificates";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminMonitor from "./pages/admin/AdminMonitor";
import AdminSettings from "./pages/admin/AdminSettings";
import AcceptInvite from "./pages/AcceptInvite";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash;
    if (hash) {
      // DOMの描画完了を待つリトライ機構（最大10回、1秒間探す）
      let attempts = 0;
      const checkExist = setInterval(() => {
        const id = hash.substring(1);
        const element = document.getElementById(id);
        if (element) {
          // Navbarの高さ（約80px）を考慮してスクロール位置を上にズラす
          const y = element.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top: y, behavior: 'smooth' });
          clearInterval(checkExist);
        }
        if (++attempts >= 10) clearInterval(checkExist);
      }, 100);
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [location]);
  return null;
}

/**
 * RouteGuard — Task A の核 (LP / App 完全分離)
 *
 *  - useAuth は loading を返す前提。loading 中は何もしない (チラつき防止)。
 *  - /         : 未ログイン → そのまま LP / ログイン済み → /dashboard へ
 *  - /dashboard: 未ログイン → /auth へ      / ログイン済み → そのまま
 *  - その他   : 干渉しない
 */
function RouteGuard() {
  const [location, navigate] = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    // /dashboard は未ログインなら /auth へ
    if (location === '/dashboard' && !user) {
      navigate('/auth?redirect=/dashboard', { replace: true });
      return;
    }

    // / (LP ルート) はログイン済みなら /dashboard へ
    // hash や query を保持する必要はない (LP は静的)
    if (location === '/' && user) {
      navigate('/dashboard', { replace: true });
      return;
    }
  }, [location, user, loading, navigate]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/business" component={Business} />
      <Route path="/cert/:id" component={CertificatePage} />
      <Route path="/auth" component={Auth} />
      <Route path="/dashboard" component={DashboardObsidian} />
      <Route path="/settings" component={Settings} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/tokushoho" component={Tokushoho} />
      <Route path="/security" component={Security} />
      <Route path="/faq" component={Faq} />
      <Route path="/what-it-proves" component={WhatItProves} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/compare-c2pa" component={CompareC2PA} />
      <Route path="/legal-resources" component={LegalResources} />
      <Route path="/trust-center" component={TrustCenter} />
      <Route path="/u/:username" component={PublicProfile} />
      <Route path="/embed/:username" component={EmbedPortfolioPage} />
      <Route path="/blog" component={BlogIndex} />
      <Route path="/blog/copyright" component={ArticleCopyright} />
      <Route path="/blog/monetization" component={ArticleMonetization} />
      <Route path="/spot-issue" component={SpotIssue} />
      <Route path="/spot-issue/result" component={SpotIssueResult} />
      <Route path="/contact" component={Contact} />
      <Route path="/invite" component={AcceptInvite} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/certificates" component={AdminCertificates} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/monitor" component={AdminMonitor} />
      <Route path="/admin/settings" component={AdminSettings} />
      <Route path="/admin/placeholder" component={AdminPlaceholder} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const [location] = useLocation();
  const isEmbedRoute = location.startsWith('/embed/');
  // /dashboard は「静寂な作業空間」のため Footer を表示しない (仕様書 §3)
  const hideFooter = isEmbedRoute || location === '/dashboard';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ScrollToTop />
      <RouteGuard />
      <Toaster />
      <Router />
      {!hideFooter ? <Footer /> : null}
    </div>
  );
}

function App() {
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
