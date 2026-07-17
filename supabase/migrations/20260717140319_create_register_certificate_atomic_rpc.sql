-- 幽霊レコードとなりすましを物理的に根絶するアトミックRPC (修正版)
CREATE OR REPLACE FUNCTION register_certificate_atomic(
  p_cid TEXT,
  p_title TEXT,
  p_size_bytes BIGINT,
  p_mime_type TEXT
) RETURNS UUID AS $$
DECLARE
  v_cert_id UUID;
  v_user_id UUID;
BEGIN
  -- PostgreSQLカーネルレベルでJWTから絶対的な身元を抽出（なりすまし不可）
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED_RPC_CALL';
  END IF;

  -- 1. 証明書の初期レコード作成
  INSERT INTO certificates (id, user_id, chain_sha256, visibility, metadata_json)
  VALUES (
    gen_random_uuid(), v_user_id, p_cid, 'private',
    jsonb_build_object(
      'version', 'proofmark-v1',
      'title', COALESCE(p_title, 'Untitled Workspace'),
      'chain_history', jsonb_build_array(
        jsonb_build_object('ts', NOW(), 'action', 'create')
      )
    )
  ) RETURNING id INTO v_cert_id;

  -- 2. Mac mini向けジョブキューへの投入
  INSERT INTO oracle_jobs (certificate_id, job_type, payload, status)
  VALUES (
    v_cert_id, 'video_decimate',
    jsonb_build_object('cid', p_cid, 'size', p_size_bytes, 'mimeType', p_mime_type, 'user_id', v_user_id),
    'pending'
  );

  RETURN v_cert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;