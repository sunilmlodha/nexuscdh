import { NextRequest, NextResponse } from 'next/server';
import { fetchStrategies, upsertStrategy, insertConfigAudit, IS_CONFIGURED, supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? 'f0000000-0000-4000-a000-000000000001';
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });
  const data = await fetchStrategies(tenantId);
  return NextResponse.json({ data, configured: true });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const tenantId  = (body.tenantId as string) ?? 'f0000000-0000-4000-a000-000000000001';
  const changedBy = (body.changedBy as string) ?? undefined;
  const isUpdate  = Boolean(body.id);

  // Snapshot old state before overwrite (for versioning + audit)
  let beforeSnapshot: Record<string, unknown> | undefined;
  if (isUpdate && body.id) {
    const { data: existing } = await supabase!
      .from('strategies').select('*').eq('id', body.id).single();
    beforeSnapshot = existing ?? undefined;
  }

  const data = await upsertStrategy(body as { name: string }, tenantId);
  if (!data) return NextResponse.json({ error: 'Failed to save strategy' }, { status: 500 });

  // Auto-version snapshot
  const { data: existingVersions } = await supabase!
    .from('strategy_versions')
    .select('version')
    .eq('strategy_id', data.id)
    .order('version', { ascending: false })
    .limit(1);
  const nextVersion = (existingVersions?.[0]?.version ?? 0) + 1;

  await supabase!.from('strategy_versions').insert({
    tenant_id:      tenantId,
    strategy_id:    data.id,
    version:        nextVersion,
    snapshot:       data,
    changed_by:     changedBy,
    change_summary: isUpdate ? 'Updated via UI' : 'Initial creation',
  });

  // Config audit log
  await insertConfigAudit({
    tenant_id:        tenantId,
    entity_type:      'strategy',
    entity_id:        data.id,
    entity_name:      data.name,
    action:           isUpdate ? 'updated' : 'created',
    changed_by:       changedBy,
    before_snapshot:  beforeSnapshot,
    after_snapshot:   data as unknown as Record<string, unknown>,
  }, tenantId);

  return NextResponse.json({ data, version: nextVersion });
}

export async function DELETE(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const id       = req.nextUrl.searchParams.get('id') ?? '';
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? 'f0000000-0000-4000-a000-000000000001';
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Fetch name for audit before delete
  const { data: existing } = await supabase!.from('strategies').select('name').eq('id', id).single();

  const { error } = await supabase!.from('strategies').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await insertConfigAudit({
    tenant_id:   tenantId,
    entity_type: 'strategy',
    entity_id:   id,
    entity_name: existing?.name,
    action:      'deleted',
  }, tenantId);

  return NextResponse.json({ success: true });
}
