/**
 * Server-side auth/tenant context.
 *
 * Resolves the tenant + role from the VERIFIED Supabase session (never from a
 * request body/query, so neither can be spoofed). With no session the app falls
 * back to the demo tenant with full access — unless ENFORCE_AUTH=true, in which
 * case unauthenticated requests are rejected by the guard.
 */
import { createServerSupabase } from './supabase-server';
import { serviceSupabase } from './supabase';
import type { Role } from './rbac';

export const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';
export const ENFORCE_AUTH = process.env.ENFORCE_AUTH === 'true';

export interface AuthContext {
  tenantId: string;
  email: string | null;
  role: Role;
  authenticated: boolean;
}

export async function getAuthContext(): Promise<AuthContext> {
  let email: string | null = null;
  try {
    const { data: { user } } = await createServerSupabase().auth.getUser();
    email = user?.email?.toLowerCase() ?? null;
  } catch { email = null; }

  if (email && serviceSupabase) {
    const { data } = await serviceSupabase
      .from('user_roles').select('tenant_id, role, status').ilike('email', email).maybeSingle();
    if (data && data.status !== 'disabled') {
      return { tenantId: data.tenant_id ?? DEFAULT_TENANT, email, role: (data.role as Role) ?? 'read_only', authenticated: true };
    }
    // signed in but no role row yet → least privilege, default tenant
    return { tenantId: DEFAULT_TENANT, email, role: 'read_only', authenticated: true };
  }

  // No session → demo workspace, full access (unless ENFORCE_AUTH blocks at the guard)
  return { tenantId: DEFAULT_TENANT, email: null, role: 'tenant_admin', authenticated: false };
}
