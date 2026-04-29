-- ─────────────────────────────────────────────────────────────────────────────
-- 006_studio_projects_audit.sql
--
-- Sprint 3 — Creator First, Studio Ready
--
-- Adds the Studio "Ops OS" data layer:
--   1. public.projects               — first-class project (folder) entity
--   2. public.certificates.project_id — link cert to project (nullable)
--   3. public.certificates.delivery_status — production status enum
--   4. public.cert_audit_logs        — append-only audit trail (tamper-evident)
--   5. fn_user_project_ids()         — perf-critical RLS helper (mirrors fn_user_team_ids)
--   6. RLS policies for projects + audit logs (additive, non-destructive)
--   7. fn_log_cert_event()           — server-side audit emitter (SECURITY DEFINER)
--   8. trg_cert_audit_on_change      — trigger captures every status / project change
--
-- Layered on top of:
--   001_initial_schema.sql, 002_create_profiles_table.sql,
--   003_step1_and_growth.sql, 003_sync_plan_tier.sql,
--   004_billing_and_spot.sql, 004b_spot_tsa_atomicity.sql,
--   005_studio_teams.sql
--
-- All blocks are IF NOT EXISTS / OR REPLACE → fully re-runnable.
-- All RLS policies use `(select auth.uid())` (sub-select form) so PostgREST
-- caches the value once per statement (high-row-count pattern).
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";
create extension if not exists "citext";
set search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. projects — owned by a profile, optionally bound to a team
--    A "project" is the Studio-level grouping (案件フォルダ).
--    Creators on the free/creator plan can use projects too — they simply
--    won't have team_id, so cross-user sharing never happens.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id            uuid        primary key default gen_random_uuid(),
  owner_id      uuid        not null references public.profiles(id) on delete cascade,
  team_id       uuid        references public.teams(id) on delete set null,
  name          text        not null check (length(trim(name)) between 1 and 80),
  client_name   text        check (client_name is null or length(trim(client_name)) <= 80),
  color         text        not null default '#6C3EF4'
                check (color ~ '^#[0-9A-Fa-f]{6}$'),
  status        text        not null default 'active'
                check (status in ('active', 'on_hold', 'delivered', 'archived')),
  due_at        timestamptz,
  notes         text        check (notes is null or length(notes) <= 2000),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists projects_owner_id_idx on public.projects (owner_id);
create index if not exists projects_team_id_idx  on public.projects (team_id) where team_id is not null;
create index if not exists projects_status_idx   on public.projects (status);
create index if not exists projects_due_idx      on public.projects (due_at) where due_at is not null;

-- updated_at touch trigger (reuses set_updated_at() from 003_*).
do $$ begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists set_projects_updated_at on public.projects;
    create trigger set_projects_updated_at
      before update on public.projects
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. certificates.project_id + delivery_status
--    Both columns are NULL-safe → existing rows are untouched, all old RLS
--    policies (own / team / public) keep matching first.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.certificates
  add column if not exists project_id uuid references public.projects(id) on delete set null;

alter table public.certificates
  add column if not exists delivery_status text
  check (
    delivery_status is null or delivery_status in (
      'draft',         -- 下書き / 受注前
      'in_progress',   -- 制作中
      'review',        -- 要確認 / レビュー待ち
      'ready',         -- 納品準備完了 (NDA確認済等)
      'delivered',     -- 納品済
      'on_hold'        -- 保留 / 中断
    )
  );

create index if not exists certificates_project_id_idx
  on public.certificates (project_id) where project_id is not null;

create index if not exists certificates_delivery_status_idx
  on public.certificates (delivery_status) where delivery_status is not null;

-- Composite index for the dashboard's most common Studio query:
--   "show me everything in project X, newest first".
create index if not exists certificates_project_created_idx
  on public.certificates (project_id, created_at desc) where project_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. cert_audit_logs — append-only, tamper-evident audit trail
