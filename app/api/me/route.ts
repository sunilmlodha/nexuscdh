/**
 * GET /api/me — the current SSO session + resolved app role.
 * Returns { authenticated:false } when no session (the app then stays in demo
 * mode); otherwise { authenticated:true, email, name, role, status }.
 */
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { serviceSupabase, IS_CONFIGURED } from '@/lib/supabase';

const TENANT = 'f0000000-0000-4000-a000-000000000001';

export async function GET() {
  if (!IS_CONFIGURED) return NextResponse.json({ authenticated: false, configured: false });

  let user = null;
  try { ({ data: { user } } = await createServerSupabase().auth.getUser()); }
  catch { return NextResponse.json({ authenticated: false }); }
  if (!user?.email) return NextResponse.json({ authenticated: false });

  const email = user.email.toLowerCase();
  let role = 'read_only', name = (user.user_metadata?.full_name as string) ?? user.email, status = 'active';
  if (serviceSupabase) {
    const { data } = await serviceSupabase
      .from('user_roles').select('role, name, status').eq('tenant_id', TENANT).ilike('email', email).maybeSingle();
    if (data) { role = data.role; name = data.name ?? name; status = data.status; }
  }

  return NextResponse.json({ authenticated: true, email, name, role, status });
}
