-- ==============================================================================
-- The Immutable Ledger: audit_logs (Migration Version)
-- ==============================================================================

-- 1. テーブルの作成
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('auth', 'spot')),
    status TEXT NOT NULL CHECK (status IN ('STARTED', 'COMPLETED', 'ABORTED', 'FAILED')),
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. インデックスの作成
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_id ON public.audit_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 3. RLS (Row Level Security) の完全封鎖 (Zero-Trust)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all public access to audit_logs" ON public.audit_logs;

CREATE POLICY "Deny all public access to audit_logs"
ON public.audit_logs
FOR ALL
USING (false)
WITH CHECK (false);

-- 4. updated_at 自動更新トリガーの作成
CREATE OR REPLACE FUNCTION update_audit_logs_moddatetime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_audit_logs_moddatetime ON public.audit_logs;

CREATE TRIGGER trigger_update_audit_logs_moddatetime
BEFORE UPDATE ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION update_audit_logs_moddatetime();