/**
 * GET /api/analytics
 *
 * Real-time analytics aggregated from decision_log.
 * Covers: engagement funnel, suppression breakdown, channel performance,
 * strategy performance, revenue attribution, daily trend.
 */

import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? 'f0000000-0000-4000-a000-000000000001';
  const days     = parseInt(req.nextUrl.searchParams.get('days') ?? '30');

  if (!IS_CONFIGURED) return NextResponse.json({ configured: false, data: null });

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceISO = since.toISOString();

  const { data: logs } = await supabase!
    .from('decision_log')
    .select('served, outcome, suppression_reason, channel_id, strategy_id, strategy_name, action_id, action_name, propensity, customer_id, decision_latency_ms, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', sinceISO)
    .order('created_at', { ascending: false })
    .limit(50000);

  const rows = logs ?? [];
  const total    = rows.length;
  const served   = rows.filter(r => r.served).length;
  const accepted = rows.filter(r => r.outcome === 'accepted').length;
  const rejected = rows.filter(r => r.outcome === 'rejected').length;
  const ignored  = rows.filter(r => r.outcome === 'ignored').length;
  const outcomeRecorded = accepted + rejected + ignored;

  // Engagement funnel
  const funnel = [
    { stage: 'Decisions Made',    count: total,           pct: 100 },
    { stage: 'Action Served',     count: served,          pct: total ? Math.round(served / total * 1000) / 10 : 0 },
    { stage: 'Outcome Recorded',  count: outcomeRecorded, pct: served ? Math.round(outcomeRecorded / served * 1000) / 10 : 0 },
    { stage: 'Accepted',          count: accepted,        pct: outcomeRecorded ? Math.round(accepted / outcomeRecorded * 1000) / 10 : 0 },
  ];

  // Suppression breakdown
  const suppressionMap: Record<string, number> = {};
  rows.filter(r => !r.served && r.suppression_reason).forEach(r => {
    const key = (r.suppression_reason as string).split('(')[0].trim();
    suppressionMap[key] = (suppressionMap[key] ?? 0) + 1;
  });
  const suppressionBreakdown = Object.entries(suppressionMap)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => ({ reason, count, pct: total ? Math.round(count / total * 1000) / 10 : 0 }));

  // Strategy performance
  const strategyMap: Record<string, { name: string; total: number; served: number; accepted: number; revenue: number }> = {};
  rows.forEach(r => {
    const sid = r.strategy_id ?? 'unknown';
    if (!strategyMap[sid]) strategyMap[sid] = { name: r.strategy_name ?? sid, total: 0, served: 0, accepted: 0, revenue: 0 };
    strategyMap[sid].total++;
    if (r.served) strategyMap[sid].served++;
    if (r.outcome === 'accepted') { strategyMap[sid].accepted++; strategyMap[sid].revenue += 0; /* TODO: join with action value */ }
  });
  const strategyPerformance = Object.entries(strategyMap)
    .sort((a, b) => b[1].served - a[1].served)
    .map(([id, s]) => ({ id, ...s, serveRate: s.total ? Math.round(s.served / s.total * 1000) / 10 : 0, acceptRate: s.served ? Math.round(s.accepted / s.served * 1000) / 10 : 0 }));

  // Channel performance
  const channelMap: Record<string, { total: number; served: number }> = {};
  rows.filter(r => r.channel_id).forEach(r => {
    const ch = r.channel_id as string;
    if (!channelMap[ch]) channelMap[ch] = { total: 0, served: 0 };
    channelMap[ch].total++;
    if (r.served) channelMap[ch].served++;
  });
  const channelPerformance = Object.entries(channelMap)
    .sort((a, b) => b[1].served - a[1].served)
    .map(([channel, s]) => ({ channel, ...s, serveRate: s.total ? Math.round(s.served / s.total * 1000) / 10 : 0 }));

  // Daily trend (last 14 days)
  const dailyMap: Record<string, { total: number; served: number; accepted: number }> = {};
  rows.forEach(r => {
    const day = (r.created_at as string).substring(0, 10);
    if (!dailyMap[day]) dailyMap[day] = { total: 0, served: 0, accepted: 0 };
    dailyMap[day].total++;
    if (r.served) dailyMap[day].served++;
    if (r.outcome === 'accepted') dailyMap[day].accepted++;
  });
  const dailyTrend = Object.entries(dailyMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([date, d]) => ({ date, ...d }));

  // Latency percentiles
  const latencies = rows.map(r => r.decision_latency_ms as number).filter(Boolean).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)] ?? null;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? null;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] ?? null;
  const avgLatency = latencies.length ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length) : null;

  // Unique customers
  const uniqueCustomers = new Set(rows.map(r => r.customer_id)).size;

  return NextResponse.json({
    configured: true,
    period: { days, since: sinceISO },
    summary: { total, served, suppressed: total - served, accepted, rejected, ignored, uniqueCustomers },
    serveRate:    total ? Math.round(served   / total   * 1000) / 10 : 0,
    acceptRate:   served ? Math.round(accepted / served  * 1000) / 10 : 0,
    latency: { p50, p95, p99, avg: avgLatency },
    funnel,
    suppressionBreakdown,
    strategyPerformance,
    channelPerformance,
    dailyTrend,
  });
}
