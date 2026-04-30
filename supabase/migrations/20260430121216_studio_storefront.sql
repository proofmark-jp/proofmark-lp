-- ─────────────────────────────────────────────────────────────────────────────
-- 008_studio_storefront.sql
--
-- Sprint 4 — Storefront / Public Profile Showcase
--
-- 既存の 001..007 にレイヤード適用される、純粋追加マイグレーション。
-- すべて IF NOT EXISTS / OR REPLACE で再実行可。
--
-- 目的:
--   1. profiles に Studio Storefront 用の "ブランディング列" を追加
--      （logo / domain / verification / contact_url / nda_*）。
--   2. projects に "公開可否" を追加（公開しないプロジェクトは未一覧）。
--   3. 公開閲覧用の SECURITY DEFINER 関数 fn_storefront_<*> を提供。
--      RLS には触らず、関数経由で「ホワイトリスト列」のみを返す。
--      → 個別の RLS ポリシーを緩めずに公開 API を実現。
--   4. profiles.verified_status は不変条件 ('unverified'|'pending'|'verified')。
--      verified_at は SECURITY DEFINER 関数経由でしか設定できない。
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";
create extension if not exists "citext";
set search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. certificates: アーカイブフラグの追加（コンパイルエラー回避）
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.certificates
  add column if not exists is_archived boolean default false;
create index if not exists certificates_is_archived_idx on public.certificates (is_archived) where is_archived is true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. profiles: Storefront ブランディング列
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists studio_name        text,
  add column if not exists studio_logo_url    text,
  add column if not exists studio_domain      text,           -- e.g. 'acme.studio'
  add column if not exists studio_tagline     text,           -- 1 行で何屋か
  add column if not exists studio_bio         text,           -- 240 文字以内
  add column if not exists contact_url        text,           -- Typeform / Calendly / mailto:
  add column if not exists contact_label      text,           -- ボタンに表示する文言
  add column if not exists nda_default_mode   text
    check (nda_default_mode in ('open', 'masked', 'hidden')) default 'masked',
  add column if not exists verified_status    text
    check (verified_status in ('unverified', 'pending', 'verified')) default 'unverified',
  add column if not exists verified_at        timestamptz,
  add column if not exists verified_method    text,           -- 'dns_txt' | 'email' | 'manual'
  add column if not exists storefront_theme   jsonb           default '{}'::jsonb,
  add column if not exists is_storefront_public boolean       default true;

