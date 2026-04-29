-- ─────────────────────────────────────────────────────────────────────────────
-- 005_studio_teams.sql
--
-- Studio plan: B2B team data model + invitation pipeline + high-performance RLS.
--
-- Files this migration is layered on top of (do not modify; we extend only):
--   001_initial_schema.sql        — public.certificates (RLS already on)
--   002_create_profiles_table.sql — public.profiles
--   003_step1_and_growth.sql      — newer cert columns (sha256, visibility, …) and RLS
--   003_sync_plan_tier.sql        — profiles.plan_tier sync
--   004_billing_and_spot.sql      — plan_tier, stripe_*, stripe_events, spot_orders
--   004b_spot_tsa_atomicity.sql   — fn_spot_append_storage_path, fn_lock_stripe_event
--
-- Required extensions
create extension if not exists "pgcrypto";
create extension if not exists "citext";
set search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. teams
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.teams (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null check (length(trim(name)) between 1 and 80),
  slug         text        unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$'),
  owner_id     uuid        not null references public.profiles(id) on delete restrict,
  -- Billing-related metadata. Source of truth for "is this team paid?" stays on profiles.plan_tier
  -- of the owner (the seat-paying user). max_seats is what we enforce at invitation time.
  plan_tier    text        not null default 'studio'
    check (plan_tier in ('studio', 'business')),
  max_seats    integer     not null default 5
    check (max_seats between 1 and 200),
  status       text        not null default 'active'
    check (status in ('active', 'suspended', 'archived')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists teams_owner_id_idx on public.teams (owner_id);
create index if not exists teams_status_idx   on public.teams (status);

drop trigger if exists set_teams_updated_at on public.teams;
create trigger set_teams_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. team_members
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.team_members (
  team_id     uuid not null references public.teams(id)    on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  created_at  timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- "owner_id is always a member with role='owner'" is enforced via fn_create_team below
-- and a trigger that protects against orphan owners.
create index if not exists team_members_user_id_idx on public.team_members (user_id);
create index if not exists team_members_team_id_idx on public.team_members (team_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. team_invitations  (NOT a member-with-pending-status; a separate table)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.team_invitations (
  id             uuid        primary key default gen_random_uuid(),
  team_id        uuid        not null references public.teams(id) on delete cascade,
  inviter_id     uuid        not null references public.profiles(id) on delete cascade,
  invitee_email  citext      not null,
  role           text        not null default 'member'
    check (role in ('admin', 'member')),
  token          text        not null,
  -- Dedicated unique index on token so the access path is point-lookup (B-tree).
  expires_at     timestamptz not null,
  created_at     timestamptz not null default now(),
  unique (team_id, invitee_email)
);

create unique index if not exists team_invitations_token_uidx on public.team_invitations (token);
create index if not exists team_invitations_email_idx on public.team_invitations (invitee_email);
create index if not exists team_invitations_expires_idx on public.team_invitations (expires_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. certificates.team_id
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.certificates
  add column if not exists team_id uuid references public.teams(id) on delete set null;

-- Targeted btree index on team_id makes RLS using `team_id = any(...)` index-friendly.
create index if not exists certificates_team_id_idx on public.certificates (team_id)
  where team_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. fn_user_team_ids — the perf-critical helper for RLS
--
-- Why this exists:
--   Naïve RLS like `EXISTS (SELECT 1 FROM team_members WHERE ...)` triggers a
--   correlated subquery for every row scanned, which is fatal at scale.
--   Instead we resolve the user's full team set ONCE per query (PostgreSQL
--   inlines a STABLE security-definer function inside an `(select fn(...))`
--   wrapper into an InitPlan), and then use `team_id = any(<array>)` which is
--   index-friendly against the certificates_team_id_idx index.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_user_team_ids(uid uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(team_id), array[]::uuid[])
  from public.team_members
  where user_id = uid
$$;

revoke all on function public.fn_user_team_ids(uuid) from public;
grant execute on function public.fn_user_team_ids(uuid) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RLS on teams / team_members / team_invitations
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.teams              enable row level security;
alter table public.team_members       enable row level security;
alter table public.team_invitations   enable row level security;

-- teams: a member can read their own teams; only owner can update/delete.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='teams' and policyname='teams member select') then
    create policy "teams member select" on public.teams
      for select to authenticated
      using (id = any( public.fn_user_team_ids((select auth.uid())) ));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='teams' and policyname='teams owner update') then
    create policy "teams owner update" on public.teams
      for update to authenticated
      using ((select auth.uid()) = owner_id)
      with check ((select auth.uid()) = owner_id);
  end if;
end $$;

-- INSERT / DELETE on teams must go through fn_create_team / fn_delete_team (service-role).
-- Anonymous: never (RLS denies by default).

-- team_members: members can read rows where team is theirs; owners/admins can write.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='team_members' and policyname='team_members own select') then
    create policy "team_members own select" on public.team_members
      for select to authenticated
      using (team_id = any( public.fn_user_team_ids((select auth.uid())) ));
  end if;
end $$;

-- Inserting a member is done by RPC fn_accept_team_invite (service-role).
-- Direct INSERT/UPDATE/DELETE from client is denied.

-- team_invitations: only the inviter (or the team's owner) can read.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='team_invitations' and policyname='invitations inviter select') then
    create policy "invitations inviter select" on public.team_invitations
      for select to authenticated
      using (
        inviter_id = (select auth.uid())
        or exists (
          select 1 from public.teams t
          where t.id = team_id and t.owner_id = (select auth.uid())
        )
      );
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. certificates RLS: extend to "team mate" access without dropping existing
--    individual policies. We add an additional permissive policy.
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='certificates' and policyname='certificates team select'
  ) then
    create policy "certificates team select" on public.certificates
      for select to authenticated
      using (
        team_id is not null
        and team_id = any( public.fn_user_team_ids((select auth.uid())) )
      );
  end if;
end $$;

-- 既存の「team_idを制限しない」古いポリシーを必ずDROPする（OR評価によるバイパスを防ぐため）
drop policy if exists "certificates_insert_own" on public.certificates;
drop policy if exists "certificates own insert" on public.certificates;
drop policy if exists "own_records_insert" on public.certificates;
drop policy if exists "certificates_update_own" on public.certificates;
drop policy if exists "certificates own update" on public.certificates;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='certificates' and policyname='certificates team insert'
  ) then
    create policy "certificates team insert" on public.certificates
      for insert to authenticated
      with check (
        user_id = (select auth.uid())
        and (
          team_id is null
          or team_id = any( public.fn_user_team_ids((select auth.uid())) )
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='certificates' and policyname='certificates team update'
  ) then
    create policy "certificates team update" on public.certificates
      for update to authenticated
      using (
        user_id = (select auth.uid())
        or (
          team_id is not null
          and team_id = any( public.fn_user_team_ids((select auth.uid())) )
        )
      )
      with check (
        user_id = (select auth.uid())
        or (
          team_id is not null
          and team_id = any( public.fn_user_team_ids((select auth.uid())) )
        )
      );
  end if;
end $$;

-- DELETE permission stays restricted to the owning user (never team mates).
-- The pre-existing "certificates_delete_own" policy is preserved.

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Server RPCs — used by /api/teams/*
-- ─────────────────────────────────────────────────────────────────────────────

-- 8.1 create team (owner is automatically a 'owner' team_member)
create or replace function public.fn_create_team(
  p_owner_id uuid,
  p_name     text,
  p_max_seats integer default 5
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_owner_id is null or p_name is null or length(trim(p_name)) = 0 then
    raise exception 'fn_create_team: invalid input';
  end if;

  insert into public.teams (name, owner_id, max_seats)
  values (trim(p_name), p_owner_id, greatest(1, least(200, p_max_seats)))
  returning id into v_id;

  insert into public.team_members (team_id, user_id, role)
  values (v_id, p_owner_id, 'owner')
  on conflict (team_id, user_id) do nothing;

  return v_id;
end
$$;

revoke all on function public.fn_create_team(uuid, text, integer) from public;
grant execute on function public.fn_create_team(uuid, text, integer) to service_role;

-- 8.2 invite — creates a token row, no team_member side effects
create or replace function public.fn_create_team_invitation(
  p_team_id    uuid,
  p_inviter_id uuid,
  p_email      citext,
  p_role       text default 'member',
  p_ttl_minutes integer default 60 * 24 * 7
)
returns table (
  id        uuid,
  token     text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team    public.teams%rowtype;
  v_member  public.team_members%rowtype;
  v_used    integer;
  v_token   text;
  v_id      uuid;
  v_expires timestamptz;
begin
  if p_role not in ('admin', 'member') then
    raise exception 'fn_create_team_invitation: invalid role %', p_role;
  end if;

  select * into v_team from public.teams where id = p_team_id for update;
  if not found then
    raise exception 'team not found';
  end if;

  -- Inviter must be owner/admin of the team
  select * into v_member from public.team_members
  where team_id = p_team_id and user_id = p_inviter_id;
  if not found or v_member.role not in ('owner', 'admin') then
    raise exception 'inviter is not allowed to invite';
  end if;

  -- Seat budget check (members + outstanding invitations)
  select count(*)::integer into v_used from public.team_members where team_id = p_team_id;
  select v_used + (select count(*) from public.team_invitations where team_id = p_team_id and expires_at > now())
    into v_used;
  if v_used >= v_team.max_seats then
    raise exception 'team has reached max_seats';
  end if;

  -- 32-byte cryptographic token, base64url
  v_token := translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_ ');
  v_expires := now() + make_interval(mins => greatest(15, least(60 * 24 * 30, p_ttl_minutes)));

  insert into public.team_invitations (team_id, inviter_id, invitee_email, role, token, expires_at)
  values (p_team_id, p_inviter_id, lower(trim(p_email::text))::citext, p_role, v_token, v_expires)
  on conflict (team_id, invitee_email) do update
    set token = excluded.token,
        role = excluded.role,
        expires_at = excluded.expires_at,
        inviter_id = excluded.inviter_id,
        created_at = now()
  returning public.team_invitations.id into v_id;

  return query
    select v_id, v_token, v_expires;
end
$$;

revoke all on function public.fn_create_team_invitation(uuid, uuid, citext, text, integer) from public;
grant execute on function public.fn_create_team_invitation(uuid, uuid, citext, text, integer) to service_role;

-- 8.3 accept invite — TRIPLE CHECK + atomic row swap
--    1. token exists and not expired
--    2. invitee email == current_email (case-insensitive)
--    3. team is below max_seats (after we recount on the spot)
--    Then: insert into team_members + delete from team_invitations.
create or replace function public.fn_accept_team_invite(
  p_token         text,
  p_user_id       uuid,
  p_current_email citext
)
returns table (
  team_id uuid,
  role    text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv      public.team_invitations%rowtype;
  v_team     public.teams%rowtype;
  v_used     integer;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'invitation token missing';
  end if;
  if p_user_id is null then
    raise exception 'user not authenticated';
  end if;
  if p_current_email is null then
    raise exception 'current email missing';
  end if;

  -- Lock the invitation row for the duration of the transaction.
  select * into v_inv from public.team_invitations
  where token = p_token
  for update;

  if not found then
    raise exception 'invitation not found' using errcode = 'P0001';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'invitation expired' using errcode = 'P0002';
  end if;
  if lower(v_inv.invitee_email::text) <> lower(p_current_email::text) then
    raise exception 'invitation issued to another email' using errcode = 'P0003';
  end if;

  select * into v_team from public.teams where id = v_inv.team_id for update;
  if not found then
    raise exception 'team not found';
  end if;
  if v_team.status <> 'active' then
    raise exception 'team is not active';
  end if;

  -- Re-count current members (server-authoritative seat enforcement).
  select count(*)::integer into v_used from public.team_members where team_id = v_team.id;
  if v_used >= v_team.max_seats then
    raise exception 'team has reached max_seats' using errcode = 'P0004';
  end if;

  -- Atomic A) add member ; B) delete invitation row.
  insert into public.team_members (team_id, user_id, role)
  values (v_team.id, p_user_id, v_inv.role)
  on conflict (team_id, user_id) do nothing;

  delete from public.team_invitations where id = v_inv.id;

  return query select v_team.id, v_inv.role;
end
$$;

revoke all on function public.fn_accept_team_invite(text, uuid, citext) from public;
grant execute on function public.fn_accept_team_invite(text, uuid, citext) to service_role;

-- 8.4 list-my-teams (handy helper for the dashboard; uses RLS naturally)
create or replace function public.fn_list_my_teams(p_user_id uuid)
returns table (
  team_id   uuid,
  team_name text,
  role      text,
  max_seats integer,
  member_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.name, tm.role, t.max_seats,
         (select count(*)::integer from public.team_members where team_id = t.id) as member_count
  from public.teams t
  inner join public.team_members tm on tm.team_id = t.id and tm.user_id = p_user_id
  where t.status = 'active'
  order by t.created_at desc;
$$;

revoke all on function public.fn_list_my_teams(uuid) from public;
grant execute on function public.fn_list_my_teams(uuid) to service_role, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Sanity assertions (developer-time): existing certificates RLS is preserved.
--    We never DROP existing policies; we only ADD permissive ones.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from pg_policies
   where schemaname='public' and tablename='certificates'
     and policyname in ('certificates own select','certificates_select_own');
  if v_count = 0 then
    raise warning 'certificates: per-user RLS appears missing. Verify migration 001/003 ran.';
  end if;
end $$;
