import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { Link } from 'wouter';
import SEO from '../components/SEO';
import { PRICING_PLANS } from '../data/pricingPlans';

/**
 * FAQ (The Apex Blueprint Edition)
 * ─────────────────────────────────────────────
 * - 価格表記は data/pricingPlans.ts と完全一致。
 * - 旧時代の遺物（OpenSSL, verify.py, 単一TSA）への言及を完全パージ。
 * - AWS KMS、W3C VC/C2PA、Edge防衛、決済フェイルセーフの思想を統合。
 * - 日本語トーンをエンタープライズ・SaaS品質の自然で重厚な文体へ全面推敲。
 */

interface FAQItem {
  id: string;
  question: string;
  answer: React.ReactNode;
  schemaText: string;
}

const getPrice = (planId: string) => {
  const plan = PRICING_PLANS.find((p) => p.id === planId);
  return plan ? `${plan.priceLabel}${plan.priceUnit}` : '';
};

const faqData: FAQItem[] = [
  {
    id: 'pricing',
    question: '料金プランについて教えてください',
    schemaText: `ProofMarkはFree(${getPrice('free')}、月30件/Web証明のみ)、Spot(${getPrice('spot')}、1案件ごとの即発行)、Creator(${getPrice('creator')}、月30件までのEvidence Pack発行と制作工程の連鎖証明)、Studio(${getPrice('studio')}、月150件までのチーム管理・監査ログ)、Business/API(要問い合わせ)の5階層です。`,
    answer: (
      <>
        <p>ProofMarkは、単なる証明回数ではなく「納品信頼の運用」に基づいた料金体系を提供しています。</p>
        <ul className="list-disc pl-5 space-y-1 my-4">
          <li><strong>Free（{getPrice('free')}）</strong>: 月30件までのWeb証明（PDF・ZIP発行は非対応）</li>
          <li><strong>Spot（{getPrice('spot')}）</strong>: アカウント登録不要、1案件ごとのEvidence Pack即時発行</li>
          <li><strong>Creator（{getPrice('creator')}）</strong>: PDF・Evidence Pack発行（月30件）・制作過程の連鎖証明（Chain of Evidence）</li>
          <li><strong>Studio（{getPrice('studio')}）</strong>: PDF・Evidence Pack発行（月150件）・チーム管理・改ざん防止監査ログ</li>
          <li><strong>Business / API</strong>: 専用API・SLA保証・商用TSA対応・個別DPA締結（要問い合わせ）</li>
        </ul>
        <p>詳細は<Link href="/pricing" style={{ color: '#00D4AA', textDecoration: 'underline' }}>料金プランページ</Link>をご確認ください。</p>
      </>
    ),
  },
  {
    id: 'payment-safety',
    question: 'クレジットカードの事前登録は必要ですか？決済は安全ですか？',
    schemaText: 'Spotプランではクレジットカードの事前登録は一切不要です。決済はStripeのセキュアな基盤を利用し、万が一システム遅延が発生しても15分以内に自律的なフェイルセーフ機構が作動して確実に証明書が発行されます。',
    answer: (
      <>
        <p>Spotプランをご利用の場合、クレジットカードの事前登録は一切不要です。1件ごとの都度決済となり、世界最高水準のセキュリティを誇るStripeを通じて処理されるため、ProofMark側にお客様のカード情報が保存されることはありません。</p>
        <p>また、決済完了時に万が一のネットワーク遮断やシステム遅延が発生した場合でも、15分以内に自律的なフェイルセーフ機構（自動保護プログラム）が作動し、お客様の決済が失われることなく確実に証明書が発行・アンロックされるよう堅牢に設計されています。</p>
      </>
    ),
  },
  {
    id: 'copyright',
    question: 'ProofMarkを利用すれば著作権が法的に保証されますか？',
    schemaText: 'ProofMarkは「特定の日時にそのデータが存在していたこと」および「発行後に改ざんされていないこと」を暗号技術で客観的に証明するインフラですが、著作権の帰属や独創性そのものを法的に保証するものではありません。',
    answer: (
      <>
        <p>ProofMarkが提供するのは、作品の<strong>「特定の日時に、その内容で確実に存在していた事実」</strong>および<strong>「発行以降、1ビットの改ざんも行われていない事実」</strong>の暗号学的な証明です。これは、無断転載トラブルや納品時の信頼性担保において、反論の余地がない技術的証拠として機能します。</p>
        <p>一方で、ProofMarkは<strong>「著作権の真の所有者」や「作品の芸術的独創性」を法的に保証・判定する機関ではありません。</strong>著作権は創作した時点で自動的に発生する権利であり、ProofMarkはその事実関係を技術的に補強する強固なツールです。最終的な法的判断については、弁護士などの専門家にご相談ください。</p>
      </>
    ),
  },
  {
    id: 'ai-use',
    question: 'AIで生成した作品でも利用できますか？',
    schemaText: 'はい、AI生成作品でもご利用いただけます。AI生成かどうかにかかわらず、特定の時刻にそのデータが存在していたという事実を独立検証可能な形で暗号学的に封印します。',
    answer: (
      <>
        <p>はい、AI生成作品でも全く問題なくご利用いただけます。フルスクラッチの手描きイラスト、写真、動画、テキスト、そしてAI生成物に至るまで、ProofMarkはデジタルデータの種別を問わず<strong>「特定の時刻に、そのファイルが手元に存在したこと」</strong>を客観的に証明します。</p>
        <p>これにより、プロンプトの試行錯誤やレイヤーの更新履歴も含め、AI生成物の制作プロセスを後から第三者へ客観的に提示するための強固なタイムラインを残すことができます。</p>
      </>
    ),
  },
  {
    id: 'storage',
    question: 'アップロードした原画データはサーバーに保存されますか？',
    schemaText: 'Private Proofモードでは原画はサーバーに一切送信されません。Shareable Proofモードを選んだ場合のみ、公開表示用に最適化された画像がセキュアストレージへ送られ、7日間で自動消滅します。',
    answer: (
      <>
        <p><strong>Private Proof モード</strong>（デフォルト）では、お客様の原画データはProofMarkのサーバーに一切送信されません。SHA-256ハッシュの計算はすべてお客様のブラウザ内（ローカルデバイス）で完結し、サーバーに到達するのは「暗号指紋」と最小限のメタデータのみです。未公開作品の機密性は完全に守られます。</p>
        <p>ポートフォリオやSNSでの公開を目的とした <strong>Shareable Proof モード</strong> を選んだ場合のみ、表示用に最適化された画像がセキュアストレージ（Cloudflare R2）へ一時的に送信されます。これらの画像は、維持コストとセキュリティの観点から<strong>7日間で自動的に完全消去（Lifecycle Rule）</strong>されるよう厳格に設計されています。</p>
      </>
    ),
  },
  {
    id: 'visibility',
    question: '公開検証リンクにはどのような情報が表示されますか？',
    schemaText: '公開検証ページには、作品のサムネイル（Shareable Proofモード時）、SHA-256ハッシュ値、AWS KMSによる暗号署名時刻、QRコード、Certificate ID等が表示され、ブラウザ上で即時検証が可能です。',
    answer: (
      <>
        <p>ProofMarkが発行する公開検証ページ（および証明書PDF）には、以下の情報が記載されます。</p>
        <ul className="list-disc pl-5 space-y-1 my-4">
          <li>作品のサムネイル画像（Shareable Proof モード時のみ）</li>
          <li>SHA-256 暗号ハッシュ値</li>
          <li>AWS KMS（FIPS 140-2準拠）による暗号署名時刻 (JST/UTC)</li>
          <li>検証用公開ページへアクセスできる QR Code</li>
          <li>Certificate ID（固有識別番号）</li>
          <li>Privacy-first ラベル（通信の安全性の証明）</li>
        </ul>
        <p>専用のURLにアクセスするだけで、第三者が専用ソフトを使うことなく、ブラウザ上で直感的かつ即座に証拠の有効性を確認できます。</p>
      </>
    ),
  },
  {
    id: 'c2pa',
    question: 'C2PA（Content Credentials）とは何が違うのですか？',
    schemaText: 'C2PAはコンテンツの来歴を記録するメタデータ標準ですが、ProofMarkはそのメタデータをさらに軍事レベルのAWS KMS暗号署名で包み込み、特定のベンダーに依存しない絶対的な存在証明として機能させるインフラです。',
    answer: (
      <>
        <p>C2PA (Coalition for Content Provenance and Authenticity) は、コンテンツの来歴や編集履歴を画像ファイルのメタデータとして記録するための世界的な技術標準です。</p>
        <p>ProofMarkは、C2PAを単なる「来歴タグ」で終わらせません。ブラウザで安全に抽出された制作プロセスのシグナルとファイルの暗号指紋を、<strong>AWS KMS（米国連邦情報処理標準 FIPS 140-2準拠の軍事レベル暗号鍵）で署名し、データに物理的に封印</strong>します。</p>
        <p>特定の生成AIツールやベンダーの枠組みにロックインされることなく、あらゆるファイルに対して独立検証可能な「絶対的な存在証明」を付与するインフラとして、C2PAと強力な補完関係にあります。</p>
      </>
    ),
  },
  {
    id: 'adobe-firefly',
    question: 'Adobe Firefly などの生成ツールとの違いは何ですか？',
    schemaText: 'Adobe Firefly等のツールはC2PA準拠の生成履歴をファイルに付与しますが、ProofMarkはツールの種類を問わず、完成したデータが特定日時に存在した事実を独立した第三者インフラとして証明します。',
    answer: (
      <>
        <p>Adobe Firefly をはじめとする最新の生成AIツールは、C2PAコンテンツクレデンシャル機能を使って「この画像がAIによってどう生成されたか」という履歴をファイル内に直接記録します。</p>
        <p>一方、ProofMarkはツール側の機能に依存しません。Adobe製品で作られたものでも、他のAIツールで作られたものでも、あるいはアナログのスケッチをスキャンしたものであっても、<strong>「完成したそのファイルが、特定の日時に間違いなく存在していた事実」</strong>を、独立した暗号インフラとして証明します。</p>
        <p>ProofMarkはこれらのツールと競合するものではなく、生成された作品に「客観的なタイムラインの証明」を重ね掛けする、強力な防具として併用いただけます。</p>
      </>
    ),
  },
  {
    id: 'legal',
    question: '実際の裁判や紛争で証拠として認められますか？',
    schemaText: 'ProofMarkの暗号署名とタイムスタンプは客観的データとして機能しますが、特定の裁判で証拠として採用されるかは裁判所の裁量によって判断されます。重要な紛争を想定する場合は専門家にご相談ください。',
    answer: (
      <>
        <p>ProofMarkが発行する証明データは、国際標準規格と高度な暗号技術（AWS KMS）を用いて構築された<strong>「確定論的客観証拠」</strong>です。</p>
        <p>改ざんが数学的に不可能であるこのデータは、納品時の信頼性担保、無断転載者への警告、プラットフォームへの通報の補強など、多くの場面で強力な抑止力と技術的証拠として機能します。一方で、実際の訴訟や調停において「証拠として正式に採用されるか」、および「どの程度の証拠価値とみなされるか」は、事案の内容や法域、裁判所の裁量によって個別に判断されます。</p>
        <p>大規模なビジネス上の紛争や重要な訴訟を想定される場合は、必ず弁護士等の専門家にご相談ください。</p>
      </>
    ),
  },
  {
    id: 'shutdown',
    question: 'もしProofMarkのサービスが終了したら、証明書は無効になりますか？',
    schemaText: 'いいえ、無効にはなりません。ProofMarkの証明データはW3C VCやC2PA等の国際標準規格に基づく構造でエクスポートされるため、将来サービスが終了しても公的なメタデータ検証ツールを用いて独立して有効性を検証可能です。',
    answer: (
      <>
        <p>いいえ、無効にはなりません。ProofMarkのアーキテクチャは、特定のSaaS企業（ベンダー）に運命を依存しない「Standard-Agnostic（規格非依存）」の設計思想に基づいて構築されています。</p>
        <p>発行時にダウンロードした <strong>Evidence Pack（証拠パッケージZIP）</strong> 内のメタデータや暗号署名は、W3C VC（Verifiable Credentials）や C2PA といった国際的なオープン標準規格に基づいて生成されています。そのため、万が一ProofMarkのサービス提供が終了した未来であっても、公的なメタデータ検証ツール等を用いることで、第三者が完全に独立して証明の有効性を検証し続けることが可能です。</p>
      </>
    ),
  },
  {
    id: 'misuse',
    question: '自分の作品が無断転載された場合、どのように活用すればよいですか？',
    schemaText: '証明書は無断転載時の時系列提示や、プラットフォームへの通報補強、弁護士相談時の客観データとして活用できます。',
    answer: (
      <>
        <p>ProofMarkで発行した Evidence Pack（証明書）は、<strong>「ネット上で転載された日時よりも前に、そのオリジナル作品が間違いなく手元にあった事実」</strong>を示す、強力な時系列データとしてご活用いただけます。</p>
        <ol className="list-decimal pl-5 space-y-2 my-4">
          <li><strong>転載者への直接警告</strong>: 真正性証明書（PDF）を提示し、反論の余地がない時系列を伝えることで、自主的な削除を強く促すことができます。</li>
          <li><strong>プラットフォームへの通報</strong>: X（旧Twitter）やInstagramなどの運営へ著作権侵害申し立て（DMCA等）を行う際、公開検証URLとハッシュ値を添えることで、あなたの主張の客観性を圧倒的に補強できます。</li>
          <li><strong>法的措置の準備</strong>: 弁護士へ相談する際、ProofMarkの証拠データは状況を正確に伝えるための揺るぎない客観材料として利用できます。</li>
        </ol>
      </>
    ),
  },
];

