/**
 * OAuth callback — exchanges the provider code for a Supabase session, ensures
 * the user has a role row (default read_only), then redirects into the app.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { serviceSupabase } from '@/lib/supabase';

const TENANT = 'f0000000-0000-4000-a000-000000000001';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const next = req.nextUrl.searchParams.get('next') ?? '/';
  const origin = req.nextUrl.origin;

  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const supabase = createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);

  // Ensure a role row exists for this user (default read_only on first sign-in)
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email && serviceSupabase) {
    const email = user.email.toLowerCase();
    const name = (user.user_metadata?.full_name as string) ?? (user.user_metadata?.name as string) ?? user.email;
    const { data: existing } = await serviceSupabase
      .from('user_roles').select('id').eq('tenant_id', TENANT).ilike('email', email).maybeSingle();
    if (existing) {
      await serviceSupabase.from('user_roles').update({ last_login: new Date().toISOString(), name }).eq('id', existing.id);
    } else {
      await serviceSupabase.from('user_roles').insert({ tenant_id: TENANT, email, name, role: 'read_only', last_login: new Date().toISOString() });
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
