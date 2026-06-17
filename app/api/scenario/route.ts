/**
 * POST /api/scenario — Scenario Planner / Impact Analysis
 *
 * Runs global NBA across the whole customer base for the CURRENT config, and
 * (optionally) for a PROPOSED config built from per-strategy overrides, then
 * returns the before/after deltas: reach, action distribution, projected value.
 *
 * Body: {
 *   tenantId?, limit?,
 *   overrides?: { [strategyId]: { context_weight?, business_levers?,
 *                                 applicability_rules?, suitability_rules?, status? } }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchStrategies, fetchActions, fetchPolicies, fetchCustomerProfiles, IS_CONFIGURED,
  type DBStrategy,
} from '@/lib/supabase';
import { globalNBA, carFromAttributes } from '@/lib/decision-engine';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';

interface ScenarioSummary {
  served: number;
  reach: number;
  projectedValue: number;
  actionDistribution: Record<string, number>;
}

function summarise(
  profiles: { customer_id: string; attributes: Record<string, unknown> }[],
  strategies: DBStrategy[],
  actions: Parameters<typeof globalNBA>[1]['actions'],
  policies: Parameters<typeof globalNBA>[1]['policies'],
): ScenarioSummary {
  const zero = { today: 0, week: 0, month: 0 };
  const dist: Record<string, number> = {};
  let served = 0, value = 0;

  for (const p of profiles) {
    const car = carFromAttributes(p.customer_id, p.attributes ?? {});
    const nba = globalNBA(car, { strategies, actions, policies, contactCounts: zero });
    if (nba.winner) {
      served++;
      value += nba.winner.action.expected_value ?? 0;
      dist[nba.winner.action.name] = (dist[nba.winner.action.name] ?? 0) + 1;
    }
  }
  return { served, reach: profiles.length ? served / profiles.length : 0, projectedValue: value, actionDistribution: dist };
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* allow empty body */ }

  const tenantId = (body.tenantId as string) ?? DEFAULT_TENANT;
  const limit = Math.min(Number(body.limit ?? 500), 1000);
  const overrides = (body.overrides as Record<string, Partial<DBStrategy>>) ?? null;

  if (!IS_CONFIGURED) return NextResponse.json({ configured: false });

  const [strategies, actions, policies, profiles] = await Promise.all([
    fetchStrategies(tenantId), fetchActions(tenantId), fetchPolicies(tenantId),
    fetchCustomerProfiles(tenantId, limit),
  ]);

  const baseline = summarise(profiles, strategies, actions, policies);

  let proposed: ScenarioSummary | null = null;
  if (overrides && Object.keys(overrides).length) {
    const modified = strategies.map(s => overrides[s.id] ? { ...s, ...overrides[s.id] } : s);
    proposed = summarise(profiles, modified, actions, policies);
  }

  const delta = proposed ? {
    served: proposed.served - baseline.served,
    reach: proposed.reach - baseline.reach,
    projectedValue: proposed.projectedValue - baseline.projectedValue,
  } : null;

  return NextResponse.json({
    configured: true,
    total: profiles.length,
    baseline,
    proposed,
    delta,
    note: 'Projection assumes no prior contacts (greenfield). Value = Σ expected_value of served actions.',
  });
}
