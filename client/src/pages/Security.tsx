import React from "react";
import { Lock, CheckCircle, Shield, Globe, Terminal } from "lucide-react";
import { Link } from "wouter";

export default function Security() {
  return (
    <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] pt-32 pb-24 px-6 md:px-12">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-[#00D4AA] text-xs font-bold tracking-widest uppercase mb-6">
            <Lock className="w-4 h-4" /> Security
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight mb-8">
            ProofMarkの堅牢なセキュリティ
          </h1>
          <p className="text-[#A8A0D8] text-xl max-w-3xl mx-auto leading-relaxed">
            あなたのデジタル作品の信頼性を守るため、ProofMarkは最先端の技術と厳格なセキュリティ対策を採用しています。プライバシーを最優先し、改ざん不可能な証明を提供します。
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
          {/* Feature 1 */}
          <div className="group p-8 rounded-3xl bg-[#0D0B24] border border-[#1C1A38] hover:border-[#00D4AA]/40 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="w-16 h-16 rounded-2xl bg-[#00D4AA]/10 border border-[#00D4AA]/20 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
              <Terminal className="w-8 h-8 text-[#00D4AA]" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-6 tracking-tight">クライアントサイドでのハッシュ計算</h3>
            <p className="text-[#D4D0F4] leading-relaxed mb-8">
              ProofMarkの最も重要なセキュリティ機能の一つは、お客様の作品データがサーバーに送信されることなく、<strong>全てお客様のブラウザ内でSHA-256ハッシュ値が計算される</strong>点です。
            </p>
            <ul className="space-y-4 text-sm">
              <li className="flex gap-3 text-[#A8A0D8]">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#00D4AA] flex-shrink-0" />
                <span><strong>プライバシーの最大化</strong>: お客様の機密性の高い作品データがProofMarkのサーバーに触れることはありません。</span>
              </li>
              <li className="flex gap-3 text-[#A8A0D8]">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#00D4AA] flex-shrink-0" />
                <span><strong>データ漏洩リスクの低減</strong>: サーバー側でのデータ保管がないため、データ漏洩のリスクが極めて低いです。</span>
              </li>
              <li className="flex gap-3 text-[#A8A0D8]">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#00D4AA] flex-shrink-0" />
                <span><strong>高速処理</strong>: サーバーへのアップロード・ダウンロードが不要なため、迅速にハッシュ値を生成できます。</span>
              </li>
            </ul>
          </div>

          {/* Feature 2 */}
          <div className="group p-8 rounded-3xl bg-[#0D0B24] border border-[#1C1A38] hover:border-[#6C3EF4]/40 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            <div className="w-16 h-16 rounded-2xl bg-[#6C3EF4]/10 border border-[#6C3EF4]/20 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
              <CheckCircle className="w-8 h-8 text-[#6C3EF4]" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-6 tracking-tight">RFC3161準拠のタイムスタンプ</h3>
            <p className="text-[#D4D0F4] leading-relaxed mb-8">
              ProofMarkは、国際標準規格である<strong>RFC3161</strong>に準拠したタイムスタンプサービスを利用しています。これにより、ハッシュ値が特定の日時に存在したことを、信頼できる第三者機関（時刻認証局）が客観的に証明します。
            </p>
            <ul className="space-y-4 text-sm">
              <li className="flex gap-3 text-[#A8A0D8]">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#6C3EF4] flex-shrink-0" />
                <span><strong>非改ざん性</strong>: タイムスタンプが付与された後、ハッシュ値や時刻情報を改ざんすることは技術的に極めて困難です。</span>
              </li>
              <li className="flex gap-3 text-[#A8A0D8]">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#6C3EF4] flex-shrink-0" />
                <span><strong>法的証拠力</strong>: RFC3161準拠のタイムスタンプは、電子署名法に基づく時刻認証の要件を満たし、法的な証拠として高い信頼性を持ちます。</span>
              </li>
              <li className="flex gap-3 text-[#A8A0D8]">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#6C3EF4] flex-shrink-0" />
                <span><strong>客観性</strong>: ProofMark運営者を含むいかなる第三者も、タイムスタンプの時刻を操作することはできません。</span>
              </li>
            </ul>
          </div>

          {/* Feature 3 */}
          <div className="group p-8 rounded-3xl bg-[#0D0B24] border border-[#1C1A38] hover:border-[#ffd966]/40 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            <div className="w-16 h-16 rounded-2xl bg-[#ffd966]/10 border border-[#ffd966]/20 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
              <Shield className="w-8 h-8 text-[#ffd966]" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-6 tracking-tight">堅牢なインフラとデータ保護</h3>
            <p className="text-[#D4D0F4] leading-relaxed mb-8">
              ProofMarkは、お客様のハッシュ値やタイムスタンプ情報、アカウント情報などを保護するため、業界標準のセキュリティ対策を講じています。
            </p>
            <ul className="space-y-4 text-sm">
              <li className="flex gap-3 text-[#A8A0D8]">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#ffd966] flex-shrink-0" />
                <span><strong>SSL/TLS暗号化</strong>: お客様とProofMark間の通信は全てSSL/TLSによって暗号化され、データの盗聴や改ざんを防ぎます。</span>
              </li>
              <li className="flex gap-3 text-[#A8A0D8]">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#ffd966] flex-shrink-0" />
                <span><strong>アクセス制御</strong>: 厳格なアクセス制御により、許可された担当者のみが機密情報にアクセスできるよう管理しています。</span>
              </li>
              <li className="flex gap-3 text-[#A8A0D8]">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#ffd966] flex-shrink-0" />
                <span><strong>定期的なセキュリティ監査</strong>: システムの脆弱性を発見し、対策を講じるため、定期的なセキュリティ監査を実施しています。</span>
              </li>
            </ul>
          </div>

          {/* Feature 4 */}
          <div className="group p-8 rounded-3xl bg-[#0D0B24] border border-[#1C1A38] hover:border-[#00D4AA]/40 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <div className="w-16 h-16 rounded-2xl bg-[#00D4AA]/10 border border-[#00D4AA]/20 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
              <Globe className="w-8 h-8 text-[#00D4AA]" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-6 tracking-tight">透明性と説明責任</h3>
            <p className="text-[#D4D0F4] leading-relaxed mb-4">
              ProofMarkは、お客様に安心してサービスをご利用いただくため、セキュリティ対策やデータ取り扱いに関する情報を透明に開示し、説明責任を果たします。
            </p>
            <p className="text-[#A8A0D8] text-sm leading-relaxed">
              プライバシーポリシーや利用規約を通じて、お客様のデータがどのように扱われるかを明確にしています。
            </p>
          </div>
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
