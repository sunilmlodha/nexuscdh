/**
 * Server-side delivery: resolve the channel adapter + treatment creative, send
 * via the adapter, and record a delivery row. Shared by /api/deliver, the
 * journey worker, and segment campaigns so every "send" goes through one path.
 */

import { serviceSupabase } from './supabase';
import { deliver, type ChannelAdapter, type DeliveryResult } from './delivery';

export interface DeliverInput {
  tenantId: string;
  decisionId?: string;
  customerId: string;
  channel: string;
  actionId?: string;
  actionName?: string;
  treatmentId?: string | null;
  to?: string;
}

const MOCK_ADAPTER: ChannelAdapter = { channel: 'any', provider: 'mock' };

export async function deliverForDecision(input: DeliverInput): Promise<DeliveryResult & { deliveryId: string | null }> {
  if (!serviceSupabase) return { status: 'failed', providerMessageId: null, error: 'not configured', provider: 'mock', deliveryId: null };

  // 1. adapter for this channel (fall back to mock if none/inactive)
  const { data: adapterRow } = await serviceSupabase
    .from('channel_adapters').select('*')
    .eq('tenant_id', input.tenantId).eq('channel', input.channel).maybeSingle();
  const adapter: ChannelAdapter = adapterRow && adapterRow.status !== 'inactive' ? adapterRow : MOCK_ADAPTER;

  // 2. resolve treatment creative (optional)
  let headline, body, ctaLabel, offerCode;
  if (input.treatmentId) {
    const { data: t } = await serviceSupabase
      .from('treatments').select('headline, body_copy, cta_label, offer_code')
      .eq('id', input.treatmentId).eq('tenant_id', input.tenantId).maybeSingle();
    if (t) { headline = t.headline; body = t.body_copy; ctaLabel = t.cta_label; offerCode = t.offer_code; }
  }

  // 3. send
  const result = await deliver(adapter, {
    tenantId: input.tenantId, decisionId: input.decisionId, customerId: input.customerId,
    channel: input.channel, actionId: input.actionId, actionName: input.actionName,
    treatmentId: input.treatmentId ?? undefined, to: input.to,
    headline: headline ?? input.actionName, body, ctaLabel, offerCode,
  });

  // 4. record
  const { data: del } = await serviceSupabase.from('deliveries').insert({
    tenant_id: input.tenantId, decision_id: input.decisionId ?? null, customer_id: input.customerId,
    channel: input.channel, action_id: input.actionId ?? null, action_name: input.actionName ?? null,
    treatment_id: input.treatmentId ?? null, provider: result.provider, status: result.status,
    provider_message_id: result.providerMessageId, error: result.error,
    payload: { headline: headline ?? input.actionName, offerCode },
  }).select('id').single();

  return { ...result, deliveryId: del?.id ?? null };
}
