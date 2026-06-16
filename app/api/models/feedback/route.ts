/**
 * POST /api/models/feedback
 *
 * Adaptive model feedback — applies Bayesian propensity update.
 * Delegates to the shared applyFeedback utility (same path as /api/outcome).
 */

import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase } from '@/lib/supabase';
import { applyFeedback, LEARNING_RATE } from '@/lib/learning';

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  let body: {
    decisionId: string;
    actionId?: string;
    outcome: 'accepted' | 'rejected' | 'ignored';
    channel?: string;
    tenantId?: string;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { decisionId, actionId, outcome, channel, tenantId = 'f0000000-0000-4000-a000-000000000001' } = body;
  if (!decisionId || !outcome)
    return NextResponse.json({ error: 'decisionId and outcome required' }, { status: 400 });

  const result = await applyFeedback({ decisionId, outcome, tenantId, actionId, channel });

  if (!result)
    return NextResponse.json({ error: 'Action not found for this decision' }, { status: 404 });

  return NextResponse.json({
    actionId:    result.actionId,
    actionName:  result.actionName,
    before:      result.before,
    after:       result.after,
    delta:       result.delta,
    outcome,
    learningRate: LEARNING_RATE,
  });
}

// GET /api/models/feedback?actionId=xxx — propensity history from decision_log
export async function GET(req: NextRequest) {
  const actionId = req.nextUrl.searchParams.get('actionId') ?? '';
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? 'f0000000-0000-4000-a000-000000000001';
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });
  if (!actionId)      return NextResponse.json({ error: 'actionId required' }, { status: 400 });

  const { data } = await serviceSupabase!
    .from('decision_log')
    .select('served, outcome, propensity, channel_id, created_at')
    .eq('tenant_id', tenantId)
    .eq('action_id', actionId)
    .order('created_at', { ascending: false })
    .limit(200);

  const rows     = data ?? [];
  const served   = rows.filter(r => r.served).length;
  const accepted = rows.filter(r => r.outcome === 'accepted').length;
  const rejected = rows.filter(r => r.outcome === 'rejected').length;

  // Channel breakdown
  const byChannel: Record<string, { served: number; accepted: number }> = {};
  for (const r of rows) {
    const ch = r.channel_id ?? 'unknown';
    if (!byChannel[ch]) byChannel[ch] = { served: 0, accepted: 0 };
    if (r.served)             byChannel[ch].served++;
    if (r.outcome === 'accepted') byChannel[ch].accepted++;
  }

  return NextResponse.json({
    actionId,
    stats: {
      totalDecisions: rows.length,
      served,
      accepted,
      rejected,
      acceptanceRate: served ? accepted / served : 0,
    },
    channelBreakdown: Object.entries(byChannel).map(([channel, s]) => ({
      channel, ...s,
      acceptanceRate: s.served ? s.accepted / s.served : 0,
    })),
    history: rows.map(r => ({
      propensity: r.propensity,
      outcome:    r.outcome,
      channel:    r.channel_id,
      date:       r.created_at,
    })),
    configured: true,
  });
}
