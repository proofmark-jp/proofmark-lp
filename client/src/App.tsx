import { useEffect } from 'react';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
// 変更箇所: useAuth の代わりに AuthProvider をインポート
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
import Faq from "./pages/Faq";
import WhatItProves from "./pages/WhatItProves";
import Footer from "./components/Footer";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
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
      <Route path="/u/:username" component={PublicProfile} />
      <Route path="/blog" component={BlogIndex} />
      <Route path="/blog/copyright" component={ArticleCopyright} />
      <Route path="/blog/monetization" component={ArticleMonetization} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        {/* 追加箇所: アプリ全体を AuthProvider でラップする */}
        <AuthProvider>
          <TooltipProvider>
            <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
              <Toaster />
              <Router />
              <Footer />
            </div>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;