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
import { IS_CONFIGURED, supabase, serviceSupabase } from '@/lib/supabase';

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

  let { decisionId, actionId, outcome, tenantId = 'f0000000-0000-4000-a000-000000000001' } = body;
  if (!decisionId || !outcome) {
    return NextResponse.json({ error: 'decisionId and outcome required' }, { status: 400 });
  }

  // If actionId not supplied, look it up from decision_log
  if (!actionId) {
    const { data: decision } = await serviceSupabase!
      .from('decision_log')
      .select('action_id')
      .eq('id', decisionId)
      .eq('tenant_id', tenantId)
      .single();
    if (!decision?.action_id) {
      return NextResponse.json({ error: 'Decision not found or has no action_id' }, { status: 404 });
    }
    actionId = decision.action_id;
  }

  // Load current propensity
  const { data: action, error: fetchErr } = await serviceSupabase!
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

  const { error: updateErr } = await serviceSupabase!
    .from('actions')
    .update({ base_propensity: updated, updated_at: new Date().toISOString() })
    .eq('id', actionId)
    .eq('tenant_id', tenantId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Increment predictions_today on adaptive_models (best-effort, fire-and-forget)
  serviceSupabase!
    .from('adaptive_models')
    .select('id, predictions_today')
    .eq('action_id', actionId)
    .eq('tenant_id', tenantId)
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

  return NextResponse.json({
    actionId,
    actionName: action.name,
    before:     current,
    after:      updated,
    delta:      Math.round((updated - current) * 10000) / 10000,
    outcome,
    learningRate: LEARNING_RATE,
  });
}

// GET /api/models/feedback?actionId=xxx — propensity history (from decision_log)
export async function GET(req: NextRequest) {
  const actionId = req.nextUrl.searchParams.get('actionId') ?? '';
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? 'f0000000-0000-4000-a000-000000000001';
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });
  if (!actionId)      return NextResponse.json({ error: 'actionId required' }, { status: 400 });

  const { data } = await serviceSupabase!
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
