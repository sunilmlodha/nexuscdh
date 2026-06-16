-- schema_v4.sql
-- Run this in the Supabase SQL editor to enable simulation audit logging.

CREATE TABLE IF NOT EXISTS simulation_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  strategy_id   uuid,
  strategy_name text,
  population_size integer,
  source        text DEFAULT 'synthetic',
  served        integer,
  suppressed    integer,
  no_match      integer,
  serve_pct     numeric,
  projected_revenue numeric,
  latency_ms    integer,
  seed_attributes   jsonb DEFAULT '{}',
  results_snapshot  jsonb DEFAULT '{}',
  customer_trace    jsonb DEFAULT '[]',
  created_at    timestamptz DEFAULT now(),
  created_by    text DEFAULT 'system'
);

-- Index for tenant + recent runs lookup
CREATE INDEX IF NOT EXISTS simulation_runs_tenant_created
  ON simulation_runs (tenant_id, created_at DESC);
