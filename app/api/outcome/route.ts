import { NextRequest, NextResponse } from 'next/server';
import { updateDecisionOutcome, insertConfigAudit, IS_CONFIGURED, supabase, serviceSupabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  let body: { decisionId: string; customerId: string; outcome: string; tenantId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { decisionId, customerId, outcome, tenantId = 'f0000000-0000-4000-a000-000000000001' } = body;
  if (!decisionId || !customerId || !outcome) {
    return NextResponse.json({ error: 'decisionId, customerId, outcome required' }, { status: 400 });
  }
  if (!['accepted', 'rejected', 'ignored'].includes(outcome)) {
    return NextResponse.json({ error: 'outcome must be accepted | rejected | ignored' }, { status: 400 });
  }

  await updateDecisionOutcome(decisionId, outcome as 'accepted' | 'rejected' | 'ignored');

  await insertConfigAudit({
    tenant_id: tenantId,
    entity_type: 'decision_outcome',
    entity_id: decisionId,
    entity_name: customerId,
    action: 'updated',
    after_snapshot: { outcome, customerId, decisionId },
  }, tenantId);

  return NextResponse.json({ success: true, decisionId, outcome });
}

export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get('customerId') ?? '';
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? 'f0000000-0000-4000-a000-000000000001';
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });
  if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

  const { data } = await serviceSupabase!
    .from('decision_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .not('outcome', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ data: data ?? [], configured: true });
}
