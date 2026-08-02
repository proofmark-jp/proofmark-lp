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
    -- B2B業務のピークタイムにおけるI/Oスパイクとテーブルロックを回避する。
    PERFORM cron.schedule(
        'purge-audit-logs', 
        '0 18 * * *', 
        $query$ 
        -- 【Tax Compliance & Strategic Purge SQL】
        -- クエリプランナーに確実なインデックススキャンを強制させるため、
        -- OR句によるI/O爆発を排除し、かつ否定演算子(!=)をIN句の肯定リストに変換して直列実行する。

        -- 1. Spot決済ログ: チャージバック及び日本の税法（7年保存義務）に準拠し 2555日 死守
        DELETE FROM public.audit_logs 
        WHERE kind = 'spot' AND created_at < NOW() - INTERVAL '2555 days';

        -- 2. 無料成功ログ: 法的監査の証跡として 365日 死守
        DELETE FROM public.audit_logs 
        WHERE kind = 'auth' AND status = 'COMPLETED' AND created_at < NOW() - INTERVAL '365 days';

        -- 3. 失敗・中断・ゴミログ: インフラ保護のため 30日 で消去 (Seq Scan回避のため肯定リスト指定)
        DELETE FROM public.audit_logs 
        WHERE kind = 'auth' AND status IN ('STARTED', 'ABORTED', 'FAILED') AND created_at < NOW() - INTERVAL '30 days';
        $query$
    );
END
$$;