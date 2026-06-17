/**
 * NexusCDH — Next-Best-Action arbitration engine (Pega CDH-style)
 *
 * Two responsibilities, kept pure (no DB, no I/O) so they can be unit-tested
 * and reused by /api/decide, the Scenario Planner, and the Arbitration tester:
 *
 *  1. Engagement Policies — four ordered gates an action must clear:
 *       Eligibility  → "Can we ever offer this?"      (hard rules)
 *       Applicability → "Is it relevant right now?"    (situational)
 *       Suitability  → "Is it the right thing for them?" (customer-interest)
 *       Contact Policy → handled in /api/decide (frequency/suppression)
 *
 *  2. Arbitration — Pega's priority formula:
 *       Priority = P × C × V × L
 *         P = Propensity   (likelihood to accept, 0–1)
 *         C = Context      (situational weight, strategy-level)
 *         V = Value        (expected business value)
 *         L = Levers       (manual strategic business boosts)
 */

export interface RuleClause {
  attribute: string;
  op: '=' | '!=' | '>=' | '<=' | '>' | '<' | 'IN' | 'NOT IN';
  value: string;
}

export interface BusinessLever {
  id?: string;
  label: string;
  multiplier: number;               // e.g. 1.5 = +50% boost, 0.5 = halve
  condition?: RuleClause | null;     // null/absent = always applies
  enabled?: boolean;
}

export type PolicyLayer = 'eligibility' | 'applicability' | 'suitability';

export interface CarLike {
  [key: string]: unknown;
}

// ── Rule evaluation ─────────────────────────────────────────────────────────

export function evaluateClause(car: CarLike, rule: RuleClause): boolean {
  const carVal = car[rule.attribute];
  const numVal = parseFloat(rule.value);
  const carNum = typeof carVal === 'number' ? carVal : parseFloat(String(carVal));
  switch (rule.op) {
    case '=':      return String(carVal) === rule.value;
    case '!=':     return String(carVal) !== rule.value;
    case '>=':     return !isNaN(carNum) && carNum >= numVal;
    case '<=':     return !isNaN(carNum) && carNum <= numVal;
    case '>':      return !isNaN(carNum) && carNum > numVal;
    case '<':      return !isNaN(carNum) && carNum < numVal;
    case 'IN':     return rule.value.split(',').map(v => v.trim()).includes(String(carVal));
    case 'NOT IN': return !rule.value.split(',').map(v => v.trim()).includes(String(carVal));
    default:       return true;
  }
}

export interface PolicyLayerResult {
  layer: PolicyLayer;
  passed: boolean;
  rulesEvaluated: number;
  failedRule?: RuleClause;
}

export interface EngagementPolicyResult {
  passed: boolean;
  failedLayer?: PolicyLayer;
  layers: PolicyLayerResult[];
}

/**
 * Evaluate the three customer-facing engagement-policy layers in order.
 * All rules within a layer are AND-ed; the first failing layer short-circuits.
 */
export function runEngagementPolicies(
  car: CarLike,
  policy: {
    eligibility_rules?: RuleClause[];
    applicability_rules?: RuleClause[];
    suitability_rules?: RuleClause[];
  }
): EngagementPolicyResult {
  const layers: { layer: PolicyLayer; rules: RuleClause[] }[] = [
    { layer: 'eligibility',   rules: policy.eligibility_rules   ?? [] },
    { layer: 'applicability', rules: policy.applicability_rules ?? [] },
    { layer: 'suitability',   rules: policy.suitability_rules   ?? [] },
  ];

  const results: PolicyLayerResult[] = [];
  let failedLayer: PolicyLayer | undefined;

  for (const { layer, rules } of layers) {
    let failedRule: RuleClause | undefined;
    for (const rule of rules) {
      if (!evaluateClause(car, rule)) { failedRule = rule; break; }
    }
    const passed = !failedRule;
    results.push({ layer, passed, rulesEvaluated: rules.length, failedRule });
    if (!passed && !failedLayer) failedLayer = layer;
  }

  return { passed: !failedLayer, failedLayer, layers: results };
}

// ── Arbitration: Priority = P × C × V × L ───────────────────────────────────

export interface PriorityInput {
  base_propensity: number;     // P
  expected_value?: number;     // V (raw business value)
  context_weight?: number;     // C (optional per-action override; default 1)
}

export interface PriorityBreakdown {
  P: number;
  C: number;
  V: number;
  L: number;
  priority: number;
  appliedLevers: string[];
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Compute the P × C × V × L priority for one action against a customer.
 * Levers whose condition matches (or that are unconditional) multiply L.
 */
export function computePriority(
  action: PriorityInput,
  car: CarLike,
  opts: { contextWeight?: number; levers?: BusinessLever[] } = {}
): PriorityBreakdown {
  const P = clamp01(action.base_propensity ?? 0);
  const C = opts.contextWeight ?? action.context_weight ?? 1;
  // V kept in absolute units (£) so P×V reads as expected value; +1 floor so a
  // zero-value action still ranks by propensity rather than collapsing to 0.
  const V = (action.expected_value ?? 0) + 1;

  let L = 1;
  const appliedLevers: string[] = [];
  for (const lever of opts.levers ?? []) {
    if (lever.enabled === false) continue;
    const applies = !lever.condition || evaluateClause(car, lever.condition);
    if (applies) {
      L *= lever.multiplier;
      appliedLevers.push(lever.label);
    }
  }

  return { P, C, V, L, priority: P * C * V * L, appliedLevers };
}

export interface RankedCandidate<A> {
  action: A;
  breakdown: PriorityBreakdown;
}

/**
 * Rank a set of actions by P×C×V×L priority (descending) and return the
 * winner plus the full ranked list with per-factor breakdowns for explainability.
 */
export function rankActions<A extends PriorityInput>(
  actions: A[],
  car: CarLike,
  opts: { contextWeight?: number; levers?: BusinessLever[]; minPropensity?: number } = {}
): { winner: RankedCandidate<A> | null; ranked: RankedCandidate<A>[] } {
  const minP = opts.minPropensity ?? 0;
  const ranked = actions
    .filter(a => (a.base_propensity ?? 0) >= minP)
    .map(action => ({ action, breakdown: computePriority(action, car, opts) }))
    .sort((a, b) => b.breakdown.priority - a.breakdown.priority);

  return { winner: ranked[0] ?? null, ranked };
}
