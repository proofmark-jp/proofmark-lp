-- ─────────────────────────────────────────────────────────────────────────────
-- Stripe Webhook State Machine & RPCs
-- 過去のGUI操作の残骸を完全に破壊し、安全なトランザクション内で再構築する
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN; -- トランザクション開始

-- 1. 【残骸の完全破壊】過去の関数をシグネチャごと消し去る
DROP FUNCTION IF EXISTS public.handle_stripe_checkout(text, text, uuid, text);
DROP FUNCTION IF EXISTS public.fn_lock_stripe_event(text, text, jsonb);
DROP FUNCTION IF EXISTS public.fn_mark_stripe_event_processed(text);
DROP FUNCTION IF EXISTS public.fn_mark_stripe_event_failed(text, text);
DROP FUNCTION IF EXISTS public.fn_spot_append_storage_path(text, text);
DROP FUNCTION IF EXISTS public.fn_spot_append_storage_path(uuid, text);

-- 2. stripe_events テーブルの基盤構築
CREATE TABLE IF NOT EXISTS public.stripe_events (
    id text PRIMARY KEY,
    type text NOT NULL,
    status text NOT NULL DEFAULT 'received',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    processed_at timestamp with time zone,
    error_message text,
    payload jsonb
);

-- RLSの再確認（物理遮断）
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- 3. ゾンビロック強制奪取付きのUPSERT関数 (The Core Lock)
CREATE OR REPLACE FUNCTION public.fn_lock_stripe_event(
    p_event_id text,
    p_event_type text,
    p_payload jsonb
)
RETURNS TABLE (locked_id text, was_retry boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_status text;
BEGIN
    INSERT INTO public.stripe_events (id, type, status, payload)
    VALUES (p_event_id, p_event_type, 'received', p_payload)
    ON CONFLICT (id) DO UPDATE
    SET status = 'received'
    WHERE public.stripe_events.status = 'failed'
       -- ゾンビロック解除: received(処理中扱い)のまま5分以上放置されたものはクラッシュと見なし、強制リトライさせる
       OR (public.stripe_events.status = 'received' AND public.stripe_events.created_at < now() - interval '5 minutes')
    RETURNING status INTO v_status;

    IF FOUND THEN
        RETURN QUERY SELECT p_event_id, false;
    ELSE
        RETURN;
    END IF;
END;
$$;

-- 4. 成功マーク関数
CREATE OR REPLACE FUNCTION public.fn_mark_stripe_event_processed(p_event_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.stripe_events
    SET status = 'processed', processed_at = timezone('utc'::text, now())
    WHERE id = p_event_id;
END;
$$;

-- 5. 失敗マーク関数
CREATE OR REPLACE FUNCTION public.fn_mark_stripe_event_failed(p_event_id text, p_error text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.stripe_events
    SET status = 'failed', error_message = p_error
    WHERE id = p_event_id;
END;
$$;

-- 6. Spot用の配列への安全な追記関数 (型エラー jsonb vs text[] の完全解決)
-- storage_paths は text[] 型であるため、PostgreSQLの array_append を使用する
CREATE OR REPLACE FUNCTION public.fn_spot_append_storage_path(p_staging_id text, p_path text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.spot_orders
  SET storage_paths = array_append(storage_paths, p_path)
  WHERE staging_id = p_staging_id::uuid;
$$;

COMMIT; -- トランザクション完了