-- schema_v11.sql: Unified Campaigns (1:1 + segment) and Offer lifecycle/scheduling

-- ─── Campaigns ────────────────────────────────────────────────────────────────
-- A campaign targets an audience (segment rules over customer attributes) and
-- runs in one of two modes:
--   1:1     — the P×C×V×L engine arbitrates the best action per customer
--   segment — one fixed action + treatment is sent to everyone in the segment
CREATE TABLE IF NOT EXISTS campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL,
  name            text NOT NULL,
  description     text,
  mode            text NOT NULL DEFAULT '1:1' CHECK (mode IN ('1:1','segment')),
  audience_rules  jsonb NOT NULL DEFAULT '[]',   -- [{attribute, op, value}] over profile attributes
  -- segment mode targets:
  action_id       uuid,
  treatment_id    uuid,
  channel         text,
  -- scheduling + lifecycle:
  start_date      date,
  end_date        date,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed')),
  last_run_at     timestamptz,
  last_run_stats  jsonb,
  created_by      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaigns_tenant_idx ON campaigns (tenant_id, status, created_at DESC);
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "campaigns_tenant_isolation" ON campaigns;
CREATE POLICY "campaigns_tenant_isolation" ON campaigns
  USING (tenant_id = current_setting('app.tenant_id', true));

-- ─── Offer lifecycle + scheduling on treatments ──────────────────────────────
-- offer_state governs whether a treatment is eligible to be served:
--   draft → in_review → live → expired.  A treatment is "servable" only when
--   offer_state = 'live' AND now() is within [effective_from, effective_to].
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS offer_state    text NOT NULL DEFAULT 'draft'
  CHECK (offer_state IN ('draft','in_review','live','expired'));
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS effective_from date;
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS effective_to   date;
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS approved_by    text;

COMMENT ON COLUMN treatments.offer_state IS 'Offer lifecycle: draft → in_review → live → expired';
COMMENT ON COLUMN campaigns.mode IS '1:1 = arbitrated NBA per customer; segment = fixed action+treatment to all in segment';
