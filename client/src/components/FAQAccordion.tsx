import { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * FAQAccordion Component
 * 修正版：最新のシステム仕様（ブラウザ内ハッシュ計算・ハイブリッドクラウド保存）に完全準拠
 * 追加：AIクリエイター向けのプライバシー・学習利用に関するFAQを強化
 */

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    id: "what-is-sha256",
    question: "SHA-256とは何ですか？",
    answer: "SHA-256は世界標準の暗号化技術です。画像データを「デジタル指紋（ハッシュ値）」に変換します。1ピクセルでも画像が書き換えられればこの指紋は全く別のものになるため、あなたの作品が「いつからその状態であったか」を改ざん不能な形で証明できます。指紋から元の画像を復元することは不可能です。",
  },
  {
    id: "is-data-safe",
    question: "データは本当に安全ですか？",
    answer: "はい。ProofMarkの最も重要な特徴として、ハッシュ計算（暗号化）はすべて「あなたのブラウザ内」で完結し、サーバーに負荷や情報を渡しません。その後、ポートフォリオ公開用の作品データのみが、アプリサーバー（Vercel）を一切バイパスして、堅牢なSupabase Storageへ直接暗号化転送されます。通信経路での漏洩リスクを極限まで抑えた設計です。",
  },
  {
    id: "ai-training-use",
    question: "アップロードした画像がAIの学習に使われることはありますか？",
    answer: "絶対に（100%）ありません。ProofMarkはクリエイターの権利を保護するためのサービスであり、お預かりしたポートフォリオ用のデータを生成AIの学習データとして第三者に提供したり、自社で利用したりすることは一切ありません。",
  },
  {
    id: "admin-visibility",
    question: "画像データは運営側に見られませんか？",
    answer: "ハッシュ値はユーザーのブラウザ内で計算されるため、証明書を発行するだけであれば運営が画像の内容を知ることはシステム上不可能です。また、クラウドに保存されたポートフォリオ用の画像データについても、厳格なセキュリティポリシー（RLS）で保護されており、運営スタッフが意図的にユーザーの非公開画像を閲覧する仕組みにはなっていません。",
  },
  {
    id: "post-certificate-deletion",
    question: "証明書を発行した後、画像はどうなりますか？",
    answer: "証明書発行後、ご自身でいつでもクラウドストレージから画像を削除することが可能です。画像本体を削除しても、データベースに記録されたデジタル指紋（ハッシュ）とタイムスタンプによる証明の効力が失われることはありません。",
  },
  {
    id: "how-timestamp-works",
    question: "タイムスタンプはどのように機能しますか？",
    answer: "あなたが作品を登録した「日時」を、修正不可能な形で記録します。これにより、パクリトラブルや無断転載が起きた際、「相手よりも先に自分がこの作品を所持していた」という客観的な先着証明（エビデンス）として、プラットフォーム運営への異議申し立て等に活用できます。",
  },
  {
    id: "about-copyright",
    question: "ProofMarkを使うと著作権が発生するのですか？",
    answer: "ProofMark自体が法的な著作権（Copyright）を付与するものではありません。しかし、「あなたがこの日時にこのデータを所持していた」という改ざん不能な事実を記録します。AI作品の権利関係が曖昧な現代において、この客観的証拠は、自身の正当性を主張し、作品を守るための「強力な武器」として機能します。",
  },
  {
    id: "what-is-c2pa",
    question: "C2PAとは何ですか？",
    answer: "AdobeやMicrosoftなどが推進する、デジタルコンテンツの由来を証明するための国際標準規格です。ProofMarkはこの規格の考え方をベースに設計されており、将来のアップデートでC2PAメタデータの読み取り・付与に完全対応する予定です。",
  },
  {
    id: "free-vs-light",
    question: "FreeプランとLightプランの違いは何ですか？",
    answer: "Freeプランは月30件までの証明書発行が可能です。Lightプラン（¥480/月）は発行が無制限になり、さらにプロフェッショナルな「PDF証明書」のダウンロードや、高度な機能が利用可能になります。クライアントへの納品物に証明書を添付したい方には、Lightプランが最適です。",
  },
  {
    id: "export-certificate",
    question: "証明書をPDFでダウンロードできますか？",
    answer: "はい、Lightプラン以上（または先行登録特典）で対応予定です。PDF証明書には、SHA-256ハッシュ値、タイムスタンプ、保存証明がすべて記載されます。これをポートフォリオに添付したり、クライアントに提示したり、著作権侵害の証拠として保管できます。",
  },
  {
    id: "ai-tools-compatible",
    question: "どのAIツールの出力に対応していますか？",
    answer: "Midjourney、Stable Diffusion、DALL-E、Adobe Fireflyなど、すべての生成AIツールに対応しています。出力された画像形式（JPG、PNG、WebP、GIF、AVIF）であれば、そのままドラッグ&ドロップで登録可能です。※現在、セキュリティ保護のためSVG形式には対応しておりません。",
  },
  {
    id: "portfolio-use",
    question: "ProofMarkをポートフォリオでどう活用すればいいですか？",
    answer: "完成品だけでなく、制作途中のデータをProofMarkに登録しておくことをおすすめします。「制作プロセス」を段階的に記録し、公開ポートフォリオで提示することで、AIとの協働作業を客観的に証明でき、クライアントからの信頼性が飛躍的に向上します。",
  },
  {
    id: "client-explanation",
    question: "クライアントにどう説明すればいいですか？",
    answer: "納品時にProofMarkの証明書リンク（またはPDF）を添付し、『この作品はSHA-256とタイムスタンプにより、私が制作した事実が客観的に証明されています』と伝えてください。技術的な詳細よりも『第三者機関による改ざん不能な記録がある』という事実が、クライアントに大きな安心感を与えます。",
  },
  {
    id: "how-to-use",
    question: "使い方は簡単ですか？",
    answer: "非常に簡単です。（1）作品画像をアップロード、（2）ハッシュとタイムスタンプが自動生成される、（3）証明書ページが発行される、というシンプルなステップです。難しい技術知識は一切不要です。",
  },
];

export const FAQAccordion = () => {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-black mb-4">よくある質問</h2>
          <p className="text-muted max-w-2xl mx-auto">
            AIクリエイターが疑問に思うことを、すべてお答えします。
          </p>
        </div>

        <div className="space-y-3">
          {faqItems.map((item) => (
            <div
              key={item.id}
              className="border border-border rounded-xl overflow-hidden bg-card/50 hover:bg-card/80 transition-colors"
            >
              <button
                onClick={() => setOpenId(openId === item.id ? null : item.id)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-card/50 transition-colors"
                aria-expanded={openId === item.id}
                aria-controls={`faq-${item.id}`}
              >
                <span className="font-bold text-foreground pr-4">{item.question}</span>
                <ChevronDown
                  className={`w-5 h-5 text-primary flex-shrink-0 transition-transform duration-300 ${openId === item.id ? "rotate-180" : ""
                    }`}
                />
              </button>

              {openId === item.id && (
                <div
                  id={`faq-${item.id}`}
                  className="px-6 py-4 border-t border-border bg-secondary/30 animate-in fade-in duration-200"
                >
                  <p className="text-muted leading-relaxed text-sm">{item.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 p-6 rounded-xl bg-primary/10 border border-primary/20">
          <p className="text-sm text-muted text-center">
            その他のご質問は、
            <a href="https://x.com/ProofMark_jp" target="_blank" rel="noopener noreferrer" style={{ color: "#6C3EF4", textDecoration: "underline" }}>
              お問い合わせ
            </a>
            までお気軽にどうぞ。
          </p>
        </div>
      </div>
    </section>
  );
};