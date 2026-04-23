import React from "react";
import { UploadCloud, Fingerprint, Clock, FileBadge, ArrowRight, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import SEO from "../components/SEO";

export default function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "作品のアップロード（ブラウザ内処理）",
      description: "お客様のデジタル作品（画像、動画、音声、テキストなど）をProofMarkにアップロードします。この際、**作品データそのものは当社のサーバーには送信されません。**",
      details: [
        "プライバシー保護: お客様のブラウザ内で全ての処理が完結するため、作品の機密性が保たれます。",
        "高速処理: サーバーとの通信が不要なため、迅速に次のステップへ進めます。"
      ],
      icon: <UploadCloud className="w-8 h-8 text-[#00D4AA]" />,
      color: "from-[#00D4AA]/20 to-transparent",
      borderColor: "border-[#00D4AA]/30"
    },
    {
      number: "02",
      title: "SHA-256ハッシュ値の計算",
      description: "アップロードされた作品データから、世界標準の暗号学的ハッシュ関数である「SHA-256」を用いて、一意の「デジタル指紋」を生成します。",
      details: [
        "非改ざん性: わずか1ビットでも作品が変更されると、ハッシュ値は全く異なるものになります。",
        "一意性: 同じ作品からは常に同じハッシュ値が生成されます。"
      ],
      icon: <Fingerprint className="w-8 h-8 text-[#6C3EF4]" />,
      color: "from-[#6C3EF4]/20 to-transparent",
      borderColor: "border-[#6C3EF4]/30"
    },
    {
      number: "03",
      title: "タイムスタンプの付与（RFC3161準拠）",
      description: "生成されたSHA-256ハッシュ値に対し、RFC3161準拠の時刻認証局（TSA）が発行する署名付きタイムスタンプトークン（TST）を付与します。これにより、「そのハッシュ値に紐づくファイルが特定の日時に存在していたこと」を、ProofMarkに依存せず第三者が独立して検証できます。",
      details: [
        "独立検証可能性: TST単体でOpenSSL等により検証できるため、ProofMark停止後も有効性を確認できます。",
        "証拠用途: 納品時の信頼性担保、無断転載発覚時の時系列提示、取引先への制作事実の説明などに利用できます。",
        "法的採否について: 個別の紛争での証拠採用可否・証拠価値は、事案・法域・裁判所の裁量に依存します。現在利用中のTSAと信頼レベルは Trust Center で公開しています。"
      ],
      icon: <Clock className="w-8 h-8 text-[#00D4AA]" />,
      color: "from-[#00D4AA]/20 to-transparent",
      borderColor: "border-[#00D4AA]/30"
    },
    {
      number: "04",
      title: "デジタル証明書の発行",
      description: "ハッシュ値とタイムスタンプを含む、ProofMarkのデジタル証明書（PDF形式）を発行します。この証明書には、作品のサムネイル、ハッシュ値、タイムスタンプ、証明書ID、QRコードなどが記載されます。",
      details: [
        "視覚的信頼性: プロフェッショナルなデザインで、第三者への提示に適しています。",
        "検証可能性: 証明書に記載された情報を用いて、いつでも作品の非改ざん性を検証できます。"
      ],
      icon: <FileBadge className="w-8 h-8 text-[#6C3EF4]" />,
      color: "from-[#6C3EF4]/20 to-transparent",
      borderColor: "border-[#6C3EF4]/30"
    }
  ];

  return (
    <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] pt-32 pb-24 px-6 md:px-12">
      <SEO 
        title="ProofMarkのしくみ | デジタル存在証明の裏側"
        description="ProofMarkの仕組みを解説。ブラウザでのSHA-256ハッシュ計算、RFC3161準拠タイムスタンプなどを利用したクライアントサイド技術で安全・安心の証拠を作ります。"
        url="https://proofmark.jp/how-it-works"
      />
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-24 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#6C3EF4]/10 border border-[#6C3EF4]/30 text-[#6C3EF4] text-xs font-bold tracking-widest uppercase mb-6">
            <ShieldCheck className="w-4 h-4" /> How it works
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-8">
            ProofMarkの仕組み
          </h1>
          <p className="text-[#A8A0D8] text-xl max-w-2xl mx-auto leading-relaxed">
            あなたのデジタル作品が「いつ、どのような形で存在したか」を、<br className="hidden md:block" />世界標準の技術で客観的に証明します。
          </p>
        </header>

        <div className="relative space-y-24">
          {/* Vertical Line for Desktop Timeline */}
          <div className="absolute left-[31px] top-12 bottom-12 w-px bg-gradient-to-b from-[#6C3EF4]/50 via-[#00D4AA]/50 to-[#6C3EF4]/50 hidden md:block" />

          {steps.map((step, index) => (
            <div 
              key={step.number} 
              className="relative flex flex-col md:flex-row gap-8 md:gap-16 group animate-in fade-in slide-in-from-bottom-8 duration-700"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              {/* Step indicator */}
              <div className="relative z-10 flex-shrink-0 w-16 h-16 rounded-2xl bg-[#0D0B24] border border-[#1C1A38] flex items-center justify-center group-hover:border-primary transition-colors duration-500 shadow-[0_0_20px_rgba(108,62,244,0.05)]">
                <span className="text-2xl font-black text-white">{index + 1}</span>
              </div>

              <div className="flex-1 p-8 rounded-3xl bg-gradient-to-br from-[#0D0B24] to-[#0D0B24]/50 border border-[#1C1A38] group-hover:border-[#6C3EF4]/30 transition-all duration-500 relative overflow-hidden">
                {/* Visual glow bg */}
                <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${step.color} opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-[80px] pointer-events-none`} />
                
                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-6">
                    {step.icon}
                    <h3 className="text-2xl font-bold text-white tracking-tight">{step.title}</h3>
                  </div>
                  
                  <p className="text-[#D4D0F4] text-lg leading-relaxed mb-6" dangerouslySetInnerHTML={{ __html: step.description.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
                  
                  <ul className="space-y-4">
                    {step.details.map((detail, i) => (
                      <li key={i} className="flex gap-3 text-[#A8A0D8] leading-relaxed">
                        <ArrowRight className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-32 p-12 rounded-[2.5rem] bg-gradient-to-r from-[#6C3EF4]/10 to-[#00D4AA]/10 border border-[#1C1A38] text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:40px_40px]" />
          <h2 className="text-3xl font-bold text-white mb-6 relative z-10">今すぐ証明書を発行してみる</h2>
          <p className="text-[#A8A0D8] mb-10 relative z-10 max-w-xl mx-auto">
            SHA-256ハッシュ計算はブラウザ内で完結するため、作品データを送信することなく安全に利用可能です。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
            <Link href="/auth?mode=signup">
              <button className="px-10 py-4 rounded-full bg-primary text-white font-bold hover:scale-105 transition-all shadow-[0_0_30px_rgba(108,62,244,0.3)]">
                無料で始める
              </button>
            </Link>
            <Link href="/">
              <button className="px-10 py-4 rounded-full border border-[#1C1A38] text-white font-bold hover:bg-white/5 transition-all">
                トップに戻る
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
