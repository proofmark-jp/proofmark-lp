import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";

interface Certificate {
  id: string;
  file_name: string;
  file_hash: string;
  file_url: string;
  thumbnail_url?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [, navigate] = useLocation();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(true);

  // 未認証時リダイレクト
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  // 証明書一覧取得
  useEffect(() => {
    if (!user) return;

    const fetchCerts = async () => {
      setLoadingCerts(true);
      const { data, error } = await supabase
        .from("certificates")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setCerts(data as Certificate[]);
      }
      setLoadingCerts(false);
    };

    fetchCerts();
  }, [user]);

  const handleShare = (cert: Certificate) => {
    const certUrl = `${window.location.origin}/cert/${cert.id}`;
    // 🌟 修正: ファイル名が入るようにしました
    const text = `ProofMarkで、この作品（${cert.file_name || "Untitled"}）の【デジタル存在証明】を発行しました！ #ProofMark #AIイラスト ${certUrl}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async (certId: string) => {
    if (!confirm("この証明書を削除しますか？")) return;
    const { error } = await supabase
      .from("certificates")
      .delete()
      .eq("id", certId);
    if (!error) {
      setCerts((prev) => prev.filter((c) => c.id !== certId));
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const truncateHash = (hash: string) => {
    if (!hash) return "—";
    return hash.length > 16 ? `${hash.slice(0, 8)}…${hash.slice(-8)}` : hash;
  };

  if (authLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <style>{spinnerKeyframes}</style>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <a href="/" style={styles.logoLink}>
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
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
          </a>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.emailBadge}>{user.email}</span>
          <button onClick={signOut} style={styles.logoutBtn}>
            ログアウト
          </button>
        </div>
      </header>

      {/* Hero section */}
      <section style={styles.hero}>
        <h1 className="text-3xl font-black mb-2" style={styles.heroTitle}>
          My Portfolio
        </h1>
        <p className="text-muted" style={styles.heroSubtitle}>
          あなたの証明済み作品一覧。これらは安全なクラウドに保管されています。
        </p>
      </section>

      {/* Content */}
      <main style={styles.main}>
        {loadingCerts ? (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner} />
          </div>
        ) : certs.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📁</div>
            <p style={styles.emptyText}>
              まだ証明済み作品がありません。
            </p>
            <a href="/" style={styles.emptyLink}>
              最初の作品を証明する →
            </a>
          </div>
        ) : (
          <div style={styles.grid}>
            {certs.map((cert) => (
              <div key={cert.id} style={styles.card}>
                {/* Thumbnail */}
                <div style={styles.thumbWrap}>
                  {cert.thumbnail_url || cert.file_url ? (
                    <img
                      src={cert.thumbnail_url || cert.file_url}
                      alt={cert.file_name}
                      style={styles.thumbImg}
                      loading="lazy"
                    />
                  ) : (
                    <div style={styles.thumbPlaceholder}>
                      <svg
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="rgba(255,255,255,0.2)"
                        strokeWidth="1.5"
                      >
                        <rect
                          x="3"
                          y="3"
                          width="18"
                          height="18"
                          rx="3"
                        />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                    </div>
                  )}
                  {/* Verified badge */}
                  <div style={styles.verifiedBadge}>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="#00d4aa"
                    >
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                    <span style={{ fontSize: 11, color: "#00d4aa", fontWeight: 700 }}>
                      Verified
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div style={styles.cardBody}>
                  <p style={styles.fileName}>{cert.file_name || "Untitled"}</p>

                  <div style={styles.metaRow}>
                    <span style={styles.metaLabel}>Hash</span>
                    <code style={styles.hashValue}>
                      {truncateHash(cert.file_hash)}
                    </code>
                  </div>

                  <div style={styles.metaRow}>
                    <span style={styles.metaLabel}>Date</span>
                    <span style={styles.metaValue}>
                      {formatDate(cert.created_at)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={styles.actions}>
                    <button
                      onClick={() => handleShare(cert)}
                      style={styles.shareBtn}
                      title="𝕏でシェア"
                    >
                      <span style={styles.xIcon}>𝕏</span>
                      シェア
                    </button>
                    <a
                      href={`/cert/${cert.id}`}
                      style={styles.viewBtn}
                    >
                      証明書
                    </a>
                    <button
                      onClick={() => handleDelete(cert.id)}
                      style={styles.deleteBtn}
                      title="削除"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <style>{spinnerKeyframes}</style>
      <style>{hoverStyles}</style>
    </div>
  );
}

const spinnerKeyframes = `
  @keyframes pm-spin { to { transform: rotate(360deg); } }
  @keyframes pm-fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

const hoverStyles = `
  .pm-card:hover {
    border-color: rgba(108, 62, 244, 0.4) !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 8px 32px rgba(108, 62, 244, 0.15) !important;
  }
`;

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #0a0a0f 0%, #12121e 100%)",
    color: "#fff",
  },

  // Header
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 24px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    backdropFilter: "blur(12px)",
    position: "sticky" as const,
    top: 0,
    zIndex: 100,
    background: "rgba(10, 10, 15, 0.85)",
  },
  headerLeft: { display: "flex", alignItems: "center" },
  headerRight: { display: "flex", alignItems: "center", gap: 12 },
  logoLink: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    textDecoration: "none",
  },
  logoText: {
    fontSize: 18,
    fontWeight: 800,
    background: "linear-gradient(135deg, #6c3ef4, #00d4aa)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  emailBadge: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    padding: "4px 10px",
    background: "rgba(255,255,255,0.04)",
    borderRadius: 6,
  },
  logoutBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    padding: "6px 14px",
    cursor: "pointer",
    transition: "all 0.2s",
  },

  // Hero
  hero: {
    textAlign: "center" as const,
    padding: "48px 24px 24px",
    animation: "pm-fadeUp 0.5s ease-out",
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: 900,
    color: "#fff",
    margin: "0 0 8px",
    letterSpacing: "-0.02em",
  },
  heroSubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.45)",
    margin: 0,
    lineHeight: 1.6,
  },

  // Main
  main: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "24px 24px 80px",
  },

  // Grid
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 20,
  },

  // Card
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    overflow: "hidden",
    transition: "all 0.25s ease",
    animation: "pm-fadeUp 0.5s ease-out both",
  },

  // Thumbnail
  thumbWrap: {
    position: "relative" as const,
    width: "100%",
    paddingTop: "66%",
    background: "rgba(0,0,0,0.3)",
    overflow: "hidden",
  },
  thumbImg: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain" as const, // 🌟 cover を contain に変更
    padding: "8px", // 🌟 画像が端にくっつかないように余白を追加
  },
  thumbPlaceholder: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.02)",
  },
  verifiedBadge: {
    position: "absolute" as const,
    top: 10,
    right: 10,
    display: "flex",
    alignItems: "center",
    gap: 4,
    background: "rgba(0, 0, 0, 0.65)",
    backdropFilter: "blur(8px)",
    padding: "4px 8px",
    borderRadius: 6,
  },

  // Card body
  cardBody: {
    padding: "16px 18px 18px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  },
  fileName: {
    fontSize: 15,
    fontWeight: 700,
    color: "#fff",
    margin: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  metaRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  hashValue: {
    fontSize: 12,
    color: "#6c3ef4",
    background: "rgba(108, 62, 244, 0.1)",
    padding: "2px 8px",
    borderRadius: 4,
    fontFamily: "'SF Mono', 'Fira Code', monospace",
  },
  metaValue: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
  },

  // Actions
  actions: {
    display: "flex",
    gap: 8,
    marginTop: 6,
  },
  shareBtn: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "8px 0",
    background: "rgba(29, 155, 240, 0.12)",
    border: "1px solid rgba(29, 155, 240, 0.25)",
    borderRadius: 8,
    color: "#1d9bf0",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  xIcon: {
    fontSize: 15,
    fontWeight: 900,
  },
  viewBtn: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 0",
    background: "rgba(108, 62, 244, 0.12)",
    border: "1px solid rgba(108, 62, 244, 0.25)",
    borderRadius: 8,
    color: "#6c3ef4",
    fontSize: 13,
    fontWeight: 700,
    textDecoration: "none",
    transition: "all 0.2s",
  },
  deleteBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    padding: 0,
    background: "rgba(255, 59, 48, 0.08)",
    border: "1px solid rgba(255, 59, 48, 0.15)",
    borderRadius: 8,
    color: "rgba(255, 59, 48, 0.6)",
    cursor: "pointer",
    transition: "all 0.2s",
  },

  // Empty state
  emptyState: {
    textAlign: "center" as const,
    padding: "80px 20px",
    animation: "pm-fadeUp 0.5s ease-out",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.4)",
    margin: "0 0 16px",
  },
  emptyLink: {
    fontSize: 14,
    color: "#6c3ef4",
    fontWeight: 700,
    textDecoration: "none",
  },

  // Loading
  loadingContainer: {
    minHeight: "40vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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
