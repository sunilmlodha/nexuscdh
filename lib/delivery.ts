/**
 * Delivery layer — turns a served decision into an actual send via a pluggable
 * channel adapter. Each channel has one adapter config (channel_adapters);
 * deliver() dispatches on its provider.
 *
 *   mock     — no external call; records the send (default, works with no creds)
 *   webhook  — POST the delivery payload to the adapter's endpoint_url (your
 *              ESP/CDP/martech receives it and does the real send)
 *   sendgrid — POST to SendGrid v3 mail/send if api_key present, else mock
 *   twilio   — POST to Twilio Messages if api_key present (Basic auth), else mock
 *
 * Pure dispatch + fetch; the route owns DB writes.
 */

import { randomUUID } from 'crypto';

export interface ChannelAdapter {
  channel: string;
  provider: 'mock' | 'webhook' | 'sendgrid' | 'twilio';
  endpoint_url?: string | null;
  api_key?: string | null;
  config?: Record<string, unknown>;
  status?: string;
}

export interface DeliveryPayload {
  tenantId: string;
  decisionId?: string;
  customerId: string;
  channel: string;
  actionId?: string;
  actionName?: string;
  treatmentId?: string;
  // resolved creative (from the treatment)
  to?: string;            // email / phone / device token
  headline?: string;
  body?: string;
  ctaLabel?: string;
  offerCode?: string;
}

export interface DeliveryResult {
  status: 'sent' | 'failed';
  providerMessageId: string | null;
  error: string | null;
  provider: string;
}

export async function deliver(adapter: ChannelAdapter, payload: DeliveryPayload): Promise<DeliveryResult> {
  const provider = adapter.provider ?? 'mock';
  try {
    switch (provider) {
      case 'webhook': {
        if (!adapter.endpoint_url) return mock('webhook (no endpoint set)');
        const res = await fetch(adapter.endpoint_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(adapter.api_key ? { Authorization: `Bearer ${adapter.api_key}` } : {}) },
          body: JSON.stringify(payload),
        });
        if (!res.ok) return { status: 'failed', providerMessageId: null, error: `Webhook ${res.status}`, provider };
        const j = await res.json().catch(() => ({}));
        return { status: 'sent', providerMessageId: (j.messageId as string) ?? `wh-${randomUUID().slice(0, 8)}`, error: null, provider };
      }
      case 'sendgrid': {
        const key = adapter.api_key || process.env.SENDGRID_API_KEY;
        if (!key) return mock('sendgrid (no key)');
        const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: payload.to }] }],
            from: { email: (adapter.config?.from as string) ?? 'noreply@example.com' },
            subject: payload.headline ?? 'Your offer',
            content: [{ type: 'text/plain', value: payload.body ?? payload.headline ?? '' }],
          }),
        });
        if (!res.ok) return { status: 'failed', providerMessageId: null, error: `SendGrid ${res.status}`, provider };
        return { status: 'sent', providerMessageId: res.headers.get('x-message-id') ?? `sg-${randomUUID().slice(0, 8)}`, error: null, provider };
      }
      case 'twilio': {
        const key = adapter.api_key || process.env.TWILIO_AUTH;
        const sid = (adapter.config?.accountSid as string) || process.env.TWILIO_SID;
        if (!key || !sid) return mock('twilio (no creds)');
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`${sid}:${key}`).toString('base64')}` },
          body: new URLSearchParams({ To: payload.to ?? '', From: (adapter.config?.from as string) ?? '', Body: payload.body ?? payload.headline ?? '' }),
        });
        if (!res.ok) return { status: 'failed', providerMessageId: null, error: `Twilio ${res.status}`, provider };
        const j = await res.json().catch(() => ({}));
        return { status: 'sent', providerMessageId: (j.sid as string) ?? `tw-${randomUUID().slice(0, 8)}`, error: null, provider };
      }
      default:
        return mock('mock');
    }
  } catch (e: unknown) {
    return { status: 'failed', providerMessageId: null, error: e instanceof Error ? e.message : 'send failed', provider };
  }
}

function mock(label: string): DeliveryResult {
  return { status: 'sent', providerMessageId: `mock-${randomUUID().slice(0, 12)}`, error: null, provider: label };
}

/** Map an external channel event to a Stratcheck outcome. */
export function mapEventToOutcome(event: string): 'accepted' | 'rejected' | 'ignored' | null {
  const e = event.toLowerCase();
  if (['clicked', 'converted', 'accepted', 'opened', 'replied', 'purchased'].includes(e)) return 'accepted';
  if (['unsubscribed', 'rejected', 'dismissed', 'bounced', 'failed', 'complained'].includes(e)) return 'rejected';
  if (['ignored', 'delivered', 'no_response', 'expired'].includes(e)) return 'ignored';
  return null;
}

/** Map an external channel event to a delivery status (for the delivery log). */
export function mapEventToDeliveryStatus(event: string): string | null {
  const e = event.toLowerCase();
  if (['delivered', 'opened', 'clicked', 'bounced'].includes(e)) return e;
  return null;
}
