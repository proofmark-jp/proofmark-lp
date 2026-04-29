-- 1. profilesテーブルにplan_tierカラムを追加
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'free';

-- 2. indexを作成
CREATE INDEX IF NOT EXISTS idx_profiles_plan_tier ON public.profiles(plan_tier);

-- 3. auth.usersのメタデータ変更時に実行される関数 (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.sync_plan_tier()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
  -- raw_user_meta_data->>'plan_type' を profiles.plan_tier に自動同期
  UPDATE public.profiles
  SET plan_tier = COALESCE(NEW.raw_user_meta_data->>'plan_type', 'free')
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. トリガーを作成 (条件: plan_typeが変更された時のみ起動)
DROP TRIGGER IF EXISTS tr_sync_plan_tier ON auth.users;
CREATE TRIGGER tr_sync_plan_tier
AFTER UPDATE ON auth.users
FOR EACH ROW
WHEN (OLD.raw_user_meta_data->>'plan_type' IS DISTINCT FROM NEW.raw_user_meta_data->>'plan_type')
EXECUTE FUNCTION public.sync_plan_tier();
