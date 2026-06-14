import { NextRequest, NextResponse } from 'next/server';
import { fetchStrategies, upsertStrategy, supabase, IS_CONFIGURED } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? 'default-tenant';
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });
  const data = await fetchStrategies(tenantId);
  return NextResponse.json({ data, configured: true });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const body = await req.json();
  const tenantId = body.tenantId ?? 'default-tenant';
  const data = await upsertStrategy(body, tenantId);
  if (!data) return NextResponse.json({ error: 'Failed to save strategy' }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await supabase!.from('strategies').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