-- 文字数制約 (DB 側でも強制)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_studio_name_len') then
    alter table public.profiles add constraint profiles_studio_name_len
      check (studio_name is null or length(studio_name) between 1 and 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_studio_tagline_len') then
    alter table public.profiles add constraint profiles_studio_tagline_len
      check (studio_tagline is null or length(studio_tagline) <= 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_studio_bio_len') then
    alter table public.profiles add constraint profiles_studio_bio_len
      check (studio_bio is null or length(studio_bio) <= 600);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_studio_domain_fmt') then
    -- 軽量フォーマット検査。実体検証は verified_method='dns_txt' 側で。
    alter table public.profiles add constraint profiles_studio_domain_fmt
      check (
        studio_domain is null
        or studio_domain ~* '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$'
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_contact_url_proto') then
    alter table public.profiles add constraint profiles_contact_url_proto
      check (
        contact_url is null
        or contact_url ~* '^(https?://|mailto:)'
      );
  end if;
end $$;

create index if not exists profiles_storefront_public_idx
  on public.profiles (is_storefront_public)
  where is_storefront_public is true;

create index if not exists profiles_verified_status_idx
  on public.profiles (verified_status)
  where verified_status = 'verified';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. projects: 公開可否
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.projects
  add column if not exists is_public        boolean default false,
  add column if not exists public_summary   text,           -- 240 文字以内の対外サマリ
  add column if not exists public_cover_url text;           -- 任意のカバー画像

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'projects_public_summary_len') then
    alter table public.projects add constraint projects_public_summary_len
      check (public_summary is null or length(public_summary) <= 600);
  end if;
end $$;

create index if not exists projects_public_idx
  on public.projects (is_public, owner_id)
  where is_public is true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. fn_set_studio_verification — 認証完了は SECURITY DEFINER 経由のみ
--     • verified_status = 'verified' に変更できる経路を 1 つに固定する。
--     • method は 'dns_txt' / 'email' / 'manual' のいずれか。
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_set_studio_verification(
  p_user_id uuid,
  p_status  text,
  p_method  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('unverified', 'pending', 'verified') then
    raise exception 'invalid verification status: %', p_status;
  end if;
  update public.profiles
     set verified_status = p_status,
         verified_method = case when p_status = 'verified' then p_method else verified_method end,
         verified_at     = case when p_status = 'verified' then now() else null end
   where id = p_user_id;
end
$$;

revoke all on function public.fn_set_studio_verification(uuid, text, text) from public;
grant execute on function public.fn_set_studio_verification(uuid, text, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. fn_storefront_profile — 公開向けの安全な列だけを返す
--    認証不要。username で名前解決し、is_storefront_public=true の場合のみ返却。
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_storefront_profile(p_username text)
returns table (
  id              uuid,
  username        text,
  avatar_url      text,
  studio_name     text,
  studio_logo_url text,
  studio_domain   text,
  studio_tagline  text,
  studio_bio      text,
  contact_url     text,
  contact_label   text,
  nda_default_mode text,
  verified_status text,
  verified_at     timestamptz,
  verified_method text,
  is_founder      boolean,
  plan_tier       text,
  storefront_theme jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.avatar_url,
         p.studio_name, p.studio_logo_url, p.studio_domain, p.studio_tagline, p.studio_bio,
         p.contact_url, p.contact_label, p.nda_default_mode,
         p.verified_status, p.verified_at, p.verified_method,
         coalesce(p.is_founder, false) as is_founder,
         coalesce(p.plan_tier, 'free') as plan_tier,
         coalesce(p.storefront_theme, '{}'::jsonb) as storefront_theme
    from public.profiles p
   where lower(p.username) = lower(p_username)
     and coalesce(p.is_storefront_public, true) is true
   limit 1;
$$;

revoke all on function public.fn_storefront_profile(text) from public;
grant execute on function public.fn_storefront_profile(text) to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. fn_storefront_certificates — Storefront 用、安全なカード行集合
--    NDA / unlisted / private は次の方針で返す:
--      • visibility = 'public'   → カードを通常表示。
--      • visibility = 'unlisted' → 含めない（直リンク前提）。
--      • visibility = 'private'  → 含めない。
--      • is_archived               → 含めない。
--    画像 URL は visibility='public' のときだけ返す（NDA マスクと共存）。
--    project_id でグルーピング可能なので一緒に返す。
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_storefront_certificates(
  p_username   text,
  p_limit      integer default 60,
  p_project_id uuid    default null
)
returns table (
  id                uuid,
  title             text,
  proven_at         timestamptz,
  certified_at      timestamptz,
  sha256            text,
  tsa_provider      text,
  has_timestamp     boolean,
  proof_mode        text,
  visibility        text,
  public_image_url  text,
  delivery_status   text,
  project_id        uuid,
  badge_tier        text
)
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select id from public.profiles
     where lower(username) = lower(p_username)
       and coalesce(is_storefront_public, true) is true
     limit 1
  )
  select c.id,
         case
           when coalesce(c.visibility, 'public') = 'public'
           then coalesce(c.title, c.original_filename, c.file_name, 'Untitled')
           else 'Confidential Asset'
         end as title,
         c.proven_at,
         c.certified_at,
         c.sha256,
         c.tsa_provider,
         (c.timestamp_token is not null and c.certified_at is not null) as has_timestamp,
         c.proof_mode,
         c.visibility,
         case when c.visibility = 'public' then c.public_image_url else null end as public_image_url,
         c.delivery_status,
         c.project_id,
         c.badge_tier
    from public.certificates c
   inner join target t on t.id = c.user_id
   where coalesce(c.visibility, 'public') in ('public', 'private')
     and coalesce(c.is_archived, false) = false
     and (p_project_id is null or c.project_id = p_project_id)
   order by coalesce(c.proven_at, c.created_at) desc
   limit greatest(1, least(120, p_limit));
$$;

revoke all on function public.fn_storefront_certificates(text, integer, uuid) from public;
grant execute on function public.fn_storefront_certificates(text, integer, uuid) to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. fn_storefront_projects — Storefront グルーピング用
--    is_public = true のプロジェクトのみ。所有件数を集計付きで返却。
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_storefront_projects(p_username text)
returns table (
  id               uuid,
  name             text,
  color            text,
  client_name      text,
  public_summary   text,
  public_cover_url text,
  status           text,
  due_at           timestamptz,
  certificate_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select id from public.profiles
     where lower(username) = lower(p_username)
       and coalesce(is_storefront_public, true) is true
     limit 1
  )
  select p.id, p.name, p.color, p.client_name, p.public_summary, p.public_cover_url,
         p.status, p.due_at,
         (
           select count(*)::int
             from public.certificates c
            where c.project_id = p.id
              and coalesce(c.visibility, 'public') in ('public', 'private')
              and coalesce(c.is_archived, false) = false
         ) as certificate_count
    from public.projects p
   inner join target t on t.id = p.owner_id
   where coalesce(p.is_public, false) = true
     and coalesce(p.status, 'active') <> 'archived'
   order by p.updated_at desc;
$$;

revoke all on function public.fn_storefront_projects(text) from public;
grant execute on function public.fn_storefront_projects(text) to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. fn_storefront_kpi — 信頼サマリ（NDA 件数も含む全件カウント）
--    NDA を「隠す」のではなく「ある事実だけを開示する」ための統計。
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_storefront_kpi(p_username text)
returns table (
  total_assets        integer,
  public_assets       integer,
  nda_masked_assets   integer,
  trusted_tsa_count   integer,
  audited_chain_count integer,
  latest_proven_at    timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select id from public.profiles
     where lower(username) = lower(p_username)
       and coalesce(is_storefront_public, true) is true
     limit 1
  ),
  base as (
    select c.* from public.certificates c
    inner join target t on t.id = c.user_id
    where coalesce(c.is_archived, false) = false
  )
  select
    count(*)::int                                                                  as total_assets,
    count(*) filter (where coalesce(visibility, 'public') = 'public')::int         as public_assets,
    count(*) filter (where visibility in ('unlisted', 'private'))::int             as nda_masked_assets,
    count(*) filter (
      where lower(coalesce(tsa_provider, '')) in ('digicert','globalsign','seiko','sectigo')
    )::int                                                                         as trusted_tsa_count,
    count(*) filter (
      where exists (
        select 1 from public.cert_audit_logs a where a.certificate_id = base.id
      )
    )::int                                                                         as audited_chain_count,
    max(coalesce(proven_at, created_at))                                           as latest_proven_at
  from base;
$$;

revoke all on function public.fn_storefront_kpi(text) from public;
grant execute on function public.fn_storefront_kpi(text) to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. 完了通知
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  raise notice '008_studio_storefront applied: profile branding cols + storefront RPCs OK';
end $$;
