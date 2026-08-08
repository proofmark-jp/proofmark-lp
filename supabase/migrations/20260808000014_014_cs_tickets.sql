-- filepath: supabase/migrations/20260808000014_014_cs_tickets.sql
-- =============================================================================
-- 014_cs_tickets.sql
-- Phase 1.23 — V10.0 Megacorp Foundation
-- CS Tickets: Customer Support Ticket Ledger
--
-- Purpose: Records support tickets and AI first-response actions.
--          correction_vector JSONB (PATCH-A6 / Directive 78) prevents the
--          Zone 2 CS agent from amnesia-looping on known failure patterns.
--          Every rejection appends a correction entry; no fresh-context
--          regeneration allowed without reading the vector first.
-- RLS:     Users read/insert own rows. service_role full access.
-- =============================================================================

-- ── Extension ──────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Table ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cs_tickets (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic             text        NOT NULL CHECK (char_length(topic) BETWEEN 1 AND 500),
  status            text        NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open', 'pending_ai', 'pending_human', 'resolved', 'closed')),

  -- Directive 78 (PATCH-A6): Correction Vector — append-only JSONB array.
  -- Structure: [{ "ts": "<iso>", "role": "ai|human", "correction": "<text>", "trigger": "<what caused correction>" }]
  -- Zone 2 CS Agent MUST read this before generating any response.
  -- Never truncate or reset; only append via jsonb_insert or array concatenation.
  correction_vector jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- Response tracking
  ai_response       text,
  human_response    text,
  resolved_by       text        CHECK (resolved_by IN ('ai', 'human', NULL)),

  created_at        timestamptz NOT NULL DEFAULT NOW(),
  updated_at        timestamptz NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cs_tickets_user_id   ON public.cs_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_cs_tickets_status    ON public.cs_tickets (status);
CREATE INDEX IF NOT EXISTS idx_cs_tickets_created   ON public.cs_tickets (created_at DESC);

-- Guard: correction_vector must always be a JSON array (Directive 78)
ALTER TABLE public.cs_tickets
  DROP CONSTRAINT IF EXISTS chk_correction_vector_is_array,
  ADD  CONSTRAINT chk_correction_vector_is_array
    CHECK (jsonb_typeof(correction_vector) = 'array');

-- ── Trigger: auto-update updated_at ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_touch_cs_tickets()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_cs_tickets ON public.cs_tickets;
CREATE TRIGGER trg_touch_cs_tickets
  BEFORE UPDATE ON public.cs_tickets
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_cs_tickets();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.cs_tickets ENABLE ROW LEVEL SECURITY;

-- Users: read their own tickets
CREATE POLICY "cs_tickets_user_select" ON public.cs_tickets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users: insert their own tickets
CREATE POLICY "cs_tickets_user_insert" ON public.cs_tickets
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ── Permissions ───────────────────────────────────────────────────────────────
REVOKE ALL ON TABLE public.cs_tickets FROM public, anon;
GRANT SELECT, INSERT ON TABLE public.cs_tickets TO authenticated;
GRANT ALL             ON TABLE public.cs_tickets TO service_role;
