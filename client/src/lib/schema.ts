/**
 * JSON-LD構造化データジェネレータ
 * SEO対策：Google、Bingなどの検索エンジンに対して、
 * コンテンツの構造と意味を明確に伝える
 */

export interface SchemaData {
  "@context": string;
  "@type": string;
  [key: string]: any;
}

/**
 * Organizationスキーマ（ProofMark全体）
 */
export const generateOrganizationSchema = (): SchemaData => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "ProofMark",
  url: "https://proofmark.jp",
  logo: "https://proofmark.jp/logo.png",
  description:
    "AIクリエイターが「自分が最初にこの作品を作った」という事実を、技術的・法的に裏付けるAI作品のデジタル存在証明サービス",
  sameAs: [
    "https://x.com/ProofMark_jp",
    "https://github.com/proofmark",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "",
    contactType: "Customer Support",
    email: "support@proofmark.jp",
  },
});

/**
 * WebSiteスキーマ（LP全体）
 */
export const generateWebsiteSchema = (): SchemaData => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "ProofMark",
  url: "https://proofmark.jp",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://proofmark.jp/search?q={search_term_string}",
    },
    query_input: "required name=search_term_string",
  },
});

/**
 * Articleスキーマ（Learning記事）
 */
export const generateArticleSchema = (article: {
  title: string;
  description: string;
  slug: string;
  readTime: number;
  category: string;
  content: {
    summary: string;
    explanation: string;
  };
  sources: Array<{
    title: string;
    url: string;
  }>;
}): SchemaData => ({
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
  mentions: article.sources.map((source) => ({
    "@type": "Thing",
    name: source.title,
    url: source.url,
  })),
});

/**
 * FAQPageスキーマ（FAQ セクション）
 */
export const generateFAQSchema = (faqs: Array<{
  question: string;
  answer: string;
}>): SchemaData => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
});

/**
 * BreadcrumbListスキーマ（ナビゲーション）
 */
export const generateBreadcrumbSchema = (
  items: Array<{
    name: string;
    url: string;
  }>
): SchemaData => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: item.url,
  })),
});

/**
 * SoftwareApplicationスキーマ（ProofMark自体）
 */
export const generateSoftwareApplicationSchema = (): SchemaData => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "ProofMark",
  applicationCategory: "UtilityApplication",
  description:
    "AIクリエイターのためのデジタル存在証明・タイムスタンプサービス。自作発言や無断転載から作品を守る改ざん不能な証拠を発行します。",
  url: "https://proofmark.jp",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "JPY",
    description: "Free tier available",
  }
  // 🌟 削除: Googleのペナルティリスクを完全に排除するため、ダミーの aggregateRating を削除しました
});

/**
 * LocalBusinessスキーマ（日本のサービス）
 */
export const generateLocalBusinessSchema = (): SchemaData => ({
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "ProofMark",
  description:
    "AI作品のデジタル存在証明サービス（日本発）",
  url: "https://proofmark.jp",
  areaServed: "JP",
  serviceType: "Digital Rights Management",
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "",
    contactType: "Customer Support",
  },
});

/**
 * すべてのスキーマを統合したJSON-LD
 */
export const generateCompleteSchema = (): string => {
  const schemas = [
    generateOrganizationSchema(),
    generateWebsiteSchema(),
    generateSoftwareApplicationSchema(),
    generateLocalBusinessSchema(),
  ];

  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": schemas,
  });
};
