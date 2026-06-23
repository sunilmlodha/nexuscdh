-- 0003: platform foundations — feature flags + plan entitlements

-- Controlled rollout: per-tenant feature flags with optional % rollout.
CREATE TABLE IF NOT EXISTS feature_flags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text NOT NULL,
  key         text NOT NULL,
  label       text,
  description text,
  enabled     boolean NOT NULL DEFAULT false,
  rollout_pct numeric NOT NULL DEFAULT 1.0,   -- 0..1; when enabled, fraction of customers it applies to
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_key_idx ON feature_flags (tenant_id, key);
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS feature_flags_tenant_isolation ON feature_flags;
CREATE POLICY feature_flags_tenant_isolation ON feature_flags
  USING (tenant_id = current_setting('app.tenant_id', true));

-- Billing/metering: one entitlement row per tenant (plan + limits).
CREATE TABLE IF NOT EXISTS entitlements (
  tenant_id        text PRIMARY KEY,
  plan             text NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial','starter','growth','enterprise')),
  decision_limit   integer NOT NULL DEFAULT 10000,   -- per calendar month
  seat_limit       integer NOT NULL DEFAULT 5,
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS entitlements_tenant_isolation ON entitlements;
CREATE POLICY entitlements_tenant_isolation ON entitlements
  USING (tenant_id = current_setting('app.tenant_id', true));

INSERT INTO entitlements (tenant_id, plan, decision_limit, seat_limit)
VALUES ('f0000000-0000-4000-a000-000000000001', 'growth', 100000, 25)
ON CONFLICT (tenant_id) DO NOTHING;
