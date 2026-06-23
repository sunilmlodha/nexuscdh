/**
 * GET /api/usage?tenantId= — plan entitlement + decision usage this month.
 */
import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase } from '@/lib/supabase';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';

export async function GET(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ configured: false });
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const [{ data: ent }, { count }] = await Promise.all([
    serviceSupabase!.from('entitlements').select('*').eq('tenant_id', tenantId).maybeSingle(),
    serviceSupabase!.from('decision_log').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', monthStart),
  ]);

  const plan = ent?.plan ?? 'trial';
  const limit = ent?.decision_limit ?? 10000;
  const used = count ?? 0;

  return NextResponse.json({
    configured: true,
    plan,
    seatLimit: ent?.seat_limit ?? 5,
    decisionLimit: limit,
    used,
    remaining: Math.max(0, limit - used),
    pct: limit ? Math.min(1, used / limit) : 0,
    overLimit: used > limit,
    periodStart: monthStart,
  });
}
