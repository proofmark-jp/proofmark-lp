-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 12.2: Spot Data Garbage Collection
-- Vercelからのキックを受け、24時間経過したデータをDB内部で一瞬で物理削除する
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

CREATE OR REPLACE FUNCTION public.fn_execute_spot_gc()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_deleted_count integer := 0;
  v_row record;
BEGIN
  -- 1. 24時間以上経過したSpotオーダーを抽出
  FOR v_row IN (
    SELECT staging_id
    FROM public.spot_orders
    WHERE created_at < now() - interval '24 hours'
  ) LOOP
    -- 2. Supabase Storageの内部管理テーブルから直接削除
    -- 【プロのハック】ここから行を消すと、Supabaseが裏側で自動的にS3から物理ファイルを非同期削除します。
    -- Node.jsから1ファイルずつAPI経由で消す際の「ネットワーク通信の遅延とタイムアウト」をゼロにします。
    DELETE FROM storage.objects
    WHERE bucket_id = 'spot-evidence'
      AND name LIKE v_row.staging_id || '/%';

    -- 3. レコード本体の物理削除
    DELETE FROM public.spot_orders
    WHERE staging_id = v_row.staging_id;

    v_deleted_count := v_deleted_count + 1;
  END LOOP;

  RETURN v_deleted_count;
END;
$$;

COMMIT;