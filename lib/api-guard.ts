/**
 * Route guard — call at the top of an API handler to enforce authentication +
 * RBAC and obtain the (non-spoofable) tenant context.
 *
 *   const g = await requireAuth('strategies:write');
 *   if (!g.ok) return g.res;
 *   const { tenantId, role, email } = g.ctx;
 *
 * Behaviour:
 *  - ENFORCE_AUTH=true + no session  → 401
 *  - authenticated + lacks permission → 403
 *  - demo (no session, ENFORCE_AUTH off) → allowed as tenant_admin (full access)
 */
import { NextResponse } from 'next/server';
import { getAuthContext, ENFORCE_AUTH, type AuthContext } from './tenant';
import { roleHasPermission, type Permission } from './rbac';

export type GuardResult = { ok: true; ctx: AuthContext } | { ok: false; res: NextResponse };

export async function requireAuth(permission?: Permission): Promise<GuardResult> {
  const ctx = await getAuthContext();

  if (ENFORCE_AUTH && !ctx.authenticated) {
    return { ok: false, res: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  }
  // Enforce RBAC for authenticated users; demo (unauthenticated, enforcement off) is full-access.
  if (permission && ctx.authenticated && !roleHasPermission(ctx.role, permission)) {
    return { ok: false, res: NextResponse.json({ error: `Forbidden — your role (${ctx.role}) lacks ${permission}` }, { status: 403 }) };
  }
  return { ok: true, ctx };
}
