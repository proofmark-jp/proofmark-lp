-- =============================================================================
-- Phase 1.8: The Schema Reconciliation (スキーマ調停・神経結合パッチ) - 完全修正版
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. 【監査ログの修復】 トランザクション崩壊（Write-NEVER）の完全回避
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_log_cert_event(
  p_certificate_id uuid,
  p_actor_id       uuid,
  p_actor_email    citext,
  p_event_type     text,
  p_before         jsonb default '{}'::jsonb,
  p_after          jsonb default '{}'::jsonb,
  p_client_ip      inet  default null,
  p_user_agent     text  default null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev        text;
  v_canonical   text;
  v_row_sha     text;
  v_id          uuid;
BEGIN
  IF p_certificate_id IS NULL THEN
    RAISE EXCEPTION 'fn_log_cert_event: certificate_id required';
  END IF;

  PERFORM 1 FROM public.certificates WHERE id = p_certificate_id FOR NO KEY UPDATE;

  SELECT row_sha256 INTO v_prev
  FROM public.cert_audit_logs
  WHERE certificate_id = p_certificate_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  v_canonical := jsonb_build_object(
    'certificate_id', p_certificate_id,
    'team_id',        null,
    'project_id',     null,
    'actor_id',       p_actor_id,
    'actor_email',    p_actor_email,
    'event_type',     p_event_type,
    'before_state',   COALESCE(p_before, '{}'::jsonb),
    'after_state',    COALESCE(p_after, '{}'::jsonb),
    'prev_log_sha256', v_prev
  )::text;

  v_row_sha := encode(digest(v_canonical, 'sha256'), 'hex');

  INSERT INTO public.cert_audit_logs (
    certificate_id, team_id, project_id, actor_id, actor_email, 
    event_type, before_state, after_state, prev_log_sha256, row_sha256,
    client_ip, user_agent
  ) VALUES (
    p_certificate_id, null, null, p_actor_id, p_actor_email,
    p_event_type, p_before, p_after, v_prev, v_row_sha,
    p_client_ip, p_user_agent
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. 【フロントエンド救済】 Storefront (公開ギャラリー) の 500エラー回避
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_storefront_certificates(p_username text)
RETURNS TABLE (
  id uuid,
  title text,
  proven_at timestamptz,
  certified_at timestamptz,
  sha256 text,
  tsa_provider text,
  has_timestamp boolean,
  proof_mode text,
  visibility text,
  public_image_url text,
  delivery_status text,
  project_id uuid,
  badge_tier text,
  c2pa_present boolean,
  c2pa_valid boolean,
  c2pa_ai_used boolean,
  c2pa_ai_provider text,
  c2pa_issuer text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- 🚨 修正箇所: 存在しない is_public カラムのチェックを削除し、純粋な username マッチのみに変更
  WITH target AS (
    SELECT id FROM public.profiles WHERE lower(username) = lower(p_username) LIMIT 1
  )
  SELECT 
    c.id, 
    coalesce(c.title, c.file_name, 'Untitled') AS title, 
    c.created_at AS proven_at,
    c.certified_at, 
    c.sha256::text, 
    c.tsa_provider, 
    (c.timestamp_token IS NOT NULL AND c.certified_at IS NOT NULL) AS has_timestamp, 
    c.proof_mode, 
    c.visibility, 
    CASE WHEN c.visibility IN ('public', 'unlisted') THEN c.public_image_url ELSE NULL END AS public_image_url, 
    'delivered'::text AS delivery_status,
    NULL::uuid AS project_id,
    'standard'::text AS badge_tier,
    (c.c2pa_manifest IS NOT NULL) AS c2pa_present,
    CASE 
      WHEN c.c2pa_manifest IS NULL THEN NULL 
      WHEN c.c2pa_manifest->>'validity' = 'valid' THEN true 
      WHEN c.c2pa_manifest->>'validity' = 'invalid' THEN false 
      ELSE NULL 
    END AS c2pa_valid,
    CASE 
      WHEN c.c2pa_manifest IS NULL THEN NULL 
      WHEN c.c2pa_manifest ? 'ai_used' THEN (c.c2pa_manifest->>'ai_used')::boolean 
      ELSE NULL 
    END AS c2pa_ai_used,
    nullif(c.c2pa_manifest->>'ai_provider', '') AS c2pa_ai_provider,
    nullif(c.c2pa_manifest->>'issuer', '') AS c2pa_issuer
  FROM public.certificates c
  JOIN target t ON t.id = c.user_id
  WHERE c.visibility = 'public' 
    AND c.is_asset_purged = false;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. 【決済ブラックホール抹殺】 Spot決済の二重帳簿を破壊し、Titanium Skeletonへ統合
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.spot_orders CASCADE;
DROP FUNCTION IF EXISTS public.fn_spot_append_storage_path(text, text);
DROP FUNCTION IF EXISTS public.fn_spot_append_storage_path(uuid, text);

CREATE OR REPLACE FUNCTION public.fn_fulfill_spot_payment(
  p_event_id text, 
  p_certificate_id uuid
)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
BEGIN
  INSERT INTO public.stripe_events (id, type, status, processed_at)
  VALUES (p_event_id, 'checkout.session.completed', 'processed', timezone('utc'::text, now()));

  UPDATE public.certificates
  SET 
    visibility = 'public',
    updated_at = NOW(),
    metadata_json = jsonb_set(
      coalesce(metadata_json, '{}'::jsonb), 
      '{stripe_payment_status}', 
      '"succeeded"'
    )
  WHERE id = p_certificate_id AND proof_mode = 'spot';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Spot certificate % not found or not in spot mode.', p_certificate_id;
  END IF;
END;
$$;

COMMIT;