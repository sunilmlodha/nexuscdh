/**
 * POST /api/car          — upsert one or more customer attribute records
 * GET  /api/car?id=X     — fetch a single profile
 * GET  /api/car          — list all profiles (paginated)
 * DELETE /api/car?id=X   — delete a profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? '';
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const TENANT = 'default-tenant';

function db() {
  if (!URL || !KEY) throw new Error('Supabase not configured');
  return createClient(URL, KEY);
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const id    = searchParams.get('id');
  const page  = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '20', 10);
  const search = searchParams.get('q') ?? '';

  try {
    const client = db();

    if (id) {
      const { data, error } = await client
        .from('customer_profiles').select('*')
        .eq('tenant_id', TENANT).eq('customer_id', id).single();
      if (error) return NextResponse.json({ error: error.message }, { status: 404 });
      return NextResponse.json(data);
    }

    let q = client.from('customer_profiles').select('*', { count: 'exact' })
      .eq('tenant_id', TENANT)
      .order('last_seen_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (search) {
      q = q.ilike('customer_id', `%${search}%`);
    }

    const { data, count, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ profiles: data ?? [], total: count ?? 0, page, limit });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'DB error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // Accept single profile or array
  const records = Array.isArray(body) ? body : [body];
  const results: { ok: number; errors: string[] } = { ok: 0, errors: [] };

  try {
    const client = db();
    for (const rec of records) {
      const r = rec as Record<string, unknown>;
      const customerId = (r.customer_id ?? r.id ?? r.customerId) as string | undefined;
      if (!customerId) { results.errors.push('Missing customer_id'); continue; }

      // Allow top-level fields OR nested attributes object
      const attributes: Record<string, unknown> = typeof r.attributes === 'object' && r.attributes !== null
        ? (r.attributes as Record<string, unknown>)
        : { ...r };
      delete attributes.customer_id;
      delete attributes.tenant_id;
      delete attributes.id;

      const { error } = await client.from('customer_profiles').upsert({
        tenant_id: TENANT,
        customer_id: customerId,
        attributes,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,customer_id' });

      if (error) results.errors.push(`${customerId}: ${error.message}`);
      else results.ok++;
    }
    return NextResponse.json(results);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'DB error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  try {
    const client = db();
    await client.from('customer_profiles').delete()
      .eq('tenant_id', TENANT).eq('customer_id', id);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'DB error' }, { status: 500 });
  }
}
