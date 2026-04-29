-- ============================================================
-- ProofMark: Profiles Table Migration
-- ============================================================

-- [1] profiles テーブルの作成
-- auth.users の id を参照し、ユーザーが設定した公開情報を格納する
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT         UNIQUE NOT NULL,
  avatar_url  TEXT,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- updated_at の自動更新トリガー
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- [2] RLS (Row Level Security) 設定
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 誰でも他者のプロフィール（username, avatar_url）を閲覧可能
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING (true);

-- ユーザーは自分のプロフィールのみ作成可能
CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ユーザーは自分のプロフィールのみ更新可能
CREATE POLICY "Users can update their own profile."
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================================
-- 完了
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '✅ ProofMark: Profiles table migration completed successfully!';
END;
$$;
