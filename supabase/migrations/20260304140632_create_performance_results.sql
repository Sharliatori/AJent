/*
  # Create Performance Results Table

  1. New Tables
    - `performance_results` - Stores PageSpeed Insights performance scores per client
      - `id` (uuid, primary key)
      - `client_id` (uuid, foreign key to clients)
      - `domain` (text) - Domain/URL tested
      - `mobile_score` (integer) - Mobile performance score 0-100
      - `desktop_score` (integer) - Desktop performance score 0-100
      - `mobile_details` (jsonb) - Detailed mobile metrics (FCP, LCP, TBT, CLS, SI)
      - `desktop_details` (jsonb) - Detailed desktop metrics (FCP, LCP, TBT, CLS, SI)
      - `issues` (text[]) - Performance issues detected
      - `checked_at` (timestamptz) - When the check was performed
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `performance_results` table
    - Anon CRUD policies matching existing app pattern
    - Service role full access

  3. Important Notes
    - Foreign key to clients with CASCADE delete
    - Indexes on client_id and checked_at for efficient queries
    - Stores mobile and desktop scores separately for granular analysis
*/

CREATE TABLE IF NOT EXISTS performance_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  domain text NOT NULL DEFAULT '',
  mobile_score integer DEFAULT 0,
  desktop_score integer DEFAULT 0,
  mobile_details jsonb DEFAULT '{}',
  desktop_details jsonb DEFAULT '{}',
  issues text[] DEFAULT '{}',
  checked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_performance_results_client_id ON performance_results(client_id);
CREATE INDEX IF NOT EXISTS idx_performance_results_checked_at ON performance_results(checked_at DESC);

ALTER TABLE performance_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can view performance results"
  ON performance_results FOR SELECT
  TO anon
  USING (client_id IN (SELECT id FROM clients));

CREATE POLICY "Anon can insert performance results"
  ON performance_results FOR INSERT
  TO anon
  WITH CHECK (client_id IN (SELECT id FROM clients));

CREATE POLICY "Anon can delete performance results"
  ON performance_results FOR DELETE
  TO anon
  USING (client_id IN (SELECT id FROM clients));

CREATE POLICY "Service role full access performance results"
  ON performance_results FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role insert performance results"
  ON performance_results FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role update performance results"
  ON performance_results FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role delete performance results"
  ON performance_results FOR DELETE
  TO service_role
  USING (true);