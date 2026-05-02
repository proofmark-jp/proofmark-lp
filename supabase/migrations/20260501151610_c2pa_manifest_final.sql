-- ─────────────────────────────────────────────────────────────────────────────
-- 20260501090000_c2pa_manifest.sql
--
-- Phase 10 — C2PA Content Credentials Integration
--
-- 既存の 001..008 / 20260430133809_storefront_performance.sql の上に
-- レイヤード適用される、純粋追加マイグレーション。
--
-- 主旨:
--   1. public.certificates に c2pa_manifest (JSONB nullable) を追加
--   2. WORM (Write-Once Read Many) 原則の維持:
--        • 初回 INSERT 時は自由
--        • UPDATE は timestamp_token が NULL の "初段" でのみ書込許可
--        • 一度値が入った c2pa_manifest は不変
--   3. 公開 Storefront 用 RPC fn_storefront_certificates にバッジ用の
--      最小サマリ (has_c2pa, c2pa_validity, c2pa_issuer, c2pa_ai_used) を
--      露出する。マニフェスト本体は決して anon / authenticated に渡さない
--      (Storefront カードに必要なのはバッジ判定のみ — 余計なバイナリは出さない)。
--
-- 全ブロック IF NOT EXISTS / OR REPLACE。再実行可。
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";
set search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. carrier column
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.certificates
  add column if not exists c2pa_manifest jsonb;

-- フェイルセーフ: 10KB以上の巨大ペイロードによるストレージ圧迫をDB層で物理的に遮断
alter table public.certificates
  drop constraint if exists c2pa_manifest_size_check;
alter table public.certificates
  add constraint c2pa_manifest_size_check
  check (octet_length(c2pa_manifest::text) <= 10240);

-- 軽量な存在検索用 (Storefront のフィルタ "Content Credentials のみ表示" 等で使用)
create index if not exists certificates_has_c2pa_idx
  on public.certificates ((c2pa_manifest is not null))
  where c2pa_manifest is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. WORM enforcement trigger
--
--    既存の "Write-Once Read Many" SQL トリガーが無い場合でも、本マイグレ
--    だけで c2pa_manifest 列の不変性を担保する。`timestamp_token` (RFC3161
--    トークン) が既に発行されている = 証明書はクライアントに納品済とみなし、
--    その後の c2pa_manifest 書換は一切禁止する。
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.trg_certificates_c2pa_worm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- INSERT は無条件に許可 (NULL でも値ありでも可)
  if (TG_OP = 'INSERT') then
    return NEW;
  end if;

  if (TG_OP = 'UPDATE') then
    -- 値が変わらない更新は素通し (UI の他のフィールド更新を阻害しない)
    if (OLD.c2pa_manifest is not distinct from NEW.c2pa_manifest) then
      return NEW;
    end if;

    -- すでに c2pa_manifest が確定している場合は二度と変更させない
    if (OLD.c2pa_manifest is not null) then
      raise exception 'c2pa_manifest is immutable once set' using errcode = 'P0001';
    end if;

    -- timestamp_token が既に発行 (= 納品済) なら以後の C2PA 追加も禁止
    if (OLD.timestamp_token is not null) then
      raise exception 'c2pa_manifest cannot be set after timestamp issuance' using errcode = 'P0002';
    end if;

    return NEW;
  end if;

  return null;
end
$$;

drop trigger if exists trg_certificates_c2pa_worm on public.certificates;
create trigger trg_certificates_c2pa_worm
  before update on public.certificates
  for each row execute function public.trg_certificates_c2pa_worm();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. fn_storefront_certificates の差替え (Phase 10 拡張版)
--
--    Phase 4 で導入された関数 (008_studio_storefront.sql) のシグネチャを
--    壊さないよう、戻り値の "尾尾" にバッジ用の 4 列だけを追加する。
--    呼び出し側は新カラムを無視できる (列名指定 SELECT のため)。
--
--    重要: c2pa_manifest 本体は anon / authenticated に渡さない。
--          UI が必要とする "判定の元" だけを抽出して返す。
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
  badge_tier        text,
  -- ── Phase 10 additions (badge-only summary; body never leaves the DB) ──
  has_c2pa          boolean,
  c2pa_validity     text,    -- 'valid' | 'invalid' | 'unknown' | null
  c2pa_issuer       text,    -- e.g. "Adobe Inc." (null when has_c2pa=false)
  c2pa_ai_used      boolean  -- true/false/null
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
         coalesce(c.title, c.original_filename, c.file_name, 'Untitled') as title,
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
         c.badge_tier,
         (c.c2pa_manifest is not null) as has_c2pa,
         (c.c2pa_manifest ->> 'validity') as c2pa_validity,
         (c.c2pa_manifest ->> 'issuer')   as c2pa_issuer,
         case
           when c.c2pa_manifest is null then null
           when (c.c2pa_manifest ->> 'ai_used') is null then null
           else (c.c2pa_manifest ->> 'ai_used')::boolean
         end as c2pa_ai_used
    from public.certificates c
   inner join target t on t.id = c.user_id
   where coalesce(c.visibility, 'public') = 'public'
     and coalesce(c.is_archived, false) = false
     and (p_project_id is null or c.project_id = p_project_id)
   order by coalesce(c.proven_at, c.created_at) desc
   limit greatest(1, least(120, p_limit));
$$;

revoke all on function public.fn_storefront_certificates(text, integer, uuid) from public;
grant execute on function public.fn_storefront_certificates(text, integer, uuid) to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. 完了通知
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  raise notice 'C2PA manifest column + WORM trigger + storefront badge fields applied';
end $$;
