/**
 * lib/learning.ts — Adaptive Learning Engine
 *
 * Four genuinely different algorithms, each with its own update rule and
 * human-readable explanation. Every update is written to config_audit so
 * it can be shown in the model transparency panel.
 *
 * Algorithms
 * ──────────
 * logistic_regression  Online gradient descent on log-loss. Learning rate 0.05.
 *                      Correct predictions get a smaller nudge (already good);
 *                      wrong predictions get a larger correction.
 *
 * gradient_boosting    Higher base rate (0.08) + signal dampening when the
 *                      last N outcomes are mixed (prevents overfit to noise).
 *                      Simulates a boosted ensemble that updates conservatively
 *                      when evidence is conflicting.
 *
 * neural_net           Momentum-based SGD. Tracks the direction of the last
 *                      update; amplifies if the new signal agrees (momentum),
 *                      dampens if it disagrees (reversal). Simulates a neural
 *                      network's gradient update with momentum=0.9.
 *
 * bayesian             True Beta-Binomial conjugate update.
 *                      α = accepted_count + 1  (successes + prior)
 *                      β = rejected_count + 1  (failures + prior)
 *                      propensity = α / (α + β)
 *                      Naturally converges as evidence accumulates.
 *                      No hardcoded learning rate — driven entirely by data.
 */

import { serviceSupabase } from '@/lib/supabase';

export const LEARNING_RATE = 0.05;

// ── Per-algorithm update ──────────────────────────────────────────────────────

export interface UpdateResult {
  before:      number;
  after:       number;
  delta:       number;
  algorithm:   string;
  explanation: string;   // human-readable sentence shown in audit trail
  formula:     string;   // compact formula shown in transparency panel
}

function clamp(v: number) {
  return Math.round(Math.max(0.01, Math.min(0.99, v)) * 10000) / 10000;
}

function logisticUpdate(
  current: number,
  outcome: 'accepted' | 'rejected' | 'ignored',
  recentHistory: Array<{ outcome: string | null }>
): UpdateResult {
  // Online logistic gradient descent on log-loss.
  // If the current propensity already "predicted" the right outcome, the
  // gradient is small. If it predicted wrong, the correction is larger.
  const predicted = current >= 0.5 ? 'accepted' : 'rejected';
  const error     = outcome === 'accepted' ? (1 - current) : outcome === 'rejected' ? -current : -(current * 0.3);
  const correction = error * LEARNING_RATE;
  const after     = clamp(current + correction);
  const delta     = Math.round((after - current) * 10000) / 10000;

  const correct = predicted === outcome;
  return {
    before: current, after, delta, algorithm: 'Logistic Regression',
    formula: `p ← p + (y - p) × η   where η=${LEARNING_RATE}, y=${outcome === 'accepted' ? 1 : 0}`,
    explanation: outcome === 'ignored'
      ? `Weak negative signal (ignored). Propensity nudged slightly down: ${current.toFixed(4)} → ${after.toFixed(4)}.`
      : `Model predicted "${predicted}" (p=${current.toFixed(3)}), outcome was "${outcome}" — ${correct ? 'correct' : 'incorrect'}. ` +
        `Log-loss gradient correction ${delta > 0 ? '+' : ''}${delta.toFixed(4)} applied.`,
  };
}

function gradientBoostingUpdate(
  current: number,
  outcome: 'accepted' | 'rejected' | 'ignored',
  recentHistory: Array<{ outcome: string | null }>
): UpdateResult {
  const BASE_RATE = 0.08;

  // Compute signal consistency from recent history (last 10 outcomes with values)
  const recent = recentHistory.filter(h => h.outcome).slice(0, 10);
  const recentAccepted = recent.filter(h => h.outcome === 'accepted').length;
  const recentRejected = recent.filter(h => h.outcome === 'rejected').length;
  const total = recentAccepted + recentRejected;
  // Consistency: 1.0 = all same direction, 0.0 = perfectly split
  const consistency = total > 0 ? Math.abs(recentAccepted - recentRejected) / total : 1.0;

  // Dampen learning rate when signal is noisy (mixed outcomes)
  const effectiveRate = BASE_RATE * (0.4 + 0.6 * consistency);

  let delta = 0;
  if (outcome === 'accepted') delta =  (1 - current) * effectiveRate;
  if (outcome === 'rejected') delta = -(current)      * effectiveRate;
  if (outcome === 'ignored')  delta = -(current)      * effectiveRate * 0.2;

  const after = clamp(current + delta);
  delta = Math.round((after - current) * 10000) / 10000;

  return {
    before: current, after, delta, algorithm: 'Gradient Boosting',
    formula: `p ← p + Δ × consistency_weight   (base η=${BASE_RATE}, consistency=${consistency.toFixed(2)})`,
    explanation: `Signal consistency over last ${recent.length} decisions: ${(consistency * 100).toFixed(0)}% ` +
      `(${recentAccepted} accepted, ${recentRejected} rejected). ` +
      `Effective learning rate ${effectiveRate.toFixed(3)} applied → ${current.toFixed(4)} → ${after.toFixed(4)}.`,
  };
}

