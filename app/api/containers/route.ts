/**
 * Real-Time Container management.
 *
 * GET    ?tenantId=        — list containers
 * POST                    — create/update a container config
 * DELETE ?id=&tenantId=   — delete a container
 *
 * The decision endpoint itself lives at POST /api/v4/containers/{name} (Pega
 * V4-compatible); these records configure which strategies each container serves.
 */

import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase } from '@/lib/supabase';
import { writeAudit } from '@/lib/audit';
import { requireAuth } from '@/lib/api-guard';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';
const ENTITY = 'realtime_container';
const VALID_CHANNELS = ['web', 'mobile', 'contact_center', 'email'];

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });

  const { data, error } = await serviceSupabase!
    .from('realtime_containers').select('*').eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, configured: true });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const guard = await requireAuth('channels:write');
  if (!guard.ok) return guard.res;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const tenantId = guard.ctx.tenantId;
  const actor    = guard.ctx.email ?? (body.actor as string) ?? 'system';

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 422 });
  if (!/^[A-Za-z0-9_-]+$/.test(name)) return NextResponse.json({ error: 'Name must be URL-safe (letters, numbers, _ or -)' }, { status: 422 });
  if (body.channel && !VALID_CHANNELS.includes(body.channel as string))
    return NextResponse.json({ error: `Invalid channel: ${body.channel}` }, { status: 422 });

  const payload = {
    tenant_id:    tenantId,
    name,
    description:  body.description ?? null,
    channel:      body.channel ?? 'web',
    placement:    body.placement ?? null,
    strategy_ids: body.strategy_ids ?? [],
    max_actions:  body.max_actions ?? 3,
    status:       body.status ?? 'active',
    updated_at:   new Date().toISOString(),
  };

  let data: Record<string, unknown> | null, error: { message: string } | null;
  if (body.id) {
    ({ data, error } = await serviceSupabase!
      .from('realtime_containers').update(payload).eq('id', body.id).eq('tenant_id', tenantId).select().single());
  } else {
    ({ data, error } = await serviceSupabase!
      .from('realtime_containers').insert(payload).select().single());
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
  const guard = await requireAuth('channels:write');
  if (!guard.ok) return guard.res;
  const id = req.nextUrl.searchParams.get('id');
  const tenantId = guard.ctx.tenantId;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await serviceSupabase!
    .from('realtime_containers').delete().eq('id', id).eq('tenant_id', tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
