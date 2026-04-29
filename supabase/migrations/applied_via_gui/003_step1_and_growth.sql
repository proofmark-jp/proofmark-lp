create extension if not exists pgcrypto;

alter table public.certificates
  add column if not exists title text,
  add column if not exists proof_mode text not null default 'shareable' check (proof_mode in ('private','shareable')),
  add column if not exists visibility text not null default 'public' check (visibility in ('private','unlisted','public')),
  add column if not exists public_verify_token text not null default encode(gen_random_bytes(16), 'hex'),
  add column if not exists public_image_url text,
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists mime_type text,
  add column if not exists file_size bigint,
  add column if not exists width_px integer,
  add column if not exists height_px integer,
  add column if not exists badge_tier text not null default 'basic' check (badge_tier in ('basic','pro','studio','legacy')),
  add column if not exists process_bundle_id uuid,
  add column if not exists metadata_json jsonb not null default '{}'::jsonb,
  add column if not exists proven_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists certificates_sha256_key on public.certificates(sha256);
create unique index if not exists certificates_public_verify_token_key on public.certificates(public_verify_token);
create index if not exists certificates_user_id_idx on public.certificates(user_id);
create index if not exists certificates_proven_at_idx on public.certificates(proven_at desc);
create index if not exists certificates_visibility_idx on public.certificates(visibility);

create table if not exists public.process_bundles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  certificate_id uuid references public.certificates(id) on delete set null,
  title text not null,
  description text,
  cover_step_id uuid,
  evidence_mode text not null default 'hash_chain_v1' check (evidence_mode in ('hash_chain_v1')),
  root_step_id uuid,
  chain_head_step_id uuid,
  chain_head_sha256 text,
  chain_depth integer not null default 0,
  chain_verification_status text not null default 'pending' check (chain_verification_status in ('pending','verified','broken')),
  chain_verified_at timestamptz,
  status text not null default 'draft' check (status in ('draft','issued','archived')),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.process_bundle_steps (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.process_bundles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  step_index integer not null,
  step_type text not null check (step_type in ('rough','lineart','color','final','other')),
  title text not null,
  description text,
  sha256 text not null,
  original_filename text not null,
  mime_type text not null,
  file_size bigint not null,
  storage_path text,
  preview_url text,
  prev_step_id uuid,
  root_step_id uuid,
  prev_chain_sha256 text,
  chain_sha256 text,
  chain_payload_json jsonb not null default '{}'::jsonb,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(bundle_id, step_index)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'process_bundles_cover_step_fk'
  ) then
    alter table public.process_bundles
      add constraint process_bundles_cover_step_fk
      foreign key (cover_step_id) references public.process_bundle_steps(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'process_bundles_root_step_fk'
  ) then
    alter table public.process_bundles
      add constraint process_bundles_root_step_fk
      foreign key (root_step_id) references public.process_bundle_steps(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'process_bundles_chain_head_step_fk'
  ) then
    alter table public.process_bundles
      add constraint process_bundles_chain_head_step_fk
      foreign key (chain_head_step_id) references public.process_bundle_steps(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'process_bundle_steps_prev_step_fk'
  ) then
    alter table public.process_bundle_steps
      add constraint process_bundle_steps_prev_step_fk
      foreign key (prev_step_id) references public.process_bundle_steps(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'process_bundle_steps_root_step_fk'
  ) then
    alter table public.process_bundle_steps
      add constraint process_bundle_steps_root_step_fk
      foreign key (root_step_id) references public.process_bundle_steps(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'certificates_process_bundle_fk'
  ) then
    alter table public.certificates
      add constraint certificates_process_bundle_fk
      foreign key (process_bundle_id) references public.process_bundles(id) on delete set null;
  end if;
end $$;

create index if not exists process_bundles_user_id_idx on public.process_bundles(user_id);
create index if not exists process_bundles_certificate_id_idx on public.process_bundles(certificate_id);
create index if not exists process_bundles_chain_head_sha256_idx on public.process_bundles(chain_head_sha256);
create index if not exists process_bundle_steps_bundle_id_idx on public.process_bundle_steps(bundle_id);
create index if not exists process_bundle_steps_user_id_idx on public.process_bundle_steps(user_id);
create index if not exists process_bundle_steps_prev_step_id_idx on public.process_bundle_steps(prev_step_id);
create index if not exists process_bundle_steps_root_step_id_idx on public.process_bundle_steps(root_step_id);
create index if not exists process_bundle_steps_sha256_idx on public.process_bundle_steps(sha256);
create index if not exists process_bundle_steps_chain_sha256_idx on public.process_bundle_steps(chain_sha256);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_process_bundles_updated_at on public.process_bundles;
create trigger set_process_bundles_updated_at
before update on public.process_bundles
for each row execute function public.set_updated_at();

