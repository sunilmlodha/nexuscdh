/**
 * POST /api/journeys/enroll  { journeyId, tenantId, customerIds?, audienceRules? }
 *
 * Enrolls customers into a journey. Supply explicit customerIds, or audienceRules
 * (segment filter over profile attributes) to enrol everyone matching. Each
 * enrolment starts at stage 0, due at enrolled_at + stage[0].day days.
 *
 * GET /api/journeys/enroll?journeyId=&tenantId=  — enrollment counts for a journey
 */

import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase, fetchCustomerProfiles } from '@/lib/supabase';
import { evaluateClause, type RuleClause } from '@/lib/arbitration';
import { addDays, type JourneyStage } from '@/lib/journey-runtime';
import { requireAuth } from '@/lib/api-guard';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';

export async function GET(req: NextRequest) {
  const tenantId  = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  const journeyId = req.nextUrl.searchParams.get('journeyId');
  if (!IS_CONFIGURED) return NextResponse.json({ configured: false });

  let q = serviceSupabase!.from('journey_enrollments').select('journey_id, status').eq('tenant_id', tenantId);
  if (journeyId) q = q.eq('journey_id', journeyId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aggregate counts per journey + status
  const counts: Record<string, { active: number; completed: number; exited: number }> = {};
  for (const r of data ?? []) {
    counts[r.journey_id] ??= { active: 0, completed: 0, exited: 0 };
    counts[r.journey_id][r.status as 'active' | 'completed' | 'exited']++;
  }
  return NextResponse.json({ configured: true, counts });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const guard = await requireAuth('strategies:write');
  if (!guard.ok) return guard.res;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const tenantId  = guard.ctx.tenantId;
  const journeyId = body.journeyId as string;
  if (!journeyId) return NextResponse.json({ error: 'journeyId required' }, { status: 400 });

  const { data: journey } = await serviceSupabase!
    .from('journeys').select('*').eq('id', journeyId).eq('tenant_id', tenantId).single();
  if (!journey) return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
  const stages = (journey.stages ?? []) as JourneyStage[];
  if (!stages.length) return NextResponse.json({ error: 'Journey has no stages to run' }, { status: 422 });

  // Resolve target customers
  let customerIds: string[] = Array.isArray(body.customerIds) ? body.customerIds as string[] : [];
  if (!customerIds.length) {
    const rules = (body.audienceRules ?? []) as RuleClause[];
    const profiles = await fetchCustomerProfiles(tenantId, 1000);
    customerIds = profiles
      .filter(p => rules.every(r => evaluateClause(p.attributes ?? {}, r)))
      .map(p => p.customer_id);
  }
  if (!customerIds.length) return NextResponse.json({ error: 'No customers matched' }, { status: 422 });

  const now = new Date();
  const firstDue = addDays(now, stages[0].day ?? 0).toISOString();

  const rows = customerIds.map(cid => ({
    tenant_id: tenantId, journey_id: journeyId, customer_id: cid,
    status: 'active', current_stage: 0,
    enrolled_at: now.toISOString(), next_run_at: firstDue,
  }));

  // Upsert ignoring already-enrolled (unique on tenant+journey+customer)
  const { data, error } = await serviceSupabase!
    .from('journey_enrollments')
    .upsert(rows, { onConflict: 'tenant_id,journey_id,customer_id', ignoreDuplicates: true })
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, enrolled: data?.length ?? 0, targeted: customerIds.length });
}
