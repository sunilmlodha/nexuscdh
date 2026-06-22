import { NextRequest, NextResponse } from 'next/server';
import { fetchEventTriggers, upsertEventTrigger, IS_CONFIGURED, supabase, serviceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-guard';

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? 'f0000000-0000-4000-a000-000000000001';
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });
  const data = await fetchEventTriggers(tenantId);
  return NextResponse.json({ data, configured: true });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const guard = await requireAuth('triggers:write');
  if (!guard.ok) return guard.res;
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const tenantId = guard.ctx.tenantId;
  if (!body.name || !body.event_type) {
    return NextResponse.json({ error: 'name and event_type required' }, { status: 400 });
  }
  const data = await upsertEventTrigger(
    body as { name: string; event_type: string },
    tenantId
  );
  if (!data) return NextResponse.json({ error: 'Failed to save trigger' }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const guard = await requireAuth('triggers:write');
  if (!guard.ok) return guard.res;
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await serviceSupabase!.from('event_triggers').delete().eq('id', id).eq('tenant_id', guard.ctx.tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// POST /api/triggers/fire — fire a trigger event (inbound webhook)
// External systems POST to this endpoint when events occur
// e.g. cart_abandoned, contract_expiry, balance_threshold, page_view
