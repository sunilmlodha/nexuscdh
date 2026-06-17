/**
 * POST /api/campaigns/run  { id, tenantId }
 *
 * Executes a campaign across its audience:
 *   1:1     — globalNBA arbitrates the best action per matching customer
 *   segment — the campaign's fixed action + treatment is assigned to every
 *             matching, consented customer (treatment must be a live offer)
 * Served decisions are written to decision_log so Analytics/Lift pick them up.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  IS_CONFIGURED, serviceSupabase,
  fetchStrategies, fetchActions, fetchPolicies, fetchCustomerProfiles, insertDecisionLog,
} from '@/lib/supabase';
import { evaluateClause, type RuleClause } from '@/lib/arbitration';
import { globalNBA, carFromAttributes } from '@/lib/decision-engine';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';

function offerLive(t: { offer_state?: string; effective_from?: string | null; effective_to?: string | null } | null): boolean {
  if (!t) return true; // no treatment pinned → treated as deliverable
  if (t.offer_state && t.offer_state !== 'live') return false;
  const today = new Date().toISOString().slice(0, 10);
  if (t.effective_from && today < t.effective_from) return false;
  if (t.effective_to && today > t.effective_to) return false;
  return true;
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const tenantId = (body.tenantId as string) ?? DEFAULT_TENANT;
  const id = body.id as string;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data: campaign } = await serviceSupabase!
    .from('campaigns').select('*').eq('id', id).eq('tenant_id', tenantId).single();
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const [strategies, actions, policies, profiles] = await Promise.all([
    fetchStrategies(tenantId), fetchActions(tenantId), fetchPolicies(tenantId),
    fetchCustomerProfiles(tenantId, 1000),
  ]);

  const rules = (campaign.audience_rules ?? []) as RuleClause[];
  const inSegment = (attrs: Record<string, unknown>) => rules.every(r => evaluateClause(attrs, r));

  // Resolve the fixed offer for segment mode
  const action = campaign.action_id ? actions.find(a => a.id === campaign.action_id) : null;
  let treatment: { id: string; name: string; offer_state?: string; effective_from?: string | null; effective_to?: string | null } | null = null;
  if (campaign.treatment_id) {
    const { data: t } = await serviceSupabase!
      .from('treatments').select('id, name, offer_state, effective_from, effective_to')
      .eq('id', campaign.treatment_id).eq('tenant_id', tenantId).single();
    treatment = t;
  }

  const zero = { today: 0, week: 0, month: 0 };
  let matched = 0, served = 0, suppressed = 0;
  const reasons: Record<string, number> = {};
  const bump = (k: string) => { reasons[k] = (reasons[k] ?? 0) + 1; };

  // Segment mode: gate once on the offer being live
  if (campaign.mode === 'segment' && !offerLive(treatment)) {
    return NextResponse.json({
      error: `Treatment "${treatment?.name ?? ''}" is not a live offer (state: ${treatment?.offer_state ?? 'n/a'} or outside its effective window). Set it live before running.`,
    }, { status: 409 });
  }

  for (const p of profiles) {
    const attrs = p.attributes ?? {};
    if (!inSegment(attrs)) continue;
    matched++;

    const car = carFromAttributes(p.customer_id, attrs);
    if (car.consentGiven === false) { suppressed++; bump('no_consent'); continue; }

    if (campaign.mode === 'segment') {
      if (!action) { suppressed++; bump('no_action'); continue; }
      await insertDecisionLog({
        tenant_id: tenantId, customer_id: p.customer_id,
        // strategy_id omitted: campaign decisions aren't tied to a strategy row (FK)
        strategy_name: `Campaign: ${campaign.name}`,
        action_id: action.id, action_name: action.name,
        channel_id: campaign.channel ?? action.channels?.[0] ?? 'email',
        served: true, propensity: action.base_propensity,
        customer_attributes: attrs,
        trace: [{ step: 'segment-campaign', campaignId: campaign.id, treatmentId: treatment?.id ?? null }],
      }, tenantId);
      served++;
    } else {
      const nba = globalNBA(car, { strategies, actions, policies, contactCounts: zero });
      if (nba.winner && nba.served) {
        await insertDecisionLog({
          tenant_id: tenantId, customer_id: p.customer_id,
          strategy_id: nba.winner.strategy.id, strategy_name: `Campaign: ${campaign.name} · ${nba.winner.strategy.name}`,
          action_id: nba.winner.action.id, action_name: nba.winner.action.name,
          channel_id: nba.winner.action.channels?.[0] ?? 'web',
          served: true, propensity: nba.winner.action.base_propensity,
          customer_attributes: attrs,
          trace: [{ step: '1:1-campaign', campaignId: campaign.id, priority: nba.winner.breakdown.priority }],
        }, tenantId);
        served++;
      } else { suppressed++; bump(nba.isControl ? 'control' : 'no_eligible_action'); }
    }
  }

  const stats = { total: profiles.length, matched, served, suppressed, reasons };
  await serviceSupabase!.from('campaigns')
    .update({ last_run_at: new Date().toISOString(), last_run_stats: stats, updated_at: new Date().toISOString() })
    .eq('id', id).eq('tenant_id', tenantId);

  return NextResponse.json({ ok: true, mode: campaign.mode, stats });
}
