/*
# Tighten RLS policies on client portal tables

## Summary
Replaces all overly-permissive "always true" RLS policies with proper ownership
and role-based checks. Introduces a helper function `public.is_portal_admin()`
that returns true only for the designated admin user (nicolas.sinou@lutecia.ai).

## Security model
- **Admin user** (auth.uid() = '49fb5dee-75f5-4166-90a6-167292b4d24a'): full CRUD on all portal tables.
- **Portal client users** (authenticated, non-admin): can SELECT rows belonging to their own client_id (looked up via client_users). Can INSERT/UPDATE their own client_requests and client_request_replies. Cannot modify improvement_axes, interventions, payments, site_components, or client_users.
- **Anonymous (anon)**: no access to any of these tables.

## Changes per table
- `client_users`: Remove anon write policies. Admin-only INSERT/UPDATE/DELETE. Authenticated SELECT own row only.
- `improvement_axes`: Remove anon/authenticated unrestricted write. Admin-only INSERT/UPDATE/DELETE. Authenticated SELECT scoped to own client.
- `client_requests`: Remove anon UPDATE. Admin can UPDATE all. Authenticated users SELECT/INSERT/UPDATE only their own rows.
- `client_request_replies`: Remove anon INSERT. Admin can INSERT (as admin role). Authenticated users INSERT only on their own requests.
- `interventions`: Remove anon/authenticated unrestricted write. Admin-only INSERT/UPDATE/DELETE. Authenticated SELECT scoped to own client.
- `payments`: Remove anon/authenticated unrestricted write. Admin-only INSERT/UPDATE/DELETE. Authenticated SELECT scoped to own client.
- `site_components`: Remove anon/authenticated unrestricted write. Admin-only INSERT/UPDATE/DELETE. Authenticated SELECT scoped to own client.

## Important notes
1. The admin user ID is hardcoded: 49fb5dee-75f5-4166-90a6-167292b4d24a
2. The `is_portal_admin()` function is SECURITY DEFINER with restricted execution.
3. All anon write policies are dropped — anonymous users cannot modify portal data.
4. SELECT policies for non-admin users use a subquery through client_users to scope by client_id.
*/

-- Helper function: checks if current user is the portal admin
CREATE OR REPLACE FUNCTION public.is_portal_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT auth.uid() = '49fb5dee-75f5-4166-90a6-167292b4d24a'::uuid;
$$;

REVOKE ALL ON FUNCTION public.is_portal_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_portal_admin() TO authenticated;

-- Helper function: returns the client_id for the current authenticated user
CREATE OR REPLACE FUNCTION public.my_client_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT client_id FROM public.client_users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.my_client_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_client_id() TO authenticated;

-- ============================================================
-- Table: client_users
-- ============================================================

-- Drop old permissive policies
DROP POLICY IF EXISTS "anon_select_client_users" ON client_users;
DROP POLICY IF EXISTS "anon_insert_client_users" ON client_users;
DROP POLICY IF EXISTS "anon_update_client_users" ON client_users;
DROP POLICY IF EXISTS "anon_delete_client_users" ON client_users;
DROP POLICY IF EXISTS "auth_select_own_client_user" ON client_users;

-- New policies
CREATE POLICY "auth_select_own_client_user" ON client_users FOR SELECT
  TO authenticated USING (auth.uid() = auth_user_id OR public.is_portal_admin());

CREATE POLICY "admin_insert_client_users" ON client_users FOR INSERT
  TO authenticated WITH CHECK (public.is_portal_admin());

CREATE POLICY "admin_update_client_users" ON client_users FOR UPDATE
  TO authenticated USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

CREATE POLICY "admin_delete_client_users" ON client_users FOR DELETE
  TO authenticated USING (public.is_portal_admin());

-- ============================================================
-- Table: improvement_axes
-- ============================================================

DROP POLICY IF EXISTS "select_improvement_axes" ON improvement_axes;
DROP POLICY IF EXISTS "insert_improvement_axes" ON improvement_axes;
DROP POLICY IF EXISTS "update_improvement_axes" ON improvement_axes;
DROP POLICY IF EXISTS "delete_improvement_axes" ON improvement_axes;

CREATE POLICY "select_improvement_axes" ON improvement_axes FOR SELECT
  TO authenticated USING (public.is_portal_admin() OR client_id = public.my_client_id());

CREATE POLICY "admin_insert_improvement_axes" ON improvement_axes FOR INSERT
  TO authenticated WITH CHECK (public.is_portal_admin());

CREATE POLICY "admin_update_improvement_axes" ON improvement_axes FOR UPDATE
  TO authenticated USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

CREATE POLICY "admin_delete_improvement_axes" ON improvement_axes FOR DELETE
  TO authenticated USING (public.is_portal_admin());

-- ============================================================
-- Table: client_requests
-- ============================================================

