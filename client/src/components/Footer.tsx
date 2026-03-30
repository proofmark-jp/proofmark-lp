import React from "react";
import { Link } from "wouter";

export default function Footer() {
  return (
    <footer style={styles.footer} className="no-print">
      <div style={styles.links}>
        <Link href="/terms" style={styles.link}>利用規約</Link>
        <Link href="/privacy" style={styles.link}>プライバシーポリシー</Link>
        <Link href="/security" style={styles.link}>セキュリティの透明性</Link>
      </div>
      <p style={styles.copy}>© 2026 ProofMark. All rights reserved.</p>
    </footer>
  );
}

const styles = {
  footer: { padding: "48px 20px 32px", textAlign: "center" as const, borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: "auto" },
  links: { display: "flex", justifyContent: "center", gap: "32px", marginBottom: "24px", flexWrap: "wrap" as const },
  link: { color: "#A8A0D8", fontSize: "13px", textDecoration: "none", fontWeight: 500, transition: "color 0.2s" },
  copy: { color: "#48456A", fontSize: "12px", margin: 0 }
};
