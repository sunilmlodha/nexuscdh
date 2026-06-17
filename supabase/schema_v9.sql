-- schema_v9.sql: NBA decisioning core — engagement-policy layers + P×C×V×L arbitration
--
-- Adds the two missing engagement-policy layers (eligibility already exists),
-- the context weight (C), and business levers (L) to strategies. All columns
-- default to no-op values so existing strategies behave exactly as before until
-- configured.

ALTER TABLE strategies ADD COLUMN IF NOT EXISTS applicability_rules jsonb NOT NULL DEFAULT '[]';
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS suitability_rules   jsonb NOT NULL DEFAULT '[]';
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS context_weight      numeric NOT NULL DEFAULT 1.0;
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS business_levers     jsonb NOT NULL DEFAULT '[]';

-- Per-action context weight override (optional). Lets a specific action carry a
-- different situational weight than its strategy default.
ALTER TABLE actions ADD COLUMN IF NOT EXISTS context_weight numeric;

COMMENT ON COLUMN strategies.applicability_rules IS 'Engagement policy layer 2: situational relevance rules (AND-ed)';
COMMENT ON COLUMN strategies.suitability_rules   IS 'Engagement policy layer 3: customer-interest rules (AND-ed)';
COMMENT ON COLUMN strategies.context_weight      IS 'Arbitration factor C (situational weight) in Priority = P×C×V×L';
COMMENT ON COLUMN strategies.business_levers     IS 'Arbitration factor L: [{label, multiplier, condition?, enabled?}]';
