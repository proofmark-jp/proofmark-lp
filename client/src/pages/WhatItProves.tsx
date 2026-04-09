import React from "react";
import { CheckCircle, Shield, Scale, AlertTriangle } from "lucide-react";
import { Link } from "wouter";

export default function WhatItProves() {
  return (
    <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] pt-32 pb-24 px-6 md:px-12">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-[#00D4AA] text-xs font-bold tracking-widest uppercase mb-6">
            What it proves
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-6">
            ProofMarkが証明するもの
          </h1>
          <p className="text-[#A8A0D8] text-lg max-w-2xl mx-auto leading-relaxed">
            ProofMarkは、あなたのデジタル作品に「揺るぎない事実」を刻み込みます。その価値と、私たちが保証しない範囲を明確にご理解ください。
          </p>
        </header>

        <section className="space-y-12">
          {/* Proved Item 1 */}
          <div className="flex flex-col md:flex-row gap-8 items-start p-8 rounded-3xl bg-[#0D0B24] border border-[#1C1A38] animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="w-16 h-16 rounded-2xl bg-[#00D4AA]/10 border border-[#00D4AA]/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-8 h-8 text-[#00D4AA]" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-4">デジタルコンテンツの「存在」と「非改ざん性」</h3>
              <p className="text-[#D4D0F4] leading-relaxed mb-4">
                ProofMarkは、お客様のデジタル作品が「特定の日時に、その内容で存在していた」という技術的な事実を証明します。SHA-256ハッシュ値とRFC3161準拠のタイムスタンプにより、発行後に作品が改ざんされていないことを客観的に検証可能です。
              </p>
              <p className="text-[#D4D0F4] leading-relaxed">
                これは、AI生成作品の「オリジナル性」を主張する際の強力な根拠となり、クリエイターの創作活動を保護します。
              </p>
            </div>
          </div>

          {/* Proved Item 2 */}
          <div className="flex flex-col md:flex-row gap-8 items-start p-8 rounded-3xl bg-[#0D0B24] border border-[#1C1A38] animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            <div className="w-16 h-16 rounded-2xl bg-[#6C3EF4]/10 border border-[#6C3EF4]/20 flex items-center justify-center flex-shrink-0">
              <Shield className="w-8 h-8 text-[#6C3EF4]" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-4">プライバシーと機密性の保護</h3>
              <p className="text-[#D4D0F4] leading-relaxed">
                お客様の作品データそのものは、ProofMarkのサーバーに一切保存されません。ハッシュ値の計算は全てお客様のブラウザ内で完結し、サーバーにはハッシュ値とタイムスタンプのみが記録されます。これにより、作品の機密性が最大限に保たれ、安心してご利用いただけます。
              </p>
            </div>
          </div>

          {/* Proved Item 3 */}
          <div className="flex flex-col md:flex-row gap-8 items-start p-8 rounded-3xl bg-[#0D0B24] border border-[#1C1A38] animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            <div className="w-16 h-16 rounded-2xl bg-[#ffd966]/10 border border-[#ffd966]/20 flex items-center justify-center flex-shrink-0">
              <Scale className="w-8 h-8 text-[#ffd966]" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-4">紛争時の客観的証拠</h3>
              <p className="text-[#D4D0F4] leading-relaxed">
                ProofMarkが発行するデジタル証明書は、作品の存在時期と非改ざん性を証明する客観的な証拠として、著作権侵害や模倣品問題などの紛争発生時に活用できる可能性があります。これは、法的な手続きにおいて、お客様の主張を裏付ける重要な要素となり得ます。
              </p>
            </div>
          </div>

          {/* Disclaimer Box */}
          <div className="p-8 md:p-10 rounded-3xl bg-red-500/5 border border-red-500/20 animate-in fade-in scale-in duration-700 delay-300">
            <div className="flex items-center gap-3 mb-6 text-red-500">
              <AlertTriangle className="w-8 h-8" />
              <h3 className="text-2xl font-black tracking-tight">ProofMarkが保証しないこと（免責事項）</h3>
            </div>
            <p className="text-[#F0EFF8] font-bold mb-6">ProofMarkは強力な証明ツールですが、以下の事項については保証するものではありません。ご理解の上、ご利用ください。</p>
            <ul className="space-y-4">
              <li className="flex gap-3 text-[#D4D0F4] leading-relaxed">
                <span className="text-red-500 font-bold">•</span>
                <span><strong>著作権の帰属そのもの</strong>: 本サービスは、お客様がアップロードした作品の著作権がお客様に帰属すること、またはその作品が独創的であることを法的に証明するものではありません。著作権の発生は、創作の事実によって生じます。</span>
              </li>
              <li className="flex gap-3 text-[#D4D0F4] leading-relaxed">
                <span className="text-red-500 font-bold">•</span>
                <span><strong>作品の独創性や唯一性</strong>: 本サービスは、作品の内容が他の作品と類似していないこと、あるいは完全にオリジナルであることを保証するものではありません。</span>
              </li>
              <li className="flex gap-3 text-[#D4D0F4] leading-relaxed">
                <span className="text-red-500 font-bold">•</span>
                <span><strong>知的財産権の侵害阻止</strong>: 本サービスは、お客様の知的財産権が侵害されることを完全に阻止するものではありません。証明書は証拠の一つであり、侵害に対する法的措置は別途必要となります。</span>
              </li>
              <li className="flex gap-3 text-[#D4D0F4] leading-relaxed">
                <span className="text-red-500 font-bold">•</span>
                <span><strong>あらゆる法的状況での有効性</strong>: 証明書の法的有効性は、各国の法律、裁判所の判断、および具体的な状況によって異なります。</span>
              </li>
            </ul>
            <p className="mt-8 text-sm text-[#A8A0D8] leading-relaxed border-t border-red-500/10 pt-6">
              ProofMarkは、クリエイターの皆様がご自身の作品を保護し、その価値を主張するための強力な「武器」を提供しますが、最終的な法的判断や権利の行使については、専門家にご相談いただくことを推奨いたします。
            </p>
          </div>
        </section>

        <div className="mt-20 text-center animate-in fade-in duration-1000">
          <Link href="/" className="inline-flex items-center text-[#6C3EF4] font-bold hover:text-[#00D4AA] transition-colors gap-2">
            ← トップページへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
