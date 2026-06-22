/**
 * Campaigns — unified 1:1 (arbitrated NBA) and segment (fixed offer) marketing.
 *
 * GET    ?tenantId=        — list campaigns
 * POST                    — create/update a campaign
 * DELETE ?id=&tenantId=   — delete a campaign
 * (execution is POST /api/campaigns/run)
 */

import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase } from '@/lib/supabase';
import { writeAudit } from '@/lib/audit';
import { requireAuth } from '@/lib/api-guard';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';
const ENTITY = 'campaign';

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });
  const { data, error } = await serviceSupabase!
    .from('campaigns').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, configured: true });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const guard = await requireAuth('strategies:write');
  if (!guard.ok) return guard.res;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const tenantId = guard.ctx.tenantId;
  const actor    = guard.ctx.email ?? (body.actor as string) ?? 'campaigns-ui';

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 422 });
  const mode = body.mode === 'segment' ? 'segment' : '1:1';
  if (mode === 'segment' && !body.action_id)
    return NextResponse.json({ error: 'Segment campaigns require an action' }, { status: 422 });

  const payload = {
    tenant_id:      tenantId,
    name,
    description:    body.description ?? null,
    mode,
    audience_rules: body.audience_rules ?? [],
    action_id:      mode === 'segment' ? (body.action_id ?? null) : null,
    treatment_id:   mode === 'segment' ? (body.treatment_id ?? null) : null,
    channel:        mode === 'segment' ? (body.channel ?? null) : null,
    start_date:     body.start_date || null,
    end_date:       body.end_date || null,
    status:         body.status ?? 'draft',
    updated_at:     new Date().toISOString(),
  };

  let data: Record<string, unknown> | null, error: { message: string } | null;
  if (body.id) {
    ({ data, error } = await serviceSupabase!
      .from('campaigns').update(payload).eq('id', body.id).eq('tenant_id', tenantId).select().single());
  } else {
    ({ data, error } = await serviceSupabase!
      .from('campaigns').insert({ ...payload, created_by: actor }).select().single());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({
    tenantId, entityType: ENTITY, entityId: String(data!.id), entityName: name,
    action: body.id ? 'updated' : 'created', changedBy: actor, after: data,
  });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const guard = await requireAuth('strategies:write');
  if (!guard.ok) return guard.res;
  const id = req.nextUrl.searchParams.get('id');
  const tenantId = guard.ctx.tenantId;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await serviceSupabase!.from('campaigns').delete().eq('id', id).eq('tenant_id', tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
