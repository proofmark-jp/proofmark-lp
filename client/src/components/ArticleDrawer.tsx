import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Article } from "@/data/articles";
import { Clock, ExternalLink, ArrowRight, X, BookOpen } from "lucide-react";

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
  if (!article) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        {/* ヘッダー */}
        <SheetHeader className="mb-8 pb-6 border-b border-border">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1">
                <BookOpen className="h-3 w-3 text-accent" />
                <span className="text-xs font-medium text-accent">
                  {article.category}
                </span>
              </div>
              <SheetTitle className="text-2xl font-black leading-tight">
                {article.title}
              </SheetTitle>
              <div className="mt-4 flex items-center gap-4 text-sm text-muted">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {article.readTime}分で読める
                </div>
                <span>{article.content.sources.length}つの参考文献</span>
              </div>
            </div>
            <SheetClose asChild>
              <button
                onClick={onClose}
                className="rounded-lg p-2 hover:bg-secondary transition-colors"
                aria-label="ドロワーを閉じる"
              >
                <X className="h-5 w-5" />
              </button>
            </SheetClose>
          </div>
        </SheetHeader>

        {/* コンテンツ */}
        <div className="space-y-8">
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
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
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
        <div className="mt-12 pt-8 border-t border-border space-y-4">
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
      </SheetContent>
    </Sheet>
  );
}
