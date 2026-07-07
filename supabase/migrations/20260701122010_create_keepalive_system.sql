/*
# Keep-Alive System for Supabase Database

## Purpose
Prevents the Supabase free-tier database from auto-pausing after 7 days of inactivity.
A pg_cron job runs every 3 days to insert a heartbeat row, keeping the database active.

## Changes

### New Tables
- keepalive_log
  - id (uuid, primary key): unique identifier for each ping entry
  - pinged_at (timestamptz, default now()): timestamp of the keep-alive ping
  - status (text, default ok): result of the ping (ok, cron, manual)

### New Extensions
- pg_cron: job scheduler for PostgreSQL, used to run the heartbeat every 3 days
- pg_net: async HTTP client, available for future HTTP-based cron tasks

### New Scheduled Jobs
- siteguard-keepalive: runs every 3 days at midnight (cron: 0 0 every-3-days),
  inserts a row into keepalive_log and purges entries older than 30 days

### Security
- RLS enabled on keepalive_log
- SELECT policy open to anon + authenticated (public read for dashboard indicator)
- INSERT policy open to anon + authenticated
- DELETE policy open to anon + authenticated (for log cleanup)

### Notes
1. The pg_cron job inserts directly into keepalive_log as the primary keep-alive mechanism.
2. The edge function keep-alive provides a secondary manual trigger and log cleanup.
3. Old log entries older than 30 days are automatically cleaned up.
4. To disable: SELECT cron.unschedule('siteguard-keepalive');
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create keepalive_log table
CREATE TABLE IF NOT EXISTS keepalive_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pinged_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'ok'
);

CREATE INDEX IF NOT EXISTS idx_keepalive_log_pinged_at ON keepalive_log(pinged_at DESC);

-- Enable RLS
ALTER TABLE keepalive_log ENABLE ROW LEVEL SECURITY;

-- SELECT: public read so the frontend can display last ping
DROP POLICY IF EXISTS "anon_select_keepalive_log" ON keepalive_log;
CREATE POLICY "anon_select_keepalive_log" ON keepalive_log FOR SELECT
  TO anon, authenticated USING (true);

-- INSERT: allow frontend to trigger manual pings
DROP POLICY IF EXISTS "anon_insert_keepalive_log" ON keepalive_log;
CREATE POLICY "anon_insert_keepalive_log" ON keepalive_log FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- DELETE: allow cleanup of old logs
DROP POLICY IF EXISTS "anon_delete_keepalive_log" ON keepalive_log;
CREATE POLICY "anon_delete_keepalive_log" ON keepalive_log FOR DELETE
  TO anon, authenticated USING (true);

-- Schedule pg_cron job: every 3 days at midnight
-- This is the primary keep-alive mechanism — inserts a heartbeat row directly
SELECT cron.schedule(
  'siteguard-keepalive',
  '0 0 */3 * *',
  $$
    INSERT INTO keepalive_log(status) VALUES ('cron');
    DELETE FROM keepalive_log WHERE pinged_at < now() - interval '30 days';
  $$
);
