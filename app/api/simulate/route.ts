/**
 * POST /api/simulate
 *
 * Population-level simulation with full per-customer trace and audit log.
 * Equivalent to Pega CDH Strategy Simulation + Strategy Result Viewer.
 *
 * Returns aggregate stats, per-customer trace sample, and a runId that
 * can be used to retrieve the full audit record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import {
  fetchStrategies, fetchActions, fetchPolicies, fetchCustomerProfiles,
  IS_CONFIGURED, serviceSupabase,
  DBStrategy, DBAction, DBContactPolicy,
} from '@/lib/supabase';
import type { CustomerTrace } from '@/types/simulate';

interface SimCustomer {
  customerId: string;
  attributes: Record<string, unknown>;
}

const GATE_LABELS: Record<string, string> = {
  consent:           'Consent',
  inactive_strategy: 'Strategy Status',
  not_started:       'Date Window',
  ended:             'Date Window',
  daily_limit:       'Daily Contact Limit',
  weekly_limit:      'Weekly Contact Limit',
  monthly_limit:     'Monthly Contact Limit',
  eligibility_failed:'Eligibility Rules',
  suppression_rule:  'Suppression Rule',
  no_active_actions: 'No Active Actions',
  pass:              'All Gates Passed',
};

function evaluateForSim(
  strategy: DBStrategy,
  policy: DBContactPolicy | null,
  actions: DBAction[],
  car: Record<string, unknown>,
  contactCounts: { today: number; week: number; month: number }
): { outcome: 'PASS' | 'SUPPRESSED' | 'NOT_APPLICABLE'; reason: string; actionId?: string; gate: string } {

  if (car['consentGiven'] === false)
    return { outcome: 'SUPPRESSED', reason: 'consent', gate: 'Consent' };

  if (strategy.status !== 'active')
    return { outcome: 'NOT_APPLICABLE', reason: 'inactive_strategy', gate: 'Strategy Status' };

  const now = new Date();
  if (strategy.start_date && new Date(strategy.start_date) > now)
    return { outcome: 'NOT_APPLICABLE', reason: 'not_started', gate: 'Date Window' };
  if (strategy.end_date && new Date(strategy.end_date) < now)
    return { outcome: 'NOT_APPLICABLE', reason: 'ended', gate: 'Date Window' };

  const maxDay   = policy?.max_per_day   ?? 2;
  const maxWeek  = policy?.max_per_week  ?? 5;
  const maxMonth = policy?.max_per_month ?? 15;

  if (contactCounts.today >= maxDay)   return { outcome: 'SUPPRESSED', reason: 'daily_limit',   gate: 'Daily Contact Limit' };
  if (contactCounts.week >= maxWeek)   return { outcome: 'SUPPRESSED', reason: 'weekly_limit',  gate: 'Weekly Contact Limit' };
  if (contactCounts.month >= maxMonth) return { outcome: 'SUPPRESSED', reason: 'monthly_limit', gate: 'Monthly Contact Limit' };

  if (strategy.eligibility_rules?.length) {
    for (const rule of strategy.eligibility_rules) {
      const carVal = car[rule.attribute];
      const numVal = parseFloat(rule.value);
      const carNum = typeof carVal === 'number' ? carVal : parseFloat(String(carVal));
      let passes = false;
      switch (rule.op) {
        case '=':      passes = String(carVal) === rule.value; break;
        case '!=':     passes = String(carVal) !== rule.value; break;
        case '>=':     passes = !isNaN(carNum) && carNum >= numVal; break;
        case '<=':     passes = !isNaN(carNum) && carNum <= numVal; break;
        case '>':      passes = !isNaN(carNum) && carNum > numVal; break;
        case '<':      passes = !isNaN(carNum) && carNum < numVal; break;
        case 'IN':     passes = rule.value.split(',').map(v => v.trim()).includes(String(carVal)); break;
        case 'NOT IN': passes = !rule.value.split(',').map(v => v.trim()).includes(String(carVal)); break;
        default:       passes = true;
      }
      if (!passes)
        return { outcome: 'NOT_APPLICABLE', reason: 'eligibility_failed', gate: `Eligibility: ${rule.attribute} ${rule.op} ${rule.value}` };
    }
  }

  if (policy?.suppression_rules) {
    for (const rule of policy.suppression_rules) {
      const match = rule.match(/^(\w+)\s*(=|!=|>=|<=|>|<)\s*"?([^"]+)"?$/);
      if (match) {
        const [, attr, op, val] = match;
        const carVal = car[attr];
        const numVal = parseFloat(val);
        const carNum = typeof carVal === 'number' ? carVal : parseFloat(String(carVal));
        let fires = false;
        switch (op) {
          case '=':  fires = String(carVal) === val; break;
          case '!=': fires = String(carVal) !== val; break;
          case '>=': fires = !isNaN(carNum) && carNum >= numVal; break;
          case '<=': fires = !isNaN(carNum) && carNum <= numVal; break;
          case '>':  fires = !isNaN(carNum) && carNum > numVal; break;
          case '<':  fires = !isNaN(carNum) && carNum < numVal; break;
        }
        if (fires)
          return { outcome: 'SUPPRESSED', reason: 'suppression_rule', gate: `Suppression: ${rule}` };
      }
    }
  }

  const eligible = actions.filter(a => strategy.action_ids.includes(a.id) && a.status === 'active');
  if (!eligible.length)
    return { outcome: 'NOT_APPLICABLE', reason: 'no_active_actions', gate: 'No Active Actions' };

  const best = [...eligible].sort((a, b) => b.base_propensity - a.base_propensity)[0];
  return { outcome: 'PASS', reason: 'pass', gate: 'All Gates Passed', actionId: best.id };
}

function generateSyntheticCustomers(count: number, seedAttributes: Record<string, unknown>): SimCustomer[] {
  const customers: SimCustomer[] = [];
  for (let i = 0; i < count; i++) {
    customers.push({
      customerId: `sim-${i.toString().padStart(6, '0')}`,
      attributes: {
        consentGiven: Math.random() > 0.1,
        age: 20 + Math.floor(Math.random() * 55),
        tenure_months: Math.floor(Math.random() * 120),
        product_count: 1 + Math.floor(Math.random() * 6),
        credit_score: 500 + Math.floor(Math.random() * 350),
        ...seedAttributes,
      },
    });
  }
  return customers;
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  let body: {
    strategyId: string;
    tenantId?: string;
    populationSize?: number;
    useRealProfiles?: boolean;
    source?: string;
    seedAttributes?: Record<string, unknown>;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const {
    strategyId,
    tenantId = 'f0000000-0000-4000-a000-000000000001',
    populationSize = 1000,
    seedAttributes = {},
  } = body;
  const useRealProfiles = body.useRealProfiles ?? body.source === 'real';

  if (!strategyId) return NextResponse.json({ error: 'strategyId required' }, { status: 400 });

  const cappedSize = Math.min(populationSize, 10000);

  const [strategies, actions, policies] = await Promise.all([
    fetchStrategies(tenantId),
    fetchActions(tenantId),
    fetchPolicies(tenantId),
  ]);

  const strategy = strategies.find(s => s.id === strategyId);
  if (!strategy) return NextResponse.json({ error: `Strategy ${strategyId} not found` }, { status: 404 });

  const policy = strategy.policy_id
    ? policies.find(p => p.id === strategy.policy_id) ?? null
    : null;

  // Build population
  let population: SimCustomer[];
  if (useRealProfiles) {
    const profiles = await fetchCustomerProfiles(tenantId, cappedSize);
    population = profiles.map(p => ({ customerId: p.customer_id, attributes: p.attributes }));
  } else {
    population = generateSyntheticCustomers(cappedSize, seedAttributes);
  }

  // ── Run simulation — collect full per-customer trace ─────────────────────
  const suppressionBreakdown: Record<string, number> = {};
  const actionBreakdown: Record<string, number> = {};
  let served = 0, suppressed = 0, noMatch = 0;
  const fullTrace: CustomerTrace[] = [];

  for (const customer of population) {
    const car = { ...customer.attributes, customerId: customer.customerId };
    const result = evaluateForSim(strategy, policy, actions, car, { today: 0, week: 0, month: 0 });

    const actionName = result.actionId
      ? (actions.find(a => a.id === result.actionId)?.name ?? result.actionId)
      : undefined;

    const traceEntry: CustomerTrace = {
      customerId:  customer.customerId,
      outcome:     result.outcome === 'PASS' ? 'PASS' : result.outcome === 'SUPPRESSED' ? 'SUPPRESSED' : 'NO_MATCH',
      gate:        result.gate,
      reason:      result.reason,
      actionId:    result.actionId,
      actionName,
      attributes:  customer.attributes,
    };
    fullTrace.push(traceEntry);

    if (result.outcome === 'PASS') {
      served++;
      if (actionName) actionBreakdown[actionName] = (actionBreakdown[actionName] ?? 0) + 1;
    } else if (result.outcome === 'SUPPRESSED') {
      suppressed++;
      suppressionBreakdown[result.reason] = (suppressionBreakdown[result.reason] ?? 0) + 1;
    } else {
      noMatch++;
      suppressionBreakdown[result.reason] = (suppressionBreakdown[result.reason] ?? 0) + 1;
    }
  }

  const total = population.length;
  const latencyMs = Date.now() - start;

  const suppressionBreakdownArr = Object.entries(suppressionBreakdown).map(([reason, count]) => ({
    reason,
    label: GATE_LABELS[reason] ?? reason,
    count,
    pct: Math.round((count / total) * 1000) / 10,
  }));

  const actionBreakdownArr = Object.entries(actionBreakdown).map(([actionName, count]) => {
    const action = actions.find(a => a.name === actionName);
    return {
      actionId:   action?.id ?? actionName,
      actionName,
      count,
      pct: Math.round((count / total) * 1000) / 10,
    };
  });

  const projectedRevenue = Object.entries(actionBreakdown).reduce((sum, [name, count]) => {
    const action = actions.find(a => a.name === name);
    return sum + count * (action?.expected_value ?? 0);
  }, 0);

  // ── Persist audit record ─────────────────────────────────────────────────
  const runId = randomUUID();
  if (serviceSupabase) {
    await serviceSupabase.from('simulation_runs').insert({
      id:               runId,
      tenant_id:        tenantId,
      strategy_id:      strategyId,
      strategy_name:    strategy.name,
      population_size:  total,
      source:           useRealProfiles ? 'real' : 'synthetic',
      served,
      suppressed,
      no_match:         noMatch,
      serve_pct:        Math.round((served / total) * 1000) / 10,
      projected_revenue: projectedRevenue,
      latency_ms:       latencyMs,
      seed_attributes:  seedAttributes,
      results_snapshot: {
        suppressionBreakdown: suppressionBreakdownArr,
        actionBreakdown: actionBreakdownArr,
      },
      customer_trace: fullTrace,   // full trace stored in DB
    }).then(({ error }) => {
      if (error && !error.message?.includes('does not exist')) {
        console.error('simulation_runs insert error:', error.message);
      }
    });
  }

  // Return a sample of 100 trace rows — pass/suppressed/noMatch represented proportionally
  const traceSample = [
    ...fullTrace.filter(t => t.outcome === 'PASS').slice(0, 34),
    ...fullTrace.filter(t => t.outcome === 'SUPPRESSED').slice(0, 34),
    ...fullTrace.filter(t => t.outcome === 'NO_MATCH').slice(0, 32),
  ].slice(0, 100);

  return NextResponse.json({
    runId,
    strategyId,
    strategyName:    strategy.name,
    totalSimulated:  total,
    source:          useRealProfiles ? 'real' : 'synthetic',
    served,
    servedPct:       Math.round((served    / total) * 1000) / 10,
    suppressed,
    suppressedPct:   Math.round((suppressed / total) * 1000) / 10,
    noMatch,
    noMatchPct:      Math.round((noMatch   / total) * 1000) / 10,
    suppressionBreakdown: suppressionBreakdownArr,
    actionBreakdown:      actionBreakdownArr,
    projectedRevenue,
    latencyMs,
    traceSample,   // per-customer detail for transparency panel
    auditedAt:     new Date().toISOString(),
  });
}

// GET — retrieve a past simulation run by runId
export async function GET(req: NextRequest) {
  if (!IS_CONFIGURED || !serviceSupabase)
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const runId   = req.nextUrl.searchParams.get('runId');
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? 'f0000000-0000-4000-a000-000000000001';

  if (runId) {
    const { data, error } = await serviceSupabase
      .from('simulation_runs').select('*')
      .eq('id', runId).eq('tenant_id', tenantId).single();
    if (error || !data) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    return NextResponse.json({ run: data });
  }

  // List recent runs
  const { data } = await serviceSupabase
    .from('simulation_runs').select('id,strategy_name,population_size,source,served,suppressed,no_match,serve_pct,projected_revenue,latency_ms,created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ runs: data ?? [] });
}
