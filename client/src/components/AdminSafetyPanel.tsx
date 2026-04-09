import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ShieldAlert, Trash2, UserCog, AlertTriangle, CheckCircle, Loader2, Search } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const MODERATION_REASONS = [
  { value: '', label: '— 削除理由を選択 —' },
  { value: '著作権侵害', label: '📋 著作権侵害' },
  { value: '公序良俗違反', label: '⚠️ 公序良俗違反' },
  { value: 'ユーザー本人の依頼', label: '👤 ユーザー本人の依頼' },
  { value: 'その他', label: '📝 その他' },
];

const PLAN_OPTIONS = ['free', 'light', 'admin'];

export default function AdminSafetyPanel() {
  // --- キルスイッチ State ---
  const [certId, setCertId] = useState('');
  const [reason, setReason] = useState('');
  const [killConfirmed, setKillConfirmed] = useState(false);
  const [killing, setKilling] = useState(false);
  const [killResult, setKillResult] = useState<{ ok: boolean; message: string } | null>(null);

  // --- プラン管理 State ---
  const [targetUser, setTargetUser] = useState('');
  const [newPlan, setNewPlan] = useState('light');
  const [planConfirmed, setPlanConfirmed] = useState(false);
  const [planSearching, setPlanSearching] = useState(false);
  const [foundUserId, setFoundUserId] = useState<string | null>(null);
  const [planResult, setPlanResult] = useState<{ ok: boolean; message: string } | null>(null);

  // ---------------------------------------------------------------------------
  // 機能①: キルスイッチ（証明書の非活性化 + 画像削除）
  // ---------------------------------------------------------------------------
  const handleKillSwitch = async () => {
    if (!certId.trim() || !reason || !killConfirmed) return;
    setKilling(true);
    setKillResult(null);

    try {
      // 1. 証明書情報を取得（storage_path が必要）
      const { data: cert, error: fetchError } = await supabase
        .from('certificates')
        .select('id, storage_path, public_image_url')
        .eq('id', certId.trim())
        .single();

      if (fetchError || !cert) throw new Error('証明書が見つかりません: ' + (fetchError?.message || ''));

      // 2. DBのフラグを更新
      const { error: updateError } = await supabase
        .from('certificates')
        .update({
          is_active: false,
          moderation_reason: reason,
          moderated_at: new Date().toISOString(),
        })
        .eq('id', certId.trim());

      if (updateError) throw new Error('DB更新失敗: ' + updateError.message);

      // 3. Storageから画像を削除（パスが存在する場合）
      if (cert.storage_path) {
        const { error: storageError } = await supabase.storage
          .from('proof_images')
          .remove([cert.storage_path]);

        // Storage削除失敗は警告扱い（DB更新は成功済み）
        if (storageError) {
          console.warn('[AdminSafetyPanel] Storage removal warning:', storageError.message);
        }
      }

      setKillResult({ ok: true, message: `✅ 証明書 ${certId} を非活性化しました。理由: ${reason}` });
      setCertId('');
      setReason('');
      setKillConfirmed(false);
    } catch (err: any) {
      setKillResult({ ok: false, message: '❌ ' + err.message });
    } finally {
      setKilling(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 機能②: ユーザープラン管理
  // ---------------------------------------------------------------------------
  const handleSearchUser = async () => {
    if (!targetUser.trim()) return;
    setPlanSearching(true);
    setFoundUserId(null);
    setPlanResult(null);

    try {
      // メールアドレスかUUID形式かで検索方法を分岐
      const isEmail = targetUser.includes('@');
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username')
        .eq(isEmail ? 'email' : 'id', targetUser.trim())
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) throw new Error('ユーザーが見つかりません');

      setFoundUserId(data.id);
      setPlanResult({ ok: true, message: `🔍 ユーザー発見: ${data.username || data.id}` });
    } catch (err: any) {
      setPlanResult({ ok: false, message: '❌ ' + err.message });
    } finally {
      setPlanSearching(false);
    }
  };

  const handlePlanUpdate = async () => {
    if (!foundUserId || !planConfirmed) return;
    setPlanSearching(true);
    setPlanResult(null);

    try {
      // トークン取得
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // API を経由して Auth メタデータ (plan_type) と Profile (plan_tier) を一括更新
      const response = await fetch('/api/admin-update-plan', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: foundUserId, newPlan }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '更新に失敗しました');

      setPlanResult({ ok: true, message: `✅ ユーザー ${foundUserId} のプランを "${newPlan}" に変更しました（メタデータ同期完了）。` });
      setTargetUser('');
      setFoundUserId(null);
      setPlanConfirmed(false);
    } catch (err: any) {
      setPlanResult({ ok: false, message: '❌ ' + err.message });
    } finally {
      setPlanSearching(false);
    }
  };

  return (
    <div className="mt-12 rounded-2xl border border-red-500/20 bg-[#0D0B24] overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 px-6 py-4 bg-red-500/10 border-b border-red-500/20">
        <div className="p-2 rounded-lg bg-red-500/20">
          <ShieldAlert className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h3 className="text-sm font-black text-white tracking-widest uppercase">Admin Safety Panel</h3>
          <p className="text-xs text-[#A8A0D8] mt-0.5">ADMIN専用 — 誤操作防止ロック付き</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-black text-red-400 tracking-widest">RESTRICTED</span>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ======== 機能①: キルスイッチ ======== */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-red-500/20">
            <Trash2 className="w-4 h-4 text-red-400" />
            <h4 className="text-sm font-black text-red-400 uppercase tracking-widest">Kill Switch</h4>
            <span className="text-[10px] text-[#A8A0D8]">— 証明書の強制非活性化</span>
          </div>

          {/* 証明書ID入力 */}
          <div>
            <label className="block text-xs font-bold text-[#A8A0D8] uppercase tracking-widest mb-1.5">
              対象証明書 ID
            </label>
            <input
              type="text"
              value={certId}
              onChange={(e) => { setCertId(e.target.value); setKillResult(null); }}
              placeholder="UUID を貼り付け..."
              className="w-full bg-[#07061A] border border-[#1C1A38] focus:border-red-500/50 text-white text-sm rounded-xl px-4 py-3 font-mono focus:outline-none focus:ring-1 focus:ring-red-500/30 transition-all"
            />
          </div>

          {/* 削除理由選択 */}
          <div>
            <label className="block text-xs font-bold text-[#A8A0D8] uppercase tracking-widest mb-1.5">
              削除理由（法的備忘録）
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-[#07061A] border border-[#1C1A38] focus:border-red-500/50 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-red-500/30 transition-all appearance-none cursor-pointer"
            >
              {MODERATION_REASONS.map((r) => (
                <option key={r.value} value={r.value} disabled={r.value === ''}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* 安全ロック チェックボックス */}
          <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${killConfirmed ? 'border-red-400/40 bg-red-400/5' : 'border-[#1C1A38] bg-[#07061A] hover:border-red-400/20'}`}>
            <input
              type="checkbox"
              checked={killConfirmed}
              onChange={(e) => setKillConfirmed(e.target.checked)}
              className="mt-0.5 accent-red-500 w-4 h-4 flex-shrink-0"
            />
            <span className="text-xs text-[#A8A0D8] leading-relaxed">
              <strong className="text-white">法的証拠として</strong>、この理由で削除を記録します。この操作は取り消せません。
            </span>
          </label>

          {/* 実行ボタン */}
          <button
            onClick={handleKillSwitch}
            disabled={!certId.trim() || !reason || !killConfirmed || killing}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm tracking-widest uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 disabled:hover:bg-red-500/20"
          >
            {killing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> 処理中...</>
            ) : (
              <><Trash2 className="w-4 h-4" /> 証明書を削除する</>
            )}
          </button>

          {/* 結果表示 */}
          {killResult && (
            <div className={`px-4 py-3 rounded-xl text-xs font-bold leading-relaxed ${killResult.ok ? 'bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-[#00D4AA]' : 'bg-red-400/10 border border-red-400/30 text-red-400'}`}>
              {killResult.message}
            </div>
          )}
        </div>

        {/* ======== 機能②: ユーザープラン管理 ======== */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#6C3EF4]/20">
            <UserCog className="w-4 h-4 text-[#6C3EF4]" />
            <h4 className="text-sm font-black text-[#6C3EF4] uppercase tracking-widest">Plan Manager</h4>
            <span className="text-[10px] text-[#A8A0D8]">— ユーザー権限の変更</span>
          </div>

          {/* ユーザー検索 */}
          <div>
            <label className="block text-xs font-bold text-[#A8A0D8] uppercase tracking-widest mb-1.5">
              ユーザーIDまたはメールアドレス
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={targetUser}
                onChange={(e) => { setTargetUser(e.target.value); setFoundUserId(null); setPlanResult(null); }}
                placeholder="UUID または user@example.com"
                className="flex-1 bg-[#07061A] border border-[#1C1A38] focus:border-[#6C3EF4]/50 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#6C3EF4]/30 transition-all font-mono"
              />
              <button
                onClick={handleSearchUser}
                disabled={!targetUser.trim() || planSearching}
                className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-[#6C3EF4]/20 hover:bg-[#6C3EF4]/30 border border-[#6C3EF4]/40 text-[#6C3EF4] text-xs font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {planSearching && !foundUserId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                検索
              </button>
            </div>
          </div>

          {/* プラン選択（ユーザー発見後） */}
          {foundUserId && (
            <>
              <div>
                <label className="block text-xs font-bold text-[#A8A0D8] uppercase tracking-widest mb-1.5">
                  新しいプラン
                </label>
                <div className="flex gap-2">
                  {PLAN_OPTIONS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setNewPlan(p)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${newPlan === p ? 'bg-[#6C3EF4]/30 border-[#6C3EF4] text-white' : 'bg-[#07061A] border-[#1C1A38] text-[#A8A0D8] hover:border-[#6C3EF4]/30'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* 安全ロック チェックボックス */}
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${planConfirmed ? 'border-[#6C3EF4]/40 bg-[#6C3EF4]/5' : 'border-[#1C1A38] bg-[#07061A] hover:border-[#6C3EF4]/20'}`}>
                <input
                  type="checkbox"
                  checked={planConfirmed}
                  onChange={(e) => setPlanConfirmed(e.target.checked)}
                  className="mt-0.5 accent-[#6C3EF4] w-4 h-4 flex-shrink-0"
                />
                <span className="text-xs text-[#A8A0D8] leading-relaxed">
                  <strong className="text-white">権限変更を確定する。</strong> 対象ユーザーの plan_tier を「{newPlan}」に変更します。
                </span>
              </label>

              {/* 実行ボタン */}
              <button
                onClick={handlePlanUpdate}
                disabled={!planConfirmed || planSearching}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm tracking-widest uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-[#6C3EF4]/20 hover:bg-[#6C3EF4]/30 border border-[#6C3EF4]/40 text-[#6C3EF4] disabled:hover:bg-[#6C3EF4]/20"
              >
                {planSearching && foundUserId ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> 更新中...</>
                ) : (
                  <><CheckCircle className="w-4 h-4" /> プランを変更する</>
                )}
              </button>
            </>
          )}

          {/* 結果表示 */}
          {planResult && (
            <div className={`px-4 py-3 rounded-xl text-xs font-bold leading-relaxed ${planResult.ok && foundUserId === null ? 'bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-[#00D4AA]' : planResult.ok ? 'bg-[#6C3EF4]/10 border border-[#6C3EF4]/30 text-[#A8A0D8]' : 'bg-red-400/10 border border-red-400/30 text-red-400'}`}>
              {planResult.message}
            </div>
          )}

          {/* 注意書き */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-[#F0BB38]/5 border border-[#F0BB38]/20">
            <AlertTriangle className="w-4 h-4 text-[#F0BB38] flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-[#A8A0D8] leading-relaxed">
              <strong className="text-[#F0BB38]">注意:</strong> プランの変更は <code className="bg-[#07061A] px-1 rounded">profiles.plan_tier</code> を更新します。
              Auth メタデータ（<code className="bg-[#07061A] px-1 rounded">user_metadata.plan_type</code>）の更新は Service Role キーが必要です。
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
