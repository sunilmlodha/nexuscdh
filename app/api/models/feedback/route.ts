/**
 * POST /api/models/feedback
 *
 * Adaptive model feedback loop — when a decision outcome is recorded,
 * update the action's base_propensity using online Bayesian updating.
 *
 * Algorithm: simple moving-average nudge
 *   accepted  → propensity += (1 - propensity) * learning_rate
 *   rejected  → propensity -= propensity * learning_rate
 *   ignored   → small negative signal (0.3 × rejected weight)
 *
 * This approximates a Beta-Binomial Bayesian update without needing
 * a full model retraining pipeline.
 */

import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, supabase } from '@/lib/supabase';

const LEARNING_RATE = 0.05; // 5% nudge per outcome — conservative

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  let body: {
    decisionId: string;
    actionId: string;
    outcome: 'accepted' | 'rejected' | 'ignored';
    tenantId?: string;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { decisionId, actionId, outcome, tenantId = 'default-tenant' } = body;
  if (!decisionId || !actionId || !outcome) {
    return NextResponse.json({ error: 'decisionId, actionId, outcome required' }, { status: 400 });
  }

  // Load current propensity
  const { data: action, error: fetchErr } = await supabase!
    .from('actions')
    .select('id, base_propensity, name')
    .eq('id', actionId)
    .eq('tenant_id', tenantId)
    .single();

  if (fetchErr || !action) {
    return NextResponse.json({ error: 'Action not found' }, { status: 404 });
  }

  const current = action.base_propensity as number;
  let updated = current;

  switch (outcome) {
    case 'accepted':
      // Positive signal — nudge toward 1.0
      updated = current + (1 - current) * LEARNING_RATE;
      break;
    case 'rejected':
      // Negative signal — nudge toward 0.0
      updated = current - current * LEARNING_RATE;
      break;
    case 'ignored':
      // Weak negative signal (customer saw it but didn't act — mild disinterest)
      updated = current - current * LEARNING_RATE * 0.3;
      break;
  }

  // Clamp to [0.01, 0.99]
  updated = Math.max(0.01, Math.min(0.99, updated));
  updated = Math.round(updated * 10000) / 10000; // 4 decimal places

  const { error: updateErr } = await supabase!
    .from('actions')
    .update({ base_propensity: updated, updated_at: new Date().toISOString() })
    .eq('id', actionId)
    .eq('tenant_id', tenantId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Also update adaptive_models predictions_today counter if a model exists for this action
  await supabase!
    .from('adaptive_models')
    .update({
      predictions_today: supabase!.rpc('increment', { row_id: actionId }) as unknown as number,
    })
    .eq('action_id', actionId)
    .eq('tenant_id', tenantId);

  return NextResponse.json({
    actionId,
    actionName:   action.name,
    previousPropensity: current,
    updatedPropensity:  updated,
    delta:         Math.round((updated - current) * 10000) / 10000,
    outcome,
    learningRate:  LEARNING_RATE,
  });
}

// GET /api/models/feedback?actionId=xxx — propensity history (from decision_log)
export async function GET(req: NextRequest) {
  const actionId = req.nextUrl.searchParams.get('actionId') ?? '';
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? 'default-tenant';
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });
  if (!actionId)      return NextResponse.json({ error: 'actionId required' }, { status: 400 });

  const { data } = await supabase!
    .from('decision_log')
    .select('served, outcome, propensity, created_at')
    .eq('tenant_id', tenantId)
    .eq('action_id', actionId)
    .order('created_at', { ascending: false })
    .limit(200);

  const rows     = data ?? [];
  const accepted = rows.filter(r => r.outcome === 'accepted').length;
  const rejected = rows.filter(r => r.outcome === 'rejected').length;
  const served   = rows.filter(r => r.served).length;

  return NextResponse.json({
    actionId,
    stats: {
      totalDecisions: rows.length,
      served,
      accepted,
      rejected,
      acceptanceRate: served ? (accepted / served) : 0,
    },
    history: rows.map(r => ({ propensity: r.propensity, outcome: r.outcome, date: r.created_at })),
    configured: true,
  });
}
