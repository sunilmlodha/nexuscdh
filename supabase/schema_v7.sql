-- schema_v7.sql: Treatments, Bundles, and Customer Journeys

-- ─── Treatments ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS treatments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    text NOT NULL,
  action_id    uuid,
  name         text NOT NULL,
  description  text,
  channel      text,
  headline     text,
  body_copy    text,
  cta_label    text,
  offer_code   text,
  offer_value  numeric,
  variant_label text CHECK (variant_label IN ('A','B','C','Control')),
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS treatments_tenant_idx ON treatments (tenant_id);
CREATE INDEX IF NOT EXISTS treatments_action_idx ON treatments (action_id);

ALTER TABLE treatments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "treatments_tenant_isolation" ON treatments
  USING (tenant_id = current_setting('app.tenant_id', true));

-- ─── Bundles ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bundles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      text NOT NULL,
  name           text NOT NULL,
  description    text,
  objective      text CHECK (objective IN ('acquisition','retention','cross-sell','upsell','win-back')),
  treatment_ids  jsonb NOT NULL DEFAULT '[]',
  start_date     date,
  end_date       date,
  status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','completed','paused')),
  budget         numeric,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bundles_tenant_idx ON bundles (tenant_id);

ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bundles_tenant_isolation" ON bundles
  USING (tenant_id = current_setting('app.tenant_id', true));

-- ─── Customer Journeys ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journeys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    text NOT NULL,
  name         text NOT NULL,
  description  text,
  industry     text CHECK (industry IN ('banking','insurance','retail','telecoms','healthcare','automotive','custom')),
  line_of_business text,
  stages       jsonb NOT NULL DEFAULT '[]',
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived')),
  template_id  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS journeys_tenant_idx ON journeys (tenant_id);

ALTER TABLE journeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journeys_tenant_isolation" ON journeys
  USING (tenant_id = current_setting('app.tenant_id', true));
