import { useEffect } from "react";
import { generateCompleteSchema, generateFAQSchema } from "@/lib/schema";
import { articles } from "@/data/articles";

/**
 * JSON-LD構造化データをHTMLヘッドに挿入するコンポーネント
 * SEO対策：検索エンジンがコンテンツの構造を理解しやすくする
 */
export function SchemaScript() {
  useEffect(() => {
    // 追加したスクリプトタグを記録する配列（クリーンアップ用）
    const appendedScripts: HTMLScriptElement[] = [];

    // メインスキーマを挿入
    const mainSchema = document.createElement("script");
    mainSchema.type = "application/ld+json";
    mainSchema.textContent = generateCompleteSchema();
    document.head.appendChild(mainSchema);
    appendedScripts.push(mainSchema);

    // FAQスキーマを挿入（最新のアーキテクチャ仕様に修正）
    const faqData = [
      {
        question: "SHA-256とは何ですか？",
        answer:
          "SHA-256はハッシュ関数で、作品データから一意の「指紋」を生成します。1ピクセルでも画像が書き換えられれば全く別の指紋になるため、改ざん検知に利用されます。",
      },
      {
        question: "データは本当に安全ですか？",
        answer:
          "はい。ProofMarkはダイレクトアップロードを採用しています。作品ファイルはVercelサーバーを経由せず、強固なセキュリティのSupabase Storageへ直接転送され、サーバーサイドで安全にハッシュ計算が行われます。",
      },
      {
        question: "タイムスタンプはどのように機能しますか？",
        answer:
          "タイムスタンプは、あなたの作品が「いつ存在していたか」を第三者が検証可能な形で証明します。著作権侵害などのトラブル時に、客観的なエビデンスとして機能します。",
      },
      {
        question: "C2PAとは何ですか？",
        answer:
          "C2PAは、デジタルコンテンツの「来歴」を暗号学的に保護された状態で記録する国際標準規格です。ProofMarkはこの規格の考え方に準拠しています。",
      },
    ];

    const faqSchema = document.createElement("script");
    faqSchema.type = "application/ld+json";
    faqSchema.textContent = JSON.stringify(generateFAQSchema(faqData));
    document.head.appendChild(faqSchema);
    appendedScripts.push(faqSchema);

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
        // 動的な日付ではなく、サービスのローンチ日などの固定値を使用（スパム判定回避）
        datePublished: "2026-03-26",
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
      appendedScripts.push(articleSchema);
    });

    // クリーンアップ関数：コンポーネントのアンマウント時にスクリプトを削除（無限増殖を防ぐ）
    return () => {
      appendedScripts.forEach((script) => {
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
      });
    };
  }, []);

  return null;
}