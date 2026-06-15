/**
 * GET  /api/v1/customers/{customerId}         — Fetch customer profile
 * PUT  /api/v1/customers/{customerId}         — Update customer attributes
 * POST /api/v1/customers/{customerId}/actions — Get NBA for customer (alias)
 *
 * Pega CDH Customer Profile API — NexusCDH compatible.
 */

import { NextRequest, NextResponse } from 'next/server';
import { serviceSupabase } from '@/lib/supabase';

const TENANT = process.env.NEXUS_TENANT_ID ?? 'f0000000-0000-4000-a000-000000000001';

export async function GET(
  req: NextRequest,
  { params }: { params: { customerId: string } }
) {
  const tenantId   = req.nextUrl.searchParams.get('tenantId') ?? TENANT;
  const customerId = params.customerId;

  if (!serviceSupabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const [profileResult, decisionsResult] = await Promise.all([
    serviceSupabase
      .from('customer_profiles').select('*')
      .eq('tenant_id', tenantId).eq('customer_id', customerId).single(),
    serviceSupabase
      .from('decision_log').select('*')
      .eq('tenant_id', tenantId).eq('customer_id', customerId)
      .order('created_at', { ascending: false }).limit(10),
  ]);

  if (!profileResult.data) {
    return NextResponse.json({ error: 'Customer not found', customerId }, { status: 404 });
  }

  const profile = profileResult.data;

  // Pega-shaped response
  return NextResponse.json({
    CustomerID:        customerId,
    pyCustomer: {
      pyCustomerID:    customerId,
      pyLastSeenDT:    profile.last_seen_at,
      pyInteractions:  profile.interaction_count ?? 0,
      pySegments:      profile.segments ?? [],
      ...profile.attributes,
    },
    attributes:        profile.attributes,
    segments:          profile.segments ?? [],
    interactionCount:  profile.interaction_count ?? 0,
    lastSeenAt:        profile.last_seen_at,
    recentDecisions:   (decisionsResult.data ?? []).map(d => ({
      pxInteractionID: d.id,
      pyName:          d.action_name,
      pyIssue:         d.strategy_name,
      pyOutcome:       d.outcome,
      pyChannel:       d.channel_id,
      pyPropensity:    d.propensity,
      served:          d.served,
      createdAt:       d.created_at,
    })),
    pxObjClass: 'Data-Customer',
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { customerId: string } }
) {
  if (!serviceSupabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const tenantId   = (body.tenantId as string) ?? TENANT;
  const customerId = params.customerId;
  const attributes = (body.attributes ?? body.pyCustomer ?? body) as Record<string, unknown>;

  // Remove meta fields not meant as attributes
  const { tenantId: _t, CustomerID: _c, pxObjClass: _o, ...cleanAttrs } = attributes;

  await serviceSupabase.from('customer_profiles').upsert({
    tenant_id:   tenantId,
    customer_id: customerId,
    attributes:  cleanAttrs,
    updated_at:  new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'tenant_id,customer_id' });

  const { data: updated } = await serviceSupabase
    .from('customer_profiles').select('*')
    .eq('tenant_id', tenantId).eq('customer_id', customerId).single();

  return NextResponse.json({
    CustomerID:  customerId,
    updated:     true,
    attributes:  updated?.attributes ?? cleanAttrs,
    pxObjClass:  'Data-Customer',
  });
}
