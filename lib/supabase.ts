/**
 * Supabase client + typed database interface
 *
 * Setup:
 *   1. Create a free project at https://supabase.com
 *   2. Run supabase/schema.sql then supabase/schema_v2.sql
 *   3. Copy URL + anon key from Settings → API
 *   4. Add to .env.local:
 *        NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
 *        NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
 *   5. Restart: npm run dev -- -p 3100
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'crypto';

const SUPA_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL      ?? '';
const KEY         = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY  ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY      ?? KEY;

export const IS_CONFIGURED = Boolean(SUPA_URL && KEY);

export const supabase: SupabaseClient | null = IS_CONFIGURED
  ? createClient(SUPA_URL, KEY)
  : null;

// Server-side client using service role key — bypasses RLS.
// Use this in API routes that need to read any tenant's data server-side.
export const serviceSupabase: SupabaseClient | null = IS_CONFIGURED
  ? createClient(SUPA_URL, SERVICE_KEY)
  : null;

// ── Database types ────────────────────────────────────────────────────────────

export interface DBStrategy {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  category_id?: string;
  topic_id?: string;
  action_ids: string[];
  channel_ids: string[];
  audience_ids: string[];
  eligibility_rules?: Array<{ attribute: string; op: string; value: string }>;
  // Engagement-policy layers (Pega CDH): eligibility (above) → applicability → suitability
  applicability_rules?: Array<{ attribute: string; op: string; value: string }>;
  suitability_rules?: Array<{ attribute: string; op: string; value: string }>;
  // Arbitration: Priority = P × C × V × L
  context_weight?: number;        // C — situational weight (default 1)
  business_levers?: Array<{ id?: string; label: string; multiplier: number; condition?: { attribute: string; op: string; value: string } | null; enabled?: boolean }>;
  control_group_pct?: number;     // 0–1 random hold-out for lift measurement
  policy_id?: string;
  model_id?: string;
  arbitration: 'propensity' | 'value' | 'weighted' | 'random_ab';
  priority: 'low' | 'standard' | 'high' | 'critical';
  status: 'active' | 'draft' | 'paused' | 'ended';
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

export interface DBAction {
  id: string;
  tenant_id: string;
  topic_id: string;
  category_id: string;
  name: string;
  description?: string;
  headline?: string;
  offer_code?: string;
  channels: string[];
  base_propensity: number;
  expected_value?: number;
  status: 'active' | 'draft' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface DBContactPolicy {
  id: string;
  tenant_id: string;
  name: string;
  max_per_day: number;
  max_per_week: number;
  max_per_month: number;
  fatigue_window_days: number;
  conversion_cooldown_days: number;
  requires_consent: boolean;
  fairness_enabled: boolean;
  fairness_threshold: number;
  fairness_attribute?: string;
  suppression_rules: string[];
  status: 'active' | 'draft';
}

export interface DBDecisionLog {
  id: string;
  tenant_id: string;
  customer_id: string;
  strategy_id?: string;
  strategy_name?: string;
  action_id?: string;
  action_name?: string;
  channel_id?: string;
  served: boolean;
  suppression_reason?: string;
  propensity?: number;
  outcome?: 'accepted' | 'rejected' | 'ignored';
  customer_attributes: Record<string, unknown>;
  trace: unknown[];
  decision_latency_ms?: number;
  experiment_id?: string;
  is_control?: boolean;
  variant_name?: string;
  created_at: string;
}

export interface DBCustomerProfile {
  id: string;
  tenant_id: string;
  customer_id: string;
  attributes: Record<string, unknown>;
  segments: string[];
  interaction_count: number;
  last_seen_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DBApiKey {
  id: string;
  tenant_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  created_by?: string;
  last_used_at?: string;
  status: 'active' | 'revoked';
  created_at: string;
}

export interface DBExperiment {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  variants: Array<{ strategyId: string; name: string; trafficPct: number }>;
  traffic_split: Record<string, number>;
  winner_strategy_id?: string;
  start_date?: string;
  end_date?: string;
  auto_promote: boolean;
  promotion_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface DBBatchJob {
  id: string;
  tenant_id: string;
  name: string;
  strategy_ids: string[];
  channel_id?: string;
  audience_id?: string;
  schedule_cron?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  run_at?: string;
  completed_at?: string;
  total_customers: number;
  served_count: number;
  suppressed_count: number;
  error_message?: string;
  created_at: string;
}

export interface DBConfigAudit {
  id: string;
  tenant_id: string;
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  action: 'created' | 'updated' | 'deleted' | 'activated' | 'paused' | 'promoted';
  changed_by?: string;
  before_snapshot?: Record<string, unknown>;
  after_snapshot?: Record<string, unknown>;
  created_at: string;
}

export interface DBEventTrigger {
  id: string;
  tenant_id: string;
  name: string;
  event_type: string;
  event_conditions: Record<string, unknown>;
  strategy_ids: string[];
  channel_ids: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ── Core CRUD helpers ─────────────────────────────────────────────────────────

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';

export async function fetchStrategies(tenantId = DEFAULT_TENANT): Promise<DBStrategy[]> {
  if (!serviceSupabase) return [];
  const { data, error } = await serviceSupabase
    .from('strategies').select('*').eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchStrategies:', error); return []; }
  return data ?? [];
}

export async function upsertStrategy(
  strategy: Partial<DBStrategy> & { name: string },
  tenantId = DEFAULT_TENANT
): Promise<DBStrategy | null> {
  if (!serviceSupabase) return null;
  const { data, error } = await serviceSupabase
    .from('strategies')
    .upsert({ ...strategy, tenant_id: tenantId, updated_at: new Date().toISOString() })
    .select().single();
  if (error) { console.error('upsertStrategy:', error); return null; }
  return data;
}

export async function fetchActions(tenantId = DEFAULT_TENANT): Promise<DBAction[]> {
  if (!serviceSupabase) return [];
  const { data, error } = await serviceSupabase
    .from('actions').select('*').eq('tenant_id', tenantId).eq('status', 'active');
  if (error) { console.error('fetchActions:', error); return []; }
  return data ?? [];
}

export async function fetchPolicies(tenantId = DEFAULT_TENANT): Promise<DBContactPolicy[]> {
  if (!serviceSupabase) return [];
  const { data, error } = await serviceSupabase
    .from('contact_policies').select('*').eq('tenant_id', tenantId);
  if (error) { console.error('fetchPolicies:', error); return []; }
  return data ?? [];
}

export async function insertDecisionLog(
  record: Omit<DBDecisionLog, 'id' | 'created_at'>,
  tenantId = DEFAULT_TENANT
): Promise<string | null> {
  if (!serviceSupabase) return null;
  const { data, error } = await serviceSupabase
    .from('decision_log')
    .insert({ ...record, tenant_id: tenantId })
    .select('id').single();
  if (error) { console.error('insertDecisionLog:', error); return null; }
  return data?.id ?? null;
}

export async function fetchDecisionLog(
  tenantId = DEFAULT_TENANT,
  limit = 100
): Promise<DBDecisionLog[]> {
  if (!serviceSupabase) return [];
  const { data, error } = await serviceSupabase
    .from('decision_log').select('*').eq('tenant_id', tenantId)
    .order('created_at', { ascending: false }).limit(limit);
  if (error) { console.error('fetchDecisionLog:', error); return []; }
  return data ?? [];
}

export async function updateDecisionOutcome(
  decisionId: string,
  outcome: 'accepted' | 'rejected' | 'ignored'
): Promise<void> {
  if (!serviceSupabase) return;
  const { error } = await serviceSupabase
    .from('decision_log').update({ outcome }).eq('id', decisionId);
  if (error) console.error('updateDecisionOutcome:', error);
}

export async function getContactCounts(
  tenantId: string,
  customerId: string
): Promise<{ today: number; week: number; month: number }> {
  if (!serviceSupabase) return { today: 0, week: 0, month: 0 };
  const { data } = await serviceSupabase.rpc('get_contact_counts', {
    p_tenant_id: tenantId,
    p_customer_id: customerId,
  });
  return {
    today: data?.[0]?.count_today ?? 0,
    week:  data?.[0]?.count_week  ?? 0,
    month: data?.[0]?.count_month ?? 0,
  };
}

export async function incrementContactCount(
  tenantId: string,
  customerId: string,
  channelId: string
): Promise<void> {
  if (!serviceSupabase) return;
  await serviceSupabase.rpc('increment_contact_count', {
    p_tenant_id: tenantId,
    p_customer_id: customerId,
    p_channel_id: channelId,
  });
}

// ── Customer Profiles ─────────────────────────────────────────────────────────

export async function fetchCustomerProfile(
  tenantId: string,
  customerId: string
): Promise<DBCustomerProfile | null> {
  if (!serviceSupabase) return null;
  const { data } = await serviceSupabase
    .from('customer_profiles').select('*')
    .eq('tenant_id', tenantId).eq('customer_id', customerId).single();
  return data ?? null;
}

export async function fetchCustomerProfiles(
  tenantId = DEFAULT_TENANT,
  limit = 100
): Promise<DBCustomerProfile[]> {
  if (!serviceSupabase) return [];
  const { data } = await serviceSupabase
    .from('customer_profiles').select('*').eq('tenant_id', tenantId)
    .order('last_seen_at', { ascending: false }).limit(limit);
  return data ?? [];
}

export async function upsertCustomerProfile(
  tenantId: string,
  customerId: string,
  attributes: Record<string, unknown>
): Promise<void> {
  if (!serviceSupabase) return;
  // Fetch existing to merge attributes rather than overwrite
  const { data: existing } = await serviceSupabase
    .from('customer_profiles').select('id, attributes, interaction_count')
    .eq('tenant_id', tenantId).eq('customer_id', customerId).single();

  if (existing) {
    await serviceSupabase.from('customer_profiles').update({
      attributes: { ...(existing.attributes ?? {}), ...attributes },
      last_seen_at: new Date().toISOString(),
      interaction_count: (existing.interaction_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq('tenant_id', tenantId).eq('customer_id', customerId);
  } else {
    await serviceSupabase.from('customer_profiles').insert({
      tenant_id: tenantId,
      customer_id: customerId,
      attributes,
      segments: [],
      interaction_count: 0,
      last_seen_at: new Date().toISOString(),
    });
  }
}

export async function deleteCustomerProfile(
  tenantId: string,
  customerId: string
): Promise<number> {
  if (!serviceSupabase) return 0;
  await serviceSupabase.from('customer_profiles').delete()
    .eq('tenant_id', tenantId).eq('customer_id', customerId);
  const { count } = await serviceSupabase.from('decision_log')
    .delete({ count: 'exact' })
    .eq('tenant_id', tenantId).eq('customer_id', customerId);
  return count ?? 0;
}

// ── API Keys ──────────────────────────────────────────────────────────────────

export async function createApiKey(
  tenantId: string,
  name: string,
  createdBy?: string
): Promise<{ key: string; record: DBApiKey } | null> {
  if (!serviceSupabase) return null;
  const raw        = 'ncdh_' + randomBytes(32).toString('hex');
  const key_prefix = raw.substring(0, 12);
  const key_hash   = createHash('sha256').update(raw).digest('hex');
  const { data, error } = await serviceSupabase
    .from('api_keys')
    .insert({ tenant_id: tenantId, name, key_prefix, key_hash, created_by: createdBy, status: 'active' })
    .select().single();
  if (error) { console.error('createApiKey:', error); return null; }
  return { key: raw, record: data };
}

export async function listApiKeys(tenantId = DEFAULT_TENANT): Promise<DBApiKey[]> {
  if (!serviceSupabase) return [];
  const { data } = await serviceSupabase
    .from('api_keys').select('*').eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function revokeApiKey(id: string): Promise<void> {
  if (!serviceSupabase) return;
  await serviceSupabase.from('api_keys').update({ status: 'revoked' }).eq('id', id);
}

export async function validateApiKey(
  keyPrefix: string,
  fullKey: string,
  tenantId: string
): Promise<boolean> {
  if (!serviceSupabase) return false;
  const key_hash = createHash('sha256').update(fullKey).digest('hex');
  const { data } = await serviceSupabase
    .from('api_keys').select('id')
    .eq('tenant_id', tenantId).eq('key_prefix', keyPrefix)
    .eq('key_hash', key_hash).eq('status', 'active').single();
  if (!data) return false;
  await serviceSupabase.from('api_keys')
    .update({ last_used_at: new Date().toISOString() }).eq('id', data.id);
  return true;
}

// ── Experiments ───────────────────────────────────────────────────────────────

export async function fetchExperiments(tenantId = DEFAULT_TENANT): Promise<DBExperiment[]> {
  if (!serviceSupabase) return [];
  const { data } = await serviceSupabase
    .from('experiments').select('*').eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function upsertExperiment(
  exp: Partial<DBExperiment> & { name: string },
  tenantId = DEFAULT_TENANT
): Promise<DBExperiment | null> {
  if (!serviceSupabase) return null;
  const { data, error } = await serviceSupabase
    .from('experiments')
    .upsert({ ...exp, tenant_id: tenantId, updated_at: new Date().toISOString() })
    .select().single();
  if (error) { console.error('upsertExperiment:', error); return null; }
  return data;
}

// ── Batch Jobs ────────────────────────────────────────────────────────────────

export async function fetchBatchJobs(tenantId = DEFAULT_TENANT): Promise<DBBatchJob[]> {
  if (!serviceSupabase) return [];
  const { data } = await serviceSupabase
    .from('batch_jobs').select('*').eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function upsertBatchJob(
  job: Partial<DBBatchJob> & { name: string },
  tenantId = DEFAULT_TENANT
): Promise<DBBatchJob | null> {
  if (!serviceSupabase) return null;
  const { data, error } = await serviceSupabase
    .from('batch_jobs').upsert({ ...job, tenant_id: tenantId }).select().single();
  if (error) { console.error('upsertBatchJob:', error); return null; }
  return data;
}

// ── Config Audit Log ──────────────────────────────────────────────────────────

export async function insertConfigAudit(
  record: Omit<DBConfigAudit, 'id' | 'created_at'>,
  tenantId = DEFAULT_TENANT
): Promise<void> {
  if (!serviceSupabase) return;
  const { error } = await serviceSupabase
    .from('config_audit_log').insert({ ...record, tenant_id: tenantId });
  if (error) console.error('insertConfigAudit:', error);
}

export async function fetchConfigAudit(
  tenantId = DEFAULT_TENANT,
  entityType?: string,
  limit = 50,
  entityId?: string
): Promise<DBConfigAudit[]> {
  if (!serviceSupabase) return [];
  let q = serviceSupabase.from('config_audit_log').select('*')
    .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(limit);
  if (entityType) q = q.eq('entity_type', entityType);
  if (entityId)   q = q.eq('entity_id', entityId);
  const { data } = await q;
  return data ?? [];
}

// ── Event Triggers ────────────────────────────────────────────────────────────

export async function fetchEventTriggers(tenantId = DEFAULT_TENANT): Promise<DBEventTrigger[]> {
  if (!serviceSupabase) return [];
  const { data } = await serviceSupabase
    .from('event_triggers').select('*').eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function upsertEventTrigger(
  trigger: Partial<DBEventTrigger> & { name: string; event_type: string },
  tenantId = DEFAULT_TENANT
): Promise<DBEventTrigger | null> {
  if (!serviceSupabase) return null;
  const { data, error } = await serviceSupabase
    .from('event_triggers')
    .upsert({ ...trigger, tenant_id: tenantId, updated_at: new Date().toISOString() })
    .select().single();
  if (error) { console.error('upsertEventTrigger:', error); return null; }
  return data;
}
