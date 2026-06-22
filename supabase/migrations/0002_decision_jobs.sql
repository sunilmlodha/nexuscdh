-- 0002: async decisioning jobs — enqueue + chunked worker (no long requests)
CREATE TABLE IF NOT EXISTS decision_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text NOT NULL,
  type        text NOT NULL DEFAULT 'campaign' CHECK (type IN ('campaign')),
  ref_id      uuid NOT NULL,                       -- e.g. campaign id
  status      text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
  cursor      text NOT NULL DEFAULT '',            -- last customer_id processed
  processed   integer NOT NULL DEFAULT 0,
  served      integer NOT NULL DEFAULT 0,
  suppressed  integer NOT NULL DEFAULT 0,
  error       text,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS decision_jobs_due_idx ON decision_jobs (tenant_id, status, created_at);
ALTER TABLE decision_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS decision_jobs_tenant_isolation ON decision_jobs;
CREATE POLICY decision_jobs_tenant_isolation ON decision_jobs
  USING (tenant_id = current_setting('app.tenant_id', true));
