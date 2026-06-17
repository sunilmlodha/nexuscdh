/**
 * Journey execution helpers — pure logic for the worker that advances
 * customers through journey stages over time.
 */

import { evaluateClause, type RuleClause, type CarLike } from './arbitration';

export interface JourneyStage {
  id: string;
  name: string;
  day: number;
  channel: string;
  action_id?: string;
  action_name?: string;
  treatment_id?: string;
  condition?: string;
  wait_days?: number;
  exit_on?: string[];
}

/** Parse a free-text stage condition ("savings_balance >= 20000") into a clause. */
export function parseCondition(cond?: string): RuleClause | null {
  if (!cond || !cond.trim()) return null;
  const m = cond.trim().match(/^(\w+)\s*(=|!=|>=|<=|>|<|IN|NOT IN)\s*"?([^"]+?)"?$/i);
  if (!m) return null;
  return { attribute: m[1], op: m[2].toUpperCase() as RuleClause['op'], value: m[3].trim() };
}

/** A stage fires when it has no condition, or its condition evaluates true. */
export function stageShouldFire(car: CarLike, stage: JourneyStage): boolean {
  const clause = parseCondition(stage.condition);
  if (!clause) return true;
  return evaluateClause(car, clause);
}

/**
 * Has the customer hit an exit event for this stage? exit_on entries are treated
 * as profile boolean flags (e.g. "opted_out", "converted") — truthy = exit.
 */
export function exitTriggered(car: CarLike, stage: JourneyStage): string | null {
  for (const ev of stage.exit_on ?? []) {
    const v = car[ev];
    if (v === true || v === 'true' || v === 1) return ev;
  }
  return null;
}

/** ms helper: add N days to a Date. */
export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 86400000);
}
