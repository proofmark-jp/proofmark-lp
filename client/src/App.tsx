/**
 * App.tsx — Mobile CRO Upgrade
 *
 * 変更点:
 *   1. <MobileActionBar /> をマウント（モバイル下部固定 CTA）。
 *   2. <ScrollToTopFab />  をマウント（FAB / 全デバイス）。
 *   3. ScrollToTop / RouteGuard / Routing 定義は **完全に据え置き**。
 *
 * ルート別表示制御は usePMRoute フックに集約しているため、
 * App.tsx 自身に分岐ロジックを足さない（責務の単純さを維持）。
 */

import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/NotFound';
import { Route, Switch, useLocation } from 'wouter';
import { useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Home from './pages/Home';
import CertificatePage from './pages/CertificatePage';
import Auth from './pages/Auth';
import DashboardStudio from './pages/Dashboard.studio';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Tokushoho from './pages/Tokushoho';
import Security from './pages/Security';
import BlogIndex from './pages/BlogIndex';
import Settings from './pages/Settings';
import ArticleCopyright from './pages/ArticleCopyright';
import ArticleMonetization from './pages/ArticleMonetization';
import PublicProfile from './pages/PublicProfile';
import EmbedPortfolioPage from './pages/EmbedPortfolioPage';
import Faq from './pages/Faq';
import WhatItProves from './pages/WhatItProves';
import HowItWorks from './pages/HowItWorks';
import CompareC2PA from './pages/CompareC2PA';
import Footer from './components/Footer';
import Pricing from './pages/Pricing';
import Business from './pages/Business';
import LegalResources from './pages/LegalResources';
import TrustCenter from './pages/TrustCenter';
import SpotIssue from './pages/SpotIssue';
import SpotIssueResult from './pages/SpotIssueResult';
import Contact from './pages/Contact';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminPlaceholder from './pages/admin/AdminPlaceholder';
import AdminCertificates from './pages/admin/AdminCertificates';
import AdminUsers from './pages/admin/AdminUsers';
import AdminMonitor from './pages/admin/AdminMonitor';
import AdminSettings from './pages/admin/AdminSettings';
import AcceptInvite from './pages/AcceptInvite';

// 🆕 Mobile CRO upgrade
import MobileActionBar from './components/MobileActionBar';
import ScrollToTopFab from './components/ScrollToTopFab';

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash;
    if (hash) {
      let attempts = 0;
      const checkExist = setInterval(() => {
        const id = hash.substring(1);
        const element = document.getElementById(id);
        if (element) {
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

function RouteGuard() {
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/business" component={Business} />
      <Route path="/cert/:id" component={CertificatePage} />
      <Route path="/auth" component={Auth} />
      <Route path="/dashboard" component={DashboardStudio} />
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
  const hideFooter = isEmbedRoute || location === '/dashboard';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ScrollToTop />
      <RouteGuard />
      <Toaster />
      <Router />
      {!hideFooter ? <Footer /> : null}

      {/* 🆕 Mobile CRO: 表示制御は usePMRoute 内で完結 */}
      <ScrollToTopFab />
      <MobileActionBar />
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
