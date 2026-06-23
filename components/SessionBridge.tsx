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
  const setAuthReady = useAuth(s => s.setAuthReady);
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
        } else {
          // No session. Reconcile the client gate with the SERVER's real state:
          // enforced → require login; not enforced → demo mode (clears any stale
          // authEnabled=true left over from a previous enforced session).
          updateAuthSettings({ authEnabled: !!d?.enforced });
          if (d?.enforced) logout();
        }
      })
      .catch(() => { /* leave as-is */ })
      .finally(() => setAuthReady(true));
  }, [login, logout, updateAuthSettings, setAuthReady]);

  return null;
}
