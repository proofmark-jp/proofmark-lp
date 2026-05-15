-- 管理者ユーザー定義テーブル
CREATE TABLE IF NOT EXISTS public.admin_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS有効化
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 全ての直接アクセスを遮断（Service Roleのみが操作可能）
CREATE POLICY "No public access to admin_users" ON public.admin_users
    FOR ALL USING (false);

-- あなたのユーザーIDを登録（神の権限の付与）
-- [重要] 'YOUR_USER_ID' をあなたの実際の Supabase Auth UID に書き換えてください
INSERT INTO public.admin_users (user_id) VALUES ('aa2b82c8-22cd-4ef4-8b69-4c5aa3f064ae');