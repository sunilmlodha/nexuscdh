/**
 * POST /api/triggers/fire
 *
 * Inbound webhook — CDPs, CRMs, and internal systems POST customer events here.
 * NexusCDH matches the event against configured event_triggers, then runs the
 * matched strategies through the decision engine and returns the winning action.
 *
 * Body:
 *   { eventType, customerId, tenantId?, payload? }
 *
 * Returns:
 *   { matched: boolean, triggerId?, triggerName?, decision? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, supabase, fetchStrategies, upsertCustomerProfile, insertDecisionLog } from '@/lib/supabase';

interface FireBody {
  eventType: string;
  customerId: string;
  tenantId?: string;
  payload?: Record<string, unknown>;
}

// Minimal condition evaluator — supports <, >, <=, >=, =, !=
function evalConditions(conditions: Record<string, { op: string; value: string }>, payload: Record<string, unknown>): boolean {
  for (const [attr, { op, value }] of Object.entries(conditions)) {
    const actual = payload[attr];
    if (actual === undefined) return false;
    const num = Number(value);
    const actualNum = Number(actual);
    switch (op) {
      case '<':  if (!(actualNum <  num)) return false; break;
      case '>':  if (!(actualNum >  num)) return false; break;
      case '<=': if (!(actualNum <= num)) return false; break;
      case '>=': if (!(actualNum >= num)) return false; break;
      case '=':  if (String(actual) !== String(value)) return false; break;
      case '!=': if (String(actual) === String(value)) return false; break;
    }
  }
  return true;
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) {
    return NextResponse.json({ error: 'Supabase not configured — running in demo mode' }, { status: 503 });
  }

  let body: FireBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { eventType, customerId, tenantId = 'default-tenant', payload = {} } = body;
  if (!eventType || !customerId) {
    return NextResponse.json({ error: 'eventType and customerId are required' }, { status: 400 });
  }

  // 1. Find matching enabled triggers for this event type
  const { data: triggers } = await supabase!
    .from('event_triggers')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('event_type', eventType)
    .eq('enabled', true);

  if (!triggers || triggers.length === 0) {
    return NextResponse.json({ matched: false, eventType, customerId, reason: 'No matching triggers' });
  }

  // 2. Evaluate conditions against payload — use first matching trigger
  const matched = triggers.find(t => {
    const conds = (t.event_conditions ?? {}) as Record<string, { op: string; value: string }>;
    return Object.keys(conds).length === 0 || evalConditions(conds, payload);
  });

  if (!matched) {
    return NextResponse.json({ matched: false, eventType, customerId, reason: 'Conditions not met' });
  }

  // 3. Upsert customer profile with event payload attributes
  await upsertCustomerProfile(tenantId, customerId, payload as Record<string, unknown>);

  // 4. Load strategies listed in the trigger (or all active if none specified)
  const allStrategies = await fetchStrategies(tenantId);
  const triggerStrategyIds: string[] = matched.strategy_ids ?? [];
  const strategies = triggerStrategyIds.length > 0
    ? allStrategies.filter(s => triggerStrategyIds.includes(s.id) && s.status === 'active')
    : allStrategies.filter(s => s.status === 'active');

  if (strategies.length === 0) {
    return NextResponse.json({ matched: true, triggerId: matched.id, triggerName: matched.name, decision: null, reason: 'No active strategies to evaluate' });
  }

  // 5. Simple NBA: pick strategy with highest-propensity eligible action
  //    (Lightweight inline arbitration — avoids full evaluateStrategy complexity in webhook path)
  let bestAction: { strategyId: string; strategyName: string; actionId: string; actionName: string; propensity: number } | null = null;

  for (const strategy of strategies) {
    // Fetch actions for this strategy
    const { data: actionRows } = await supabase!
      .from('actions')
      .select('id, name, base_propensity')
      .in('id', strategy.action_ids ?? [])
      .eq('status', 'active');
    for (const action of (actionRows ?? [])) {
      const p = typeof action.base_propensity === 'number' ? action.base_propensity : 0.5;
      if (!bestAction || p > bestAction.propensity) {
        bestAction = { strategyId: strategy.id, strategyName: strategy.name, actionId: action.id, actionName: action.name, propensity: p };
      }
    }
  }

  // 6. Log the decision
  let decisionId: string | null = null;
  if (bestAction) {
    decisionId = await insertDecisionLog({
      tenant_id: tenantId,
      customer_id: customerId,
      strategy_id: bestAction.strategyId,
      strategy_name: bestAction.strategyName,
      action_id: bestAction.actionId,
      action_name: bestAction.actionName,
      channel_id: (matched.channel_ids?.[0] ?? undefined) as string | undefined,
      served: true,
      propensity: bestAction.propensity,
      customer_attributes: payload,
      trace: [{ step: 'trigger_fire', eventType, triggerId: matched.id }],
    });
  }

  return NextResponse.json({
    matched: true,
    triggerId: matched.id,
    triggerName: matched.name,
    decision: bestAction ? {
      decisionId,
      strategyId: bestAction.strategyId,
      strategyName: bestAction.strategyName,
      actionId: bestAction.actionId,
      actionName: bestAction.actionName,
      propensity: bestAction.propensity,
    } : null,
  });
}
