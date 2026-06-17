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

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';
const ENTITY = 'change_request';

const TRANSITIONS: Record<string, { from: string[]; to: string; stamp?: string }> = {
  submit:  { from: ['draft', 'rejected'], to: 'in_review', stamp: 'submitted_at' },
  approve: { from: ['in_review'],          to: 'approved' },
  reject:  { from: ['in_review'],          to: 'rejected' },
  deploy:  { from: ['approved'],           to: 'deployed', stamp: 'deployed_at' },
};

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });

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

  const tenantId = (body.tenantId as string) ?? DEFAULT_TENANT;
  const actor    = (body.actor as string) ?? 'system';
  const action   = body.action as string | undefined;

  // ── Lifecycle transition ────────────────────────────────────────────────────
  if (action && body.id) {
    const t = TRANSITIONS[action];
    if (!t) return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });

    const { data: cr } = await serviceSupabase!
      .from('change_requests').select('*').eq('id', body.id).eq('tenant_id', tenantId).single();
    if (!cr) return NextResponse.json({ error: 'Change request not found' }, { status: 404 });
    if (!t.from.includes(cr.status))
      return NextResponse.json({ error: `Cannot ${action} a change request in '${cr.status}' state` }, { status: 409 });

    const patch: Record<string, unknown> = { status: t.to, updated_at: new Date().toISOString() };
    if (t.stamp) patch[t.stamp] = new Date().toISOString();
    if (action === 'approve' || action === 'reject') { patch.reviewed_by = actor; patch.review_note = body.note ?? null; }

    const { data, error } = await serviceSupabase!
      .from('change_requests').update(patch).eq('id', body.id).eq('tenant_id', tenantId).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await writeAudit({
      tenantId, entityType: ENTITY, entityId: String(body.id), entityName: cr.title,
      action: action === 'deploy' ? 'activated' : action === 'reject' ? 'paused' : 'updated',
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
