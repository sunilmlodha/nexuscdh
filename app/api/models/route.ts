/**
 * GET  /api/models          — list all adaptive models, enriched with live stats
 * POST /api/models          — create or update a model
 * DELETE /api/models?id=    — retire/delete a model
 */

import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase } from '@/lib/supabase';
import { randomUUID } from 'crypto';

const TENANT_DEFAULT = 'f0000000-0000-4000-a000-000000000001';

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? TENANT_DEFAULT;
  const modelId  = req.nextUrl.searchParams.get('id');

  if (!IS_CONFIGURED || !serviceSupabase)
    return NextResponse.json({ data: [], configured: false });

  // Single model detail (with propensity history)
  if (modelId) {
    const { data: model } = await serviceSupabase
      .from('adaptive_models').select('*').eq('id', modelId).eq('tenant_id', tenantId).single();
    if (!model) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data: history } = await serviceSupabase
      .from('decision_log')
      .select('propensity, outcome, created_at')
      .eq('tenant_id', tenantId)
      .eq('action_id', model.action_id)
      .not('propensity', 'is', null)
      .order('created_at', { ascending: true })
      .limit(200);

    return NextResponse.json({ model, history: history ?? [], configured: true });
  }

  // List with live stats per model
  const { data: models, error } = await serviceSupabase
    .from('adaptive_models').select('*').eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich each model with acceptance stats from decision_log
  const enriched = await Promise.all((models ?? []).map(async m => {
    const { data: rows } = await serviceSupabase!
      .from('decision_log')
      .select('served, outcome, propensity')
      .eq('tenant_id', tenantId)
      .eq('action_id', m.action_id)
      .limit(500);
    const r = rows ?? [];
    const served   = r.filter(x => x.served).length;
    const accepted = r.filter(x => x.outcome === 'accepted').length;
    const rejected = r.filter(x => x.outcome === 'rejected').length;
    const propensities = r.map(x => x.propensity).filter(Boolean) as number[];
    const currentPropensity = propensities.length
      ? propensities[propensities.length - 1] : null;
    return { ...m, _stats: { served, accepted, rejected,
      acceptanceRate: served ? accepted / served : 0,
      totalDecisions: r.length, currentPropensity } };
  }));

  return NextResponse.json({ data: enriched, configured: true });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED || !serviceSupabase)
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const tenantId = (body.tenantId as string) ?? TENANT_DEFAULT;
  const id       = (body.id as string) || randomUUID();
  const isUpdate = !!body.id;

  const payload = {
    id,
    tenant_id:       tenantId,
    action_id:       body.action_id as string,
    name:            body.name as string,
    description:     body.description as string ?? null,
    model_type:      (body.model_type as string) ?? 'logistic_regression',
    features:        (body.features as string[]) ?? [],
    auc:             Number(body.auc ?? 0.5),
    lift_at_decile1: Number(body.lift_at_decile1 ?? 1.0),
    status:          (body.status as string) ?? 'shadow',
    predictions_today: 0,
  };

  if (!payload.name || !payload.action_id)
    return NextResponse.json({ error: 'name and action_id required' }, { status: 400 });

  const { data, error } = isUpdate
    ? await serviceSupabase.from('adaptive_models')
        .update({ ...payload, id: undefined })
        .eq('id', id).eq('tenant_id', tenantId)
        .select().single()
    : await serviceSupabase.from('adaptive_models')
        .insert(payload).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  if (!IS_CONFIGURED || !serviceSupabase)
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const id       = req.nextUrl.searchParams.get('id') ?? '';
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? TENANT_DEFAULT;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await serviceSupabase
    .from('adaptive_models').delete().eq('id', id).eq('tenant_id', tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
