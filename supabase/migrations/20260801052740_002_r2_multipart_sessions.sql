-- =============================================================================
-- 👑 THE SOVEREIGN ARCHITECT: sql/schema/002_r2_multipart_sessions.sql
-- Phase 1.2: R2 Multipart Orphan Reaper 台帳 (FinOps 課金爆発防衛)
-- 目的: Blueprint §VII.4 に基づき、孤立したMultipart Uploadを監視・刈り取る台帳を冪等に錬成
-- =============================================================================

-- 1. テーブル錬成 (The Absolute Source of Truth for Multipart Sessions)
CREATE TABLE IF NOT EXISTS public.r2_multipart_sessions (
    upload_id TEXT PRIMARY KEY,
    object_key TEXT NOT NULL,
    bucket TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    parts_uploaded INTEGER NOT NULL DEFAULT 0,
    parts_expected INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'aborted', 'reaped')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 冪等なインデックス生成 (Reaper Query Optimization)
-- 刈り取り対象 ('active' 状態) を高速に検出するための部分インデックス
CREATE INDEX IF NOT EXISTS idx_r2_multipart_reap 
    ON public.r2_multipart_sessions (status, last_heartbeat_at) 
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_r2_multipart_user_id 
    ON public.r2_multipart_sessions (user_id);

-- 3. 自動更新トリガー (Heartbeat & Updated_at 追従)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_multipart_sessions_updated_at') THEN
        CREATE TRIGGER handle_multipart_sessions_updated_at
            BEFORE UPDATE ON public.r2_multipart_sessions
            FOR EACH ROW
            EXECUTE FUNCTION public.moddatetime();
    END IF;
END
$$;

-- 4. Zero-Trust RLS (Row Level Security) の絶対封鎖
-- ブラウザからこの台帳への直接アクセスは一切禁止。Server Action / pg_cron (Service Role) 経由のみ許可。
ALTER TABLE public.r2_multipart_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'r2_multipart_sessions' AND policyname = 'Deny all public access to r2_multipart_sessions') THEN
        CREATE POLICY "Deny all public access to r2_multipart_sessions" ON public.r2_multipart_sessions
            FOR ALL USING (false) WITH CHECK (false);
    END IF;
END
$$;