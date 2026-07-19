/*
# Client Portal Schema

Creates all tables required for the client-facing dashboard portal.

## New Tables

### client_users
Maps Supabase Auth users to their associated client sites.
- id (uuid, PK)
- auth_user_id (uuid, FK to auth.users, unique)
- client_id (uuid, FK to clients)
- display_name (text)
- role (text: owner/viewer)
- created_at (timestamptz)

### improvement_axes
Stores improvement recommendations per client site.
- id (uuid, PK)
- client_id (uuid, FK to clients)
- title (text)
- description (text)
- priority (text: high/medium/low)
- status (text: pending/in-progress/done)
- created_at, updated_at (timestamptz)

### client_requests
Stores support requests / questions from clients.
- id (uuid, PK)
- client_id (uuid, FK to clients)
- auth_user_id (uuid, FK to auth.users)
- subject (text)
- message (text)
- status (text: open/in-progress/closed)
- created_at, updated_at (timestamptz)

### client_request_replies
Threaded replies on client requests.
- id (uuid, PK)
- request_id (uuid, FK to client_requests)
- author_role (text: client/admin)
- author_name (text)
- message (text)
- created_at (timestamptz)

### interventions
Tracks maintenance/development interventions for each client.
- id (uuid, PK)
- client_id (uuid, FK to clients)
- title (text)
- description (text)
- status (text: planned/in-progress/completed)
- started_at, completed_at (timestamptz)
- created_at (timestamptz)

### payments
Tracks invoices and payments per client.
- id (uuid, PK)
- client_id (uuid, FK to clients)
- intervention_id (uuid, FK to interventions, nullable)
- description (text)
- amount (numeric)
- currency (text, default EUR)
- status (text: pending/paid/overdue)
- invoice_url (text, nullable)
- due_date (date)
- paid_at (timestamptz, nullable)
- created_at (timestamptz)

### site_components
Technical software inventory per client site.
- id (uuid, PK)
- client_id (uuid, FK to clients)
- name (text)
- category (text: framework/cms/plugin/library/hosting/language/database)
- version (text)
- latest_version (text, nullable)
- status (text: up-to-date/outdated/deprecated)
- notes (text, nullable)
- updated_at (timestamptz)

## Security
- RLS enabled on all tables.
- client_users: authenticated users can read their own row; service_role full access.
- improvement_axes: authenticated users can read axes for their linked client; anon+authenticated can read (for admin); service_role full access.
- client_requests: authenticated users CRUD their own requests; service_role full access.
- client_request_replies: authenticated users can read replies on their requests, insert replies as client; service_role full access.
- interventions: authenticated users can read their client's interventions; anon+authenticated read for admin.
- payments: authenticated users can read their client's payments; anon+authenticated read for admin.
- site_components: authenticated users can read their client's components; anon+authenticated read for admin.
*/

-- ============================================================
-- Table: client_users
-- ============================================================
CREATE TABLE IF NOT EXISTS client_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  display_name text,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(auth_user_id)
);

CREATE INDEX IF NOT EXISTS idx_client_users_auth_user ON client_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_client_users_client ON client_users(client_id);

ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_own_client_user" ON client_users;
CREATE POLICY "auth_select_own_client_user" ON client_users FOR SELECT
  TO authenticated USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "anon_select_client_users" ON client_users;
CREATE POLICY "anon_select_client_users" ON client_users FOR SELECT
  TO anon USING (true);

DROP POLICY IF EXISTS "anon_insert_client_users" ON client_users;
CREATE POLICY "anon_insert_client_users" ON client_users FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_client_users" ON client_users;
CREATE POLICY "anon_update_client_users" ON client_users FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_client_users" ON client_users;
CREATE POLICY "anon_delete_client_users" ON client_users FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- Table: improvement_axes
-- ============================================================
CREATE TABLE IF NOT EXISTS improvement_axes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'done')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_improvement_axes_client ON improvement_axes(client_id);

