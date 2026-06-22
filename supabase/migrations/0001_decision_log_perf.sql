-- 0001: composite index backing the /api/metrics + dashboard queries
-- (tenant + recent-first scan over the decision log). Idempotent.
CREATE INDEX IF NOT EXISTS decision_log_tenant_created_idx
  ON decision_log (tenant_id, created_at DESC);