export default function Faq(): JSX.Element {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] pt-32 pb-24 px-6 md:px-12">
      <SEO
        title="ProofMark よくある質問 | デジタル存在証明のFAQ"
        description="ProofMarkの料金・決済の安全性・著作権・原画の非保存・C2PA・法的有効性・運営終了時の独立検証可能性に関する正直な回答を掲載しています。"
        url="https://proofmark.jp/faq"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqData.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.schemaText,
            },
          })),
        }}
      />
      
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#6C3EF4]/10 border border-[#6C3EF4]/30 text-[#6C3EF4] text-xs font-bold tracking-widest uppercase mb-6">
            <HelpCircle className="w-4 h-4" /> FAQ
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-6">
            よくある質問
          </h1>
          <p className="text-[#A8A0D8] text-lg max-w-2xl mx-auto leading-relaxed">
            ProofMarkに関する疑問や不安を、誇張せず、誠実にお答えします。
          </p>
        </header>

        <div className="space-y-4">
          {faqData.map((item, index) => {
            const isOpen = openId === item.id;
            return (
              <div
                key={item.id}
                className="group animate-in fade-in slide-in-from-bottom-4 duration-700"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div
                  className={`
                    border transition-all duration-300 rounded-2xl overflow-hidden
                    ${isOpen
                      ? 'bg-[#0D0B24] border-[#6C3EF4]/50 shadow-[0_0_30px_rgba(108,62,244,0.1)]'
                      : 'bg-[#0D0B24]/50 border-[#1C1A38] hover:border-[#6C3EF4]/30'
                    }
                  `}
                >
                  <button
                    onClick={() => toggle(item.id)}
                    className="w-full flex items-center justify-between p-6 text-left"
                    aria-expanded={isOpen}
                    aria-controls={`faq-detail-${item.id}`}
                  >
                    <span
                      className={`text-lg font-bold transition-colors ${isOpen ? 'text-[#00D4AA]' : 'text-[#F0EFF8]'}`}
                    >
                      {item.question}
                    </span>
                    <div
                      className={`
                        w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300
                        ${isOpen
                          ? 'bg-[#6C3EF4] rotate-180'
                          : 'bg-[#1C1A38] group-hover:bg-[#1C1A38]/80'
                        }
                      `}
                    >
                      <ChevronDown className="w-5 h-5 text-white" />
                    </div>
                  </button>
                  <div
                    id={`faq-detail-${item.id}`}
                    className={`
                      transition-all duration-300 overflow-hidden
                      ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}
                    `}
                  >
                    <div className="p-6 pt-0 text-[#D4D0F4] leading-relaxed border-t border-[#1C1A38]/50 space-y-4">
                      {item.answer}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-20 text-center animate-in fade-in duration-1000">
          <Link
            href="/"
            className="inline-flex items-center text-[#6C3EF4] font-bold hover:text-[#00D4AA] transition-colors gap-2"
          >
            ← トップページへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}