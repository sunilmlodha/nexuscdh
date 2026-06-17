/**
 * GET /api/value-finder — Pega-style Value Finder
 *
 * Runs global NBA across the whole customer base (projection — assumes no prior
 * contacts) and surfaces value-leakage:
 *   • under-served customers   — qualify for NO action at all
 *   • low-propensity customers — only get weak (P < threshold) actions
 *   • relevant-action gaps     — actions that never win for anyone
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchStrategies, fetchActions, fetchPolicies, fetchCustomerProfiles, IS_CONFIGURED,
} from '@/lib/supabase';
import { globalNBA, carFromAttributes } from '@/lib/decision-engine';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  const lowThreshold = Number(req.nextUrl.searchParams.get('lowPropensity') ?? '0.3');
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '500'), 1000);

  if (!IS_CONFIGURED) return NextResponse.json({ configured: false });

  const [strategies, actions, policies, profiles] = await Promise.all([
    fetchStrategies(tenantId), fetchActions(tenantId), fetchPolicies(tenantId),
    fetchCustomerProfiles(tenantId, limit),
  ]);

  const zero = { today: 0, week: 0, month: 0 };
  const actionWins: Record<string, number> = {};
  const underServed: Array<{ customerId: string; reason: string }> = [];
  const lowValue: Array<{ customerId: string; action: string; propensity: number }> = [];

  let served = 0;

  for (const p of profiles) {
    const car = carFromAttributes(p.customer_id, p.attributes ?? {});
    const nba = globalNBA(car, { strategies, actions, policies, contactCounts: zero });

    if (!nba.winner) {
      underServed.push({
        customerId: p.customer_id,
        reason: nba.suppressedCount > 0 && nba.candidates.length === 0
          ? 'All candidate actions suppressed (consent / contact policy)'
          : 'No action passed engagement policies',
      });
      continue;
    }

    served++;
    actionWins[nba.winner.action.name] = (actionWins[nba.winner.action.name] ?? 0) + 1;
    if (nba.winner.breakdown.P < lowThreshold) {
      lowValue.push({ customerId: p.customer_id, action: nba.winner.action.name, propensity: nba.winner.breakdown.P });
    }
  }

  // Relevant-action gaps: active actions that never won
  const wonNames = new Set(Object.keys(actionWins));
  const gaps = actions.filter(a => !wonNames.has(a.name)).map(a => ({ id: a.id, name: a.name }));

  const total = profiles.length;
  return NextResponse.json({
    configured: true,
    total,
    served,
    underServedCount: underServed.length,
    lowValueCount: lowValue.length,
    coverage: total ? served / total : 0,
    actionWins,
    underServed: underServed.slice(0, 50),
    lowValue: lowValue.sort((a, b) => a.propensity - b.propensity).slice(0, 50),
    actionGaps: gaps,
    lowThreshold,
    note: 'Projection assumes no prior contacts (greenfield); contact-fatigue suppression is not applied.',
  });
}
