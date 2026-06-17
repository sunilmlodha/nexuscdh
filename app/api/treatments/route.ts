import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase } from '@/lib/supabase';
import { writeAudit, detectAction } from '@/lib/audit';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';
const ENTITY = 'treatment';

const VALID_CHANNELS = ['email','sms','push','in_app','direct_mail','outbound_call'];
const VALID_STATUS   = ['draft','active','paused','archived'];
const VALID_VARIANTS = ['A','B','C','Control'];

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  const actionId = req.nextUrl.searchParams.get('actionId');
  const limit    = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '100'), 500);
  const offset   = Math.max(Number(req.nextUrl.searchParams.get('offset') ?? '0'), 0);
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });

  let query = serviceSupabase!
    .from('treatments')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (actionId) query = query.eq('action_id', actionId);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count, configured: true });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const tenantId = (body.tenantId as string) ?? DEFAULT_TENANT;
  const actor    = (body.actor as string) ?? 'system';

  // ── Server-side validation ────────────────────────────────────────────────
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 422 });
  if (body.channel && !VALID_CHANNELS.includes(body.channel as string))
    return NextResponse.json({ error: `Invalid channel: ${body.channel}` }, { status: 422 });
  if (body.status && !VALID_STATUS.includes(body.status as string))
    return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 422 });
  if (body.variant_label && !VALID_VARIANTS.includes(body.variant_label as string))
    return NextResponse.json({ error: `Invalid variant: ${body.variant_label}` }, { status: 422 });

  const payload = {
    tenant_id:     tenantId,
    action_id:     body.action_id ?? null,
    name,
    description:   body.description ?? null,
    channel:       body.channel ?? null,
    headline:      body.headline ?? null,
    body_copy:     body.body_copy ?? null,
    cta_label:     body.cta_label ?? null,
    offer_code:    body.offer_code ?? null,
    offer_value:   body.offer_value ?? null,
    variant_label: body.variant_label ?? null,
    status:        body.status ?? 'draft',
    offer_state:   body.offer_state ?? 'draft',
    effective_from: body.effective_from || null,
    effective_to:   body.effective_to || null,
    approved_by:   body.approved_by ?? null,
    updated_by:    actor,
    updated_at:    new Date().toISOString(),
  };

  let data: Record<string, unknown> | null = null, error: { message: string } | null = null;
  let before: Record<string, unknown> | null = null;

  if (body.id) {
    ({ data: before } = await serviceSupabase!
      .from('treatments').select('*').eq('id', body.id).eq('tenant_id', tenantId).single());
    ({ data, error } = await serviceSupabase!
      .from('treatments').update(payload).eq('id', body.id).eq('tenant_id', tenantId).select().single());
  } else {
    ({ data, error } = await serviceSupabase!
      .from('treatments').insert({ ...payload, created_by: actor }).select().single());
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
  const id = req.nextUrl.searchParams.get('id');
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  const actor = req.nextUrl.searchParams.get('actor') ?? 'system';
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data: before } = await serviceSupabase!
    .from('treatments').select('*').eq('id', id).eq('tenant_id', tenantId).single();

  // Soft delete — preserves the row for audit/recovery
  const { error } = await serviceSupabase!
    .from('treatments')
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
