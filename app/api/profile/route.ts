import { NextRequest, NextResponse } from 'next/server';
import {
  fetchCustomerProfile,
  upsertCustomerProfile, deleteCustomerProfile,
  IS_CONFIGURED,
  serviceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-guard';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';

export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get('customerId');
  const tenantId   = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  const listAll    = req.nextUrl.searchParams.get('list') === 'true';

  if (!IS_CONFIGURED) return NextResponse.json({ profile: null, decisions: [], profiles: [], total: 0, configured: false });

  // ── List / browse mode (with optional search + pagination) ─────────────────
  if (listAll) {
    const q     = req.nextUrl.searchParams.get('q') ?? '';
    const page  = Math.max(parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10), 1);
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10), 200);

    let query = serviceSupabase!
      .from('customer_profiles')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('last_seen_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (q) query = query.ilike('customer_id', `%${q}%`);

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ profiles: data ?? [], total: count ?? 0, page, limit, configured: true });
  }

  if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

  const [profile, decisionsResult] = await Promise.all([
    fetchCustomerProfile(tenantId, customerId),
    serviceSupabase!
      .from('decision_log')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  return NextResponse.json({
    profile,
    decisions: decisionsResult.data ?? [],
    configured: true,
  });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const guard = await requireAuth('profiles:write');
  if (!guard.ok) return guard.res;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // ── Bulk ingest mode: array body, or { records: [...] } ─────────────────────
  const asObj = (body && typeof body === 'object') ? body as Record<string, unknown> : {};
  const bulkRecords =
    Array.isArray(body) ? body :
    Array.isArray(asObj.records) ? asObj.records as unknown[] :
    null;

  if (bulkRecords) {
    const tenantId = guard.ctx.tenantId;
    const results: { ok: number; errors: string[] } = { ok: 0, errors: [] };

    for (const rec of bulkRecords) {
      const r = (rec && typeof rec === 'object') ? rec as Record<string, unknown> : {};
      const customerId = (r.customer_id ?? r.id ?? r.customerId) as string | undefined;
      if (!customerId) { results.errors.push('Missing customer_id'); continue; }

      // Accept a nested `attributes` object OR flat top-level fields
      const attributes: Record<string, unknown> = (typeof r.attributes === 'object' && r.attributes !== null)
        ? { ...(r.attributes as Record<string, unknown>) }
        : { ...r };
      delete attributes.customer_id;
      delete attributes.tenant_id;
      delete attributes.id;
      delete attributes.customerId;

      try {
        await upsertCustomerProfile(tenantId, String(customerId), attributes);
        results.ok++;
      } catch (e: unknown) {
        results.errors.push(`${customerId}: ${e instanceof Error ? e.message : 'upsert failed'}`);
      }
    }
    return NextResponse.json(results);
  }

  // ── Single profile mode ─────────────────────────────────────────────────────
  const { customerId, attributes } = asObj as { customerId?: string; attributes?: Record<string, unknown> };
  const tenantId = guard.ctx.tenantId;
  if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

  await upsertCustomerProfile(tenantId, customerId, attributes ?? {});
  const profile = await fetchCustomerProfile(tenantId, customerId);
  return NextResponse.json({ profile });
}

export async function DELETE(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const guard = await requireAuth('profiles:write');
  if (!guard.ok) return guard.res;

  // NOTE: customer profiles are HARD-deleted by design — this is the GDPR
  // "right to erasure" path and must genuinely remove PII (unlike treatments/
  // bundles/journeys, which soft-delete for audit/recovery).
  const customerId = req.nextUrl.searchParams.get('customerId') ?? '';
  const tenantId   = guard.ctx.tenantId;
  if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

  const deletedDecisions = await deleteCustomerProfile(tenantId, customerId);
  return NextResponse.json({ success: true, deleted: { profile: true, decisions: deletedDecisions } });
}
