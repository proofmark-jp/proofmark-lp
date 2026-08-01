-- =============================================================================
-- 👑 THE SOVEREIGN ARCHITECT: sql/schema/006_audit_logs.sql
-- Phase 1.6: The Immutable Ledger (FinOps & Tax Compliance)
-- 目的: Blueprint §IV.4, §IV.5 に基づき、メタデータ注入と3階層パージを支える監査ログ台帳を冪等に錬成
-- =============================================================================

-- 1. テーブル錬成 (The Immutable Ledger)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('auth', 'spot')),
    status TEXT NOT NULL CHECK (status IN ('STARTED', 'COMPLETED', 'ABORTED', 'FAILED')),
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 冪等なインデックス生成 (FinOps & Purge Optimization)
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_id 
    ON public.audit_logs (target_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
    ON public.audit_logs (created_at DESC);

-- GIN Index (jsonb_path_ops): metadata内部の payment_intent_id 等を高速検索
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata 
    ON public.audit_logs USING GIN (metadata jsonb_path_ops);

-- B-Tree Composite Index: 3階層ビジネスパージ (pg_cron) の WHERE 句評価順序に完全合致
CREATE INDEX IF NOT EXISTS idx_audit_logs_kind_status_created_at 
    ON public.audit_logs (kind, status, created_at);

-- 3. 自動更新トリガー
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_audit_logs_updated_at') THEN
        CREATE TRIGGER handle_audit_logs_updated_at
            BEFORE UPDATE ON public.audit_logs
            FOR EACH ROW
            EXECUTE FUNCTION public.moddatetime();
    END IF;
END
$$;

-- 4. Zero-Trust RLS (Row Level Security) の絶対封鎖
-- 監査ログは WORM 特性を持ち、クライアントからの読み書きを一切許容しない
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audit_logs' AND policyname = 'Deny all public access to audit_logs') THEN
        CREATE POLICY "Deny all public access to audit_logs" ON public.audit_logs
            FOR ALL USING (false) WITH CHECK (false);
    END IF;
END
$$;