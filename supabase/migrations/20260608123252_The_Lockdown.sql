-- =============================================================================
-- Phase 1.8.1: The Lockdown (RPC権限の完全封鎖)
-- 目的: ハッカーによるAPI経由での「Stripe決済の偽装」と「監査ログの偽造」を物理的に遮断する
-- =============================================================================

BEGIN;

-- 1. Stripe決済完了処理 (Webhook) のロックダウン
-- 一般ユーザー(anon, authenticated)からの呼び出し権限を剥奪し、
-- Vercel API (Service Role) からのみ実行可能にする。
REVOKE ALL ON FUNCTION public.fn_fulfill_spot_payment(text, uuid) FROM public;
REVOKE ALL ON FUNCTION public.fn_fulfill_spot_payment(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fn_fulfill_spot_payment(text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_fulfill_spot_payment(text, uuid) TO service_role;

-- 2. 監査ログ記録関数のロックダウン
-- クライアントからの直接の「ログ偽造」を防ぐ。
REVOKE ALL ON FUNCTION public.fn_log_cert_event(uuid, uuid, citext, text, jsonb, jsonb, inet, text) FROM public;
REVOKE ALL ON FUNCTION public.fn_log_cert_event(uuid, uuid, citext, text, jsonb, jsonb, inet, text) FROM anon;
REVOKE ALL ON FUNCTION public.fn_log_cert_event(uuid, uuid, citext, text, jsonb, jsonb, inet, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_log_cert_event(uuid, uuid, citext, text, jsonb, jsonb, inet, text) TO service_role;

COMMIT;