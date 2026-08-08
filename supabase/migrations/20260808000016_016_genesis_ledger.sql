-- filepath: supabase/migrations/20260808000016_016_genesis_ledger.sql
-- =============================================================================
-- 016_genesis_ledger.sql
-- Phase 1.25 — V10.0 Megacorp Foundation
-- Genesis Ledger: Lifetime Pro GENESIS Chip Auction Registry (REV-3)
--
-- Purpose: Tracks the 80 auctionable GENESIS chips (serials 021–100).
--          Chips 001–020 are founder-reserved and exist outside this ledger.
--          A strict CHECK constraint physically prevents minting outside the
--          021–100 range. Public can read ledger status (transparency);
--          only service_role may write (mint/transfer).
-- RLS:     Public read (anon + authenticated). service_role write.
-- =============================================================================

-- ── Extension ──────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Table ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.genesis_ledger (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- REV-3: Only serials 021–100 (the 80 auctionable chips) are valid.
  -- Chips 001–020 are founder-reserved and MUST NOT appear here.
  serial_number integer     NOT NULL UNIQUE
                            CHECK (serial_number >= 21 AND serial_number <= 100),

  owner_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
                            -- NULL = unclaimed / available at auction

  status        text        NOT NULL DEFAULT 'available'
                            CHECK (status IN ('available', 'reserved', 'minted', 'transferred')),

  -- Auction metadata
  auction_price_jpy integer,          -- winning bid in JPY
  auction_ended_at  timestamptz,      -- when the auction concluded

  minted_at     timestamptz,          -- timestamp of final mint/transfer to owner
  notes         text,                 -- e.g. auction platform reference, special conditions

  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW()
);

-- ── Pre-populate all 80 available chip slots (idempotent) ─────────────────────
INSERT INTO public.genesis_ledger (serial_number, status)
SELECT
  s.serial_number,
  'available'
FROM generate_series(21, 100) AS s(serial_number)
ON CONFLICT (serial_number) DO NOTHING;

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_genesis_serial    ON public.genesis_ledger (serial_number);
CREATE INDEX IF NOT EXISTS idx_genesis_status    ON public.genesis_ledger (status);
CREATE INDEX IF NOT EXISTS idx_genesis_owner_id  ON public.genesis_ledger (owner_id);

-- ── Trigger: auto-update updated_at ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_touch_genesis_ledger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_genesis_ledger ON public.genesis_ledger;
CREATE TRIGGER trg_touch_genesis_ledger
  BEFORE UPDATE ON public.genesis_ledger
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_genesis_ledger();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.genesis_ledger ENABLE ROW LEVEL SECURITY;

-- Public transparency: anyone can read the ledger (provable scarcity)
CREATE POLICY "genesis_ledger_public_read" ON public.genesis_ledger
  FOR SELECT TO anon, authenticated
  USING (true);

-- Write is service_role only (bypasses RLS). Deny all direct writes from clients.
CREATE POLICY "genesis_ledger_deny_client_write" ON public.genesis_ledger
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ── Permissions ───────────────────────────────────────────────────────────────
REVOKE ALL   ON TABLE public.genesis_ledger FROM public, anon, authenticated;
GRANT SELECT ON TABLE public.genesis_ledger TO anon, authenticated;
GRANT ALL    ON TABLE public.genesis_ledger TO service_role;
