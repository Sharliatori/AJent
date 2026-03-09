/*
  # Fix security and performance issues

  1. New Indexes
    - Add index on `analyzed_projects.user_id` to support the foreign key
      `analyzed_projects_user_id_fkey` and avoid sequential scans on joins

  2. Dropped Indexes
    - `idx_dependency_snapshots_report` on `dependency_snapshots` (unused)
    - `idx_vulnerability_findings_report` on `vulnerability_findings` (unused)
    - `idx_analyzed_projects_api_key` on `analyzed_projects` (redundant with the
      UNIQUE constraint `analyzed_projects_api_key_key` which already provides a btree index)

  3. Security Changes
    - Drop the overly permissive `Anon can insert analyzed_projects` policy
      which had `WITH CHECK (true)`, allowing any anonymous user to insert rows
    - All inserts to `analyzed_projects` now go exclusively through edge functions
      using `SUPABASE_SERVICE_ROLE_KEY` (which bypasses RLS), so no anon INSERT
      policy is needed

  4. Notes
    - The Auth DB connection strategy alert is a Supabase infrastructure setting
      and cannot be changed via SQL migration; it must be adjusted in the
      Supabase dashboard under Project Settings > Database
*/

-- 1. Add index on user_id FK
CREATE INDEX IF NOT EXISTS idx_analyzed_projects_user_id
  ON public.analyzed_projects (user_id);

-- 2. Drop unused / redundant indexes
DROP INDEX IF EXISTS public.idx_dependency_snapshots_report;
DROP INDEX IF EXISTS public.idx_vulnerability_findings_report;
DROP INDEX IF EXISTS public.idx_analyzed_projects_api_key;

-- 3. Remove the always-true anon INSERT policy
DROP POLICY IF EXISTS "Anon can insert analyzed_projects" ON public.analyzed_projects;
