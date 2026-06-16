/**
 * GET /api/bias?attribute=gender — Ethical Bias check
 *
 * Runs global NBA across the customer base, groups customers by a protected
 * attribute, and compares the served-rate per group using the 4/5ths rule
 * (adverse-impact ratio = min groupRate / max groupRate; < 0.80 = flagged).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchStrategies, fetchActions, fetchPolicies, fetchCustomerProfiles, IS_CONFIGURED,
} from '@/lib/supabase';
import { globalNBA, carFromAttributes } from '@/lib/decision-engine';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';
const ADVERSE_IMPACT_THRESHOLD = 0.8;

function ageBand(age: number): string {
  if (age < 25) return '18–24';
  if (age < 35) return '25–34';
  if (age < 45) return '35–44';
  if (age < 55) return '45–54';
  if (age < 65) return '55–64';
  return '65+';
}

export async function GET(req: NextRequest) {
  const tenantId  = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  const attribute = req.nextUrl.searchParams.get('attribute') ?? 'gender';
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '500'), 1000);

  if (!IS_CONFIGURED) return NextResponse.json({ configured: false });

  const [strategies, actions, policies, profiles] = await Promise.all([
    fetchStrategies(tenantId), fetchActions(tenantId), fetchPolicies(tenantId),
    fetchCustomerProfiles(tenantId, limit),
  ]);

  const zero = { today: 0, week: 0, month: 0 };
  const groups: Record<string, { total: number; served: number }> = {};

  for (const p of profiles) {
    const attrs = p.attributes ?? {};
    let key = attrs[attribute];
    if (key === undefined || key === null || key === '') key = 'unknown';
    if (attribute === 'age' && typeof key === 'number') key = ageBand(key);
    const k = String(key);

    if (!groups[k]) groups[k] = { total: 0, served: 0 };
    groups[k].total++;

    const car = carFromAttributes(p.customer_id, attrs);
    const nba = globalNBA(car, { strategies, actions, policies, contactCounts: zero });
    if (nba.winner) groups[k].served++;
  }

  const groupStats = Object.entries(groups)
    .map(([value, g]) => ({ value, total: g.total, served: g.served, rate: g.total ? g.served / g.total : 0 }))
    .filter(g => g.value !== 'unknown')
    .sort((a, b) => b.rate - a.rate);

  const rates = groupStats.map(g => g.rate);
  const maxRate = Math.max(...rates, 0);
  const minRate = Math.min(...rates, maxRate);
  const adverseImpactRatio = maxRate > 0 ? minRate / maxRate : 1;
  const flagged = groupStats.length >= 2 && adverseImpactRatio < ADVERSE_IMPACT_THRESHOLD;

  return NextResponse.json({
    configured: true,
    attribute,
    total: profiles.length,
    groups: groupStats,
    adverseImpactRatio,
    threshold: ADVERSE_IMPACT_THRESHOLD,
    flagged,
    favouredGroup: groupStats[0]?.value ?? null,
    disadvantagedGroup: groupStats[groupStats.length - 1]?.value ?? null,
    verdict: groupStats.length < 2
      ? 'Not enough groups to assess'
      : flagged
        ? `Potential adverse impact: ratio ${adverseImpactRatio.toFixed(2)} is below the ${ADVERSE_IMPACT_THRESHOLD} (4/5ths) threshold`
        : `No adverse impact detected: ratio ${adverseImpactRatio.toFixed(2)} meets the ${ADVERSE_IMPACT_THRESHOLD} threshold`,
    note: 'Projection assumes no prior contacts (greenfield). Based on the 4/5ths adverse-impact rule.',
  });
}
