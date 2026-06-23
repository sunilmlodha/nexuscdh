/**
 * Model registry — versioned models with a champion/challenger lifecycle.
 * GET    ?tenantId=                    — all versions
 * POST   { action_id, action_name, algorithm, auc?, lift?, samples?, notes? }  — register a new version (shadow)
 * POST   { id, action:'promote'|'shadow'|'retire' }  — transition lifecycle
 *   promote → champion (demotes the action's current champion to retired)
 */
import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-guard';
import { writeAudit } from '@/lib/audit';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';

export async function GET(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  const { data, error } = await serviceSupabase!
    .from('model_versions').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, configured: true });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const guard = await requireAuth('models:write');
  if (!guard.ok) return guard.res;
  const tenantId = guard.ctx.tenantId;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // ── lifecycle transition ────────────────────────────────────────────────────
  if (body.id && body.action) {
    const action = body.action as string;
    const { data: mv } = await serviceSupabase!.from('model_versions').select('*').eq('id', body.id).eq('tenant_id', tenantId).single();
    if (!mv) return NextResponse.json({ error: 'Version not found' }, { status: 404 });

    if (action === 'promote') {
      // demote the current champion for this action
      await serviceSupabase!.from('model_versions').update({ status: 'retired' })
        .eq('tenant_id', tenantId).eq('action_id', mv.action_id).eq('status', 'champion');
      await serviceSupabase!.from('model_versions').update({ status: 'champion', promoted_at: new Date().toISOString() }).eq('id', mv.id);
    } else if (action === 'shadow') {
      await serviceSupabase!.from('model_versions').update({ status: 'shadow' }).eq('id', mv.id);
    } else if (action === 'retire') {
      await serviceSupabase!.from('model_versions').update({ status: 'retired' }).eq('id', mv.id);
    } else return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });

    await writeAudit({ tenantId, entityType: 'model_version', entityId: String(mv.id), entityName: `${mv.action_name} v${mv.version}`, action: action === 'promote' ? 'promoted' : action === 'retire' ? 'deleted' : 'updated', changedBy: guard.ctx.email ?? 'system', before: mv });
    const { data } = await serviceSupabase!.from('model_versions').select('*').eq('id', mv.id).single();
    return NextResponse.json({ data });
  }

  // ── register a new version ──────────────────────────────────────────────────
  if (!body.action_id) return NextResponse.json({ error: 'action_id required' }, { status: 422 });
  const { data: prev } = await serviceSupabase!
    .from('model_versions').select('version').eq('tenant_id', tenantId).eq('action_id', body.action_id).order('version', { ascending: false }).limit(1);
  const nextVersion = ((prev?.[0]?.version as number) ?? 0) + 1;

  const { data, error } = await serviceSupabase!.from('model_versions').insert({
    tenant_id: tenantId, action_id: body.action_id, action_name: body.action_name ?? null,
    algorithm: body.algorithm ?? 'logistic_regression', version: nextVersion, status: 'shadow',
    auc: body.auc ?? null, lift: body.lift ?? null, samples: body.samples ?? 0, notes: body.notes ?? null,
    trained_at: new Date().toISOString(), created_by: guard.ctx.email ?? 'system',
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({ tenantId, entityType: 'model_version', entityId: String(data!.id), entityName: `${data!.action_name} v${nextVersion}`, action: 'created', changedBy: guard.ctx.email ?? 'system', after: data });
  return NextResponse.json({ data });
}
