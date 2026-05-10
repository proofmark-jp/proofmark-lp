-- =====================================================================
-- 20260510120000_contact_submissions.sql
-- ProofMark CS — `contact_submissions` テーブル + RLS + Index + Trigger
--
-- 設計方針:
--   1. `service_role` のみが書き込み・読み取り可能。`anon` / `authenticated` は完全遮断。
--   2. テーブルには PII (email / IP / UA) が乗るため、RLS をデフォルト deny で保護。
--   3. 主キーは API が生成するチケット ID 文字列 (`PM-XXXXX-XXXX`)。
--   4. `metadata` は JSONB で柔軟に保存。CHECK 制約で 16 KB 以下に制限。
--   5. CS オペレーション補助: `priority` / `status` / `assigned_to` / `resolved_at` を持たせる。
--   6. パフォーマンス: 受信日時 / 優先度 / email にインデックス。
--   7. `updated_at` は trigger で自動更新。
-- =====================================================================

BEGIN;

-- 0. 念のため拡張機能 (UUID 生成用に存在しなくても OK) ------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. ENUM 型 ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_priority') THEN
    CREATE TYPE contact_priority AS ENUM ('high', 'normal');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_status') THEN
    CREATE TYPE contact_status AS ENUM ('open', 'in_progress', 'waiting', 'resolved', 'spam');
  END IF;
END$$;

-- 2. テーブル本体 -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id              text PRIMARY KEY,                                 -- 'PM-XXXXX-XXXX'
  topic           text NOT NULL,                                    -- category id
  name            text,                                             -- email の local part 由来 (任意)
  email           text NOT NULL,
  company         text,
  subject         text NOT NULL,
  message         text NOT NULL,
  ip              text,                                             -- IPv4/IPv6 string
  user_agent      text,
  error_code      text,
  plan_tier       text NOT NULL DEFAULT 'free',
  priority        contact_priority NOT NULL DEFAULT 'normal',
  status          contact_status   NOT NULL DEFAULT 'open',
  assigned_to     uuid,                                             -- staff の auth.users.id
  resolved_at     timestamptz,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT contact_submissions_id_format
    CHECK (id ~ '^PM-[A-Z0-9-]{1,40}$'),
  CONSTRAINT contact_submissions_email_format
    CHECK (char_length(email) BETWEEN 3 AND 254 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT contact_submissions_subject_len
    CHECK (char_length(subject) BETWEEN 1 AND 200),
  CONSTRAINT contact_submissions_message_len
    CHECK (char_length(message) BETWEEN 1 AND 5000),
  CONSTRAINT contact_submissions_topic_len
    CHECK (char_length(topic) BETWEEN 1 AND 40),
  CONSTRAINT contact_submissions_metadata_size
    CHECK (metadata IS NULL OR octet_length(metadata::text) <= 16384),
  CONSTRAINT contact_submissions_resolved_consistent
    CHECK (
      (status = 'resolved' AND resolved_at IS NOT NULL)
      OR (status <> 'resolved')
    )
);

COMMENT ON TABLE  public.contact_submissions               IS 'ProofMark CS チケット永続化テーブル。Service Role のみ書込可。';
COMMENT ON COLUMN public.contact_submissions.id            IS '`PM-{base36 timestamp}-{4hex}` 形式のチケット ID。API が採番。';
COMMENT ON COLUMN public.contact_submissions.topic         IS 'カテゴリ ID (account / certificate / billing / evidence-pack / bug / feature / other など)';
COMMENT ON COLUMN public.contact_submissions.priority      IS 'high (Studio/Business/Enterprise/Creator) または normal';
COMMENT ON COLUMN public.contact_submissions.status        IS 'open → in_progress → waiting → resolved (or spam)';
COMMENT ON COLUMN public.contact_submissions.metadata      IS 'planTier / userAgent / currentUrl / referrer / isAuthenticated 等 (JSONB, ≤ 16KB)';

-- 3. インデックス -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at_desc
  ON public.contact_submissions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_priority_created_at
  ON public.contact_submissions (priority, created_at DESC)
  WHERE status IN ('open', 'in_progress', 'waiting');

CREATE INDEX IF NOT EXISTS idx_contact_submissions_email
  ON public.contact_submissions (email);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_topic
  ON public.contact_submissions (topic);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_status_open
  ON public.contact_submissions (created_at DESC)
  WHERE status = 'open';

-- 4. updated_at 自動更新トリガー ---------------------------------------
CREATE OR REPLACE FUNCTION public.fn_contact_submissions_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  -- status='resolved' で resolved_at が空なら自動セット
  IF NEW.status = 'resolved' AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contact_submissions_touch ON public.contact_submissions;
CREATE TRIGGER trg_contact_submissions_touch
BEFORE UPDATE ON public.contact_submissions
FOR EACH ROW
EXECUTE FUNCTION public.fn_contact_submissions_touch_updated_at();

-- 5. Row Level Security (deny by default) ------------------------------
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions FORCE  ROW LEVEL SECURITY;  -- table owner も RLS を無視できないようにする

-- 既存ポリシーをすべて削除 (idempotent migration)
DROP POLICY IF EXISTS contact_submissions_block_anon          ON public.contact_submissions;
DROP POLICY IF EXISTS contact_submissions_block_authenticated ON public.contact_submissions;
DROP POLICY IF EXISTS contact_submissions_service_full        ON public.contact_submissions;

-- 5-1. anon / authenticated は完全に遮断 (USING/WITH CHECK ともに false)
CREATE POLICY contact_submissions_block_anon
  ON public.contact_submissions
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY contact_submissions_block_authenticated
  ON public.contact_submissions
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- 5-2. service_role のみフルアクセス
CREATE POLICY contact_submissions_service_full
  ON public.contact_submissions
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 6. 権限 --------------------------------------------------------------
-- anon / authenticated には一切の権限を渡さない (二重防御)
REVOKE ALL ON public.contact_submissions FROM PUBLIC;
REVOKE ALL ON public.contact_submissions FROM anon;
REVOKE ALL ON public.contact_submissions FROM authenticated;

GRANT ALL ON public.contact_submissions TO service_role;

-- 関数の実行権限も service_role に限定
REVOKE ALL ON FUNCTION public.fn_contact_submissions_touch_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_contact_submissions_touch_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.fn_contact_submissions_touch_updated_at() FROM authenticated;

-- 7. （任意）staff 用の SECURITY DEFINER 読み取りビュー ----------------
--    管理画面から PII を伏せて閲覧するための例。実装方針に応じて削除可。
CREATE OR REPLACE VIEW public.contact_submissions_admin_view
WITH (security_invoker = true) AS
SELECT
  id,
  topic,
  email,
  subject,
  priority,
  status,
  plan_tier,
  error_code,
  created_at,
  updated_at,
  resolved_at
FROM public.contact_submissions;

REVOKE ALL ON public.contact_submissions_admin_view FROM PUBLIC;
REVOKE ALL ON public.contact_submissions_admin_view FROM anon;
REVOKE ALL ON public.contact_submissions_admin_view FROM authenticated;
GRANT SELECT ON public.contact_submissions_admin_view TO service_role;

COMMIT;

-- =====================================================================
-- 確認用クエリ (psql から)
--   SET ROLE anon;          SELECT * FROM public.contact_submissions; -- → permission denied
--   SET ROLE authenticated; SELECT * FROM public.contact_submissions; -- → permission denied
--   SET ROLE service_role;  SELECT count(*) FROM public.contact_submissions;
-- =====================================================================
