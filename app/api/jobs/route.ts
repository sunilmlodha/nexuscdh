/**
 * Async decisioning jobs.
 * GET  ?tenantId=        — list jobs (newest first)
 * POST { type:'campaign', refId } — enqueue a job (returns immediately; the
 *        worker at /api/jobs/tick processes it in chunks)
 */
import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-guard';
import { log } from '@/lib/logger';

export async function GET(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? 'f0000000-0000-4000-a000-000000000001';
  const { data, error } = await serviceSupabase!
    .from('decision_jobs').select('*').eq('tenant_id', tenantId)
    .order('created_at', { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, configured: true });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const guard = await requireAuth('strategies:write');
  if (!guard.ok) return guard.res;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const refId = body.refId as string;
  if (!refId) return NextResponse.json({ error: 'refId required' }, { status: 422 });

  const { data, error } = await serviceSupabase!
    .from('decision_jobs')
    .insert({ tenant_id: guard.ctx.tenantId, type: 'campaign', ref_id: refId, status: 'queued', created_by: guard.ctx.email })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  log.info('job.enqueued', { tenantId: guard.ctx.tenantId, jobId: data.id, refId });
  return NextResponse.json({ data });
}