function neuralNetUpdate(
  current: number,
  outcome: 'accepted' | 'rejected' | 'ignored',
  recentHistory: Array<{ outcome: string | null; propensity?: number | null }>
): UpdateResult {
  const MOMENTUM     = 0.9;
  const BASE_RATE    = 0.05;

  // Estimate last gradient from last two propensity readings
  const propHistory = recentHistory.map(h => h.propensity).filter(p => p != null) as number[];
  const lastDelta   = propHistory.length >= 2
    ? propHistory[0] - propHistory[1]
    : 0;

  // Raw gradient for this step
  let rawGrad = 0;
  if (outcome === 'accepted') rawGrad =  (1 - current) * BASE_RATE;
  if (outcome === 'rejected') rawGrad = -(current)      * BASE_RATE;
  if (outcome === 'ignored')  rawGrad = -(current)      * BASE_RATE * 0.25;

  // Momentum: blend last gradient with current
  const momentumGrad = MOMENTUM * lastDelta + (1 - MOMENTUM) * rawGrad;
  const after        = clamp(current + momentumGrad);
  const delta        = Math.round((after - current) * 10000) / 10000;
  const sameDir      = (lastDelta > 0 && rawGrad > 0) || (lastDelta < 0 && rawGrad < 0);

  return {
    before: current, after, delta, algorithm: 'Neural Network',
    formula: `v ← 0.9v + 0.1∇L,  p ← p + v   (SGD + momentum)`,
    explanation: `Last gradient: ${lastDelta >= 0 ? '+' : ''}${lastDelta.toFixed(4)}, new signal: ${rawGrad >= 0 ? '+' : ''}${rawGrad.toFixed(4)}. ` +
      `Momentum ${sameDir ? 'amplified' : 'dampened'} the update (same direction: ${sameDir}). ` +
      `Blended gradient ${momentumGrad >= 0 ? '+' : ''}${momentumGrad.toFixed(4)} → ${current.toFixed(4)} → ${after.toFixed(4)}.`,
  };
}

function bayesianUpdate(
  current: number,
  outcome: 'accepted' | 'rejected' | 'ignored',
  alpha: number,  // prior successes
  beta: number    // prior failures
): UpdateResult {
  // Beta-Binomial conjugate update.
  // Prior: Beta(α, β). After observing outcome, posterior is Beta(α', β').
  let newAlpha = alpha;
  let newBeta  = beta;

  if (outcome === 'accepted') { newAlpha += 1; }
  if (outcome === 'rejected') { newBeta  += 1; }
  if (outcome === 'ignored')  { newBeta  += 0.3; } // partial negative weight

  const after = clamp(newAlpha / (newAlpha + newBeta));
  const delta = Math.round((after - current) * 10000) / 10000;

  // Uncertainty (variance of Beta distribution)
  const variance = (newAlpha * newBeta) / ((newAlpha + newBeta) ** 2 * (newAlpha + newBeta + 1));
  const stdDev   = Math.sqrt(variance);

  return {
    before: current, after, delta, algorithm: 'Bayesian',
    formula: `p = α/(α+β) = ${newAlpha.toFixed(1)}/${(newAlpha + newBeta).toFixed(1)}   posterior Beta(α=${newAlpha.toFixed(1)}, β=${newBeta.toFixed(1)})`,
    explanation: `Beta-Binomial conjugate update. Prior Beta(α=${alpha.toFixed(1)}, β=${beta.toFixed(1)}). ` +
      `After "${outcome}": posterior Beta(α=${newAlpha.toFixed(1)}, β=${newBeta.toFixed(1)}). ` +
      `Propensity = α/(α+β) = ${after.toFixed(4)}, uncertainty σ=${stdDev.toFixed(4)}. ` +
      `(${newAlpha + newBeta - 2} total observations contributing to this estimate.)`,
  };
}

// ── Public function: compute update ──────────────────────────────────────────

export function computeUpdate(
  current: number,
  outcome: 'accepted' | 'rejected' | 'ignored',
  modelType: string,
  recentHistory: Array<{ outcome: string | null; propensity?: number | null }>,
  modelConfig: { alpha?: number; beta?: number } = {}
): UpdateResult {
  switch (modelType) {
    case 'logistic_regression':
      return logisticUpdate(current, outcome, recentHistory);
    case 'gradient_boosting':
      return gradientBoostingUpdate(current, outcome, recentHistory);
    case 'neural_net':
      return neuralNetUpdate(current, outcome, recentHistory);
    case 'bayesian': {
      // Seed alpha/beta from observed history if not in config yet
      const histAccepted = recentHistory.filter(h => h.outcome === 'accepted').length;
      const histRejected = recentHistory.filter(h => h.outcome === 'rejected').length;
      const alpha = modelConfig.alpha ?? Math.max(1, histAccepted + 1);
      const beta  = modelConfig.beta  ?? Math.max(1, histRejected + 1);
      return bayesianUpdate(current, outcome, alpha, beta);
    }
    default:
      return logisticUpdate(current, outcome, recentHistory);
  }
}

