-- 0006: identity resolution — map many identifiers to one canonical customer
CREATE TABLE IF NOT EXISTS identity_aliases (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text NOT NULL,
  customer_id text NOT NULL,                 -- canonical profile id
  alias_type  text NOT NULL DEFAULT 'email', -- email | phone | device | external | cookie
  alias_value text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS identity_aliases_unique ON identity_aliases (tenant_id, alias_type, lower(alias_value));
CREATE INDEX IF NOT EXISTS identity_aliases_customer_idx ON identity_aliases (tenant_id, customer_id);
ALTER TABLE identity_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS identity_aliases_tenant_isolation ON identity_aliases;
CREATE POLICY identity_aliases_tenant_isolation ON identity_aliases
  USING (tenant_id = current_setting('app.tenant_id', true));
