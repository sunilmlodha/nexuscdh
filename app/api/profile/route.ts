import { NextRequest, NextResponse } from 'next/server';
import {
  fetchCustomerProfile, fetchCustomerProfiles,
  upsertCustomerProfile, deleteCustomerProfile,
  IS_CONFIGURED, supabase,
  serviceSupabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get('customerId');
  const tenantId   = req.nextUrl.searchParams.get('tenantId') ?? 'f0000000-0000-4000-a000-000000000001';
  const listAll    = req.nextUrl.searchParams.get('list') === 'true';

  if (!IS_CONFIGURED) return NextResponse.json({ profile: null, recentDecisions: [], configured: false });

  if (listAll) {
    const profiles = await fetchCustomerProfiles(tenantId, 200);
    return NextResponse.json({ data: profiles, configured: true });
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
    recentDecisions: decisionsResult.data ?? [],
    configured: true,
  });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  let body: { customerId: string; attributes: Record<string, unknown>; tenantId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { customerId, attributes, tenantId = 'f0000000-0000-4000-a000-000000000001' } = body;
  if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

  await upsertCustomerProfile(tenantId, customerId, attributes ?? {});
  const profile = await fetchCustomerProfile(tenantId, customerId);
  return NextResponse.json({ profile });
}

export async function DELETE(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const customerId = req.nextUrl.searchParams.get('customerId') ?? '';
  const tenantId   = req.nextUrl.searchParams.get('tenantId') ?? 'f0000000-0000-4000-a000-000000000001';
  if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

  const deletedDecisions = await deleteCustomerProfile(tenantId, customerId);
  return NextResponse.json({ success: true, deleted: { profile: true, decisions: deletedDecisions } });
}
