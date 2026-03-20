import { Heart, Shield, Lock } from "lucide-react";

/**
 * DeveloperMessage Component
 * Design: Cyber-Minimalist Security
 * 
 * Shows the human face behind the tool.
 * Builds trust through transparency and genuine belief.
 */

export const DeveloperMessage = () => {
  return (
    <section className="py-20 bg-gradient-to-br from-primary/5 via-transparent to-accent/5">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black mb-4">Message from the Developer</h2>
          <p className="text-muted">
            なぜProofMarkを作ったのか、その想いをお伝えします。
          </p>
        </div>

        <div className="p-8 rounded-2xl bg-card border border-border/50">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Heart className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2">AIクリエイターの権利を守りたい</h3>
              <p className="text-muted leading-relaxed">
                AIツールの登場により、クリエイティブの民主化が進みました。しかし同時に、「どうせAIでしょ？」という軽視や、作品の盗用が増えています。
                <br />
                <br />
                あなたが何時間も試行錯誤して作った作品は、あなたの創意工夫の結晶です。AIはツールに過ぎません。その事実を、技術と法律で守りたい。
                それがProofMarkです。
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2">プライバシーを最優先に</h3>
              <p className="text-muted leading-relaxed">
                あなたの作品をサーバーに送信する必要はありません。すべての処理はブラウザ内で完結します。
                生成されるのは改ざん不能な「デジタル指紋」だけ。あなたのプライバシーと作品の秘密は、完全に守られます。
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2">透明性と信頼を大切に</h3>
              <p className="text-muted leading-relaxed">
                ProofMarkはオープンな設計です。SHA-256、C2PA、3拠点分散保存——すべての技術仕様を公開しています。
                怪しいブラックボックスではなく、あなたが信頼できるツールでありたい。それが私たちの約束です。
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted">
            ProofMarkは、AIクリエイターの「盾」になることを目指しています。<br />
            一緒に、新しい時代のクリエイティブ文化を作りましょう。
          </p>
        </div>
      </div>
    </section>
  );
};
