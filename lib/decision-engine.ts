/**
 * Shared Stratcheck decision engine.
 *
 * Extracted from /api/decide so it can be reused in-process by Value Finder,
 * Scenario Planner, and the Ethical Bias check — all of which run NBA across
 * the whole customer base rather than one call at a time.
 */

import type { DBStrategy, DBAction, DBContactPolicy } from './supabase';
import {
  runEngagementPolicies, rankActions,
  type RuleClause, type BusinessLever, type EngagementPolicyResult, type PriorityBreakdown,
} from './arbitration';

export interface CAR {
  customerId: string;
  consentGiven: boolean;
  [key: string]: unknown;
}

export interface PolicyResult {
  outcome: 'NOT_APPLICABLE' | 'SUPPRESSED' | 'PASS';
  reason: string;
  actionIds?: string[];
  maxPerDay?: number;
  maxPerWeek?: number;
  engagementPolicy?: EngagementPolicyResult;
}

export interface ArbitrationOutcome {
  winner: DBAction | null;
  breakdown: PriorityBreakdown | null;
  ranked: Array<{ action: DBAction; breakdown: PriorityBreakdown }>;
}

export interface ContactCounts { today: number; week: number; month: number; }

// ── Engagement-policy + suppression evaluation for ONE strategy ──────────────

export function evaluateStrategy(
  strategy: DBStrategy,
  policy: DBContactPolicy | null,
  actions: DBAction[],
  car: CAR,
  contactCounts: ContactCounts
): PolicyResult {
  if (!car.consentGiven) return { outcome: 'SUPPRESSED', reason: 'Consent not given (GDPR gate)' };
  if (strategy.status !== 'active') return { outcome: 'NOT_APPLICABLE', reason: `Strategy is ${strategy.status}` };

  const now = new Date();
  if (strategy.start_date && new Date(strategy.start_date) > now) return { outcome: 'NOT_APPLICABLE', reason: 'Strategy has not started yet' };
  if (strategy.end_date && new Date(strategy.end_date) < now)     return { outcome: 'NOT_APPLICABLE', reason: 'Strategy has ended' };

  const maxDay   = policy?.max_per_day   ?? 2;
  const maxWeek  = policy?.max_per_week  ?? 5;
  const maxMonth = policy?.max_per_month ?? 15;
  if (contactCounts.today >= maxDay)   return { outcome: 'SUPPRESSED', reason: `Daily contact limit reached (max ${maxDay}/day)` };
  if (contactCounts.week  >= maxWeek)  return { outcome: 'SUPPRESSED', reason: `Weekly contact limit reached (max ${maxWeek}/week)` };
  if (contactCounts.month >= maxMonth) return { outcome: 'SUPPRESSED', reason: `Monthly contact limit reached (max ${maxMonth}/month)` };

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

  const eligibleActions = actions.filter(a => strategy.action_ids.includes(a.id) && a.status === 'active');
  if (eligibleActions.length === 0) return { outcome: 'NOT_APPLICABLE', reason: 'No active actions configured on this strategy' };

  const engagementPolicy = runEngagementPolicies(car, {
    eligibility_rules:   strategy.eligibility_rules as RuleClause[] | undefined,
    applicability_rules: strategy.applicability_rules as RuleClause[] | undefined,
    suitability_rules:   strategy.suitability_rules as RuleClause[] | undefined,
  });
  if (!engagementPolicy.passed) {
    const failed = engagementPolicy.layers.find(l => !l.passed);
    const r = failed?.failedRule;
    return {
      outcome: 'NOT_APPLICABLE',
      reason: `${engagementPolicy.failedLayer} not met${r ? `: ${r.attribute} ${r.op} ${r.value}` : ''}`,
      engagementPolicy,
    };
  }

  return {
    outcome: 'PASS', reason: 'All gates passed',
    actionIds: eligibleActions.map(a => a.id),
    maxPerDay: maxDay, maxPerWeek: maxWeek, engagementPolicy,
  };
}

// ── Arbitration: Priority = P × C × V × L ───────────────────────────────────

