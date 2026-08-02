-- =============================================================================
-- 👑 THE SOVEREIGN ARCHITECT: sql/cron/multipart_reaper.sql
-- Phase 1.13: The Multipart Orphan Reaper (State Machine Detection)
-- 目的: Cloudflare R2の孤立したMultipart Uploadを検出し、課金源を刈り取る準備を行う
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
    -- 🚨 【Atomic Idempotency】 
    -- 初回実行時（ジョブ未登録時）の cron.unschedule 例外を完全に握り潰し、
    -- マイグレーション・デッドロックを物理的に遮断する。
    BEGIN
        PERFORM cron.unschedule('detect-multipart-orphans');
    EXCEPTION 
        WHEN OTHERS THEN NULL;
    END;
    
    -- 🚨 【Decoupled FinOps Architecture】
    -- pg_cron はDB内部での「タイムアウト検知」と「状態遷移 (active -> aborted)」のみを担う。
    -- 実際の R2 SDK 呼び出し (物理削除) は Vercel Cron に委譲することで、
    -- 外部API通信によるDBトランザクションの長時間ロックやエラーを完全に排除する。
    -- スケジュールは 1日4回 (UTC 3,9,15,21) に固定し、pg_cron 実行枠を極限まで節約する。
    PERFORM cron.schedule(
        'detect-multipart-orphans', 
        '0 3,9,15,21 * * *', 
        $query$ 
        -- 【Zero-I/O Reaper Query】
        -- 002_r2_multipart_sessions.sql で定義済みの部分インデックス
        -- (idx_r2_multipart_reap: WHERE status = 'active') に完全に合致させる。
        -- 30分以上Heartbeatが途絶えたセッションを、インデックススキャンで瞬時に捕捉し無効化する。
        UPDATE public.r2_multipart_sessions
        SET 
            status = 'aborted',
            updated_at = NOW()
        WHERE 
            status = 'active' 
            AND last_heartbeat_at < NOW() - INTERVAL '30 minutes';
        $query$
    );
END
$$;