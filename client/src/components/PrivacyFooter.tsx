import { useState } from "react";
import { Lock, Shield, FileText } from "lucide-react";
import ArticleDrawer from "@/components/ArticleDrawer";
import { getArticleById } from "@/data/articles";
import type { Article } from "@/data/articles";
import navbarLogo from "../assets/logo/navbar/proofmark-navbar-symbol-dark.svg";

/**
 * PrivacyFooter Component
 * Design: Cyber-Minimalist Security
 */

export const PrivacyFooter = () => {
  const currentYear = new Date().getFullYear();
  const [drawerArticle, setDrawerArticle] = useState<Article | null>(null);

  const openArticle = (id: string) => {
    const article = getArticleById(id);
    if (article) setDrawerArticle(article);
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <>
      <footer className="bg-secondary/50 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            {/* Left: Navigation */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <img src={navbarLogo} alt="ProofMark Logo" style={{ height: "24px", width: "auto" }} />
                <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "24px", fontWeight: 800, color: "#F0EFF8" }}>
                  Proof<span style={{ color: "#00D4AA" }}>Mark</span>
                </span>
              </div>
              <ul className="space-y-3">
                <li>
                  <button
                    onClick={() => scrollTo("top")}
                    className="text-sm text-muted hover:text-primary transition-colors text-left"
                  >
                    ホーム
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollTo("how-it-works")}
                    className="text-sm text-muted hover:text-primary transition-colors text-left"
                  >
                    機能
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollTo("pricing")}
                    className="text-sm text-muted hover:text-primary transition-colors text-left"
                  >
                    料金
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollTo("learning")}
                    className="text-sm text-muted hover:text-primary transition-colors text-left"
                  >
                    ブログ
                  </button>
                </li>
              </ul>
            </div>

            {/* Center: Security & Privacy */}
            <div>
              <h3 className="font-bold mb-6 flex items-center gap-2">
                <Shield className="w-5 h-5 text-accent" />
                <span>Privacy & Security</span>
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-accent mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">ダイレクト転送</p>
                    <p className="text-xs text-muted">Webサーバーを経由せず安全に保存</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-accent mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">セキュアなハッシュ化</p>
                    <p className="text-xs text-muted">サーバーサイドでSHA-256を計算</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-accent mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">透明な設計</p>
                    <p className="text-xs text-muted">すべての仕様と規約を公開</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Legal */}
            <div>
              <h3 className="font-bold mb-6 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <span>Legal</span>
              </h3>
              <ul className="space-y-3">
                <li>
                  <button
                    onClick={() => openArticle("privacy-policy")}
                    className="text-sm text-muted hover:text-primary transition-colors text-left"
                  >
                    プライバシーポリシー
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => openArticle("terms-of-service")}
                    className="text-sm text-muted hover:text-primary transition-colors text-left"
                  >
                    利用規約
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollTo("how-it-works")}
                    className="text-sm text-muted hover:text-primary transition-colors text-left"
                  >
                    セキュリティ
                  </button>
                </li>
                <li>
                  <a
                    href="https://x.com/ProofMark_jp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted hover:text-primary transition-colors"
                  >
                    お問い合わせ（X）
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border my-8" />

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-xs text-muted">
                © {currentYear} ProofMark. All rights reserved.
              </p>
              <div className="flex items-center gap-4">
                <a
                  href="https://x.com/ProofMark_jp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary transition-colors"
                  aria-label="X（Twitter）でProofMarkをフォロー"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="w-4 h-4 fill-current"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.213 5.567zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  @ProofMark_jp
                </a>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-card/50 border border-border/30">
              <p className="text-xs text-muted leading-relaxed">
                <span className="font-semibold">商標について:</span>{" "}
                本サイトに表示されるすべての製品名、ロゴ、ブランドは、それぞれの所有者の財産です。
                ProofMarkはこれらのツールとの公式な提携を主張するものではなく、互換性を示しています。
              </p>
            </div>
          </div>
        </div>
      </footer>

      <ArticleDrawer
        article={drawerArticle}
        isOpen={!!drawerArticle}
        onClose={() => setDrawerArticle(null)}
      />
    </>
  );
};