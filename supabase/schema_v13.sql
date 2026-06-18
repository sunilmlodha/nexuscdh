-- schema_v13.sql: Delivery layer — pluggable channel adapters + delivery log

-- One adapter config per channel: how a served decision actually gets sent.
--   provider = mock     → records a delivery without calling out (default/demo)
--             = webhook  → POSTs the delivery payload to endpoint_url (your ESP/CDP)
--             = sendgrid | twilio → real provider if api_key set, else falls back to mock
CREATE TABLE IF NOT EXISTS channel_adapters (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    text NOT NULL,
  channel      text NOT NULL,                  -- email | sms | push | in_app | direct_mail | outbound_call
  provider     text NOT NULL DEFAULT 'mock' CHECK (provider IN ('mock','webhook','sendgrid','twilio')),
  endpoint_url text,
  api_key      text,
  config       jsonb NOT NULL DEFAULT '{}',
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS channel_adapters_channel_idx ON channel_adapters (tenant_id, channel);
ALTER TABLE channel_adapters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "channel_adapters_tenant_isolation" ON channel_adapters;
CREATE POLICY "channel_adapters_tenant_isolation" ON channel_adapters
  USING (tenant_id = current_setting('app.tenant_id', true));

-- Every actual send. provider_message_id is how an inbound outcome webhook maps
-- a channel event back to the decision that produced it.
CREATE TABLE IF NOT EXISTS deliveries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           text NOT NULL,
  decision_id         uuid,
  customer_id         text NOT NULL,
  channel             text NOT NULL,
  action_id           uuid,
  action_name         text,
  treatment_id        uuid,
  provider            text NOT NULL DEFAULT 'mock',
  status              text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','delivered','bounced','opened','clicked')),
  provider_message_id text,
  error               text,
  payload             jsonb NOT NULL DEFAULT '{}',
  sent_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deliveries_tenant_idx ON deliveries (tenant_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS deliveries_msgid_idx  ON deliveries (tenant_id, provider_message_id);
CREATE INDEX IF NOT EXISTS deliveries_decision_idx ON deliveries (decision_id);
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deliveries_tenant_isolation" ON deliveries;
CREATE POLICY "deliveries_tenant_isolation" ON deliveries
  USING (tenant_id = current_setting('app.tenant_id', true));
