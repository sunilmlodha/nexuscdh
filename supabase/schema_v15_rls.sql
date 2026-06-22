-- schema_v15_rls.sql: database-level tenant isolation (RLS)
--
-- Safe to run anytime: the service-role key (used by current server routes)
-- BYPASSES RLS, so this is a no-op for today's behaviour. It ACTIVATES once
-- routes switch to the session-scoped client (lib/db.ts dbFor) — then Postgres
-- itself denies cross-tenant rows for authenticated users, independent of app code.

-- Resolve the current authenticated user's tenant from their email claim.
-- SECURITY DEFINER so it can read user_roles regardless of that table's own RLS.
CREATE OR REPLACE FUNCTION app_current_tenant()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM user_roles
  WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND status <> 'disabled'
  LIMIT 1
$$;

-- Apply a uniform tenant-isolation policy to every tenant-scoped table.
-- Per-table errors (missing table / no tenant_id column) are skipped, not fatal.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'actions','action_categories','action_topics','strategies','strategy_versions',
    'contact_policies','audiences','customer_profiles','decision_log','api_keys',
    'treatments','bundles','journeys','journey_enrollments','campaigns',
    'change_requests','realtime_containers','channel_adapters','deliveries',
    'external_model_configs','config_audit_log','event_triggers','batch_jobs','user_roles'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I FOR ALL TO authenticated '
        'USING (tenant_id = app_current_tenant()) '
        'WITH CHECK (tenant_id = app_current_tenant())', t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO authenticated', t);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'skip %: %', t, SQLERRM;
    END;
  END LOOP;
END $$;

-- Note: older policies named "<table>_tenant_isolation" that match on
-- current_setting('app.tenant_id') are left in place but never match for the
-- authenticated role (that GUC is unset), so the new app_current_tenant() policy
-- is the effective one. Drop the legacy ones later if you want a clean slate.
