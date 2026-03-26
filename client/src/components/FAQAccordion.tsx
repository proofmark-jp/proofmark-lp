import { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * FAQAccordion Component
 * 修正版：最新のシステム仕様（サーバーサイドハッシュ・画像限定）に完全準拠
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
    answer: "はい。ProofMarkは「ダイレクトアップロード」を採用しています。作品ファイルは運営のWebサーバー（Vercel）を経由せず、強固なセキュリティを持つSupabase Storageへ直接暗号化転送されます。転送後にセキュアな環境でハッシュ計算が行われるため、通信経路上でデータが漏洩するリスクを極限まで抑えています。",
  },
  {
    id: "ai-training-use",
    question: "アップロードした画像がAIの学習に使われることはありますか？", // 【新規追加】最重要懸念
    answer: "絶対に（100%）ありません。ProofMarkはクリエイターの権利を保護するためのサービスであり、お預かりしたデータを生成AIの学習データとして第三者に提供したり、自社で利用したりすることは一切ありません。",
  },
  {
    id: "admin-visibility",
    question: "画像データは運営側に見られませんか？", // 【新規追加】プライバシー懸念
    answer: "画像はアプリサーバーを一切経由せず、高度なセキュリティで保護されたクラウドストレージに直接保存されます。システム的にハッシュ値（指紋）を計算する以外の目的で、運営スタッフが意図的にユーザーの非公開画像を閲覧する仕組みにはなっていません。",
  },
  {
    id: "post-certificate-deletion",
    question: "証明書を発行した後、画像はどうなりますか？", // 【新規追加】データ保持懸念
    answer: "証明書発行後、ご自身でいつでもストレージから画像を削除することが可能です。画像本体を削除しても、データベースに記録されたデジタル指紋（ハッシュ）とタイムスタンプによる証明の効力が失われることはありません。",
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
    answer: "AdobeやMicrosoftなどが推進する、デジタルコンテンツの由来を証明するための国際標準規格です。ProofMarkはこの規格の考え方に準拠しており、将来的に業界標準の証明フォーマットとしての価値を持つことを目指しています。",
  },
  {
    id: "free-vs-light",
    question: "FreeプランとLightプランの違いは何ですか？",
    answer: "Freeプランは月30件までの登録が可能です。Lightプラン（¥480/月）は登録が無制限になり、さらにプロフェッショナルな「PDF証明書」のダウンロードが可能になります。クライアントへの納品物に証明書を添付したい方には、Lightプランが最適です。",
  },
  {
    id: "export-certificate",
    question: "証明書をPDFでダウンロードできますか？",
    answer: "はい、Standardプラン以上（または先行登録特典）で可能です。PDF証明書には、SHA-256ハッシュ値、タイムスタンプ、3拠点の保存証明がすべて記載されます。これをポートフォリオに添付したり、クライアントに提示したり、著作権侵害の証拠として保管できます。",
  },
  {
    id: "ai-tools-compatible",
    question: "どのAIツールの出力に対応していますか？",
    answer: "Midjourney、Stable Diffusion、DALL-E、Adobe Fireflyなど、すべての生成AIツールに対応しています。出力された画像形式（JPG、PNG、WebP、GIF、AVIF）であれば、そのままドラッグ&ドロップで登録可能です。※現在、セキュリティ保護のためSVGやPDF形式には対応しておりません。",
  },
  {
    id: "portfolio-use",
    question: "ProofMarkをポートフォリオでどう活用すればいいですか？",
    answer: "完成品だけでなく、制作途中のデータをProofMarkに登録しておくことをおすすめします。「制作プロセス」を段階的に記録することで、AIとの協働作業を客観的に証明でき、コンプライアンス意識の高いクリエイターとしてクライアントからの信頼性が飛躍的に向上します。",
  },
  {
    id: "client-explanation",
    question: "クライアントにどう説明すればいいですか？",
    answer: "納品時にProofMarkのPDF証明書やリンクを添付し、『この作品はSHA-256とタイムスタンプにより、私が制作した事実が客観的に証明されています』と伝えてください。技術的な詳細よりも『第三者機関による改ざん不能な記録がある』という事実が、クライアントに大きな安心感を与えます。",
  },
  {
    id: "how-to-use",
    question: "使い方は簡単ですか？",
    answer: "非常に簡単です。（1）作品画像をアップロード、（2）『証明書を生成』をクリック、（3）SHA-256ハッシュとタイムスタンプが自動生成される、この3ステップです。技術知識は一切不要です。",
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
            <a href="#" className="text-primary font-bold hover:underline">
              お問い合わせ
            </a>
            までお気軽にどうぞ。
          </p>
        </div>
      </div>
    </section>
  );
};