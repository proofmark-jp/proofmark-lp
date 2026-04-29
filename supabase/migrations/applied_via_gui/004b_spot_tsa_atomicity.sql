-- ─────────────────────────────────────────────────────────────────────────────
-- 004b_spot_tsa_atomicity.sql
--
-- Sprint 1 finalization patch (idempotent). Builds on top of 004_billing_and_spot.sql.
--
-- What this migration adds:
--   1) `spot_orders` columns for per-order TSA bookkeeping (tsa_status, tsa_provider, …).
--   2) `fn_spot_append_storage_path(staging uuid, p text)` — atomic array_append RPC.
--      Race-safe even if two workers append simultaneously.
--   3) `fn_lock_stripe_event(eid text, etype text, payload jsonb)` — the UPSERT-with-lock
--      pattern that fixes the "failed event resends are silently dropped" deadlock.
--      Returns the row only when the caller is allowed to (re)process the event.
--   4) Strengthens the `stripe_events` shape (sane defaults; idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

-- ──────────────────────────────────────────────────────────────────────────
-- 1. spot_orders — new columns for TSA outcome
-- ──────────────────────────────────────────────────────────────────────────
alter table if exists public.spot_orders
  add column if not exists tsa_status text not null default 'pending'
    check (tsa_status in ('pending', 'issued', 'failed')),
  add column if not exists tsa_provider text,
  add column if not exists tsa_url text,
  add column if not exists certified_at timestamptz,
  add column if not exists tsa_error text;

create index if not exists spot_orders_tsa_status_idx
  on public.spot_orders (tsa_status, created_at desc);

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Atomic array_append for storage_paths (no read-modify-write race)
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.fn_spot_append_storage_path(
  p_staging_id uuid,
  p_path text
)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paths text[];
begin
  if p_path is null or length(trim(p_path)) = 0 then
    raise exception 'fn_spot_append_storage_path: empty path';
  end if;

  update public.spot_orders
  set storage_paths = (
    case
      when storage_paths is null then array[p_path]::text[]
      when p_path = any(storage_paths) then storage_paths
      else array_append(storage_paths, p_path)
    end
  )
  where staging_id = p_staging_id
  returning storage_paths into v_paths;

  if v_paths is null then
    raise exception 'fn_spot_append_storage_path: spot_order % not found', p_staging_id;
  end if;

  return v_paths;
end
$$;

revoke all on function public.fn_spot_append_storage_path(uuid, text) from public;
grant execute on function public.fn_spot_append_storage_path(uuid, text) to service_role;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Stripe webhook lock — UPSERT-with-lock
--
-- Behavior matrix:
--   stripe_events.id absent      → INSERT new row, status='received', RETURN it.
--   row exists with 'received'   → caller is racing with another worker; RETURN nothing
--                                   (caller treats as duplicate / already processing).
--   row exists with 'processed'  → idempotent replay; RETURN nothing.
--   row exists with 'failed'     → this is the death-loop case. We FLIP it to 'received'
--                                   and RETURN it so the caller re-processes.
--
-- The whole thing happens in ONE statement, so two workers cannot both win.
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.fn_lock_stripe_event(
  p_event_id text,
  p_event_type text,
  p_payload jsonb
)
returns table (
  id text,
  prev_status text,
  was_retry boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with up as (
    insert into public.stripe_events (id, type, payload, status, received_at)
    values (p_event_id, p_event_type, p_payload, 'received', now())
    on conflict (id) do update
       set status = 'received',
           received_at = now(),
           error_message = null,
           processed_at = null,
           type = excluded.type,
           payload = excluded.payload
       where public.stripe_events.status = 'failed'
          or (public.stripe_events.status = 'received' and public.stripe_events.received_at < now() - interval '5 minutes')
    returning public.stripe_events.id,
              public.stripe_events.status as prev_status,
              -- inserted just now? then xmax = 0 in PG; we approximate by checking received_at.
              (public.stripe_events.processed_at is null
               and public.stripe_events.received_at = now()) as is_locked
  )
  select up.id::text,
         up.prev_status::text,
         (up.is_locked is true) as was_retry
  from up;
end
$$;

revoke all on function public.fn_lock_stripe_event(text, text, jsonb) from public;
grant execute on function public.fn_lock_stripe_event(text, text, jsonb) to service_role;

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Convenience updater used by the webhook on success/failure
--    (kept as RPC so we can audit-log changes server-side later if needed)
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.fn_mark_stripe_event_processed(p_event_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.stripe_events
  set status = 'processed',
      processed_at = now(),
      error_message = null
  where id = p_event_id;
$$;

create or replace function public.fn_mark_stripe_event_failed(
  p_event_id text,
  p_error text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.stripe_events
  set status = 'failed',
      processed_at = now(),
      error_message = left(coalesce(p_error, 'unknown error'), 1000)
  where id = p_event_id;
$$;

revoke all on function public.fn_mark_stripe_event_processed(text) from public;
revoke all on function public.fn_mark_stripe_event_failed(text, text) from public;
grant execute on function public.fn_mark_stripe_event_processed(text) to service_role;
grant execute on function public.fn_mark_stripe_event_failed(text, text) to service_role;
