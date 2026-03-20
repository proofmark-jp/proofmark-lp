import { useEffect } from "react";
import { generateCompleteSchema, generateFAQSchema } from "@/lib/schema";
import { articles } from "@/data/articles";

/**
 * JSON-LD構造化データをHTMLヘッドに挿入するコンポーネント
 * SEO対策：検索エンジンがコンテンツの構造を理解しやすくする
 */
export function SchemaScript() {
  useEffect(() => {
    // メインスキーマを挿入
    const mainSchema = document.createElement("script");
    mainSchema.type = "application/ld+json";
    mainSchema.textContent = generateCompleteSchema();
    document.head.appendChild(mainSchema);

    // FAQスキーマを挿入
    const faqData = [
      {
        question: "SHA-256とは何ですか？",
        answer:
          "SHA-256はハッシュ関数で、作品データから一意の「指紋」を生成します。元のデータを外部に渡さず、この指紋だけで改ざん検知ができます。",
      },
      {
        question: "データは本当に安全ですか？",
        answer:
          "ProofMarkはブラウザ内でハッシュ値を生成し、ハッシュ値だけをサーバーに送信します。元の作品データはあなたのパソコンに残ったままで、サーバーに送信されません。",
      },
      {
        question: "タイムスタンプはどのように機能しますか？",
        answer:
          "タイムスタンプは、あなたの作品が「いつ存在していたか」を第三者が検証可能な形で証明します。改ざんされた作品は、タイムスタンプの時刻より後に作られたことが確定します。",
      },
      {
        question: "C2PAとは何ですか？",
        answer:
          "C2PAは、デジタルコンテンツの「来歴」を改ざん不可能な形で記録する国際標準です。出自（誰が作ったか）と編集履歴（何がされたか）を記録します。",
      },
    ];

    const faqSchema = document.createElement("script");
    faqSchema.type = "application/ld+json";
    faqSchema.textContent = JSON.stringify(generateFAQSchema(faqData));
    document.head.appendChild(faqSchema);

    // 記事スキーマを挿入
    articles.forEach((article) => {
      const articleSchema = document.createElement("script");
      articleSchema.type = "application/ld+json";
      articleSchema.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: article.title,
        description: article.description,
        image: "https://proofmark.jp/og-image.png",
        url: `https://proofmark.jp/articles/${article.slug}`,
        articleBody: `${article.content.summary}\n\n${article.content.explanation}`,
        author: {
          "@type": "Organization",
          name: "ProofMark",
          url: "https://proofmark.jp",
        },
        publisher: {
          "@type": "Organization",
          name: "ProofMark",
          logo: {
            "@type": "ImageObject",
            url: "https://proofmark.jp/logo.png",
          },
        },
        datePublished: new Date().toISOString().split("T")[0],
        articleSection: article.category,
        keywords: [
          article.title,
          "AI著作権",
          "デジタル証明",
          "SHA-256",
          "タイムスタンプ",
          "C2PA",
        ],
      });
      document.head.appendChild(articleSchema);
    });

    // クリーンアップ関数
    return () => {
      // スクリプトタグは自動的にクリーンアップされる
    };
  }, []);

  // このコンポーネントはUIを返さない（スクリプト挿入のみ）
  return null;
}
