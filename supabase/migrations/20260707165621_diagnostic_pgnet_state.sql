-- Diagnostic: check pg_net extension state
DO $$
DECLARE
  v_ext_schema text;
  v_net_owned bool;
BEGIN
  SELECT n.nspname INTO v_ext_schema
  FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_net';

  SELECT EXISTS(
    SELECT 1 FROM pg_namespace n
    JOIN pg_depend d ON d.objid = n.oid AND d.deptype = 'e'
    JOIN pg_extension e ON e.oid = d.refobjid AND e.extname = 'pg_net'
  ) INTO v_net_owned;

  RAISE NOTICE 'pg_net ext_namespace=% net_schema_owned_by_extension=%', v_ext_schema, v_net_owned;
END;
$$;
