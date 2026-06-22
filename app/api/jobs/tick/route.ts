/**
 * Async decisioning worker — POST|GET /api/jobs/tick
 *
 * Advances queued/running decision_jobs by ONE bounded chunk each (CHUNK rows,
 * paged by customer_id cursor), so no single request processes the whole base.
 * Cron-driven (see vercel.json) + manual trigger from the Jobs page.
 * Honours CRON_SECRET when set.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  IS_CONFIGURED, serviceSupabase,
  fetchStrategies, fetchActions, fetchPolicies, insertDecisionLog,
} from '@/lib/supabase';
import { evaluateClause, type RuleClause } from '@/lib/arbitration';
import { globalNBA, carFromAttributes } from '@/lib/decision-engine';
import { deliverForDecision } from '@/lib/deliver-service';
import { log } from '@/lib/logger';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';
const CHUNK = 200;

async function run(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') ?? '';
    const sameOrigin = (req.headers.get('origin') ?? '') !== '' || (req.headers.get('referer') ?? '').includes('/jobs');
    if (auth !== `Bearer ${secret}` && !sameOrigin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;

  // claim the oldest active job
  const { data: jobs } = await serviceSupabase!
    .from('decision_jobs').select('*').eq('tenant_id', tenantId).in('status', ['queued', 'running'])
    .order('created_at', { ascending: true }).limit(1);
  const job = jobs?.[0];
  if (!job) return NextResponse.json({ ok: true, idle: true });

  const { data: campaign } = await serviceSupabase!
    .from('campaigns').select('*').eq('id', job.ref_id).eq('tenant_id', tenantId).maybeSingle();
  if (!campaign) {
    await serviceSupabase!.from('decision_jobs').update({ status: 'failed', error: 'Campaign not found', updated_at: new Date().toISOString() }).eq('id', job.id);
    return NextResponse.json({ ok: false, error: 'Campaign not found' });
  }

  // load the next chunk of customers after the cursor
  const { data: profiles } = await serviceSupabase!
    .from('customer_profiles').select('customer_id, attributes')
    .eq('tenant_id', tenantId).gt('customer_id', job.cursor ?? '')
    .order('customer_id', { ascending: true }).limit(CHUNK);
  const rows = profiles ?? [];

  if (rows.length === 0) {
    await serviceSupabase!.from('decision_jobs').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', job.id);
    log.info('job.completed', { tenantId, jobId: job.id, processed: job.processed, served: job.served });
    return NextResponse.json({ ok: true, jobId: job.id, status: 'completed', processed: job.processed, served: job.served });
  }

  const [strategies, actions, policies] = await Promise.all([fetchStrategies(tenantId), fetchActions(tenantId), fetchPolicies(tenantId)]);
  const action = campaign.action_id ? actions.find(a => a.id === campaign.action_id) : null;
  const zero = { today: 0, week: 0, month: 0 };
  const rules = (campaign.audience_rules ?? []) as RuleClause[];

  let served = 0, suppressed = 0;
  for (const p of rows) {
    const attrs = p.attributes ?? {};
    if (!rules.every(r => evaluateClause(attrs, r))) { suppressed++; continue; }
    const car = carFromAttributes(p.customer_id, attrs);
    if (car.consentGiven === false) { suppressed++; continue; }

    if (campaign.mode === 'segment') {
      if (!action) { suppressed++; continue; }
      const ch = campaign.channel ?? action.channels?.[0] ?? 'email';
      const logId = await insertDecisionLog({ tenant_id: tenantId, customer_id: p.customer_id, strategy_name: `Campaign: ${campaign.name}`, action_id: action.id, action_name: action.name, channel_id: ch, served: true, propensity: action.base_propensity, customer_attributes: attrs, trace: [{ step: 'async-segment-campaign', jobId: job.id }] }, tenantId);
      try { await deliverForDecision({ tenantId, decisionId: logId ?? undefined, customerId: p.customer_id, channel: ch, actionId: action.id, actionName: action.name, treatmentId: campaign.treatment_id ?? null }); } catch { /* non-fatal */ }
      served++;
    } else {
      const nba = globalNBA(car, { strategies, actions, policies, contactCounts: zero });
      if (nba.winner && nba.served) {
        const logId = await insertDecisionLog({ tenant_id: tenantId, customer_id: p.customer_id, strategy_name: `Campaign: ${campaign.name} · ${nba.winner.strategy.name}`, action_id: nba.winner.action.id, action_name: nba.winner.action.name, channel_id: nba.winner.action.channels?.[0] ?? 'web', served: true, propensity: nba.winner.action.base_propensity, customer_attributes: attrs, trace: [{ step: 'async-1:1-campaign', jobId: job.id }] }, tenantId);
        try { await deliverForDecision({ tenantId, decisionId: logId ?? undefined, customerId: p.customer_id, channel: nba.winner.action.channels?.[0] ?? 'web', actionId: nba.winner.action.id, actionName: nba.winner.action.name }); } catch { /* non-fatal */ }
        served++;
      } else suppressed++;
    }
  }

  const lastCursor = rows[rows.length - 1].customer_id;
  await serviceSupabase!.from('decision_jobs').update({
    status: 'running', cursor: lastCursor,
    processed: (job.processed ?? 0) + rows.length, served: (job.served ?? 0) + served, suppressed: (job.suppressed ?? 0) + suppressed,
    updated_at: new Date().toISOString(),
  }).eq('id', job.id);

  return NextResponse.json({ ok: true, jobId: job.id, status: 'running', chunk: rows.length, served, suppressed, cursor: lastCursor });
}

export async function POST(req: NextRequest) { return run(req); }
export async function GET(req: NextRequest)  { return run(req); }
