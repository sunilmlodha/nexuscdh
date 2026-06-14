/**
 * Supabase client + typed database interface
 *
 * Setup:
 *   1. Create a free project at https://supabase.com
 *   2. Run supabase/schema.sql in your project's SQL editor
 *   3. Copy your project URL and anon key from Settings → API
 *   4. Add to .env.local:
 *        NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
 *        NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
 *   5. Restart: npm run dev -- -p 3100
 *
 * Until configured, all API calls return empty/mock data (graceful fallback).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? '';
const KEY  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const IS_CONFIGURED = Boolean(URL && KEY);

// Gracefully return null client when not configured (dev/demo mode)
export const supabase: SupabaseClient | null = IS_CONFIGURED
  ? createClient(URL, KEY)
  : null;

// ── Database types (mirrors schema.sql) ──────────────────────────────────────

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
  created_at: string;
}

// ── CRUD helpers ──────────────────────────────────────────────────────────────

const DEFAULT_TENANT = 'default-tenant';

export async function fetchStrategies(tenantId = DEFAULT_TENANT): Promise<DBStrategy[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('strategies')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchStrategies:', error); return []; }
  return data ?? [];
}

export async function upsertStrategy(strategy: Partial<DBStrategy> & { name: string }, tenantId = DEFAULT_TENANT): Promise<DBStrategy | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('strategies')
    .upsert({ ...strategy, tenant_id: tenantId, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) { console.error('upsertStrategy:', error); return null; }
  return data;
}

export async function fetchActions(tenantId = DEFAULT_TENANT): Promise<DBAction[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('actions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'active');
  if (error) { console.error('fetchActions:', error); return []; }
  return data ?? [];
}

export async function fetchPolicies(tenantId = DEFAULT_TENANT): Promise<DBContactPolicy[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('contact_policies')
    .select('*')
    .eq('tenant_id', tenantId);
  if (error) { console.error('fetchPolicies:', error); return []; }
  return data ?? [];
}

export async function insertDecisionLog(
  record: Omit<DBDecisionLog, 'id' | 'created_at'>,
  tenantId = DEFAULT_TENANT
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('decision_log')
    .insert({ ...record, tenant_id: tenantId });
  if (error) console.error('insertDecisionLog:', error);
}

export async function fetchDecisionLog(
  tenantId = DEFAULT_TENANT,
  limit = 100
): Promise<DBDecisionLog[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('decision_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('fetchDecisionLog:', error); return []; }
  return data ?? [];
}

export async function getContactCounts(
  tenantId: string,
  customerId: string
): Promise<{ today: number; week: number; month: number }> {
  if (!supabase) return { today: 0, week: 0, month: 0 };
  const { data } = await supabase.rpc('get_contact_counts', {
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
  if (!supabase) return;
  await supabase.rpc('increment_contact_count', {
    p_tenant_id:  tenantId,
    p_customer_id: customerId,
    p_channel_id: channelId,
  });
}
