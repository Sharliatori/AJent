/*
# Backoffice Self-Analysis Tables
*/

CREATE TABLE IF NOT EXISTS backoffice_schedule (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled          boolean     NOT NULL DEFAULT false,
  frequency        text        NOT NULL DEFAULT 'weekly'
                               CHECK (frequency IN ('daily','weekly','monthly')),
  hour_paris       integer     NOT NULL DEFAULT 8
                               CHECK (hour_paris >= 0 AND hour_paris <= 23),
  day_of_week      integer     DEFAULT 1
                               CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
  day_of_month     integer     DEFAULT 1
                               CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 28)),
  alert_threshold  text        NOT NULL DEFAULT 'critical'
                               CHECK (alert_threshold IN ('critical','high','all')),
  alert_recipient  text,
  last_run_at      timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS self_analysis_runs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by     text        NOT NULL DEFAULT 'manual'
                               CHECK (triggered_by IN ('manual','scheduled')),
  status           text        NOT NULL DEFAULT 'running'
                               CHECK (status IN ('running','completed','failed')),
  health_score     integer,
  deps_total       integer,
  deps_outdated    integer,
  vulns_critical   integer     DEFAULT 0,
  vulns_high       integer     DEFAULT 0,
  vulns_medium     integer     DEFAULT 0,
  vulns_low        integer     DEFAULT 0,
  alert_sent       boolean     DEFAULT false,
  error_message    text,
  raw_results      jsonb,
  started_at       timestamptz DEFAULT now(),
  completed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_self_analysis_runs_started
  ON self_analysis_runs(started_at DESC);

ALTER TABLE backoffice_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE self_analysis_runs  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_bo_schedule" ON backoffice_schedule;
DROP POLICY IF EXISTS "anon_insert_bo_schedule" ON backoffice_schedule;
DROP POLICY IF EXISTS "anon_update_bo_schedule" ON backoffice_schedule;
DROP POLICY IF EXISTS "anon_delete_bo_schedule" ON backoffice_schedule;

CREATE POLICY "anon_select_bo_schedule" ON backoffice_schedule FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_bo_schedule" ON backoffice_schedule FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_bo_schedule" ON backoffice_schedule FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_bo_schedule" ON backoffice_schedule FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_self_runs" ON self_analysis_runs;
DROP POLICY IF EXISTS "anon_insert_self_runs" ON self_analysis_runs;
DROP POLICY IF EXISTS "anon_update_self_runs" ON self_analysis_runs;
DROP POLICY IF EXISTS "anon_delete_self_runs" ON self_analysis_runs;

CREATE POLICY "anon_select_self_runs" ON self_analysis_runs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_self_runs" ON self_analysis_runs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_self_runs" ON self_analysis_runs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_self_runs" ON self_analysis_runs FOR DELETE TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION update_self_analyze_cron(p_cron_expr text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $func$
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
