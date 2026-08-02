-- =============================================================================
-- 👑 THE SOVEREIGN ARCHITECT: sql/cron/tier_purge.sql
-- Phase 1.12: 3-Tier Business & FinOps Purge Job
-- 目的: 日本の電子帳簿保存法およびStripeチャージバック反証要件に基づく階層型ログパージ
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
    -- 🚨 【Atomic Idempotency】 
    -- 初回実行時（ジョブ未登録時）に cron.unschedule が投げる例外を完全に握り潰し、
    -- デプロイメント時のマイグレーション・デッドロックを物理的に遮断する。
    BEGIN
        PERFORM cron.unschedule('purge-audit-logs');
    EXCEPTION 
        WHEN OTHERS THEN NULL;
    END;
    
    -- 🚨 【FinOps Armor】 
    -- 実行時間を UTC 18:00 (JST 午前3時) にハードコード。
    -- B2B業務のピークタイムにおける数百万件のログ削除によるI/Oスパイクとテーブルロックを回避する。
    PERFORM cron.schedule(
        'purge-audit-logs', 
        '0 18 * * *', 
        $query$ 
        -- 【Tax Compliance & Strategic Purge SQL】
        -- 複合インデックス (kind, status, created_at) に完全に合致するWHERE句評価。
        DELETE FROM public.audit_logs 
        WHERE 
            -- 1. Spot決済ログ: チャージバック及び日本の税法（7年保存義務）に準拠し 2555日 死守
            (kind = 'spot' AND created_at < NOW() - INTERVAL '2555 days')
            OR
            -- 2. 無料成功ログ: 法的監査の証跡として 365日 死守
            (kind = 'auth' AND status = 'COMPLETED' AND created_at < NOW() - INTERVAL '365 days')
            OR
            -- 3. 失敗・中断・ゴミログ: インフラ保護のため 30日 で消去
            (kind = 'auth' AND status != 'COMPLETED' AND created_at < NOW() - INTERVAL '30 days');
        $query$
    );
END
$$;