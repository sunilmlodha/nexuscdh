/**
 * Pure RBAC definitions — no client deps, safe to import on the server.
 * lib/auth.ts re-exports these for existing client imports.
 */

export type Role =
  | 'super_admin'
  | 'tenant_admin'
  | 'strategy_manager'
  | 'campaign_analyst'
  | 'channel_manager'
  | 'data_scientist'
  | 'ops_manager'
  | 'read_only';

export type Permission =
  | 'taxonomy:read'    | 'taxonomy:write'
  | 'strategies:read'  | 'strategies:write'
  | 'channels:read'    | 'channels:write'
  | 'policies:read'    | 'policies:write'
  | 'audiences:read'   | 'audiences:write'
  | 'models:read'      | 'models:write'
  | 'simulator:read'   | 'simulator:write'
  | 'operations:read'  | 'operations:write'
  | 'users:read'       | 'users:write'
  | 'settings:read'    | 'settings:write'
  | 'profiles:read'    | 'profiles:write'
  | 'experiments:read' | 'experiments:write'
  | 'analytics:read'
  | 'simulate:read'   | 'simulate:write'
  | 'triggers:read'   | 'triggers:write';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    'taxonomy:read','taxonomy:write','strategies:read','strategies:write',
    'channels:read','channels:write','policies:read','policies:write',
    'audiences:read','audiences:write','models:read','models:write',
    'simulator:read','simulator:write','operations:read','operations:write',
    'users:read','users:write','settings:read','settings:write',
    'profiles:read','profiles:write','experiments:read','experiments:write',
  ],
  tenant_admin: [
    'taxonomy:read','taxonomy:write','strategies:read','strategies:write',
    'channels:read','channels:write','policies:read','policies:write',
    'audiences:read','audiences:write','models:read','models:write',
    'simulator:read','simulator:write','operations:read','operations:write',
    'users:read','users:write','settings:read','settings:write',
    'profiles:read','profiles:write','experiments:read','experiments:write',
  ],
  strategy_manager: [
    'taxonomy:read','taxonomy:write','strategies:read','strategies:write',
    'channels:read','policies:read','policies:write',
    'audiences:read','audiences:write','models:read',
    'simulator:read','simulator:write','operations:read',
    'experiments:read','experiments:write',
  ],
  campaign_analyst: [
    'taxonomy:read','strategies:read','channels:read','policies:read',
    'audiences:read','models:read','simulator:read','simulator:write','operations:read',
    'experiments:read',
  ],
  channel_manager: [
    'taxonomy:read','strategies:read','channels:read','channels:write',
    'policies:read','policies:write','audiences:read','models:read','simulator:read','operations:read',
  ],
  data_scientist: [
    'taxonomy:read','strategies:read','channels:read','policies:read',
    'audiences:read','audiences:write','models:read','models:write',
    'simulator:read','simulator:write','operations:read',
    'profiles:read','experiments:read',
  ],
  ops_manager: [
    'taxonomy:read','strategies:read','channels:read','policies:read',
    'audiences:read','models:read','simulator:read',
    'operations:read','operations:write','settings:read',
    'profiles:read',
  ],
  read_only: [
    'taxonomy:read','strategies:read','channels:read','policies:read',
    'audiences:read','models:read','simulator:read','operations:read',
  ],
};

export const ROLE_LABELS: Record<Role, string> = {
  super_admin:      'Super Admin',
  tenant_admin:     'Tenant Admin',
  strategy_manager: 'Strategy Manager',
  campaign_analyst: 'Campaign Analyst',
  channel_manager:  'Channel Manager',
  data_scientist:   'Data Scientist',
  ops_manager:      'Ops Manager',
  read_only:        'Read Only',
};

export function roleHasPermission(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
