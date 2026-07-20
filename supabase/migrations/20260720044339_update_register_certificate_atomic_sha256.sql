CREATE OR REPLACE FUNCTION public.register_certificate_atomic(
  p_cid text,
  p_mime_type text,
  p_size_bytes bigint,
  p_storage_key text,
  p_title text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_certificate_id uuid;
BEGIN
  -- 1. 実行者の認証セッションを確認（セキュアアクセス）
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED_ACCESS';
  END IF;

  -- 2. certificates テーブルへの打刻
  INSERT INTO public.certificates (
    user_id,
    cid,
    sha256, -- 👑 必須カラムを追加
    mime_type,
    size_bytes,
    storage_key,
    title,
    status,
    proof_mode
  ) VALUES (
    auth.uid(),
    p_cid,
    REPLACE(p_cid, 'sha256:', ''), -- 👑 'sha256:' プレフィックスを除去した純粋なハッシュ値を挿入
    p_mime_type,
    p_size_bytes,
    p_storage_key,
    p_title,
    'pending',
    'private'
  ) RETURNING id INTO v_certificate_id;

  -- 3. APIルートが期待するフォーマットで返却
  RETURN jsonb_build_object(
    'success', true,
    'certificateId', v_certificate_id
  );
END;
$$;