create or replace function public.get_process_bundle_lineage(bundle_uuid uuid)
returns table (
  id uuid,
  bundle_id uuid,
  step_index integer,
  step_type text,
  title text,
  description text,
  sha256 text,
  prev_step_id uuid,
  prev_chain_sha256 text,
  chain_sha256 text,
  issued_at timestamptz
)
language sql
stable
as $$
  with recursive lineage as (
    select
      s.id,
      s.bundle_id,
      s.step_index,
      s.step_type,
      s.title,
      s.description,
      s.sha256,
      s.prev_step_id,
      s.prev_chain_sha256,
      s.chain_sha256,
      s.issued_at
    from public.process_bundle_steps s
    where s.bundle_id = bundle_uuid
      and s.prev_step_id is null

    union all

    select
      n.id,
      n.bundle_id,
      n.step_index,
      n.step_type,
      n.title,
      n.description,
      n.sha256,
      n.prev_step_id,
      n.prev_chain_sha256,
      n.chain_sha256,
      n.issued_at
    from public.process_bundle_steps n
    inner join lineage l on n.prev_step_id = l.id
    where n.bundle_id = bundle_uuid
  )
  select *
  from lineage
  order by step_index asc;
$$;

alter table public.certificates enable row level security;
alter table public.process_bundles enable row level security;
alter table public.process_bundle_steps enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'certificates' and policyname = 'certificates own select') then
    create policy "certificates own select" on public.certificates
      for select to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'certificates' and policyname = 'certificates own insert') then
    create policy "certificates own insert" on public.certificates
      for insert to authenticated
      with check ((select auth.uid()) = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'certificates' and policyname = 'certificates own update') then
    create policy "certificates own update" on public.certificates
      for update to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'certificates' and policyname = 'public certificate select') then
    create policy "public certificate select" on public.certificates
      for select to anon
      using (visibility in ('public','unlisted'));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'process_bundles' and policyname = 'process bundles own select') then
    create policy "process bundles own select" on public.process_bundles
      for select to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'process_bundles' and policyname = 'process bundles own insert') then
    create policy "process bundles own insert" on public.process_bundles
      for insert to authenticated
      with check ((select auth.uid()) = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'process_bundles' and policyname = 'process bundles own update') then
    create policy "process bundles own update" on public.process_bundles
      for update to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'process_bundles' and policyname = 'public process bundle select') then
    create policy "public process bundle select" on public.process_bundles
      for select to anon
      using (is_public = true and status = 'issued');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'process_bundle_steps' and policyname = 'steps own select') then
    create policy "steps own select" on public.process_bundle_steps
      for select to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'process_bundle_steps' and policyname = 'steps own insert') then
    create policy "steps own insert" on public.process_bundle_steps
      for insert to authenticated
      with check ((select auth.uid()) = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'process_bundle_steps' and policyname = 'public steps select') then
    create policy "public steps select" on public.process_bundle_steps
      for select to anon
      using (exists (
        select 1 from public.process_bundles pb
        where pb.id = bundle_id
          and pb.is_public = true
          and pb.status = 'issued'
      ));
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('proofmark-originals', 'proofmark-originals', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('proofmark-public', 'proofmark-public', true)
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'proofmark originals own insert') then
    create policy "proofmark originals own insert" on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'proofmark-originals'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
        and (storage.foldername(name))[2] in ('certificates','bundles')
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'proofmark originals own read') then
    create policy "proofmark originals own read" on storage.objects
      for select to authenticated
      using (
        bucket_id = 'proofmark-originals'
        and owner_id::text = (select auth.uid())::text
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'proofmark public read') then
    create policy "proofmark public read" on storage.objects
      for select to public
      using (bucket_id = 'proofmark-public');
  end if;
end $$;
