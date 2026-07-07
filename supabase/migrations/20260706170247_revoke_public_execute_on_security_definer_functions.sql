-- The previous migration revoked EXECUTE from anon and authenticated directly,
-- but both roles inherit EXECUTE via the default PUBLIC grant that PostgreSQL
-- assigns to every new function. Revoking from PUBLIC closes this gap.

-- Revoke the default PUBLIC EXECUTE grant on both SECURITY DEFINER functions.
-- anon and authenticated inherit from PUBLIC, so this stops them from calling
-- either function via /rest/v1/rpc/...
REVOKE ALL ON FUNCTION public.update_self_analyze_cron(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC;

-- Re-grant EXECUTE on update_self_analyze_cron to service_role.
-- The save-bo-schedule edge function calls this via supabase.rpc() with the
-- service_role key; it must retain execute permission.
GRANT EXECUTE ON FUNCTION public.update_self_analyze_cron(text) TO service_role;

-- update_updated_at_column is a trigger function: PostgreSQL fires it internally
-- as the function owner (SECURITY DEFINER). No user EXECUTE grant is needed.
