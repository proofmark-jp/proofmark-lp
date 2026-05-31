-- =================================================================================
-- Phase 2: Quota Management & Privileges RPC (The Absolute Perfect Security Version)
-- =================================================================================

CREATE INDEX IF NOT EXISTS idx_certificates_quota_calc
ON public.certificates (user_id, proof_mode, created_at);

-- 1. トリガー関数（ハッキング完全防衛・最終版）
CREATE OR REPLACE FUNCTION public.check_monthly_certificate_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_type text;
  v_monthly_count integer;
  v_limit integer;
  v_role text;
BEGIN
  -- 現在のAPIリクエストの権限（ロール）を取得
  v_role := auth.role();

  -- 🚨 防衛線 (1): タイムトラベル（過去日付偽装）の無効化
  -- クライアントが送信した日付を無視し、データベースサーバーの現在時刻で強制上書きする
  NEW.created_at := now();

  -- 🚨 防衛線 (2): IDハイジャック（なりすまし）の物理的遮断
  -- ログインユーザーの場合、送信された user_id を無視し、暗号的に証明された自身の auth.uid() で強制上書きする
  IF v_role = 'authenticated' THEN
    NEW.user_id := auth.uid();
  END IF;

  -- 🚨 防衛線 (3): 衝突安全なトランザクションロック（Lock Collision防御）
  -- hashtextの32bit空間での衝突を防ぐため、第一引数にNamespaceを設けた「複合キー」でロックを取得
  IF NEW.user_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('proofmark_quota'), hashtext(NEW.user_id::text));
  END IF;

  -- Spot決済の厳格な保護
  IF NEW.proof_mode = 'spot' THEN
    -- 🚨 防衛線 (4): Spot権限の絶対的分離（スパム防御）
    -- Spotデータは「Stripe決済完了後」にバックエンド（service_role）からのみ挿入を許可。
    -- フロントエンド（authenticated/anon）からのSpot挿入はハッキングとみなし即死させる。
    IF v_role IN ('authenticated', 'anon') THEN
      RAISE EXCEPTION '[ERR_UNAUTHORIZED_SPOT] Spot mode can only be issued by the secure backend.';
    END IF;
    RETURN NEW; -- 安全なバックエンドからのSpotは上限チェックをスキップ
  END IF;

  -- 未ログインユーザーによる通常証明書発行はエラーとして遮断
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION '[ERR_GUEST_DENIED] Unauthenticated users cannot issue standard certificates.';
  END IF;

  -- profilesから現在のプランを取得
  SELECT plan_type INTO v_plan_type FROM public.profiles WHERE id = NEW.user_id;
  v_plan_type := COALESCE(v_plan_type, 'free');

  -- 料金プラン上限値（LP完全同期）
  IF v_plan_type = 'business' THEN v_limit := 1000;
  ELSIF v_plan_type = 'studio' THEN v_limit := 150;
  ELSIF v_plan_type = 'creator' THEN v_limit := 30;
  ELSE v_limit := 3;
  END IF;

  -- JST基準で「今月」のカウント
  SELECT count(*)
  INTO v_monthly_count
  FROM public.certificates
  WHERE user_id = NEW.user_id
    AND proof_mode IS DISTINCT FROM 'spot'
    AND created_at >= date_trunc('month', now() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo' AT TIME ZONE 'UTC';

  -- ブロック判定
  IF v_monthly_count >= v_limit THEN
    RAISE EXCEPTION '[ERR_MONTHLY_LIMIT_EXCEEDED] % plan limit (%/month) reached.', UPPER(v_plan_type), v_limit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public;

-- トリガーの再生成（確実に適用）
DROP TRIGGER IF EXISTS trg_check_monthly_certificate_limit ON public.certificates;
CREATE TRIGGER trg_check_monthly_certificate_limit
BEFORE INSERT ON public.certificates
FOR EACH ROW
EXECUTE FUNCTION public.check_monthly_certificate_limit();


-- 2. 権限チェックRPC関数（UX表示用）
CREATE OR REPLACE FUNCTION public.fn_get_user_privileges()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_type text;
  v_used int;
  v_limit int;
  v_remaining int;
  v_can_export_evidence boolean;
BEGIN
  SELECT plan_type INTO v_plan_type FROM public.profiles WHERE id = auth.uid();
  v_plan_type := COALESCE(v_plan_type, 'free');

  IF v_plan_type = 'business' THEN v_limit := 1000;
  ELSIF v_plan_type = 'studio' THEN v_limit := 150;
  ELSIF v_plan_type = 'creator' THEN v_limit := 30;
  ELSE v_limit := 3;
  END IF;

  v_can_export_evidence := (v_plan_type IN ('creator', 'studio', 'business'));

  SELECT count(*) INTO v_used 
  FROM public.certificates
  WHERE user_id = auth.uid() 
    AND proof_mode IS DISTINCT FROM 'spot'
    AND created_at >= date_trunc('month', now() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo' AT TIME ZONE 'UTC';

  v_remaining := v_limit - v_used;
  IF v_remaining < 0 THEN v_remaining := 0; END IF;

  RETURN jsonb_build_object(
    'plan_tier', v_plan_type,
    'tsa_used_this_month', v_used,
    'tsa_limit_this_month', v_limit,
    'tsa_remaining_this_month', v_remaining,
    'can_issue_more', (v_used < v_limit),
    'can_export_evidence_pack', v_can_export_evidence,
    'can_use_batch', (v_plan_type IN ('creator', 'studio', 'business')),
    'can_use_trusted_tsa', (v_plan_type IN ('creator', 'studio', 'business'))
  );
END;
$$;