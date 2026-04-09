import { useState } from 'react';
import { Database, HardDrive, TrendingUp, Image as ImageIcon, Calendar, AlertTriangle } from 'lucide-react';

export default function AdminStorageSimulator() {
  const [dailyUploads, setDailyUploads] = useState(10);
  const [imageSizeKB, setImageSizeKB] = useState(150);
  const [storageLimitGB, setStorageLimitGB] = useState(1);

  // 計算ロジック
  const totalKB = storageLimitGB * 1024 * 1024;
  const dailyKB = dailyUploads * imageSizeKB;
  const daysRemaining = Math.floor(totalKB / dailyKB);
  const monthsRemaining = (daysRemaining / 30).toFixed(1);
  const totalImages = Math.floor(totalKB / imageSizeKB);

  // 危険度のカラー判定
  const urgencyColor =
    daysRemaining < 30
      ? { text: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/30' }
      : daysRemaining < 90
      ? { text: 'text-[#F0BB38]', bg: 'bg-[#F0BB38]/10', border: 'border-[#F0BB38]/30' }
      : { text: 'text-[#00D4AA]', bg: 'bg-[#00D4AA]/10', border: 'border-[#00D4AA]/30' };

  const usagePercent = Math.min(100, Math.floor((dailyKB * 30) / totalKB * 100));

  return (
    <div className="mt-12 rounded-2xl border border-[#6C3EF4]/30 bg-[#0D0B24] overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 px-6 py-4 bg-[#6C3EF4]/10 border-b border-[#6C3EF4]/20">
        <div className="p-2 rounded-lg bg-[#6C3EF4]/20">
          <Database className="w-5 h-5 text-[#6C3EF4]" />
        </div>
        <div>
          <h3 className="text-sm font-black text-white tracking-widest uppercase">
            Storage Cost Simulator
          </h3>
          <p className="text-xs text-[#A8A0D8] mt-0.5">ADMIN専用 — リアルタイム容量予測</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#6C3EF4]/20 border border-[#6C3EF4]/30">
          <div className="w-1.5 h-1.5 rounded-full bg-[#6C3EF4] animate-pulse" />
          <span className="text-[10px] font-black text-[#6C3EF4] tracking-widest">ADMIN</span>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 左: スライダー群 */}
        <div className="space-y-6">
          {/* 1. 1日あたりのアップロード数 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="flex items-center gap-2 text-sm font-bold text-white">
                <ImageIcon className="w-4 h-4 text-[#6C3EF4]" /> 1日あたりのアップロード数
              </label>
              <span className="text-lg font-black text-[#6C3EF4]">{dailyUploads}<span className="text-xs text-[#A8A0D8] ml-1">枚/日</span></span>
            </div>
            <input
              type="range"
              min={1}
              max={500}
              value={dailyUploads}
              onChange={(e) => setDailyUploads(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[#6C3EF4] bg-[#1C1A38]"
            />
            <div className="flex justify-between text-[10px] text-[#A8A0D8] mt-1">
              <span>1</span><span>250</span><span>500</span>
            </div>
          </div>

          {/* 2. 平均画像サイズ */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="flex items-center gap-2 text-sm font-bold text-white">
                <HardDrive className="w-4 h-4 text-[#00D4AA]" /> 平均圧縮後サイズ
              </label>
              <span className="text-lg font-black text-[#00D4AA]">{imageSizeKB}<span className="text-xs text-[#A8A0D8] ml-1">KB/枚</span></span>
            </div>
            <input
              type="range"
              min={10}
              max={2000}
              step={10}
              value={imageSizeKB}
              onChange={(e) => setImageSizeKB(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[#00D4AA] bg-[#1C1A38]"
            />
            <div className="flex justify-between text-[10px] text-[#A8A0D8] mt-1">
              <span>10KB</span><span>1MB</span><span>2MB</span>
            </div>
          </div>

          {/* 3. ストレージ上限 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="flex items-center gap-2 text-sm font-bold text-white">
                <TrendingUp className="w-4 h-4 text-[#F0BB38]" /> ストレージ上限
              </label>
              <span className="text-lg font-black text-[#F0BB38]">{storageLimitGB}<span className="text-xs text-[#A8A0D8] ml-1">GB</span></span>
            </div>
            <input
              type="range"
              min={0.5}
              max={50}
              step={0.5}
              value={storageLimitGB}
              onChange={(e) => setStorageLimitGB(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[#F0BB38] bg-[#1C1A38]"
            />
            <div className="flex justify-between text-[10px] text-[#A8A0D8] mt-1">
              <span>0.5GB</span><span>25GB</span><span>50GB</span>
            </div>
          </div>

          {/* 月間使用量プログレスバー */}
          <div className="pt-2">
            <div className="flex justify-between text-xs font-bold text-[#A8A0D8] mb-1.5">
              <span>月間使用率（予測）</span>
              <span className={usagePercent > 80 ? 'text-red-400' : 'text-white'}>{usagePercent}%</span>
            </div>
            <div className="w-full h-3 bg-[#1C1A38] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-[#F0BB38]' : 'bg-[#00D4AA]'
                }`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* 右: 結果カード群 */}
        <div className="space-y-4">
          {/* 到達日数 */}
          <div className={`p-4 rounded-xl border ${urgencyColor.bg} ${urgencyColor.border}`}>
            <div className="flex items-center gap-2 mb-1">
              <Calendar className={`w-4 h-4 ${urgencyColor.text}`} />
              <span className={`text-xs font-black uppercase tracking-widest ${urgencyColor.text}`}>容量到達まで</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-black ${urgencyColor.text}`}>{daysRemaining.toLocaleString()}</span>
              <span className="text-sm text-[#A8A0D8]">日</span>
              <span className={`text-xl font-black ml-2 ${urgencyColor.text}`}>({monthsRemaining}</span>
              <span className="text-sm text-[#A8A0D8]">ヶ月)</span>
            </div>
            {daysRemaining < 30 && (
              <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> 30日以内に上限到達の予測です。対策を検討してください。
              </p>
            )}
          </div>

          {/* 保存可能総枚数 */}
          <div className="p-4 rounded-xl border border-[#6C3EF4]/20 bg-[#6C3EF4]/5">
            <div className="flex items-center gap-2 mb-1">
              <ImageIcon className="w-4 h-4 text-[#6C3EF4]" />
              <span className="text-xs font-black uppercase tracking-widest text-[#6C3EF4]">保存可能な総枚数</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">{totalImages.toLocaleString()}</span>
              <span className="text-sm text-[#A8A0D8]">枚</span>
            </div>
          </div>

          {/* 日次・月次データ */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl border border-[#1C1A38] bg-[#07061A]">
              <p className="text-[10px] font-bold text-[#A8A0D8] uppercase tracking-widest mb-1">日次使用量</p>
              <p className="text-xl font-black text-white">
                {dailyKB >= 1024
                  ? `${(dailyKB / 1024).toFixed(1)} MB`
                  : `${dailyKB} KB`}
              </p>
            </div>
            <div className="p-4 rounded-xl border border-[#1C1A38] bg-[#07061A]">
              <p className="text-[10px] font-bold text-[#A8A0D8] uppercase tracking-widest mb-1">月次使用量</p>
              <p className="text-xl font-black text-white">
                {(dailyKB * 30 / 1024) >= 1024
                  ? `${(dailyKB * 30 / 1024 / 1024).toFixed(2)} GB`
                  : `${(dailyKB * 30 / 1024).toFixed(0)} MB`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
