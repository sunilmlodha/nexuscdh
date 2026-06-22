import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase } from '@/lib/supabase';
import { writeAudit, detectAction } from '@/lib/audit';
import { requireAuth } from '@/lib/api-guard';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';
const ENTITY = 'bundle';

const VALID_OBJECTIVES = ['acquisition','retention','cross-sell','upsell','win-back'];
const VALID_STATUS     = ['draft','active','completed','paused'];

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  const limit    = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '100'), 500);
  const offset   = Math.max(Number(req.nextUrl.searchParams.get('offset') ?? '0'), 0);
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });

  const { data, error, count } = await serviceSupabase!
    .from('bundles')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count, configured: true });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const guard = await requireAuth('strategies:write');
  if (!guard.ok) return guard.res;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const tenantId = guard.ctx.tenantId;
  const actor    = guard.ctx.email ?? (body.actor as string) ?? 'system';

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 422 });
  if (body.objective && !VALID_OBJECTIVES.includes(body.objective as string))
    return NextResponse.json({ error: `Invalid objective: ${body.objective}` }, { status: 422 });
  if (body.status && !VALID_STATUS.includes(body.status as string))
    return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 422 });

  const payload = {
    tenant_id:     tenantId,
    name,
    description:   body.description ?? null,
    objective:     body.objective ?? null,
    treatment_ids: body.treatment_ids ?? [],
    start_date:    body.start_date || null,
    end_date:      body.end_date || null,
    status:        body.status ?? 'draft',
    budget:        body.budget ?? null,
    updated_by:    actor,
    updated_at:    new Date().toISOString(),
  };

  let data: Record<string, unknown> | null = null, error: { message: string } | null = null;
  let before: Record<string, unknown> | null = null;

  if (body.id) {
    ({ data: before } = await serviceSupabase!
      .from('bundles').select('*').eq('id', body.id).eq('tenant_id', tenantId).single());
    ({ data, error } = await serviceSupabase!
      .from('bundles').update(payload).eq('id', body.id).eq('tenant_id', tenantId).select().single());
  } else {
    ({ data, error } = await serviceSupabase!
      .from('bundles').insert({ ...payload, created_by: actor }).select().single());
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({
    tenantId, entityType: ENTITY, entityId: String(data!.id), entityName: name,
    action: body.id ? detectAction(before?.status, data!.status) : 'created',
    changedBy: actor, before, after: data,
  });

  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const guard = await requireAuth('strategies:write');
  if (!guard.ok) return guard.res;
  const id = req.nextUrl.searchParams.get('id');
  const tenantId = guard.ctx.tenantId;
  const actor = guard.ctx.email ?? req.nextUrl.searchParams.get('actor') ?? 'system';
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data: before } = await serviceSupabase!
    .from('bundles').select('*').eq('id', id).eq('tenant_id', tenantId).single();

  const { error } = await serviceSupabase!
    .from('bundles')
    .update({ deleted_at: new Date().toISOString(), updated_by: actor })
    .eq('id', id).eq('tenant_id', tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({
    tenantId, entityType: ENTITY, entityId: id,
    entityName: (before?.name as string) ?? undefined,
    action: 'deleted', changedBy: actor, before, after: null,
  });

  return NextResponse.json({ success: true });
}
