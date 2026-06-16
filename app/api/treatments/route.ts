import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase } from '@/lib/supabase';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  const actionId = req.nextUrl.searchParams.get('actionId');
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });

  let query = serviceSupabase!
    .from('treatments')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (actionId) query = query.eq('action_id', actionId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, configured: true });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const tenantId = (body.tenantId as string) ?? DEFAULT_TENANT;
  const payload = {
    tenant_id:     tenantId,
    action_id:     body.action_id ?? null,
    name:          body.name,
    description:   body.description ?? null,
    channel:       body.channel ?? null,
    headline:      body.headline ?? null,
    body_copy:     body.body_copy ?? null,
    cta_label:     body.cta_label ?? null,
    offer_code:    body.offer_code ?? null,
    offer_value:   body.offer_value ?? null,
    variant_label: body.variant_label ?? null,
    status:        body.status ?? 'draft',
    updated_at:    new Date().toISOString(),
  };

  let data: unknown, error: unknown;
  if (body.id) {
    ({ data, error } = await serviceSupabase!
      .from('treatments').update(payload).eq('id', body.id).eq('tenant_id', tenantId).select().single());
  } else {
    ({ data, error } = await serviceSupabase!
      .from('treatments').insert(payload).select().single());
  }

  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const id = req.nextUrl.searchParams.get('id');
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await serviceSupabase!
    .from('treatments').delete().eq('id', id).eq('tenant_id', tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
