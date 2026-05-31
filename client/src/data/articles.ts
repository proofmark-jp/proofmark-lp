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
    description: "暗号学的に保護された「同一性」を証明する仕組み",
    category: "技術解説",
    readTime: 3,
    slug: "sha256-basics",
    content: {
      summary:
        "SHA-256はハッシュ関数で、作品データから一意の「デジタル指紋」を生成します。1ピクセルでも画像が書き換えられれば全く別の指紋になるため、改ざん検知に利用されます。",
      keyPoints: [
        "ハッシュ = 一方向の変換（元のデータには戻せない）",
        "同じ入力なら同じ出力（改ざんされると出力が変わる）",
        "256ビット = 実質的に衝突（重複）不可能",
      ],
      explanation: `SHA-256（Secure Hash Algorithm 256-bit）は、NIST（米国国立標準技術研究所）が定めるハッシュ関数です。

あなたのAI生成画像をSHA-256で処理すると、256ビット（64文字の英数字）の「ハッシュ値」が生成されます。この値は：

• 元の画像の「デジタル指紋」
• 1ピクセルでも変わると、ハッシュ値も変わる
• ハッシュ値から元の画像を逆算することは不可能

ProofMarkでは、あなたの作品を安全なストレージへダイレクト転送し、サーバーサイドでこのハッシュ値を計算します。計算されたハッシュ値はタイムスタンプとともに記録され、後から「この画像は改ざんされていない私のオリジナルだ」と証明するための強固な証拠になります。`,
      whyMatters:
        "画像の見た目ではなく「データそのものの同一性」を数学的に証明できます。これにより、パクリや無断加工を客観的に見破ることができます。",
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
    relatedArticles: ["timestamp-proof", "human-collaboration"],
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
ProofMarkは、あなたのハッシュ値に対してタイムスタンプを付与し、複数拠点に分散保存します。これにより、「この日時に、このハッシュ値が存在していた」という事実が、第三者によって検証可能になります。`,
      whyMatters:
        "単なる「作成日時」ではなく、1ビットの改変も許さない暗号証明によって先行作成を証明できます。無断転載や自作発言に対する法的根拠が格段に強くなります。",
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
        "C2PA（Coalition for Content Provenance and Authenticity）は、画像・動画・音声の「来歴」を暗号学的に保護された状態で記録する国際標準。ProofMarkはこの規格への準拠を目指しています。",
      keyPoints: [
        "C2PA = Content Credentials（コンテンツ認証情報）の国際標準",
        "出自（誰が作ったか）と編集履歴（何がされたか）を記録",
        "Adobe、Microsoft、Intelなど大手企業が参加",
      ],
      explanation: `C2PA（Content Provenance and Authenticity Coalition）は、デジタルコンテンツの「来歴」を透明かつ暗号学的に保護された状態で記録するための国際標準です。

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
    id: "human-collaboration",
    title: "「人間の手が入っている」ことを証明する価値",
    description: "AIの丸出しではなく、あなたの「創作的寄与」を記録する",
    category: "権利保護",
    readTime: 3,
    slug: "human-collaboration",
    content: {
      summary:
        "AIが全自動で作った画像に著作権は発生しませんが、人間が加筆修正（創作的寄与）を加えた部分には権利が認められる可能性が高まります。その「制作過程」を証明することが次世代のクリエイターの武器になります。",
      keyPoints: [
        "AI全自動生成 = 著作権なし（パブリックドメイン扱い）",
        "人間の加筆・修正・合成 = その部分に著作権が発生しうる",
        "制作過程（Before/After）の記録が、最強の防衛策になる",
      ],
      explanation: `現在の著作権法の解釈では、「プロンプトを入力してAIが出力しただけの画像」には著作権は認められません。しかし、そこにクリエイターが「意図的な加筆・修正・合成」などの創作的寄与を加えた場合、その人間が手を加えた部分に対しては権利が保護される可能性が高まります。

【なぜ証明が必要なのか？】
完成した作品を見ただけでは、第三者やSNSの運営には「どこまでがAIで、どこからが人間の手作業か」が分かりません。もし無断転載された時に「どうせAI出力のままでしょ？著作権なんて無いでしょ？」と言いがかりをつけられるリスクがあります。

【ProofMarkが提供する未来の防衛策】
これを防ぐ最も確実な方法は、「制作プロセス」を記録することです。
1. AIが出力した直後の「元画像」をProofMarkでハッシュ化
2. 加筆修正を終えた「完成品」をProofMarkでハッシュ化

この「Before / After」の両方にタイムスタンプを残すことで、「私がAIの出力に、これだけの加筆（人間の手）を加えた」という客観的な証拠（エビデンス）が完成します。`,
      whyMatters:
        "「どうせAIでしょ？」という言葉に対する最強のカウンターになります。AIをツールとして使いこなす、あなたのプロフェッショナルな創作プロセスを証明できます。",
      sources: [
        {
          title: "AIと著作権に関する考え方",
          url: "https://www.bunka.go.jp/seisaku/chosakuken/ai/",
          organization: "文化庁",
        },
      ],
    },
    relatedArticles: ["ai-copyright-2026", "timestamp-proof"],
    cta: {
      text: "制作過程の証明を始める",
      action: "register",
    },
  },
  {
    id: "privacy-policy",
    title: "プライバシーポリシー",
    description: "ProofMarkにおける個人情報の取り扱いについて",
    category: "法的",
    readTime: 3,
    slug: "privacy-policy",
    content: {
      summary:
        "ProofMark（以下「本サービス」）は、ユーザーのプライバシーを最大限に尊重しています。本ポリシーは、本サービスが収集・利用する情報の種類と、その取り扱い方針を定めるものです。",
      keyPoints: [
        "収集する情報：先行登録時のメールアドレスのみ。画像・作品データは一切収集しません",
        "利用目的：β版リリース通知・サービスのご案内のみに使用します",
        "第三者提供：法令に基づく場合を除き、第三者に個人情報を提供しません",
      ],
      explanation: `【収集する個人情報】
本サービスが収集する個人情報は、先行登録フォームにご入力いただいたメールアドレスのみです。

画像や作品データについては、Vercelサーバーを経由せずSupabase Storageへダイレクト転送され、ハッシュ計算後に安全に保管（または破棄）されます。ハッシュ値から元の作品が第三者に復元されることはありません。

【利用目的】
• β版リリースのご連絡
• ProofMarkのサービス情報のご案内
• ユーザーサポートのご連絡

【情報の管理】
収集したメールアドレスは、適切なセキュリティ対策（SSL/TLS暗号化通信）を実施したサーバーで管理します。

【第三者への提供】
以下の場合を除き、ユーザーの個人情報を第三者に提供しません：
• ユーザーの同意がある場合
• 法令に基づく開示要求がある場合
• 統計的なデータ（個人を特定できない形式）として利用する場合

【メール送信サービス】
メール送信にはResend（resend.com）のサービスを利用しています。同サービスのプライバシーポリシーが適用されます。

【登録解除】
受信したメールのフッターにある「配信停止」リンクから、いつでも登録を解除できます。

【お問い合わせ】
個人情報の取り扱いに関するご質問は、X（Twitter）@ProofMark_jp までお気軽にお問い合わせください。

【改定】
本ポリシーは、法律の改正やサービスの変更に応じて改定することがあります。重要な変更の際は、メールでご通知します。

最終更新：2026年3月`,
      whyMatters:
        "ProofMarkはセキュリティとプライバシーを設計の根幹に置いています。あなたの作品データを強固に保護しながら、ハッシュ値による権利証明を実現します。",
      sources: [
        {
          title: "個人情報の保護に関する法律（個人情報保護法）",
          url: "https://www.ppc.go.jp/personalinfo/",
          organization: "個人情報保護委員会",
        },
      ],
    },
    relatedArticles: ["terms-of-service"],
    cta: {
      text: "安心して先行登録する",
      action: "register",
    },
  },
  {
    id: "terms-of-service",
    title: "利用規約",
    description: "ProofMarkサービスの利用条件と禁止事項",
    category: "法的",
    readTime: 3,
    slug: "terms-of-service",
    content: {
      summary:
        "本利用規約は、ProofMark（以下「本サービス」）の利用に関する条件を定めるものです。先行登録または本サービスをご利用いただくことで、本規約に同意したものとみなします。",
      keyPoints: [
        "本サービスはβ版の先行登録サービスであり、機能・料金は変更される場合があります",
        "違法行為や第三者の権利を侵害する目的での利用は禁止です",
        "当社は事前通知なくサービスを変更・終了できる権利を留保します",
      ],
      explanation: `【サービスの概要】
ProofMarkは、AI生成コンテンツを含むデジタル作品のSHA-256ハッシュ値とタイムスタンプを記録し、先行作成を証明するサービスです。現在は先行登録の受け付けのみを行っています。

【利用条件】
本サービスをご利用いただくには：
• 13歳以上であること
• 正確な情報（メールアドレス等）をご提供いただくこと
• 本規約・プライバシーポリシーに同意すること

【禁止事項】
以下の行為は禁止します：
• 第三者の著作権・知的財産権を侵害する目的での利用
• 虚偽の情報を登録する行為
• 本サービスのシステムへの不正アクセス・妨害
• スパムやフィッシング行為

【免責事項】
• 本サービスはβ版開発中のサービスです。機能・料金・提供内容は予告なく変更される場合があります
• ProofMarkの証明書は客観的証拠能力を提供するものであり、法的な権利の発生自体を確定させるものではありません
• 本サービスの利用により生じた損害について、当社は法令の範囲内でのみ責任を負います

【知的財産権】
本サービスのロゴ・デザイン・コードの著作権はProofMarkに帰属します。ユーザーが登録するハッシュ値に対する権利はユーザーに帰属します。

【準拠法】
本規約は日本国法に準拠し、東京地方裁判所を第一審の専属的合意管轄裁判所とします。

【改定】
本規約は予告なく改定することがあります。重要な変更の際はメールでご通知します。

最終更新：2026年3月`,
      whyMatters:
        "利用規約はユーザーと本サービスの信頼関係の基盤です。明確で誠実な規約により、安心してサービスをご利用いただけます。",
      sources: [
        {
          title: "特定商取引法に基づく表示",
          url: "https://www.no-trouble.caa.go.jp/",
          organization: "消費者庁",
        },
      ],
    },
    relatedArticles: ["privacy-policy"],
    cta: {
      text: "内容を了承して先行登録する",
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