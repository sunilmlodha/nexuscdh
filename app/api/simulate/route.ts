/**
 * POST /api/simulate
 *
 * Population-level simulation — run a strategy against N synthetic or
 * real customer profiles and return aggregate statistics BEFORE go-live.
 *
 * This closes the gap vs Pega's "Strategy Simulation" feature which lets
 * marketers see: "For 10,000 customers, what % will be served? Suppressed
 * by fatigue? Blocked by eligibility?" before activating a strategy.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchStrategies, fetchActions, fetchPolicies, fetchCustomerProfiles,
  IS_CONFIGURED, DBStrategy, DBAction, DBContactPolicy,
} from '@/lib/supabase';

interface SimCustomer {
  customerId: string;
  attributes: Record<string, unknown>;
}

function evaluateForSim(
  strategy: DBStrategy,
  policy: DBContactPolicy | null,
  actions: DBAction[],
  car: Record<string, unknown>,
  contactCounts: { today: number; week: number; month: number }
): { outcome: 'PASS' | 'SUPPRESSED' | 'NOT_APPLICABLE'; reason: string; actionId?: string } {
  if (car['consentGiven'] === false)
    return { outcome: 'SUPPRESSED', reason: 'consent' };

  if (strategy.status !== 'active')
    return { outcome: 'NOT_APPLICABLE', reason: 'inactive_strategy' };

  const now = new Date();
  if (strategy.start_date && new Date(strategy.start_date) > now)
    return { outcome: 'NOT_APPLICABLE', reason: 'not_started' };
  if (strategy.end_date && new Date(strategy.end_date) < now)
    return { outcome: 'NOT_APPLICABLE', reason: 'ended' };

  const maxDay   = policy?.max_per_day   ?? 2;
  const maxWeek  = policy?.max_per_week  ?? 5;
  const maxMonth = policy?.max_per_month ?? 15;

  if (contactCounts.today >= maxDay)   return { outcome: 'SUPPRESSED', reason: 'daily_limit' };
  if (contactCounts.week >= maxWeek)   return { outcome: 'SUPPRESSED', reason: 'weekly_limit' };
  if (contactCounts.month >= maxMonth) return { outcome: 'SUPPRESSED', reason: 'monthly_limit' };

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
      if (!passes) return { outcome: 'NOT_APPLICABLE', reason: 'eligibility_failed' };
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
        if (fires) return { outcome: 'SUPPRESSED', reason: 'suppression_rule' };
      }
    }
  }

  const eligible = actions.filter(a => strategy.action_ids.includes(a.id) && a.status === 'active');
  if (!eligible.length) return { outcome: 'NOT_APPLICABLE', reason: 'no_active_actions' };

  const best = [...eligible].sort((a, b) => b.base_propensity - a.base_propensity)[0];
  return { outcome: 'PASS', reason: 'pass', actionId: best.id };
}

function generateSyntheticCustomers(count: number, seedAttributes: Record<string, unknown>): SimCustomer[] {
  const customers: SimCustomer[] = [];
  for (let i = 0; i < count; i++) {
    customers.push({
      customerId: `sim-${i.toString().padStart(6, '0')}`,
      attributes: {
        consentGiven: Math.random() > 0.1, // 90% have consent
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
    seedAttributes?: Record<string, unknown>;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const {
    strategyId,
    tenantId = 'f0000000-0000-4000-a000-000000000001',
    populationSize = 1000,
    useRealProfiles = false,
    seedAttributes = {},
  } = body;

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

  // Run simulation (no DB writes — read-only)
  const suppressionBreakdown: Record<string, number> = {};
  const actionBreakdown: Record<string, number> = {};
  let served = 0, suppressed = 0, noMatch = 0;

  for (const customer of population) {
    const car = { ...customer.attributes, customerId: customer.customerId };
    // Simulate zero prior contacts (clean slate for simulation)
    const result = evaluateForSim(strategy, policy, actions, car, { today: 0, week: 0, month: 0 });

    if (result.outcome === 'PASS') {
      served++;
      if (result.actionId) {
        const actionName = actions.find(a => a.id === result.actionId)?.name ?? result.actionId;
        actionBreakdown[actionName] = (actionBreakdown[actionName] ?? 0) + 1;
      }
    } else if (result.outcome === 'SUPPRESSED') {
      suppressed++;
      suppressionBreakdown[result.reason] = (suppressionBreakdown[result.reason] ?? 0) + 1;
    } else {
      noMatch++;
      suppressionBreakdown[result.reason] = (suppressionBreakdown[result.reason] ?? 0) + 1;
    }
  }

  const total = population.length;

  return NextResponse.json({
    strategyId,
    strategyName:    strategy.name,
    populationSize:  total,
    useRealProfiles,
    results: {
      served,      servedPct:    Math.round((served    / total) * 1000) / 10,
      suppressed,  suppressedPct: Math.round((suppressed / total) * 1000) / 10,
      noMatch,     noMatchPct:    Math.round((noMatch   / total) * 1000) / 10,
    },
    suppressionBreakdown,
    actionBreakdown,
    projectedRevenue: Object.entries(actionBreakdown).reduce((sum, [name, count]) => {
      const action = actions.find(a => a.name === name);
      return sum + count * (action?.expected_value ?? 0);
    }, 0),
    latencyMs: Date.now() - start,
  });
}
