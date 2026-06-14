import { NextRequest, NextResponse } from 'next/server';
import { createApiKey, listApiKeys, revokeApiKey, IS_CONFIGURED } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? 'default-tenant';
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });
  const keys = await listApiKeys(tenantId);
  return NextResponse.json({ data: keys, configured: true });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  let body: { name: string; tenantId?: string; createdBy?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { name, tenantId = 'default-tenant', createdBy } = body;
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const result = await createApiKey(tenantId, name, createdBy);
  if (!result) return NextResponse.json({ error: 'Failed to create key' }, { status: 500 });

  return NextResponse.json({
    key: result.key,
    record: result.record,
    warning: 'Store this key securely — it will not be shown again',
  });
}

export async function DELETE(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await revokeApiKey(id);
  return NextResponse.json({ success: true });
}
