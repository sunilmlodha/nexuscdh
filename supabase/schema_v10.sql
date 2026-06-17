-- schema_v10.sql: Phase 3 — Revision Management, Real-Time Containers, Control Groups

-- ─── 1:1 Operations: Revision / Change-Request management ────────────────────
CREATE TABLE IF NOT EXISTS change_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    text NOT NULL,
  title        text NOT NULL,
  description  text,
  status       text NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','in_review','approved','deployed','rejected')),
  items        jsonb NOT NULL DEFAULT '[]',   -- [{entityType, entityId, entityName, change}]
  created_by   text,
  reviewed_by  text,
  review_note  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  deployed_at  timestamptz
);
CREATE INDEX IF NOT EXISTS change_requests_tenant_idx ON change_requests (tenant_id, status, created_at DESC);
ALTER TABLE change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "change_requests_tenant_isolation" ON change_requests;
CREATE POLICY "change_requests_tenant_isolation" ON change_requests
  USING (tenant_id = current_setting('app.tenant_id', true));

-- ─── Real-Time Containers (named inbound decision endpoints) ─────────────────
CREATE TABLE IF NOT EXISTS realtime_containers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    text NOT NULL,
  name         text NOT NULL,                 -- e.g. "PrimaryContainer" (used in the URL)
  description  text,
  channel      text DEFAULT 'web',            -- web | mobile | contact_center | email
  placement    text,                          -- e.g. "homepage_hero", "post_login"
  strategy_ids jsonb NOT NULL DEFAULT '[]',   -- empty = all active strategies
  max_actions  integer NOT NULL DEFAULT 3,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS realtime_containers_name_idx ON realtime_containers (tenant_id, name);
ALTER TABLE realtime_containers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "realtime_containers_tenant_isolation" ON realtime_containers;
CREATE POLICY "realtime_containers_tenant_isolation" ON realtime_containers
  USING (tenant_id = current_setting('app.tenant_id', true));

-- ─── Control Groups: random hold-out % per strategy (measure lift) ───────────
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS control_group_pct numeric NOT NULL DEFAULT 0;
COMMENT ON COLUMN strategies.control_group_pct IS 'Fraction (0–1) of customers held out as a no-action control to measure lift';

-- Record control-group assignment on each decision for lift reporting
ALTER TABLE decision_log ADD COLUMN IF NOT EXISTS is_control boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS decision_log_control_idx ON decision_log (tenant_id, is_control, created_at DESC);
