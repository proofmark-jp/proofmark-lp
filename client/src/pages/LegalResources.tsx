import { motion } from 'framer-motion';
import {
  Shield,
  Scale,
  Copy,
  Network,
  FileCheck,
  Clock,
  Lock,
  AlertTriangle,
  Gavel,
  CheckCircle2,
  Fingerprint,
} from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../hooks/useAuth';
import SEO from '../components/SEO';

/**
 * LegalResources
 * ─────────────────────────────────────────────
 * Phase 11.A — Honesty Refactor
 *
 * 旧版にあった「法廷での証拠採用実績が極めて高い」という過剰断定を撤去し、
 * Trust Center / FAQ §legal の誠実なトーンと完全に整合させる。
 *
 * SSOT: TrustCenter.tsx の §1（脅威モデル）と §4（TSA選定）の表現が
 *       本ページの法的トーンの上限となる。
 *
 * 変更ポリシー：
 *  - 「実績が極めて高い」 → 「電子契約・電子文書において広く参照される国際規格」（事実ベース）
 *  - 「強力な根拠」      → 「客観的な時系列データ」（中立記述）
 *  - 比較表の "ProofMark" 列は、優劣判定ではなく "事実の特徴" を列挙する形へ
 */
export default function LegalResources() {
  const { user, signOut } = useAuth();

  const dmcaJapanese = `著作権侵害に関する通知（DMCAに基づく削除要請）

担当者様

私は、以下の著作物の正当な権利者であり、私の著作権が侵害されていることを通知します。

1. 侵害されたオリジナル著作物：
[作品名や概要、またはオリジナル作品のURL]
※ProofMark証明書: [ProofMark証明書のURL] (SHA-256: [ハッシュ値])

2. 著作権侵害を行っているコンテンツ：
[無断転載されているページのURL]

3. 権利者の連絡先：
氏名: [あなたの名前]
住所: [あなたの住所]
メール: [あなたのメールアドレス]

4. 宣誓：
私は、上記で特定されたコンテンツの使用が、著作権者、その代理人、または法律によって許可されていないと確信しています（善意に基づく確信 / Good faith belief）。
また、偽証罪の罰則の下での宣誓（Under penalty of perjury）として、本通知に記載された情報が正確であり、私が侵害された排他的権利の所有者であること、または所有者の代理として行動する権限を与えられていることを誓います。

署名または記名：[あなたの名前]
日付：[今日の日付]`;

  const dmcaEnglish = `Notice of Copyright Infringement (DMCA Takedown Notice)

To Whom It May Concern,

I am the copyright owner of the work(s) identified below, and I am writing to notify you of copyright infringement.

1. Original Copyrighted Work(s):
[Description or URL of your original artwork]
* ProofMark Certificate: [ProofMark Certificate URL] (SHA-256: [Hash])

2. Infringing Material:
[URL of the unauthorized copy/post]

3. Contact Information:
Name: [Your Name]
Address: [Your Address]
Email: [Your Email]

4. Declarations:
I have a good faith belief that the use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.
I state under penalty of perjury that the information in this notification is accurate, and that I am the owner, or an agent authorized to act on behalf of the owner, of an exclusive right that is allegedly infringed.

Electronic Signature: [Your Name]
Date: [Date]`;

  const copyToClipboard = (text: string, title: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${title}をクリップボードにコピーしました`, {
      icon: <Copy className="w-4 h-4 text-[#00D4AA]" />,
    });
  };

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  return (
    <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] font-sans selection:bg-[#6C3EF4]/30">
      <SEO
        title="クリエイターのための権利行使キット | ProofMark"
        description="AI生成作品の無断転載や著作権侵害に対抗するための法的リソース。DMCAテイクダウンのテンプレートや証拠の特徴比較ガイダンスを提供します。"
        url="https://proofmark.jp/legal-resources"
      />
      <Navbar user={user} signOut={signOut} />

      {/* Header */}
      <section className="relative pt-24 pb-16 px-6 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-[#6C3EF4]/10 blur-[120px] rounded-[100%] pointer-events-none" />

        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#6C3EF4]/10 border border-[#6C3EF4]/30 text-[#BC78FF] text-xs font-bold tracking-widest uppercase mb-6"
          >
            <Gavel className="w-4 h-4" /> Legal Resources
          </motion.div>
          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight mb-6"
          >
            クリエイターのための<br className="hidden md:block" />権利行使キット
          </motion.h1>
          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            className="text-[#A8A0D8] text-lg max-w-2xl mx-auto leading-relaxed"
          >
            ProofMarkが発行する技術証拠を用いた、無断転載や自作発言への対抗手段のテンプレートと、各証明手段の特徴比較ガイダンスです。
          </motion.p>

          {/* ── Honest scope notice ── */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            className="mt-8 mx-auto max-w-3xl rounded-2xl border border-[#F0BB38]/25 bg-[#F0BB38]/5 p-5 text-left"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#F0BB38] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-white mb-1">
                  本ページの法的トーンについて
                </p>
                <p className="text-xs text-[#A8A0D8] leading-relaxed">
                  ProofMarkは、特定の事案・法域・裁判所での証拠採用や勝訴を保証するものではありません。本ページに記載される比較・評価は「各技術が持つ構造的特徴」の客観記述であり、優劣判定ではありません。重要な紛争を想定する場合は必ず弁護士に相談してください。詳細トーン基準は{' '}
                  <a
                    href="/trust-center#s1"
                    className="text-[#00D4AA] underline hover:no-underline"
                  >
                    Trust Center §1（脅威モデル）
                  </a>
                  に準拠します。
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-32 space-y-24">
        {/* ─────────────────────────────────
         * Section 1: 各証明手段の特徴比較
         * （※ "優劣" ではなく "構造的特徴" を列挙する記述に改修）
         * ───────────────────────────────── */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeIn}
          className="relative"
        >
          <div className="flex items-center gap-3 mb-8">
            <Scale className="w-8 h-8 text-[#00D4AA]" />
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">
              各証明手段の構造的特徴
            </h2>
          </div>
          <p className="text-[#A8A0D8] mb-8 text-sm md:text-base leading-relaxed">
            「いつ、誰がそのデータを保有していたか」を示す各技術には、それぞれ固有の構造的特徴があります。下表は優劣判定ではなく、各方式が持つ事実上の性質を客観的に整理したものです。実際の証拠採用可否は事案・法域・裁判所の裁量によって判断されます。
          </p>

          <div className="overflow-x-auto rounded-3xl border border-[#1C1A38] bg-[#0D0B24] shadow-[0_0_40px_rgba(108,62,244,0.05)]">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="border-b border-[#1C1A38]">
                  <th className="p-6 text-sm font-bold text-[#A8A0D8] bg-[#151D2F] w-1/4">
                    比較項目
                  </th>
                  <th className="p-6 text-lg font-black text-[#00D4AA] bg-[#00D4AA]/5 border-x border-[#1C1A38] w-1/3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5" /> ProofMark
                    </div>
                  </th>
                  <th className="p-6 text-sm font-bold text-[#A8A0D8] bg-[#151D2F] w-1/5">
                    パブリック・ブロックチェーン
                  </th>
                  <th className="p-6 text-sm font-bold text-[#A8A0D8] bg-[#151D2F] w-1/5">
                    メタデータ (Exif/C2PA)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1C1A38]">
                {/* ── 規格・標準性 ── */}
                <tr className="group">
                  <td className="p-6 text-sm font-bold text-white">規格・標準性</td>
                  <td className="p-6 bg-[#00D4AA]/5 border-x border-[#1C1A38]">
                    <span className="text-white font-bold block mb-1">
                      RFC3161 準拠のタイムスタンプ
                    </span>
                    <span className="text-xs text-[#A8A0D8] font-medium leading-tight block">
                      電子契約・電子文書において広く参照される国際規格。OpenSSL等の標準ツールで独立検証可能。
                    </span>
                  </td>
                  <td className="p-6 text-sm text-[#A8A0D8] leading-tight">
                    暗号学的改ざん耐性は高いが、各国で法制度・判例の蓄積が限定的。
                  </td>
                  <td className="p-6 text-sm text-[#A8A0D8] leading-tight">
                    EXIF / C2PA等の標準は存在するが、ファイル内メタデータは編集ツールで容易に書換え・削除可能。
                  </td>
                </tr>

                {/* ── ゼロ知識性 ── */}
                <tr className="group">
                  <td className="p-6 text-sm font-bold text-white">
                    ゼロ知識性 (秘匿性)
                  </td>
                  <td className="p-6 bg-[#00D4AA]/5 border-x border-[#1C1A38]">
                    <div className="flex items-center gap-2 text-white font-bold mb-1">
                      <CheckCircle2 className="w-4 h-4 text-[#00D4AA]" /> ブラウザ内完結
                    </div>
                    <span className="text-xs text-[#A8A0D8] font-medium leading-tight block">
                      原本データをサーバーに送信せず、ブラウザ内で SHA-256 ハッシュのみを計算（Private Proof モード）。
                    </span>
                  </td>
                  <td className="p-6 text-sm text-[#A8A0D8] leading-tight">
                    ハッシュ記録は可能だが、トランザクション公開によるパターン推測やネットワーク手数料が発生。
                  </td>
                  <td className="p-6 text-sm text-[#A8A0D8] leading-tight">
                    ファイルそのものに付与される性質上、共有時にファイル送信が必要となる場合が多い。
                  </td>
                </tr>

                {/* ── プラットフォーム連携 ── */}
                <tr className="group">
                  <td className="p-6 text-sm font-bold text-white">
                    プラットフォーム提示性
                  </td>
                  <td className="p-6 bg-[#00D4AA]/5 border-x border-[#1C1A38]">
                    <span className="text-white font-bold block mb-1">
                      検証URL + PDFで提示可能
                    </span>
                    <span className="text-xs text-[#A8A0D8] font-medium leading-tight block">
                      DMCA削除依頼等の通報補強材料として、検証URL・SHA-256・タイムスタンプを添付できます。採否はプラットフォーム側のポリシーに依存します。
                    </span>
                  </td>
                  <td className="p-6 text-sm text-[#A8A0D8] leading-tight">
                    プラットフォーム担当者がトランザクション検証手順を理解できないケースが多い。
                  </td>
                  <td className="p-6 text-sm text-[#A8A0D8] leading-tight">
                    主要SNSは投稿時にメタデータを自動削除する実装が一般的。
                  </td>
                </tr>

                {/* ── 提供者依存性 ── */}
                <tr className="group">
                  <td className="p-6 text-sm font-bold text-white">提供者依存性</td>
                  <td className="p-6 bg-[#00D4AA]/5 border-x border-[#1C1A38]">
                    <div className="flex items-center gap-2 text-white font-bold mb-1">
                      <CheckCircle2 className="w-4 h-4 text-[#00D4AA]" /> Vendor Lock-in Free
                    </div>
                    <span className="text-xs text-[#A8A0D8] font-medium leading-tight block">
                      ProofMark停止後も、TST と OpenSSL/Python の標準ツールで独立検証可能（
                      <a
                        href="https://github.com/proofmark-jp/verify"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#00D4AA] underline"
                      >
                        proofmark-jp/verify
                      </a>
                      ）。
                    </span>
                  </td>
                  <td className="p-6 text-sm text-[#A8A0D8] leading-tight">
                    ブロックチェーン本体は持続するが、そのチェーンの検証ツールやノード運用コストはユーザー側に残る。
                  </td>
                  <td className="p-6 text-sm text-[#A8A0D8] leading-tight">
                    生成元ツールが正常な書き出しを行っているかに依存。
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-[#A8A0D8]/70 leading-relaxed">
            ※ 上表は構造的特徴の比較であり、特定の事案における証拠採用可否や、勝訴可能性を示すものではありません。重要な紛争を想定する場合は弁護士にご相談ください。
          </p>
        </motion.section>

        {/* ─────────────────────────────────
         * Section 2: Chain of Evidence
         * （断定 → 事実記述へトーンダウン）
         * ───────────────────────────────── */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeIn}
          className="relative"
        >
          <div className="flex items-center gap-3 mb-8">
            <Network className="w-8 h-8 text-[#6C3EF4]" />
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">
              証拠の連鎖 (Chain of Evidence)
            </h2>
          </div>
          <p className="text-[#A8A0D8] mb-12 text-sm md:text-base leading-relaxed">
            ProofMarkの証明書は、他の要素と組み合わせることで「あなたが先に作っていた」という主張の客観性を多角的に補強できます。各要素が果たす役割を整理します。
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-[40px] left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-[#6C3EF4]/0 via-[#6C3EF4]/30 to-[#6C3EF4]/0 z-0" />

            <div className="bg-[#0D0B24] border border-[#1C1A38] rounded-3xl p-8 relative z-10 hover:-translate-y-2 transition-transform duration-300">
              <div className="w-16 h-16 rounded-2xl bg-[#00D4AA]/10 border border-[#00D4AA]/30 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(0,212,170,0.2)]">
                <FileCheck className="w-8 h-8 text-[#00D4AA]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-[#00D4AA]">01.</span> 客観的タイムアンカー (ProofMark)
              </h3>
              <p className="text-[#A8A0D8] text-sm leading-relaxed">
                RFC3161 タイムスタンプ局による技術証拠。
                <span className="text-white font-bold">
                  作品Aが「特定の日時」に存在していた事実
                </span>
                を、独立検証可能な形で記録します。
              </p>
            </div>

            <div className="bg-[#0D0B24] border border-[#1C1A38] rounded-3xl p-8 relative z-10 hover:-translate-y-2 transition-transform duration-300">
              <div className="w-16 h-16 rounded-2xl bg-[#6C3EF4]/10 border border-[#6C3EF4]/30 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(108,62,244,0.2)]">
                <Fingerprint className="w-8 h-8 text-[#6C3EF4]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-[#6C3EF4]">02.</span> 元データの保有
              </h3>
              <p className="text-[#A8A0D8] text-sm leading-relaxed">
                PSDやCLIPのレイヤー構造、ラフ画、製作工程データ。
                <span className="text-white font-bold">
                  作者本人が手元に持っていることが多い情報
                </span>
                であり、主張の補強材料として有用です。
              </p>
            </div>

            <div className="bg-[#0D0B24] border border-[#1C1A38] rounded-3xl p-8 relative z-10 hover:-translate-y-2 transition-transform duration-300">
              <div className="w-16 h-16 rounded-2xl bg-[#FF4D4D]/10 border border-[#FF4D4D]/30 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(255,77,77,0.2)]">
                <Clock className="w-8 h-8 text-[#FF4D4D]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-[#FF4D4D]">03.</span> 公開実績 (SNS等)
              </h3>
              <p className="text-[#A8A0D8] text-sm leading-relaxed">
                X(Twitter)・Pixiv・YouTube等への最初のアップロード記録。上記の客観的タイムアンカーと組み合わせることで、
                <span className="text-white font-bold">
                  時系列上の主張に補強材料が増えます
                </span>
                。
              </p>
            </div>
          </div>
        </motion.section>

        {/* ─────────────────────────────────
         * Section 3: DMCA Templates（既存維持・トーン整合済み）
         * ───────────────────────────────── */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeIn}
          className="relative"
        >
          <div className="flex items-center gap-3 mb-8">
            <Lock className="w-8 h-8 text-[#BC78FF]" />
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">
              DMCA削除申請テンプレート
            </h2>
          </div>

          <div className="bg-[#FF4D4D]/10 border border-[#FF4D4D]/30 rounded-2xl p-6 mb-10 flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-[#FF4D4D] shrink-0 mt-1" />
            <div>
              <h4 className="text-[#FF4D4D] font-bold mb-2">
                厳格な宣誓とペナルティについて
              </h4>
              <p className="text-[#A8A0D8] text-sm leading-relaxed">
                DMCA申請には重大な法的責任が伴います。テンプレートには必ず含まれなければならない{' '}
                <strong className="text-white">
                  「善意に基づく確信（Good faith belief）」
                </strong>{' '}
                と{' '}
                <strong className="text-white">
                  「偽証罪の罰則の下での宣誓（Under penalty of perjury）」
                </strong>{' '}
                の文言が組み込まれています。虚偽の申請は偽証罪や損害賠償の対象となるため、確実に自分に権利がある場合のみ使用してください。
              </p>
            </div>
          </div>

          <div className="grid xl:grid-cols-2 gap-8">
            {/* Japanese Template */}
            <div className="flex flex-col h-full bg-[#0D0B24] border border-[#1C1A38] rounded-3xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#1C1A38] bg-[#151D2F]">
                <h3 className="font-bold text-white text-sm">日本語版 (国内サービス向け)</h3>
                <button
                  onClick={() => copyToClipboard(dmcaJapanese, '日本語版')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-all"
                >
                  <Copy className="w-3.5 h-3.5" /> コピー
                </button>
              </div>
              <div className="p-6 flex-1 bg-[#0A0815] overflow-y-auto max-h-[500px] custom-scrollbar">
                <pre className="text-[#A8A0D8] text-sm leading-relaxed font-mono whitespace-pre-wrap">
                  {dmcaJapanese}
                </pre>
              </div>
            </div>

            {/* English Template */}
            <div className="flex flex-col h-full bg-[#0D0B24] border border-[#1C1A38] rounded-3xl overflow-hidden shadow-[0_0_30px_rgba(108,62,244,0.1)]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#1C1A38] bg-[#6C3EF4]/10">
                <h3 className="font-bold text-white text-sm">
                  English Version (X/Twitter, Global)
                </h3>
                <button
                  onClick={() => copyToClipboard(dmcaEnglish, '英語版')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#6C3EF4]/20 hover:bg-[#6C3EF4]/30 text-[#BC78FF] border border-[#6C3EF4]/30 text-xs font-bold transition-all shadow-[0_0_15px_rgba(108,62,244,0.3)]"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
              </div>
              <div className="p-6 flex-1 bg-[#0A0815] overflow-y-auto max-h-[500px] custom-scrollbar">
                <pre className="text-[#A8A0D8] text-sm leading-relaxed font-mono whitespace-pre-wrap">
                  {dmcaEnglish}
                </pre>
              </div>
            </div>
          </div>
        </motion.section>
      </main>

      <Footer />
    </div>
  );
}
