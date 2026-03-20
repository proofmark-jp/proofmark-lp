import { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * FAQAccordion Component
 * Design: Cyber-Minimalist Security
 * 
 * Displays frequently asked questions in an accordion format.
 * Builds trust through transparency and education.
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
    answer: "SHA-256（Secure Hash Algorithm 256-bit）は、世界中で最も信頼されている暗号化ハッシュ関数です。画像を一意の「デジタル指紋」に変換し、その指紋から元の画像を復元することは物理的に不可能です。つまり、あなたの作品が改ざんされたかどうかを、この指紋で永遠に検証できるということです。",
  },
  {
    id: "is-data-safe",
    question: "データは本当に安全ですか？",
    answer: "はい。ProofMarkは画像をサーバーに送信しません。すべての処理はあなたのブラウザ内で完結します。生成されるのはSHA-256ハッシュ値（64文字の英数字）だけで、これから元の画像を復元することは不可能です。さらに、タイムスタンプは東京・大阪・シンガポールの3拠点に分散保存されるため、単一障害点がありません。",
  },
  {
    id: "how-timestamp-works",
    question: "タイムスタンプはどのように機能しますか？",
    answer: "タイムスタンプは、あなたがいつ作品を登録したかを、改ざん不能な形で記録します。これにより、『この作品は2026年3月16日14:32:19に私が作った』という事実が、法的に証明可能になります。DMCA申請や著作権侵害の訴訟では、このタイムスタンプが『先に作った』という証拠として機能します。",
  },
  {
    id: "what-is-c2pa",
    question: "C2PAとは何ですか？",
    answer: "C2PA（Coalition for Content Provenance and Authenticity）は、Adobe、Microsoft、Intelなど大手テック企業が設立した国際的な規格です。デジタルコンテンツの『由来』と『真正性』を証明するための標準フォーマットです。ProofMarkはこの規格に準拠しているため、将来的に業界標準となった時点で、あなたの証明書は自動的に高い価値を持つようになります。",
  },
  {
    id: "free-vs-standard",
    question: "FreeプランとStandardプランの違いは何ですか？",
    answer: "Freeプランは月10件までの証明書生成が可能で、基本的なセキュリティ機能を備えています。Standardプランは無制限の証明書生成、PDF証明書のダウンロード、制作工程の記録、全データのエクスポートが可能です。副業で複数の作品を登録する場合は、Standardプランがお勧めです。",
  },
  {
    id: "how-to-use",
    question: "使い方は簡単ですか？",
    answer: "非常に簡単です。（1）作品画像をアップロード、（2）『証明書を生成』をクリック、（3）SHA-256ハッシュとタイムスタンプが自動生成される、この3ステップです。技術知識は一切不要で、AIツール（Midjourney、Stable Diffusion、DALL-E等）の出力画像をそのままドラッグ&ドロップするだけです。",
  },
  {
    id: "export-certificate",
    question: "証明書をPDFでダウンロードできますか？",
    answer: "はい、Standardプラン以上で可能です。PDF証明書には、SHA-256ハッシュ値、タイムスタンプ、3拠点の保存証明がすべて記載されます。これをポートフォリオに添付したり、クライアントに提示したり、著作権侵害の証拠として保管できます。",
  },
  {
    id: "ai-tools-compatible",
    question: "どのAIツールの出力に対応していますか？",
    answer: "ProofMarkはすべてのAIツールに対応しています。Midjourney、Stable Diffusion、DALL-E、Adobe Firefly、その他の生成AIツールの出力画像であれば、形式に関わらずSHA-256ハッシュを生成できます。画像形式（JPG、PNG、WebPなど）も問いません。",
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
                  className={`w-5 h-5 text-primary flex-shrink-0 transition-transform duration-300 ${
                    openId === item.id ? "rotate-180" : ""
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
            その他のご質問は、<a href="#" className="text-primary font-bold hover:underline">お問い合わせ</a>までお気軽にどうぞ。
          </p>
        </div>
      </div>
    </section>
  );
};
