/**
 * Feature flag administration.
 * GET  ?tenantId=  — list flags (open read)
 * POST { key, label?, description?, enabled?, rollout_pct? } — upsert (settings:write)
 * DELETE ?id=      — remove (settings:write)
 */
import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-guard';
import { writeAudit } from '@/lib/audit';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';

export async function GET(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  const { data, error } = await serviceSupabase!
    .from('feature_flags').select('*').eq('tenant_id', tenantId).order('key');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, configured: true });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const guard = await requireAuth('settings:write');
  if (!guard.ok) return guard.res;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const tenantId = guard.ctx.tenantId;
  const key = typeof body.key === 'string' ? body.key.trim() : '';
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 422 });

  const payload = {
    tenant_id: tenantId, key,
    label: body.label ?? key,
    description: body.description ?? null,
    enabled: body.enabled ?? false,
    rollout_pct: typeof body.rollout_pct === 'number' ? body.rollout_pct : 1,
    updated_at: new Date().toISOString(),
  };
  const { data: existing } = await serviceSupabase!
    .from('feature_flags').select('id').eq('tenant_id', tenantId).eq('key', key).maybeSingle();

  let data, error;
  if (existing) ({ data, error } = await serviceSupabase!.from('feature_flags').update(payload).eq('id', existing.id).select().single());
  else ({ data, error } = await serviceSupabase!.from('feature_flags').insert(payload).select().single());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({ tenantId, entityType: 'feature_flag', entityId: String(data!.id), entityName: key, action: existing ? 'updated' : 'created', changedBy: guard.ctx.email ?? 'system', after: data });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const guard = await requireAuth('settings:write');
  if (!guard.ok) return guard.res;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await serviceSupabase!.from('feature_flags').delete().eq('id', id).eq('tenant_id', guard.ctx.tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
