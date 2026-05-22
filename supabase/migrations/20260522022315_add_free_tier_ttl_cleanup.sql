-- ==============================================================================
-- 1. certificates テーブルへのパージ管理フラグ追加（存在しない場合）
-- ==============================================================================
ALTER TABLE public.certificates 
ADD COLUMN IF NOT EXISTS is_asset_purged BOOLEAN DEFAULT false;

-- ==============================================================================
-- 2. TTLバッチ関数の作成
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_free_tier_assets()
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER -- RLSをバイパスしてシステム権限で実行
AS $$
DECLARE
    target_record RECORD;
    deleted_count INTEGER := 0;
BEGIN
    -- 1. 削除対象のレコードを抽出
    -- 条件:
    --   - plan_tier が 'free'
    --   - certified_at (または created_at) から30日以上経過
    --   - まだパージされていない (is_asset_purged = false)
    --   - storage_path が存在する
    FOR target_record IN 
        SELECT 
            c.id AS cert_id,
            c.storage_path
        FROM 
            public.certificates c
        JOIN 
            public.profiles p ON c.user_id = p.id
        WHERE 
            p.plan_tier = 'free' 
            AND c.certified_at < (now() - interval '30 days')
            AND c.is_asset_purged = false
            AND c.storage_path IS NOT NULL
    LOOP
        -- 2. storage.objects テーブルからの物理ファイル削除
        -- Supabaseでは、storage.objects の行を削除するとトリガーによって
        -- 基盤となるS3ストレージのオブジェクトも非同期で削除されます。
        DELETE FROM storage.objects
        WHERE bucket_id = 'proofmark-originals'
          AND name = target_record.storage_path;

        -- 3. 証明書台帳（WORM）側のフラグを更新
        -- 行（レコード）自体は絶対に削除せず、ファイルが失効したことだけを記録します
        UPDATE public.certificates
        SET 
            is_asset_purged = true,
            storage_path = NULL, 
            updated_at = now()
        WHERE 
            id = target_record.cert_id;

        deleted_count := deleted_count + 1;
    END LOOP;

    -- 実行結果をログに出力
    RAISE NOTICE 'Cleanup completed. % assets purged.', deleted_count;
END;
$$;

-- ==============================================================================
-- 3. pg_cron による自動実行スケジューリング
-- ==============================================================================
-- 毎日 深夜2時0分 (UTC) に実行
-- ※ Supabaseで pg_cron を利用するには、拡張機能の有効化が必要です。

-- 初回のみ実行 (pg_cron拡張の有効化)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 既存の同名ジョブがあれば削除 (エラーを回避して安全に実行)
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'cleanup_free_tier_assets_job';

-- 毎日 02:00 (UTC) に関数を実行するジョブを登録
SELECT cron.schedule(
    'cleanup_free_tier_assets_job',  -- ジョブ名
    '0 2 * * *',                     -- cron式 (分 時 日 月 曜日)
    $$ SELECT public.cleanup_free_tier_assets(); $$
);