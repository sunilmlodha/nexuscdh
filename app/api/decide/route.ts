/**
 * /api/decide — NexusCDH Decision Engine
 *
 * POST  — Single-strategy decision (specify strategyId)
 * GET   — Global NBA: evaluate ALL active strategies, return best action
 *
 * Authentication (when Supabase configured):
 *   - External callers: X-API-Key header (create keys in Settings → API Keys)
 *   - Browser UI: allowed by same-origin check (no key needed)
 *   - Demo mode (no Supabase): auth skipped entirely
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchStrategies, fetchActions, fetchPolicies,
  insertDecisionLog, getContactCounts, incrementContactCount,
  fetchCustomerProfile, upsertCustomerProfile, validateApiKey,
  IS_CONFIGURED,
  DBStrategy, DBAction, DBContactPolicy,
} from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Auth helper ───────────────────────────────────────────────────────────────

async function checkAuth(req: NextRequest, tenantId: string): Promise<boolean> {
  if (!IS_CONFIGURED) return true; // demo mode — no auth
  const apiKey = req.headers.get('X-API-Key') ?? req.headers.get('x-api-key');
  if (!apiKey) {
    // Allow browser requests (same-origin)
    const origin  = req.headers.get('origin')  ?? '';
    const referer = req.headers.get('referer') ?? '';
    const isBrowser = origin.includes('localhost') || referer.includes('localhost') ||
                      origin.includes('vercel.app') || referer.includes('vercel.app') ||
                      origin.includes('nexuscdh') || referer.includes('nexuscdh') ||
                      origin === '' || referer === ''; // server-side fetch from same host
    return isBrowser;
  }
  const keyPrefix = apiKey.substring(0, 12);
  return validateApiKey(keyPrefix, apiKey, tenantId);
}

// ── Core decision functions ───────────────────────────────────────────────────

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

  // 4. Contact frequency limits
  const maxDay   = policy?.max_per_day   ?? 2;
  const maxWeek  = policy?.max_per_week  ?? 5;
  const maxMonth = policy?.max_per_month ?? 15;

  if (contactCounts.today >= maxDay)
    return { outcome: 'SUPPRESSED', reason: `Daily contact limit reached (max ${maxDay}/day)` };
  if (contactCounts.week >= maxWeek)
    return { outcome: 'SUPPRESSED', reason: `Weekly contact limit reached (max ${maxWeek}/week)` };
  if (contactCounts.month >= maxMonth)
    return { outcome: 'SUPPRESSED', reason: `Monthly contact limit reached (max ${maxMonth}/month)` };

  // 5. Policy suppression rules
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
        if (fires) return { outcome: 'SUPPRESSED', reason: `Suppression rule fired: ${rule}` };
      }
    }
  }

  // 6. Active actions filter
  const eligibleActions = actions.filter(
    a => strategy.action_ids.includes(a.id) && a.status === 'active'
  );
  if (eligibleActions.length === 0) {
    return { outcome: 'NOT_APPLICABLE', reason: 'No active actions configured on this strategy' };
  }

  // 7. Eligibility rules (FIX: previously stored but never evaluated)
  if (strategy.eligibility_rules?.length) {
    for (const rule of strategy.eligibility_rules) {
      const carVal = car[rule.attribute];
      const numVal = parseFloat(rule.value);
      const carNum = typeof carVal === 'number' ? carVal : parseFloat(String(carVal));
      let passes = false;
      switch (rule.op) {
        case '=':       passes = String(carVal) === rule.value; break;
        case '!=':      passes = String(carVal) !== rule.value; break;
        case '>=':      passes = !isNaN(carNum) && carNum >= numVal; break;
        case '<=':      passes = !isNaN(carNum) && carNum <= numVal; break;
        case '>':       passes = !isNaN(carNum) && carNum > numVal; break;
        case '<':       passes = !isNaN(carNum) && carNum < numVal; break;
        case 'IN':      passes = rule.value.split(',').map(v => v.trim()).includes(String(carVal)); break;
        case 'NOT IN':  passes = !rule.value.split(',').map(v => v.trim()).includes(String(carVal)); break;
        default:        passes = true;
      }
      if (!passes) {
        return {
          outcome: 'NOT_APPLICABLE',
          reason: `Eligibility not met: ${rule.attribute} ${rule.op} ${rule.value}`,
        };
      }
    }
  }

  return {
    outcome: 'PASS',
    reason: 'All gates passed',
    actionIds: eligibleActions.map(a => a.id),
    maxPerDay: maxDay,
    maxPerWeek: maxWeek,
  };
}

function arbitrate(
  result: PolicyResult,
  actions: DBAction[],
  method: DBStrategy['arbitration'],
  minPropensity = 0
): DBAction | null {
  if (result.outcome !== 'PASS' || !result.actionIds?.length) return null;

  const eligible = actions.filter(
    a => result.actionIds!.includes(a.id) && a.base_propensity >= minPropensity
  );
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
  if (/daily contact limit/i.test(reason))     return { plain: 'Daily contact limit reached',              category: 'fatigue'     };
  if (/weekly contact limit/i.test(reason))    return { plain: 'Weekly contact limit reached',             category: 'fatigue'     };
  if (/monthly contact limit/i.test(reason))   return { plain: 'Monthly contact limit reached',            category: 'fatigue'     };
  if (/consent/i.test(reason))                 return { plain: 'Customer has not given marketing consent', category: 'consent'     };
  if (/suppression rule/i.test(reason))        return { plain: 'Customer matched a suppression condition', category: 'suppression' };
  if (/no active actions/i.test(reason))       return { plain: 'No actions configured for this strategy', category: 'no_match'   };
  if (/eligibility not met/i.test(reason))     return { plain: 'Customer does not meet eligibility criteria', category: 'eligibility' };
  return { plain: reason, category: 'unknown' };
}

// ── POST: Single-strategy decision ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  const start = Date.now();

  let body: {
    customerId: string;
    strategyId: string;
    tenantId?: string;
    attributes?: Record<string, unknown>;
  };

  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { customerId, strategyId, tenantId = 'f0000000-0000-4000-a000-000000000001', attributes = {} } = body;

  if (!customerId?.trim() || !strategyId?.trim()) {
    return NextResponse.json({ error: 'customerId and strategyId are required' }, { status: 400 });
  }

  if (!IS_CONFIGURED) {
    return NextResponse.json({
      error:     'Supabase not configured',
      message:   'Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then run supabase/schema.sql and supabase/schema_v2.sql.',
      demo:      true,
      served:    false,
      latencyMs: Date.now() - start,
    }, { status: 503 });
  }

  const authed = await checkAuth(req, tenantId);
  if (!authed) {
    return NextResponse.json({
      error: 'Unauthorized',
      hint:  'Add X-API-Key header. Create keys in Settings → API Keys.',
    }, { status: 401 });
  }

  // Load data + customer profile in parallel
  const [strategies, actions, policies, profile] = await Promise.all([
    fetchStrategies(tenantId),
    fetchActions(tenantId),
    fetchPolicies(tenantId),
    fetchCustomerProfile(tenantId, customerId),
  ]);

  // Merge profile attributes with per-call attributes (call takes precedence)
  const profileAttrs   = profile?.attributes ?? {};
  const mergedAttrs    = { ...profileAttrs, ...attributes };

  const car: CAR = {
    customerId,
    consentGiven: mergedAttrs['consentGiven'] !== false,
    ...mergedAttrs,
  };

  const minPropensity = typeof mergedAttrs['min_propensity_threshold'] === 'number'
    ? mergedAttrs['min_propensity_threshold'] as number
    : 0;

  const strategy    = strategies.find(s => s.id === strategyId) ?? null;
  const contactCounts = await getContactCounts(tenantId, customerId);

  if (!strategy) {
    return NextResponse.json({ error: `Strategy ${strategyId} not found` }, { status: 404 });
  }

  const policy    = strategy.policy_id ? policies.find(p => p.id === strategy.policy_id) ?? null : null;
  const result    = evaluateStrategy(strategy, policy, actions, car, contactCounts);
  const bestAction = arbitrate(result, actions, strategy.arbitration, minPropensity);

  const served            = result.outcome === 'PASS' && bestAction !== null;
  const suppressionReason = served ? undefined : result.reason;
  const translation       = suppressionReason ? translateSuppression(suppressionReason) : null;

  const trace = [
    { step: 'consent',          outcome: car.consentGiven ? 'PASS' : 'SUPPRESSED' },
    { step: 'strategy_status',  outcome: strategy.status === 'active' ? 'PASS' : 'NOT_APPLICABLE' },
    { step: 'contact_limits',   outcome: result.outcome === 'SUPPRESSED' && /limit/i.test(result.reason) ? 'SUPPRESSED' : 'PASS' },
    { step: 'eligibility',      outcome: result.outcome === 'NOT_APPLICABLE' && /eligibility/i.test(result.reason) ? 'NOT_APPLICABLE' : 'PASS' },
    { step: 'suppression',      outcome: result.outcome === 'SUPPRESSED' && /rule/i.test(result.reason) ? 'SUPPRESSED' : 'PASS' },
    { step: 'arbitration',      outcome: served ? `Selected: ${bestAction?.name}` : 'N/A' },
  ];

  const latencyMs = Date.now() - start;

  // Persist: update customer profile + log decision
  let persistedDecisionId: string | undefined;
  await upsertCustomerProfile(tenantId, customerId, mergedAttrs as Record<string, unknown>);

  const logId = await insertDecisionLog({
    tenant_id:           tenantId,
    customer_id:         customerId,
    strategy_id:         strategy.id,
    strategy_name:       strategy.name,
    action_id:           served ? bestAction!.id : undefined,
    action_name:         served ? bestAction!.name : undefined,
    channel_id:          served ? (bestAction!.channels[0] ?? undefined) : undefined,
    served,
    suppression_reason:  suppressionReason,
    propensity:          served ? bestAction!.base_propensity : undefined,
    customer_attributes: mergedAttrs,
    trace,
    decision_latency_ms: latencyMs,
  }, tenantId);

  persistedDecisionId = logId ?? undefined;

  if (served && bestAction!.channels.length > 0) {
    await incrementContactCount(tenantId, customerId, bestAction!.channels[0]);
  }

  return NextResponse.json({
    served,
    decisionId: persistedDecisionId,
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
      plain:     translation.plain,
      technical: suppressionReason,
      category:  translation.category,
    } : undefined,
    strategyId:          strategy.id,
    strategyName:        strategy.name,
    customerId,
    profileLoaded:       Object.keys(profileAttrs).length > 0,
    trace,
    latencyMs,
    persistedToDatabase: true,
  });
}

// ── GET: Global NBA — evaluate ALL active strategies ─────────────────────────

export async function GET(req: NextRequest) {
  const start      = Date.now();
  const customerId = req.nextUrl.searchParams.get('customerId') ?? '';
  const tenantId   = req.nextUrl.searchParams.get('tenantId')   ?? 'f0000000-0000-4000-a000-000000000001';
  const attrsParam = req.nextUrl.searchParams.get('attributes') ?? '{}';

  if (!customerId.trim()) {
    return NextResponse.json({ error: 'customerId required' }, { status: 400 });
  }

  if (!IS_CONFIGURED) {
    return NextResponse.json({ error: 'Supabase not configured', demo: true }, { status: 503 });
  }

  const authed = await checkAuth(req, tenantId);
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized', hint: 'Add X-API-Key header.' }, { status: 401 });
  }

  let callAttrs: Record<string, unknown> = {};
  try { callAttrs = JSON.parse(attrsParam); } catch { /* ignore */ }

  const [strategies, actions, policies, profile] = await Promise.all([
    fetchStrategies(tenantId),
    fetchActions(tenantId),
    fetchPolicies(tenantId),
    fetchCustomerProfile(tenantId, customerId),
  ]);

  const profileAttrs  = profile?.attributes ?? {};
  const mergedAttrs   = { ...profileAttrs, ...callAttrs };
  const minPropensity = typeof mergedAttrs['min_propensity_threshold'] === 'number'
    ? mergedAttrs['min_propensity_threshold'] as number : 0;

  const car: CAR = {
    customerId,
    consentGiven: mergedAttrs['consentGiven'] !== false,
    ...mergedAttrs,
  };

  const contactCounts  = await getContactCounts(tenantId, customerId);
  const activeStrategies = strategies.filter(s => s.status === 'active');

  // Evaluate every active strategy
  const candidates: Array<{
    strategy: DBStrategy;
    action: DBAction;
    propensity: number;
  }> = [];

  let suppressedCount = 0;
  let noMatchCount    = 0;

  for (const strategy of activeStrategies) {
    const policy = strategy.policy_id
      ? policies.find(p => p.id === strategy.policy_id) ?? null
      : null;
    const result     = evaluateStrategy(strategy, policy, actions, car, contactCounts);
    const bestAction = arbitrate(result, actions, strategy.arbitration, minPropensity);

    if (result.outcome === 'PASS' && bestAction) {
      candidates.push({ strategy, action: bestAction, propensity: bestAction.base_propensity });
    } else if (result.outcome === 'SUPPRESSED') {
      suppressedCount++;
    } else {
      noMatchCount++;
    }
  }

  // Global arbitration: highest propensity across all qualifying strategies
  candidates.sort((a, b) => b.propensity - a.propensity);
  const winner = candidates[0] ?? null;

  // Persist profile + decision log
  await upsertCustomerProfile(tenantId, customerId, mergedAttrs as Record<string, unknown>);

  let decisionId: string | null = null;
  if (winner) {
    decisionId = await insertDecisionLog({
      tenant_id:           tenantId,
      customer_id:         customerId,
      strategy_id:         winner.strategy.id,
      strategy_name:       winner.strategy.name,
      action_id:           winner.action.id,
      action_name:         winner.action.name,
      channel_id:          winner.action.channels[0] ?? 'web',
      served:              true,
      propensity:          winner.action.base_propensity,
      customer_attributes: mergedAttrs as Record<string, unknown>,
      trace:               [{ step: 'global-nba', strategiesEvaluated: activeStrategies.length, candidatesFound: candidates.length }],
      decision_latency_ms: Date.now() - start,
    }, tenantId);

    // Increment contact frequency counter
    await incrementContactCount(tenantId, customerId, winner.action.channels[0] ?? 'web');
  }

  return NextResponse.json({
    globalDecision:       true,
    served:               winner !== null,
    decisionId:           decisionId ?? undefined,
    action: winner ? {
      id:         winner.action.id,
      name:       winner.action.name,
      headline:   winner.action.headline,
      offerCode:  winner.action.offer_code,
      channel:    winner.action.channels[0],
      propensity: winner.action.base_propensity,
    } : undefined,
    strategyId:           winner?.strategy.id,
    strategyName:         winner?.strategy.name,
    strategiesEvaluated:  activeStrategies.length,
    servedCount:          candidates.length,
    suppressedCount,
    noMatchCount,
    profileLoaded:        Object.keys(profileAttrs).length > 0,
    persistedToDatabase:  decisionId !== null,
    latencyMs:            Date.now() - start,
  });
}
