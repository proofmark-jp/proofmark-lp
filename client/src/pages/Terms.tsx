import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { fadeInVariants, staggerContainer } from "@/lib/animations";
import { AlertCircle, FileText, Shield, Gavel, Scale, Ban, CreditCard, Lock, RefreshCw, Trash2 } from "lucide-react";
import SEO from "@/components/SEO";

export default function Terms() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] font-sans selection:bg-[#6C3EF4]/30">
      <SEO 
        title="利用規約 | ProofMark"
        description="ProofMarkサービス利用に関する利用規約です。"
        url="https://proofmark.jp/terms"
      />
      <Navbar user={user} signOut={signOut} />
      
      <main className="relative pt-32 pb-24 px-6">
        {/* 背景装飾 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-[#6C3EF4]/10 to-transparent pointer-events-none" />
        
        <motion.div 
          className="max-w-4xl mx-auto relative z-10"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={fadeInVariants} className="mb-12 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6C3EF4]/10 border border-[#6C3EF4]/20 text-[#6C3EF4] text-xs font-bold mb-4 uppercase tracking-widest">
              Legal Documents
            </div>
            <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">ProofMark 利用規約</h1>
            <p className="text-[#A8A0D8] text-sm">最終更新日: 2026年4月7日</p>
          </motion.div>

          <div className="space-y-12">
            {/* 第1条 */}
            <motion.section variants={fadeInVariants} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#15132D] border border-[#2a2a4e] flex items-center justify-center">
                  <Scale className="w-5 h-5 text-[#6C3EF4]" />
                </div>
                <h2 className="text-xl font-bold">第1条 本規約の適用</h2>
              </div>
              <p className="text-[#A8A0D8] leading-relaxed pl-13">
                本規約は、ProofMark運営事務局（以下「当事務局」といいます）が提供する「ProofMark」（以下「本サービス」といいます）の利用に関する一切に適用されます。本サービスをご利用になる前に、本規約をよくお読みください。本サービスを利用された場合、お客様は本規約に同意したものとみなされます。
              </p>
            </motion.section>

            {/* 第2条 */}
            <motion.section variants={fadeInVariants} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#15132D] border border-[#2a2a4e] flex items-center justify-center">
                  <Lock className="w-5 h-5 text-[#00D4AA]" />
                </div>
                <h2 className="text-xl font-bold">第2条 本サービスの内容</h2>
              </div>
              <div className="text-[#A8A0D8] leading-relaxed pl-13 space-y-4">
                <p>
                  本サービスは、お客様がアップロードしたデジタルコンテンツに対し、SHA-256ハッシュ値を計算し、信頼できるタイムスタンプを付与することで、そのデジタルコンテンツが「特定の日時に存在し、かつその内容が改ざんされていないこと」を技術的に証明するものです。
                </p>
                <p>
                  本サービスは、デジタルコンテンツの存在証明を目的としており、お客様の作品の著作権の帰属、独創性、または知的財産権そのものを法的に保証するものではありません。これらの権利に関する最終的な判断は、関連法規および裁判所の判断に委ねられます。
                </p>
              </div>
            </motion.section>

            {/* 第3条 - Alert風デザイン */}
            <motion.section variants={fadeInVariants} className="pl-13">
              <div className="bg-[#1A1200] border border-[#F0BB38]/30 rounded-2xl p-6 md:p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <AlertCircle className="w-24 h-24 text-[#F0BB38]" />
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className="w-6 h-6 text-[#F0BB38]" />
                  <h2 className="text-xl font-bold text-[#F0BB38]">第3条 証明の限界と免責事項</h2>
                </div>
                <div className="space-y-4 text-sm md:text-base leading-relaxed text-[#F0BB38]/90">
                  <p className="font-bold">
                    ProofMarkが提供する証明書は、あくまで「特定の日時に、あるデジタルコンテンツがそのハッシュ値の状態で存在した」という技術的な事実を記録するものです。
                  </p>
                  <ul className="list-disc list-inside space-y-2 marker:text-[#F0BB38]">
                    <li>著作権の帰属や独創性の保証ではありません。</li>
                    <li>知的財産権の保護を約束するものではありません。</li>
                    <li>コンテンツの内容に関する責任はお客様にあります。</li>
                  </ul>
                </div>
              </div>
            </motion.section>

            {/* 第4条〜第9条 (標準的な内容) */}
            <motion.section variants={fadeInVariants} className="space-y-8 pt-8 border-t border-[#2a2a4e]">
              <div className="grid md:grid-cols-2 gap-8 pl-13">
                <div className="space-y-3">
                  <h3 className="font-bold flex items-center gap-2"><Ban className="w-4 h-4 text-red-400" /> 第4条 禁止事項</h3>
                  <p className="text-sm text-[#A8A0D8] leading-relaxed">
                    他者の知的財産権の侵害、虚偽情報の登録、サービスの運営妨害、その他公序良俗に反する行為を一切禁止します。
                  </p>
                </div>
                <div className="space-y-3">
                  <h3 className="font-bold flex items-center gap-2"><CreditCard className="w-4 h-4 text-blue-400" /> 第5条 利用料金</h3>
                  <p className="text-sm text-[#A8A0D8] leading-relaxed">
                    有料プランの料金および支払方法は、別途サービス内で定める通りとします。決済完了後の返金には応じかねます。
                  </p>
                </div>
                <div className="space-y-3">
                  <h3 className="font-bold flex items-center gap-2"><Shield className="w-4 h-4 text-[#00D4AA]" /> 第6条 知的財産権</h3>
                  <p className="text-sm text-[#A8A0D8] leading-relaxed">
                    本サービスに関する権利は当事務局に帰属します。お客様が提供したコンテンツの権利は、引き続きお客様に帰属します。
                  </p>
                </div>
                <div className="space-y-3">
                  <h3 className="font-bold flex items-center gap-2"><AlertCircle className="w-4 h-4 text-yellow-400" /> 第7条 サービスの中断・変更</h3>
                  <p className="text-sm text-[#A8A0D8] leading-relaxed">
                    保守、障害、天災等の理由により、予告なくサービスの一部または全部を中断・変更することがあります。
                  </p>
                </div>
                <div className="space-y-3">
                  <h3 className="font-bold flex items-center gap-2"><RefreshCw className="w-4 h-4 text-purple-400" /> 第8条 規約の変更</h3>
                  <p className="text-sm text-[#A8A0D8] leading-relaxed">
                    当事務局は、必要と判断した場合に本規約を変更できます。変更後の規約は、サイト上に掲載した時点で効力を生じます。
                  </p>
                </div>
                <div className="space-y-3">
                  <h3 className="font-bold flex items-center gap-2"><Gavel className="w-4 h-4 text-slate-400" /> 第9条 準拠法・裁判管轄</h3>
                  <p className="text-sm text-[#A8A0D8] leading-relaxed">
                    本規約の解釈にあたっては日本法を準拠法とし、紛争が生じた場合は当事務局所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。
                  </p>
                </div>
                <div className="space-y-3">
                  <h3 className="font-bold flex items-center gap-2"><Trash2 className="w-4 h-4 text-red-400" /> 第10条 退会・解約</h3>
                  <p className="text-sm text-[#A8A0D8] leading-relaxed">
                    お客様は、本サービス内の所定の手続き（設定画面）により、いつでも退会することができます。退会に伴い、お客様のデータは完全に消去され復旧することはできません。有料プランをご利用の場合、退会と同時にサブスクリプション契約も解約となります。
                  </p>
                </div>
              </div>
            </motion.section>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
