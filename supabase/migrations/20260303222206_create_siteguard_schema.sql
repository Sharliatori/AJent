/*
  # SiteGuard Monitoring Database Schema

  1. New Tables
    - `clients` - Client websites being monitored
      - `id` (uuid, primary key)
      - `name` (text) - Client/site name
      - `url` (text) - Full URL to monitor
      - `domain` (text) - Domain for DNS/SSL checks
      - `tags` (text[]) - Categorization tags
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `monitoring_results` - Historical check results
      - `id` (uuid, primary key)
      - `client_id` (uuid, foreign key)
      - `http_status` (jsonb) - HTTP check data
      - `ssl_status` (jsonb) - SSL/TLS check data
      - `dns_status` (jsonb) - DNS check data
      - `issues` (text[]) - Detected issues
      - `checked_at` (timestamptz)
      - `created_at` (timestamptz)
    
    - `smtp_config` - SMTP configuration for alerts
      - `id` (uuid, primary key)
      - `host`, `port`, `smtp_user`, `smtp_pass`, `alert_to` (text)
      - `created_at`, `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Public read access (demo mode)
    - Policies for future auth integration
*/

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  domain text NOT NULL,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create monitoring_results table
CREATE TABLE IF NOT EXISTS monitoring_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  http_status jsonb DEFAULT '{}',
  ssl_status jsonb DEFAULT '{}',
  dns_status jsonb DEFAULT '{}',
  issues text[] DEFAULT '{}',
  checked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create smtp_config table
CREATE TABLE IF NOT EXISTS smtp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host text NOT NULL,
  port integer DEFAULT 587,
  smtp_user text NOT NULL,
  smtp_pass text NOT NULL,
  alert_to text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_clients_domain ON clients(domain);
CREATE INDEX IF NOT EXISTS idx_monitoring_results_client_id ON monitoring_results(client_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_results_checked_at ON monitoring_results(checked_at DESC);

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE smtp_config ENABLE ROW LEVEL SECURITY;

-- Public read access policies (demo mode)
CREATE POLICY "Public can view clients"
  ON clients FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can insert clients"
  ON clients FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update clients"
  ON clients FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete clients"
  ON clients FOR DELETE
  TO public
  USING (true);

CREATE POLICY "Public can view monitoring results"
  ON monitoring_results FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can insert monitoring results"
  ON monitoring_results FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can view smtp config"
  ON smtp_config FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can insert smtp config"
  ON smtp_config FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update smtp config"
  ON smtp_config FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete smtp config"
  ON smtp_config FOR DELETE
  TO public
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_smtp_config_updated_at
  BEFORE UPDATE ON smtp_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();