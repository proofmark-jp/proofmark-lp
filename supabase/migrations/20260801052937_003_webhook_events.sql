-- =============================================================================
-- 👑 THE SOVEREIGN ARCHITECT: sql/schema/003_webhook_events.sql
-- Phase 1.3: Webhook Idempotency Ledger (The Stripe Fortress)
-- 目的: Blueprint §IV.3 に基づき、Stripe Webhookの二重処理・競合を物理的に遮断する
-- =============================================================================

-- 1. テーブル錬成 (The Absolute Source of Truth for Webhooks)
CREATE TABLE IF NOT EXISTS public.webhook_events (
    -- StripeのイベントIDを主キー（UNIQUE）とし、DBレベルで二重処理を物理遮断する
    event_id TEXT PRIMARY KEY,
    provider TEXT NOT NULL DEFAULT 'stripe',
    event_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'failed')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- 2. 冪等なインデックス生成 (FinOps Query Optimization)
CREATE INDEX IF NOT EXISTS idx_webhook_events_status 
    ON public.webhook_events (status, created_at DESC) 
    WHERE status IN ('received', 'failed');

CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at 
    ON public.webhook_events (created_at DESC);

-- 3. Zero-Trust RLS (Row Level Security) の絶対封鎖
-- Webhookログへのアクセスは、外部からの参照・書き込みを一切許容しない (Service Role専用)
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'webhook_events' AND policyname = 'Deny all public access to webhook_events') THEN
        CREATE POLICY "Deny all public access to webhook_events" ON public.webhook_events
            FOR ALL USING (false) WITH CHECK (false);
    END IF;
END
$$;