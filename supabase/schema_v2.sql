-- NexusCDH Schema v2 — additive migrations.
-- Run AFTER schema.sql in Supabase SQL Editor.

-- ── 1. Customer Profiles ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id text NOT NULL,
  customer_id text NOT NULL,
  attributes jsonb NOT NULL DEFAULT '{}',
  segments text[] DEFAULT '{}',
  interaction_count integer DEFAULT 0,
  last_seen_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, customer_id)
);
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_customer_profiles_lookup ON customer_profiles(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_last_seen ON customer_profiles(tenant_id, last_seen_at DESC);

-- ── 2. API Keys ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id text NOT NULL,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  created_by text,
  last_used_at timestamptz,
  status text DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_api_keys_lookup ON api_keys(tenant_id, key_prefix, status);

-- ── 3. Strategy Versions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS strategy_versions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id text NOT NULL,
  strategy_id uuid NOT NULL,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  changed_by text,
  change_summary text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE strategy_versions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_strategy_versions_lookup ON strategy_versions(strategy_id, version DESC);

-- ── 4. Experiments (Champion / Challenger) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS experiments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id text NOT NULL,
  name text NOT NULL,
  description text,
  status text DEFAULT 'draft' CHECK (status IN ('draft','running','paused','completed')),
  variants jsonb NOT NULL DEFAULT '[]',
  traffic_split jsonb NOT NULL DEFAULT '{}',
  winner_strategy_id uuid,
  start_date timestamptz,
  end_date timestamptz,
  auto_promote boolean DEFAULT false,
  promotion_threshold numeric DEFAULT 0.95,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_experiments_tenant_status ON experiments(tenant_id, status);

-- ── 5. Batch Jobs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS batch_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id text NOT NULL,
  name text NOT NULL,
  strategy_ids uuid[] DEFAULT '{}',
  channel_id text,
  audience_id uuid,
  schedule_cron text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  run_at timestamptz,
  completed_at timestamptz,
  total_customers integer DEFAULT 0,
  served_count integer DEFAULT 0,
  suppressed_count integer DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE batch_jobs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_batch_jobs_tenant ON batch_jobs(tenant_id, created_at DESC);

-- ── 6. Config Audit Log ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS config_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  entity_name text,
  action text NOT NULL CHECK (action IN ('created','updated','deleted','activated','paused','promoted')),
  changed_by text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE config_audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_config_audit_tenant ON config_audit_log(tenant_id, created_at DESC);

-- ── 7. Event Triggers ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_triggers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id text NOT NULL,
  name text NOT NULL,
  event_type text NOT NULL,
  event_conditions jsonb DEFAULT '{}',
  strategy_ids uuid[] DEFAULT '{}',
  channel_ids text[] DEFAULT '{}',
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE event_triggers ENABLE ROW LEVEL SECURITY;

-- ── 8. Helper: upsert customer profile ───────────────────────────────────────
CREATE OR REPLACE FUNCTION upsert_customer_profile(
  p_tenant_id text,
  p_customer_id text,
  p_attributes jsonb
) RETURNS void AS $$
BEGIN
  INSERT INTO customer_profiles(tenant_id, customer_id, attributes, last_seen_at, interaction_count)
  VALUES (p_tenant_id, p_customer_id, p_attributes, now(), 1)
  ON CONFLICT (tenant_id, customer_id)
  DO UPDATE SET
    attributes = customer_profiles.attributes || p_attributes,
    last_seen_at = now(),
    interaction_count = customer_profiles.interaction_count + 1,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- ── 9. Optional: add latency column to decision_log ──────────────────────────
ALTER TABLE decision_log ADD COLUMN IF NOT EXISTS decision_latency_ms integer;
ALTER TABLE decision_log ADD COLUMN IF NOT EXISTS experiment_id uuid;
ALTER TABLE decision_log ADD COLUMN IF NOT EXISTS variant_name text;
