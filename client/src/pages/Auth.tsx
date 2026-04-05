import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../hooks/useAuth";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp, user, loading } = useAuth();
  const [, navigate] = useLocation();

  // ログイン済みならダッシュボードへ
  if (!loading && user) {
    navigate("/dashboard");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message);
      } else {
        navigate("/dashboard");
      }
    } else {
      const { error } = await signUp(email, password);
      if (error) {
        setError(error.message);
      } else {
        setSuccessMsg(
          "確認メールを送信しました。メールを確認してアカウントを有効化してください。"
        );
      }
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoWrap}>
          <svg
            width="40"
            height="40"
            viewBox="0 0 40 40"
            fill="none"
            style={{ marginRight: 10 }}
          >
            <rect
              width="40"
              height="40"
              rx="10"
              fill="rgba(108, 62, 244, 0.15)"
            />
            <path
              d="M12 20L18 26L28 14"
              stroke="#6c3ef4"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span style={styles.logoText}>ProofMark</span>
        </div>

        <h1 style={styles.title}>
          {isLogin ? "ログイン" : "新規登録"}
        </h1>
        <p style={styles.subtitle}>
          {isLogin
            ? "アカウントにログインして、作品を管理しましょう。"
            : "アカウントを作成して、AI作品のデジタル存在証明を始めましょう。"}
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>メールアドレス</label>
            <input
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>パスワード</label>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              style={styles.input}
            />
          </div>

          {error && <div style={styles.errorBox}>{error}</div>}
          {successMsg && <div style={styles.successBox}>{successMsg}</div>}

          <button
            type="submit"
            disabled={submitting}
            style={{
              ...styles.submitBtn,
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting
              ? "処理中..."
              : isLogin
                ? "ログイン"
                : "アカウント作成"}
          </button>
        </form>

        <div style={styles.switchRow}>
          <span style={styles.switchText}>
            {isLogin
              ? "アカウントをお持ちでないですか？"
              : "すでにアカウントをお持ちですか？"}
          </span>
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
              setSuccessMsg(null);
            }}
            style={styles.switchBtn}
          >
            {isLogin ? "新規登録" : "ログイン"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pm-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pm-fadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0a0a0f 0%, #12121e 50%, #0a0a0f 100%)",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(108, 62, 244, 0.2)",
    borderRadius: 16,
    padding: "40px 32px",
    backdropFilter: "blur(20px)",
    animation: "pm-fadeIn 0.5s ease-out",
  },
  logoWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  logoText: {
    fontSize: 22,
    fontWeight: 800,
    background: "linear-gradient(135deg, #6c3ef4, #00d4aa)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    letterSpacing: "-0.02em",
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    color: "#fff",
    textAlign: "center" as const,
    margin: "0 0 8px",
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center" as const,
    margin: "0 0 28px",
    lineHeight: 1.6,
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 18,
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "rgba(255,255,255,0.7)",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    color: "#fff",
    fontSize: 15,
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box" as const,
  },
  errorBox: {
    padding: "10px 14px",
    background: "rgba(255, 59, 48, 0.12)",
    border: "1px solid rgba(255, 59, 48, 0.3)",
    borderRadius: 10,
    color: "#ff6b6b",
    fontSize: 13,
    lineHeight: 1.5,
  },
  successBox: {
    padding: "10px 14px",
    background: "rgba(0, 212, 170, 0.12)",
    border: "1px solid rgba(0, 212, 170, 0.3)",
    borderRadius: 10,
    color: "#00d4aa",
    fontSize: 13,
    lineHeight: 1.5,
  },
  submitBtn: {
    width: "100%",
    padding: "14px 0",
    background: "linear-gradient(135deg, #6c3ef4, #5a2de0)",
    border: "none",
    borderRadius: 10,
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    transition: "opacity 0.2s, transform 0.15s",
    marginTop: 4,
  },
  switchRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 24,
  },
  switchText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.45)",
  },
  switchBtn: {
    background: "none",
    border: "none",
    color: "#6c3ef4",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    padding: 0,
    textDecoration: "underline",
  },
  loadingContainer: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0a0a0f",
  },
  spinner: {
    width: 32,
    height: 32,
    border: "3px solid rgba(108, 62, 244, 0.2)",
    borderTopColor: "#6c3ef4",
    borderRadius: "50%",
    animation: "pm-spin 0.8s linear infinite",
  },
};
