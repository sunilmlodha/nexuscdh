import { NextRequest, NextResponse } from 'next/server';
import { updateDecisionOutcome, IS_CONFIGURED, serviceSupabase } from '@/lib/supabase';
import { applyFeedback } from '@/lib/learning';

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  let body: {
    decisionId: string;
    customerId: string;
    outcome: string;
    channel?: string;
    tenantId?: string;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { decisionId, customerId, outcome, channel, tenantId = 'f0000000-0000-4000-a000-000000000001' } = body;
  if (!decisionId || !customerId || !outcome)
    return NextResponse.json({ error: 'decisionId, customerId, outcome required' }, { status: 400 });
  if (!['accepted', 'rejected', 'ignored'].includes(outcome))
    return NextResponse.json({ error: 'outcome must be accepted | rejected | ignored' }, { status: 400 });

  const typed = outcome as 'accepted' | 'rejected' | 'ignored';

  // 1. Record outcome on the decision log
  await updateDecisionOutcome(decisionId, typed);

  // 2. Apply Bayesian propensity update to the action (closes the feedback loop)
  const learning = await applyFeedback({ decisionId, outcome: typed, tenantId, channel });

  return NextResponse.json({
    success:    true,
    decisionId,
    outcome,
    channel:    channel ?? null,
    propensityUpdate: learning ? {
      actionId:   learning.actionId,
      actionName: learning.actionName,
      before:     learning.before,
      after:      learning.after,
      delta:      learning.delta,
    } : null,
  });
}

export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get('customerId') ?? '';
  const tenantId   = req.nextUrl.searchParams.get('tenantId')   ?? 'f0000000-0000-4000-a000-000000000001';
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });
  if (!customerId)    return NextResponse.json({ error: 'customerId required' }, { status: 400 });

  const { data } = await serviceSupabase!
    .from('decision_log')
    .select('id, customer_id, action_name, channel_id, served, outcome, propensity, created_at')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .not('outcome', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ data: data ?? [], configured: true });
}
