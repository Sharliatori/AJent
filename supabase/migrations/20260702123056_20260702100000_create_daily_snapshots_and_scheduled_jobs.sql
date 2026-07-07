/*
# Daily Snapshots & Scheduled Monitoring Jobs

## Purpose
Implements automated bi-daily site analysis (10H and 18H France time) and weekly
personalized email reports (every Monday at 10H France time).

## Changes

### New Tables
- `daily_snapshots`
  - id (uuid, primary key): unique identifier
  - client_id (uuid, FK → clients, CASCADE): the monitored site
  - slot (text, CHECK 'morning'|'evening'): which daily run produced this snapshot
  - snapshot_date (date): the calendar date of the snapshot
  - http_ok (boolean): whether HTTP check passed
  - ssl_ok (boolean): whether SSL check passed
  - dns_ok (boolean): whether DNS check passed
  - http_status_code (integer): HTTP response code
  - ssl_days_left (integer): days before SSL certificate expiry
  - response_time_ms (integer): HTTP response time in milliseconds
  - issues (text[]): list of detected issues
  - checked_at (timestamptz): exact time the check ran
  - UNIQUE constraint on (client_id, slot, snapshot_date) so upserts are safe

### New Scheduled Jobs (pg_cron, times in UTC — France CEST summer = UTC+2)
- `daily-check-morning`: calls /functions/v1/daily-check {slot:"morning"} at 08:00 UTC (10H Paris)
- `daily-check-evening`: calls /functions/v1/daily-check {slot:"evening"} at 16:00 UTC (18H Paris)
- `weekly-report-monday`: calls /functions/v1/weekly-report {} at 08:00 UTC every Monday (10H Paris)

### Security
- RLS enabled on daily_snapshots
- SELECT / INSERT / UPDATE / DELETE open to anon + authenticated (single-tenant, no sign-in)

### Important Notes
1. pg_cron and pg_net extensions are already enabled from the keep-alive migration; this migration is idempotent.
2. Times are UTC. In winter (CET = UTC+1) reports will fire at 09H Paris instead of 10H. Adjust cron expressions in winter if needed.
3. Cron jobs are unscheduled before re-scheduling to make this migration safe to re-run.
4. The daily-check edge function compares morning vs evening snapshots and sends an alert to nicolas.sinou@live.fr when differences are detected.
5. The weekly-report edge function sends a personalized email to each client's recipients — obsolescence data is excluded.
*/

-- Extensions (idempotent — already created by keepalive migration)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─── daily_snapshots table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_snapshots (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  slot            text        NOT NULL CHECK (slot IN ('morning', 'evening')),
  snapshot_date   date        NOT NULL DEFAULT CURRENT_DATE,
  http_ok         boolean,
  ssl_ok          boolean,
  dns_ok          boolean,
  http_status_code integer,
  ssl_days_left   integer,
  response_time_ms integer,
  issues          text[]      DEFAULT '{}',
  checked_at      timestamptz DEFAULT now(),
  UNIQUE (client_id, slot, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_snapshots_client_date
  ON daily_snapshots(client_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_snapshots_slot_date
  ON daily_snapshots(slot, snapshot_date DESC);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE daily_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_daily_snapshots" ON daily_snapshots;
CREATE POLICY "anon_select_daily_snapshots" ON daily_snapshots FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_daily_snapshots" ON daily_snapshots;
CREATE POLICY "anon_insert_daily_snapshots" ON daily_snapshots FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_daily_snapshots" ON daily_snapshots;
CREATE POLICY "anon_update_daily_snapshots" ON daily_snapshots FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_daily_snapshots" ON daily_snapshots;
CREATE POLICY "anon_delete_daily_snapshots" ON daily_snapshots FOR DELETE
  TO anon, authenticated USING (true);

-- ─── pg_cron scheduled jobs ───────────────────────────────────────────────────
-- Unschedule first for idempotency

SELECT cron.unschedule('daily-check-morning')  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-check-morning');
SELECT cron.unschedule('daily-check-evening')  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-check-evening');
SELECT cron.unschedule('weekly-report-monday') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-report-monday');

-- Daily analysis — morning (08:00 UTC = 10H Paris CEST)
SELECT cron.schedule(
  'daily-check-morning',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://yzkwchhtezpmdozgqnqi.supabase.co/functions/v1/daily-check',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{"slot": "morning"}'::jsonb
  ) AS request_id;
  $$
);

-- Daily analysis — evening (16:00 UTC = 18H Paris CEST)
SELECT cron.schedule(
  'daily-check-evening',
  '0 16 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://yzkwchhtezpmdozgqnqi.supabase.co/functions/v1/daily-check',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{"slot": "evening"}'::jsonb
  ) AS request_id;
  $$
);

-- Weekly personalized reports — every Monday at 08:00 UTC (10H Paris CEST)
SELECT cron.schedule(
  'weekly-report-monday',
  '0 8 * * 1',
  $$
  SELECT net.http_post(
    url     := 'https://yzkwchhtezpmdozgqnqi.supabase.co/functions/v1/weekly-report',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
