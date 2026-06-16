-- schema_v5.sql
-- Run in Supabase SQL editor.
-- Adds model_config JSONB to adaptive_models for per-algorithm state
-- (Bayesian alpha/beta, Gradient Boosting momentum, etc.)

ALTER TABLE adaptive_models
  ADD COLUMN IF NOT EXISTS model_config jsonb DEFAULT '{}';

-- Index on config_audit for adaptive_feedback lookups
CREATE INDEX IF NOT EXISTS config_audit_entity_type_id
  ON config_audit (tenant_id, entity_type, entity_id, created_at DESC);
