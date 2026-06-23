-- 0004: consent ledger + data-subject request log (compliance)

-- Append-only consent records (grant/withdraw) per customer + purpose/channel.
CREATE TABLE IF NOT EXISTS consent_records (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text NOT NULL,
  customer_id text NOT NULL,
  purpose     text NOT NULL DEFAULT 'marketing',   -- marketing | profiling | email | sms | ...
  granted     boolean NOT NULL,
  source      text,                                  -- preference_centre | import | api | agent
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consent_records_customer_idx ON consent_records (tenant_id, customer_id, created_at DESC);
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS consent_records_tenant_isolation ON consent_records;
CREATE POLICY consent_records_tenant_isolation ON consent_records
  USING (tenant_id = current_setting('app.tenant_id', true));

-- Data-subject access/erasure request log (DSAR audit trail).
CREATE TABLE IF NOT EXISTS dsar_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text NOT NULL,
  customer_id text NOT NULL,
  type        text NOT NULL CHECK (type IN ('export','erasure')),
  status      text NOT NULL DEFAULT 'completed' CHECK (status IN ('received','completed','failed')),
  requested_by text,
  detail      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dsar_requests_idx ON dsar_requests (tenant_id, created_at DESC);
ALTER TABLE dsar_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dsar_requests_tenant_isolation ON dsar_requests;
CREATE POLICY dsar_requests_tenant_isolation ON dsar_requests
  USING (tenant_id = current_setting('app.tenant_id', true));

-- Retention window (days) on the entitlements row; 0 = keep indefinitely.
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS retention_days integer NOT NULL DEFAULT 0;
