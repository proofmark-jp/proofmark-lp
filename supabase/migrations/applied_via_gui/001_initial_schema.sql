-- ============================================================
-- ProofMark: Initial Schema Migration
-- ============================================================
-- 実行手順:
--   Supabase ダッシュボード > SQL Editor に貼り付けて実行
-- ============================================================

-- ============================================================
-- 1. Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 2. certificates テーブル
--    ユーザーが登録した作品の証明レコードを格納する。
--    metadata JSONB カラムには、ファイル名・サイズ・MIMEタイプなど
--    将来拡張可能な情報をフレキシブルに格納する。
-- ============================================================
CREATE TABLE IF NOT EXISTS public.certificates (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_hash     TEXT         NOT NULL,                -- SHA-256 ハッシュ（HEX文字列）
  storage_path  TEXT,                                 -- originals バケット内のオブジェクトパス
  cert_url      TEXT,                                 -- certificates バケット内の公開 PDF URL
  metadata      JSONB        NOT NULL DEFAULT '{}',   -- { filename, size, mime_type, ai_tool, ... }
  status        TEXT         NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_certificates_user_id    ON public.certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_file_hash  ON public.certificates(file_hash);
CREATE INDEX IF NOT EXISTS idx_certificates_created_at ON public.certificates(created_at DESC);

-- updated_at の自動更新トリガー
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_certificates_updated_at ON public.certificates;
CREATE TRIGGER set_certificates_updated_at
  BEFORE UPDATE ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 3. rate_limits テーブル
--    Supabase 無料枠内でのレート制限を実装する。
--    同一ユーザー・同一エンドポイントの単位時間内リクエスト数を管理する。
--    外部有料サービス（Upstash等）は使用しない。
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint      TEXT         NOT NULL,                -- 例: 'api/register', 'api/certificate'
  request_count INTEGER      NOT NULL DEFAULT 1,
  window_start  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_endpoint
  ON public.rate_limits(user_id, endpoint, window_start DESC);

-- ============================================================
-- 4. early_registrations テーブル（先行登録管理）
--    認証前の先行登録メールアドレスを格納する。
--    Supabase Auth とは独立したシンプルな登録リスト。
-- ============================================================
CREATE TABLE IF NOT EXISTS public.early_registrations (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT         NOT NULL UNIQUE,
  plan_interest TEXT         DEFAULT 'light',         -- 'free' | 'light' | 'unknown'
  ip_address    INET,                                 -- レート制限用（サーバーサイドで記録）
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_early_reg_email      ON public.early_registrations(email);
CREATE INDEX IF NOT EXISTS idx_early_reg_created_at ON public.early_registrations(created_at DESC);

-- ============================================================
-- 5. RLS (Row Level Security) ポリシー
-- ============================================================

-- ---- certificates ----
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のレコードのみ SELECT 可能
CREATE POLICY "certificates_select_own"
  ON public.certificates FOR SELECT
  USING (auth.uid() = user_id);

-- ユーザーは自分名義でのみ INSERT 可能
CREATE POLICY "certificates_insert_own"
  ON public.certificates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ユーザーは自分のレコードのみ UPDATE 可能（status管理はサーバーサイドで行う）
CREATE POLICY "certificates_update_own"
  ON public.certificates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ユーザーは自分のレコードのみ DELETE 可能
CREATE POLICY "certificates_delete_own"
  ON public.certificates FOR DELETE
  USING (auth.uid() = user_id);

-- ---- rate_limits ----
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- rate_limits は SERVICE ROLE KEY（サーバーサイド）からのみ操作する。
-- フロントエンドからのアクセスは一切禁止。
-- ※ anon / authenticated ユーザーへのポリシーは意図的に定義しない（= 全拒否）

-- ---- early_registrations ----
ALTER TABLE public.early_registrations ENABLE ROW LEVEL SECURITY;

-- 先行登録は SERVICE ROLE KEY（サーバーサイド）からのみ INSERT する。
-- 一般ユーザーからの直接 SELECT/INSERT は禁止（スパム・競合他社対策）
-- ※ anon / authenticated ユーザーへのポリシーは意図的に定義しない（= 全拒否）

-- ============================================================
-- 6. Storage バケット設定
--    ※ Supabase Storage は SQL だけでは完全設定できないため、
--      ダッシュボード上での追加操作手順をコメントに記載する。
-- ============================================================

-- [A] originals バケット（非公開 - アップロード元ファイル保存用）
-- ダッシュボード操作:
--   Storage > New Bucket
--   Name: originals
--   Public: OFF（非公開）
--   File size limit: 50MB
--   Allowed MIME types: image/*, application/pdf

-- [B] certificates バケット（公開 - 発行済み証明書 PDF 保存用）
-- ダッシュボード操作:
--   Storage > New Bucket
--   Name: certificates
--   Public: ON（公開 - 証明書URLを他者と共有するため）
--   File size limit: 10MB
--   Allowed MIME types: application/pdf

-- Storage RLS ポリシー（SQL で設定可能な部分）

-- originals バケット: 認証済みユーザーが自分のフォルダのみ操作可
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'originals',
  'originals',
  false,
  52428800,   -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'image/heic', 'image/heif']
) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'certificates',
  'certificates',
  true,
  10485760,   -- 10MB
  ARRAY['application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- originals バケット RLS
CREATE POLICY "originals_upload_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'originals' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "originals_select_own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'originals' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "originals_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'originals' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- certificates バケット RLS（公開バケットだが、アップロードはサーバーのみ）
CREATE POLICY "certificates_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'certificates');

-- ============================================================
-- 完了メッセージ
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '✅ ProofMark: Initial schema migration completed successfully!';
  RAISE NOTICE '   Tables created: certificates, rate_limits, early_registrations';
  RAISE NOTICE '   RLS enabled on all tables.';
  RAISE NOTICE '   Storage buckets: originals (private), certificates (public)';
END;
$$;
