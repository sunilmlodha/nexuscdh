/**
 * Artefact registry for Revision Management.
 *
 * Defines which entity types marketers can change, which fields are editable,
 * and how to list / apply / revert changes against the live tables. Used by the
 * change-request builder (picker + diff) and the deploy/rollback engine.
 */

import { serviceSupabase } from './supabase';

export type FieldType = 'text' | 'number' | 'select' | 'date';
export interface FieldDef { key: string; label: string; type: FieldType; options?: string[]; }
export interface ArtefactDef { type: string; label: string; table: string; nameField: string; fields: FieldDef[]; }

export const ARTEFACTS: Record<string, ArtefactDef> = {
  action: {
    type: 'action', label: 'Action', table: 'actions', nameField: 'name',
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'draft', 'archived'] },
      { key: 'base_propensity', label: 'Base propensity', type: 'number' },
      { key: 'expected_value', label: 'Expected value', type: 'number' },
      { key: 'headline', label: 'Headline', type: 'text' },
      { key: 'offer_code', label: 'Offer code', type: 'text' },
    ],
  },
  treatment: {
    type: 'treatment', label: 'Treatment', table: 'treatments', nameField: 'name',
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['draft', 'active', 'paused', 'archived'] },
      { key: 'offer_state', label: 'Offer state', type: 'select', options: ['draft', 'in_review', 'live', 'expired'] },
      { key: 'channel', label: 'Channel', type: 'select', options: ['email', 'sms', 'push', 'in_app', 'direct_mail', 'outbound_call'] },
      { key: 'headline', label: 'Headline', type: 'text' },
      { key: 'cta_label', label: 'CTA label', type: 'text' },
      { key: 'offer_code', label: 'Offer code', type: 'text' },
      { key: 'effective_from', label: 'Effective from', type: 'date' },
      { key: 'effective_to', label: 'Effective to', type: 'date' },
    ],
  },
  strategy: {
    type: 'strategy', label: 'Strategy', table: 'strategies', nameField: 'name',
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'draft', 'paused', 'ended'] },
      { key: 'arbitration', label: 'Arbitration', type: 'select', options: ['propensity', 'value', 'weighted', 'random_ab'] },
      { key: 'priority', label: 'Priority', type: 'select', options: ['low', 'standard', 'high', 'critical'] },
      { key: 'context_weight', label: 'Context weight (C)', type: 'number' },
      { key: 'control_group_pct', label: 'Control group %', type: 'number' },
    ],
  },
  contact_policy: {
    type: 'contact_policy', label: 'Contact Policy', table: 'contact_policies', nameField: 'name',
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'max_per_day', label: 'Max / day', type: 'number' },
      { key: 'max_per_week', label: 'Max / week', type: 'number' },
      { key: 'max_per_month', label: 'Max / month', type: 'number' },
    ],
  },
  campaign: {
    type: 'campaign', label: 'Campaign', table: 'campaigns', nameField: 'name',
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['draft', 'active', 'paused', 'completed'] },
    ],
  },
  journey: {
    type: 'journey', label: 'Journey', table: 'journeys', nameField: 'name',
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['draft', 'active', 'paused', 'archived'] },
    ],
  },
};

export interface ChangeItem {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string;
  operation: 'update' | 'archive';
  before?: Record<string, unknown>;   // captured at deploy (for rollback + audit)
  after: Record<string, unknown>;     // proposed field values
  appliedAt?: string;
}

/** List entities of a type with their current editable-field values (for the picker). */
export async function listArtefacts(tenantId: string, type: string) {
  const def = ARTEFACTS[type];
  if (!def || !serviceSupabase) return [];
  const cols = ['id', def.nameField, ...def.fields.map(f => f.key)];
  const { data } = await serviceSupabase
    .from(def.table).select(Array.from(new Set(cols)).join(','))
    .eq('tenant_id', tenantId).limit(500);
  return data ?? [];
}

/** Coerce a form value to the field's type before persisting. */
function coerce(def: ArtefactDef, key: string, value: unknown): unknown {
  const f = def.fields.find(x => x.key === key);
  if (!f) return value;
  if (value === '' || value === null || value === undefined) return null;
  if (f.type === 'number') { const n = Number(value); return isNaN(n) ? null : n; }
  return value;
}

/** Apply one change item to the live table; returns the captured before-state. */
export async function applyChange(tenantId: string, item: ChangeItem): Promise<Record<string, unknown> | null> {
  const def = ARTEFACTS[item.entityType];
  if (!def || !serviceSupabase) return null;

  // capture current state (for audit + rollback)
  const { data: current } = await serviceSupabase
    .from(def.table).select('*').eq('id', item.entityId).eq('tenant_id', tenantId).maybeSingle();

  const patch: Record<string, unknown> =
    item.operation === 'archive'
      ? { status: 'archived' }
      : Object.fromEntries(Object.entries(item.after).map(([k, v]) => [k, coerce(def, k, v)]));

  await serviceSupabase.from(def.table).update(patch).eq('id', item.entityId).eq('tenant_id', tenantId);

  // before-snapshot limited to the fields we touched
  const touched = Object.keys(patch);
  const before: Record<string, unknown> = {};
  for (const k of touched) before[k] = (current ?? {})[k];
  return before;
}

/** Revert one applied change item using its captured before-state. */
export async function revertChange(tenantId: string, item: ChangeItem): Promise<void> {
  const def = ARTEFACTS[item.entityType];
  if (!def || !serviceSupabase || !item.before) return;
  await serviceSupabase.from(def.table).update(item.before).eq('id', item.entityId).eq('tenant_id', tenantId);
}
