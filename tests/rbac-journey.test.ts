import { describe, it, expect } from 'vitest';
import { roleHasPermission } from '../lib/rbac';
import { parseCondition, stageShouldFire, exitTriggered, addDays } from '../lib/journey-runtime';

describe('roleHasPermission', () => {
  it('grants admins everything and read_only nothing writable', () => {
    expect(roleHasPermission('tenant_admin', 'strategies:write')).toBe(true);
    expect(roleHasPermission('read_only', 'strategies:write')).toBe(false);
    expect(roleHasPermission('read_only', 'strategies:read')).toBe(true);
  });
  it('only operations:write roles can approve', () => {
    expect(roleHasPermission('ops_manager', 'operations:write')).toBe(true);
    expect(roleHasPermission('campaign_analyst', 'operations:write')).toBe(false);
  });
  it('returns false for unknown/empty role', () => {
    expect(roleHasPermission(undefined, 'strategies:read')).toBe(false);
  });
});

describe('journey runtime', () => {
  it('parses a free-text condition', () => {
    expect(parseCondition('savings_balance >= 20000')).toEqual({ attribute: 'savings_balance', op: '>=', value: '20000' });
    expect(parseCondition('')).toBeNull();
  });
  it('fires a stage when the condition holds or is absent', () => {
    expect(stageShouldFire({ first_deposit: 'false' }, { id: 's', name: '', day: 0, channel: 'email', condition: 'first_deposit = false' })).toBe(true);
    expect(stageShouldFire({ first_deposit: 'true' }, { id: 's', name: '', day: 0, channel: 'email', condition: 'first_deposit = false' })).toBe(false);
    expect(stageShouldFire({}, { id: 's', name: '', day: 0, channel: 'email' })).toBe(true);
  });
  it('detects exit events from truthy profile flags', () => {
    expect(exitTriggered({ opted_out: true }, { id: 's', name: '', day: 0, channel: 'email', exit_on: ['opted_out'] })).toBe('opted_out');
    expect(exitTriggered({ opted_out: false }, { id: 's', name: '', day: 0, channel: 'email', exit_on: ['opted_out'] })).toBeNull();
  });
  it('addDays advances by whole days', () => {
    const d = addDays(new Date('2026-01-01T00:00:00Z'), 5);
    expect(d.toISOString().slice(0, 10)).toBe('2026-01-06');
  });
});
