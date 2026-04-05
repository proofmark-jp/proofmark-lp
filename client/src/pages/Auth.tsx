import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { 
  ShieldCheck, 
  Zap, 
  Lock, 
  CheckCircle2, 
  ArrowLeft,
  Sparkles,
  ChevronRight
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export default function Auth() {
  const [location] = useLocation();
  const queryMode = new URLSearchParams(window.location.search).get('mode');
  const [isLogin, setIsLogin] = useState(queryMode !== 'signup');
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  const { signIn, signUp, user, loading } = useAuth();
  const [, navigate] = useLocation();

  // URLパラメータが変更されたらモードを同期
  useEffect(() => {
    setIsLogin(queryMode !== 'signup');
  }, [queryMode]);

  if (!loading && user) {
    navigate("/dashboard");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) setError(error.message);
        else navigate("/dashboard");
      } else {
        const { error } = await signUp(email, password);
        if (error) setError(error.message);
        else setSuccessMsg("確認メールを送信しました。メールを確認して有効化してください。");
      }
    } catch (err: any) {
      setError(err.message || "予期せぬエラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07061A] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#6C3EF4]/20 border-t-[#6C3EF4] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-[#07061A] font-sans selection:bg-[#6C3EF4]/30 selection:text-white">
      
      {/* ── Branding Panel (Left/Top) ────────────────────────── */}
      <div className="hidden lg:flex relative overflow-hidden flex-col justify-between p-12 lg:p-16 xl:p-24 bg-gradient-to-br from-[#0D0B24] to-[#07061A]">
        {/* Abstract Background Noise/Blur */}
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#6C3EF4] opacity-10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[10%] left-[-5%] w-[300px] h-[300px] bg-[#00D4AA] opacity-10 blur-[100px] rounded-full pointer-events-none" />
        
        {/* Header Logo Component */}
        <Link href="/" className="relative z-10 flex items-center gap-3 group transition-all hover:scale-105 active:scale-95 w-fit">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6C3EF4] to-[#8B61FF] flex items-center justify-center shadow-[0_8px_20px_rgba(108,62,244,0.3)] group-hover:shadow-[0_12px_30px_rgba(108,62,244,0.5)] transition-all">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-black text-white tracking-tighter">ProofMark</span>
        </Link>
        
        {/* Value Proposition Content */}
        <div className="relative z-10 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6C3EF4]/10 border border-[#6C3EF4]/20 text-[#00D4AA] text-[10px] font-bold tracking-widest uppercase mb-6">
            <Sparkles className="w-3 h-3" /> Digital Existence Proven
          </div>
          <h1 className="text-4xl lg:text-5xl xl:text-6xl font-black text-white leading-[1.1] mb-8 tracking-tight">
            あなたの創作を、<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6C3EF4] via-[#8B61FF] to-[#00D4AA]">一生消えない証拠</span>に。
          </h1>
          
          <div className="space-y-6">
            {[
              { icon: Zap, title: "即時証明", desc: "SHA-256ハッシュ計算により、作品のデジタル指紋を瞬時に確定。" },
              { icon: Lock, title: "プライバシー重視", desc: "画像データはブラウザ内で処理。運営すら原画を見られない安全設計。" },
              { icon: CheckCircle2, title: "法的有用性", desc: "改ざん不能なタイムスタンプが、あなたの『先取権』を裏付けます。" }
            ].map((item, i) => (
              <div key={i} className="flex gap-4 group">
                <div className="w-10 h-10 rounded-xl bg-[#1C1A38]/50 border border-[#2a2a4e] flex items-center justify-center flex-shrink-0 group-hover:border-[#6C3EF4]/50 transition-colors">
                  <item.icon className="w-5 h-5 text-[#A8A0D8] group-hover:text-[#6C3EF4] transition-colors" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base mb-1">{item.title}</h3>
                  <p className="text-[#A8A0D8] text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Footer Meta info */}
        <div className="relative z-10">
          <p className="text-[#A8A0D8]/40 text-xs font-mono tracking-widest uppercase mb-4">Trusted by 10,000+ AI Creators</p>
          <div className="flex -space-x-3">
             <div className="w-8 h-8 rounded-full border-2 border-[#07061A] bg-slate-800" />
             <div className="w-8 h-8 rounded-full border-2 border-[#07061A] bg-slate-700" />
             <div className="w-8 h-8 rounded-full border-2 border-[#07061A] bg-slate-600" />
             <div className="w-8 h-8 rounded-full border-2 border-[#07061A] bg-[#6C3EF4] flex items-center justify-center text-[10px] font-bold">+9k</div>
          </div>
        </div>
      </div>

      {/* ── Form Panel (Right/Bottom) ─────────────────────────── */}
      <div className="flex flex-col items-center justify-center p-8 lg:p-16 xl:p-24 relative">
        <Link href="/" className="lg:hidden absolute top-8 left-8 flex items-center gap-2 text-[#A8A0D8] hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Home
        </Link>

        <div className="w-full max-w-md">
          {/* Mobile Logo Only */}
          <div className="lg:hidden mb-12 flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl bg-[#6C3EF4] flex items-center justify-center mb-4 shadow-xl">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tighter">ProofMark</h2>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-black text-white mb-3 tracking-tight">
              {isLogin ? "Welcome back" : "Create identity"}
            </h2>
            <p className="text-[#A8A0D8] text-sm font-medium">
              {isLogin 
                ? "アカウントにログインして、作品の証明履歴を確認しましょう。" 
                : "わずか30秒で、あなたのデジタル存在証明を始められます。"}
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex p-1.5 bg-[#0D0B24] border border-[#1C1A38] rounded-2xl mb-8">
            <button 
              onClick={() => { setIsLogin(true); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${isLogin ? 'bg-[#1C1A38] text-white shadow-lg' : 'text-[#A8A0D8] hover:text-white'}`}
            >
              ログイン
            </button>
            <button 
              onClick={() => { setIsLogin(false); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${!isLogin ? 'bg-[#1C1A38] text-white shadow-lg' : 'text-[#A8A0D8] hover:text-white'}`}
            >
              新規登録
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-[#A8A0D8] uppercase tracking-widest pl-1" htmlFor="email">メールアドレス</label>
              <div className="relative group">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete={isLogin ? "username" : "email"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  required
                  className="w-full bg-[#0D0B24]/50 border border-[#1C1A38] focus:border-[#6C3EF4]/50 rounded-2xl px-5 py-4 text-white placeholder-[#A8A0D8]/30 outline-none transition-all group-hover:border-[#1C1A38]/80"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between pl-1">
                <label className="text-xs font-black text-[#A8A0D8] uppercase tracking-widest" htmlFor="password">パスワード</label>
                {isLogin && <button type="button" className="text-[10px] font-bold text-[#6C3EF4] hover:text-[#8B61FF] transition-colors">Forgot password?</button>}
              </div>
              <div className="relative group">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full bg-[#0D0B24]/50 border border-[#1C1A38] focus:border-[#6C3EF4]/50 rounded-2xl px-5 py-4 text-white placeholder-[#A8A0D8]/30 outline-none transition-all group-hover:border-[#1C1A38]/80"
                />
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex gap-3 animate-in fade-in slide-in-from-top-2">
                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5 text-white text-[10px] font-bold">!</div>
                <p className="text-red-500 text-xs font-bold leading-relaxed">{error}</p>
              </div>
            )}

            {successMsg && (
              <div className="p-4 rounded-2xl bg-[#00D4AA]/10 border border-[#00D4AA]/20 flex gap-3 animate-in fade-in slide-in-from-top-2">
                <CheckCircle2 className="w-5 h-5 text-[#00D4AA] flex-shrink-0 mt-0.5" />
                <p className="text-[#00D4AA] text-xs font-bold leading-relaxed">{successMsg}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full relative group overflow-hidden bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] disabled:opacity-50 disabled:cursor-not-allowed text-white py-5 rounded-2xl font-black tracking-tight shadow-[0_12px_30px_rgba(108,62,244,0.3)] hover:shadow-[0_15px_40px_rgba(108,62,244,0.5)] transition-all active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <span className="relative z-10 flex items-center justify-center gap-2">
                {submitting ? "Processing..." : isLogin ? "ログインする" : "無料でアカウントを作成"}
                {!submitting && <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
              </span>
            </button>
          </form>

          <p className="mt-10 text-center text-[10px] font-bold text-[#A8A0D8]/40 uppercase tracking-[0.2em] px-4 leading-relaxed">
            Protecting creative integrity with cryptographic proof.<br />
            © 2026 ProofMark - Certified by Manus
          </p>
        </div>
      </div>
    </div>
  );
}

