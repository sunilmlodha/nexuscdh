/**
 * Revision Management (1:1 Operations).
 *
 * GET    ?tenantId=            — list change requests
 * POST                        — create/update a change request, or transition it
 *                               via { id, action: 'submit'|'approve'|'reject'|'deploy' }
 * DELETE ?id=&tenantId=       — delete a draft change request
 *
 * Every transition is written to config_audit_log for a full governance trail.
 */

import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase } from '@/lib/supabase';
import { writeAudit } from '@/lib/audit';
import { ARTEFACTS, listArtefacts, applyChange, revertChange, type ChangeItem } from '@/lib/artefacts';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';
const ENTITY = 'change_request';

const TRANSITIONS: Record<string, { from: string[]; to: string; stamp?: string }> = {
  submit:   { from: ['draft', 'rejected'], to: 'in_review', stamp: 'submitted_at' },
  approve:  { from: ['in_review'],          to: 'approved' },
  reject:   { from: ['in_review'],          to: 'rejected' },
  deploy:   { from: ['approved'],           to: 'deployed', stamp: 'deployed_at' },
  rollback: { from: ['deployed'],           to: 'rejected' },
};

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });

  // Artefact catalogue (field definitions) for the change builder
  if (req.nextUrl.searchParams.get('catalogue') === 'true') {
    return NextResponse.json({ artefacts: Object.values(ARTEFACTS).map(a => ({ type: a.type, label: a.label, fields: a.fields })) });
  }
  // List entities of a type, with their current editable-field values
  const artefactType = req.nextUrl.searchParams.get('artefacts');
  if (artefactType) {
    const def = ARTEFACTS[artefactType];
    const rows = await listArtefacts(tenantId, artefactType);
    return NextResponse.json({ data: rows, nameField: def?.nameField ?? 'name' });
  }

  const { data, error } = await serviceSupabase!
    .from('change_requests').select('*').eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, configured: true });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const tenantId    = (body.tenantId as string) ?? DEFAULT_TENANT;
  const actor       = (body.actor as string) ?? 'system';
  const actorRole   = body.actorRole as string | undefined;
  const authEnabled = body.authEnabled === true;
  const action      = body.action as string | undefined;

  // Roles allowed to approve/deploy/rollback = those with operations:write
  const APPROVER_ROLES = ['super_admin', 'tenant_admin', 'ops_manager'];

  // ── Lifecycle transition ────────────────────────────────────────────────────
  if (action && body.id) {
    const t = TRANSITIONS[action];
    if (!t) return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });

    const { data: cr } = await serviceSupabase!
      .from('change_requests').select('*').eq('id', body.id).eq('tenant_id', tenantId).single();
    if (!cr) return NextResponse.json({ error: 'Change request not found' }, { status: 404 });
    if (!t.from.includes(cr.status))
      return NextResponse.json({ error: `Cannot ${action} a change request in '${cr.status}' state` }, { status: 409 });

    // Governance (enforced only when auth is enabled; auth off = full access)
    if (authEnabled) {
      const privileged = ['approve', 'deploy', 'rollback'].includes(action);
      if (privileged && actorRole && !APPROVER_ROLES.includes(actorRole))
        return NextResponse.json({ error: `Your role (${actorRole}) lacks operations:write — only Ops Manager / Tenant Admin can ${action} change requests` }, { status: 403 });
      // Segregation of duties — the approver cannot be the author
      if (action === 'approve' && cr.created_by && cr.created_by === actor)
        return NextResponse.json({ error: 'Segregation of duties: the author cannot approve their own change request' }, { status: 403 });
    }

    const items = (Array.isArray(cr.items) ? cr.items : []) as ChangeItem[];
    let updatedItems = items;

    // ── Deploy: apply each change to the live artefact, capturing before-state ──
    if (action === 'deploy') {
      const applied: ChangeItem[] = [];
      for (const it of items) {
        if (!it.entityType || !it.entityId) { applied.push(it); continue; }
        try {
          const before = await applyChange(tenantId, it);
          applied.push({ ...it, before: before ?? it.before, appliedAt: new Date().toISOString() });
          await writeAudit({
            tenantId, entityType: it.entityType, entityId: it.entityId, entityName: it.entityName,
            action: it.operation === 'archive' ? 'deleted' : 'updated',
            changedBy: actor, before: before ?? undefined, after: it.after,
          });
        } catch (e: unknown) {
          return NextResponse.json({ error: `Failed to apply change to ${it.entityName}: ${e instanceof Error ? e.message : 'error'}` }, { status: 500 });
        }
      }
      updatedItems = applied;
    }

    // ── Rollback: revert each applied change from its captured before-state ─────
    if (action === 'rollback') {
      for (const it of items) {
        try { await revertChange(tenantId, it); } catch { /* continue reverting the rest */ }
      }
    }

    const patch: Record<string, unknown> = { status: t.to, updated_at: new Date().toISOString(), items: updatedItems };
    if (t.stamp) patch[t.stamp] = new Date().toISOString();
    if (action === 'approve' || action === 'reject') { patch.reviewed_by = actor; patch.review_note = body.note ?? null; }
    if (action === 'rollback') patch.review_note = `Rolled back by ${actor}`;

    const { data, error } = await serviceSupabase!
      .from('change_requests').update(patch).eq('id', body.id).eq('tenant_id', tenantId).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await writeAudit({
      tenantId, entityType: ENTITY, entityId: String(body.id), entityName: cr.title,
      action: action === 'deploy' ? 'activated' : (action === 'reject' || action === 'rollback') ? 'paused' : 'updated',
      changedBy: actor, before: cr, after: data,
    });
    return NextResponse.json({ data });
  }

  // ── Create / update ───────────────────────────────────────────────────────────
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 422 });

  const payload = {
    tenant_id:   tenantId,
    title,
    description: body.description ?? null,
    items:       body.items ?? [],
    updated_at:  new Date().toISOString(),
  };

  let data: Record<string, unknown> | null, error: { message: string } | null;
  if (body.id) {
    ({ data, error } = await serviceSupabase!
      .from('change_requests').update(payload).eq('id', body.id).eq('tenant_id', tenantId).select().single());
  } else {
    ({ data, error } = await serviceSupabase!
      .from('change_requests').insert({ ...payload, created_by: actor, status: 'draft' }).select().single());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({
    tenantId, entityType: ENTITY, entityId: String(data!.id), entityName: title,
    action: body.id ? 'updated' : 'created', changedBy: actor, after: data,
  });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const id = req.nextUrl.searchParams.get('id');
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await serviceSupabase!
    .from('change_requests').delete().eq('id', id).eq('tenant_id', tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
