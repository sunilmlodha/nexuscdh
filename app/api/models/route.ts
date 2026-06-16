/**
 * GET /api/models
 *
 * Returns adaptive models from the adaptive_models table, enriched with
 * live acceptance stats from decision_log.
 */

import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? 'f0000000-0000-4000-a000-000000000001';

  if (!IS_CONFIGURED || !serviceSupabase) {
    return NextResponse.json({ data: [], configured: false });
  }

  const { data: models, error } = await serviceSupabase
    .from('adaptive_models')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: models ?? [], configured: true });
}
