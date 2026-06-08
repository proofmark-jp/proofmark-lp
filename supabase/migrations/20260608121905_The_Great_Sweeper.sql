-- =============================================================================
-- Phase 1.5: The Great Sweeper (Information RPCs) - True Perfect Version
-- =============================================================================

-- 1. 古い pg_cron ジョブと関数の完全破棄
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup_free_tier_assets_job');
    PERFORM cron.unschedule('cleanup_quarantine_job');
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- 無視して進行
END $$;

DROP FUNCTION IF EXISTS public.cleanup_free_tier_assets();
DROP FUNCTION IF EXISTS public.cleanup_quarantine_assets();
DROP FUNCTION IF EXISTS public.fn_execute_spot_gc();

-- 2. TTLパージ対象 (Spot / Free) リスト取得RPC
-- ※ shareable の public_bucket 側も削除できるよう、proof_mode を返す
CREATE OR REPLACE FUNCTION public.get_ttl_purge_targets()
RETURNS TABLE (cert_id UUID, storage_path TEXT, proof_mode TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.storage_path, c.proof_mode
  FROM public.certificates c
  LEFT JOIN public.profiles p ON c.user_id = p.id
  WHERE c.is_asset_purged = false
    AND c.storage_path IS NOT NULL
    AND (
      (c.proof_mode = 'spot' AND c.created_at < NOW() - INTERVAL '24 hours')
      OR
      (p.plan_tier = 'free' AND c.created_at < NOW() - INTERVAL '30 days')
    );
END;
$$;

-- 3. Quarantine ゾンビファイル対象リスト取得RPC
-- ※ storage スキーマへのアクセス権を明示
CREATE OR REPLACE FUNCTION public.get_orphaned_quarantine_paths()
RETURNS TABLE (storage_path TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  RETURN QUERY
  SELECT name
  FROM storage.objects
  WHERE bucket_id = 'proofmark-originals'
    AND name LIKE 'quarantine/%'
    AND created_at < NOW() - INTERVAL '24 hours';
END;
$$;