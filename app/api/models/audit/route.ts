/**
 * GET /api/models/audit?actionId=&tenantId=&limit=
 *
 * Returns the per-update audit trail for an adaptive model —
 * every propensity update with algorithm, formula, explanation, before/after.
 */

import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const actionId = req.nextUrl.searchParams.get('actionId') ?? '';
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? 'f0000000-0000-4000-a000-000000000001';
  const limit    = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '50'), 200);

  if (!IS_CONFIGURED || !serviceSupabase)
    return NextResponse.json({ data: [], configured: false });
  if (!actionId)
    return NextResponse.json({ error: 'actionId required' }, { status: 400 });

  const { data, error } = await serviceSupabase
    .from('config_audit_log')
    .select('id, entity_name, action, after_snapshot, created_at')
    .eq('tenant_id', tenantId)
    .eq('entity_type', 'adaptive_feedback')
    .eq('entity_id', actionId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [], configured: true });
}
