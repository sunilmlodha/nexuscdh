/**
 * Channel adapter config — how each channel actually delivers.
 * GET ?tenantId= · POST (create/update) · DELETE ?id=&tenantId=
 */
import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase } from '@/lib/supabase';
import { writeAudit } from '@/lib/audit';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';
const VALID_PROVIDERS = ['mock', 'webhook', 'sendgrid', 'twilio'];

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });
  const { data, error } = await serviceSupabase!
    .from('channel_adapters').select('*').eq('tenant_id', tenantId).order('channel');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, configured: true });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const tenantId = (body.tenantId as string) ?? DEFAULT_TENANT;
  const actor    = (body.actor as string) ?? 'delivery-ui';
  if (!body.channel) return NextResponse.json({ error: 'channel required' }, { status: 422 });
  if (body.provider && !VALID_PROVIDERS.includes(body.provider as string))
    return NextResponse.json({ error: `Invalid provider: ${body.provider}` }, { status: 422 });

  const payload = {
    tenant_id:    tenantId,
    channel:      body.channel,
    provider:     body.provider ?? 'mock',
    endpoint_url: body.endpoint_url ?? null,
    api_key:      body.api_key ?? null,
    config:       body.config ?? {},
    status:       body.status ?? 'active',
    updated_at:   new Date().toISOString(),
  };

  let data: Record<string, unknown> | null, error: { message: string } | null;
  if (body.id) {
    ({ data, error } = await serviceSupabase!.from('channel_adapters').update(payload).eq('id', body.id).eq('tenant_id', tenantId).select().single());
  } else {
    // upsert on (tenant, channel) so each channel has one adapter
    ({ data, error } = await serviceSupabase!.from('channel_adapters').upsert(payload, { onConflict: 'tenant_id,channel' }).select().single());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({ tenantId, entityType: 'channel_adapter', entityId: String(data!.id), entityName: String(body.channel), action: body.id ? 'updated' : 'created', changedBy: actor, after: data });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const id = req.nextUrl.searchParams.get('id');
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await serviceSupabase!.from('channel_adapters').delete().eq('id', id).eq('tenant_id', tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
