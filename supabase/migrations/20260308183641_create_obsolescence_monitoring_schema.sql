/*
  # Create Obsolescence Monitoring Schema

  This migration creates the full database schema for the dependency obsolescence
  monitoring module. It enables tracking of analyzed projects, their analysis reports,
  per-dependency snapshots, and vulnerability findings.

  1. New Tables
    - `analyzed_projects`
      - `id` (uuid, primary key) - Unique project identifier
      - `user_id` (uuid, nullable) - Owner reference to auth.users
      - `project_name` (text) - Human-readable project name
      - `project_url` (text) - Production URL of the project
      - `api_key` (text, unique) - Authentication key for report submission (prefixed ak_)
      - `framework` (text) - Auto-detected framework (next, vite, etc.)
      - `last_health_score` (integer) - Cached latest health score for quick display
      - `last_analysis_at` (timestamptz) - Date of latest analysis
      - `is_active` (boolean, default true) - Soft-delete flag
      - `created_at` (timestamptz) - Row creation timestamp
      - `updated_at` (timestamptz) - Row update timestamp

    - `analysis_reports`
      - `id` (uuid, primary key) - Unique report identifier
      - `project_id` (uuid, FK to analyzed_projects) - Parent project
      - `health_score` (integer, 0-100) - Overall health score
      - `total_dependencies` (integer) - Total dependency count
      - `outdated_count` (integer) - Number of outdated dependencies
      - `vulnerable_count` (integer) - Number of vulnerable dependencies
      - `deprecated_count` (integer) - Number of deprecated dependencies
      - `raw_data` (jsonb) - Full analysis report as JSON
      - `analyzed_at` (timestamptz) - When the analysis was executed
      - `created_at` (timestamptz) - Row creation timestamp

    - `dependency_snapshots`
      - `id` (uuid, primary key) - Unique snapshot identifier
      - `report_id` (uuid, FK to analysis_reports) - Parent report
      - `package_name` (text) - npm package name
      - `current_version` (text) - Version currently in use
      - `latest_version` (text) - Latest available version
      - `latest_patch` (text) - Latest patch version available
      - `latest_minor` (text) - Latest minor version available
      - `update_type` (text) - patch / minor / major / up-to-date
      - `is_deprecated` (boolean) - Whether the package is deprecated
      - `days_behind` (integer) - Days behind latest version
      - `created_at` (timestamptz) - Row creation timestamp

    - `vulnerability_findings`
      - `id` (uuid, primary key) - Unique finding identifier
      - `report_id` (uuid, FK to analysis_reports) - Parent report
      - `package_name` (text) - Affected package name
      - `cve_id` (text) - CVE identifier
      - `severity` (text) - low / medium / high / critical
      - `description` (text) - Vulnerability description
      - `fixed_in_version` (text) - Version that fixes the issue
      - `source_url` (text) - Link to CVE details
      - `created_at` (timestamptz) - Row creation timestamp

  2. Indexes
    - `idx_analysis_reports_project_timeline` on analysis_reports(project_id, analyzed_at DESC)
    - `idx_dependency_snapshots_report` on dependency_snapshots(report_id)
    - `idx_vulnerability_findings_report` on vulnerability_findings(report_id)
    - `idx_analyzed_projects_api_key` on analyzed_projects(api_key)

  3. Security
    - RLS enabled on all 4 tables
    - analyzed_projects: anon can SELECT, INSERT, UPDATE, DELETE (matches existing app pattern)
    - analysis_reports: anon can SELECT; service_role can INSERT (edge functions)
    - dependency_snapshots: anon can SELECT
    - vulnerability_findings: anon can SELECT
*/

-- ============================================================
-- Table: analyzed_projects
-- ============================================================
CREATE TABLE IF NOT EXISTS analyzed_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  project_name text NOT NULL,
  project_url text,
  api_key text NOT NULL UNIQUE DEFAULT ('ak_' || gen_random_uuid()),
  framework text,
  last_health_score integer,
  last_analysis_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE analyzed_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select analyzed_projects"
  ON analyzed_projects FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "Anon can insert analyzed_projects"
  ON analyzed_projects FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update analyzed_projects"
  ON analyzed_projects FOR UPDATE
  TO anon
  USING (is_active = true)
  WITH CHECK (is_active = true);

CREATE POLICY "Anon can delete analyzed_projects"
  ON analyzed_projects FOR DELETE
  TO anon
  USING (is_active = true);

CREATE POLICY "Service role full access on analyzed_projects"
  ON analyzed_projects FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Table: analysis_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS analysis_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES analyzed_projects(id) ON DELETE CASCADE,
  health_score integer NOT NULL CHECK (health_score >= 0 AND health_score <= 100),
  total_dependencies integer NOT NULL DEFAULT 0,
  outdated_count integer NOT NULL DEFAULT 0,
  vulnerable_count integer NOT NULL DEFAULT 0,
  deprecated_count integer NOT NULL DEFAULT 0,
  raw_data jsonb,
  analyzed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE analysis_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select analysis_reports"
  ON analysis_reports FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM analyzed_projects
      WHERE analyzed_projects.id = analysis_reports.project_id
      AND analyzed_projects.is_active = true
    )
  );

CREATE POLICY "Service role full access on analysis_reports"
  ON analysis_reports FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Table: dependency_snapshots
-- ============================================================
CREATE TABLE IF NOT EXISTS dependency_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES analysis_reports(id) ON DELETE CASCADE,
  package_name text NOT NULL,
  current_version text NOT NULL,
  latest_version text NOT NULL,
  latest_patch text,
  latest_minor text,
  update_type text NOT NULL CHECK (update_type IN ('patch', 'minor', 'major', 'up-to-date')),
  is_deprecated boolean NOT NULL DEFAULT false,
  days_behind integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dependency_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select dependency_snapshots"
  ON dependency_snapshots FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM analysis_reports
      JOIN analyzed_projects ON analyzed_projects.id = analysis_reports.project_id
      WHERE analysis_reports.id = dependency_snapshots.report_id
      AND analyzed_projects.is_active = true
    )
  );

CREATE POLICY "Service role full access on dependency_snapshots"
  ON dependency_snapshots FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Table: vulnerability_findings
-- ============================================================
CREATE TABLE IF NOT EXISTS vulnerability_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES analysis_reports(id) ON DELETE CASCADE,
  package_name text NOT NULL,
  cve_id text,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description text,
  fixed_in_version text,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vulnerability_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select vulnerability_findings"
  ON vulnerability_findings FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM analysis_reports
      JOIN analyzed_projects ON analyzed_projects.id = analysis_reports.project_id
      WHERE analysis_reports.id = vulnerability_findings.report_id
      AND analyzed_projects.is_active = true
    )
  );

CREATE POLICY "Service role full access on vulnerability_findings"
  ON vulnerability_findings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Performance Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_analysis_reports_project_timeline
  ON analysis_reports (project_id, analyzed_at DESC);

CREATE INDEX IF NOT EXISTS idx_dependency_snapshots_report
  ON dependency_snapshots (report_id);

CREATE INDEX IF NOT EXISTS idx_vulnerability_findings_report
  ON vulnerability_findings (report_id);

CREATE INDEX IF NOT EXISTS idx_analyzed_projects_api_key
  ON analyzed_projects (api_key);
