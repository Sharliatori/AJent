/*
# Fix security definer and search_path on portal helper functions

## Summary
Recreates `is_portal_admin()` and `my_client_id()` as SECURITY INVOKER functions
with a fixed (empty) search_path. Revokes EXECUTE from the `anon` role so they
cannot be called via the public REST API by unauthenticated users.

## Security changes
- Both functions: switched from SECURITY DEFINER to SECURITY INVOKER
- Both functions: SET search_path = '' (immutable, prevents search_path attacks)
- Both functions: REVOKE EXECUTE from anon and public
- Both functions: GRANT EXECUTE only to authenticated (required for RLS policy evaluation)

## Important notes
1. SECURITY INVOKER is safe here because:
   - `is_portal_admin()` only compares auth.uid() to a constant — no table access.
   - `my_client_id()` queries client_users; with INVOKER the caller's RLS applies,
     which correctly scopes to their own row (auth.uid() = auth_user_id).
2. These functions are still callable by authenticated users via RPC, but they only
   return the caller's own data (a boolean or their own client_id) — no privilege escalation.
*/

-- Recreate is_portal_admin with fixed search_path and SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.is_portal_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT auth.uid() = '49fb5dee-75f5-4166-90a6-167292b4d24a'::uuid;
$$;

-- Revoke from public and anon, grant only to authenticated
REVOKE ALL ON FUNCTION public.is_portal_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_portal_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_portal_admin() TO authenticated;

-- Recreate my_client_id with fixed search_path and SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.my_client_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT client_id FROM public.client_users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Revoke from public and anon, grant only to authenticated
REVOKE ALL ON FUNCTION public.my_client_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_client_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_client_id() TO authenticated;
