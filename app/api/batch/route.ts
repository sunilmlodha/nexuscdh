import { NextRequest, NextResponse } from 'next/server';
import {
  fetchBatchJobs, upsertBatchJob,
  fetchStrategies, fetchActions, fetchPolicies,
  fetchCustomerProfiles, insertDecisionLog,
  getContactCounts, incrementContactCount,
  IS_CONFIGURED, supabase,
  DBStrategy, DBAction, DBContactPolicy,
} from '@/lib/supabase';

// Inline decision logic — self-contained, mirrors /api/decide engine
function evaluateForBatch(
  strategy: DBStrategy,
  policy: DBContactPolicy | null,
  actions: DBAction[],
  car: Record<string, unknown>,
  contactCounts: { today: number; week: number; month: number }
): { outcome: 'PASS' | 'SUPPRESSED' | 'NOT_APPLICABLE'; action: DBAction | null; reason: string } {
  if (car['consentGiven'] === false)
    return { outcome: 'SUPPRESSED', action: null, reason: 'Consent not given' };
  if (strategy.status !== 'active')
    return { outcome: 'NOT_APPLICABLE', action: null, reason: 'Inactive strategy' };

  const maxDay  = policy?.max_per_day  ?? 2;
  const maxWeek = policy?.max_per_week ?? 5;
  if (contactCounts.today >= maxDay)
    return { outcome: 'SUPPRESSED', action: null, reason: 'Daily contact limit' };
  if (contactCounts.week >= maxWeek)
    return { outcome: 'SUPPRESSED', action: null, reason: 'Weekly contact limit' };

  const eligible = actions.filter(a => strategy.action_ids.includes(a.id) && a.status === 'active');
  if (!eligible.length)
    return { outcome: 'NOT_APPLICABLE', action: null, reason: 'No active actions' };

  const best = [...eligible].sort((a, b) => b.base_propensity - a.base_propensity)[0];
  return { outcome: 'PASS', action: best, reason: 'All gates passed' };
}

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? 'default-tenant';
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });
  const jobs = await fetchBatchJobs(tenantId);
  return NextResponse.json({ data: jobs, configured: true });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  let body: {
    name: string; strategyIds: string[]; channelId?: string;
    audienceId?: string; tenantId?: string; runNow?: boolean;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { name, strategyIds, channelId, audienceId, tenantId = 'default-tenant', runNow = false } = body;
  if (!name || !strategyIds?.length)
    return NextResponse.json({ error: 'name and strategyIds required' }, { status: 400 });

  const job = await upsertBatchJob({
    name, strategy_ids: strategyIds, channel_id: channelId,
    audience_id: audienceId, status: 'pending',
    run_at: new Date().toISOString(),
  }, tenantId);

  if (!job) return NextResponse.json({ error: 'Failed to create batch job' }, { status: 500 });

  if (runNow) {
    // Fire-and-forget async execution
    (async () => {
      try {
        await supabase!.from('batch_jobs').update({ status: 'running' }).eq('id', job.id);

        const [strategies, actions, policies, profiles] = await Promise.all([
          fetchStrategies(tenantId),
          fetchActions(tenantId),
          fetchPolicies(tenantId),
          fetchCustomerProfiles(tenantId, 10000),
        ]);

        const targetStrategies = strategies.filter(
          s => strategyIds.includes(s.id) && s.status === 'active'
        );

        let served = 0, suppressed = 0;

        for (const profile of profiles) {
          const car: Record<string, unknown> = {
            customerId: profile.customer_id,
            consentGiven: true,
            ...profile.attributes,
          };
          const counts = await getContactCounts(tenantId, profile.customer_id);

          for (const strategy of targetStrategies) {
            const policy = strategy.policy_id
              ? policies.find(p => p.id === strategy.policy_id) ?? null
              : null;
            const result = evaluateForBatch(strategy, policy, actions, car, counts);

            await insertDecisionLog({
              tenant_id: tenantId,
              customer_id: profile.customer_id,
              strategy_id: strategy.id,
              strategy_name: strategy.name,
              action_id: result.outcome === 'PASS' ? result.action?.id : undefined,
              action_name: result.outcome === 'PASS' ? result.action?.name : undefined,
              channel_id: channelId,
              served: result.outcome === 'PASS',
              suppression_reason: result.outcome !== 'PASS' ? result.reason : undefined,
              propensity: result.action?.base_propensity,
              customer_attributes: profile.attributes,
              trace: [{ step: 'batch', outcome: result.outcome }],
            }, tenantId);

            if (result.outcome === 'PASS') {
              served++;
              if (channelId) await incrementContactCount(tenantId, profile.customer_id, channelId);
            } else {
              suppressed++;
            }
          }
        }

        await supabase!.from('batch_jobs').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_customers: profiles.length,
          served_count: served,
          suppressed_count: suppressed,
        }).eq('id', job.id);

      } catch (e) {
        await supabase!.from('batch_jobs').update({
          status: 'failed',
          error_message: String(e),
        }).eq('id', job.id);
      }
    })();
  }

  return NextResponse.json({ job, message: runNow ? 'Batch started — running in background' : 'Batch job queued' });
}

export async function DELETE(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase!.from('batch_jobs').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
