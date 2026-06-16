-- schema_v6.sql
-- Run in Supabase SQL editor.
-- Adds external_model_configs table for Google Vertex AI, AWS SageMaker,
-- H2O.ai, Azure ML, Databricks MLflow, and custom HTTP endpoint configs.

CREATE TABLE IF NOT EXISTS external_model_configs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     text NOT NULL,
  name          text NOT NULL,
  description   text DEFAULT '',
  provider      text NOT NULL,       -- vertex_ai | sagemaker | h2o | azure_ml | databricks | custom
  endpoint_url  text DEFAULT '',     -- scoring endpoint URL
  api_key       text DEFAULT '',     -- API key / token (store encrypted in prod)
  model_id      text DEFAULT '',     -- provider-side model name/ID/ARN
  region        text DEFAULT '',     -- AWS region, GCP region, etc.
  project_id    text DEFAULT '',     -- GCP project, Azure subscription, etc.
  feature_map   jsonb DEFAULT '{}',  -- maps NexusCDH fields -> provider field names
  output_field  text DEFAULT 'score', -- field name in provider response to use as propensity
  status        text DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'testing')),
  action_id     uuid REFERENCES actions(id) ON DELETE SET NULL,
  last_tested_at  timestamptz,
  last_test_result jsonb DEFAULT NULL,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE external_model_configs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_external_models_tenant ON external_model_configs(tenant_id, status);
