-- filepath: supabase/migrations/20260808000017_017_intent_pulse.sql
-- =============================================================================
-- 017_intent_pulse.sql
-- Phase 1.26 — V10.0 Megacorp Foundation
-- Intent Pulse: Public Demand Signal System (REV-2 / Directive 82)
--
-- Purpose: Captures demand signals (social listening, keyword trends) for
--          the public Pulse dashboard at /pulse. Zero PII by design.
--          Directive 82: raw table categorically rejects IP addresses,
--          usernames, and exact URLs. aggregate_intent_pulse() returns
--          pure counts safe for ISR (Incremental Static Regeneration).
--
-- Architecture:
--   Zone 2 Social Sniping Agent → writes to intent_pulse_raw (service_role)
--   Vercel ISR (/api/pulse) → calls aggregate_intent_pulse() (anon RPC)
--   /pulse page → reads aggregates only. Never raw rows.
-- RLS:     service_role write. anon/authenticated read via RPC only.
-- =============================================================================

-- ── Extension ──────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Raw ingestion table ───────────────────────────────────────────────────────
-- Directive 82: This table MUST NOT store:
--   - IP addresses (use hashed fingerprints only, never raw)
--   - Usernames or handles
--   - Exact post URLs (store domain/platform only)
--   - Any field that could re-identify a natural person
CREATE TABLE IF NOT EXISTS public.intent_pulse_raw (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  platform      text        NOT NULL CHECK (char_length(platform) BETWEEN 1 AND 100),
                            -- e.g. 'twitter', 'instagram', 'reddit', 'google_trends'
  keyword       text        NOT NULL CHECK (char_length(keyword) BETWEEN 1 AND 200),
                            -- demand signal keyword (no person names, no @handles)
  intent_score  integer     NOT NULL CHECK (intent_score BETWEEN 0 AND 100),
                            -- 0 = weak signal, 100 = strong purchase intent
  region        text        CHECK (char_length(region) <= 10),
                            -- ISO 3166-1 alpha-2 country code or NULL (no city/postal)

  -- Directive 82: Explicitly forbidden columns are NOT present.
  -- DO NOT add: ip_address, user_agent, username, handle, post_url, email.

  detected_at   timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.intent_pulse_raw IS
  'Directive 82 (REV-2): Zero-PII demand signal table. '
  'Forbidden fields: ip_address, username, handle, post_url, email. '
  'Aggregation ONLY via aggregate_intent_pulse() RPC. Never query raw rows from frontend.';

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_intent_platform    ON public.intent_pulse_raw (platform);
CREATE INDEX IF NOT EXISTS idx_intent_keyword     ON public.intent_pulse_raw (keyword);
CREATE INDEX IF NOT EXISTS idx_intent_detected    ON public.intent_pulse_raw (detected_at DESC);
-- Composite for aggregation query performance
CREATE INDEX IF NOT EXISTS idx_intent_agg_cover   ON public.intent_pulse_raw (platform, keyword, detected_at);

-- ── Aggregation function (REV-2) ──────────────────────────────────────────────
-- Returns pure aggregate counts safe for ISR consumption.
-- No raw rows, no PII, no individual records exposed.
CREATE OR REPLACE FUNCTION public.aggregate_intent_pulse(
  p_days   integer DEFAULT 7     -- rolling window in days (default: last 7 days)
)
RETURNS TABLE (
  platform      text,
  keyword       text,
  signal_day    date,
  total_signals bigint,
  avg_score     numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    platform,
    keyword,
    DATE(detected_at AT TIME ZONE 'UTC') AS signal_day,
    COUNT(*)                              AS total_signals,
    ROUND(AVG(intent_score)::numeric, 1) AS avg_score
  FROM public.intent_pulse_raw
  WHERE detected_at >= NOW() - (p_days || ' days')::interval
  GROUP BY platform, keyword, DATE(detected_at AT TIME ZONE 'UTC')
  ORDER BY signal_day DESC, total_signals DESC;
$$;

REVOKE ALL     ON FUNCTION public.aggregate_intent_pulse(integer) FROM public, anon, authenticated;
GRANT EXECUTE  ON FUNCTION public.aggregate_intent_pulse(integer) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.aggregate_intent_pulse IS
  'REV-2 / Directive 82: Returns aggregate demand signal counts only. '
  'Zero PII. Safe for ISR at /api/pulse. Never exposes raw intent_pulse_raw rows.';

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.intent_pulse_raw ENABLE ROW LEVEL SECURITY;

-- Raw table is write-only for service_role. No direct reads from clients.
-- Frontend MUST use the aggregate_intent_pulse() RPC exclusively.
CREATE POLICY "intent_pulse_raw_deny_direct_read" ON public.intent_pulse_raw
  AS RESTRICTIVE
  FOR SELECT
  TO anon, authenticated
  USING (false);

CREATE POLICY "intent_pulse_raw_deny_client_write" ON public.intent_pulse_raw
  AS RESTRICTIVE
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

-- ── Permissions ───────────────────────────────────────────────────────────────
REVOKE ALL ON TABLE public.intent_pulse_raw FROM public, anon, authenticated;
GRANT ALL  ON TABLE public.intent_pulse_raw TO service_role;
