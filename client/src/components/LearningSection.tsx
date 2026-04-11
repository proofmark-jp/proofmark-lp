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

  const displayArticles = articles.slice(0, 3);

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
            <span className="text-foreground">知識を「武器」に変える</span>
          </h2>

          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            「SHA-256」や「タイムスタンプ」の仕組みを知ることで、ProofMarkがなぜあなたの作品を守る「強力な盾」になり得るのかが腹落ちします。
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