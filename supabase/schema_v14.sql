-- schema_v14.sql: RBAC for SSO — maps an authenticated email to an app role

CREATE TABLE IF NOT EXISTS user_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text NOT NULL,
  email       text NOT NULL,
  name        text,
  role        text NOT NULL DEFAULT 'read_only'
              CHECK (role IN ('super_admin','tenant_admin','strategy_manager','campaign_analyst','channel_manager','data_scientist','ops_manager','read_only')),
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  last_login  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_email_idx ON user_roles (tenant_id, lower(email));
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_roles_tenant_isolation" ON user_roles;
CREATE POLICY "user_roles_tenant_isolation" ON user_roles
  USING (tenant_id = current_setting('app.tenant_id', true));

-- Seed: make the first known admin email a tenant_admin so you're not locked out.
-- Replace with your own SSO email, or promote yourself via the Users page after first sign-in.
INSERT INTO user_roles (tenant_id, email, name, role)
VALUES ('f0000000-0000-4000-a000-000000000001', 'slodha@wearedcs.com', 'Admin', 'tenant_admin')
ON CONFLICT (tenant_id, lower(email)) DO NOTHING;
