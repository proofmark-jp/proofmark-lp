import { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { createClient } from '@supabase/supabase-js';
import { Camera, Save, User, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import AdminStorageSimulator from '../components/AdminStorageSimulator';
import AdminSafetyPanel from '../components/AdminSafetyPanel';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Settings() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form State
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLocation('/auth');
        return;
      }
      setUser(session.user);
      
      // メタデータの読み込み
      const meta = session.user.user_metadata;
      setUsername(meta?.username || session.user.email?.split('@')[0] || '');
      setAvatarUrl(meta?.avatar_url || '');
      
      setLoading(false);
    }
    loadUser();
  }, [setLocation]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) return;
      
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // avatarsバケットへアップロード（※Supabase側でavatarsバケットの作成が必要）
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          upsert: true,          // 🌟 必須：既存のファイルを強制的に上書きする
          cacheControl: '0'      // 🌟 キャッシュをさせない
        });

      if (uploadError) throw uploadError;

      // パブリックURLの取得
      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      // 🌟 追加: URLの末尾に「?t=現在時刻」を付与してブラウザのキャッシュを強制的に無効化する
      const publicUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(publicUrl);

      // 🌟 AuthのメタデータにURLを書き込む
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      if (updateError) {
        toast.error("アバターURLの保存に失敗しました");
      } else {
        // 🌟 公開プロファイルテーブルにも同期保存
        await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            username: username,
            avatar_url: publicUrl,
            updated_at: new Date().toISOString()
          });

        toast.success('アバター画像を更新しました！');
        // 🌟 確実な反映のため、Reactの状態だけでなく画面自体をハードリロードする
        setTimeout(() => {
          window.location.href = window.location.pathname; 
        }, 1000);
      }
      
    } catch (error: any) {
      toast.error('画像のアップロードに失敗しました');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Supabaseのauthメタデータを更新
      const { error } = await supabase.auth.updateUser({
        data: { 
          username: username,
          avatar_url: avatarUrl
        }
      });

      if (error) throw error;
      
      // 🌟 公開プロファイルテーブルにも同期保存
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: username,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString()
        });

      if (profileError) throw profileError;

      toast.success('プロフィールを保存しました！', {
        description: '変更を反映するためページをリロードします。',
      });
      
      // 少し待ってからリロードしてNavbar等に変更を反映
      setTimeout(() => window.location.reload(), 1500);

    } catch (error: any) {
      toast.error('保存に失敗しました');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  // ── 開発者/管理者用：プラン切り替え関数 ──
  const handlePlanChange = async (newPlan: string) => {
    try {
      setSaving(true);
      const { error } = await supabase.auth.updateUser({
        data: { plan_type: newPlan }
      });
      if (error) throw error;
      toast.success(`検証モード: ${newPlan.toUpperCase()} に変更しました`);
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      toast.error('プラン変更失敗');
    } finally {
      setSaving(false);
    }
  };

  const currentPlan = user?.user_metadata?.plan_type || 'free';

  if (loading) return <div className="min-h-screen bg-[#07061A] flex justify-center items-center text-[#00D4AA] tracking-widest font-bold">LOADING...</div>;

  return (
    <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] font-sans pb-24">
      {/* 簡易ヘッダー */}
      <div className="max-w-4xl mx-auto px-6 pt-12 pb-8">
        <Link href={`/u/${username}`}>
          <span className="inline-flex items-center gap-2 text-sm font-bold text-[#00D4AA] hover:text-white transition-colors cursor-pointer mb-6 bg-[#00D4AA]/10 hover:bg-[#00D4AA]/20 border border-[#00D4AA]/20 px-4 py-2 rounded-full">
            👤 公開ギャラリーを確認する
          </span>
        </Link>
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <User className="w-8 h-8 text-[#6C3EF4]" /> プロフィール設定
        </h1>
        <p className="text-[#A8A0D8] mt-2 text-sm">公開ポートフォリオに表示されるあなたのブランド情報をカスタマイズします。</p>
      </div>

      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-[#0D0B24] border border-[#1C1A38] rounded-3xl p-8 sm:p-10 shadow-[0_0_50px_rgba(108,62,244,0.05)]">
          
          {/* アバター設定 */}
          <div className="flex flex-col sm:flex-row gap-8 items-start sm:items-center mb-10 pb-10 border-b border-[#1C1A38]">
            <div className="relative group">
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#6C3EF4] to-[#00D4AA] flex items-center justify-center overflow-hidden border-2 border-[#1C1A38] shadow-lg">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-extrabold text-white">{username.charAt(0).toUpperCase()}</span>
                )}
                
                {/* ホバー時のオーバーレイ */}
                <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer backdrop-blur-sm">
                  {uploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white mb-1" />}
                  <span className="text-[10px] font-bold text-white tracking-wider">CHANGE</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
                </label>
              </div>
            </div>
            
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white mb-1">クリエイター・アイコン</h3>
              <p className="text-sm text-[#A8A0D8] mb-3">ポートフォリオの顔となるアイコン画像を設定します。推奨サイズは 400x400px です。</p>
              <div className="inline-flex items-center gap-2 bg-[#00D4AA]/10 border border-[#00D4AA]/30 px-3 py-1.5 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00D4AA]" />
                <span className="text-[10px] font-bold text-[#00D4AA] tracking-widest uppercase">Verified Visual</span>
              </div>
            </div>
          </div>

          {/* ユーザーネーム設定 */}
          <div className="mb-10">
            <label className="block text-sm font-bold text-white mb-2">クリエイター名 (Username)</label>
            <p className="text-xs text-[#A8A0D8] mb-3">証明書や公開ポートフォリオ（proofmark.jp/u/...）に表示される名前です。</p>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-[#6C3EF4] font-bold">@</span>
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#07061A] border border-[#1C1A38] text-white rounded-xl pl-10 pr-4 py-3.5 focus:outline-none focus:border-[#6C3EF4] focus:ring-1 focus:ring-[#6C3EF4] transition-all font-medium"
                placeholder="sinn"
              />
            </div>
          </div>

          {/* 保存ボタン */}
          <div className="flex justify-end pt-4 border-t border-[#1C1A38]">
            <button
              onClick={handleSave}
              disabled={saving || !username}
              className="bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] hover:from-[#5A2BD4] hover:to-[#7948FF] disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3.5 rounded-full font-bold transition-all shadow-[0_0_20px_rgba(108,62,244,0.3)] flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {saving ? '保存中...' : '変更を保存する'}
            </button>
          </div>

          {/* ── 開発者検証用パネル ── */}
          <div className="mt-12 p-6 border border-[#F0BB38]/30 bg-[#F0BB38]/5 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#F0BB38]" />
            <h3 className="text-[#F0BB38] text-xs font-black mb-4 uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Admin Verification Mode
            </h3>
            <p className="text-[#A8A0D8] text-xs mb-4">
              現在のプラン: <strong className="text-white uppercase">{currentPlan}</strong>
            </p>
            <div className="flex flex-wrap gap-3">
              {['free', 'light', 'admin'].map((p) => (
                <button
                  key={p}
                  onClick={() => handlePlanChange(p)}
                  disabled={saving || currentPlan === p}
                  className="px-4 py-2 text-xs font-bold rounded-lg border border-[#1C1A38] text-[#A8A0D8] hover:text-white hover:border-[#F0BB38] hover:bg-[#F0BB38]/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {p.toUpperCase()} モード
                </button>
              ))}
            </div>
          </div>

          {/* ── ストレージ容量シミュレーター (ADMIN限定) ── */}
          {currentPlan === 'admin' && <AdminStorageSimulator />}

          {/* ── 管理パネル: キルスイッチ & プラン管理 (ADMIN限定) ── */}
          {currentPlan === 'admin' && <AdminSafetyPanel />}

        </div>
      </div>
    </div>
  );
}
