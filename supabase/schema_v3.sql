-- NexusCDH Schema v3 — additive migrations.
-- Run AFTER schema.sql and schema_v2.sql in Supabase SQL Editor.

-- ── 1. strategies: add eligibility_rules ─────────────────────────────────────
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS eligibility_rules jsonb DEFAULT '[]';

-- ── 2. event_triggers: add description + status ───────────────────────────────
ALTER TABLE event_triggers ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE event_triggers ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'
  CHECK (status IN ('active','paused','draft'));

-- ── 3. experiments: add strategy_id + metric + results ────────────────────────
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS strategy_id uuid REFERENCES strategies(id) ON DELETE SET NULL;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS metric text DEFAULT 'conversion_rate';
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS results jsonb DEFAULT '{}';
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS promote_threshold numeric DEFAULT 0.05;
