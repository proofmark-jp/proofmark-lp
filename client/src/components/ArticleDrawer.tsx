import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Article } from "@/data/articles";
import { Clock, ExternalLink, ArrowRight, X, BookOpen } from "lucide-react";
import { useAuth } from '@/hooks/useAuth';

interface ArticleDrawerProps {
  article: Article | null;
  isOpen: boolean;
  onClose: () => void;
  onRegisterClick?: () => void;
}

export default function ArticleDrawer({
  article,
  isOpen,
  onClose,
  onRegisterClick,
}: ArticleDrawerProps) {
  const { user } = useAuth();
  if (!article) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto flex flex-col gap-0 p-0"
      >
        {/* ヘッダー — 閉じるボタンと重ならないよう padding を確保 */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-6 pt-6 pb-5">
          {/* 閉じるボタン — 右上の絶対配置 */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-lg p-2 hover:bg-secondary transition-colors text-muted hover:text-foreground"
            aria-label="ドロワーを閉じる"
          >
            <X className="h-5 w-5" />
          </button>

          {/* カテゴリバッジ */}
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1">
            <BookOpen className="h-3 w-3 text-accent" />
            <span className="text-xs font-medium text-accent">
              {article.category}
            </span>
          </div>

          {/* タイトル — sr-only で SheetTitle も保持（アクセシビリティ） */}
          <SheetTitle className="text-xl font-black leading-snug pr-10 text-foreground">
            {article.title}
          </SheetTitle>

          {/* メタ情報 */}
          <div className="mt-3 flex items-center gap-4 text-sm text-muted">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {article.readTime}分で読める
            </div>
            <span>{article.content.sources.length}つの参考文献</span>
          </div>
        </div>

        {/* スクロール可能なコンテンツ */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {/* サマリー */}
          <div>
            <p className="text-base leading-relaxed text-foreground/90">
              {article.content.summary}
            </p>
          </div>

          {/* キーポイント */}
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold">
              <span className="text-accent">✓</span>
              3つのポイント
            </h3>
            <ul className="space-y-3">
              {article.content.keyPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-sm text-foreground/80 leading-relaxed">
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* 詳細説明 */}
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold">
              <span className="text-accent">→</span>
              詳細解説
            </h3>
            <p
              className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap"
              style={{ overflowWrap: "break-word", wordBreak: "normal", lineBreak: "strict" }}
            >
              {article.content.explanation}
            </p>
          </div>

          {/* なぜ重要か */}
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
            <h3 className="mb-3 font-bold text-primary">なぜ重要か</h3>
            <p className="text-sm text-foreground/80 leading-relaxed">
              {article.content.whyMatters}
            </p>
          </div>

          {/* 参考文献 */}
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold">
              <span className="text-accent">📚</span>
              参考文献
            </h3>
            <ul className="space-y-3">
              {article.content.sources.map((source, i) => (
                <li key={i} className="flex items-start gap-3">
                  <ExternalLink className="h-4 w-4 text-accent mt-1 flex-shrink-0" />
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    <span className="font-semibold">{source.title}</span>
                    <span className="text-muted"> — {source.organization}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 固定CTA（ドロワー下部） */}
        {!user && (
          <div className="border-t border-border px-6 py-5 space-y-3 bg-background">
            <p className="text-sm text-muted text-center">
              学んだら、次のステップへ
            </p>
            <button
              onClick={() => {
                onClose();
                if (onRegisterClick) {
                  setTimeout(onRegisterClick, 300);
                }
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary/80 px-6 py-3 font-semibold text-primary-foreground transition-all duration-300 hover:gap-3 hover:shadow-lg hover:shadow-primary/30 active:scale-95"
            >
              無料で先行登録する
              <ArrowRight className="h-4 w-4" />
            </button>
            <p className="text-xs text-muted text-center">
              クレジットカード不要・いつでも解除OK
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
