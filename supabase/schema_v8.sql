-- schema_v8.sql: Enterprise hardening — audit trail, soft delete, identity tracking

-- ─── bundles: missing updated_at ─────────────────────────────────────────────
ALTER TABLE bundles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ─── created_by / updated_by on all three tables ─────────────────────────────
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS updated_by text;
ALTER TABLE bundles    ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE bundles    ADD COLUMN IF NOT EXISTS updated_by text;
ALTER TABLE journeys   ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE journeys   ADD COLUMN IF NOT EXISTS updated_by text;

-- ─── Soft delete ─────────────────────────────────────────────────────────────
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE bundles    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE journeys   ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ─── Partial indexes: fast filtered queries on live rows ─────────────────────
CREATE INDEX IF NOT EXISTS treatments_live_idx ON treatments (tenant_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS bundles_live_idx ON bundles (tenant_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS journeys_live_idx ON journeys (tenant_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ─── RLS: exclude soft-deleted rows ──────────────────────────────────────────
DROP POLICY IF EXISTS "treatments_tenant_isolation" ON treatments;
CREATE POLICY "treatments_tenant_isolation" ON treatments
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "bundles_tenant_isolation" ON bundles;
CREATE POLICY "bundles_tenant_isolation" ON bundles
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "journeys_tenant_isolation" ON journeys;
CREATE POLICY "journeys_tenant_isolation" ON journeys
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    AND deleted_at IS NULL
  );

-- ─── config_audit_log: ensure entity index covers new entity types ────────────
-- (index already created in schema_v5.sql; this is a no-op if it exists)
CREATE INDEX IF NOT EXISTS config_audit_log_entity_type_id
  ON config_audit_log (tenant_id, entity_type, entity_id, created_at DESC);
