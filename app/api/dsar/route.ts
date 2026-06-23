/**
 * Data-Subject Access Requests (GDPR).
 * GET  ?tenantId=  — DSAR audit log
 * POST { customerId, type:'export'|'erasure' } — run + log a request
 *   export  → returns the customer's profile + decision history
 *   erasure → hard-deletes profile + decisions (right to erasure)
 */
import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase, fetchCustomerProfile, deleteCustomerProfile } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-guard';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';

export async function GET(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  const { data, error } = await serviceSupabase!
    .from('dsar_requests').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100);
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
  const type = body.type as string;
  if (!customerId || !['export', 'erasure'].includes(type))
    return NextResponse.json({ error: 'customerId and type (export|erasure) required' }, { status: 422 });

  let payload: Record<string, unknown> = {};
  if (type === 'export') {
    const profile = await fetchCustomerProfile(tenantId, customerId);
    const { data: decisions } = await serviceSupabase!.from('decision_log').select('*').eq('tenant_id', tenantId).eq('customer_id', customerId).limit(1000);
    const { data: consent } = await serviceSupabase!.from('consent_records').select('*').eq('tenant_id', tenantId).eq('customer_id', customerId);
    payload = { profile, decisions: decisions ?? [], consent: consent ?? [] };
  } else {
    const deletedDecisions = await deleteCustomerProfile(tenantId, customerId);
    payload = { erased: true, deletedDecisions };
  }

  await serviceSupabase!.from('dsar_requests').insert({
    tenant_id: tenantId, customer_id: customerId, type, status: 'completed',
    requested_by: guard.ctx.email ?? 'system',
    detail: type === 'export' ? { records: (payload.decisions as unknown[])?.length ?? 0 } : payload,
  });

  return NextResponse.json({ ok: true, type, ...(type === 'export' ? { export: payload } : payload) });
}
