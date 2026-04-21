import { useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./hooks/useAuth";
import Home from "./pages/Home";
import CertificatePage from './pages/CertificatePage';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
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
import LegalResources from "./pages/LegalResources";
import TrustCenter from "./pages/TrustCenter";
// ▼ ここに追加：管理画面用コンポーネントのインポート
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminPlaceholder from "./pages/admin/AdminPlaceholder";
import AdminCertificates from "./pages/admin/AdminCertificates";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminMonitor from "./pages/admin/AdminMonitor";
import AdminSettings from "./pages/admin/AdminSettings";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/cert/:id" component={CertificatePage} />
      <Route path="/auth" component={Auth} />
      <Route path="/dashboard" component={Dashboard} />
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
      {/* ▼ ここに追加：管理画面のルーティング */}
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/certificates" component={AdminCertificates} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/monitor" component={AdminMonitor} />
      <Route path="/admin/settings" component={AdminSettings} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [location] = useLocation();
  const isEmbedRoute = location.startsWith('/embed/');

  return (
    <HelmetProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <TooltipProvider>
              <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
                <Toaster />
                <Router />
                {!isEmbedRoute ? <Footer /> : null}
              </div>
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </HelmetProvider>
  );
}

export default App;