import React from "react";
import { Link } from "wouter";

export default function Terms() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>利用規約</h1>
        <p style={styles.date}>最終更新日: 2026年3月</p>
        <div style={styles.content}>
          <h2 style={styles.h2}>1. サービスの内容と免責事項</h2>
          <p style={styles.p}>ProofMark（以下「本サービス」）は、アップロードされたデジタルデータのSHA-256ハッシュ値を計算し、タイムスタンプと共に記録する「デジタル存在証明」サービスです。本サービスは法的な著作権（Copyright）の発生や権利の帰属を公的に保証するものではありません。</p>
          <h2 style={styles.h2}>2. データの取り扱い</h2>
          <p style={styles.p}>ユーザーがアップロードした元データ、および生成されたハッシュ値を利用して、第三者との間で発生した著作権侵害等のいかなる紛争についても、運営者は一切の責任を負いません。証明書の法的有効性については、ユーザー自身の責任において利用するものとします。</p>
          <h2 style={styles.h2}>3. 禁止事項</h2>
          <p style={styles.p}>他者の著作物を無断でアップロードし、自己の権利として証明書を発行する行為（虚偽の登録）を固く禁じます。</p>
        </div>
        <Link href="/" style={styles.backLink}>← トップへ戻る</Link>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#07061A", color: "#F0EFF8", padding: "80px 20px", fontFamily: "'Syne', sans-serif" },
  container: { maxWidth: "800px", margin: "0 auto", background: "#0D0B24", padding: "48px", borderRadius: "20px", border: "1px solid #1C1A38" },
  title: { fontSize: "32px", fontWeight: 800, marginBottom: "8px", color: "#F0EFF8" },
  date: { fontSize: "14px", color: "#48456A", marginBottom: "40px" },
  content: { color: "#D4D0F4" },
  h2: { fontSize: "20px", fontWeight: 700, color: "#00D4AA", marginTop: "32px", marginBottom: "16px", borderBottom: "1px solid #1C1A38", paddingBottom: "8px" },
  p: { fontSize: "15px", lineHeight: 1.9, marginBottom: "24px" },
  backLink: { display: "inline-block", marginTop: "40px", color: "#6C3EF4", textDecoration: "none", fontWeight: 700 }
};
