-- 0005: model registry — versioned adaptive/predictive models with lifecycle + metrics
CREATE TABLE IF NOT EXISTS model_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text NOT NULL,
  action_id   uuid,
  action_name text,
  algorithm   text NOT NULL DEFAULT 'logistic_regression',
  version     integer NOT NULL DEFAULT 1,
  status      text NOT NULL DEFAULT 'shadow' CHECK (status IN ('training','shadow','champion','retired')),
  auc         numeric,        -- offline eval metrics
  lift        numeric,
  samples     integer NOT NULL DEFAULT 0,
  notes       text,
  trained_at  timestamptz,
  promoted_at timestamptz,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS model_versions_idx ON model_versions (tenant_id, action_id, version DESC);
ALTER TABLE model_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS model_versions_tenant_isolation ON model_versions;
CREATE POLICY model_versions_tenant_isolation ON model_versions
  USING (tenant_id = current_setting('app.tenant_id', true));
