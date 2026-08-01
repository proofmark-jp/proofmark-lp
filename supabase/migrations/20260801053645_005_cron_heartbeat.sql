-- =============================================================================
-- 👑 THE SOVEREIGN ARCHITECT: sql/schema/005_cron_heartbeat.sql
-- Phase 1.5: The Watchdog Trinity & Oracle Node Heartbeat (Manual Correction Integrated)
-- 目的: Blueprint §IV.7 および §XI に基づき、pg_cron / Vercel Cron / Mac mini の相互監視基盤を冪等に錬成
-- =============================================================================

-- 1. cron_heartbeat テーブル錬成 (The Watchdog Trinity: §IV.7)
CREATE TABLE IF NOT EXISTS public.cron_heartbeat (
    job_name TEXT PRIMARY KEY,
    last_success_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expected_interval_seconds INTEGER NOT NULL,
    consecutive_failures INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. oracle_node_heartbeat テーブル錬成 (Mac mini M4 Death Detector: §XI / Manual Correction)
CREATE TABLE IF NOT EXISTS public.oracle_node_heartbeat (
    node_id TEXT PRIMARY KEY DEFAULT 'mac-mini-m4-primary',
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'degraded', 'dead')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 冪等なインデックス生成
CREATE INDEX IF NOT EXISTS idx_cron_heartbeat_last_success 
    ON public.cron_heartbeat (last_success_at DESC);

CREATE INDEX IF NOT EXISTS idx_oracle_node_heartbeat_status 
    ON public.oracle_node_heartbeat (status, last_heartbeat_at DESC);

-- 4. 自動更新トリガー
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_cron_heartbeat_updated_at') THEN
        CREATE TRIGGER handle_cron_heartbeat_updated_at
            BEFORE UPDATE ON public.cron_heartbeat
            FOR EACH ROW
            EXECUTE FUNCTION public.moddatetime();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_oracle_node_heartbeat_updated_at') THEN
        CREATE TRIGGER handle_oracle_node_heartbeat_updated_at
            BEFORE UPDATE ON public.oracle_node_heartbeat
            FOR EACH ROW
            EXECUTE FUNCTION public.moddatetime();
    END IF;
END
$$;

-- 5. Zero-Trust RLS (Row Level Security) の絶対封鎖
ALTER TABLE public.cron_heartbeat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_node_heartbeat ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cron_heartbeat' AND policyname = 'Deny all public access to cron_heartbeat') THEN
        CREATE POLICY "Deny all public access to cron_heartbeat" ON public.cron_heartbeat
            FOR ALL USING (false) WITH CHECK (false);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'oracle_node_heartbeat' AND policyname = 'Deny all public access to oracle_node_heartbeat') THEN
        CREATE POLICY "Deny all public access to oracle_node_heartbeat" ON public.oracle_node_heartbeat
            FOR ALL USING (false) WITH CHECK (false);
    END IF;
END
$$;