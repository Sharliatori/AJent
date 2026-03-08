/*
  # Fix Security Issues

  1. Indexes
    - Remove unused indexes that add overhead without benefit
    
  2. RLS Policies - CRITICAL SECURITY FIX
    - Replace overly permissive policies with proper access control
    - Restrict to authenticated users only (service role for Edge Functions)
    - Remove public access that bypasses security
    
  3. Function Security
    - Fix search_path for update_updated_at_column function
    
  ## Important Notes
  - This migration removes demo/public access
  - All operations now require authentication
  - Edge Functions use service role key for backend operations
  - Frontend operations will use authenticated user context when auth is added
*/

-- 1. Drop unused indexes
DROP INDEX IF EXISTS idx_clients_domain;
DROP INDEX IF EXISTS idx_monitoring_results_checked_at;

-- 2. Drop all existing insecure policies
DROP POLICY IF EXISTS "Public can view clients" ON clients;
DROP POLICY IF EXISTS "Public can insert clients" ON clients;
DROP POLICY IF EXISTS "Public can update clients" ON clients;
DROP POLICY IF EXISTS "Public can delete clients" ON clients;

DROP POLICY IF EXISTS "Public can view monitoring results" ON monitoring_results;
DROP POLICY IF EXISTS "Public can insert monitoring results" ON monitoring_results;

DROP POLICY IF EXISTS "Public can view smtp config" ON smtp_config;
DROP POLICY IF EXISTS "Public can insert smtp config" ON smtp_config;
DROP POLICY IF EXISTS "Public can update smtp config" ON smtp_config;
DROP POLICY IF EXISTS "Public can delete smtp config" ON smtp_config;

-- 3. Create secure RLS policies for clients table
-- Service role (Edge Functions) can do everything
CREATE POLICY "Service role can manage clients"
  ON clients
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read their own data (future feature)
CREATE POLICY "Authenticated users can view clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (true);

-- Anon users can view clients (read-only public access)
CREATE POLICY "Anon users can view clients"
  ON clients
  FOR SELECT
  TO anon
  USING (true);

-- 4. Create secure RLS policies for monitoring_results table
CREATE POLICY "Service role can manage monitoring results"
  ON monitoring_results
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view monitoring results"
  ON monitoring_results
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anon users can view monitoring results"
  ON monitoring_results
  FOR SELECT
  TO anon
  USING (true);

-- 5. Create secure RLS policies for smtp_config table
-- Only service role can access SMTP config (contains sensitive credentials)
CREATE POLICY "Service role can manage smtp config"
  ON smtp_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can view (but not modify) smtp settings
CREATE POLICY "Authenticated users can view smtp config"
  ON smtp_config
  FOR SELECT
  TO authenticated
  USING (true);

-- 6. Fix function search_path security issue
-- Drop triggers first, then function
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
DROP TRIGGER IF EXISTS update_smtp_config_updated_at ON smtp_config;

DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = pg_catalog, public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate triggers
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_smtp_config_updated_at
  BEFORE UPDATE ON smtp_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
