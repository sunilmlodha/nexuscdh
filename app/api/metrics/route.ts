/**
 * GET /api/metrics?tenantId=&window=24 — operational metrics from decision_log.
 * Throughput, served rate, latency p50/p95/p99, suppression + outcome breakdown.
 */
import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase } from '@/lib/supabase';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  const hours = Math.min(Number(req.nextUrl.searchParams.get('window') ?? '24'), 720);
  if (!IS_CONFIGURED) return NextResponse.json({ configured: false });

  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const { data, error } = await serviceSupabase!
    .from('decision_log')
    .select('served, outcome, suppression_reason, decision_latency_ms, is_control, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(10000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const total = rows.length;
  const served = rows.filter(r => r.served).length;
  const suppressed = rows.filter(r => !r.served).length;
  const control = rows.filter(r => r.is_control).length;

  const lat = rows.map(r => r.decision_latency_ms).filter((n): n is number => typeof n === 'number').sort((a, b) => a - b);
  const avg = lat.length ? Math.round(lat.reduce((s, n) => s + n, 0) / lat.length) : 0;

  const outcomes: Record<string, number> = {};
  const suppression: Record<string, number> = {};
  for (const r of rows) {
    if (r.outcome) outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1;
    if (!r.served && r.suppression_reason) {
      const key = r.suppression_reason.split('(')[0].trim().slice(0, 40);
      suppression[key] = (suppression[key] ?? 0) + 1;
    }
  }

  // throughput per hour (last `hours`)
  const buckets: Record<string, number> = {};
  for (const r of rows) {
    const h = String(r.created_at).slice(0, 13); // yyyy-mm-ddThh
    buckets[h] = (buckets[h] ?? 0) + 1;
  }
  const accepted = outcomes['accepted'] ?? 0;
  const withOutcome = Object.values(outcomes).reduce((s, n) => s + n, 0);

  return NextResponse.json({
    configured: true,
    windowHours: hours,
    total,
    served,
    suppressed,
    control,
    servedRate: total ? served / total : 0,
    conversionRate: withOutcome ? accepted / withOutcome : 0,
    latencyMs: { avg, p50: percentile(lat, 50), p95: percentile(lat, 95), p99: percentile(lat, 99), max: lat.length ? lat[lat.length - 1] : 0 },
    outcomes,
    suppression,
    throughput: Object.entries(buckets).sort().map(([hour, count]) => ({ hour, count })),
  });
}
