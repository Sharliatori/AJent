/*
# Report Recipients and Alert Debounce

## Purpose
Adds a multi-recipient email system and an anti-spam mechanism for alerts.

## Changes

### New Tables
- report_recipients
  - id (uuid, primary key)
  - client_id (uuid, FK to clients ON DELETE CASCADE, nullable): NULL = global recipient for all sites
  - email (text, NOT NULL): recipient email address
  - name (text, nullable): contact display name
  - role (text, default owner): owner, technical, or billing
  - receive_alerts (boolean, default true): receives instant issue alerts
  - receive_reports (boolean, default true): receives periodic monitoring reports
  - created_at (timestamptz)

### Modified Tables
- clients: new nullable column last_alert_sent_at (timestamptz)
  Used by check-site edge function to prevent duplicate alerts within 24h.

### Security
- RLS enabled on report_recipients
- SELECT/INSERT/UPDATE/DELETE policies open to anon + authenticated (no-auth app pattern)

### Notes
1. client_id = NULL means the recipient receives reports for ALL monitored sites.
2. last_alert_sent_at on clients is updated by the send-alert edge function after each alert.
3. The 24h debounce is enforced server-side in the check-site function.
*/

-- Add last_alert_sent_at to clients for alert debounce
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'last_alert_sent_at'
  ) THEN
    ALTER TABLE clients ADD COLUMN last_alert_sent_at timestamptz;
  END IF;
END $$;

-- Create report_recipients table
CREATE TABLE IF NOT EXISTS report_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  role text NOT NULL DEFAULT 'owner',
  receive_alerts boolean NOT NULL DEFAULT true,
  receive_reports boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_recipients_client_id ON report_recipients(client_id);
CREATE INDEX IF NOT EXISTS idx_report_recipients_email ON report_recipients(email);

ALTER TABLE report_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_report_recipients" ON report_recipients;
CREATE POLICY "anon_select_report_recipients" ON report_recipients FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_report_recipients" ON report_recipients;
CREATE POLICY "anon_insert_report_recipients" ON report_recipients FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_report_recipients" ON report_recipients;
CREATE POLICY "anon_update_report_recipients" ON report_recipients FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_report_recipients" ON report_recipients;
CREATE POLICY "anon_delete_report_recipients" ON report_recipients FOR DELETE
  TO anon, authenticated USING (true);
