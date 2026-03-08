/*
  # Allow anonymous CRUD operations on clients and smtp_config

  Since there is no authentication system yet, the frontend uses the anon key.
  The previous migration locked down INSERT/UPDATE/DELETE to service_role only,
  which prevents the frontend from adding, editing, or removing clients.

  1. Changes
    - Add INSERT policy for anon on clients table
    - Add UPDATE policy for anon on clients table
    - Add DELETE policy for anon on clients table
    - Add INSERT policy for anon on smtp_config table
    - Add UPDATE policy for anon on smtp_config table
    - Add DELETE policy for anon on smtp_config table
    - Add DELETE policy for anon on monitoring_results (cleanup)

  2. Security Notes
    - These policies are temporary for demo/pre-auth mode
    - Once authentication is added, these should be replaced
      with user-scoped policies using auth.uid()
*/

CREATE POLICY "Anon users can insert clients"
  ON clients
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can update clients"
  ON clients
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon users can delete clients"
  ON clients
  FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Anon users can insert monitoring results"
  ON monitoring_results
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can delete monitoring results"
  ON monitoring_results
  FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Anon users can view smtp config"
  ON smtp_config
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon users can insert smtp config"
  ON smtp_config
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can update smtp config"
  ON smtp_config
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon users can delete smtp config"
  ON smtp_config
  FOR DELETE
  TO anon
  USING (true);
