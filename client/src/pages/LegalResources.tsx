import React from 'react';
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
  Fingerprint
} from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../hooks/useAuth';

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
    toast.success(\`\${title}をクリップボードにコピーしました\`, {
      icon: <Copy className="w-4 h-4 text-[#00D4AA]" />
    });
  };

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  return (
    <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] font-sans selection:bg-[#6C3EF4]/30">
      <Navbar user={user} signOut={signOut} />

      {/* Header */}
      <section className="relative pt-24 pb-16 px-6 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-[#6C3EF4]/10 blur-[120px] rounded-[100%] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <motion.div 
            initial="hidden" animate="visible" variants={fadeIn}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#6C3EF4]/10 border border-[#6C3EF4]/30 text-[#BC78FF] text-xs font-bold tracking-widest uppercase mb-6"
          >
            <Gavel className="w-4 h-4" /> Legal Resources
          </motion.div>
          <motion.h1 
            initial="hidden" animate="visible" variants={fadeIn}
            className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight mb-6"
          >
            クリエイターのための<br className="hidden md:block"/>権利行使キット
          </motion.h1>
          <motion.p 
            initial="hidden" animate="visible" variants={fadeIn}
            className="text-[#A8A0D8] text-lg max-w-2xl mx-auto leading-relaxed"
          >
            ProofMarkが発行する証拠を用いた、無断転載や自作発言に対する法的な対抗手段のテンプレートと法的証拠力の比較ガイダンスです。
          </motion.p>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-32 space-y-24">
        
        {/* Section 1: Comparison Table */}
        <motion.section 
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeIn}
          className="relative"
        >
          <div className="flex items-center gap-3 mb-8">
            <Scale className="w-8 h-8 text-[#00D4AA]" />
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">証明できる事実の比較</h2>
          </div>
          <p className="text-[#A8A0D8] mb-8 text-sm md:text-base leading-relaxed">
            裁判やプラットフォームへの申請で必要とされる「いつ、誰がそのデータを保有していたか」という法的存在証明において、各ソリューションがどのように評価されるかをまとめました。
          </p>

          <div className="overflow-x-auto rounded-3xl border border-[#1C1A38] bg-[#0D0B24] shadow-[0_0_40px_rgba(108,62,244,0.05)]">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="border-b border-[#1C1A38]">
                  <th className="p-6 text-sm font-bold text-[#A8A0D8] bg-[#151D2F] w-1/4">比較項目</th>
                  <th className="p-6 text-lg font-black text-[#00D4AA] bg-[#00D4AA]/5 border-x border-[#1C1A38] w-1/3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5" /> ProofMark
                    </div>
                  </th>
                  <th className="p-6 text-sm font-bold text-[#A8A0D8] bg-[#151D2F] w-1/5">パブリック・ブロックチェーン</th>
                  <th className="p-6 text-sm font-bold text-[#A8A0D8] bg-[#151D2F] w-1/5">メタデータ (Exif/C2PA)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1C1A38]">
                <tr className="group">
                  <td className="p-6 text-sm font-bold text-white">法的証拠力</td>
                  <td className="p-6 bg-[#00D4AA]/5 border-x border-[#1C1A38]">
                    <span className="text-white font-bold block mb-1">RFC3161準拠による客観的証明</span>
                    <span className="text-xs text-[#00D4AA] font-medium leading-tight block">国際標準規格のタイムスタンプ局を使用し、法廷での証拠採用実績が極めて高い。</span>
                  </td>
                  <td className="p-6 text-sm text-[#A8A0D8] leading-tight">改ざん耐性は理論上最高だが、法制度や判例が追いついておらず法的有効性が不安定。</td>
                  <td className="p-6 text-sm text-[#A8A0D8] leading-tight">内部データであり、ツールによる後からの書き換えや削除が容易なため証拠力が弱い。</td>
                </tr>
                <tr className="group">
                  <td className="p-6 text-sm font-bold text-white">ゼロ知識性 (秘匿性)</td>
                  <td className="p-6 bg-[#00D4AA]/5 border-x border-[#1C1A38]">
                    <div className="flex items-center gap-2 text-white font-bold mb-1">
                      <CheckCircle2 className="w-4 h-4 text-[#00D4AA]" /> 完全オフライン完結
                    </div>
                    <span className="text-xs text-[#A8A0D8] font-medium leading-tight block">元データをサーバーに送信せず、ブラウザ内でハッシュ（SHA-256）のみを計算。</span>
                  </td>
                  <td className="p-6 text-sm text-[#A8A0D8] leading-tight">ハッシュ記録は可能だが、ネットワーク公開によるデータ推測やガス代（コスト）が発生。</td>
                  <td className="p-6 text-sm text-[#A8A0D8] leading-tight">ファイルそのものに付与されるためデータ送信が必要なケースが多い。</td>
                </tr>
                <tr className="group">
                  <td className="p-6 text-sm font-bold text-white">プラットフォーマー連携</td>
                  <td className="p-6 bg-[#00D4AA]/5 border-x border-[#1C1A38]">
                    <span className="text-white font-bold block mb-1">DMCA申請の強力な根拠</span>
                    <span className="text-xs text-[#A8A0D8] font-medium leading-tight block">X(Twitter)やPixivへの削除申請時に、中立的な第三者機関の証明書としてURL一発で機能。</span>
                  </td>
                  <td className="p-6 text-sm text-[#A8A0D8] leading-tight">プラットフォーム側の担当者がトランザクションの検証手順を理解できないことが多い。</td>
                  <td className="p-6 text-sm text-[#A8A0D8] leading-tight">SNSにアップロードした時点でメタデータが自動削除されてしまう。</td>
                </tr>
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* Section 2: Chain of Evidence */}
        <motion.section 
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeIn}
          className="relative"
        >
          <div className="flex items-center gap-3 mb-8">
            <Network className="w-8 h-8 text-[#6C3EF4]" />
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">証拠の連鎖 (Chain of Evidence)</h2>
          </div>
          <p className="text-[#A8A0D8] mb-12 text-sm md:text-base leading-relaxed">
            ProofMarkの証明書は単独でも強力ですが、他の要素と組み合わせることで「あなたが真の作成者である」という事実を反論不可能なレベル（Chain of Evidence）へ引き上げます。
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Connecting Line */}
            <div className="hidden md:block absolute top-[40px] left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-[#6C3EF4]/0 via-[#6C3EF4]/30 to-[#6C3EF4]/0 z-0" />
            
            <div className="bg-[#0D0B24] border border-[#1C1A38] rounded-3xl p-8 relative z-10 hover:-translate-y-2 transition-transform duration-300">
              <div className="w-16 h-16 rounded-2xl bg-[#00D4AA]/10 border border-[#00D4AA]/30 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(0,212,170,0.2)]">
                <FileCheck className="w-8 h-8 text-[#00D4AA]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2"><span className="text-[#00D4AA]">01.</span> 客観的証明 (ProofMark)</h3>
              <p className="text-[#A8A0D8] text-sm leading-relaxed">
                RFC3161タイムスタンプ局による証明書。<span className="text-white font-bold">作品Aが「2026年4月11日」に間違いなく存在していた</span>という揺るぎない日付のアンカーになります。
              </p>
            </div>

            <div className="bg-[#0D0B24] border border-[#1C1A38] rounded-3xl p-8 relative z-10 hover:-translate-y-2 transition-transform duration-300">
              <div className="w-16 h-16 rounded-2xl bg-[#6C3EF4]/10 border border-[#6C3EF4]/30 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(108,62,244,0.2)]">
                <Fingerprint className="w-8 h-8 text-[#6C3EF4]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2"><span className="text-[#6C3EF4]">02.</span> 元データの保有</h3>
              <p className="text-[#A8A0D8] text-sm leading-relaxed">
                PSDやCLIPファイルなどのレイヤー構造を含む元データ、ラフ画、製作途中の工程データ。これらは<span className="text-white font-bold">真の作者だけが保有</span>できるものです。
              </p>
            </div>

            <div className="bg-[#0D0B24] border border-[#1C1A38] rounded-3xl p-8 relative z-10 hover:-translate-y-2 transition-transform duration-300">
              <div className="w-16 h-16 rounded-2xl bg-[#FF4D4D]/10 border border-[#FF4D4D]/30 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(255,77,77,0.2)]">
                <Clock className="w-8 h-8 text-[#FF4D4D]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2"><span className="text-[#FF4D4D]">03.</span> 公開実績 (SNS)</h3>
              <p className="text-[#A8A0D8] text-sm leading-relaxed">
                X(Twitter)やPixivへの最初のアップロード記録。上記の客観的証明と合わせることで、<span className="text-white font-bold">第三者の転載よりも前であること</span>が完璧に立証されます。
              </p>
            </div>
          </div>
        </motion.section>

        {/* Section 3: DMCA Templates */}
        <motion.section 
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeIn}
          className="relative"
        >
          <div className="flex items-center gap-3 mb-8">
            <Lock className="w-8 h-8 text-[#BC78FF]" />
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">DMCA削除申請テンプレート</h2>
          </div>
          
          <div className="bg-[#FF4D4D]/10 border border-[#FF4D4D]/30 rounded-2xl p-6 mb-10 flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-[#FF4D4D] shrink-0 mt-1" />
            <div>
              <h4 className="text-[#FF4D4D] font-bold mb-2">厳格な宣誓とペナルティについて</h4>
              <p className="text-[#A8A0D8] text-sm leading-relaxed">
                DMCA申請には重大な法的責任が伴います。テンプレートには必ず含まれなければならない <strong className="text-white">「善意に基づく確信（Good faith belief）」</strong> と <strong className="text-white">「偽証罪の罰則の下での宣誓（Under penalty of perjury）」</strong> の文言が組み込まれています。虚偽の申請は偽証罪や損害賠償の対象となるため、確実に自分に権利がある場合のみ使用してください。
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
                <h3 className="font-bold text-white text-sm">English Version (X/Twitter, Global)</h3>
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
