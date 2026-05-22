-- 1. 隔離領域（quarantine）の24時間自動お掃除バッチ
CREATE OR REPLACE FUNCTION public.cleanup_quarantine_assets()
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM storage.objects
    WHERE bucket_id = 'proofmark-originals'
      AND name LIKE 'quarantine/%'
      AND created_at < (now() - interval '24 hours');
END;
$$;

-- 2. cronジョブの登録 (毎日深夜3時 UTC)
SELECT cron.schedule(
    'cleanup_quarantine_job',
    '0 3 * * *',
    'SELECT public.cleanup_quarantine_assets();'
);