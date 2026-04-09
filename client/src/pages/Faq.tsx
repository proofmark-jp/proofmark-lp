import React, { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { Link } from "wouter";

interface FAQItem {
  id: string;
  question: string;
  answer: React.ReactNode;
}

const faqData: FAQItem[] = [
  {
    id: "copyright",
    question: "これは著作権を保証しますか？",
    answer: (
      <>
        <p>ProofMarkは、お客様の作品の<strong>「特定の日時に、その内容で存在していたこと」</strong>および<strong>「発行後に改ざんされていないこと」</strong>を技術的に証明するサービスです。これは、著作権侵害や模倣品問題が発生した際に、お客様の主張を裏付ける強力な客観的証拠となり得ます。</p>
        <p>しかし、ProofMarkが直接的に<strong>「著作権の帰属そのもの」や「作品の独創性」を法的に保証するものではありません。</strong>著作権は、作品を創作した時点で自動的に発生する権利であり、ProofMarkは創作の事実を補強する証拠を提供します。法的判断については、弁護士などの専門家にご相談ください。</p>
      </>
    ),
  },
  {
    id: "ai-use",
    question: "AI生成でも使えますか？",
    answer: (
      <>
        <p>はい、AI生成作品でもProofMarkをご利用いただけます。AI技術の進化により、作品の「いつ、誰が、どのように作ったか」が曖昧になりがちですが、ProofMarkはAI生成作品に対しても<strong>「特定の日時に、その作品が存在したこと」</strong>を客観的に証明します。</p>
        <p>これにより、AI生成作品のオリジナル性を主張する際の根拠を強化し、クリエイターの権利保護に貢献します。</p>
      </>
    ),
  },
  {
    id: "storage",
    question: "原画は保存されますか？",
    answer: (
      <>
        <p>いいえ、お客様の作品データ（原画やオリジナルファイル）そのものがProofMarkのサーバーに保存されることは<strong>一切ありません。</strong></p>
        <p>ProofMarkは、お客様のブラウザ内で作品データからSHA-256ハッシュ値を計算し、そのハッシュ値に対してタイムスタンプを付与します。サーバーに保存されるのは、このハッシュ値とタイムスタンプ情報のみです。これにより、お客様の作品のプライバシーと機密性が最大限に保護されます。</p>
      </>
    ),
  },
  {
    id: "visibility",
    question: "公開リンクに何が表示されますか？",
    answer: (
      <>
        <p>ProofMarkが発行するデジタル証明書には、以下の情報が表示されます。</p>
        <ul className="list-disc pl-5 space-y-1 my-4">
          <li>作品のサムネイル（任意でアップロードされた場合）</li>
          <li>ProofMark Issuedの表示</li>
          <li>Verified / Authenticity Certificateの表示</li>
          <li>SHA-256 Hash値</li>
          <li>Timestamp (UTC)</li>
          <li>QR Code（検証用公開ページへのリンク）</li>
          <li>Certificate ID</li>
          <li>Privacy-first / Direct Upload の小ラベル</li>
        </ul>
        <p>公開リンク（検証用公開ページ）にアクセスすると、これらの情報が表示され、第三者が作品のハッシュ値とタイムスタンプの有効性をその場で検証できる仕組みを提供します。</p>
      </>
    ),
  },
  {
    id: "c2pa",
    question: "C2PAとの違いは？",
    answer: (
      <>
        <p>C2PA (Coalition for Content Provenance and Authenticity) は、コンテンツの「来歴（来し方）」と「真正性」を検証するためのオープンな技術標準です。コンテンツに作成者や編集履歴などのメタデータを埋め込むことで、そのコンテンツがどのように作られ、変更されたかを追跡することを目的としています。</p>
        <p>一方、ProofMarkは、デジタルコンテンツの<strong>「特定日時における存在証明」と「非改ざん証明」</strong>に特化しています。SHA-256ハッシュとRFC3161準拠のタイムスタンプにより、「いつ、その作品が存在したか」という揺るぎない事実を確立します。</p>
        <p>両者は補完的な関係にあり、C2PAがコンテンツの「来歴」を、ProofMarkがコンテンツの「存在時期」を証明することで、デジタル作品の信頼性を多角的に高めることができます。</p>
      </>
    ),
  },
  {
    id: "firefly",
    question: "Adobe/Fireflyとの違いは？",
    answer: (
      <>
        <p>AdobeやFireflyなどのAI生成ツールは、C2PAの技術を活用し、生成されたコンテンツに「コンテンツクレデンシャル」として生成履歴や使用ツールなどの情報を付与する機能を提供しています。これは、コンテンツの「来歴」を明らかにするものです。</p>
        <p>ProofMarkは、特定の生成ツールに依存せず、<strong>あらゆるデジタルコンテンツに対して「特定の日時に存在したこと」を証明</strong>します。Adobe/Fireflyが「このコンテンツはAIによって生成された」という情報を提供するのに対し、ProofMarkは「このコンテンツが、いつ、どのような形で存在したか」という客観的な事実を提供します。</p>
        <p>ProofMarkは、Adobe/Fireflyのような生成ツールと競合するものではなく、むしろそれらのツールで生成された作品の「存在証明」を補強する役割を担います。</p>
      </>
    ),
  },
  {
    id: "legal",
    question: "裁判で使えますか？",
    answer: (
      <>
        <p>ProofMarkが発行するRFC3161準拠のタイムスタンプは、日本の電子署名法において「時刻認証業務の認定に関する指針」を満たすものであり、<strong>法的証拠力を持つ</strong>とされています。これにより、デジタルコンテンツの存在時期と非改ざん性を証明する客観的な証拠として、裁判などの法的な場で活用できる可能性があります。</p>
        <p>ただし、個別の裁判における証拠としての採用の可否や、その証拠価値の判断は、裁判所の裁量や具体的な事案によって異なります。最終的な法的判断については、必ず弁護士などの専門家にご相談ください。</p>
      </>
    ),
  },
  {
    id: "compression",
    question: "SNSで画像が圧縮されても意味はありますか？",
    answer: (
      <>
        <p>はい、SNSで画像が圧縮されてもProofMarkの証明は意味を持ちます。</p>
        <p>ProofMarkは、<strong>元の作品データから計算されたSHA-256ハッシュ値</strong>に対してタイムスタンプを付与します。SNSにアップロードされて圧縮された画像は、元の画像とは異なるハッシュ値を持つことになりますが、ProofMarkの証明書は「元の画像が特定の日時に存在したこと」を証明するものです。</p>
        <p>万が一、SNS上の圧縮画像が盗用された場合でも、ProofMarkの証明書と元の作品データがあれば、その作品がお客様によって先に存在していたことを客観的に示すことができます。</p>
      </>
    ),
  },
  {
    id: "existing",
    question: "既存作品にも使えますか？",
    answer: (
      <>
        <p>はい、ProofMarkは既存の作品にもご利用いただけます。過去に作成されたデジタル作品であっても、ProofMarkにアップロードしていただくことで、<strong>「ProofMarkで証明書を発行した時点」</strong>での作品の存在と非改ざん性を証明できます。</p>
        <p>これにより、過去の作品に対する権利保護を強化し、将来的な紛争に備えることが可能です。</p>
      </>
    ),
  },
  {
    id: "misuse",
    question: "無断転載された時はどう使いますか？",
    answer: (
      <>
        <p>ProofMarkの証明書は、作品が無断転載された際に、お客様の作品が<strong>「転載された日時よりも前に存在していたこと」</strong>を客観的に示す強力な証拠となります。</p>
        <p>以下のようにお使いいただけます。</p>
        <ol className="list-decimal pl-5 space-y-1 my-4">
          <li><strong>転載者への警告</strong>: 証明書を提示し、作品の存在時期を明確に伝えることで、転載者に削除を促すことができます。</li>
          <li><strong>プラットフォームへの報告</strong>: SNSやコンテンツプラットフォームの運営者に対し、著作権侵害の報告を行う際に、ProofMarkの証明書を添付することで、お客様の主張の信頼性を高めることができます。</li>
          <li><strong>法的措置の検討</strong>: 弁護士に相談する際、ProofMarkの証明書は、お客様の権利を主張するための重要な証拠となります。</li>
        </ol>
        <p>ProofMarkは、お客様がご自身の作品を守るための「武器」を提供します。無断転載を発見した際は、冷静に証拠を収集し、適切な対応を取ることが重要です。</p>
      </>
    ),
  },
];

export default function Faq() {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] pt-32 pb-24 px-6 md:px-12">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#6C3EF4]/10 border border-[#6C3EF4]/30 text-[#6C3EF4] text-xs font-bold tracking-widest uppercase mb-6">
            <HelpCircle className="w-4 h-4" /> FAQ
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-6">
            よくある質問
          </h1>
          <p className="text-[#A8A0D8] text-lg max-w-2xl mx-auto leading-relaxed">
            ProofMarkに関する疑問や不安を解消し、安心してサービスをご利用いただくための情報を提供します。
          </p>
        </header>

        <div className="space-y-4">
          {faqData.map((item, index) => (
            <div
              key={item.id}
              className="group animate-in fade-in slide-in-from-bottom-4 duration-700"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div
                className={`
                  border transition-all duration-300 rounded-2xl overflow-hidden
                  ${openId === item.id 
                    ? "bg-[#0D0B24] border-[#6C3EF4]/50 shadow-[0_0_30px_rgba(108,62,244,0.1)]" 
                    : "bg-[#0D0B24]/50 border-[#1C1A38] hover:border-[#6C3EF4]/30"}
                `}
              >
                <button
                  onClick={() => toggle(item.id)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className={`text-lg font-bold transition-colors ${openId === item.id ? "text-[#00D4AA]" : "text-[#F0EFF8]"}`}>
                    {item.question}
                  </span>
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300
                    ${openId === item.id ? "bg-[#6C3EF4] rotate-180" : "bg-[#1C1A38] group-hover:bg-[#1C1A38]/80"}
                  `}>
                    <ChevronDown className="w-5 h-5 text-white" />
                  </div>
                </button>
                <div 
                  className={`
                    transition-all duration-300 overflow-hidden
                    ${openId === item.id ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"}
                  `}
                >
                  <div className="p-6 pt-0 text-[#D4D0F4] leading-relaxed border-t border-[#1C1A38]/50 space-y-4">
                    {item.answer}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 text-center animate-in fade-in duration-1000">
          <Link href="/" className="inline-flex items-center text-[#6C3EF4] font-bold hover:text-[#00D4AA] transition-colors gap-2">
            ← トップページへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
