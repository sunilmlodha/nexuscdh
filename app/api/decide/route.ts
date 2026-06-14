/**
 * POST /api/decide
 *
 * The real NBA Decision Engine endpoint.
 * Runs the full evaluation pipeline:
 *   1. Load strategy + policy + actions from Supabase (or Zustand store if not configured)
 *   2. Build CAR from customer attributes
 *   3. Evaluate: consent gate → eligibility → D&I ratio → fatigue → rank → return
 *   4. Record result to decision_log (Supabase) and return response
 *
 * Request body:
 *   {
 *     customerId: string,
 *     strategyId: string,
 *     tenantId?: string,
 *     attributes: Record<string, string | number | boolean>
 *   }
 *
 * Response:
 *   {
 *     served: boolean,
 *     action?: { id, name, channel, propensity },
 *     suppressionReason?: string,
 *     suppressionExplanation?: { plain, technical, category },
 *     strategyName: string,
 *     trace: PolicyTrace[],
 *     latencyMs: number
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchStrategies, fetchActions, fetchPolicies,
  insertDecisionLog, getContactCounts, incrementContactCount,
  IS_CONFIGURED, DBStrategy, DBAction, DBContactPolicy,
} from '@/lib/supabase';

// ── Inline decision engine (self-contained, no import from cdh-bridge) ────────
// This is the same logic as cdh-bridge/services/decision-service/src/engine.ts
// kept inline so the Next.js API route has no cross-package dependency.

interface CAR {
  customerId: string;
  consentGiven: boolean;
  [key: string]: unknown;
}

interface PolicyResult {
  outcome: 'NOT_APPLICABLE' | 'SUPPRESSED' | 'PASS';
  reason: string;
  actionIds?: string[];
  maxPerDay?: number;
  maxPerWeek?: number;
}

function evaluateStrategy(
  strategy: DBStrategy,
  policy: DBContactPolicy | null,
  actions: DBAction[],
  car: CAR,
  contactCounts: { today: number; week: number; month: number }
): PolicyResult {
  // 1. Consent gate
  if (!car.consentGiven) {
    return { outcome: 'SUPPRESSED', reason: 'Consent not given (GDPR gate)' };
  }

  // 2. Strategy status gate
  if (strategy.status !== 'active') {
    return { outcome: 'NOT_APPLICABLE', reason: `Strategy is ${strategy.status}` };
  }

  // 3. Date range gate
  const now = new Date();
  if (strategy.start_date && new Date(strategy.start_date) > now) {
    return { outcome: 'NOT_APPLICABLE', reason: 'Strategy has not started yet' };
  }
  if (strategy.end_date && new Date(strategy.end_date) < now) {
    return { outcome: 'NOT_APPLICABLE', reason: 'Strategy has ended' };
  }

  // 4. Contact frequency limits (from policy or strategy defaults)
  const maxDay   = policy?.max_per_day   ?? 2;
  const maxWeek  = policy?.max_per_week  ?? 5;
  const maxMonth = policy?.max_per_month ?? 15;

  if (contactCounts.today >= maxDay) {
    return { outcome: 'SUPPRESSED', reason: `Daily contact limit reached (max ${maxDay}/day)` };
  }
  if (contactCounts.week >= maxWeek) {
    return { outcome: 'SUPPRESSED', reason: `Weekly contact limit reached (max ${maxWeek}/week)` };
  }
  if (contactCounts.month >= maxMonth) {
    return { outcome: 'SUPPRESSED', reason: `Monthly contact limit reached (max ${maxMonth}/month)` };
  }

  // 5. Policy suppression rules (evaluate each against CAR attributes)
  if (policy?.suppression_rules) {
    for (const rule of policy.suppression_rules) {
      // Simple evaluation: parse "attribute = value" patterns
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
        if (fires) {
          return { outcome: 'SUPPRESSED', reason: `Suppression rule fired: ${rule}` };
        }
      }
    }
  }

  // 6. Get eligible actions (active, assigned to this strategy)
  const eligibleActions = actions.filter(
    a => strategy.action_ids.includes(a.id) && a.status === 'active'
  );

  if (eligibleActions.length === 0) {
    return { outcome: 'NOT_APPLICABLE', reason: 'No active actions configured on this strategy' };
  }

  return {
    outcome: 'PASS',
    reason: 'All gates passed',
    actionIds: eligibleActions.map(a => a.id),
    maxPerDay:  maxDay,
    maxPerWeek: maxWeek,
  };
}

function arbitrate(
  result: PolicyResult,
  actions: DBAction[],
  method: DBStrategy['arbitration']
): DBAction | null {
  if (result.outcome !== 'PASS' || !result.actionIds?.length) return null;

  const eligible = actions.filter(a => result.actionIds!.includes(a.id));
  if (!eligible.length) return null;

  switch (method) {
    case 'propensity':
      return [...eligible].sort((a, b) => b.base_propensity - a.base_propensity)[0];
    case 'value':
      return [...eligible].sort((a, b) => (b.expected_value ?? 0) - (a.expected_value ?? 0))[0];
    case 'weighted':
      return [...eligible].sort((a, b) => {
        const scoreA = a.base_propensity * 0.7 + ((a.expected_value ?? 0) / 1000) * 0.3;
        const scoreB = b.base_propensity * 0.7 + ((b.expected_value ?? 0) / 1000) * 0.3;
        return scoreB - scoreA;
      })[0];
    case 'random_ab':
      return eligible[Math.floor(Math.random() * eligible.length)];
    default:
      return eligible[0];
  }
}

function translateSuppression(reason: string): { plain: string; category: string } {
  if (/daily contact limit/i.test(reason))   return { plain: 'Daily contact limit reached',             category: 'fatigue' };
  if (/weekly contact limit/i.test(reason))  return { plain: 'Weekly contact limit reached',            category: 'fatigue' };
  if (/monthly contact limit/i.test(reason)) return { plain: 'Monthly contact limit reached',           category: 'fatigue' };
  if (/consent/i.test(reason))               return { plain: 'Candidate has not given marketing consent', category: 'consent' };
  if (/suppression rule/i.test(reason))      return { plain: 'Customer matched a suppression condition', category: 'suppression' };
  if (/no active actions/i.test(reason))     return { plain: 'No actions configured for this strategy', category: 'no_match' };
  if (/not applicable/i.test(reason))        return { plain: 'Strategy does not apply to this customer', category: 'no_match' };
  return { plain: reason, category: 'unknown' };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const start = Date.now();

  let body: {
    customerId: string;
    strategyId: string;
    tenantId?: string;
    attributes?: Record<string, unknown>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { customerId, strategyId, tenantId = 'default-tenant', attributes = {} } = body;

  if (!customerId?.trim() || !strategyId?.trim()) {
    return NextResponse.json({ error: 'customerId and strategyId are required' }, { status: 400 });
  }

  // Build CAR from customer attributes
  const car: CAR = {
    customerId,
    consentGiven: attributes['consentGiven'] !== false, // default true unless explicitly false
    ...attributes,
  };

  // ── Load data (Supabase or fallback empty) ────────────────────────────────

  let strategy: DBStrategy | null = null;
  let allActions: DBAction[] = [];
  let policy: DBContactPolicy | null = null;
  let contactCounts = { today: 0, week: 0, month: 0 };

  if (IS_CONFIGURED) {
    const [strategies, actions, policies] = await Promise.all([
      fetchStrategies(tenantId),
      fetchActions(tenantId),
      fetchPolicies(tenantId),
    ]);
    strategy    = strategies.find(s => s.id === strategyId) ?? null;
    allActions  = actions;
    policy      = strategy?.policy_id ? policies.find(p => p.id === strategy!.policy_id) ?? null : null;
    contactCounts = await getContactCounts(tenantId, customerId);
  } else {
    // No Supabase — return a clear error pointing to setup
    return NextResponse.json({
      error:   'Supabase not configured',
      message: 'Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then run the schema from supabase/schema.sql.',
      docs:    '/api/decide — see /supabase/schema.sql for setup instructions',
      demo:    true,
      served:  false,
      latencyMs: Date.now() - start,
    }, { status: 503 });
  }

  if (!strategy) {
    return NextResponse.json({ error: `Strategy ${strategyId} not found` }, { status: 404 });
  }

  // ── Run decision engine ───────────────────────────────────────────────────

  const result = evaluateStrategy(strategy, policy, allActions, car, contactCounts);
  const bestAction = arbitrate(result, allActions, strategy.arbitration);

  const served = result.outcome === 'PASS' && bestAction !== null;
  const suppressionReason = served ? undefined : result.reason;
  const translation = suppressionReason ? translateSuppression(suppressionReason) : null;

  const trace = [
    { step: 'consent',     outcome: car.consentGiven ? 'PASS' : 'SUPPRESSED' },
    { step: 'strategy',    outcome: result.outcome },
    { step: 'arbitration', outcome: served ? `Selected: ${bestAction?.name}` : 'N/A' },
  ];

  // ── Record to Supabase (append-only) ─────────────────────────────────────

  if (IS_CONFIGURED) {
    await insertDecisionLog({
      tenant_id:      tenantId,
      customer_id:    customerId,
      strategy_id:    strategy.id,
      strategy_name:  strategy.name,
      action_id:      served ? bestAction!.id : undefined,
      action_name:    served ? bestAction!.name : undefined,
      channel_id:     served ? (bestAction!.channels[0] ?? undefined) : undefined,
      served,
      suppression_reason: suppressionReason,
      propensity:     served ? bestAction!.base_propensity : undefined,
      outcome:        undefined,
      customer_attributes: attributes,
      trace,
    }, tenantId);

    // Increment contact counter if served
    if (served && bestAction!.channels.length > 0) {
      await incrementContactCount(tenantId, customerId, bestAction!.channels[0]);
    }
  }

  const latencyMs = Date.now() - start;

  return NextResponse.json({
    served,
    action: served ? {
      id:         bestAction!.id,
      name:       bestAction!.name,
      headline:   bestAction!.headline,
      offerCode:  bestAction!.offer_code,
      channel:    bestAction!.channels[0],
      propensity: bestAction!.base_propensity,
    } : undefined,
    suppressionReason,
    suppressionExplanation: translation ? {
      plain:    translation.plain,
      technical: suppressionReason,
      category: translation.category,
    } : undefined,
    strategyId:   strategy.id,
    strategyName: strategy.name,
    customerId,
    trace,
    latencyMs,
    persistedToDatabase: IS_CONFIGURED,
  });
}
