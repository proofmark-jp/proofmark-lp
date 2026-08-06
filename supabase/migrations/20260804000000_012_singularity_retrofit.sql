-- filepath: supabase/migrations/20260804000000_012_singularity_retrofit.sql
-- =============================================================================
-- 012_singularity_retrofit.sql
-- Singularity Patches #19 & #29 — Forced Retroactive Application
--
-- Patch #19: fn_fulfill_spot_payment の Double-INSERT を物理根絶
--            certificates.status は絶対に触れない (compliance state machine 専管)
-- Patch #29: pg_cron ジョブを advisory-locked PL/pgSQL 関数で完全ラップ
--            pg_try_advisory_xact_lock による並行実行の物理遮断
-- =============================================================================

SET search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 1: Patch #19 — fn_fulfill_spot_payment の完全修正
--
-- 旧実装の死因:
--   INSERT INTO public.stripe_events ... は fn_lock_stripe_event が既に同一 ID を
--   'received' ステータスで INSERT 済みであるため、Unique Constraint Violation (23505)
--   を引き起こし、全 Spot 決済が fn_mark_stripe_event_failed へ落ちていた。
--
-- 修正内容:
--   1. INSERT INTO public.stripe_events を物理削除 (fn_lock_stripe_event が担保)
--   2. certificates.status には一切触れない (Patch #19 厳守)
--      visibility と metadata_json のみを更新する
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_fulfill_spot_payment(
  p_event_id       text,
  p_certificate_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ★ INSERT INTO public.stripe_events は完全削除。
  --   fn_lock_stripe_event が呼び出し元 (Webhook) で既に同一 event_id を
  --   'received' ステータスで INSERT 済み。
  --   fn_mark_stripe_event_processed の呼び出しも Webhook 側で一元管理するため不要。

  -- Patch #19: certificates.status 列には絶対に触れない。
  -- visibility = 'public' への昇格と stripe_payment_status の記録のみ実施。
  UPDATE public.certificates
  SET
    visibility    = 'public',
    updated_at    = NOW(),
    metadata_json = jsonb_set(
      COALESCE(metadata_json, '{}'::jsonb),
      '{stripe_payment_status}',
      '"succeeded"'
    )
  WHERE id = p_certificate_id
    AND proof_mode = 'spot';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'fn_fulfill_spot_payment: spot certificate % not found or not in spot mode.',
      p_certificate_id;
  END IF;
END;
$$;

REVOKE ALL  ON FUNCTION public.fn_fulfill_spot_payment(text, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_fulfill_spot_payment(text, uuid) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 2: Patch #29 — fn_cron_tier_purge()
--
-- pg_try_advisory_xact_lock でノンブロッキング排他制御を実装。
-- pg_cron が複数ワーカーで同時起動した場合でも、最初の 1 プロセスのみが
-- DELETE を実行し、残りは即座に RETURN して競合・デッドロックを回避する。
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_cron_tier_purge()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Patch #29: ノンブロッキング排他ロック。
  -- 取得失敗 = 前回の実行がまだ進行中 → 即時終了して重複実行を物理遮断。
  IF NOT pg_try_advisory_xact_lock(hashtext('cron_tier_purge')) THEN
    RAISE LOG 'fn_cron_tier_purge: advisory lock not acquired, skipping this run.';
    RETURN;
  END IF;

  -- 1. Spot 決済ログ: 日本の電子帳簿保存法 7 年保存義務 (2555 日) 死守
  DELETE FROM public.audit_logs
  WHERE kind = 'spot'
    AND created_at < NOW() - INTERVAL '2555 days';

  -- 2. 認証成功ログ: 法的監査証跡として 365 日 死守
  DELETE FROM public.audit_logs
  WHERE kind = 'auth'
    AND status = 'COMPLETED'
    AND created_at < NOW() - INTERVAL '365 days';

  -- 3. 失敗・中断・ゴミログ: インフラ保護のため 30 日で消去
  --    否定演算子 (!=) を肯定リストに変換してシーケンシャルスキャンを物理回避
  DELETE FROM public.audit_logs
  WHERE kind = 'auth'
    AND status IN ('STARTED', 'ABORTED', 'FAILED')
    AND created_at < NOW() - INTERVAL '30 days';
END;
$$;

REVOKE ALL  ON FUNCTION public.fn_cron_tier_purge() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cron_tier_purge() TO service_role;

-- pg_cron ジョブを advisory-locked 関数呼び出しに差し替え (冪等)
DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('purge-audit-logs');
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END;

  PERFORM cron.schedule(
    'purge-audit-logs',
    '0 18 * * *',
    $query$SELECT public.fn_cron_tier_purge();$query$
  );
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 3: Patch #29 — fn_cron_multipart_reaper()
--
-- 同様に pg_try_advisory_xact_lock でラップ。
-- 0011 の UPDATE ロジックをここに移管し、pg_cron は軽量な関数呼び出しのみ担う。
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_cron_multipart_reaper()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Patch #29: ノンブロッキング排他ロック。
  -- 取得失敗 = 前回の実行がまだ進行中 → 即時終了して重複 UPDATE を物理遮断。
  IF NOT pg_try_advisory_xact_lock(hashtext('cron_multipart_reaper')) THEN
    RAISE LOG 'fn_cron_multipart_reaper: advisory lock not acquired, skipping this run.';
    RETURN;
  END IF;

  -- 002_r2_multipart_sessions.sql の部分インデックス
  -- (idx_r2_multipart_reap: WHERE status = 'active') に完全合致させる。
  -- 30 分以上 Heartbeat が途絶えたセッションを瞬時に捕捉し 'aborted' へ遷移。
  UPDATE public.r2_multipart_sessions
  SET
    status     = 'aborted',
    updated_at = NOW()
  WHERE status = 'active'
    AND last_heartbeat_at < NOW() - INTERVAL '30 minutes';
END;
$$;

REVOKE ALL  ON FUNCTION public.fn_cron_multipart_reaper() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cron_multipart_reaper() TO service_role;

-- pg_cron ジョブを advisory-locked 関数呼び出しに差し替え (冪等)
DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('detect-multipart-orphans');
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END;

  PERFORM cron.schedule(
    'detect-multipart-orphans',
    '0 3,9,15,21 * * *',
    $query$SELECT public.fn_cron_multipart_reaper();$query$
  );
END
$$;
