import React, { useState } from "react";
import { Check, Zap, Minus, Tag, Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";

export default function Pricing() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [reserving, setReserving] = useState(false);

  const handleReserve = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) {
      setLocation("/auth?mode=signup&plan=light");
      return;
    }
    
    if (window.confirm("先行特典（Lightプラン3ヶ月無料＋創設者バッジ付与）を予約しますか？\\n※現在料金は発生しません。")) {
      try {
        setReserving(true);
        // Authメタデータの更新
        const { error: authError } = await supabase.auth.updateUser({
          data: { is_founder: true }
        });
        if (authError) throw authError;

        // Profilesの更新 (カラムがあれば)
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ is_founder: true })
          .eq('id', user.id);
        
        // カラムが存在しないエラーの場合は無視してもOK (とりあえずAuth Metaで動く)

        toast.success("先行特典の予約が完了しました！", {
          description: "創設者バッジがアカウントに付与されました。"
        });
        
        setTimeout(() => window.location.reload(), 1500);
      } catch (err: any) {
        toast.error("エラーが発生しました", { description: err.message });
      } finally {
        setReserving(false);
      }
    }
  };
  return (
    <div className="min-h-screen bg-[#07061A] text-white pt-32 pb-24 px-4 sm:px-6 lg:px-8 selection:bg-[#6C3EF4]/30">
      <div className="max-w-7xl mx-auto">
        {/* ===== Hero Section ===== */}
        <div className="text-center mb-16 flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-[#00D4AA] text-xs sm:text-sm font-bold tracking-widest uppercase mb-6"
          >
            <Tag className="w-4 h-4" />
            PRICING
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight mb-6 leading-tight"
          >
            描いた証拠を、<br className="sm:hidden" />ワンコインで一生の守りに。
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-[#A8A0D8] text-base sm:text-lg max-w-2xl mx-auto leading-relaxed"
          >
            まずは気軽に試せる単発プランか、大幅増枠した無料プランで、あなたの創作に安心をプラスしませんか？
          </motion.p>
        </div>

        {/* ===== Pricing Cards ===== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
          
          {/* --- Card 1: FREE --- */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col bg-[#0D0B24] border border-[#1C1A38] rounded-2xl p-8 hover:border-[#6C3EF4]/30 transition-all duration-300"
          >
            <div className="mb-8">
              <h3 className="text-xl font-black text-white tracking-wider mb-2 uppercase">FREE</h3>
              <p className="text-[#A8A0D8] text-sm h-10">まずは無料で試したい方</p>
              <div className="mt-6 flex items-baseline">
                <span className="text-4xl font-extrabold text-white">¥0</span>
                <span className="text-[#A8A0D8] ml-2 font-medium">/月</span>
              </div>
            </div>

            <ul className="mb-10 space-y-4 flex-1">
              <li className="flex items-start gap-3 text-sm">
                <Check className="w-5 h-5 text-[#00D4AA] shrink-0" />
                <span className="text-white flex-1 flex flex-col xl:flex-row xl:items-center gap-2">
                  Webタイムスタンプ証明
                  <span className="inline-block px-2 py-0.5 rounded-full bg-[#00D4AA]/20 text-[#00D4AA] text-[10px] font-bold border border-[#00D4AA]/30 truncate w-fit">
                    月30件に増枠！
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-3 text-sm">
                <Check className="w-5 h-5 text-[#00D4AA] shrink-0" />
                <span className="text-white">公開ポートフォリオ機能</span>
              </li>
              <li className="flex items-start gap-3 text-sm opacity-50">
                <Minus className="w-5 h-5 text-[#48456A] shrink-0" />
                <span className="text-[#A8A0D8]">PDF証明書の発行</span>
              </li>
            </ul>

            <Link href="/auth?mode=signup">
              <button className="w-full py-3.5 rounded-xl border border-[#1C1A38] bg-[#151332]/50 text-white font-bold hover:bg-[#1C1A38] transition-colors">
                無料で始める
              </button>
            </Link>
          </motion.div>

          {/* --- Card 2: SPOT --- */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col bg-[#0D0B24] border border-[#1C1A38] rounded-2xl p-8 hover:border-[#00D4AA]/30 transition-all duration-300"
          >
            <div className="mb-8">
              <h3 className="text-xl font-black text-white tracking-wider mb-2 uppercase">SPOT</h3>
              <p className="text-[#A8A0D8] text-sm h-10">必要な時だけ手軽に使いたい方</p>
              <div className="mt-6 flex items-baseline">
                <span className="text-4xl font-extrabold text-white">¥100</span>
                <span className="text-[#A8A0D8] ml-2 font-medium">/回</span>
              </div>
            </div>

            <ul className="mb-10 space-y-4 flex-1">
              <li className="flex items-start gap-3 text-sm">
                <Zap className="w-5 h-5 text-[#ffd966] shrink-0 fill-[#ffd966]/20" />
                <span className="text-white font-bold flex-1">
                  アカウント登録不要
                </span>
              </li>
              <li className="flex items-start gap-3 text-sm">
                <Check className="w-5 h-5 text-[#00D4AA] shrink-0" />
                <span className="text-white">PDF証明書（1件発行）</span>
              </li>
              <li className="flex items-start gap-3 text-sm">
                <Check className="w-5 h-5 text-[#00D4AA] shrink-0" />
                <span className="text-white">Webタイムスタンプ証明</span>
              </li>
              <li className="flex items-start gap-3 text-sm opacity-50">
                <Minus className="w-5 h-5 text-[#48456A] shrink-0" />
                <span className="text-[#A8A0D8]">公開ポートフォリオ保存</span>
              </li>
            </ul>

            <Link href="/spot-issue">
              <button className="w-full py-3.5 rounded-xl bg-[#00D4AA] text-[#07061A] font-bold hover:bg-[#00ebd9] transition-all shadow-[0_0_15px_rgba(0,212,170,0.3)]">
                今すぐ1件発行する
              </button>
            </Link>
          </motion.div>

          {/* --- Card 3: LIGHT --- */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col bg-[#0D0B24] border-2 border-[#6C3EF4] rounded-2xl p-8 relative shadow-[0_0_15px_rgba(108,62,244,0.3)] transform md:-translate-y-4"
          >
            <div className="absolute top-0 right-8 transform -translate-y-1/2">
              <span className="inline-block px-4 py-1.5 rounded-full bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] text-white text-xs font-bold tracking-wider uppercase shadow-lg">
                おすすめ
              </span>
            </div>

            <div className="mb-8 mt-2">
              <h3 className="text-xl font-black text-white tracking-wider mb-2 uppercase">LIGHT</h3>
              <p className="text-[#A8A0D8] text-sm h-10">本格的に権利を守りたい方へ</p>
              <div className="mt-6 flex items-baseline">
                <span className="text-4xl font-extrabold text-white">¥480</span>
                <span className="text-[#A8A0D8] ml-2 font-medium">/月</span>
              </div>
            </div>

            <ul className="mb-10 space-y-4 flex-1">
              <li className="flex items-start gap-3 text-sm">
                <Check className="w-5 h-5 text-[#6C3EF4] shrink-0" />
                <span className="text-white font-semibold">PDF証明書 <span className="text-[#00D4AA]">無制限</span></span>
              </li>
              <li className="flex items-start gap-3 text-sm">
                <Check className="w-5 h-5 text-[#6C3EF4] shrink-0" />
                <span className="text-white font-semibold">Webタイムスタンプ証明 <span className="text-[#00D4AA]">無制限</span></span>
              </li>
              <li className="flex items-start gap-3 text-sm">
                <Check className="w-5 h-5 text-[#6C3EF4] shrink-0" />
                <span className="text-white">公開ポートフォリオ機能</span>
              </li>
              <li className="flex items-start gap-3 text-sm">
                <Check className="w-5 h-5 text-[#6C3EF4] shrink-0" />
                <span className="text-white">C2PAメタデータ読取（対応予定）</span>
              </li>
              <li className="flex items-start gap-3 text-sm">
                <Check className="w-5 h-5 text-[#6C3EF4] shrink-0" />
                <span className="text-white">制作工程アップロード</span>
              </li>
            </ul>

            {user ? (
              <button 
                onClick={handleReserve}
                disabled={reserving}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] text-white font-bold hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(108,62,244,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {reserving ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {reserving ? "予約処理中..." : "先行特典を予約する"}
              </button>
            ) : (
              <Link href="/auth?mode=signup&plan=light">
                <button className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] text-white font-bold hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(108,62,244,0.4)]">
                  先行特典を予約する
                </button>
              </Link>
            )}
          </motion.div>
        </div>

        {/* ===== Footer Note ===== */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-12 text-center"
        >
          <p className="text-[#ffd966] text-sm font-bold bg-[#ffd966]/10 inline-block px-6 py-3 rounded-xl border border-[#ffd966]/20">
            ※ 先着100名はLightプラン3ヶ月無料＋創設者バッジ付き
          </p>
        </motion.div>
      </div>
    </div>
  );
}
