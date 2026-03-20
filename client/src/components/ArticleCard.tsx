import { Article } from "@/data/articles";
import { ArrowRight, Clock, Tag } from "lucide-react";

interface ArticleCardProps {
  article: Article;
  onReadMore?: (slug: string) => void;
}

export default function ArticleCard({
  article,
  onReadMore,
}: ArticleCardProps) {
  const handleClick = () => {
    if (onReadMore) {
      onReadMore(article.slug);
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-accent hover:shadow-lg hover:shadow-accent/20">
      {/* グラデーション背景 */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* コンテンツ */}
      <div className="relative p-6">
        {/* ヘッダー */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1">
              <Tag className="h-3 w-3 text-accent" />
              <span className="text-xs font-medium text-accent">
                {article.category}
              </span>
            </div>
            <h3 className="text-lg font-bold text-foreground transition-colors duration-300 group-hover:text-primary">
              {article.title}
            </h3>
          </div>
        </div>

        {/* 説明 */}
        <p className="mb-4 text-sm text-muted-foreground">
          {article.description}
        </p>

        {/* 要約 */}
        <p className="mb-6 text-sm leading-relaxed text-foreground/80 line-clamp-3">
          {article.content.summary}
        </p>

        {/* メタ情報 */}
        <div className="mb-6 flex items-center gap-4 border-t border-border/50 pt-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{article.readTime}分で読める</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {article.content.sources.length}つの参考文献
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={handleClick}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary/80 px-4 py-2 text-sm font-semibold text-primary-foreground transition-all duration-300 hover:gap-3 hover:shadow-lg hover:shadow-primary/30 active:scale-95"
          aria-label={`${article.title}の記事を読む`}
        >
          記事を読む
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </button>
      </div>

      {/* ホバー時の装飾線 */}
      <div className="absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r from-primary to-accent transition-all duration-300 group-hover:w-full" />
    </div>
  );
}