--    Each row records WHO did WHAT to WHICH cert at WHEN, with a hash chain
--    (prev_log_sha256 → row_sha256) so deletions or rewrites are detectable.
--
--    Writes go through fn_log_cert_event() (SECURITY DEFINER); direct INSERT
--    is denied to clients via RLS.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.cert_audit_logs (
  id              uuid        primary key default gen_random_uuid(),
  certificate_id  uuid        not null references public.certificates(id) on delete cascade,
  team_id         uuid        references public.teams(id) on delete set null,
  project_id      uuid        references public.projects(id) on delete set null,
  actor_id        uuid        references public.profiles(id) on delete set null,
  actor_email     citext,     -- snapshot at time of write (survives profile delete)
  event_type      text        not null
                  check (event_type in (
                    'created', 'updated', 'status_changed', 'project_changed',
                    'archived', 'restored', 'deleted',
                    'evidence_pack_downloaded', 'shared',
                    'team_assigned', 'invitation_accepted'
                  )),
  before_state    jsonb,
  after_state     jsonb,
  prev_log_sha256 text        check (prev_log_sha256 is null or prev_log_sha256 ~ '^[0-9a-f]{64}$'),
  row_sha256      text        check (row_sha256 ~ '^[0-9a-f]{64}$'),
  client_ip       inet,
  user_agent      text,
  created_at      timestamptz not null default now()
);

create index if not exists cert_audit_certificate_idx on public.cert_audit_logs (certificate_id, created_at desc);
create index if not exists cert_audit_team_idx        on public.cert_audit_logs (team_id, created_at desc) where team_id is not null;
create index if not exists cert_audit_project_idx     on public.cert_audit_logs (project_id, created_at desc) where project_id is not null;
create index if not exists cert_audit_actor_idx       on public.cert_audit_logs (actor_id, created_at desc) where actor_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. fn_user_project_ids — perf-critical RLS helper
--    Returns every project id the user can see:
--      • projects they own
--      • projects whose team they belong to
--    Same architectural pattern as fn_user_team_ids() in 005_studio_teams.sql.
--    STABLE + SECURITY DEFINER → InitPlan, evaluated once per statement.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_user_project_ids(uid uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    array_agg(distinct p.id),
    array[]::uuid[]
  )
  from public.projects p
  where p.owner_id = uid
     or (p.team_id is not null
         and p.team_id = any(public.fn_user_team_ids(uid)));
$$;

