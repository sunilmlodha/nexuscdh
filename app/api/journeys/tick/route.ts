/**
 * Journey worker — POST/GET /api/journeys/tick
 *
 * Advances every due, active enrolment through its journey stages:
 *   • a stage is "due" when now ≥ enrolled_at + stage.day days
 *   • exit_on flags on the profile end the journey early
 *   • a stage fires its action (fixed action_id, else arbitrated NBA) + treatment,
 *     logging a served decision; if the stage condition is false it's skipped
 *   • when the last stage passes, the enrolment completes
 *
 * Params: tenantId, journeyId? (filter), fastForward=true (ignore timing — run
 * enrolments to completion now, for testing/demo).
 *
 * Designed to be hit by a scheduler (Vercel Cron — see vercel.json). If
 * CRON_SECRET is set, cron calls must send Authorization: Bearer <secret>;
 * same-origin browser calls are always allowed.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  IS_CONFIGURED, serviceSupabase,
  fetchStrategies, fetchActions, fetchPolicies, insertDecisionLog, incrementContactCount,
} from '@/lib/supabase';
import { globalNBA, carFromAttributes } from '@/lib/decision-engine';
import { stageShouldFire, exitTriggered, addDays, type JourneyStage } from '@/lib/journey-runtime';
import { deliverForDecision } from '@/lib/deliver-service';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';

async function run(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  // Optional cron auth
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') ?? '';
    const sameOrigin = (req.headers.get('referer') ?? '').includes('/journeys') || (req.headers.get('origin') ?? '') !== '';
    if (auth !== `Bearer ${secret}` && !sameOrigin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const tenantId    = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  const journeyId   = req.nextUrl.searchParams.get('journeyId');
  const fastForward = req.nextUrl.searchParams.get('fastForward') === 'true';
  const now = new Date();

  // Due, active enrolments
  let q = serviceSupabase!.from('journey_enrollments').select('*').eq('tenant_id', tenantId).eq('status', 'active');
  if (journeyId) q = q.eq('journey_id', journeyId);
  if (!fastForward) q = q.lte('next_run_at', now.toISOString());
  const { data: enrollments, error } = await q.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!enrollments?.length) return NextResponse.json({ ok: true, processed: 0, stagesFired: 0, completed: 0, exited: 0 });

  // Preload everything once
  const journeyIds = Array.from(new Set(enrollments.map(e => e.journey_id)));
  const customerIds = Array.from(new Set(enrollments.map(e => e.customer_id)));
  const [{ data: journeys }, { data: profiles }, strategies, actions, policies] = await Promise.all([
    serviceSupabase!.from('journeys').select('*').eq('tenant_id', tenantId).in('id', journeyIds),
    serviceSupabase!.from('customer_profiles').select('customer_id, attributes').eq('tenant_id', tenantId).in('customer_id', customerIds),
    fetchStrategies(tenantId), fetchActions(tenantId), fetchPolicies(tenantId),
  ]);
  const journeyById = Object.fromEntries((journeys ?? []).map(j => [j.id, j]));
  const attrsById   = Object.fromEntries((profiles ?? []).map(p => [p.customer_id, p.attributes ?? {}]));
  const zero = { today: 0, week: 0, month: 0 };

  let stagesFired = 0, completed = 0, exited = 0;

  for (const enr of enrollments) {
    const journey = journeyById[enr.journey_id];
    if (!journey) continue;
    const stages = (journey.stages ?? []) as JourneyStage[];
    const car = carFromAttributes(enr.customer_id, attrsById[enr.customer_id] ?? {});
    const enrolledAt = new Date(enr.enrolled_at);
    const history = Array.isArray(enr.history) ? [...enr.history] : [];

    let stage = enr.current_stage as number;
    let status: string = enr.status;
    let exitReason: string | null = null;
    let lastFired = enr.last_fired_at as string | null;
    let cap = 50; // safety against runaway loops

    while (status === 'active' && cap-- > 0) {
      if (stage >= stages.length) { status = 'completed'; break; }
      const s = stages[stage];
      const dueAt = addDays(enrolledAt, s.day ?? 0);
      if (!fastForward && dueAt > now) break; // not due yet

      const exit = exitTriggered(car, s);
      if (exit) { status = 'exited'; exitReason = exit; history.push({ stage, name: s.name, at: now.toISOString(), outcome: `exited: ${exit}` }); break; }

      if (stageShouldFire(car, s)) {
        // Resolve action: pinned, else arbitrate
        let actionId = s.action_id, actionName = s.action_name, propensity: number | undefined, channel = s.channel || 'email';
        if (!actionId) {
          const nba = globalNBA(car, { strategies, actions, policies, contactCounts: zero });
          if (nba.winner) { actionId = nba.winner.action.id; actionName = nba.winner.action.name; propensity = nba.winner.action.base_propensity; channel = s.channel || nba.winner.action.channels?.[0] || 'email'; }
        } else {
          propensity = actions.find(a => a.id === actionId)?.base_propensity;
        }

        if (actionId) {
          const logId = await insertDecisionLog({
            tenant_id: tenantId, customer_id: enr.customer_id,
            // strategy_id omitted: journey-stage decisions aren't tied to a strategy row
            // (decision_log.strategy_id FKs strategies); the source is in strategy_name + trace
            strategy_name: `Journey: ${journey.name} · ${s.name}`,
            action_id: actionId, action_name: actionName, channel_id: channel,
            served: true, propensity,
            customer_attributes: attrsById[enr.customer_id] ?? {},
            trace: [{ step: 'journey-stage', journeyId: journey.id, stageIndex: stage, stageName: s.name, treatmentId: s.treatment_id ?? null }],
          }, tenantId);
          await incrementContactCount(tenantId, enr.customer_id, channel);
          // Deliver via the channel adapter (best-effort; never blocks the journey)
          try {
            await deliverForDecision({ tenantId, decisionId: logId ?? undefined, customerId: enr.customer_id, channel, actionId, actionName, treatmentId: s.treatment_id ?? null });
          } catch { /* delivery failure must not stall the worker */ }
          stagesFired++;
          lastFired = now.toISOString();
          history.push({ stage, name: s.name, at: now.toISOString(), outcome: 'fired', action: actionName, channel });
        } else {
          history.push({ stage, name: s.name, at: now.toISOString(), outcome: 'no eligible action' });
        }
      } else {
        history.push({ stage, name: s.name, at: now.toISOString(), outcome: 'skipped (condition not met)' });
      }

      stage++;
      if (stage >= stages.length) { status = 'completed'; break; }
      if (!fastForward) break; // one due stage per tick in real-time mode
    }

    if (status === 'completed') completed++;
    if (status === 'exited') exited++;

    const nextRunAt = (status === 'active' && stage < stages.length)
      ? addDays(enrolledAt, stages[stage].day ?? 0).toISOString()
      : now.toISOString();

    await serviceSupabase!.from('journey_enrollments').update({
      current_stage: stage, status, exit_reason: exitReason,
      next_run_at: nextRunAt, last_fired_at: lastFired, history,
      updated_at: now.toISOString(),
    }).eq('id', enr.id);
  }

  return NextResponse.json({ ok: true, processed: enrollments.length, stagesFired, completed, exited });
}

export async function POST(req: NextRequest) { return run(req); }
export async function GET(req: NextRequest)  { return run(req); }
