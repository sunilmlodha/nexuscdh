/**
 * Identity resolution (CDP).
 * GET ?customerId=        — aliases linked to a customer
 * GET ?resolve=&type=     — resolve an alias value → canonical customer_id
 * POST { customerId, aliasType, aliasValue }            — link an identifier
 * POST { action:'merge', fromCustomerId, toCustomerId } — merge two profiles into one
 */
import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-guard';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';

export async function GET(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  const resolve = req.nextUrl.searchParams.get('resolve');
  const customerId = req.nextUrl.searchParams.get('customerId');

  if (resolve) {
    const type = req.nextUrl.searchParams.get('type') ?? 'email';
    const { data } = await serviceSupabase!
      .from('identity_aliases').select('customer_id').eq('tenant_id', tenantId).eq('alias_type', type).ilike('alias_value', resolve).maybeSingle();
    return NextResponse.json({ customerId: data?.customer_id ?? null });
  }

  let q = serviceSupabase!.from('identity_aliases').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200);
  if (customerId) q = q.eq('customer_id', customerId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, configured: true });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const guard = await requireAuth('profiles:write');
  if (!guard.ok) return guard.res;
  const tenantId = guard.ctx.tenantId;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // ── merge: repoint aliases + decisions from one customer to another ──────────
  if (body.action === 'merge') {
    const from = body.fromCustomerId as string, to = body.toCustomerId as string;
    if (!from || !to || from === to) return NextResponse.json({ error: 'distinct fromCustomerId and toCustomerId required' }, { status: 422 });
    await serviceSupabase!.from('identity_aliases').update({ customer_id: to }).eq('tenant_id', tenantId).eq('customer_id', from);
    await serviceSupabase!.from('decision_log').update({ customer_id: to }).eq('tenant_id', tenantId).eq('customer_id', from);
    // record the old id as an alias of the surviving profile, then drop the old profile
    await serviceSupabase!.from('identity_aliases').upsert({ tenant_id: tenantId, customer_id: to, alias_type: 'external', alias_value: from }, { onConflict: 'tenant_id,alias_type,alias_value' });
    await serviceSupabase!.from('customer_profiles').delete().eq('tenant_id', tenantId).eq('customer_id', from);
    return NextResponse.json({ ok: true, merged: from, into: to });
  }

  // ── link an alias ─────────────────────────────────────────────────────────
  const customerId = body.customerId as string;
  const aliasValue = body.aliasValue as string;
  if (!customerId || !aliasValue) return NextResponse.json({ error: 'customerId and aliasValue required' }, { status: 422 });
  const { data, error } = await serviceSupabase!.from('identity_aliases').upsert({
    tenant_id: tenantId, customer_id: customerId, alias_type: body.aliasType ?? 'email', alias_value: aliasValue,
  }, { onConflict: 'tenant_id,alias_type,alias_value' }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
