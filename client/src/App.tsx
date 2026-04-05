import { useEffect } from 'react';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./hooks/useAuth";
import Home from "./pages/Home";
import CertificatePage from './pages/CertificatePage';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Terms from "./pages/TermsPage";
import Privacy from "./pages/PrivacyPage";
import Security from "./pages/Security";
import BlogIndex from "./pages/BlogIndex";
import Settings from "./pages/Settings";
import ArticleCopyright from "./pages/ArticleCopyright";
import ArticleMonetization from "./pages/ArticleMonetization";
import PublicProfile from "./pages/PublicProfile";
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
      <Route path="/security" component={Security} />

      {/* Public Profile Routes */}
      <Route path="/u/:username" component={PublicProfile} />

      {/* Blog Routes */}
      <Route path="/blog" component={BlogIndex} />
      <Route path="/blog/copyright" component={ArticleCopyright} />
      <Route path="/blog/monetization" component={ArticleMonetization} />

      <Route path="/404" component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const { user } = useAuth(); // ← Appのレンダリング時にセッションを復元・監視させる

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <TooltipProvider>
          <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            <Toaster />
            <Router />
            <Footer />
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;