DROP POLICY IF EXISTS "auth_select_own_requests" ON client_requests;
DROP POLICY IF EXISTS "auth_insert_own_requests" ON client_requests;
DROP POLICY IF EXISTS "auth_update_own_requests" ON client_requests;
DROP POLICY IF EXISTS "anon_select_client_requests" ON client_requests;
DROP POLICY IF EXISTS "anon_update_client_requests" ON client_requests;

CREATE POLICY "select_client_requests" ON client_requests FOR SELECT
  TO authenticated USING (public.is_portal_admin() OR auth.uid() = auth_user_id);

CREATE POLICY "insert_own_client_requests" ON client_requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "update_client_requests" ON client_requests FOR UPDATE
  TO authenticated
  USING (public.is_portal_admin() OR auth.uid() = auth_user_id)
  WITH CHECK (public.is_portal_admin() OR auth.uid() = auth_user_id);

CREATE POLICY "admin_delete_client_requests" ON client_requests FOR DELETE
  TO authenticated USING (public.is_portal_admin());

-- ============================================================
-- Table: client_request_replies
-- ============================================================

DROP POLICY IF EXISTS "auth_select_own_replies" ON client_request_replies;
DROP POLICY IF EXISTS "auth_insert_replies" ON client_request_replies;
DROP POLICY IF EXISTS "anon_select_replies" ON client_request_replies;
DROP POLICY IF EXISTS "anon_insert_replies" ON client_request_replies;

CREATE POLICY "select_client_request_replies" ON client_request_replies FOR SELECT
  TO authenticated USING (
    public.is_portal_admin() OR
    EXISTS (SELECT 1 FROM client_requests WHERE client_requests.id = client_request_replies.request_id AND client_requests.auth_user_id = auth.uid())
  );

CREATE POLICY "insert_client_request_replies" ON client_request_replies FOR INSERT
  TO authenticated WITH CHECK (
    public.is_portal_admin() OR
    EXISTS (SELECT 1 FROM client_requests WHERE client_requests.id = client_request_replies.request_id AND client_requests.auth_user_id = auth.uid())
  );

CREATE POLICY "admin_update_client_request_replies" ON client_request_replies FOR UPDATE
  TO authenticated USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

CREATE POLICY "admin_delete_client_request_replies" ON client_request_replies FOR DELETE
  TO authenticated USING (public.is_portal_admin());

-- ============================================================
-- Table: interventions
-- ============================================================

DROP POLICY IF EXISTS "select_interventions" ON interventions;
DROP POLICY IF EXISTS "insert_interventions" ON interventions;
DROP POLICY IF EXISTS "update_interventions" ON interventions;
DROP POLICY IF EXISTS "delete_interventions" ON interventions;

CREATE POLICY "select_interventions" ON interventions FOR SELECT
  TO authenticated USING (public.is_portal_admin() OR client_id = public.my_client_id());

CREATE POLICY "admin_insert_interventions" ON interventions FOR INSERT
  TO authenticated WITH CHECK (public.is_portal_admin());

CREATE POLICY "admin_update_interventions" ON interventions FOR UPDATE
  TO authenticated USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

CREATE POLICY "admin_delete_interventions" ON interventions FOR DELETE
  TO authenticated USING (public.is_portal_admin());

-- ============================================================
-- Table: payments
-- ============================================================

DROP POLICY IF EXISTS "select_payments" ON payments;
DROP POLICY IF EXISTS "insert_payments" ON payments;
DROP POLICY IF EXISTS "update_payments" ON payments;
DROP POLICY IF EXISTS "delete_payments" ON payments;

CREATE POLICY "select_payments" ON payments FOR SELECT
  TO authenticated USING (public.is_portal_admin() OR client_id = public.my_client_id());

CREATE POLICY "admin_insert_payments" ON payments FOR INSERT
  TO authenticated WITH CHECK (public.is_portal_admin());

CREATE POLICY "admin_update_payments" ON payments FOR UPDATE
  TO authenticated USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

CREATE POLICY "admin_delete_payments" ON payments FOR DELETE
  TO authenticated USING (public.is_portal_admin());

-- ============================================================
-- Table: site_components
-- ============================================================

DROP POLICY IF EXISTS "select_site_components" ON site_components;
DROP POLICY IF EXISTS "insert_site_components" ON site_components;
DROP POLICY IF EXISTS "update_site_components" ON site_components;
DROP POLICY IF EXISTS "delete_site_components" ON site_components;

CREATE POLICY "select_site_components" ON site_components FOR SELECT
  TO authenticated USING (public.is_portal_admin() OR client_id = public.my_client_id());

CREATE POLICY "admin_insert_site_components" ON site_components FOR INSERT
  TO authenticated WITH CHECK (public.is_portal_admin());

CREATE POLICY "admin_update_site_components" ON site_components FOR UPDATE
  TO authenticated USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

CREATE POLICY "admin_delete_site_components" ON site_components FOR DELETE
  TO authenticated USING (public.is_portal_admin());
