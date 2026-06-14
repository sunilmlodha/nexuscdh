/**
 * GET /api/hydrate
 * Returns all Supabase data mapped to Zustand store shapes so the client
 * can hydrate the store on first load.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPA_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? '';
const SUPA_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
// Must match the TENANT_ID used in the seed route
const TENANT    = 'f0000000-0000-4000-a000-000000000001';

export async function GET() {
  if (!SUPA_URL || !SUPA_KEY) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const db = createClient(SUPA_URL, SUPA_KEY);

  const [cats, tops, acts, pols, strats, auds] = await Promise.all([
    db.from('action_categories').select('*').eq('tenant_id', TENANT),
    db.from('action_topics').select('*').eq('tenant_id', TENANT),
    db.from('actions').select('*').eq('tenant_id', TENANT).eq('status', 'active'),
    db.from('contact_policies').select('*').eq('tenant_id', TENANT),
    db.from('strategies').select('*').eq('tenant_id', TENANT),
    db.from('audiences').select('*').eq('tenant_id', TENANT),
  ]);

  // Map DB rows → Zustand store shapes (snake_case → camelCase)
  const categories = (cats.data ?? []).map(r => ({
    id: r.id, name: r.name, description: r.description ?? '',
    color: r.color ?? '#1D4ED8', createdAt: r.created_at,
  }));

  const topics = (tops.data ?? []).map(r => ({
    id: r.id, categoryId: r.category_id, name: r.name,
    description: r.description ?? '', createdAt: r.created_at,
  }));

  const actions = (acts.data ?? []).map(r => ({
    id: r.id, topicId: r.topic_id, categoryId: r.category_id,
    name: r.name, description: r.description ?? '',
    channels: r.channels ?? [], basePropensity: r.base_propensity ?? 0.5,
    headline: r.headline ?? '', body: r.body ?? '',
    offerCode: r.offer_code ?? '', value: r.expected_value ?? 0,
    status: r.status ?? 'active',
    createdAt: r.created_at, updatedAt: r.updated_at,
  }));

  const policies = (pols.data ?? []).map(r => ({
    id: r.id, name: r.name, description: r.description ?? '',
    channelIds: [], lobId: undefined,
    maxPerDay: r.max_per_day, maxPerWeek: r.max_per_week, maxPerMonth: r.max_per_month,
    fatigueWindowDays: r.fatigue_window_days ?? 7,
    conversionCooldownDays: r.conversion_cooldown_days ?? 30,
    requiresConsent: r.requires_consent ?? true, consentTypes: ['marketing'],
    fairnessEnabled: r.fairness_enabled ?? false,
    fairnessThreshold: r.fairness_threshold ?? 0.1,
    fairnessAttribute: r.fairness_attribute ?? undefined,
    suppressionRules: r.suppression_rules ?? [],
    status: r.status ?? 'active',
    createdAt: r.created_at, updatedAt: r.updated_at,
  }));

  const strategies = (strats.data ?? []).map(r => ({
    id: r.id, name: r.name, description: r.description ?? '',
    categoryId: r.category_id, topicId: r.topic_id,
    actionIds: r.action_ids ?? [], channelIds: r.channel_ids ?? [],
    audienceIds: r.audience_ids ?? [], policyId: r.policy_id,
    eligibilityRules: (r.eligibility_rules ?? []).map((rule: { attribute: string; op: string; value: string }) => ({
      attribute: rule.attribute, op: rule.op, value: rule.value,
    })),
    arbitration: r.arbitration ?? 'propensity',
    priority: r.priority ?? 'standard',
    status: r.status ?? 'active',
    startDate: r.start_date, endDate: r.end_date,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }));

  const audiences = (auds.data ?? []).map(r => ({
    id: r.id, name: r.name, description: r.description ?? '',
    rules: (r.rules ?? []).map((rule: { attribute: string; op: string; value: string }) => ({
      attribute: rule.attribute, op: rule.op, value: rule.value,
    })),
    estimatedSize: r.estimated_size ?? 0,
    status: r.status ?? 'active',
    createdAt: r.created_at, updatedAt: r.updated_at,
  }));

  return NextResponse.json({ categories, topics, actions, policies, strategies, audiences });
}