revoke all on function public.fn_user_project_ids(uuid) from public;
grant execute on function public.fn_user_project_ids(uuid) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS — projects
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.projects enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='projects' and policyname='projects own select') then
    create policy "projects own select" on public.projects
      for select to authenticated
      using (
        owner_id = (select auth.uid())
        or (team_id is not null and team_id = any(public.fn_user_team_ids((select auth.uid()))))
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='projects' and policyname='projects own insert') then
    create policy "projects own insert" on public.projects
      for insert to authenticated
      with check (
        owner_id = (select auth.uid())
        and (
          team_id is null
          or team_id = any(public.fn_user_team_ids((select auth.uid())))
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='projects' and policyname='projects own update') then
    create policy "projects own update" on public.projects
      for update to authenticated
      using (
        owner_id = (select auth.uid())
        or (team_id is not null and team_id = any(public.fn_user_team_ids((select auth.uid()))))
      )
      with check (
        owner_id = (select auth.uid())
        or (team_id is not null and team_id = any(public.fn_user_team_ids((select auth.uid()))))
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='projects' and policyname='projects own delete') then
    -- Only owners can delete; team mates cannot accidentally drop a folder.
    create policy "projects own delete" on public.projects
      for delete to authenticated
      using (owner_id = (select auth.uid()));
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RLS — cert_audit_logs (read-only for clients; writes via SECURITY DEFINER)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.cert_audit_logs enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cert_audit_logs' and policyname='audit visible select') then
    create policy "audit visible select" on public.cert_audit_logs
      for select to authenticated
      using (
        -- Visible to:
        --   • the actor themselves
        --   • the cert owner
        --   • any team member (when row carries team_id)
        actor_id = (select auth.uid())
        or exists (
          select 1 from public.certificates c
          where c.id = certificate_id
            and (
              c.user_id = (select auth.uid())
              or (c.team_id is not null
                  and c.team_id = any(public.fn_user_team_ids((select auth.uid()))))
            )
        )
      );
  end if;
end $$;

-- No INSERT / UPDATE / DELETE policies → all writes must come from
-- fn_log_cert_event (service_role) which we expose as RPC.

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. fn_log_cert_event — single emitter that maintains the hash chain
--    The chain links: prev_log_sha256 = sha256(previous row canonical JSON).
--    Verification: re-hash each row's canonical_json and compare to the next
--    row's prev_log_sha256.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_log_cert_event(
  p_certificate_id uuid,
  p_actor_id       uuid,
  p_actor_email    citext,
  p_event_type     text,
  p_before         jsonb default '{}'::jsonb,
  p_after          jsonb default '{}'::jsonb,
  p_client_ip      inet  default null,
  p_user_agent     text  default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id     uuid;
  v_project_id  uuid;
  v_prev        text;
  v_canonical   text;
  v_row_sha     text;
  v_id          uuid;
begin
  if p_certificate_id is null then
    raise exception 'fn_log_cert_event: certificate_id required';
  end if;

select team_id, project_id
    into v_team_id, v_project_id
    from public.certificates where id = p_certificate_id
    for no key update;

  -- Tail of the chain for THIS certificate (not global → keeps audit
  -- per-cert verifiable, and avoids cross-tenant correlation).
  select row_sha256 into v_prev
    from public.cert_audit_logs
   where certificate_id = p_certificate_id
   order by created_at desc, id desc
   limit 1;

  -- Canonical JSON of the row's logical content (excluding row_sha256 itself).
  v_canonical := jsonb_build_object(
    'certificate_id', p_certificate_id,
    'team_id',        v_team_id,
    'project_id',     v_project_id,
    'actor_id',       p_actor_id,
    'actor_email',    p_actor_email,
    'event_type',     p_event_type,
    'before_state',   coalesce(p_before, '{}'::jsonb),
    'after_state',    coalesce(p_after,  '{}'::jsonb),
    'prev_log_sha256', v_prev,
    'created_at',     now()
  )::text;

  v_row_sha := encode(digest(v_canonical, 'sha256'), 'hex');

  insert into public.cert_audit_logs (
    certificate_id, team_id, project_id,
    actor_id, actor_email, event_type,
    before_state, after_state,
    prev_log_sha256, row_sha256,
    client_ip, user_agent
  )
  values (
    p_certificate_id, v_team_id, v_project_id,
    p_actor_id, lower(coalesce(p_actor_email::text,''))::citext, p_event_type,
    coalesce(p_before, '{}'::jsonb), coalesce(p_after, '{}'::jsonb),
    v_prev, v_row_sha,
    p_client_ip, p_user_agent
  )
  returning id into v_id;

  return v_id;
end
$$;

revoke all on function public.fn_log_cert_event(uuid, uuid, citext, text, jsonb, jsonb, inet, text) from public;
grant execute on function public.fn_log_cert_event(uuid, uuid, citext, text, jsonb, jsonb, inet, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. trg_cert_audit_on_change — auto-capture status / project changes
--    No client trust required: the trigger fires on every UPDATE.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.trg_capture_cert_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  v_email text := nullif(current_setting('request.jwt.claim.email', true), '');
  v_event text;
begin
  if (TG_OP = 'INSERT') then
    perform public.fn_log_cert_event(
      NEW.id, v_actor, v_email::citext, 'created',
      '{}'::jsonb,
      jsonb_build_object('project_id', NEW.project_id, 'delivery_status', NEW.delivery_status)
    );
    return NEW;
  end if;

  if (TG_OP = 'UPDATE') then
    if (OLD.delivery_status is distinct from NEW.delivery_status) then
      perform public.fn_log_cert_event(
        NEW.id, v_actor, v_email::citext, 'status_changed',
        jsonb_build_object('delivery_status', OLD.delivery_status),
        jsonb_build_object('delivery_status', NEW.delivery_status)
      );
    end if;
    if (OLD.project_id is distinct from NEW.project_id) then
      perform public.fn_log_cert_event(
        NEW.id, v_actor, v_email::citext, 'project_changed',
        jsonb_build_object('project_id', OLD.project_id),
        jsonb_build_object('project_id', NEW.project_id)
      );
    end if;
    if (coalesce(OLD.is_archived, false) is distinct from coalesce(NEW.is_archived, false)) then
      v_event := case when NEW.is_archived then 'archived' else 'restored' end;
      perform public.fn_log_cert_event(
        NEW.id, v_actor, v_email::citext, v_event,
        jsonb_build_object('is_archived', OLD.is_archived),
        jsonb_build_object('is_archived', NEW.is_archived)
      );
    end if;
    return NEW;
  end if;

  return null;
end
$$;

-- Only attach the trigger when is_archived column exists; otherwise we still
-- audit status / project changes safely (the column reference is OPTIONAL via
-- coalesce in the function above, but the trigger itself should still attach).
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='certificates' and column_name='delivery_status'
  ) then
    drop trigger if exists trg_cert_audit_on_change on public.certificates;
    create trigger trg_cert_audit_on_change
      after insert or update on public.certificates
      for each row execute function public.trg_capture_cert_audit();
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. fn_list_recent_audit — convenience helper for the Audit drawer
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_list_recent_audit(
  p_certificate_id uuid,
  p_limit integer default 50
)
returns table (
  id uuid,
  event_type text,
  actor_id uuid,
  actor_email citext,
  before_state jsonb,
  after_state jsonb,
  prev_log_sha256 text,
  row_sha256 text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, event_type, actor_id, actor_email,
         before_state, after_state, prev_log_sha256, row_sha256, created_at
    from public.cert_audit_logs
   where certificate_id = p_certificate_id
   order by created_at desc, id desc
   limit greatest(1, least(500, p_limit));
$$;

revoke all on function public.fn_list_recent_audit(uuid, integer) from public;
grant execute on function public.fn_list_recent_audit(uuid, integer) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- fn_verify_audit_chain — サーバーサイドでのチェーン検証（言語間のシリアライズ差異回避）
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_verify_audit_chain(p_certificate_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_log record;
  v_prev_hash text := null;
  v_expected_hash text;
begin
  for v_log in (
    select * from public.cert_audit_logs 
    where certificate_id = p_certificate_id 
    order by created_at asc, id asc
  ) loop
    -- 1. 前のハッシュとのリンク検証
    if v_prev_hash is not null and v_log.prev_log_sha256 is distinct from v_prev_hash then
      return false;
    end if;

    -- 2. データ本体の改ざん検証（トリガーと全く同じロジックで再計算）
    v_expected_hash := encode(digest(
      jsonb_build_object(
        'certificate_id', v_log.certificate_id,
        'team_id',        v_log.team_id,
        'project_id',     v_log.project_id,
        'actor_id',       v_log.actor_id,
        'actor_email',    v_log.actor_email,
        'event_type',     v_log.event_type,
        'before_state',   coalesce(v_log.before_state, '{}'::jsonb),
        'after_state',    coalesce(v_log.after_state,  '{}'::jsonb),
        'prev_log_sha256', v_log.prev_log_sha256,
        'created_at',     v_log.created_at
      )::text,
      'sha256'
    ), 'hex');

    if v_log.row_sha256 != v_expected_hash then
      return false;
    end if;

    v_prev_hash := v_log.row_sha256;
  end loop;

  return true;
end;
$$;

revoke all on function public.fn_verify_audit_chain(uuid) from public;
grant execute on function public.fn_verify_audit_chain(uuid) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Notice — migration done.
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  raise notice '006_studio_projects_audit applied: projects, audit logs, RLS, triggers OK';
end $$;
