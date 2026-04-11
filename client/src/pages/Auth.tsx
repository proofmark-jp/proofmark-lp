import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { 
  Zap, 
  Lock, 
  CheckCircle2, 
  ArrowLeft,
  Sparkles,
  ChevronRight,
  Mail,
  User as UserIcon
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import navbarLogo from '../assets/logo/navbar/proofmark-navbar-symbol-dark.svg';

const AssetCounter = () => {
  const [targetNumber, setTargetNumber] = useState(124);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const { data } = await supabase
          .from('stat_counters')
          .select('stat_value')
          .eq('stat_name', 'total_profiles')
          .single();
        if (data) setTargetNumber(data.stat_value);
      } catch (err) {
        console.error("Failed to fetch count:", err);
      }
    };
    fetchCount();
  }, []);

  useEffect(() => {
    let start = 0;
    const duration = 1500; // 1.5秒でカウントアップ
    const increment = Math.max(1, Math.floor(targetNumber / (duration / 16)));

    const timer = setInterval(() => {
      start += increment;
      if (start >= targetNumber) {
        setCount(targetNumber);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [targetNumber]);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] tracking-widest text-gray-500 font-mono uppercase">
        Securing Creative Assets
      </span>
      <span className="text-xl text-white font-mono font-bold tracking-wider">
        {count}
      </span>
    </div>
  );
};

export default function Auth() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const queryMode = searchParams.get('mode');
  
  const [isLogin, setIsLogin] = useState(queryMode !== 'signup');
  const [isResetMode, setIsResetMode] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false); // ★ここが最優先
  
  const [username, setUsername] = useState(searchParams.get('username') || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  const { signIn, signUp, resetPassword, user, loading } = useAuth();
  const [, setLocation] = useLocation();

  // ★ PKCEフロー対応：SupabaseのAuthイベントを直接監視する
  useEffect(() => {
    let isMounted = true;

    // 1. まず現在のURLのクエリパラメータによる初期状態を設定（リカバリー以外）
    if (!isRecoveryMode) {
      setIsLogin(queryMode !== 'signup');
      setIsResetMode(false);
      if (searchParams.get('username')) {
        setUsername(searchParams.get('username') || "");
      }
    }

    // 2. Supabaseの認証イベントを監視（パスワードリセットリンクを踏んだ時）
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && isMounted) {
        setIsRecoveryMode(true);
        setIsLogin(false);
        setIsResetMode(false);
        toast.info("新しいパスワードを設定してください");
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [queryMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      if (isRecoveryMode) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
          setError(error.message);
          toast.error("パスワードの更新に失敗しました");
        } else {
          setSuccessMsg("パスワードを更新しました。ダッシュボードに移動します。");
          toast.success("パスワードを更新しました");
          setTimeout(() => setLocation("/dashboard"), 1500);
        }
      } else if (isResetMode) {
        const { error } = await resetPassword(email);
        if (error) {
          setError(error.message);
          toast.error("リセットメールの送信に失敗しました");
        } else {
          setSuccessMsg("パスワード再設定用のメールを送信しました。");
          toast.success("リセットメールを送信しました");
        }
      } else if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error.message);
          toast.error("ログインに失敗しました");
        } else {
          toast.success("おかえりなさい！");
          setLocation("/dashboard");
        }
      } else {
        const { error } = await signUp(email, password, username);
        if (error) {
          setError(error.message);
          toast.error("アカウント作成に失敗しました");
        } else {
          setSuccessMsg("確認メールを送信しました。メールを確認して有効化してください。");
          toast.success("確認メールを送信しました");
        }
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
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-[#07061A] font-sans selection:bg-[#6C3EF4]/30 selection:text-white transition-colors duration-500">
      
      {/* ── Branding Panel (Left/Top) ────────────────────────── */}
      <div className="hidden lg:flex relative overflow-hidden flex-col justify-between p-12 lg:p-16 xl:p-24 bg-gradient-to-br from-[#0D0B24] to-[#07061A]">
        {/* Abstract Background Noise/Blur */}
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#6C3EF4] opacity-10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[10%] left-[-5%] w-[300px] h-[300px] bg-[#00D4AA] opacity-10 blur-[100px] rounded-full pointer-events-none" />
        
        {/* Header Logo Component - Standardized with LP */}
        <div className="mb-12">
          <a href="/" className="flex items-center text-decoration-none group cursor-pointer w-fit inline-flex relative z-50 pointer-events-auto">
            <div className="relative">
              <div className="absolute inset-0 bg-[#00D4AA]/20 blur-lg rounded-full group-hover:bg-[#00D4AA]/40 transition-all opacity-0 group-hover:opacity-100" />
              <img src={navbarLogo} alt="ProofMark" className="h-10 w-auto relative z-10" />
            </div>
            <span className="font-['Syne'] text-3xl font-extrabold text-[#F0EFF8] tracking-tight ml-3">
              Proof<span className="text-[#00D4AA]">Mark</span>
            </span>
          </a>
        </div>
        
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
        
        {/* Footer Meta info - HONEST SOCIAL PROOF (Now AssetCounter) */}
        <div className="relative z-10">
          <AssetCounter />
        </div>
      </div>

      {/* ── Form Panel (Right/Bottom) ─────────────────────────── */}
      <div className="flex flex-col items-center justify-center p-8 lg:p-16 xl:p-24 relative overflow-hidden transition-all duration-300">
        
        {/* Back button for Reset Mode */}
        {isResetMode && (
          <button 
            onClick={() => { setIsResetMode(false); setError(null); setSuccessMsg(null); }}
            className="absolute top-8 left-8 lg:left-16 flex items-center gap-2 text-[#A8A0D8] hover:text-[#6C3EF4] transition-all font-bold text-sm z-50 pointer-events-auto"
          >
            <ArrowLeft className="w-4 h-4" /> 戻る
          </button>
        )}

        <div className="w-full max-w-md relative z-10">
          {/* Mobile Header Logo - Simplified and Unified */}
          <div className="flex items-center justify-center relative z-50 pointer-events-auto mb-10 md:hidden">
            <a href="/" className="flex items-center text-decoration-none group cursor-pointer hover:opacity-80 transition-opacity">
              <div className="relative">
                <div className="absolute inset-0 bg-[#00D4AA]/20 blur-lg rounded-full group-hover:bg-[#00D4AA]/40 transition-all opacity-0 group-hover:opacity-100" />
                <img src={navbarLogo} alt="ProofMark" className="h-7 w-auto relative z-10" />
              </div>
              <span className="font-['Syne'] text-xl font-extrabold text-[#F0EFF8] tracking-tight ml-2">
                Proof<span className="text-[#00D4AA]">Mark</span>
              </span>
            </a>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-black text-white mb-3 tracking-tight">
              {isRecoveryMode 
                ? "パスワードの再設定" 
                : isResetMode 
                  ? "パスワードを忘れた方" 
                  : isLogin 
                    ? "Welcome back" 
                    : "Create identity"}
            </h2>
            <p className="text-[#A8A0D8] text-sm font-medium">
              {isRecoveryMode
                ? "新しい強力なパスワードを入力して、アカウントを保護してください。"
                : isResetMode 
                  ? "登録したメールアドレスを入力してください。再設定用のリンクをお送りします。"
                  : isLogin 
                    ? "アカウントにログインして、作品の証明履歴を確認しましょう。" 
                    : "わずか30秒で、あなたのデジタル存在証明を始められます。"}
            </p>
          </div>

          {/* Tab Switcher - Only in Auth Mode */}
          {!isResetMode && !isRecoveryMode && (
            <div className="flex p-1.5 bg-[#0D0B24] border border-[#1C1A38] rounded-2xl mb-8">
              <button 
                onClick={() => { setIsLogin(true); setError(null); setIsResetMode(false); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${isLogin ? 'bg-[#1C1A38] text-white shadow-lg' : 'text-[#A8A0D8] hover:text-white'}`}
              >
                ログイン
              </button>
              <button 
                onClick={() => { setIsLogin(false); setError(null); setIsResetMode(false); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${!isLogin ? 'bg-[#1C1A38] text-white shadow-lg' : 'text-[#A8A0D8] hover:text-white'}`}
              >
                新規登録
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {isRecoveryMode ? (
              // 🔴 パスワード再設定（リカバリー）モード専用のUI
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-xs font-black text-[#A8A0D8] uppercase tracking-widest pl-1" htmlFor="newPassword">新しいパスワード</label>
                <div className="relative group">
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full bg-[#0D0B24]/50 border border-[#1C1A38] focus:border-[#6C3EF4]/50 rounded-2xl px-5 py-4 text-white placeholder-[#A8A0D8]/30 outline-none transition-all group-hover:border-[#1C1A38]/80"
                  />
                  <div className="text-[10px] text-[#A8A0D8]/50 mt-2 pl-1 leading-relaxed">
                    ※ セキュリティのため、6文字以上の新しいパスワードを入力してください。
                  </div>
                </div>
              </div>
            ) : (
              // 🔵 通常のログイン・新規登録・パスワード忘れモードのUI
              <>
                {!isLogin && !isResetMode && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-xs font-black text-[#A8A0D8] uppercase tracking-widest pl-1" htmlFor="username">ユーザー名（ID）</label>
                    <div className="relative group">
                      <input
                        id="username"
                        name="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                        placeholder="your_id"
                        required
                        className="w-full bg-[#0D0B24]/50 border border-[#1C1A38] focus:border-[#6C3EF4]/50 rounded-2xl px-5 py-4 text-white placeholder-[#A8A0D8]/30 outline-none transition-all group-hover:border-[#1C1A38]/80 capitalize-none"
                      />
                      <div className="text-[10px] text-[#A8A0D8]/50 mt-2 pl-1 leading-relaxed">
                        ※ 半角英数字、アンダースコア、ハイフンが使用可能です
                      </div>
                    </div>
                  </div>
                )}
                
                {/* メールアドレス入力（ログイン・新規登録・リセット共通） */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-[#A8A0D8] uppercase tracking-widest pl-1" htmlFor="email">メールアドレス</label>
                  <div className="relative group">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@email.com"
                      required
                      className="w-full bg-[#0D0B24]/50 border border-[#1C1A38] focus:border-[#6C3EF4]/50 rounded-2xl px-5 py-4 text-white placeholder-[#A8A0D8]/30 outline-none transition-all group-hover:border-[#1C1A38]/80"
                    />
                  </div>
                </div>

                {/* パスワード入力（ログイン・新規登録のみ。リセットモードでは非表示） */}
                {!isResetMode && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pl-1">
                      <label className="text-xs font-black text-[#A8A0D8] uppercase tracking-widest" htmlFor="password">パスワード</label>
                      {isLogin && (
                        <button 
                          type="button" 
                          onClick={() => { setIsResetMode(true); setError(null); setSuccessMsg(null); }}
                          className="text-[10px] font-bold text-[#6C3EF4] hover:text-[#8B61FF] transition-colors"
                        >
                          Forgot password?
                        </button>
                      )}
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
                )}
              </>
            )}

            {/* エラー・成功メッセージと送信ボタンは維持 */}
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
                {submitting 
                  ? "Processing..." 
                  : isRecoveryMode 
                    ? "パスワードを更新する" 
                    : isResetMode 
                      ? "リセットメールを送信" 
                      : isLogin 
                        ? "ログインする" 
                        : "無料でアカウントを作成"
                }
                {!submitting && <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
              </span>
            </button>
          </form>

          <p className="mt-10 text-center text-[10px] font-bold text-[#A8A0D8]/40 uppercase tracking-[0.2em] px-4 leading-relaxed">
            Protecting creative integrity with cryptographic proof.<br />
            © 2026 ProofMark
          </p>
        </div>
      </div>
    </div>
  );
}

