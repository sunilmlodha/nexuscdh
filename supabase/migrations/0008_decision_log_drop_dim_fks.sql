-- 0008: let dimension rows (actions, strategies) be deleted again.
--
-- decision_log is an append-only audit log — it has ON UPDATE/DELETE DO INSTEAD
-- NOTHING rules. Its FKs to actions/strategies were ON DELETE SET NULL, which
-- must UPDATE decision_log to null the reference; the no-update rule silently
-- blocks that UPDATE, so the FK integrity check failed:
--   "referential integrity query on actions from constraint
--    decision_log_action_id_fkey ... gave unexpected result"
-- (hint: a rule rewrote the query).
--
-- The log already stores action_name / strategy_name snapshots, so the enforced
-- FKs add no value on an immutable log. Drop them — action_id / strategy_id stay
-- as historical values. tenant_id's FK is kept (tenants are not user-deletable).
ALTER TABLE decision_log DROP CONSTRAINT IF EXISTS decision_log_action_id_fkey;
ALTER TABLE decision_log DROP CONSTRAINT IF EXISTS decision_log_strategy_id_fkey;
