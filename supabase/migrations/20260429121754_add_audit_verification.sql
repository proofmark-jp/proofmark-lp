-- ─────────────────────────────────────────────────────────────────────────────
-- 007_add_audit_verification.sql
-- サーバーサイドでの監査チェーン完全検証RPC（言語間のシリアライズ差異を回避）
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

    v_expected_hash := encode(digest(v_canonical, 'sha256'), 'hex');

    if v_log.row_sha256 != v_expected_hash then
      return false; -- データ改ざん検知
    end if;

    -- 次のループへ進む
    v_prev_hash := v_log.row_sha256;
  end loop;

  return true;
end;
$$;

-- 権限設定：API（authenticated）とサーバーサイド（service_role）からのみ実行可能に
revoke all on function public.fn_verify_audit_chain(uuid) from public;
grant execute on function public.fn_verify_audit_chain(uuid) to authenticated, service_role;