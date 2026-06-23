/**
 * Consent ledger.
 * GET  ?customerId=&tenantId=  — consent history for a customer (append-only)
 * POST { customerId, purpose, granted, source?, note? } — record a grant/withdraw
 *        (also mirrors the latest marketing consent onto the customer profile)
 */
import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase, upsertCustomerProfile } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-guard';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';

export async function GET(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  const customerId = req.nextUrl.searchParams.get('customerId');
  let q = serviceSupabase!.from('consent_records').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200);
  if (customerId) q = q.eq('customer_id', customerId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, configured: true });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const guard = await requireAuth('profiles:write');
  if (!guard.ok) return guard.res;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const tenantId = guard.ctx.tenantId;
  const customerId = body.customerId as string;
  if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 422 });
  const granted = body.granted === true || body.granted === 'true';
  const purpose = (body.purpose as string) ?? 'marketing';

  const { data, error } = await serviceSupabase!.from('consent_records').insert({
    tenant_id: tenantId, customer_id: customerId, purpose, granted,
    source: body.source ?? 'preference_centre', note: body.note ?? null,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mirror marketing consent onto the profile so the decision engine's consent gate sees it
  if (purpose === 'marketing') {
    await upsertCustomerProfile(tenantId, customerId, { consentGiven: granted, consent: granted });
  }
  return NextResponse.json({ data });
}
