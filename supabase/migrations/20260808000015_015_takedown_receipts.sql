-- filepath: supabase/migrations/20260808000015_015_takedown_receipts.sql
-- =============================================================================
-- 015_takedown_receipts.sql
-- Phase 1.24 — V10.0 Megacorp Foundation
-- Takedown Receipts: DMCA Victory Ledger (§X.10 REV-1)
--
-- Purpose: Records DMCA/copyright enforcement actions and their outcomes.
--          merkle_root_anchor cryptographically timestamps each victory
--          by anchoring it to the daily Merkle commitment, making the
--          enforcement record independently verifiable in perpetuity.
-- RLS:     Certificate owners read their own receipts. service_role full.
-- =============================================================================

-- ── Extension ──────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Table ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.takedown_receipts (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id    uuid        NOT NULL REFERENCES public.certificates(id) ON DELETE CASCADE,

  -- Target identification
  platform          text        NOT NULL CHECK (char_length(platform) BETWEEN 1 AND 100),
                                -- e.g. 'instagram', 'twitter', 'adobe_stock', 'shutterstock'
  target_url        text        NOT NULL CHECK (char_length(target_url) BETWEEN 1 AND 2048),

  -- Process tracking
  status            text        NOT NULL DEFAULT 'filed'
                                CHECK (status IN ('filed', 'acknowledged', 'removed', 'rejected', 'escalated')),
  filed_at          timestamptz NOT NULL DEFAULT NOW(),
  resolved_at       timestamptz,

  -- §X.10 REV-1: Cryptographic timestamp anchor.
  -- The Merkle root of the day this receipt was filed, committed to the
  -- public ledger via the Empty Day Rule. Proves the enforcement action
  -- existed at this point in time, independent of FinalSig's servers.
  merkle_root_anchor text,

  -- Evidence and audit
  evidence_urls     jsonb       DEFAULT '[]'::jsonb,  -- screenshots, cached pages
  platform_ticket_id text,                            -- platform's own case reference
  notes             text,

  created_at        timestamptz NOT NULL DEFAULT NOW(),
  updated_at        timestamptz NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_takedown_cert_id   ON public.takedown_receipts (certificate_id);
CREATE INDEX IF NOT EXISTS idx_takedown_status    ON public.takedown_receipts (status);
CREATE INDEX IF NOT EXISTS idx_takedown_platform  ON public.takedown_receipts (platform);
CREATE INDEX IF NOT EXISTS idx_takedown_created   ON public.takedown_receipts (created_at DESC);

-- ── Trigger: auto-update updated_at ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_touch_takedown_receipts()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_takedown_receipts ON public.takedown_receipts;
CREATE TRIGGER trg_touch_takedown_receipts
  BEFORE UPDATE ON public.takedown_receipts
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_takedown_receipts();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.takedown_receipts ENABLE ROW LEVEL SECURITY;

-- Certificate owners can read their own takedown receipts
CREATE POLICY "takedown_receipts_owner_select" ON public.takedown_receipts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.certificates c
      WHERE c.id = certificate_id
        AND c.user_id = auth.uid()
    )
  );

-- ── Permissions ───────────────────────────────────────────────────────────────
REVOKE ALL ON TABLE public.takedown_receipts FROM public, anon;
GRANT SELECT ON TABLE public.takedown_receipts TO authenticated;
GRANT ALL    ON TABLE public.takedown_receipts TO service_role;
