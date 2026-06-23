-- 0007: complete tenant-isolation RLS policies (folds in the standalone
-- schema_v15_rls.sql and finishes the tables it missed).
--
-- Many tables had RLS ENABLED but ZERO policies — which is deny-all for the
-- authenticated/session role. Routes currently read via the service-role key
-- (BYPASSRLS), so this changes nothing today; it makes the session-scoped path
-- (lib/db.ts dbFor) actually return correct, tenant-isolated rows when we turn
-- on ENFORCE_AUTH. Fully idempotent — safe to re-run.

-- Resolve the authenticated user's tenant from their email claim.
CREATE OR REPLACE FUNCTION app_current_tenant()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id::text FROM user_roles
  WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND status <> 'disabled'
  LIMIT 1
$$;

-- Every base table in public that has a tenant_id column gets a uniform
-- tenant_isolation policy. Dynamic so no table is ever silently missed.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    JOIN information_schema.columns col
      ON col.table_schema = 'public' AND col.table_name = c.relname AND col.column_name = 'tenant_id'
    WHERE c.relkind = 'r' AND c.relname <> 'schema_migrations'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL TO authenticated '
      'USING (tenant_id::text = app_current_tenant()) '
      'WITH CHECK (tenant_id::text = app_current_tenant())', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO authenticated', t);
  END LOOP;
END $$;

-- tenants has no tenant_id column — isolate on its own id instead.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tenants;
CREATE POLICY tenant_isolation ON tenants FOR ALL TO authenticated
  USING (id::text = app_current_tenant()) WITH CHECK (id::text = app_current_tenant());
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants TO authenticated;
