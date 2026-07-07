-- The security scanner flags pg_net because pg_extension.extnamespace = public.
-- ALTER EXTENSION pg_net SET SCHEMA is blocked by PostgreSQL because pg_net owns
-- the net schema as a member object.
--
-- Solution: drop and recreate the extension registered under a non-public schema.
-- pg_net always creates its objects in the hardcoded 'net' schema regardless of
-- the SCHEMA clause, so net.http_post() survives and all pg_cron jobs continue
-- to work. The DROP CASCADE only removes the transient net._http_response data.

CREATE SCHEMA IF NOT EXISTS extensions;

DROP EXTENSION IF EXISTS pg_net CASCADE;
CREATE EXTENSION pg_net SCHEMA extensions;
