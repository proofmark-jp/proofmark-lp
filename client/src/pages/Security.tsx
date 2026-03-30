import React from "react";
import { Link } from "wouter";

export default function Security() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>セキュリティの透明性</h1>
        <p style={styles.subtitle}>あなたの創作事実を強固に守る、ProofMarkの技術基盤</p>

        <div style={styles.grid}>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>1. Direct Upload方式</h3>
            <p style={styles.cardText}>作品データは当社のWebサーバー（Vercel）を一切経由しません。あなたのブラウザから、直接セキュアなクラウドストレージ（Supabase）へ暗号化転送されます。</p>
          </div>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>2. ブラウザ内ハッシュ計算</h3>
            <p style={styles.cardText}>証明の核となる「SHA-256ハッシュ値」は、送信前にあなたのブラウザ内で計算されます。通信傍受によるデータ改ざんリスクを構造上排除しています。</p>
          </div>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>3. 厳格なアクセス制御 (RLS)</h3>
            <p style={styles.cardText}>データベースにはRow Level Securityを適用。システムの構造上、あなた以外のユーザーや第三者がオリジナルの画像データにアクセスすることは不可能です。</p>
          </div>
        </div>
        <Link href="/" style={styles.backLink}>← トップへ戻る</Link>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#07061A", color: "#F0EFF8", padding: "80px 20px", fontFamily: "'Syne', sans-serif" },
  container: { maxWidth: "1000px", margin: "0 auto", textAlign: "center" as const },
  title: { fontSize: "36px", fontWeight: 900, color: "#F0EFF8", marginBottom: "16px" },
  subtitle: { fontSize: "16px", color: "#A8A0D8", marginBottom: "60px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px", textAlign: "left" as const },
  card: { background: "#0D0B24", padding: "40px 32px", borderRadius: "20px", border: "1px solid #1C1A38", display: "flex", flexDirection: "column" as const, gap: "16px" },
  cardTitle: { fontSize: "20px", fontWeight: 700, color: "#00D4AA", margin: 0 },
  cardText: { fontSize: "15px", lineHeight: 1.8, color: "#D4D0F4", margin: 0 },
  backLink: { display: "inline-block", marginTop: "60px", color: "#6C3EF4", textDecoration: "none", fontWeight: 700 }
};
