BEGIN;

-- 既存のテーブルに対して、不足しているカラムを強制的に追加（ALTER TABLE）する
ALTER TABLE public.stripe_events
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  ADD COLUMN IF NOT EXISTS processed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS payload jsonb;

COMMIT;