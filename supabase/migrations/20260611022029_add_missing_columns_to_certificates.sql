-- 🚨 certificates テーブルに足りない「受け口」を一括で増築する
ALTER TABLE certificates 
  ADD COLUMN IF NOT EXISTS public_verify_token UUID,
  ADD COLUMN IF NOT EXISTS process_bundle_id UUID,
  ADD COLUMN IF NOT EXISTS step_index INTEGER,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS public_image_url TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS proof_mode TEXT,
  ADD COLUMN IF NOT EXISTS visibility TEXT,
  ADD COLUMN IF NOT EXISTS sha256 TEXT;

-- 🚨 脳内キャッシュの強制リフレッシュ（必須）
NOTIFY pgrst, 'reload schema';