/*
  # Create DNS & Email Verification Results Table

  1. New Tables
    - `dns_email_results` - Stores detailed DNS and email authentication check results per client
      - `id` (uuid, primary key)
      - `client_id` (uuid, foreign key to clients)
      - `domain` (text) - Domain checked
      - `dns_a` (jsonb) - A record details (records, resolved, ttl)
      - `dns_aaaa` (jsonb) - AAAA record details
      - `dns_ns` (jsonb) - NS record details
      - `dns_mx` (jsonb) - MX record details (records, priority, valid)
      - `dns_spf` (jsonb) - SPF record details (record, valid, mechanisms)
      - `dns_dmarc` (jsonb) - DMARC record details (record, policy, valid)
      - `dns_dkim` (jsonb) - DKIM record details (selectors checked, found)
      - `overall_score` (integer) - Overall email authentication score 0-100
      - `issues` (text[]) - Detected issues
      - `checked_at` (timestamptz) - When the check was performed
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `dns_email_results` table
    - Anon CRUD policies matching existing app pattern

  3. Important Notes
    - Foreign key to clients with CASCADE delete
    - Index on client_id and checked_at for efficient queries
    - Stores granular DNS/email auth data for detailed reporting
*/

CREATE TABLE IF NOT EXISTS dns_email_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  domain text NOT NULL,
  dns_a jsonb DEFAULT '{}',
  dns_aaaa jsonb DEFAULT '{}',
  dns_ns jsonb DEFAULT '{}',
  dns_mx jsonb DEFAULT '{}',
  dns_spf jsonb DEFAULT '{}',
  dns_dmarc jsonb DEFAULT '{}',
  dns_dkim jsonb DEFAULT '{}',
  overall_score integer DEFAULT 0,
  issues text[] DEFAULT '{}',
  checked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dns_email_results_client_id ON dns_email_results(client_id);
CREATE INDEX IF NOT EXISTS idx_dns_email_results_checked_at ON dns_email_results(checked_at DESC);

ALTER TABLE dns_email_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can view dns email results"
  ON dns_email_results FOR SELECT
  TO anon
  USING (client_id IN (SELECT id FROM clients));

CREATE POLICY "Anon can insert dns email results"
  ON dns_email_results FOR INSERT
  TO anon
  WITH CHECK (client_id IN (SELECT id FROM clients));

CREATE POLICY "Anon can delete dns email results"
  ON dns_email_results FOR DELETE
  TO anon
  USING (client_id IN (SELECT id FROM clients));

CREATE POLICY "Service role full access dns email results"
  ON dns_email_results FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
