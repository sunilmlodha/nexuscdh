import { NextRequest, NextResponse } from 'next/server';
import { fetchExperiments, upsertExperiment, IS_CONFIGURED, supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? 'f0000000-0000-4000-a000-000000000001';
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });

  const experiments = await fetchExperiments(tenantId);

  const withStats = await Promise.all(experiments.map(async (exp) => {
    if (exp.status !== 'running') return { ...exp, stats: {} };

    const variantIds = (exp.variants as Array<{ strategyId: string }>).map(v => v.strategyId);
    const stats: Record<string, { total: number; served: number; accepted: number; rejected: number; ignored: number; acceptanceRate: number }> = {};

    for (const sid of variantIds) {
      const { data } = await supabase!
        .from('decision_log')
        .select('served,outcome')
        .eq('tenant_id', tenantId)
        .eq('strategy_id', sid);
      const rows = data ?? [];
      const served   = rows.filter(r => r.served).length;
      const accepted = rows.filter(r => r.outcome === 'accepted').length;
      const rejected = rows.filter(r => r.outcome === 'rejected').length;
      const ignored  = rows.filter(r => r.outcome === 'ignored').length;
      stats[sid] = { total: rows.length, served, accepted, rejected, ignored, acceptanceRate: served ? accepted / served : 0 };
    }

    // Auto-promote if enabled
    if (exp.auto_promote) {
      const winner = variantIds.find(sid => {
        const s = stats[sid];
        return s && s.total >= 100 && s.acceptanceRate >= exp.promotion_threshold;
      });
      if (winner) {
        await upsertExperiment({ ...exp, status: 'completed', winner_strategy_id: winner }, tenantId);
      }
    }

    return { ...exp, stats };
  }));

  return NextResponse.json({ data: withStats, configured: true });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const tenantId = (body.tenantId as string) ?? 'f0000000-0000-4000-a000-000000000001';
  const data = await upsertExperiment(body as { name: string }, tenantId);
  if (!data) return NextResponse.json({ error: 'Failed to save experiment' }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase!.from('experiments').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
