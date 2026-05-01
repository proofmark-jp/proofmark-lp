-- ─────────────────────────────────────────────────────────────────────────────
-- 20260501205527_fix_pgcrypto_digest.sql
-- Fixes "function digest(text, unknown) does not exist" error.
-- Ensures pgcrypto calls use the correct schema and strict type casting.
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

-- 1. fn_log_cert_event
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

  -- 修正: 厳格なキャストと名前空間付き関数呼び出し
  v_row_sha := encode(extensions.digest(v_canonical::text, 'sha256'::text), 'hex');

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


-- 2. fn_verify_audit_chain
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
  v_canonical text;
  v_expected_hash text;
begin
  for v_log in (
    select * from public.cert_audit_logs 
    where certificate_id = p_certificate_id 
    order by created_at asc, id asc
  ) loop
    -- 1. 前のハッシュとのリンク検証
    if v_prev_hash is not null and v_log.prev_log_sha256 is distinct from v_prev_hash then
      return false; -- チェーン切断
    end if;

    -- 2. データ本体の改ざん検証（作成時の状態を完全に復元して再ハッシュ）
    -- ※作成時（fn_log_cert_event）のロジックと完全に一致させ、
    --   now() の代わりに v_log.created_at を使用して時間を固定する。
    v_canonical := jsonb_build_object(
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
    )::text;

    -- 修正: 厳格なキャストと名前空間付き関数呼び出し
    v_expected_hash := encode(extensions.digest(v_canonical::text, 'sha256'::text), 'hex');

    if v_log.row_sha256 != v_expected_hash then
      return false; -- データ改ざん検知
    end if;

    -- 次のループへ進む
    v_prev_hash := v_log.row_sha256;
  end loop;

  return true;
end;
$$;

revoke all on function public.fn_verify_audit_chain(uuid) from public;
grant execute on function public.fn_verify_audit_chain(uuid) to authenticated, service_role;
