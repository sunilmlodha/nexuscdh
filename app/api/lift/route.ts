/**
 * GET /api/lift?tenantId= — Control-group lift analytics
 *
 * Reads decision_log (is_control flag, outcome) and compares the conversion
 * rate of the TREATED group (received an action) against the CONTROL group
 * (action withheld) per strategy, plus overall. Lift = (treatedRate −
 * controlRate) / controlRate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase } from '@/lib/supabase';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';

interface Cell { n: number; conversions: number; }
function rate(c: Cell) { return c.n ? c.conversions / c.n : 0; }
function liftPct(treated: Cell, control: Cell) {
  const cr = rate(control), tr = rate(treated);
  if (cr === 0) return tr > 0 ? null : 0; // undefined lift if control baseline is 0
  return (tr - cr) / cr;
}

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '10000'), 50000);
  if (!IS_CONFIGURED) return NextResponse.json({ configured: false });

  const { data, error } = await serviceSupabase!
    .from('decision_log')
    .select('strategy_id, strategy_name, served, is_control, outcome')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const byStrategy: Record<string, { name: string; treated: Cell; control: Cell }> = {};
  const overall = { treated: { n: 0, conversions: 0 } as Cell, control: { n: 0, conversions: 0 } as Cell };

  for (const r of rows) {
    const sid = r.strategy_id ?? 'unknown';
    if (!byStrategy[sid]) byStrategy[sid] = { name: r.strategy_name ?? sid, treated: { n: 0, conversions: 0 }, control: { n: 0, conversions: 0 } };
    const bucket = r.is_control ? 'control' : 'treated';
    // treated = actually received an action (served); control = held out
    if (bucket === 'treated' && !r.served) continue; // ignore suppressed/no-match for treated baseline
    const cell = byStrategy[sid][bucket];
    cell.n++;
    overall[bucket].n++;
    if (r.outcome === 'accepted') { cell.conversions++; overall[bucket].conversions++; }
  }

  const strategies = Object.entries(byStrategy).map(([id, s]) => ({
    strategyId: id,
    name: s.name,
    treated: { ...s.treated, rate: rate(s.treated) },
    control: { ...s.control, rate: rate(s.control) },
    lift: liftPct(s.treated, s.control),
    hasControl: s.control.n > 0,
  })).sort((a, b) => (b.treated.n + b.control.n) - (a.treated.n + a.control.n));

  return NextResponse.json({
    configured: true,
    sampleSize: rows.length,
    overall: {
      treated: { ...overall.treated, rate: rate(overall.treated) },
      control: { ...overall.control, rate: rate(overall.control) },
      lift: liftPct(overall.treated, overall.control),
      hasControl: overall.control.n > 0,
    },
    strategies,
    note: 'Treated = received an action; Control = held out. Conversion = decisions with outcome "accepted". Record outcomes (Customer Profiles → decision history) to populate rates.',
  });
}
