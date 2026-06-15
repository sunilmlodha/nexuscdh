import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, supabase, serviceSupabase } from '@/lib/supabase';

// GET /api/strategies/versions?strategyId=xxx — list version history
export async function GET(req: NextRequest) {
  const strategyId = req.nextUrl.searchParams.get('strategyId') ?? '';
  const tenantId   = req.nextUrl.searchParams.get('tenantId')   ?? 'f0000000-0000-4000-a000-000000000001';
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });
  if (!strategyId)    return NextResponse.json({ error: 'strategyId required' }, { status: 400 });

  const { data, error } = await serviceSupabase!
    .from('strategy_versions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('strategy_id', strategyId)
    .order('version', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [], configured: true });
}

// POST /api/strategies/versions — snapshot current strategy state
export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  let body: { strategyId: string; snapshot: Record<string, unknown>; changedBy?: string; changeSummary?: string; tenantId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { strategyId, snapshot, changedBy, changeSummary, tenantId = 'f0000000-0000-4000-a000-000000000001' } = body;
  if (!strategyId || !snapshot) return NextResponse.json({ error: 'strategyId and snapshot required' }, { status: 400 });

  // Get next version number
  const { data: existing } = await serviceSupabase!
    .from('strategy_versions')
    .select('version')
    .eq('strategy_id', strategyId)
    .order('version', { ascending: false })
    .limit(1);

  const nextVersion = (existing?.[0]?.version ?? 0) + 1;

  const { data, error } = await serviceSupabase!
    .from('strategy_versions')
    .insert({ tenant_id: tenantId, strategy_id: strategyId, version: nextVersion, snapshot, changed_by: changedBy, change_summary: changeSummary })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, version: nextVersion });
}

// DELETE /api/strategies/versions?strategyId=xxx&version=N — rollback (restore snapshot)
// Actually this is a PATCH-style rollback — copy version N snapshot back to strategies table
export async function PATCH(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  let body: { strategyId: string; version: number; tenantId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { strategyId, version, tenantId = 'f0000000-0000-4000-a000-000000000001' } = body;
  if (!strategyId || !version) return NextResponse.json({ error: 'strategyId and version required' }, { status: 400 });

  const { data: versionRecord } = await serviceSupabase!
    .from('strategy_versions')
    .select('snapshot')
    .eq('strategy_id', strategyId)
    .eq('version', version)
    .single();

  if (!versionRecord) return NextResponse.json({ error: `Version ${version} not found` }, { status: 404 });

  const snapshot = versionRecord.snapshot as Record<string, unknown>;
  const { data, error } = await serviceSupabase!
    .from('strategies')
    .update({ ...snapshot, updated_at: new Date().toISOString() })
    .eq('id', strategyId)
    .eq('tenant_id', tenantId)
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, rolledBackTo: version });
}
