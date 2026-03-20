/**
 * Learning セクション用の記事データ
 * 各記事は「3分で読める」形式に最適化
 * E-E-A-T補強：一次情報への参照を明記
 */

export interface Article {
  id: string;
  title: string;
  description: string;
  category: string;
  readTime: number; // 分
  slug: string;
  content: {
    summary: string;
    keyPoints: string[];
    explanation: string;
    whyMatters: string;
    sources: Array<{
      title: string;
      url: string;
      organization: string;
    }>;
  };
  relatedArticles: string[]; // id references
  cta: {
    text: string;
    action: string;
  };
}

export const articles: Article[] = [
  {
    id: "sha256-basics",
    title: "SHA-256とは？",
    description: "画像を送らずに「同一性」を証明する仕組み",
    category: "技術解説",
    readTime: 3,
    slug: "sha256-basics",
    content: {
      summary:
        "SHA-256はハッシュ関数で、作品データから一意の「指紋」を生成します。元のデータを外部に渡さず、この指紋だけで改ざん検知ができるのが強みです。",
      keyPoints: [
        "ハッシュ = 一方向の変換（元のデータには戻せない）",
        "同じ入力なら同じ出力（改ざんされると出力が変わる）",
        "256ビット = 2^256通りの組み合わせ（実質的に衝突不可能）",
      ],
      explanation: `SHA-256（Secure Hash Algorithm 256-bit）は、NIST（米国国立標準技術研究所）が定めるハッシュ関数です。

あなたのAI生成画像をSHA-256で処理すると、256ビット（64文字の16進数）の「ハッシュ値」が生成されます。この値は：

• 元の画像の「デジタル指紋」
• 1ピクセルでも変わると、ハッシュ値も変わる
• 元の画像からハッシュ値を逆算することは不可能

つまり、あなたは「画像ファイル本体」をProofMarkに送信せず、「ハッシュ値」だけを送信します。ProofMarkはそのハッシュ値をタイムスタンプとともに記録。後で「この画像は私が作った」と証明する際、改めてハッシュ値を計算して比較すれば、改ざんされていないことが確認できます。`,
      whyMatters:
        "プライバシー保護とセキュリティの両立。あなたの作品データは一切外部に渡らず、指紋だけで所有権を証明できます。",
      sources: [
        {
          title: "FIPS 180-4: Secure Hash Standard (SHS)",
          url: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf",
          organization: "NIST",
        },
        {
          title: "SHA-256 Technical Details",
          url: "https://en.wikipedia.org/wiki/SHA-2",
          organization: "Wikipedia",
        },
      ],
    },
    relatedArticles: ["timestamp-proof", "browser-hash"],
    cta: {
      text: "SHA-256で作品を証明する",
      action: "register",
    },
  },
  {
    id: "ai-copyright-2026",
    title: "AI生成物と著作権（2026）",
    description: "文化庁の整理から読む、クリエイターの実務的注意点",
    category: "法務",
    readTime: 4,
    slug: "ai-copyright-2026",
    content: {
      summary:
        "日本の著作権法ではAI生成物の扱いが進化中。文化庁の公式見解を理解することで、あなたの創作活動をより安全に進められます。",
      keyPoints: [
        "AI生成物の著作権は「創作性」と「人的介入」で判断される",
        "学習データの著作権侵害とAI出力の著作権は別問題",
        "先行作成の証拠を残すことが、権利主張の強みになる",
      ],
      explanation: `日本の文化庁は「AIと著作権に関する考え方」をまとめており、以下のポイントが重要です：

【著作権が発生する場合】
• AI出力に対して、人間が創作的に加工・選別した場合
• 例：Midjourneyで複数案を生成 → 選別・編集 → 最終作品

【著作権が発生しない場合】
• AIの自動出力をそのまま使用した場合
• 創作性が認められない単なる「データ処理」

【クリエイターにとって重要な対策】
1. 「いつ、どのツールで、どのプロンプトで作ったか」を記録する
2. 編集・加工のプロセスを残す
3. 作品の先行作成を証拠として保存する ← ProofMarkの役割

文化庁の公式見解では、「作品の来歴（いつ、誰が、どのように作ったか）」が、著作権侵害の主張に対する防御材料になると明記されています。`,
      whyMatters:
        "法的グレーゾーンを避け、自信を持ってAI創作を公開できます。先行作成の証拠があれば、無断転載や自作発言に対する対抗手段が強化されます。",
      sources: [
        {
          title: "AIと著作権に関する考え方（文化庁）",
          url: "https://www.bunka.go.jp/seisaku/chosakuken/ai/",
          organization: "文化庁",
        },
        {
          title: "著作権法の改正動向",
          url: "https://www.bunka.go.jp/seisaku/chosakuken/",
          organization: "文化庁",
        },
      ],
    },
    relatedArticles: ["sha256-basics", "timestamp-proof"],
    cta: {
      text: "著作権を守る第一歩を踏み出す",
      action: "register",
    },
  },
  {
    id: "timestamp-proof",
    title: "なぜタイムスタンプが「先に作った」の根拠になるのか",
    description: "RFC3161の考え方：ハッシュに時刻を結びつけると、改ざんが極端に難しくなる",
    category: "技術解説",
    readTime: 3,
    slug: "timestamp-proof",
    content: {
      summary:
        "タイムスタンプは、あなたの作品が「いつ存在していたか」を第三者が検証可能な形で証明します。改ざんされた作品は、タイムスタンプの時刻より後に作られたことが確定します。",
      keyPoints: [
        "タイムスタンプ = ハッシュ値 + 信頼できる時刻源",
        "RFC3161は、タイムスタンプの国際標準",
        "時刻を遡ることは技術的にほぼ不可能",
      ],
      explanation: `RFC3161（Internet X.509 Public Key Infrastructure: Time-Stamp Protocol）は、デジタルタイムスタンプの国際標準です。

【タイムスタンプの仕組み】
1. あなたの作品 → SHA-256でハッシュ値を生成
2. そのハッシュ値 + 信頼できる時刻源（NTP等）→ タイムスタンプを生成
3. タイムスタンプは暗号署名で保護される

【なぜ「先に作った」の証拠になるのか】
• タイムスタンプの時刻より後に、作品を改ざんすることは不可能
• 例：2026年3月17日 10:00にタイムスタンプを取得 → その後、作品を改ざん → 改ざん版のハッシュ値は全く異なる → 元のタイムスタンプと一致しない

【ProofMarkでの実装】
ProofMarkは、あなたのハッシュ値に対してタイムスタンプを付与し、複数拠点に分散保存します。これにより、「2026年3月17日に、このハッシュ値が存在していた」という事実が、第三者によって検証可能になります。`,
      whyMatters:
        "単なる「作成日時」ではなく、改ざん不可能な形で先行作成を証明できます。無断転載や自作発言に対する法的根拠が格段に強くなります。",
      sources: [
        {
          title: "RFC 3161: Time-Stamp Protocol (TSP)",
          url: "https://tools.ietf.org/html/rfc3161",
          organization: "IETF",
        },
        {
          title: "タイムスタンプの仕組み（日本ネットワークセキュリティ協会）",
          url: "https://www.jnsa.org/",
          organization: "JNSA",
        },
      ],
    },
    relatedArticles: ["sha256-basics", "c2pa-standard"],
    cta: {
      text: "タイムスタンプで権利を守る",
      action: "register",
    },
  },
  {
    id: "c2pa-standard",
    title: "C2PAとは？",
    description: "デジタルコンテンツの出自と編集履歴を透明に記録する国際標準",
    category: "技術解説",
    readTime: 3,
    slug: "c2pa-standard",
    content: {
      summary:
        "C2PA（Coalition for Content Provenance and Authenticity）は、画像・動画・音声の「来歴」を改ざん不可能な形で記録する国際標準。ProofMarkはこの規格への準拠を目指しています。",
      keyPoints: [
        "C2PA = Content Credentials（コンテンツ認証情報）の国際標準",
        "出自（誰が作ったか）と編集履歴（何がされたか）を記録",
        "Adobe、Microsoft、Intelなど大手企業が参加",
      ],
      explanation: `C2PA（Content Provenance and Authenticity Coalition）は、デジタルコンテンツの「来歴」を透明かつ改ざん不可能な形で記録するための国際標準です。

【C2PAが記録する情報】
• 作成者（誰が作ったか）
• 作成日時（いつ作ったか）
• 使用ツール（どのAIツールを使ったか）
• 編集履歴（何が編集されたか）
• ライセンス情報

【AI生成物との関連】
AI生成物は特に「来歴」が重要です。なぜなら：
• 「このAI出力は、どのモデルで、どのプロンプトで生成されたか」が明確になる
• 学習データの著作権侵害との区別が可能
• 創作性の判断材料になる

【ProofMarkとC2PAの関係】
ProofMarkは、C2PA規格への準拠を目指しており、あなたのAI生成物に対して：
1. SHA-256ハッシュで改ざん検知
2. タイムスタンプで先行作成を証明
3. C2PA形式で来歴情報を記録

これにより、あなたの創作は「完全に追跡可能な状態」になります。`,
      whyMatters:
        "C2PAに準拠することで、あなたの作品は国際的な信頼基準を満たします。将来、AI生成物の著作権が法的に確立される際、来歴情報が最強の証拠になります。",
      sources: [
        {
          title: "C2PA Official Website",
          url: "https://c2pa.org/",
          organization: "C2PA Coalition",
        },
        {
          title: "Content Credentials Explainer",
          url: "https://contentcredentials.org/",
          organization: "Content Credentials Initiative",
        },
        {
          title: "Adobe Content Authenticity Initiative",
          url: "https://www.adobe.com/content/dam/cc/en/trust-center/pdfs/Adobe_Content_Authenticity_Initiative.pdf",
          organization: "Adobe",
        },
      ],
    },
    relatedArticles: ["sha256-basics", "timestamp-proof"],
    cta: {
      text: "C2PA対応の証明を取得する",
      action: "register",
    },
  },
  {
    id: "browser-hash",
    title: "画像をアップロードせずブラウザ内でハッシュ化する意味",
    description: "プライバシーと信頼を両立させるProofMarkの設計思想",
    category: "セキュリティ",
    readTime: 3,
    slug: "browser-hash",
    content: {
      summary:
        "ProofMarkは、あなたの作品をサーバーに送信せず、ブラウザ内でハッシュ値を生成します。これにより、プライバシーを完全に守りながら、改ざん不可能な証明を実現します。",
      keyPoints: [
        "ブラウザ内処理 = あなたのデータはProofMarkのサーバーに到達しない",
        "ハッシュ値だけが記録される = 元の作品内容は秘密のまま",
        "プライバシー by Design = セキュリティが後付けではなく、設計の根幹",
      ],
      explanation: `一般的なクラウドサービスは、あなたのファイルをサーバーにアップロードして処理します。しかしProofMarkは異なります：

【ProofMarkの処理フロー】
1. あなたが画像をProofMarkのページにドラッグ＆ドロップ
2. ブラウザ内で、Web Crypto APIを使ってSHA-256ハッシュを計算
3. ハッシュ値だけがProofMarkのサーバーに送信される
4. 元の画像ファイルはあなたのパソコンに残ったままで、サーバーに送信されない

【なぜこれが重要か】
• あなたの作品内容は、ProofMarkのスタッフにも見えない
• サーバーが攻撃されても、元の作品データは盗まれない
• GDPR等のプライバシー規制に自動的に適合

【技術的背景】
ブラウザ内でハッシュ化を実現するには、Web Crypto APIという標準APIを使用します。これはすべてのモダンブラウザに搭載されており、JavaScriptで実装可能です。

【信頼の構造】
「ハッシュ値だけを記録する」という設計により：
• あなたはProofMarkを信頼する必要がない（あなたのデータが見られない）
• Proofmarkは、改ざん不可能な証明を提供できる
• 第三者は、ハッシュ値の真正性を検証できる`,
      whyMatters:
        "プライバシーとセキュリティが対立しないシステム。あなたの創作を完全に秘密にしながら、改ざん不可能な証明を手に入れられます。",
      sources: [
        {
          title: "Web Crypto API - MDN Web Docs",
          url: "https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API",
          organization: "MDN",
        },
        {
          title: "Privacy by Design - Information Commissioner's Office",
          url: "https://ico.org.uk/for-organisations/guide-to-data-protection/guide-to-the-general-data-protection-regulation-gdpr/",
          organization: "ICO",
        },
      ],
    },
    relatedArticles: ["sha256-basics", "ai-copyright-2026"],
    cta: {
      text: "プライバシーを守りながら証明する",
      action: "register",
    },
  },
];

export const getArticleById = (id: string): Article | undefined => {
  return articles.find((article) => article.id === id);
};

export const getRelatedArticles = (articleId: string): Article[] => {
  const article = getArticleById(articleId);
  if (!article) return [];
  return article.relatedArticles
    .map((id) => getArticleById(id))
    .filter((article): article is Article => article !== undefined);
};