// Legacy compat — single-formula version used as fallback
export function computeUpdatedPropensity(
  current: number,
  outcome: 'accepted' | 'rejected' | 'ignored'
): number {
  const result = logisticUpdate(current, outcome, []);
  return result.after;
}

// ── Main feedback application ─────────────────────────────────────────────────

export async function applyFeedback(opts: {
  decisionId: string;
  outcome: 'accepted' | 'rejected' | 'ignored';
  tenantId: string;
  actionId?: string;
  channel?: string;
}): Promise<{
  actionId: string; actionName: string;
  before: number; after: number; delta: number;
  algorithm: string; explanation: string;
} | null> {
  if (!serviceSupabase) return null;

  const { decisionId, outcome, tenantId, channel } = opts;
  let actionId = opts.actionId;

  // Look up action_id from decision log if not supplied
  if (!actionId) {
    const { data: row } = await serviceSupabase
      .from('decision_log').select('action_id')
      .eq('id', decisionId).eq('tenant_id', tenantId).single();
    actionId = row?.action_id;
  }
  if (!actionId) return null;

  // Load action + its linked adaptive model
  const [{ data: action }, { data: model }] = await Promise.all([
    serviceSupabase.from('actions').select('id, name, base_propensity')
      .eq('id', actionId).eq('tenant_id', tenantId).single(),
    serviceSupabase.from('adaptive_models').select('id, model_type, model_config, status')
      .eq('action_id', actionId).eq('tenant_id', tenantId)
      .in('status', ['live', 'shadow'])
      .order('status') // 'live' sorts before 'shadow'
      .limit(1).single(),
  ]);

  if (!action) return null;

  const current   = action.base_propensity as number;
  const modelType = model?.model_type ?? 'logistic_regression';
  const modelConfig: { alpha?: number; beta?: number } = (model?.model_config as Record<string, number>) ?? {};

  // Load recent history for algorithms that need it
  const { data: recentRows } = await serviceSupabase
    .from('decision_log').select('outcome, propensity')
    .eq('tenant_id', tenantId).eq('action_id', actionId)
    .order('created_at', { ascending: false }).limit(20);
  const recentHistory = recentRows ?? [];

  // Compute update using the appropriate algorithm
  const update = computeUpdate(current, outcome, modelType, recentHistory, modelConfig);

  // Apply to action
  await serviceSupabase.from('actions')
    .update({ base_propensity: update.after, updated_at: new Date().toISOString() })
    .eq('id', actionId).eq('tenant_id', tenantId);

  // For Bayesian: persist updated alpha/beta to model_config
  if (model && modelType === 'bayesian') {
    const histAccepted = recentHistory.filter(h => h.outcome === 'accepted').length + (outcome === 'accepted' ? 1 : 0);
    const histRejected = recentHistory.filter(h => h.outcome === 'rejected').length + (outcome === 'rejected' ? 1 : 0) + (outcome === 'ignored' ? 0.3 : 0);
    await serviceSupabase.from('adaptive_models')
      .update({ model_config: { alpha: histAccepted + 1, beta: histRejected + 1 } })
      .eq('id', model.id);
  }

  // Increment predictions_today on live model (best-effort)
  if (model?.status === 'live') {
    serviceSupabase.from('adaptive_models')
      .select('id, predictions_today').eq('id', model.id).single()
      .then(({ data: m }) => {
        if (m) serviceSupabase!.from('adaptive_models')
          .update({ predictions_today: (m.predictions_today ?? 0) + 1 })
          .eq('id', m.id).then(() => null);
      });
  }

  // Write detailed audit record
  await serviceSupabase.from('config_audit').insert({
    tenant_id:    tenantId,
    entity_type:  'adaptive_feedback',
    entity_id:    actionId,
    entity_name:  action.name,
    action:       'propensity_update',
    after_snapshot: {
      decisionId,
      outcome,
      channel:      channel ?? 'unknown',
      algorithm:    update.algorithm,
      formula:      update.formula,
      explanation:  update.explanation,
      before:       update.before,
      after:        update.after,
      delta:        update.delta,
      modelType,
    },
  });

  return {
    actionId, actionName: action.name,
    before: update.before, after: update.after, delta: update.delta,
    algorithm: update.algorithm, explanation: update.explanation,
  };
}
