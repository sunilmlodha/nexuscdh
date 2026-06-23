/**
 * OAuth callback — exchanges the provider code for a Supabase session, ensures
 * the user has a role row (default read_only), then redirects into the app.
 *
 * Cookies are bound to the REDIRECT response (not next/headers) so the session
 * actually persists across the redirect — otherwise /api/me sees no session and
 * the app bounces back to /login.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { serviceSupabase } from '@/lib/supabase';

const TENANT = 'f0000000-0000-4000-a000-000000000001';
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const next = req.nextUrl.searchParams.get('next') ?? '/';
  const origin = req.nextUrl.origin;

  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  // Write auth cookies onto THIS response so they survive the redirect.
  const response = NextResponse.redirect(`${origin}${next}`);
  const supabase = createServerClient(URL, KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (toSet) => toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });

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

  return response;
}
