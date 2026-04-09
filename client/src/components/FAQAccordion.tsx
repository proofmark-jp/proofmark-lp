import { useState } from "react";
import { ChevronDown, ArrowRight } from "lucide-react";
import { Link } from "wouter";

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
    id: "free-vs-light",
    question: "料金について：FreeプランとLightプランの違いは何ですか？",
    answer: "Freeプランは月30件までの証明書発行が可能です。Lightプラン（¥480/月）は発行が無制限になり、さらにプロフェッショナルな「PDF証明書」のダウンロードや、高度な機能が利用可能になります。クライアントへの納品物に証明書を添付したい方には、Lightプランが最適です。",
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
        
        <div className="mt-8 flex justify-center">
          <Link href="/faq" className="inline-flex items-center gap-2 text-[#00D4AA] hover:text-white font-bold transition-colors">
            詳細なFAQ・法的有効性について確認する <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};