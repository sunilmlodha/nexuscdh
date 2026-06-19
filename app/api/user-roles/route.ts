/**
 * User role administration (RBAC).
 * GET    ?tenantId=  — list users + roles
 * POST   { email, role, name?, status? } — assign/update a user's role (admin only when auth on)
 * DELETE ?id=&tenantId=
 *
 * When a real session exists, only super_admin / tenant_admin may modify roles.
 */
import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase } from '@/lib/supabase';
import { createServerSupabase } from '@/lib/supabase-server';
import { writeAudit } from '@/lib/audit';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';
const ADMIN_ROLES = ['super_admin', 'tenant_admin'];
const VALID_ROLES = ['super_admin', 'tenant_admin', 'strategy_manager', 'campaign_analyst', 'channel_manager', 'data_scientist', 'ops_manager', 'read_only'];

/** Resolve the caller's role from their session; null if no session (demo mode). */
async function callerRole(tenantId: string): Promise<string | null> {
  try {
    const { data: { user } } = await createServerSupabase().auth.getUser();
    if (!user?.email || !serviceSupabase) return null;
    const { data } = await serviceSupabase.from('user_roles').select('role').eq('tenant_id', tenantId).ilike('email', user.email.toLowerCase()).maybeSingle();
    return data?.role ?? 'read_only';
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });
  const { data, error } = await serviceSupabase!
    .from('user_roles').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, configured: true });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const tenantId = (body.tenantId as string) ?? DEFAULT_TENANT;

  // If a real session exists, require an admin role to modify
  const role = await callerRole(tenantId);
  if (role !== null && !ADMIN_ROLES.includes(role))
    return NextResponse.json({ error: 'Only Tenant Admin / Super Admin can change roles' }, { status: 403 });

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 422 });
  if (body.role && !VALID_ROLES.includes(body.role as string))
    return NextResponse.json({ error: `Invalid role: ${body.role}` }, { status: 422 });

  const payload: Record<string, unknown> = {
    tenant_id: tenantId, email, role: body.role ?? 'read_only',
    status: body.status ?? 'active', updated_at: new Date().toISOString(),
  };
  if (body.name !== undefined) payload.name = body.name;

  // Manual upsert keyed on lower(email) (the table's unique index is functional,
  // so ON CONFLICT can't target it).
  const { data: existing } = await serviceSupabase!
    .from('user_roles').select('id').eq('tenant_id', tenantId).ilike('email', email).maybeSingle();

  let data: Record<string, unknown> | null, error: { message: string } | null;
  if (existing) {
    ({ data, error } = await serviceSupabase!.from('user_roles').update(payload).eq('id', existing.id).select().single());
  } else {
    ({ data, error } = await serviceSupabase!.from('user_roles').insert(payload).select().single());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({ tenantId, entityType: 'user_role', entityId: String(data!.id), entityName: email, action: 'updated', changedBy: 'rbac-ui', after: data });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const role = await callerRole(tenantId);
  if (role !== null && !ADMIN_ROLES.includes(role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const { error } = await serviceSupabase!.from('user_roles').delete().eq('id', id).eq('tenant_id', tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
