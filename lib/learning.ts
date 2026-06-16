/**
 * Adaptive learning — shared Bayesian propensity update utility.
 *
 * Used by every feedback path:
 *   - /api/outcome          (channel response recorded)
 *   - /api/models/feedback  (manual or programmatic feedback)
 *   - /api/v1/interactions  (Pega-compatible Capture Response)
 *
 * Algorithm: online Beta-distribution approximation (moving-average nudge)
 *   accepted  → propensity += (1 - p) * LEARNING_RATE   (pull toward 1.0)
 *   rejected  → propensity -= p * LEARNING_RATE          (pull toward 0.0)
 *   ignored   → propensity -= p * LEARNING_RATE * 0.3   (weak negative signal)
 *
 * Clamped to [0.01, 0.99] and rounded to 4 decimal places.
 */

import { serviceSupabase } from '@/lib/supabase';

export const LEARNING_RATE = 0.05;

export function computeUpdatedPropensity(
  current: number,
  outcome: 'accepted' | 'rejected' | 'ignored'
): number {
  let updated = current;
  switch (outcome) {
    case 'accepted': updated = current + (1 - current) * LEARNING_RATE; break;
    case 'rejected': updated = current - current * LEARNING_RATE;       break;
    case 'ignored':  updated = current - current * LEARNING_RATE * 0.3; break;
  }
  return Math.round(Math.max(0.01, Math.min(0.99, updated)) * 10000) / 10000;
}

/**
 * Apply a propensity update to an action based on a decision outcome.
 * Looks up the action_id from the decision log if not provided.
 * Also increments predictions_today on any adaptive_models linked to the action.
 *
 * Returns the before/after propensity or null if action not found.
 */
export async function applyFeedback(opts: {
  decisionId: string;
  outcome: 'accepted' | 'rejected' | 'ignored';
  tenantId: string;
  actionId?: string;
  channel?: string;
}): Promise<{ actionId: string; actionName: string; before: number; after: number; delta: number } | null> {
  if (!serviceSupabase) return null;

  const { decisionId, outcome, tenantId, channel } = opts;
  let actionId = opts.actionId;

  // Look up action_id from decision log if not supplied
  if (!actionId) {
    const { data: row } = await serviceSupabase
      .from('decision_log')
      .select('action_id')
      .eq('id', decisionId)
      .eq('tenant_id', tenantId)
      .single();
    actionId = row?.action_id;
  }

  if (!actionId) return null;

  // Load current propensity
  const { data: action } = await serviceSupabase
    .from('actions')
    .select('id, name, base_propensity')
    .eq('id', actionId)
    .eq('tenant_id', tenantId)
    .single();

  if (!action) return null;

  const before  = action.base_propensity as number;
  const after   = computeUpdatedPropensity(before, outcome);
  const delta   = Math.round((after - before) * 10000) / 10000;

  // Update action propensity
  await serviceSupabase
    .from('actions')
    .update({ base_propensity: after, updated_at: new Date().toISOString() })
    .eq('id', actionId)
    .eq('tenant_id', tenantId);

  // Increment predictions_today on any linked adaptive model (best-effort)
  serviceSupabase
    .from('adaptive_models')
    .select('id, predictions_today')
    .eq('action_id', actionId)
    .eq('tenant_id', tenantId)
    .eq('status', 'live')
    .single()
    .then(({ data: m }) => {
      if (m) {
        serviceSupabase!
          .from('adaptive_models')
          .update({ predictions_today: (m.predictions_today ?? 0) + 1 })
          .eq('id', m.id)
          .then(() => null);
      }
    });

  // Log the feedback event to config_audit for traceability
  serviceSupabase
    .from('config_audit')
    .insert({
      tenant_id:       tenantId,
      entity_type:     'adaptive_feedback',
      entity_id:       actionId,
      entity_name:     action.name,
      action:          'propensity_update',
      after_snapshot:  { decisionId, outcome, channel: channel ?? 'unknown', before, after, delta, learningRate: LEARNING_RATE },
    })
    .then(() => null);

  return { actionId, actionName: action.name, before, after, delta };
}
