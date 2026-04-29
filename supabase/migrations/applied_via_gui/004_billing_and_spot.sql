-- ─────────────────────────────────────────────────────────────────────────────
-- 004_billing_and_spot.sql
-- Sprint 1 / Sprint 2 schema additions for ProofMark.
-- - profiles billing fields
-- - stripe_events idempotency log
-- - spot_orders for guest one-shot Evidence Pack purchases
-- - contact_submissions for /contact form
-- - RLS hardening: service-role only writes; no anon read paths.
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

-- 1. profiles billing additions ------------------------------------------------
alter table if exists public.profiles
  add column if not exists plan_tier text not null default 'free'
    check (plan_tier in ('free', 'light', 'creator', 'studio', 'admin')),
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_current_period_end timestamptz;

create unique index if not exists profiles_stripe_customer_id_key
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- 2. stripe_events: idempotency log -------------------------------------------
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  status text not null default 'received'
    check (status in ('received', 'processed', 'failed')),
  payload jsonb not null,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists stripe_events_received_at_idx
  on public.stripe_events (received_at desc);

create index if not exists stripe_events_status_idx
  on public.stripe_events (status, received_at desc);

alter table public.stripe_events enable row level security;

drop policy if exists stripe_events_no_anon_read on public.stripe_events;
create policy stripe_events_no_anon_read
  on public.stripe_events for select
  using (false); -- service-role bypasses RLS; no anon/authed reads.

-- 3. spot_orders: guest one-shot purchases ------------------------------------
create table if not exists public.spot_orders (
  staging_id uuid primary key,
  stripe_session_id text not null,
  stripe_payment_intent_id text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'expired', 'refunded')),
  sha256 text,
  filename text,
  email text,
  amount_total integer,
  currency text,
  storage_paths text[] not null default '{}',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists spot_orders_stripe_session_idx
  on public.spot_orders (stripe_session_id);

create index if not exists spot_orders_paid_at_idx
  on public.spot_orders (paid_at);

alter table public.spot_orders enable row level security;

drop policy if exists spot_orders_no_anon_read on public.spot_orders;
create policy spot_orders_no_anon_read
  on public.spot_orders for select
  using (false); -- All reads go through service-role API.

-- 4. contact_submissions ------------------------------------------------------
create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  name text not null,
  email text not null,
  company text,
  message text not null,
  ip text,
  user_agent text,
  status text not null default 'new'
    check (status in ('new', 'in_review', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists contact_submissions_created_at_idx
  on public.contact_submissions (created_at desc);

alter table public.contact_submissions enable row level security;

drop policy if exists contact_submissions_no_anon_read on public.contact_submissions;
create policy contact_submissions_no_anon_read
  on public.contact_submissions for select
  using (false);

-- 5. spot-evidence storage bucket --------------------------------------------
-- Run this once (idempotent). Bucket is private; service-role only.
insert into storage.buckets (id, name, public)
values ('spot-evidence', 'spot-evidence', false)
on conflict (id) do nothing;

-- All access to spot-evidence is via service-role; no anon/authed policies.

-- 6. Helper: monthly issuance count for a user (used by api/timestamp.ts) -----
create or replace function public.fn_monthly_issuance_count(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.certificates
  where user_id = uid
    and timestamp_token is not null
    and certified_at >= date_trunc('month', now() at time zone 'utc')
    and certified_at <  (date_trunc('month', now() at time zone 'utc') + interval '1 month');
$$;

revoke all on function public.fn_monthly_issuance_count(uuid) from public;
-- api/timestamp.ts などのバックエンド（Service Role）からのみ実行を許可する
grant execute on function public.fn_monthly_issuance_count(uuid) to service_role;

-- 7. 既存の Light プランユーザーを新しい Creator プランへ自動移行
update public.profiles
set plan_tier = 'creator'
where plan_tier = 'light';
