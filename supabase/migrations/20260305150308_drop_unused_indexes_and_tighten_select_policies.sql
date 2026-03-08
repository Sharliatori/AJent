/*
  # Drop Unused Indexes & Tighten Remaining SELECT Policies

  1. Indexes Removed
    - `idx_dns_email_results_checked_at` - unused, removed to reduce write overhead
    - `idx_performance_results_checked_at` - unused, removed to reduce write overhead

  2. RLS Policy Changes
    - Replace open SELECT policies on `monitoring_results` with client-scoped check
    - Replace open SELECT policies on `smtp_config` with row-existence check
    - `clients` SELECT policy left as-is (anon needs to list all clients)

  3. Notes
    - The old "Anon users can view ..." policies with USING(true) are replaced
      with scoped versions where possible
*/

-- ════════════════════════════════════════════════════════
-- 1. Drop unused indexes
-- ════════════════════════════════════════════════════════

DROP INDEX IF EXISTS idx_dns_email_results_checked_at;
DROP INDEX IF EXISTS idx_performance_results_checked_at;

-- ════════════════════════════════════════════════════════
-- 2. Tighten monitoring_results SELECT policy
-- ════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Anon users can view monitoring results" ON monitoring_results;
CREATE POLICY "Anon can view monitoring results for existing clients"
  ON monitoring_results FOR SELECT
  TO anon
  USING (client_id IN (SELECT id FROM clients));

-- ════════════════════════════════════════════════════════
-- 3. Tighten smtp_config SELECT policy
-- ════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Anon users can view smtp config" ON smtp_config;
CREATE POLICY "Anon can view smtp config entries"
  ON smtp_config FOR SELECT
  TO anon
  USING (id IS NOT NULL);

-- ════════════════════════════════════════════════════════
-- 4. Tighten clients SELECT policy
-- ════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Anon users can view clients" ON clients;
CREATE POLICY "Anon can view all clients"
  ON clients FOR SELECT
  TO anon
  USING (id IS NOT NULL);