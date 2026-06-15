/**
 * POST /api/v1/events
 *
 * Pega CDH Event API — NexusCDH compatible.
 *
 * Inbound event endpoint. External systems (CDP, CRM, mobile app) fire events
 * here; NexusCDH matches them against event_triggers, runs the linked strategies,
 * and returns the winning action.
 *
 * Body:
 *   {
 *     "eventType": "mortgage.approved",   // matches event_triggers.event_type
 *     "CustomerID": "cust-001",
 *     "payload": { ... },                 // event-specific data
 *     "channel": "web",
 *     "tenantId": "..."
 *   }
 *
 * Pega equivalent: Real-Time Event API / Pega Event Strategy
 */

import { NextRequest, NextResponse } from 'next/server';
import { serviceSupabase, insertDecisionLog } from '@/lib/supabase';
import { randomUUID } from 'crypto';

const TENANT = process.env.NEXUS_TENANT_ID ?? 'f0000000-0000-4000-a000-000000000001';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType  = (body.eventType ?? body.pyEventType ?? '') as string;
  const customerId = (body.CustomerID ?? body.customerId ?? '') as string;
  const payload    = (body.payload ?? {}) as Record<string, unknown>;
  const channel    = (body.channel ?? 'web') as string;
  const tenantId   = (body.tenantId ?? TENANT) as string;

  if (!eventType || !customerId) {
    return NextResponse.json({ error: 'eventType and CustomerID are required' }, { status: 400 });
  }

  if (!serviceSupabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const start = Date.now();
  const interactionId = `EVT-${randomUUID().slice(0, 8).toUpperCase()}`;

  // ── 1. Find matching event triggers ─────────────────────────────────────────
  const { data: triggers } = await serviceSupabase
    .from('event_triggers').select('*')
    .eq('tenant_id', tenantId)
    .eq('event_type', eventType)
    .eq('enabled', true);

  if (!triggers?.length) {
    return NextResponse.json({
      matched:         false,
      eventType,
      customerId,
      pxInteractionID: interactionId,
      message:         `No active trigger found for event type: ${eventType}`,
    });
  }

  // ── 2. Load customer profile ─────────────────────────────────────────────────
  const { data: profileRow } = await serviceSupabase
    .from('customer_profiles').select('attributes')
    .eq('tenant_id', tenantId).eq('customer_id', customerId).single();

  const car: Record<string, unknown> = {
    ...(profileRow?.attributes ?? {}),
    ...payload,
    CustomerID: customerId,
  };

  // ── 3. Collect strategies from all matching triggers ─────────────────────────
  const allStrategyIds = triggers.flatMap((t: { strategy_ids: string[] }) => t.strategy_ids ?? []);
  const strategyIds = allStrategyIds.filter((id: string, i: number) => allStrategyIds.indexOf(id) === i);
  if (!strategyIds.length) {
    return NextResponse.json({
      matched:         true,
      trigger:         triggers[0].name,
      eventType,
      customerId,
      decision:        null,
      pxInteractionID: interactionId,
      message:         'Trigger matched but no strategies linked',
    });
  }

  const [{ data: strategies }, { data: actions }, { data: policies }] = await Promise.all([
    serviceSupabase.from('strategies').select('*').in('id', strategyIds).eq('status', 'active'),
    serviceSupabase.from('actions').select('*').eq('tenant_id', tenantId).eq('status', 'active'),
    serviceSupabase.from('contact_policies').select('*').eq('tenant_id', tenantId),
  ]);

  // ── 4. Evaluate strategies and pick winner ───────────────────────────────────
  type Candidate = { strategyId: string; strategyName: string; action: Record<string, unknown>; propensity: number };
  const candidates: Candidate[] = [];

  for (const strategy of (strategies ?? [])) {
    if (car.consent === false || car.consentGiven === false) continue;

    // Eligibility rules
    const rules: Array<{ attribute: string; op: string; value: string }> = strategy.eligibility_rules ?? [];
    let eligible = true;
    for (const rule of rules) {
      const actual = car[rule.attribute];
      if (actual === undefined) continue;
      const ref = isNaN(Number(rule.value)) ? rule.value : Number(rule.value);
      const val = typeof ref === 'number' ? Number(actual) : String(actual);
      if (rule.op === '='  && val != ref)  { eligible = false; break; }
      if (rule.op === '!=' && val == ref)  { eligible = false; break; }
      if (rule.op === '>=' && val < ref)   { eligible = false; break; }
      if (rule.op === '<=' && val > ref)   { eligible = false; break; }
    }
    if (!eligible) continue;

    const policy = (policies ?? []).find((p: { id: string }) => p.id === strategy.policy_id);
    const suppressed = (policy?.suppression_rules ?? []).some((rule: string) => {
      const [attr,, val] = rule.trim().split(/\s+/);
      return String(car[attr]) === val;
    });
    if (suppressed) continue;

    const strategyActions = (actions ?? []).filter((a: { id: string; channels: string[] }) =>
      strategy.action_ids?.includes(a.id) &&
      (a.channels?.length === 0 || a.channels?.includes(channel))
    );
    if (!strategyActions.length) continue;

    strategyActions.sort((a: { base_propensity: number }, b: { base_propensity: number }) => b.base_propensity - a.base_propensity);
    const best = strategyActions[0];
    candidates.push({ strategyId: strategy.id, strategyName: strategy.name, action: best, propensity: best.base_propensity });
  }

  candidates.sort((a, b) => b.propensity - a.propensity);
  const winner = candidates[0] ?? null;

  // ── 5. Log decision ──────────────────────────────────────────────────────────
  let decisionId: string | null = null;
  if (winner) {
    decisionId = await insertDecisionLog({
      tenant_id:           tenantId,
      customer_id:         customerId,
      strategy_id:         winner.strategyId,
      strategy_name:       winner.strategyName,
      action_id:           winner.action.id as string,
      action_name:         winner.action.name as string,
      channel_id:          channel,
      served:              true,
      propensity:          winner.propensity,
      customer_attributes: car,
      trace:               [{ step: 'event-trigger', eventType, interactionId }],
      decision_latency_ms: Date.now() - start,
    }, tenantId);
  }

  return NextResponse.json({
    matched:         true,
    eventType,
    customerId,
    triggersMatched: triggers.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })),
    decision:        winner ? {
      pxInteractionID: interactionId,
      decisionId,
      pyName:          winner.action.name,
      pyIssue:         winner.strategyName,
      pyPropensity:    winner.propensity,
      pyChannel:       channel,
      Headline:        winner.action.headline ?? winner.action.name,
      OfferCode:       winner.action.offer_code ?? '',
      ExpectedValue:   winner.action.expected_value ?? 0,
    } : null,
    candidatesEvaluated: candidates.length,
    pxInteractionID: interactionId,
    latencyMs:       Date.now() - start,
  });
}

// GET — list all registered event types
export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? TENANT;

  if (!serviceSupabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const { data } = await serviceSupabase
    .from('event_triggers').select('id,name,event_type,strategy_ids,channel_ids,enabled')
    .eq('tenant_id', tenantId);

  return NextResponse.json({
    eventTypes: (data ?? []).map((t: { id: string; name: string; event_type: string; strategy_ids: string[]; enabled: boolean }) => ({
      id:           t.id,
      name:         t.name,
      eventType:    t.event_type,
      strategyCount: t.strategy_ids?.length ?? 0,
      enabled:      t.enabled,
    })),
    total: data?.length ?? 0,
  });
}
