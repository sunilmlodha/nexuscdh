import { describe, it, expect } from 'vitest';
import { evaluateClause, runEngagementPolicies, computePriority, rankActions } from '../lib/arbitration';

describe('evaluateClause', () => {
  const car = { age: 40, segment: 'affluent', has_mortgage: true };
  it('handles comparison ops', () => {
    expect(evaluateClause(car, { attribute: 'age', op: '>=', value: '25' })).toBe(true);
    expect(evaluateClause(car, { attribute: 'age', op: '<', value: '30' })).toBe(false);
    expect(evaluateClause(car, { attribute: 'segment', op: '=', value: 'affluent' })).toBe(true);
    expect(evaluateClause(car, { attribute: 'segment', op: '!=', value: 'mass' })).toBe(true);
  });
  it('handles IN / NOT IN', () => {
    expect(evaluateClause(car, { attribute: 'segment', op: 'IN', value: 'affluent, hnw' })).toBe(true);
    expect(evaluateClause(car, { attribute: 'segment', op: 'NOT IN', value: 'mass, emerging' })).toBe(true);
  });
});

describe('runEngagementPolicies', () => {
  it('passes when all layers pass and short-circuits on the first failure', () => {
    const car = { age: 40, has_mortgage: true, has_home_insurance: false };
    const ok = runEngagementPolicies(car, {
      eligibility_rules: [{ attribute: 'has_mortgage', op: '=', value: 'true' }],
      applicability_rules: [{ attribute: 'has_home_insurance', op: '=', value: 'false' }],
    });
    expect(ok.passed).toBe(true);

    const fail = runEngagementPolicies(car, {
      eligibility_rules: [{ attribute: 'has_mortgage', op: '=', value: 'true' }],
      applicability_rules: [{ attribute: 'age', op: '>=', value: '65' }],
    });
    expect(fail.passed).toBe(false);
    expect(fail.failedLayer).toBe('applicability');
  });
});

describe('computePriority — P × C × V × L', () => {
  it('multiplies the four factors', () => {
    const b = computePriority({ base_propensity: 0.62, expected_value: 480 }, {}, { contextWeight: 1.2 });
    // 0.62 * 1.2 * (480+1) * 1 = 357.86...
    expect(Math.round(b.priority)).toBe(358);
    expect(b.P).toBeCloseTo(0.62);
    expect(b.C).toBe(1.2);
  });
  it('applies matching levers to L', () => {
    const car = { quarter: 'Q3' };
    const b = computePriority({ base_propensity: 0.5, expected_value: 99 }, car, {
      levers: [{ label: 'Q3 push', multiplier: 2, condition: { attribute: 'quarter', op: '=', value: 'Q3' }, enabled: true }],
    });
    expect(b.L).toBe(2);
    expect(b.appliedLevers).toContain('Q3 push');
  });
  it('ignores levers whose condition does not match', () => {
    const b = computePriority({ base_propensity: 0.5, expected_value: 99 }, { quarter: 'Q1' }, {
      levers: [{ label: 'Q3 push', multiplier: 2, condition: { attribute: 'quarter', op: '=', value: 'Q3' } }],
    });
    expect(b.L).toBe(1);
  });
});

describe('rankActions', () => {
  it('orders by priority and returns the winner', () => {
    const car = {};
    const actions = [
      { id: 'a', base_propensity: 0.49, expected_value: 200 },
      { id: 'b', base_propensity: 0.62, expected_value: 480 },
    ];
    const { winner, ranked } = rankActions(actions, car, {});
    expect(winner?.action.id).toBe('b');
    expect(ranked[0].breakdown.priority).toBeGreaterThan(ranked[1].breakdown.priority);
  });
  it('respects minPropensity', () => {
    const { ranked } = rankActions([{ id: 'a', base_propensity: 0.1, expected_value: 999 }], {}, { minPropensity: 0.3 });
    expect(ranked.length).toBe(0);
  });
});
