-- ============================================================
-- Security hardening: SECURITY DEFINER functions and
-- always-true RLS write policies
-- ============================================================

-- 1. Fix mutable search_path on update_self_analyze_cron
CREATE OR REPLACE FUNCTION public.update_self_analyze_cron(p_cron_expr text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $func$
BEGIN
  BEGIN
    PERFORM cron.unschedule('self-analyze-scheduled');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  IF p_cron_expr IS NOT NULL AND p_cron_expr != '' THEN
    PERFORM cron.schedule(
      'self-analyze-scheduled',
      p_cron_expr,
      $cron$SELECT net.http_post(
        url     := 'https://yzkwchhtezpmdozgqnqi.supabase.co/functions/v1/self-analyze',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body    := '{"triggered_by":"scheduled"}'::jsonb
      );$cron$
    );
  END IF;
END;
$func$;

-- 2. Fix mutable search_path on update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $func$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$func$;

-- 3. Revoke public EXECUTE on both SECURITY DEFINER functions.
--    update_self_analyze_cron manages pg_cron jobs — not safe to expose via RPC.
--    update_updated_at_column is a trigger — should never be called directly.
REVOKE EXECUTE ON FUNCTION public.update_self_analyze_cron(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;

-- 4. Drop always-true anon write policies for backoffice_schedule.
--    All writes go through the save-bo-schedule edge function (service_role bypasses RLS).
DROP POLICY IF EXISTS "anon_insert_bo_schedule" ON public.backoffice_schedule;
DROP POLICY IF EXISTS "anon_update_bo_schedule" ON public.backoffice_schedule;
DROP POLICY IF EXISTS "anon_delete_bo_schedule" ON public.backoffice_schedule;

-- 5. Drop always-true anon write policies for self_analysis_runs.
--    All writes go through the self-analyze edge function (service_role bypasses RLS).
DROP POLICY IF EXISTS "anon_insert_self_runs" ON public.self_analysis_runs;
DROP POLICY IF EXISTS "anon_update_self_runs" ON public.self_analysis_runs;
DROP POLICY IF EXISTS "anon_delete_self_runs" ON public.self_analysis_runs;

-- 6. Drop always-true anon write policies for keepalive_log.
--    All writes go through the keep-alive edge function (service_role bypasses RLS).
DROP POLICY IF EXISTS "anon_insert_keepalive_log" ON public.keepalive_log;
DROP POLICY IF EXISTS "anon_delete_keepalive_log" ON public.keepalive_log;

-- 7. Drop always-true anon write policies for daily_snapshots.
--    All writes go through the daily-check edge function (service_role bypasses RLS).
DROP POLICY IF EXISTS "anon_insert_daily_snapshots" ON public.daily_snapshots;
DROP POLICY IF EXISTS "anon_update_daily_snapshots" ON public.daily_snapshots;
DROP POLICY IF EXISTS "anon_delete_daily_snapshots" ON public.daily_snapshots;
