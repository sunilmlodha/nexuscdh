/**
 * POST /api/v4/containers/{containerName}
 *
 * Pega CDH V4 Real-Time Container API — Stratcheck compatible implementation.
 *
 * Mirrors the Pega Customer Decision Hub V4 Container API contract so existing
 * Pega CDH integrations (web, mobile, CRM) can point at Stratcheck with zero
 * client-side changes.
 *
 * Pega docs reference:
 *   https://community.pega.com/sites/default/files/help_v83/...
 *
 * Body:
 *   {
 *     "context": {
 *       "customer": {
 *         "CustomerID": "cust-001",
 *         "Age": 38,
 *         "Segment": "affluent",
 *         ... any customer attributes
 *       }
 *     },
 *     "channel": "web",           // optional, used to filter actions
 *     "tenantId": "...",          // optional, Stratcheck extension
 *     "maxActions": 3             // optional, limit returned actions (default 3)
 *   }
 *
 * Returns Pega V4 container response shape:
 *   {
 *     "container": "PrimaryContainer",
 *     "decisions": [...],
 *     "pxInteractionID": "INT-...",
 *     "pxObjClass": "CDH-NBAResult"
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { serviceSupabase } from '@/lib/supabase';
import { randomUUID } from 'crypto';

const TENANT = process.env.NEXUS_TENANT_ID ?? 'f0000000-0000-4000-a000-000000000001';

// Map Pega pyOutcome values → Stratcheck outcomes (used in capture response)
const PEGA_OUTCOME_MAP: Record<string, string> = {
  Clicked:    'accepted',
  Accepted:   'accepted',
  Converted:  'accepted',
  Dismissed:  'rejected',
  Rejected:   'rejected',
  Impressed:  'ignored',
  Viewed:     'ignored',
};

export async function POST(
  req: NextRequest,
  { params }: { params: { containerName: string } }
) {
  const containerName = params.containerName;
  const interactionId = `INT-${randomUUID().slice(0, 8).toUpperCase()}`;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  const customerCtx  = (body.context as Record<string, Record<string, unknown>>)?.customer ?? {};
  const customerId   = (customerCtx.CustomerID ?? customerCtx.customerId ?? '') as string;
  const channelHint  = (body.channel as string) ?? 'web';
  const tenantId     = (body.tenantId as string) ?? TENANT;
  const maxActions   = Number(body.maxActions ?? 3);

  if (!customerId) {
    return NextResponse.json(
      { error: 'context.customer.CustomerID is required' },
      { status: 400 }
    );
  }

  if (!serviceSupabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const start = Date.now();

  // ── 1. Load customer profile + merge call-time attributes ────────────────────
  const { data: profileRow } = await serviceSupabase
    .from('customer_profiles').select('attributes')
    .eq('tenant_id', tenantId).eq('customer_id', customerId).single();

  const car: Record<string, unknown> = {
    ...(profileRow?.attributes ?? {}),
    ...customerCtx,
    CustomerID: customerId,
  };

  // ── 2. Fetch active strategies + actions + policies ──────────────────────────
  const [{ data: strategies }, { data: actions }, { data: policies }] = await Promise.all([
    serviceSupabase.from('strategies').select('*').eq('tenant_id', tenantId).eq('status', 'active'),
    serviceSupabase.from('actions').select('*').eq('tenant_id', tenantId).eq('status', 'active'),
    serviceSupabase.from('contact_policies').select('*').eq('tenant_id', tenantId),
  ]);

  const allStrategies = strategies ?? [];
  const allActions    = actions    ?? [];
  const allPolicies   = policies   ?? [];

  // ── 3. Container → strategy mapping ─────────────────────────────────────────
  // Prefer a persisted container config (managed at /containers). Fall back to
  // the built-in demo mapping, then to all active strategies.
  const { data: containerCfg } = await serviceSupabase
    .from('realtime_containers').select('strategy_ids, status')
    .eq('tenant_id', tenantId).eq('name', containerName).maybeSingle();

  const containerMap: Record<string, string[]> = {
    SalesContainer:       allStrategies.filter(s => s.name?.toLowerCase().includes('sale') || s.name?.toLowerCase().includes('insurance') || s.name?.toLowerCase().includes('card')).map((s: {id: string}) => s.id),
    RetentionContainer:   allStrategies.filter(s => s.name?.toLowerCase().includes('re-engage') || s.name?.toLowerCase().includes('retention')).map((s: {id: string}) => s.id),
    OnboardingContainer:  allStrategies.filter(s => s.name?.toLowerCase().includes('onboard')).map((s: {id: string}) => s.id),
  };

  const configuredIds = containerCfg && Array.isArray(containerCfg.strategy_ids) && containerCfg.strategy_ids.length
    ? containerCfg.strategy_ids as string[]
    : null;
  const eligibleStrategyIds = configuredIds ?? containerMap[containerName] ?? allStrategies.map((s: {id: string}) => s.id);
  const eligibleStrategies  = allStrategies.filter((s: {id: string}) => eligibleStrategyIds.includes(s.id));

  // ── 4. Evaluate each strategy ────────────────────────────────────────────────
  type Candidate = {
    rank: number;
    issue: string;
    group: string;
    name: string;
    direction: string;
    priority: number;
    propensity: number;
    strategyId: string;
    strategyName: string;
    context: Record<string, unknown>;
  };

  const candidates: Candidate[] = [];

  for (const strategy of eligibleStrategies) {
    // Consent check
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
      if (rule.op === '>'  && val <= ref)  { eligible = false; break; }
      if (rule.op === '<'  && val >= ref)  { eligible = false; break; }
    }
    if (!eligible) continue;

    // Policy: contact frequency (simplified — check from DB counts if needed)
    const policy = allPolicies.find((p: {id: string}) => p.id === strategy.policy_id);
    const suppressed = (policy?.suppression_rules ?? []).some((rule: string) => {
      const [attr,, val] = rule.trim().split(/\s+/);
      return String(car[attr]) === val;
    });
    if (suppressed) continue;

    // Filter actions by strategy + channel
    const strategyActions = allActions.filter((a: {id: string; channels: string[]}) =>
      strategy.action_ids?.includes(a.id) &&
      (a.channels?.length === 0 || a.channels?.includes(channelHint))
    );
    if (!strategyActions.length) continue;

    // Arbitration
    let sorted = [...strategyActions];
    if (strategy.arbitration === 'value')    sorted.sort((a: {expected_value: number}, b: {expected_value: number}) => (b.expected_value ?? 0) - (a.expected_value ?? 0));
    else if (strategy.arbitration === 'weighted') sorted.sort((a: {base_propensity: number; expected_value: number}, b: {base_propensity: number; expected_value: number}) => ((b.base_propensity * 0.7) + ((b.expected_value ?? 0) / 1000 * 0.3)) - ((a.base_propensity * 0.7) + ((a.expected_value ?? 0) / 1000 * 0.3)));
    else sorted.sort((a: {base_propensity: number}, b: {base_propensity: number}) => b.base_propensity - a.base_propensity);

    const topAction = sorted[0];

    // Fetch category + topic names for Pega Issue/Group
    const { data: catRow } = await serviceSupabase.from('action_categories').select('name').eq('id', strategy.category_id).single();
    const { data: topRow } = await serviceSupabase.from('action_topics').select('name').eq('id', strategy.topic_id).single();

    candidates.push({
      rank:         0, // assigned after global sort
      issue:        catRow?.name ?? 'Sales',
      group:        topRow?.name ?? strategy.name,
      name:         topAction.name,
      direction:    'Outbound',
      priority:     topAction.base_propensity,
      propensity:   topAction.base_propensity,
      strategyId:   strategy.id,
      strategyName: strategy.name,
      context: {
        pyName:          topAction.name,
        pyIssue:         catRow?.name ?? 'Sales',
        pyGroup:         topRow?.name ?? strategy.name,
        pyPropensity:    topAction.base_propensity,
        pyPriority:      topAction.base_propensity,
        pyChannel:       channelHint,
        pyDirection:     'Outbound',
        pyTreatment:     `${topAction.name}-${channelHint}`,
        pxInteractionID: interactionId,
        pxStrategyID:    strategy.id,
        pxStrategyName:  strategy.name,
        // Action-level content
        Headline:        topAction.headline ?? topAction.name,
        Body:            topAction.body ?? topAction.description ?? '',
        CtaLabel:        topAction.cta_label ?? 'Learn More',
        OfferCode:       topAction.offer_code ?? '',
        ExpectedValue:   topAction.expected_value ?? 0,
        ActionID:        topAction.id,
      },
    });
  }

  // ── 5. Global arbitration — sort by propensity, assign rank ─────────────────
  candidates.sort((a, b) => b.propensity - a.propensity);
  const decisions = candidates.slice(0, maxActions).map((c, i) => ({ ...c, rank: i + 1 }));

  // ── 6. Log to decision_log ───────────────────────────────────────────────────
  if (decisions.length > 0) {
    const winner = decisions[0];
    await serviceSupabase.from('decision_log').insert({
      id:                  randomUUID(),
      tenant_id:           tenantId,
      customer_id:         customerId,
      strategy_id:         winner.strategyId,
      strategy_name:       winner.strategyName,
      action_id:           winner.context.ActionID as string,
      action_name:         winner.name,
      channel_id:          channelHint,
      served:              true,
      propensity:          winner.propensity,
      customer_attributes: car,
      trace:               [{ step: 'v4-container', container: containerName, candidates: candidates.length }],
      decision_latency_ms: Date.now() - start,
      experiment_id:       interactionId,
    });
  }

  return NextResponse.json({
    container:       containerName,
    decisions,
    pxInteractionID: interactionId,
    pxObjClass:      'CDH-NBAResult',
    pxRequestDT:     new Date().toISOString(),
    latencyMs:       Date.now() - start,
    strategiesEvaluated: eligibleStrategies.length,
    candidatesFound:     candidates.length,
  });
}

// GET — health/schema discovery endpoint
export async function GET(
  _req: NextRequest,
  { params }: { params: { containerName: string } }
) {
  return NextResponse.json({
    container:   params.containerName,
    description: 'Stratcheck V4 Container API — Pega CDH compatible',
    method:      'POST',
    body: {
      context: { customer: { CustomerID: 'string (required)', '...attributes': 'any' } },
      channel:    'string (optional) — web|email|mobile|sms|push',
      tenantId:   'string (optional)',
      maxActions: 'number (optional, default 3)',
    },
    knownContainers: ['PrimaryContainer', 'SalesContainer', 'RetentionContainer', 'OnboardingContainer'],
  });
}
