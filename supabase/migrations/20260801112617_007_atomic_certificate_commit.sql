-- =============================================================================
-- 👑 THE SOVEREIGN ARCHITECT: sql/functions/atomic_certificate_commit.sql
-- Phase 1.10: Two-Phase Commit / Atomic Certificate Commit RPC
-- 目的: R2へのアップロード後の完全な打刻と、重複（23505）の静かなる吸収
-- =============================================================================

CREATE OR REPLACE FUNCTION public.atomic_certificate_commit(
  p_sha256 TEXT,
  p_object_key TEXT,
  p_size_bytes BIGINT,
  p_etag TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cert_id UUID;
  v_user_id UUID;
  v_existing_id UUID;
BEGIN
  -- 1. Gatekeeper: セッションの絶対検証 (なりすまし物理遮断)
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- 2. WORM Insert: 冪等な暗号的打刻
  -- 既に同一の sha256 が存在する場合、この INSERT は何もせず (DO NOTHING)、エラーも投げない
  INSERT INTO public.certificates (
    user_id,
    sha256,
    storage_path,
    file_size,
    file_name,
    proof_mode,
    visibility,
    status,
    metadata_json
  ) VALUES (
    v_user_id,
    p_sha256,
    p_object_key,
    p_size_bytes,
    COALESCE(split_part(p_object_key, '/', -1), 'Untitled'), -- ObjectKeyからの安全な抽出
    'private',
    'private',
    'completed',
    jsonb_build_object(
      'r2_etag', p_etag,
      'committed_at', NOW()
    )
  )
  ON CONFLICT (sha256) DO NOTHING
  RETURNING id INTO v_cert_id;

  -- 3. Duplicate Resolution: 既に暗号化された真実の抽出
  -- INSERT が DO NOTHING によってスキップされた場合、v_cert_id は NULL となる
  IF v_cert_id IS NULL THEN
    SELECT id INTO v_existing_id
    FROM public.certificates
    WHERE sha256 = p_sha256;

    RETURN jsonb_build_object(
      'isDuplicate', true,
      'certificateId', v_existing_id
    );
  END IF;

  -- 4. 新規発行の成功
  RETURN jsonb_build_object(
    'isDuplicate', false,
    'certificateId', v_cert_id
  );
END;
$$;

-- 5. Zero-Trust Authorization: 不要な実行権限の完全剥奪と許可
REVOKE ALL ON FUNCTION public.atomic_certificate_commit(TEXT, TEXT, BIGINT, TEXT) FROM public;
REVOKE ALL ON FUNCTION public.atomic_certificate_commit(TEXT, TEXT, BIGINT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.atomic_certificate_commit(TEXT, TEXT, BIGINT, TEXT) TO authenticated;