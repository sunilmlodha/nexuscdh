/**
 * NexusCDH Auth & RBAC
 *
 * Authentication: optional (toggle in Settings → Auth)
 *   - When disabled: single shared workspace, no login required
 *   - When enabled: JWT simulation, per-user role enforcement
 *
 * Roles & Permissions matrix:
 *
 *   Role                  | Dashboard | Taxonomy | Strategies | Channels | Policies | Audiences | Models | Simulator | Operations | Users | Settings |
 *   ──────────────────────|──────────|──────────|────────────|──────────|──────────|───────────|────────|───────────|────────────|───────|──────────|
 *   super_admin           |    R/W   |   R/W    |    R/W     |   R/W    |   R/W    |    R/W    |  R/W   |    R/W    |    R/W     |  R/W  |   R/W    |
 *   tenant_admin          |    R/W   |   R/W    |    R/W     |   R/W    |   R/W    |    R/W    |  R/W   |    R/W    |    R/W     |  R/W  |   R/W    |
 *   strategy_manager      |    R     |   R/W    |    R/W     |   R      |   R/W    |    R/W    |  R     |    R/W    |    R       |  -    |   -      |
 *   campaign_analyst      |    R     |   R      |    R       |   R      |   R      |    R      |  R     |    R/W    |    R       |  -    |   -      |
 *   channel_manager       |    R     |   R      |    R       |   R/W    |   R/W    |    R      |  R     |    R      |    R       |  -    |   -      |
 *   data_scientist        |    R     |   R      |    R       |   R      |   R      |    R/W    |  R/W   |    R/W    |    R       |  -    |   -      |
 *   ops_manager           |    R     |   R      |    R       |   R      |   R      |    R      |  R     |    R      |    R/W     |  -    |   R      |
 *   read_only             |    R     |   R      |    R       |   R      |   R      |    R      |  R     |    R      |    R       |  -    |   -      |
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  | 'settings:read'    | 'settings:write';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    'taxonomy:read','taxonomy:write','strategies:read','strategies:write',
    'channels:read','channels:write','policies:read','policies:write',
    'audiences:read','audiences:write','models:read','models:write',
    'simulator:read','simulator:write','operations:read','operations:write',
    'users:read','users:write','settings:read','settings:write',
  ],
  tenant_admin: [
    'taxonomy:read','taxonomy:write','strategies:read','strategies:write',
    'channels:read','channels:write','policies:read','policies:write',
    'audiences:read','audiences:write','models:read','models:write',
    'simulator:read','simulator:write','operations:read','operations:write',
    'users:read','users:write','settings:read','settings:write',
  ],
  strategy_manager: [
    'taxonomy:read','taxonomy:write','strategies:read','strategies:write',
    'channels:read','policies:read','policies:write',
    'audiences:read','audiences:write','models:read',
    'simulator:read','simulator:write','operations:read',
  ],
  campaign_analyst: [
    'taxonomy:read','strategies:read','channels:read','policies:read',
    'audiences:read','models:read','simulator:read','simulator:write','operations:read',
  ],
  channel_manager: [
    'taxonomy:read','strategies:read','channels:read','channels:write',
    'policies:read','policies:write','audiences:read','models:read','simulator:read','operations:read',
  ],
  data_scientist: [
    'taxonomy:read','strategies:read','channels:read','policies:read',
    'audiences:read','audiences:write','models:read','models:write',
    'simulator:read','simulator:write','operations:read',
  ],
  ops_manager: [
    'taxonomy:read','strategies:read','channels:read','policies:read',
    'audiences:read','models:read','simulator:read',
    'operations:read','operations:write','settings:read',
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

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarInitials: string;
  lastLogin?: string;
  status: 'active' | 'invited' | 'disabled';
  createdAt: string;
}

export interface AuthSettings {
  authEnabled: boolean;   // when false: skip login, everyone is tenant_admin
  theme: 'default' | 'editorial';
}

interface AuthStore {
  // Settings
  authSettings: AuthSettings;
  updateAuthSettings: (p: Partial<AuthSettings>) => void;

  // Current session
  currentUser: AppUser | null;
  login: (user: AppUser) => void;
  logout: () => void;

  // User management
  users: AppUser[];
  addUser: (u: Omit<AppUser, 'id' | 'createdAt'>) => AppUser;
  updateUser: (id: string, patch: Partial<AppUser>) => void;
  removeUser: (id: string) => void;
}

export const DEMO_USERS: AppUser[] = [
  { id:'u1', name:'Alex Morgan',   email:'alex@example.com',  role:'tenant_admin',     avatarInitials:'AM', status:'active', lastLogin: new Date().toISOString(), createdAt: new Date().toISOString() },
  { id:'u2', name:'Sam Chen',      email:'sam@example.com',   role:'strategy_manager', avatarInitials:'SC', status:'active', createdAt: new Date().toISOString() },
  { id:'u3', name:'Jordan Lee',    email:'jordan@example.com',role:'campaign_analyst',  avatarInitials:'JL', status:'active', createdAt: new Date().toISOString() },
  { id:'u4', name:'Riley Brooks',  email:'riley@example.com', role:'data_scientist',   avatarInitials:'RB', status:'invited',createdAt: new Date().toISOString() },
  { id:'u5', name:'Casey Wilson',  email:'casey@example.com', role:'ops_manager',      avatarInitials:'CW', status:'active', createdAt: new Date().toISOString() },
  { id:'u6', name:'Morgan Taylor', email:'morgan@example.com',role:'channel_manager',  avatarInitials:'MT', status:'active', createdAt: new Date().toISOString() },
];

const ADMIN_USER = DEMO_USERS[0];

export const useAuth = create<AuthStore>()(
  persist(
    (set) => ({
      authSettings: { authEnabled: false, theme: 'editorial' },
      updateAuthSettings: (p) => set(s => ({ authSettings: { ...s.authSettings, ...p } })),

      currentUser: ADMIN_USER,  // default: logged in as tenant admin in demo mode
      login:  (user) => set({ currentUser: { ...user, lastLogin: new Date().toISOString() } }),
      logout: () => set({ currentUser: null }),

      users: DEMO_USERS,
      addUser: (u) => {
        const user: AppUser = { ...u, id: `u-${Date.now()}`, createdAt: new Date().toISOString() };
        set(s => ({ users: [...s.users, user] }));
        return user;
      },
      updateUser: (id, patch) => set(s => ({ users: s.users.map(u => u.id===id?{...u,...patch}:u) })),
      removeUser: (id) => set(s => ({ users: s.users.filter(u => u.id!==id) })),
    }),
    { name: 'nexuscdh-auth' }
  )
);

// Helper hook
export function usePermission(permission: Permission): boolean {
  const { currentUser, authSettings } = useAuth();
  if (!authSettings.authEnabled) return true;  // auth off = full access
  if (!currentUser) return false;
  return ROLE_PERMISSIONS[currentUser.role].includes(permission);
}

export function can(user: AppUser | null, permission: Permission, authEnabled: boolean): boolean {
  if (!authEnabled) return true;
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role].includes(permission);
}
