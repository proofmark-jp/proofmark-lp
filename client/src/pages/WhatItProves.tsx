import { CheckCircle, Shield, Scale, AlertTriangle, FileBadge, Code2, Mail, FileText } from 'lucide-react';
import { Link } from 'wouter';
import SEO from '../components/SEO';

/**
 * WhatItProves
 * ─────────────────────────────────────────────
 * Phase 11.A — Honesty Refactor
 *
 * 旧版にあった「強力な根拠」「強力な武器」「重要な要素となり得ます」を
 * 「客観的な技術データを提供します」へトーンダウン。
 *
 * SSOT: TrustCenter.tsx §1（脅威モデル）と FAQ §legal を上限基準とする。
 *
 * 変更ポリシー：
 *  - 「AI生成作品の "オリジナル性" を主張する強力な根拠」 → 「AI生成作品の制作事実を補強する技術データ」
 *  - 「重要な要素となり得ます」 → 「客観的な技術データを提供します」
 *  - 「強力な武器」 → 「客観的な技術データ」
 */
export default function WhatItProves() {
  return (
    <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] pt-32 pb-24 px-6 md:px-12">
      <SEO
        title="ProofMarkが証明するもの | 何を証明し、何を証明しないか"
        description="ProofMarkはデジタル作品の存在時期と非改ざん性を技術的に証明します。証明できる範囲と保証しない事項を、誠実に開示します。"
        url="https://proofmark.jp/what-it-proves"
      />
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-[#00D4AA] text-xs font-bold tracking-widest uppercase mb-6">
            What it proves
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-6">
            ProofMarkが証明するもの
          </h1>
          <p className="text-[#A8A0D8] text-lg max-w-2xl mx-auto leading-relaxed">
            ProofMarkは、デジタル作品の「特定日時の存在」と「非改ざん性」を技術的に証明します。証明できる範囲と、保証しない範囲を、誠実に開示します。
          </p>
        </header>

        {/* ── Honest scope notice ── */}
        <section className="mb-16 rounded-2xl border border-[#6C3EF4]/25 bg-[#6C3EF4]/5 p-6">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-[#BC78FF] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-white mb-2">
                本ページの記述基準
              </p>
              <p className="text-xs text-[#A8A0D8] leading-relaxed">
                本ページの記述は、{' '}
                <Link href="/trust-center#s1">
                  <span className="text-[#00D4AA] underline hover:no-underline">
                    Trust Center §1（脅威モデル）
                  </span>
                </Link>
                を上限基準とします。法廷での証拠採用、勝訴可能性、著作権の帰属確定は ProofMark の保証範囲外です。重要な紛争を想定する場合は弁護士にご相談ください。
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-12">
          {/* Proved Item 1 — 存在と非改ざん性 */}
          <div className="flex flex-col md:flex-row gap-8 items-start p-8 rounded-3xl bg-[#0D0B24] border border-[#1C1A38] animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="w-16 h-16 rounded-2xl bg-[#00D4AA]/10 border border-[#00D4AA]/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-8 h-8 text-[#00D4AA]" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-4">
                デジタルコンテンツの「存在」と「非改ざん性」
              </h3>
              <p className="text-[#D4D0F4] leading-relaxed mb-4">
                ProofMarkは、お客様のデジタル作品が「特定の日時に、その内容で存在していた」という技術的な事実を証明します。SHA-256ハッシュ値とRFC3161準拠のタイムスタンプにより、発行後に作品が改ざんされていないことを客観的に検証可能です。
              </p>
              <p className="text-[#D4D0F4] leading-relaxed">
                AI生成作品の制作事実や時系列を、後から第三者へ示すための<span className="text-white font-bold">客観的な技術データ</span>として活用できます。
              </p>
            </div>
          </div>

          {/* Proved Item 2 — プライバシー */}
          <div className="flex flex-col md:flex-row gap-8 items-start p-8 rounded-3xl bg-[#0D0B24] border border-[#1C1A38] animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            <div className="w-16 h-16 rounded-2xl bg-[#6C3EF4]/10 border border-[#6C3EF4]/20 flex items-center justify-center flex-shrink-0">
              <Shield className="w-8 h-8 text-[#6C3EF4]" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-4">
                プライバシーと機密性の保護（Private Proof モード）
              </h3>
              <p className="text-[#D4D0F4] leading-relaxed">
                Private Proof モードでは、お客様の作品データそのものは ProofMark のサーバーに送信されません。ハッシュ値の計算は全てお客様のブラウザ内で完結し、サーバー側にはハッシュ値とタイムスタンプのみが記録されます。Shareable Proof モードを選択した場合のみ、ポートフォリオ表示用の画像が Vercel をバイパスして Supabase Storage に直接転送されます。どちらのモードで発行したかはダッシュボードで明示されます。
              </p>
            </div>
          </div>

          {/* Proved Item 3 — 紛争時の客観データ */}
          <div className="flex flex-col md:flex-row gap-8 items-start p-8 rounded-3xl bg-[#0D0B24] border border-[#1C1A38] animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            <div className="w-16 h-16 rounded-2xl bg-[#ffd966]/10 border border-[#ffd966]/20 flex items-center justify-center flex-shrink-0">
              <Scale className="w-8 h-8 text-[#ffd966]" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-4">
                紛争時の客観的な技術データ
              </h3>
              <p className="text-[#D4D0F4] leading-relaxed">
                ProofMark が発行する証明書とTSTは、無断転載・自作発言・納品トラブルなどが発生した際に、作品の存在時期と非改ざん性を示す<span className="text-white font-bold">客観的な技術データを提供します</span>。具体的な証拠採用可否や評価は事案・法域・裁判所の裁量によって判断されるため、重要な紛争を想定する場合は弁護士にご相談ください。
              </p>
            </div>
          </div>

          {/* Disclaimer Box — 既存維持（誠実さの核） */}
          <div className="p-8 md:p-10 rounded-3xl bg-red-500/5 border border-red-500/20 animate-in fade-in scale-in duration-700 delay-300">
            <div className="flex items-center gap-3 mb-6 text-red-500">
              <AlertTriangle className="w-8 h-8" />
              <h3 className="text-2xl font-black tracking-tight">
                ProofMarkが保証しないこと（免責事項）
              </h3>
            </div>
            <p className="text-[#F0EFF8] font-bold mb-6">
              ProofMarkは技術的な証明ツールですが、以下の事項については保証するものではありません。ご理解の上、ご利用ください。
            </p>
            <ul className="space-y-4">
              <li className="flex gap-3 text-[#D4D0F4] leading-relaxed">
                <span className="text-red-500 font-bold">•</span>
                <span>
                  <strong>著作権の帰属そのもの</strong>:
                  本サービスは、お客様がアップロードした作品の著作権がお客様に帰属すること、またはその作品が独創的であることを法的に証明するものではありません。著作権の発生は、創作の事実によって生じます。
                </span>
              </li>
              <li className="flex gap-3 text-[#D4D0F4] leading-relaxed">
                <span className="text-red-500 font-bold">•</span>
                <span>
                  <strong>作品の独創性や唯一性</strong>:
                  本サービスは、作品の内容が他の作品と類似していないこと、あるいは完全にオリジナルであることを保証するものではありません。
                </span>
              </li>
              <li className="flex gap-3 text-[#D4D0F4] leading-relaxed">
                <span className="text-red-500 font-bold">•</span>
                <span>
                  <strong>知的財産権の侵害阻止</strong>:
                  本サービスは、お客様の知的財産権が侵害されることを阻止するものではありません。証明書は技術データの一つであり、侵害に対する法的措置は別途必要となります。
                </span>
              </li>
              <li className="flex gap-3 text-[#D4D0F4] leading-relaxed">
                <span className="text-red-500 font-bold">•</span>
                <span>
                  <strong>あらゆる法的状況での有効性</strong>:
                  証明書の法的有効性は、各国の法律、裁判所の判断、および具体的な状況によって異なります。
                </span>
              </li>
            </ul>
            <p className="mt-8 text-sm text-[#A8A0D8] leading-relaxed border-t border-red-500/10 pt-6">
              ProofMarkは、クリエイターの皆様が自身の作品を補強するための<span className="text-white">客観的な技術データ</span>を提供します。最終的な法的判断や権利の行使については、専門家にご相談いただくことを推奨いたします。
            </p>
          </div>
        </section>

        <div className="mt-20 text-center animate-in fade-in duration-1000">
          <Link
            href="/"
            className="inline-flex items-center text-[#6C3EF4] font-bold hover:text-[#00D4AA] transition-colors gap-2"
          >
            ← トップページへ戻る
          </Link>
        </div>

        {/* ─────────────────────────────────
         * Evidence Pack Section
         *  - アイコンは絵文字ではなく lucide-react で統一
         *  - 「絶対的証拠」を「独立検証可能な技術証拠」へトーン調整
         * ───────────────────────────────── */}
        <div id="evidence-pack" className="mt-24 pt-16 border-t border-[#1C1A38]">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#6C3EF4]/10 border border-[#6C3EF4]/30 text-[#BC78FF] text-xs font-bold tracking-widest uppercase mb-6">
            DELIVERABLE EVIDENCE
          </div>
          <h2 className="text-3xl font-bold text-white mb-6">
            納品できる証拠「Evidence Pack」
          </h2>
          <p className="text-[#A8A0D8] leading-relaxed mb-8">
            ProofMarkは単なるWeb証明書にとどまりません。著作権侵害の申し立てやクライアントへの納品時に、そのまま提出できる「証拠の束」を1つのZIPファイルとしてダウンロードできます。
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-[#151D2F]/30 border border-[#1C1A38] p-6 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <FileBadge className="w-4 h-4 text-[#00D4AA]" />
                <h3 className="text-[#00D4AA] font-bold">① RFC3161 タイムスタンプ</h3>
              </div>
              <p className="text-sm text-[#A8A0D8] leading-relaxed">
                国際標準規格のバイナリデータ（.tsr）。ProofMarkに依存せず OpenSSL等で独立検証可能な技術証拠です。
              </p>
            </div>
            <div className="bg-[#151D2F]/30 border border-[#1C1A38] p-6 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Code2 className="w-4 h-4 text-[#00D4AA]" />
                <h3 className="text-[#00D4AA] font-bold">② 独立検証スクリプト</h3>
              </div>
              <p className="text-sm text-[#A8A0D8] leading-relaxed">
                コマンド一発で証拠の真正性を検証できる verify.sh / verify.py を同梱。
              </p>
            </div>
            <div className="bg-[#151D2F]/30 border border-[#1C1A38] p-6 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-4 h-4 text-[#00D4AA]" />
                <h3 className="text-[#00D4AA] font-bold">③ クライアント提出用カバーレター</h3>
              </div>
              <p className="text-sm text-[#A8A0D8] leading-relaxed">
                証拠パックの目的と検証方法を説明する、そのまま使える日/英の提出文を同梱。
              </p>
            </div>
            <div className="bg-[#151D2F]/30 border border-[#1C1A38] p-6 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-[#00D4AA]" />
                <h3 className="text-[#00D4AA] font-bold">④ PDF証明書・メタデータ</h3>
              </div>
              <p className="text-sm text-[#A8A0D8] leading-relaxed">
                A4印刷に最適化された人間可読なHTML/PDF証明書と、機械可読なJSONメタデータを同梱。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
