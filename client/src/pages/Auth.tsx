import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { 
  Zap, 
  Lock, 
  CheckCircle2, 
  Sparkles,
  ChevronRight,
  Fingerprint,
  Mail,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";

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
    const duration = 1500;
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
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading_magic' | 'loading_passkey' | 'success'>('idle');
  
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  // 認証済みならダッシュボードへ遷移
  useEffect(() => {
    if (user) {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  // 1. Magic Link 送信処理
  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setStatus('loading_magic');
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        setError(error.message);
        setStatus('idle');
        toast.error("ログインリンクの送信に失敗しました");
      } else {
        setStatus('success');
        toast.success("ログインリンクを送信しました");
      }
    } catch (err: any) {
      setError(err.message || "予期せぬエラーが発生しました");
      setStatus('idle');
    }
  };

  // 2. Passkey ログイン処理
  const handlePasskeyLogin = async () => {
    setStatus('loading_passkey');
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPasskey();

      if (error) {
        setError(error.message);
        setStatus('idle');
        toast.error("パスキー認証に失敗しました");
      }
      // 成功時は onAuthStateChange 等が検知して自動的にダッシュボードへリダイレクトされる
    } catch (err: any) {
      setError(err.message || "予期せぬエラーが発生しました");
      setStatus('idle');
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
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#6C3EF4] opacity-10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[10%] left-[-5%] w-[300px] h-[300px] bg-[#00D4AA] opacity-10 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="mb-12">
          <a href="/" className="flex items-center text-decoration-none group cursor-pointer w-fit inline-flex relative z-50 pointer-events-auto">
            <div className="relative">
              <div className="absolute inset-0 bg-[#00D4AA]/20 blur-lg rounded-full group-hover:bg-[#00D4AA]/40 transition-all opacity-0 group-hover:opacity-100" />
              <img src="/spa/logo.svg" alt="ProofMark" className="h-10 w-auto relative z-10" />
            </div>
            <span className="font-['Syne'] text-3xl font-extrabold text-[#F0EFF8] tracking-tight ml-3">
              Proof<span className="text-[#00D4AA]">Mark</span>
            </span>
          </a>
        </div>
        
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
        
        <div className="relative z-10">
          <AssetCounter />
        </div>
      </div>

      {/* ── Form Panel (Right/Bottom) ─────────────────────────── */}
      <div className="flex flex-col items-center justify-center p-8 lg:p-16 xl:p-24 relative overflow-hidden transition-all duration-300">
        
        <div className="w-full max-w-md relative z-10">
          <div className="flex items-center justify-center relative z-50 pointer-events-auto mb-10 md:hidden">
            <a href="/" className="flex items-center text-decoration-none group cursor-pointer hover:opacity-80 transition-opacity">
              <div className="relative">
                <div className="absolute inset-0 bg-[#00D4AA]/20 blur-lg rounded-full group-hover:bg-[#00D4AA]/40 transition-all opacity-0 group-hover:opacity-100" />
                <img src="/spa/logo.svg" alt="ProofMark" className="h-7 w-auto relative z-10" />
              </div>
              <span className="font-['Syne'] text-xl font-extrabold text-[#F0EFF8] tracking-tight ml-2">
                Proof<span className="text-[#00D4AA]">Mark</span>
              </span>
            </a>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-black text-white mb-3 tracking-tight">
              Create identity
            </h2>
            <p className="text-[#A8A0D8] text-sm font-medium">
              メールアドレス、またはパスキーで安全にログインしてください。パスワードは不要です。
            </p>
          </div>

          {status === 'success' ? (
            <div className="p-8 rounded-2xl bg-[#00D4AA]/10 border border-[#00D4AA]/20 flex flex-col items-center text-center animate-in fade-in slide-in-from-top-2">
              <Mail className="w-12 h-12 text-[#00D4AA] mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">リンクを送信しました</h3>
              <p className="text-[#A8A0D8] text-sm leading-relaxed">
                <strong>{email}</strong> 宛てにログイン用のリンクを送信しました。<br/>
                メール内のボタンをクリックしてログインを完了してください。
              </p>
              <button
                onClick={() => setStatus('idle')}
                className="mt-6 text-[12px] font-bold text-[#6C3EF4] hover:text-[#8B61FF] transition-colors"
              >
                別のアドレスを使用する
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* メイン: Magic Link フォーム */}
              <form onSubmit={handleMagicLinkLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-[#A8A0D8] uppercase tracking-widest pl-1" htmlFor="email">メールアドレス</label>
                  <div className="relative group">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@email.com"
                      required
                      className="w-full bg-[#0D0B24]/50 border border-[#1C1A38] focus:border-[#6C3EF4]/50 rounded-2xl px-5 py-4 text-white placeholder-[#A8A0D8]/30 outline-none transition-all group-hover:border-[#1C1A38]/80"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={status === 'loading_magic' || !email}
                  className="w-full relative group overflow-hidden bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black tracking-tight shadow-[0_12px_30px_rgba(108,62,244,0.3)] hover:shadow-[0_15px_40px_rgba(108,62,244,0.5)] transition-all active:scale-[0.98]"
                >
                  <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {status === 'loading_magic' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        メールでログイン
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </span>
                </button>
              </form>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#1C1A38]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-[#07061A] text-[#A8A0D8] font-bold uppercase tracking-widest">
                    OR
                  </span>
                </div>
              </div>

              {/* サブ: Passkey ログイン */}
              <button
                onClick={handlePasskeyLogin}
                disabled={status === 'loading_passkey'}
                className="w-full relative group overflow-hidden bg-[#0D0B24] border border-[#1C1A38] hover:border-[#6C3EF4]/50 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-bold tracking-tight transition-all active:scale-[0.98]"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {status === 'loading_passkey' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Fingerprint className="w-5 h-5 text-[#A8A0D8] group-hover:text-[#6C3EF4] transition-colors" />
                      パスキーでログイン
                    </>
                  )}
                </span>
              </button>

              {error && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex gap-3 animate-in fade-in slide-in-from-top-2">
                  <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5 text-white text-[10px] font-bold">!</div>
                  <p className="text-red-500 text-xs font-bold leading-relaxed">{error}</p>
                </div>
              )}
            </div>
          )}

          <p className="mt-10 text-center text-[10px] font-bold text-[#A8A0D8]/40 uppercase tracking-[0.2em] px-4 leading-relaxed">
            Protecting creative integrity with cryptographic proof.<br />
            © 2026 ProofMark
          </p>
        </div>
      </div>
    </div>
  );
}