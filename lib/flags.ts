/**
 * Feature flags — per-tenant controlled rollout. isEnabled() supports a
 * deterministic %-rollout keyed on a subject (e.g. customer id) so a partial
 * rollout is stable per subject.
 */
import { serviceSupabase } from './supabase';
import { hashFraction } from './decision-engine';

export async function isEnabled(tenantId: string, key: string, subjectId?: string): Promise<boolean> {
  if (!serviceSupabase) return false;
  const { data } = await serviceSupabase
    .from('feature_flags').select('enabled, rollout_pct')
    .eq('tenant_id', tenantId).eq('key', key).maybeSingle();
  if (!data || !data.enabled) return false;
  const pct = data.rollout_pct ?? 1;
  if (pct >= 1) return true;
  if (!subjectId) return true;
  return hashFraction(`flag:${key}:${subjectId}`) < pct;
}
