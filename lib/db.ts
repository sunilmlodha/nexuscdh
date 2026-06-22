/**
 * Tenant-aware DB client selector.
 *
 * dbFor(ctx) returns:
 *   - the SESSION-scoped client (RLS-enforced; Postgres denies cross-tenant rows)
 *     when ENFORCE_AUTH is on and the request is authenticated
 *   - the service-role client (RLS-bypassing; current default) otherwise
 *
 * This is the activation switch for schema_v15_rls.sql: as routes adopt dbFor()
 * for their reads/writes (post-SSO), the database itself enforces tenant
 * isolation instead of relying solely on app-layer `.eq('tenant_id', …)` filters.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceSupabase } from './supabase';
import { createServerSupabase } from './supabase-server';
import { ENFORCE_AUTH, type AuthContext } from './tenant';

export function dbFor(ctx: AuthContext): SupabaseClient {
  if (ENFORCE_AUTH && ctx.authenticated) {
    return createServerSupabase() as unknown as SupabaseClient;
  }
  return serviceSupabase as unknown as SupabaseClient;
}
