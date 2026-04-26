import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { Link } from 'wouter';
import SEO from '../components/SEO';
import { PRICING_PLANS } from '../data/pricingPlans';

/**
 * FAQ (詳細ページ)
 * ─────────────────────────────────────────────
 * - 価格表記は data/pricingPlans.ts と完全一致。
 * - 過剰な断定（必ず・絶対・先取権・100%）を撤廃し、Trust Center の正直な開示と整合。
 * - 法的判断は弁護士相談に明確に切り分ける。
 * - JSON-LD は schema 用に簡易テキストを生成する（FAQPage）。
 */

interface FAQItem {
  id: string;
  question: string;
  answer: React.ReactNode;
  /** Schema.org FAQPage 用のプレーンテキスト要約 */
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
    schemaText: `ProofMarkはFree(${getPrice('free')}、月30件)、Spot(${getPrice('spot')}、登録不要の単発発行)、Creator(${getPrice('creator')}、無制限PDFとEvidence Pack)、Studio(${getPrice('studio')}、WORM監査ログとチーム管理)、Business/API(要問い合わせ、SLAと商用TSA)の5階層です。証明回数ではなく納品信頼の運用機能に応じた価格体系です。`,
    answer: (
      <>
        <p>ProofMarkは「証明回数」ではなく「納品信頼の運用」に基づいた料金体系です。</p>
        <ul className="list-disc pl-5 space-y-1 my-4">
          <li>
            <strong>Free（{getPrice('free')}）</strong>: 月30件までのWeb証明（PDF発行は含みません）
          </li>
          <li>
            <strong>Spot（{getPrice('spot')}）</strong>: 単発でのEvidence Pack発行（登録不要）
          </li>
          <li>
            <strong>Creator（{getPrice('creator')}）</strong>: 無制限PDF・Evidence Pack・案件単位整理・NDA表示
          </li>
          <li>
            <strong>Studio（{getPrice('studio')}）</strong>: チーム管理・WORM監査ログ・Chain of Evidence
          </li>
          <li>
            <strong>Business / API</strong>: API・SLA・商用TSA対応・DPA。要問い合わせ
          </li>
        </ul>
        <p>
          詳細は
          <Link href="/pricing" style={{ color: '#00D4AA', textDecoration: 'underline' }}>
            料金プランページ
          </Link>
          をご確認ください。
        </p>
      </>
    ),
  },
  {
    id: 'copyright',
    question: 'これは著作権を保証しますか？',
    schemaText:
      'ProofMarkは作品が特定の日時にその内容で存在していたこと、および発行後に改ざんされていないことを技術的に証明しますが、著作権の帰属や独創性そのものを法的に保証するものではありません。法的判断は弁護士などの専門家にご相談ください。',
    answer: (
      <>
        <p>
          ProofMarkは、作品の
          <strong>「特定の日時に、その内容で存在していたこと」</strong>
          および
          <strong>「発行後に改ざんされていないこと」</strong>
          を技術的に証明します。これは、無断転載や納品トラブル時に主張を裏付ける客観的な技術データとして使えます。
        </p>
        <p>
          一方で、ProofMarkは
          <strong>「著作権の帰属」や「作品の独創性」を法的に保証するものではありません。</strong>
          著作権は作品を創作した時点で自動的に発生する権利であり、ProofMarkはその創作の事実を補強する技術証拠を提供します。法的判断については、弁護士などの専門家にご相談ください。
        </p>
      </>
    ),
  },
  {
    id: 'ai-use',
    question: 'AI生成でも使えますか？',
    schemaText:
      'はい、AI生成作品でもProofMarkはご利用いただけます。AI生成かどうかにかかわらず、特定の日時にその内容で存在していたという事実を証明します。',
    answer: (
      <>
        <p>
          はい、AI生成作品でもProofMarkをご利用いただけます。AI生成・手描き・写真・動画・音声いずれでも、ProofMarkは
          <strong>「特定の日時に、そのファイルが存在したこと」</strong>
          を客観的に証明します。
        </p>
        <p>
          これにより、AI生成物の制作プロセスや更新時系列を、後から第三者へ示すための材料を残せます。
        </p>
      </>
    ),
  },
  {
    id: 'storage',
    question: '原画は保存されますか？',
    schemaText:
      'Private Proofモードでは原画はサーバーに送られません。Shareable Proofモードを選んだ場合のみ、ポートフォリオ表示用の画像がVercelをバイパスしてSupabase Storageに直接転送されます。',
    answer: (
      <>
        <p>
          <strong>Private Proof モード</strong>では、原画はProofMarkのサーバーに送信されません。SHA-256ハッシュ計算がブラウザ内で完結し、ProofMarkに保存されるのはハッシュ値とタイムスタンプ情報のみです。
        </p>
        <p>
          <strong>Shareable Proof モード</strong>を選んだ場合のみ、ポートフォリオ表示や検証ページ用の画像が、Vercelをバイパスして Supabase Storage に直接暗号化転送されます。どちらのモードで発行したかはダッシュボードで明示されます。
        </p>
      </>
    ),
  },
  {
    id: 'visibility',
    question: '公開リンクには何が表示されますか？',
    schemaText:
      '公開検証ページには、作品サムネイル（Shareable Proofモード時）、SHA-256ハッシュ、RFC3161タイムスタンプ、QRコード、Certificate ID、Privacy-firstラベルが表示されます。Private Proofモードではサムネイルは表示されません。',
    answer: (
      <>
        <p>ProofMarkが発行する公開検証ページ／PDF証明書には、以下が表示されます。</p>
        <ul className="list-disc pl-5 space-y-1 my-4">
          <li>作品のサムネイル（Shareable Proof モード時のみ）</li>
          <li>VERIFIED / Authenticity Certificate の表示</li>
          <li>SHA-256 Hash 値</li>
          <li>RFC3161 Timestamp (UTC)</li>
          <li>QR Code（検証用公開ページへのリンク）</li>
          <li>Certificate ID</li>
          <li>Privacy-first / Direct Upload ラベル</li>
        </ul>
        <p>
          公開リンクにアクセスすると、これらの情報が表示され、第三者がハッシュ値とタイムスタンプの有効性をその場で確認できます。
        </p>
      </>
    ),
  },
  {
    id: 'c2pa',
    question: 'C2PAとの違いは？',
    schemaText:
      'C2PAはコンテンツの来歴と編集履歴のメタデータ標準であり、ProofMarkは特定日時の存在証明と非改ざん証明に特化したRFC3161タイムスタンプサービスです。両者は補完関係にあります。',
    answer: (
      <>
        <p>
          C2PA (Coalition for Content Provenance and Authenticity) は、コンテンツの来歴・編集履歴をメタデータとして記録するオープン技術標準です。生成元・編集経路を追跡することが目的です。
        </p>
        <p>
          一方、ProofMarkはコンテンツの
          <strong>「特定日時における存在証明」と「非改ざん証明」</strong>
          に特化しています。SHA-256ハッシュとRFC3161タイムスタンプの組み合わせで、「いつ、その作品が存在したか」を独立検証可能な形で確立します。
        </p>
        <p>
          両者は補完関係にあります。C2PAが「来歴」を、ProofMarkが「存在時刻」を担当することで、AI時代の作品信頼性を多角的に補強できます。
        </p>
      </>
    ),
  },
  {
    id: 'firefly',
    question: 'Adobe / Fireflyとの違いは？',
    schemaText:
      'Adobe FireflyなどはC2PA準拠の生成履歴をメタデータとして付与しますが、ProofMarkは生成ツールに依存せずあらゆるデジタルコンテンツの存在時刻を独立検証可能な形で証明します。両者は競合ではなく補完的に併用できます。',
    answer: (
      <>
        <p>
          Adobe Firefly などのAI生成ツールは、C2PAコンテンツクレデンシャルを使って「このコンテンツがどう作られたか」をメタデータとして付与します。
        </p>
        <p>
          ProofMarkは特定の生成ツールに依存せず、
          <strong>あらゆるデジタルコンテンツに対して「特定日時に存在していた事実」</strong>
          を、独立検証可能なRFC3161トークンとして提供します。
        </p>
        <p>
          ProofMarkは Adobe / Firefly と競合せず、それらで生成された作品に「存在時刻の独立証拠」を添える役割を担います。
        </p>
      </>
    ),
  },
  {
    id: 'legal',
    question: '裁判や紛争の証拠として使えますか？',
    schemaText:
      'ProofMarkはRFC3161準拠のタイムスタンプトークン（TST）を発行します。TSTは納品信頼の担保や無断転載時の時系列提示などに活用できる客観的データですが、特定の裁判で証拠として採用されるかは事案・法域・裁判所の裁量によって判断されます。重要な紛争を想定する場合は弁護士に相談し、用途に合うTSAクラスをご検討ください。',
    answer: (
      <>
        <p>
          ProofMarkが発行するのは、RFC3161という国際標準規格に準拠した
          <strong>タイムスタンプトークン（TST）</strong>
          です。TSTは「ハッシュ値Hを持つファイルが、時刻Tに存在していた」という事実を、TSA（時刻認証局）の電子署名で裏付けたデータです。
        </p>
        <p>
          このTSTは、納品時の信頼性担保、取引先への説明、無断転載時の時系列提示、プラットフォームへの通報補強など、さまざまな場面で技術的証拠として活用できます。TSTはProofMarkに依存せず、OpenSSL等の標準ツールで独立検証できます。
        </p>
        <p>
          <strong>
            一方で、個別の裁判・調停・行政手続で証拠として採用されるか、およびその証拠価値は、事案・法域・裁判所の裁量によって判断されます。
          </strong>
          ProofMarkは「法的に有効な証拠を保証する」立場ではなく、「事実関係を技術的に裏付けるデータを提供する」立場です。現在運用中のTSAと、その信頼レベルは
          <Link href="/trust-center#s4">
            <span style={{ color: '#00D4AA' }}> Trust Center §4</span>
          </Link>
          で最新状態を公開しています。
        </p>
        <p>
          重要な紛争・訴訟を想定する場合は、必ず弁護士などの専門家にご相談のうえ、用途に合うTSAクラス（商用TSA等）をご検討ください。
        </p>
      </>
    ),
  },
  {
    id: 'shutdown',
    question: '運営が終了した場合、証明書は有効なままですか？',
    schemaText:
      'はい。ProofMarkが発行するタイムスタンプトークンはRFC3161の国際標準であり、ProofMarkのサービス停止後でもOpenSSL等の標準ツールとTSAの公開証明書のみで第三者が独立して有効性を検証できます。検証スクリプトはGitHubで公開しています。',
    answer: (
      <>
        <p>
          はい。ProofMarkが発行するタイムスタンプトークン（TST）は、RFC3161という国際標準規格に基づくデータです。TSTを手元に保存しておけば、
          <strong>
            ProofMarkのサービス提供が終了した後でも、OpenSSL等の標準ツールとTSAの公開証明書のみで、第三者が独立して有効性を検証できます。
          </strong>
        </p>
        <p>
          具体的な検証手順は
          <Link href="/trust-center#s7">
            <span style={{ color: '#00D4AA' }}> Trust Center §7</span>
          </Link>
          に、検証用スクリプトは
          <a
            href="https://github.com/proofmark-jp/verify"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#00D4AA' }}
          >
            {' '}公開リポジトリ
          </a>
          に掲載しています。
        </p>
      </>
    ),
  },
  {
    id: 'compression',
    question: 'SNSで画像が圧縮されても意味はありますか？',
    schemaText:
      'はい。ProofMarkは元の作品データのSHA-256ハッシュにタイムスタンプを付与します。SNSで圧縮された画像は別ハッシュになりますが、元データを保管しておけば「元の画像が特定日時に存在していた事実」を示すことができます。',
    answer: (
      <>
        <p>
          はい、意味があります。ProofMarkは
          <strong>元の作品データから計算されたSHA-256ハッシュ値</strong>
          にタイムスタンプを付与します。SNSで圧縮された画像は元と異なるハッシュ値になりますが、ProofMarkの証明書は「元の画像が特定の日時に存在していたこと」を示すものです。
        </p>
        <p>
          元データをローカルに保管しておけば、後から第三者へ「圧縮画像の元になった原本が、いつ手元にあったか」を客観的に提示できます。
        </p>
      </>
    ),
  },
  {
    id: 'existing',
    question: '既存作品にも使えますか？',
    schemaText:
      'はい。過去に作成されたデジタル作品でも、ProofMarkにアップロード（または Private Proofでハッシュ化）した時点での存在と非改ざん性を証明できます。',
    answer: (
      <>
        <p>
          はい、ProofMarkは既存の作品にもご利用いただけます。過去に作成された作品であっても、ProofMarkで
          <strong>「証明書を発行した時点での存在と非改ざん性」</strong>
          を残せます。
        </p>
        <p>
          これにより、過去案件のEvidence Packを後から作成し、納品実績の整理や将来的な紛争予防に備えることができます。
        </p>
      </>
    ),
  },
  {
    id: 'misuse',
    question: '無断転載された時はどう使いますか？',
    schemaText:
      '証明書は無断転載時の時系列提示や、プラットフォームへの通報補強、弁護士相談時の客観データとして活用できます。日英のDMCA削除依頼テンプレートも提供します。',
    answer: (
      <>
        <p>
          ProofMarkの証明書（およびEvidence Pack）は、
          <strong>「転載された日時よりも前に、その作品が手元にあった事実」</strong>
          を示す客観的な時系列データとして活用できます。
        </p>
        <ol className="list-decimal pl-5 space-y-1 my-4">
          <li>
            <strong>転載者への警告</strong>: Evidence Packを提示し、作品の存在時系列を明確に伝えることで、転載者に削除を求めるスタートラインに立てます。
          </li>
          <li>
            <strong>プラットフォームへの通報</strong>: 各SNSやコンテンツプラットフォームの著作権侵害申し立てに、証明書とハッシュを添付することで客観性を補強できます。
          </li>
          <li>
            <strong>弁護士・法的措置の検討</strong>: 弁護士相談時、ProofMarkの証拠データは時系列の客観材料として使えます。最終的な法的判断は弁護士が行います。
          </li>
        </ol>
        <p>
          日英のDMCA削除依頼テンプレートは
          <Link href="/legal-resources">
            <span style={{ color: '#00D4AA' }}> Legal Resources</span>
          </Link>
          ページから直接コピーできます。
        </p>
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
      <SEO
        title="ProofMark よくある質問 | デジタル存在証明のFAQ"
        description="ProofMarkの料金・著作権・原画保存・C2PA・法的有効性・運営終了時の検証可能性に関する正直な回答を掲載しています。"
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
            ProofMarkに関する疑問や不安を、誇張せず、正直にお答えします。
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
                    ? 'bg-[#0D0B24] border-[#6C3EF4]/50 shadow-[0_0_30px_rgba(108,62,244,0.1)]'
                    : 'bg-[#0D0B24]/50 border-[#1C1A38] hover:border-[#6C3EF4]/30'
                  }
                `}
              >
                <button
                  onClick={() => toggle(item.id)}
                  className="w-full flex items-center justify-between p-6 text-left"
                  aria-expanded={openId === item.id}
                  aria-controls={`faq-detail-${item.id}`}
                >
                  <span
                    className={`text-lg font-bold transition-colors ${openId === item.id ? 'text-[#00D4AA]' : 'text-[#F0EFF8]'}`}
                  >
                    {item.question}
                  </span>
                  <div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300
                      ${openId === item.id
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
                    ${openId === item.id ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}
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
