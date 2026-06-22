'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';

/**
 * Bridges the Supabase SSO session into the app's existing auth/permission
 * system. If a real session exists, the current user + role become the live
 * identity and governance is enforced (authEnabled=true). With no session the
 * app stays in demo mode (full access) — so SSO is additive, not a lockout.
 */
export default function SessionBridge() {
  const login = useAuth(s => s.login);
  const logout = useAuth(s => s.logout);
  const updateAuthSettings = useAuth(s => s.updateAuthSettings);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    fetch('/api/me')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.authenticated) {
          login({
            id: d.email, name: d.name ?? d.email, email: d.email, role: d.role,
            avatarInitials: String(d.name ?? d.email).slice(0, 2).toUpperCase(),
            status: 'active', createdAt: new Date().toISOString(),
          });
          updateAuthSettings({ authEnabled: true });
        } else if (d?.enforced) {
          // Server enforces auth but there's no session → turn on the client
          // gate so the layout redirects to /login (no silent 401s on writes).
          logout();
          updateAuthSettings({ authEnabled: true });
        }
        // else: demo mode, leave as-is (full access)
      })
      .catch(() => {});
  }, [login, logout, updateAuthSettings]);

  return null;
}
