import { serviceSupabase } from './supabase';

type AuditAction = 'created' | 'updated' | 'deleted' | 'activated' | 'paused' | 'promoted';

export async function writeAudit({
  tenantId,
  entityType,
  entityId,
  entityName,
  action,
  changedBy,
  before,
  after,
}: {
  tenantId: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  action: AuditAction;
  changedBy?: string;
  before?: unknown;
  after?: unknown;
}) {
  if (!serviceSupabase) return;
  try {
    await serviceSupabase.from('config_audit_log').insert({
      tenant_id:       tenantId,
      entity_type:     entityType,
      entity_id:       entityId,
      entity_name:     entityName ?? null,
      action,
      changed_by:      changedBy ?? 'system',
      before_snapshot: before ?? null,
      after_snapshot:  after ?? null,
    });
  } catch { /* audit is non-fatal */ }
}

export function detectAction(
  prevStatus: unknown,
  nextStatus: unknown,
  fallback: AuditAction = 'updated',
): AuditAction {
  if (prevStatus !== nextStatus) {
    if (nextStatus === 'active')   return 'activated';
    if (nextStatus === 'paused')   return 'paused';
    if (nextStatus === 'archived') return 'deleted';
  }
  return fallback;
}
