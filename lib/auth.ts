/**
 * NexusCDH Auth & RBAC
 *
 * Authentication: optional (toggle in Settings → Auth)
 *   - When disabled: single shared workspace, no login required
 *   - When enabled: JWT simulation, per-user role enforcement
 *
 * Roles & Permissions matrix:
 *
 *   Role                  | Dashboard | Taxonomy | Strategies | Channels | Policies | Audiences | Models | Simulator | Operations | Users | Settings | Profiles | Experiments |
 *   ──────────────────────|──────────|──────────|────────────|──────────|──────────|───────────|────────|───────────|────────────|───────|──────────|──────────|─────────────|
 *   super_admin           |    R/W   |   R/W    |    R/W     |   R/W    |   R/W    |    R/W    |  R/W   |    R/W    |    R/W     |  R/W  |   R/W    |   R/W    |     R/W     |
 *   tenant_admin          |    R/W   |   R/W    |    R/W     |   R/W    |   R/W    |    R/W    |  R/W   |    R/W    |    R/W     |  R/W  |   R/W    |   R/W    |     R/W     |
 *   strategy_manager      |    R     |   R/W    |    R/W     |   R      |   R/W    |    R/W    |  R     |    R/W    |    R       |  -    |   -      |   -      |     R/W     |
 *   campaign_analyst      |    R     |   R      |    R       |   R      |   R      |    R      |  R     |    R/W    |    R       |  -    |   -      |   -      |     R       |
 *   channel_manager       |    R     |   R      |    R       |   R/W    |   R/W    |    R      |  R     |    R      |    R       |  -    |   -      |   -      |     -       |
 *   data_scientist        |    R     |   R      |    R       |   R      |   R      |    R/W    |  R/W   |    R/W    |    R       |  -    |   -      |   R      |     R       |
 *   ops_manager           |    R     |   R      |    R       |   R      |   R      |    R      |  R     |    R      |    R/W     |  -    |   R      |   R      |     -       |
 *   read_only             |    R     |   R      |    R       |   R      |   R      |    R      |  R     |    R      |    R       |  -    |   -      |   -      |     -       |
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { ROLE_PERMISSIONS, ROLE_LABELS, roleHasPermission, type Role, type Permission } from './rbac';
export { ROLE_PERMISSIONS, ROLE_LABELS, roleHasPermission };
export type { Role, Permission };

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
