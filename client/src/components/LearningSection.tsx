import { articles, getArticleById } from "@/data/articles";
import ArticleCard from "./ArticleCard";
import ArticleDrawer from "./ArticleDrawer";
import { BookOpen, ArrowRight } from "lucide-react";
import { useState } from "react";

interface LearningSectionProps {
  onArticleSelect?: (slug: string) => void;
  onRegisterClick?: () => void;
}

export default function LearningSection({
  onArticleSelect,
  onRegisterClick,
}: LearningSectionProps) {
  const [selectedArticleSlug, setSelectedArticleSlug] = useState<string | null>(null);
  const selectedArticle = selectedArticleSlug
    ? articles.find((a) => a.slug === selectedArticleSlug) || null
    : null;

  const handleArticleSelect = (slug: string) => {
    setSelectedArticleSlug(slug);
    if (onArticleSelect) {
      onArticleSelect(slug);
    }
  };

  const handleCloseDrawer = () => {
    setSelectedArticleSlug(null);
  };

  const displayArticles = articles.slice(0, 3); // 最初の3つの記事を表示

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background via-background to-background py-16 md:py-24">
      {/* 背景装飾 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -right-1/4 -top-1/4 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -left-1/4 -bottom-1/4 h-96 w-96 rounded-full bg-accent/5 blur-3xl" />
      </div>

      {/* コンテンツ */}
      <div className="container relative z-10">
        {/* ヘッダー */}
        <div className="mb-12 text-center md:mb-16">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2">
            <BookOpen className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold text-accent">LEARNING</span>
          </div>

          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            <span className="bg-gradient-to-r from-primary via-purple-400 to-accent bg-clip-text text-transparent">
              3分で理解：
            </span>
            <br />
            <span className="text-foreground">創作証明の基礎知識</span>
          </h2>

          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            「SHA-256」「タイムスタンプ」「C2PA」を短時間で押さえると、ProofMarkの"証明の強さ"が腹落ちします。
          </p>
        </div>

        {/* 記事グリッド */}
        <div className="mb-12 grid gap-6 md:grid-cols-3">
          {displayArticles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              onReadMore={handleArticleSelect}
            />
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-6 rounded-xl border border-border/50 bg-gradient-to-r from-primary/5 to-accent/5 p-8 text-center backdrop-blur-sm md:p-12">
          <div>
            <h3 className="mb-2 text-2xl font-bold text-foreground">
              学んだら、先行登録する
            </h3>
            <p className="text-muted-foreground">
              あなたの創作を今すぐ証明しましょう
            </p>
          </div>

          <button
            onClick={onRegisterClick}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary/80 px-6 py-3 font-semibold text-primary-foreground transition-all duration-300 hover:gap-3 hover:shadow-lg hover:shadow-primary/30 active:scale-95"
            aria-label="無料で先行登録する"
          >
            無料で先行登録する
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>

        {/* フッターノート */}
        <div className="mt-12 border-t border-border/50 pt-8 text-center text-sm text-muted-foreground">
          <p>
            すべての記事は、NIST、RFC、C2PA、文化庁などの一次情報に基づいています。
          </p>
          <p className="mt-2">
            詳細な参考文献は、各記事に記載されています。
          </p>
        </div>
      </div>

      {/* Article Drawer */}
      <ArticleDrawer
        article={selectedArticle}
        isOpen={!!selectedArticle}
        onClose={handleCloseDrawer}
        onRegisterClick={onRegisterClick}
      />
    </section>
  );
}
