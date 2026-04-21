import { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { createClient } from '@supabase/supabase-js';
import { Camera, Save, User, Loader2, ShieldCheck, ArrowLeft, LayoutGrid, Globe, Info, Edit3, Twitter, Instagram, Youtube, Video, Heart, DollarSign, PenTool, CreditCard, Zap, Sparkles, Mail, Key, AlertTriangle, Trash2, Search, Code } from 'lucide-react';
import { toast } from 'sonner';
import WidgetBuilder from '../components/embed/WidgetBuilder';
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
  const [profileData, setProfileData] = useState<any>(null);

  // Form State
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [x_url, setXUrl] = useState('');
  const [instagram_url, setInstagramUrl] = useState('');
  const [youtube_url, setYoutubeUrl] = useState('');
  const [tiktok_url, setTiktokUrl] = useState('');
  const [pixiv_url, setPixivUrl] = useState('');
  const [fanbox_url, setFanboxUrl] = useState('');
  const [patreon_url, setPatreonUrl] = useState('');
  const [website_url, setWebsiteUrl] = useState('');

  // Security State
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [updatingSecurity, setUpdatingSecurity] = useState(false);

  // Admin & Impersonation State
  const [targetUserId, setTargetUserId] = useState('');
  const [isImpersonating, setIsImpersonating] = useState(false);

  const handleImpersonate = async () => {
    if (!targetUserId) return;
    try {
      setIsImpersonating(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) throw new Error("セッションが見つかりません");

      // 👑 究極の明示的fetch呼び出し（迷子を防ぎ、確実な身分証を届ける）
      const response = await fetch(`${supabaseUrl}/functions/v1/impersonate-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`, // 確実な身分証の提示
          'apikey': supabaseKey,                             // アプリの通行証
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ targetUserId })
      });

      if (!response.ok) {
         const errorData = await response.json().catch(() => ({}));
         throw new Error(errorData.error || `代理ログイン拒否 (HTTP ${response.status})`);
      }
      
      const data = await response.json();
      if (!data.loginUrl) throw new Error("リンクの取得に失敗しました");

      toast.success('代理ログインの準備が整いました。リダイレクトします...');
      
      // 👑 管理者モードであるフラグを永続化（バナー表示用）
      localStorage.setItem('proofmark_impersonating', 'true');
      localStorage.setItem('admin_email', user.email); // 戻る時のための記憶
      
      // 魔法のリンクへジャンプすることで、自動的に対象ユーザーとしてログインされます
      window.location.href = data.loginUrl;
      
    } catch (err: any) {
      toast.error('代理ログインに失敗しました', { description: err.message });
    } finally {
      setIsImpersonating(false);
    }
  };

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLocation('/auth');
        return;
      }
      setUser(session.user);

      // profilesテーブルから最新情報を取得
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();

      if (profile) {
        setProfileData(profile);
        setUsername(profile.username || '');
        setAvatarUrl(profile.avatar_url || '');
        setBio(profile.bio || '');
        setXUrl(profile.x_url || '');
        setInstagramUrl(profile.instagram_url || '');
        setYoutubeUrl(profile.youtube_url || '');
        setTiktokUrl(profile.tiktok_url || '');
        setPixivUrl(profile.pixiv_url || '');
        setFanboxUrl(profile.fanbox_url || '');
        setPatreonUrl(profile.patreon_url || '');
        setWebsiteUrl(profile.website_url || '');
      } else {
        const meta = session.user.user_metadata;
        setUsername(meta?.username || session.user.email?.split('@')[0] || '');
        setAvatarUrl(meta?.avatar_url || '');
      }

      setLoading(false);
    }
    loadUser();
  // 🛡️ 致命的バグ修正：setLocationを依存配列から外し、初回マウント時のみの実行に固定して無限フェッチを防ぐ
  }, []);

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

      // profilesテーブルへ全情報を一括保存
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username,
          avatar_url: avatarUrl,
          bio,
          x_url,
          instagram_url,
          youtube_url,
          tiktok_url,
          pixiv_url,
          fanbox_url,
          patreon_url,
          website_url,
          updated_at: new Date().toISOString()
        });

      if (profileError) throw profileError;

      // Authのメタデータも最小限同期
      await supabase.auth.updateUser({
        data: { username, avatar_url: avatarUrl }
      });

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

  // 👑 セキュリティ更新ハンドラー
  const handleUpdateEmail = async () => {
    if (!newEmail) return;
    try {
      setUpdatingSecurity(true);
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      toast.success('確認メールを送信しました。新しいメールアドレスの受信トレイをご確認ください。');
      setNewEmail('');
    } catch (err: any) {
      toast.error('メールアドレスの更新に失敗しました', { description: err.message });
    } finally {
      setUpdatingSecurity(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword) {
      toast.error('現在のパスワードを入力してください。');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      toast.error('新しいパスワードは8文字以上で入力してください。');
      return;
    }
    try {
      setUpdatingSecurity(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('パスワードを更新しました。');
      setNewPassword('');
    } catch (err: any) {
      toast.error('パスワードの更新に失敗しました', { description: err.message });
    } finally {
      setUpdatingSecurity(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return;
    try {
      setUpdatingSecurity(true);
      toast.loading('退会処理を実行しています...');

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error("セッションが無効です。再ログインしてください。");
      }

      // 👑 究極の明示的fetch呼び出し（ブラックボックスを排除し、必要な鍵をすべて手動で装填）
      const response = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`, // ユーザーの身分証
          'apikey': supabaseKey,                             // アプリの通行証
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // エラーメッセージを安全に抽出
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `退会エラー (HTTP ${response.status})`);
      }

      // API側で物理削除が成功したら、フロント側でも即座にログアウト
      await supabase.auth.signOut();

      toast.success('退会処理が完了しました。ご利用ありがとうございました。');

      // 4. トップページへ強制リダイレクト
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);

    } catch (err: any) {
      toast.error('退会処理に失敗しました。', { description: err.message });
      setUpdatingSecurity(false);
    }
  };

  const currentPlan = user?.user_metadata?.plan_type || 'free';

  if (loading) return <div className="min-h-screen bg-[#07061A] flex justify-center items-center text-[#00D4AA] tracking-widest font-bold">LOADING...</div>;

  return (
    <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] font-sans pb-24">
      {/* 👑 UX改善：回遊性の向上とブランド表記の統一 */}
      <div className="max-w-4xl mx-auto px-6 pt-12 pb-8">
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <Link href="/dashboard">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-[#A8A0D8] hover:text-white transition-colors cursor-pointer bg-[#1C1A38] border border-[#2a2a4e] px-4 py-2 rounded-full shadow-sm">
              <LayoutGrid className="w-3.5 h-3.5 text-[#6C3EF4]" /> 管理画面に戻る
            </span>
          </Link>
          <Link href={`/u/${username}`}>
            <span className="inline-flex items-center gap-2 text-xs font-bold text-[#00D4AA] hover:text-white transition-colors cursor-pointer bg-[#00D4AA]/10 border border-[#00D4AA]/20 px-4 py-2 rounded-full shadow-sm">
              <Globe className="w-3.5 h-3.5" /> 公開ギャラリーを確認
            </span>
          </Link>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <Edit3 className="w-8 h-8 text-[#6C3EF4]" /> プロフィール構築
        </h1>
        <p className="text-[#A8A0D8] mt-2 text-sm leading-relaxed">世界に公開されるあなたのアイデンティティを、細部まで磨き上げます。</p>
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
                <span className="text-[10px] font-bold text-[#00D4AA] tracking-widest uppercase">Verified</span>
              </div>
            </div>
          </div>

          {/* 👑 基本情報セクション */}
          <div className="mb-12">
            <h4 className="text-xs font-black text-[#6C3EF4] uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <Info className="w-4 h-4" /> Basic Information
            </h4>

            <div className="space-y-8">
              <div>
                <label className="block text-sm font-bold text-white mb-2">ユーザー名 (ID)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-[#6C3EF4] font-bold">@</span>
                  </div>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-[#07061A] border border-[#1C1A38] text-white rounded-xl pl-10 pr-4 py-3.5 focus:outline-none focus:border-[#6C3EF4] focus:ring-1 focus:ring-[#6C3EF4] transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2">
                  <label className="block text-sm font-bold text-white">自己紹介 (Bio)</label>
                  <span className={`text-[10px] font-bold tracking-wider ${bio.length >= 160 ? 'text-red-400' : 'text-[#A8A0D8]'}`}>
                    {bio.length} / 160
                  </span>
                </div>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={160}
                  rows={4}
                  placeholder="あなたの創作活動や専門性について教えてください..."
                  className="w-full bg-[#07061A] border border-[#1C1A38] text-white rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#6C3EF4] focus:ring-1 focus:ring-[#6C3EF4] transition-all text-sm leading-relaxed resize-none"
                />
              </div>
            </div>
          </div>

          {/* 👑 ソーシャルリンク・グリッド */}
          <div className="mb-12 pt-10 border-t border-[#1C1A38]">
            <h4 className="text-xs font-black text-[#00D4AA] uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <Globe className="w-4 h-4" /> Social & Platforms
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { label: 'X (Twitter)', val: x_url, set: setXUrl, icon: Twitter, placeholder: 'https://x.com/yourname' },
                { label: 'Instagram', val: instagram_url, set: setInstagramUrl, icon: Instagram, placeholder: 'https://instagram.com/...' },
                { label: 'YouTube', val: youtube_url, set: setYoutubeUrl, icon: Youtube, placeholder: 'https://youtube.com/@...' },
                { label: 'TikTok', val: tiktok_url, set: setTiktokUrl, icon: Video, placeholder: 'https://tiktok.com/@...' },
                { label: 'Pixiv', val: pixiv_url, set: setPixivUrl, icon: PenTool, placeholder: 'https://pixiv.net/users/...' },
                { label: 'FANBOX', val: fanbox_url, set: setFanboxUrl, icon: Heart, placeholder: 'https://fanbox.cc/@...' },
                { label: 'Patreon', val: patreon_url, set: setPatreonUrl, icon: DollarSign, placeholder: 'https://patreon.com/...' },
                { label: 'Website', val: website_url, set: setWebsiteUrl, icon: Globe, placeholder: 'https://your-site.com' },
              ].map((link) => (
                <div key={link.label}>
                  <label className="block text-[10px] font-bold text-[#A8A0D8] uppercase tracking-wider mb-2">{link.label}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <link.icon className="w-4 h-4 text-[#2a2a4e]" />
                    </div>
                    <input type="text" value={link.val} onChange={(e) => link.set(e.target.value)}
                      placeholder={link.placeholder}
                      name={`social_link_${link.label}`}
                      autoComplete="off"
                      className="w-full bg-[#07061A] border border-[#1C1A38] text-white rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-[#00D4AA] transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 👑 ウィジェット・ジェネレーター (Embed & Sharing) */}
          <div className="mb-12 pt-10 border-t border-[#1C1A38]">
            <div className="flex justify-between items-end mb-6">
              <h4 className="text-xs font-black text-[#00D4AA] uppercase tracking-[0.2em] flex items-center gap-2">
                <Code className="w-4 h-4" /> Embed & Sharing
              </h4>
              <span className="text-[10px] font-bold text-[#00D4AA] bg-[#00D4AA]/10 px-2.5 py-1 rounded-full border border-[#00D4AA]/20 uppercase tracking-widest shadow-[0_0_10px_rgba(0,212,170,0.1)]">
                Viral Engine
              </span>
            </div>

            <div className="relative group">
              {/* 🌟 アンビエント・グロウ */}
              <div className="absolute -inset-1 bg-gradient-to-r from-[#00D4AA]/20 to-[#6C3EF4]/20 rounded-[1.6rem] blur-md opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-300" />
              
              <div className="relative">
                {profileData?.username ? (
                  <WidgetBuilder username={profileData.username} />
                ) : (
                  <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.02] p-5 lg:p-8 relative overflow-hidden min-h-[500px] flex items-center justify-center">
                    {/* 👑 ティザー（魅せプ）UI：背後にうっすらとビルダーのシルエットを配置し、価値を暗示する */}
                    <div className="absolute inset-0 opacity-20 blur-[5px] pointer-events-none select-none p-5 lg:p-8 flex flex-col gap-8">
                       <div className="h-8 bg-white/20 rounded w-1/3" />
                       <div className="grid gap-8 lg:grid-cols-[340px_1fr] flex-1">
                         <div className="space-y-5">
                           <div className="h-12 bg-white/20 rounded-lg" />
                           <div className="h-12 bg-white/20 rounded-lg" />
                           <div className="h-8 bg-white/20 rounded w-3/4" />
                         </div>
                         <div className="bg-[#02040A] rounded-2xl border border-white/5 h-full" />
                       </div>
                    </div>

                    {/* 👑 グラスモーフィズム・ロックパネル：明確な価値提案とアクション誘導 */}
                    <div className="relative z-10 bg-[#0A0F24]/85 backdrop-blur-xl border border-[#00D4AA]/30 rounded-3xl p-8 sm:p-10 text-center max-w-lg shadow-[0_0_80px_rgba(0,212,170,0.15)] transform transition-all hover:scale-[1.02]">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#00D4AA]/20 to-[#6C3EF4]/20 flex items-center justify-center mx-auto mb-6 border border-[#00D4AA]/50 shadow-[0_0_30px_rgba(0,212,170,0.3)]">
                        <Code className="w-8 h-8 text-[#00D4AA]" />
                      </div>
                      <h4 className="text-xl text-white font-black mb-3 tracking-tight">バイラルエンジンを解放する</h4>
                      <p className="text-sm text-[#A8A0D8] leading-relaxed mb-8">
                        あなたの作品を世界中のWebサイトに美しく埋め込むための専用ウィジェットです。<br/>
                        利用を開始するには、まず基本情報で<strong className="text-white">ユーザー名（ID）</strong>を確定し、ポートフォリオを公開してください。
                      </p>
                      <button 
                        onClick={() => {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                          setTimeout(() => {
                            const input = document.querySelector('input[name="social_link_X (Twitter)"]') as HTMLInputElement;
                            // 注意: 実際にはユーザー名入力欄をフォーカスしたいが、現在のSettings.tsxの構造に合わせて上部にスクロール
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }, 100);
                        }}
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-[#00D4AA] to-[#00A383] text-white text-sm font-black tracking-wider shadow-[0_0_20px_rgba(0,212,170,0.4)] hover:shadow-[0_0_30px_rgba(0,212,170,0.6)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        ユーザー名（ID）を設定する
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 👑 サブスクリプション＆プラン情報 */}
          <div className="mb-12 pt-10 border-t border-[#1C1A38]">
            <h4 className="text-xs font-black text-[#F0BB38] uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Subscription & Plan
            </h4>

            <div className="bg-[#151D2F]/30 border border-[#1C1A38] rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 relative overflow-hidden group">
              {/* 装飾的な背景光 */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#F0BB38]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <h5 className="text-xl font-black text-white tracking-wider uppercase">
                    {currentPlan === 'admin' ? 'ADMIN PLAN' : currentPlan === 'light' ? 'LIGHT PLAN' : 'FREE PLAN'}
                  </h5>
                  {profileData?.is_founder && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 text-[#FFD700] text-[9px] font-bold tracking-widest uppercase shadow-[0_0_10px_rgba(255,215,0,0.2)]">
                      <Sparkles className="w-3 h-3" /> Founder
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#A8A0D8] leading-relaxed max-w-md">
                  {currentPlan === 'admin'
                    ? '管理者権限です。全機能の利用およびシステム管理パネルへアクセス可能です。'
                    : currentPlan === 'light'
                      ? 'PDF証明書の発行・Webタイムスタンプ証明が無制限で利用可能です。'
                      : '無料で月30件までのWebタイムスタンプ証明が利用可能です。全機能の解放にはアップグレードが必要です。'}
                </p>
              </div>

              {currentPlan === 'free' && (
                <Link href="/pricing">
                  <button className="shrink-0 relative z-10 bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] hover:scale-105 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(108,62,244,0.3)] hover:shadow-[0_0_25px_rgba(108,62,244,0.5)] flex items-center gap-2 text-sm cursor-pointer">
                    <Zap className="w-4 h-4 fill-white/20" /> プランをアップグレード
                  </button>
                </Link>
              )}
            </div>
          </div>

          {/* 👑 セキュリティ情報 (Account Security) */}
          <div className="mb-12 pt-10 border-t border-[#1C1A38]">
            <h4 className="text-xs font-black text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <Key className="w-4 h-4" /> Account Security
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* メールアドレス変更 */}
              <div className="bg-[#151D2F]/30 border border-[#1C1A38] rounded-2xl p-6">
                <label className="block text-sm font-bold text-white mb-2">メールアドレスの変更</label>
                <p className="text-xs text-[#A8A0D8] mb-4">現在のメールアドレス: <span className="text-white font-mono">{user?.email}</span></p>
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="w-4 h-4 text-[#2a2a4e]" />
                    </div>
                    <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="新しいメールアドレス"
                      className="w-full bg-[#07061A] border border-[#1C1A38] text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#6C3EF4] transition-all"
                    />
                  </div>
                  <button onClick={handleUpdateEmail} disabled={!newEmail || updatingSecurity}
                    className="w-full bg-[#1C1A38] hover:bg-[#2a2a4e] disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-bold transition-all border border-[#2a2a4e]"
                  >
                    メールアドレスを更新
                  </button>
                </div>
              </div>

              {/* パスワード変更 */}
              <div className="bg-[#151D2F]/30 border border-[#1C1A38] rounded-2xl p-6">
                <label className="block text-sm font-bold text-white mb-2">パスワードの変更</label>
                <p className="text-xs text-[#A8A0D8] mb-4">セキュリティのため、定期的な変更を推奨します。</p>
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Key className="w-4 h-4 text-[#2a2a4e]" />
                    </div>
                    <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="現在のパスワード"
                      className="w-full bg-[#07061A] border border-[#1C1A38] text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#6C3EF4] transition-all"
                    />
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Key className="w-4 h-4 text-[#6C3EF4]" />
                    </div>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="新しいパスワード (8文字以上)"
                      className="w-full bg-[#07061A] border border-[#1C1A38] text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#6C3EF4] transition-all"
                    />
                  </div>
                  <button onClick={handleUpdatePassword} disabled={!currentPassword || !newPassword || updatingSecurity}
                    className="w-full bg-[#1C1A38] hover:bg-[#2a2a4e] disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-bold transition-all border border-[#2a2a4e] mt-1"
                  >
                    パスワードを更新
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 👑 Delete Account (退会処理) */}
          <div className="mb-12 pt-10 border-t border-[#1C1A38]">
            <h4 className="text-xs font-black text-red-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Delete Account
            </h4>

            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h5 className="text-base font-bold text-white mb-2">アカウントの削除（退会）</h5>
                <p className="text-sm text-[#A8A0D8] leading-relaxed max-w-lg mb-2">
                  退会すると、これまでに証明した全てのデータ（ハッシュ値、公開ギャラリーの設定）が完全に消去されます。この操作は取り消すことができません。
                </p>
                <p className="text-xs font-bold text-red-400 bg-red-500/10 inline-block px-3 py-1.5 rounded-lg border border-red-500/20">
                  ※ 有料プランをご利用の場合、退会と同時にサブスクリプションも即座に解約され、今後の請求は一切発生しません。
                </p>
              </div>

              <div className="shrink-0 flex flex-col gap-2 w-full md:w-auto">
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value.toUpperCase())}
                  placeholder="DELETE と入力"
                  className="w-full md:w-48 bg-[#07061A] border border-red-500/30 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500 transition-all text-center"
                />
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirm !== 'DELETE' || updatingSecurity}
                  className="w-full md:w-48 bg-red-500/20 hover:bg-red-500 hover:text-white text-red-400 disabled:opacity-30 disabled:hover:bg-red-500/20 disabled:hover:text-red-400 py-2.5 rounded-xl text-sm font-bold transition-all border border-red-500/50 flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> 退会処理を実行
                </button>
              </div>
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

          {/* 👑 神の領域：Admin System (メールアドレスによる絶対ロック) */}
          {user?.email === 'fiftyfifty.ok@gmail.com' ? (
            <div className="mt-16 pt-10 border-t-2 border-[#F0BB38]/30 border-dashed">
              <div className="bg-[#1A1200] border border-[#F0BB38]/30 rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-[0_0_30px_rgba(240,187,56,0.1)]">
                <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-[#F0BB38] to-[#FF8C00]" />

                <h3 className="text-[#F0BB38] text-sm font-black mb-6 uppercase tracking-[0.2em] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" /> Admin System
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* 代理ログイン (Impersonation) UI */}
                  <div className="bg-black/40 border border-[#F0BB38]/20 rounded-xl p-5">
                    <h4 className="text-white text-xs font-bold mb-2 flex items-center gap-2">
                      <User className="w-4 h-4 text-[#F0BB38]" /> ユーザー代理ログイン (Impersonation)
                    </h4>
                    <p className="text-[#A8A0D8] text-[10px] leading-relaxed mb-4">
                      エラー調査のため、指定したUUIDのユーザーとして強制ログインします。※この操作は監査ログに記録されます。
                    </p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Search className="w-4 h-4 text-[#F0BB38]/50" />
                        </div>
                        <input
                          type="text"
                          value={targetUserId}
                          onChange={(e) => setTargetUserId(e.target.value)}
                          placeholder="Target User UUID"
                          className="w-full bg-[#07061A] border border-[#F0BB38]/30 text-white rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#F0BB38] font-mono"
                        />
                      </div>
                      <button 
                        onClick={handleImpersonate}
                        disabled={!targetUserId || isImpersonating}
                        className="bg-[#F0BB38] hover:bg-[#FFD700] text-black disabled:opacity-50 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2"
                      >
                        {isImpersonating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Login as User'}
                      </button>
                    </div>
                  </div>

                  {/* モード切替 (デバッグ用) */}
                  <div className="bg-black/40 border border-[#F0BB38]/20 rounded-xl p-5">
                    <h4 className="text-white text-xs font-bold mb-2 flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-[#F0BB38]" /> 開発者デバッグモード
                    </h4>
                    <p className="text-[#A8A0D8] text-[10px] leading-relaxed mb-4">
                      UIの表示テスト用に、自身のアカウントの擬似プランを変更します。
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {['free', 'light', 'admin'].map((p) => (
                        <button
                          key={p}
                          onClick={() => handlePlanChange(p)}
                          disabled={saving || currentPlan === p}
                          className="px-3 py-1.5 text-[10px] font-bold rounded-lg border border-[#F0BB38]/30 text-[#F0BB38] hover:bg-[#F0BB38]/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed uppercase tracking-wider"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-8 space-y-6">
                  {currentPlan === 'admin' && <AdminStorageSimulator />}
                  {currentPlan === 'admin' && <AdminSafetyPanel />}
                </div>
              </div>
            </div>
          ) : null}

        </div>
      </div>
    </div>
  );
}
