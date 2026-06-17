-- schema_v12.sql: Journey execution runtime — enrollments + worker state

-- Each row tracks one customer's progress through one journey.
CREATE TABLE IF NOT EXISTS journey_enrollments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     text NOT NULL,
  journey_id    uuid NOT NULL,
  customer_id   text NOT NULL,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','exited')),
  current_stage integer NOT NULL DEFAULT 0,    -- index into journey.stages
  enrolled_at   timestamptz NOT NULL DEFAULT now(),
  next_run_at   timestamptz NOT NULL DEFAULT now(),  -- when the current stage is due
  last_fired_at timestamptz,
  exit_reason   text,
  history       jsonb NOT NULL DEFAULT '[]',   -- [{stage, name, at, outcome, action}]
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- One active enrollment per customer per journey
CREATE UNIQUE INDEX IF NOT EXISTS journey_enrollments_unique
  ON journey_enrollments (tenant_id, journey_id, customer_id);
-- Worker scan: due, active enrollments
CREATE INDEX IF NOT EXISTS journey_enrollments_due_idx
  ON journey_enrollments (tenant_id, status, next_run_at);

ALTER TABLE journey_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "journey_enrollments_tenant_isolation" ON journey_enrollments;
CREATE POLICY "journey_enrollments_tenant_isolation" ON journey_enrollments
  USING (tenant_id = current_setting('app.tenant_id', true));