export function arbitrate(
  result: PolicyResult,
  actions: DBAction[],
  strategy: DBStrategy,
  car: CAR,
  minPropensity = 0
): ArbitrationOutcome {
  if (result.outcome !== 'PASS' || !result.actionIds?.length) return { winner: null, breakdown: null, ranked: [] };

  const eligible = actions.filter(a => result.actionIds!.includes(a.id));
  const { winner, ranked } = rankActions(eligible as DBAction[], car, {
    contextWeight: strategy.context_weight ?? 1,
    levers: (strategy.business_levers as BusinessLever[]) ?? [],
    minPropensity,
  });
  if (!ranked.length) return { winner: null, breakdown: null, ranked: [] };

  if (strategy.arbitration === 'random_ab') {
    const pick = ranked[Math.floor(Math.random() * ranked.length)];
    return { winner: pick.action, breakdown: pick.breakdown, ranked };
  }
  return { winner: winner?.action ?? null, breakdown: winner?.breakdown ?? null, ranked };
}

export function translateSuppression(reason: string): { plain: string; category: string } {
  if (/daily contact limit/i.test(reason))     return { plain: 'Daily contact limit reached',                 category: 'fatigue'     };
  if (/weekly contact limit/i.test(reason))    return { plain: 'Weekly contact limit reached',                category: 'fatigue'     };
  if (/monthly contact limit/i.test(reason))   return { plain: 'Monthly contact limit reached',               category: 'fatigue'     };
  if (/consent/i.test(reason))                 return { plain: 'Customer has not given marketing consent',    category: 'consent'     };
  if (/suppression rule/i.test(reason))        return { plain: 'Customer matched a suppression condition',    category: 'suppression' };
  if (/no active actions/i.test(reason))       return { plain: 'No actions configured for this strategy',     category: 'no_match'    };
  if (/not met/i.test(reason))                 return { plain: 'Customer does not meet engagement policy',    category: 'eligibility' };
  return { plain: reason, category: 'unknown' };
}

// ── Global NBA: best action across ALL active strategies (one customer) ──────

export interface GlobalNBAResult {
  served: boolean;
  winner: { strategy: DBStrategy; action: DBAction; breakdown: PriorityBreakdown } | null;
  candidates: Array<{ strategy: DBStrategy; action: DBAction; breakdown: PriorityBreakdown }>;
  suppressedCount: number;
  noMatchCount: number;
  isControl: boolean;   // true = customer held out of the winning strategy's control group
}

/** Stable [0,1) hash of a string — used for deterministic control-group assignment. */
export function hashFraction(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

/** Deterministic: is this customer in the no-action control hold-out for this strategy? */
export function isInControlGroup(customerId: string, strategy: DBStrategy): boolean {
  const pct = strategy.control_group_pct ?? 0;
  if (pct <= 0) return false;
  return hashFraction(`${customerId}:${strategy.id}`) < pct;
}

export function globalNBA(
  car: CAR,
  data: {
    strategies: DBStrategy[];
    actions: DBAction[];
    policies: DBContactPolicy[];
    contactCounts: ContactCounts;
    minPropensity?: number;
  }
): GlobalNBAResult {
  const { strategies, actions, policies, contactCounts, minPropensity = 0 } = data;
  const active = strategies.filter(s => s.status === 'active');

  const candidates: GlobalNBAResult['candidates'] = [];
  let suppressedCount = 0, noMatchCount = 0;

  for (const strategy of active) {
    const policy = strategy.policy_id ? policies.find(p => p.id === strategy.policy_id) ?? null : null;
    const result = evaluateStrategy(strategy, policy, actions, car, contactCounts);
    const arb    = arbitrate(result, actions, strategy, car, minPropensity);
    if (result.outcome === 'PASS' && arb.winner && arb.breakdown) {
      candidates.push({ strategy, action: arb.winner, breakdown: arb.breakdown });
    } else if (result.outcome === 'SUPPRESSED') suppressedCount++;
    else noMatchCount++;
  }

  candidates.sort((a, b) => b.breakdown.priority - a.breakdown.priority);
  const winner = candidates[0] ?? null;
  // Control-group hold-out: if the winning strategy runs a control group and this
  // customer falls in it, the action is withheld (but kept for lift reporting).
  const isControl = winner ? isInControlGroup(car.customerId, winner.strategy) : false;
  return {
    served: !!winner && !isControl,
    winner,
    candidates,
    suppressedCount,
    noMatchCount,
    isControl,
  };
}

/** Build a CAR from a customer profile's attributes (consent defaults to true). */
export function carFromAttributes(customerId: string, attrs: Record<string, unknown>): CAR {
  return { customerId, consentGiven: attrs['consentGiven'] !== false, ...attrs };
}
