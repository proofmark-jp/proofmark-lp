-- ==============================================================================
-- The Immutable Ledger: audit_logs (Rev.6 Upgrade Patch - The True Final Omega)
-- ==============================================================================

-- 1. metadata カラムの安全な追加
ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. GINインデックスの追加 (FinOps最適化: jsonb_path_ops)
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata 
ON public.audit_logs USING GIN (metadata jsonb_path_ops);

-- 3. IaC最適化: DELETEクエリの実行計画に完全合致させた3複合インデックス
CREATE INDEX IF NOT EXISTS idx_audit_logs_kind_status_created_at 
ON public.audit_logs(kind, status, created_at);

-- 4. FinOps, Business & Tax Compliance: 階層型自動パージジョブ
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
    -- 🚨 修正: サブトランザクションによる絶対的冪等性の確保
    -- 初回実行時（ジョブ未登録時）に発生する XX000 エラーを捕捉して完全に握り潰す
    BEGIN
        PERFORM cron.unschedule('purge-audit-logs');
    EXCEPTION 
        WHEN OTHERS THEN
            -- ジョブが存在しない場合は何もしない（正常にスキップ）
    END;
    
    -- JST（日本時間）深夜3時に実行するため、UTC 18:00 を指定
    -- ピークタイムのDBリソース競合を完全に回避する
    PERFORM cron.schedule(
        'purge-audit-logs', 
        '0 18 * * *', 
        -- ネスト衝突を回避するため $query$ タグで隔離
        $query$ 
        -- 【戦略的ビジネス・パージ（税務要件準拠）】
        -- 1. 有料決済(spot)のログは、チャージバック及び日本の税法（7年保存義務）に準拠し 2555日 死守
        -- 2. 無料(auth)の成功ログ(COMPLETED)は、法的監査の証跡として 365日 死守
        -- 3. 無料(auth)のゴミログ(失敗・中断)のみ、インフラ保護のため 30日 で消去
        DELETE FROM public.audit_logs 
        WHERE 
            (kind = 'spot' AND created_at < NOW() - INTERVAL '2555 days')
            OR
            (kind = 'auth' AND status = 'COMPLETED' AND created_at < NOW() - INTERVAL '365 days')
            OR
            (kind = 'auth' AND status != 'COMPLETED' AND created_at < NOW() - INTERVAL '30 days');
        $query$
    );
END
$$;