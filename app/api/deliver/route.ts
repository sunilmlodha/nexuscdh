/**
 * POST /api/deliver — send one decision via its channel adapter.
 *
 * Body: either { decisionId } (resolves the logged decision) OR an explicit
 * { customerId, channel, actionId?, actionName?, treatmentId?, to? }.
 * GET ?tenantId=&limit= — recent deliveries.
 */
import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase } from '@/lib/supabase';
import { deliverForDecision } from '@/lib/deliver-service';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '100'), 500);
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });
  const { data, error } = await serviceSupabase!
    .from('deliveries').select('*').eq('tenant_id', tenantId).order('sent_at', { ascending: false }).limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, configured: true });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const tenantId = (body.tenantId as string) ?? DEFAULT_TENANT;

  let input = {
    tenantId,
    decisionId:  body.decisionId as string | undefined,
    customerId:  body.customerId as string,
    channel:     body.channel as string,
    actionId:    body.actionId as string | undefined,
    actionName:  body.actionName as string | undefined,
    treatmentId: (body.treatmentId as string | undefined) ?? null,
    to:          body.to as string | undefined,
  };

  // If only a decisionId is given, hydrate the send context from the decision log
  if (body.decisionId && (!input.customerId || !input.channel)) {
    const { data: d } = await serviceSupabase!
      .from('decision_log').select('customer_id, channel_id, action_id, action_name')
      .eq('id', body.decisionId).eq('tenant_id', tenantId).maybeSingle();
    if (!d) return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
    input = { ...input, customerId: d.customer_id, channel: d.channel_id ?? 'email', actionId: d.action_id, actionName: d.action_name };
  }

  if (!input.customerId || !input.channel)
    return NextResponse.json({ error: 'customerId and channel (or a resolvable decisionId) required' }, { status: 422 });

  const result = await deliverForDecision(input);
  return NextResponse.json(result);
}
