-- filepath: supabase/migrations/20260808000013_013_traction_gate_state.sql
-- =============================================================================
-- 013_traction_gate_state.sql
-- Phase 1.22 — V10.0 Megacorp Foundation
-- Traction Gate: B2C → Phase 5.5 (B2B Unlock) State Machine
--
-- Purpose: Tracks threshold metrics gating Phase 5.5 B2B activation.
--          K-factor, Sentry error rate, and zero-touch period are monitored
--          here. service_role only. Invisible to all end-users.
-- RLS:     TOTAL LOCKDOWN — service_role exclusively.
-- =============================================================================

-- ── Extension ──────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Table ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.traction_gate_state (
  metric_id     text        PRIMARY KEY,           -- e.g. 'k_factor', 'sentry_error_rate', 'zero_touch_days'
  status        text        NOT NULL DEFAULT 'locked'
                            CHECK (status IN ('locked', 'unlocked')),
  current_value numeric     NOT NULL DEFAULT 0,
  threshold     numeric     NOT NULL,              -- target value that unlocks this metric
  notes         text,                              -- human-readable description of this gate metric
  updated_at    timestamptz NOT NULL DEFAULT NOW()
);

-- ── Seed canonical gate metrics (idempotent) ──────────────────────────────────
INSERT INTO public.traction_gate_state (metric_id, status, current_value, threshold, notes)
VALUES
  ('k_factor',           'locked', 0, 1.1,   'Viral coefficient must exceed 1.1 for 4 consecutive weeks'),
  ('sentry_error_rate',  'locked', 0, 0.5,   'P1 error rate (%) must remain below 0.5% for 30 days'),
  ('zero_touch_days',    'locked', 0, 14,    'Zero founder-intervention days in a rolling 30-day window')
ON CONFLICT (metric_id) DO NOTHING;

-- ── Trigger: auto-update updated_at ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_touch_traction_gate()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_traction_gate ON public.traction_gate_state;
CREATE TRIGGER trg_touch_traction_gate
  BEFORE UPDATE ON public.traction_gate_state
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_traction_gate();

-- ── RLS: Total lockdown ────────────────────────────────────────────────────────
ALTER TABLE public.traction_gate_state ENABLE ROW LEVEL SECURITY;

-- Deny all access except service_role (service_role bypasses RLS entirely)
CREATE POLICY "traction_gate_deny_all" ON public.traction_gate_state
  AS RESTRICTIVE
  FOR ALL
  TO public, anon, authenticated
  USING (false);

-- ── Permissions ───────────────────────────────────────────────────────────────
REVOKE ALL ON TABLE public.traction_gate_state FROM public, anon, authenticated;
GRANT ALL   ON TABLE public.traction_gate_state TO service_role;