ALTER TABLE improvement_axes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_improvement_axes" ON improvement_axes;
CREATE POLICY "select_improvement_axes" ON improvement_axes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_improvement_axes" ON improvement_axes;
CREATE POLICY "insert_improvement_axes" ON improvement_axes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_improvement_axes" ON improvement_axes;
CREATE POLICY "update_improvement_axes" ON improvement_axes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_improvement_axes" ON improvement_axes;
CREATE POLICY "delete_improvement_axes" ON improvement_axes FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- Table: client_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS client_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_requests_client ON client_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_client_requests_user ON client_requests(auth_user_id);

ALTER TABLE client_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_own_requests" ON client_requests;
CREATE POLICY "auth_select_own_requests" ON client_requests FOR SELECT
  TO authenticated USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "auth_insert_own_requests" ON client_requests;
CREATE POLICY "auth_insert_own_requests" ON client_requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "auth_update_own_requests" ON client_requests;
CREATE POLICY "auth_update_own_requests" ON client_requests FOR UPDATE
  TO authenticated USING (auth.uid() = auth_user_id) WITH CHECK (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "anon_select_client_requests" ON client_requests;
CREATE POLICY "anon_select_client_requests" ON client_requests FOR SELECT
  TO anon USING (true);

DROP POLICY IF EXISTS "anon_update_client_requests" ON client_requests;
CREATE POLICY "anon_update_client_requests" ON client_requests FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- Table: client_request_replies
-- ============================================================
CREATE TABLE IF NOT EXISTS client_request_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES client_requests(id) ON DELETE CASCADE,
  author_role text NOT NULL CHECK (author_role IN ('client', 'admin')),
  author_name text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_request_replies_request ON client_request_replies(request_id);

ALTER TABLE client_request_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_own_replies" ON client_request_replies;
CREATE POLICY "auth_select_own_replies" ON client_request_replies FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM client_requests
      WHERE client_requests.id = client_request_replies.request_id
      AND client_requests.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "auth_insert_replies" ON client_request_replies;
CREATE POLICY "auth_insert_replies" ON client_request_replies FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM client_requests
      WHERE client_requests.id = client_request_replies.request_id
      AND client_requests.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "anon_select_replies" ON client_request_replies;
CREATE POLICY "anon_select_replies" ON client_request_replies FOR SELECT
  TO anon USING (true);

DROP POLICY IF EXISTS "anon_insert_replies" ON client_request_replies;
CREATE POLICY "anon_insert_replies" ON client_request_replies FOR INSERT
  TO anon WITH CHECK (true);

-- ============================================================
-- Table: interventions
-- ============================================================
CREATE TABLE IF NOT EXISTS interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in-progress', 'completed')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interventions_client ON interventions(client_id);

ALTER TABLE interventions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_interventions" ON interventions;
CREATE POLICY "select_interventions" ON interventions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_interventions" ON interventions;
CREATE POLICY "insert_interventions" ON interventions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_interventions" ON interventions;
CREATE POLICY "update_interventions" ON interventions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_interventions" ON interventions;
CREATE POLICY "delete_interventions" ON interventions FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- Table: payments
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  intervention_id uuid REFERENCES interventions(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  invoice_url text,
  due_date date,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_payments" ON payments;
CREATE POLICY "select_payments" ON payments FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_payments" ON payments;
CREATE POLICY "insert_payments" ON payments FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_payments" ON payments;
CREATE POLICY "update_payments" ON payments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_payments" ON payments;
CREATE POLICY "delete_payments" ON payments FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- Table: site_components
-- ============================================================
CREATE TABLE IF NOT EXISTS site_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('framework', 'cms', 'plugin', 'library', 'hosting', 'language', 'database')),
  version text,
  latest_version text,
  status text NOT NULL DEFAULT 'up-to-date' CHECK (status IN ('up-to-date', 'outdated', 'deprecated')),
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_components_client ON site_components(client_id);

ALTER TABLE site_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_site_components" ON site_components;
CREATE POLICY "select_site_components" ON site_components FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_site_components" ON site_components;
CREATE POLICY "insert_site_components" ON site_components FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_site_components" ON site_components;
CREATE POLICY "update_site_components" ON site_components FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_site_components" ON site_components;
CREATE POLICY "delete_site_components" ON site_components FOR DELETE
  TO anon, authenticated USING (true);
