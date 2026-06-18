/**
 * POST /api/webhooks/outcome — inbound outcome webhook.
 *
 * A channel/ESP/CDP calls this when something happens to a delivered message.
 * Maps the event → a NexusCDH outcome, records it on the originating decision
 * (closing the adaptive-learning loop), and updates the delivery status.
 *
 * Body (flexible): {
 *   tenantId?, event,                       // e.g. "clicked", "bounced", "converted"
 *   messageId?  | providerMessageId?,       // map back to a delivery
 *   decisionId?, customerId?,               // or address the decision directly
 *   secret?                                 // optional, checked against WEBHOOK_SECRET
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase, updateDecisionOutcome } from '@/lib/supabase';
import { applyFeedback } from '@/lib/learning';
import { mapEventToOutcome, mapEventToDeliveryStatus } from '@/lib/delivery';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // Optional shared-secret check
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const provided = (body.secret as string) ?? (req.headers.get('x-webhook-secret') ?? '');
    if (provided !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (body.tenantId as string) ?? DEFAULT_TENANT;
  const event    = (body.event as string) ?? '';
  if (!event) return NextResponse.json({ error: 'event required' }, { status: 400 });

  const messageId = (body.messageId as string) ?? (body.providerMessageId as string) ?? null;
  let decisionId  = (body.decisionId as string) ?? null;
  let customerId  = (body.customerId as string) ?? null;
  let channel: string | undefined;

  // Resolve the originating delivery (and its decision) from the message id
  if (messageId && (!decisionId || !customerId)) {
    const { data: del } = await serviceSupabase!
      .from('deliveries').select('decision_id, customer_id, channel')
      .eq('tenant_id', tenantId).eq('provider_message_id', messageId).maybeSingle();
    if (del) { decisionId = decisionId ?? del.decision_id; customerId = customerId ?? del.customer_id; channel = del.channel; }
  }

  // Update delivery status (delivered/opened/clicked/bounced) if applicable
  const delStatus = mapEventToDeliveryStatus(event);
  if (delStatus && messageId) {
    await serviceSupabase!.from('deliveries').update({ status: delStatus })
      .eq('tenant_id', tenantId).eq('provider_message_id', messageId);
  }

  // Map to an outcome and record it (+ adaptive learning)
  const outcome = mapEventToOutcome(event);
  let learning = null;
  if (outcome && decisionId) {
    await updateDecisionOutcome(decisionId, outcome);
    learning = await applyFeedback({ decisionId, outcome, tenantId, channel });
  }

  return NextResponse.json({
    ok: true, event, mappedOutcome: outcome, decisionId, deliveryStatus: delStatus,
    propensityUpdate: learning ? { actionId: learning.actionId, before: learning.before, after: learning.after, delta: learning.delta } : null,
  });
}
