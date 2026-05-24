-- profilesテーブルに本名とデフォルトのペルソナ設定を追加
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS legal_name TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS default_persona TEXT DEFAULT 'creator' CHECK (default_persona IN ('creator', 'legal'));

-- 既存の公開用プロフィール取得に影響がないか、必要に応じてコンテキストをクリーンに保つ
comment on column profiles.legal_name is '法的取引・NDA用の本名（非公開データ）';
comment on column profiles.default_persona is 'PDF生成時のデフォルト名義設定（creator: クリエイター名, legal: 本名）';