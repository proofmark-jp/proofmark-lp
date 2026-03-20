import { Lock, Shield, FileText } from "lucide-react";

/**
 * PrivacyFooter Component
 * Design: Cyber-Minimalist Security
 * 
 * Implements Privacy by Design principles.
 * Demonstrates legal honesty and trademark respect.
 * 
 * Structure:
 * - Left: Navigation links
 * - Center: Security & Privacy declaration
 * - Right: Legal & Trademark
 */

export const PrivacyFooter = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-secondary/50 border-t border-border">
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          {/* Left: Navigation */}
          <div>
            <h3 className="font-bold mb-6 flex items-center gap-2">
              <span className="text-2xl">⬡</span>
              <span>ProofMark</span>
            </h3>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-sm text-muted hover:text-primary transition-colors">
                  ホーム
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted hover:text-primary transition-colors">
                  機能
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted hover:text-primary transition-colors">
                  料金
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted hover:text-primary transition-colors">
                  ブログ
                </a>
              </li>
            </ul>
          </div>

          {/* Center: Security & Privacy */}
          <div>
            <h3 className="font-bold mb-6 flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent" />
              <span>Privacy by Design</span>
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-accent mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold">ブラウザ内処理</p>
                  <p className="text-xs text-muted">画像はサーバーに送信されません</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-accent mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold">エンドツーエンド暗号化</p>
                  <p className="text-xs text-muted">SHA-256による改ざん防止</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-accent mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold">透明な設計</p>
                  <p className="text-xs text-muted">すべての仕様を公開</p>
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
                <a href="#" className="text-sm text-muted hover:text-primary transition-colors">
                  プライバシーポリシー
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted hover:text-primary transition-colors">
                  利用規約
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted hover:text-primary transition-colors">
                  セキュリティ
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted hover:text-primary transition-colors">
                  お問い合わせ
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border my-8" />

        {/* Bottom: Copyright & Disclaimer */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-muted">
              © {currentYear} ProofMark. All rights reserved.
            </p>
            <div className="flex items-center gap-2">
              <a href="https://x.com/ProofMark_jp" target="_blank" rel="noopener noreferrer" className="text-sm text-muted hover:text-primary transition-colors">
                X (Twitter)
              </a>
              <span className="text-muted">•</span>
              <a href="#" className="text-sm text-muted hover:text-primary transition-colors">
                GitHub
              </a>
            </div>
          </div>

          {/* Trademark Disclaimer */}
          <div className="p-4 rounded-lg bg-card/50 border border-border/30">
            <p className="text-xs text-muted leading-relaxed">
              <span className="font-semibold">商標について:</span> 本サイトに表示されるすべての製品名、ロゴ、ブランドは、それぞれの所有者の財産です。
              ProofMarkはこれらのツールとの公式な提携を主張するものではなく、互換性を示しています。
              各企業の商標・著作権を尊重し、適切な帰属表示を行っています。
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
