-- 1. 月間発行枠をチェックするトリガー関数の作成
CREATE OR REPLACE FUNCTION check_monthly_certificate_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_type text;
  v_monthly_count integer;
BEGIN
  -- 1. 未ログインユーザー（完全なゲストSpot決済）は制限をバイパス
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 🚨 2. 【決済ブラックホールの回避】
  -- ログイン済みのFreeユーザーであっても、これが「Spot決済」による発行なら制限を無視して許可する
  IF NEW.proof_mode = 'spot' THEN
    RETURN NEW;
  END IF;

  -- 3. ログインユーザーのプランを取得（存在しない場合は 'free' 扱い）
  SELECT plan_type INTO v_plan_type FROM profiles WHERE id = NEW.user_id;
  v_plan_type := COALESCE(v_plan_type, 'free');

  -- 4. プランが 'free' の場合のみ制限チェックを発動
  IF v_plan_type = 'free' THEN
    
    -- 【罠1の回避】日本時間 (Asia/Tokyo) 基準で「今月」の開始時刻を取得し、カウントする
    -- 🚨 Spot決済で発行した分は、無料枠の消化カウント（3件）に含めない
    SELECT count(*)
    INTO v_monthly_count
    FROM certificates
    WHERE user_id = NEW.user_id
      AND proof_mode IS DISTINCT FROM 'spot'
      AND created_at >= date_trunc('month', now() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo' AT TIME ZONE 'UTC';

    -- 3件以上発行済みなら、明確なエラーコードを吐いてInsertをブロック
    IF v_monthly_count >= 3 THEN
      RAISE EXCEPTION 'MONTHLY_LIMIT_EXCEEDED: Free plan limit (3/month) reached.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. トリガーの作成（Insert直前に必ず実行）
DROP TRIGGER IF EXISTS enforce_certificate_limit ON certificates;
CREATE TRIGGER enforce_certificate_limit
  BEFORE INSERT ON certificates
  FOR EACH ROW
  EXECUTE FUNCTION check_monthly_certificate_limit();