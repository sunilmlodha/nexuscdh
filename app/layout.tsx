'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth, usePermission, ROLE_LABELS } from '@/lib/auth';
import {
  LayoutDashboard, Layers, GitBranch, Radio, Shield,
  Users, Brain, Cpu, Activity, Settings, LogOut,
  ChevronRight, Database, UserCheck, Zap, Sparkles,
  UserSearch, FlaskConical, BarChart3, Key, ScrollText, Wand2,
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    label: 'Workspace',
    items: [
      { href: '/',          label: 'Dashboard',      icon: LayoutDashboard, permission: null },
      { href: '/taxonomy',  label: 'Taxonomy',       icon: Layers,          permission: 'taxonomy:read' },
      { href: '/strategies',label: 'Strategies',     icon: GitBranch,       permission: 'strategies:read' },
      { href: '/channels',  label: 'Channels',       icon: Radio,           permission: 'channels:read' },
      { href: '/policies',  label: 'Engagement Policies', icon: Shield,     permission: 'policies:read' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/audiences', label: 'Audiences',         icon: Users,        permission: 'audiences:read' },
      { href: '/models',    label: 'Adaptive Models',   icon: Brain,        permission: 'models:read' },
      { href: '/simulator', label: 'Decision Simulator',icon: Cpu,          permission: 'simulator:read' },
      { href: '/profiles',  label: 'Customer Profiles', icon: UserSearch,   permission: 'profiles:read' },
      { href: '/experiments',label: 'Experiments',      icon: FlaskConical, permission: 'experiments:read' },
      { href: '/simulate',  label: 'Simulation',        icon: Cpu,          permission: 'simulate:read' },
      { href: '/analytics', label: 'Analytics',         icon: BarChart3,    permission: 'analytics:read' },
      { href: '/copilot',   label: 'AI Co-pilot',       icon: Wand2,        permission: null },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/operations',label: 'Operations',     icon: Activity,        permission: 'operations:read' },
      { href: '/triggers',  label: 'Event Triggers',  icon: Zap,            permission: 'triggers:read' },
      { href: '/apikeys',   label: 'API Keys',        icon: Key,            permission: 'settings:read' },
      { href: '/audit',     label: 'Audit Log',       icon: ScrollText,     permission: 'settings:read' },
      { href: '/configuration', label: 'Industry Templates', icon: Sparkles,   permission: 'settings:read' },
      { href: '/users',     label: 'Users & Roles',  icon: UserCheck,       permission: 'users:read' },
      { href: '/settings',  label: 'Settings',       icon: Settings,        permission: 'settings:read' },
    ],
  },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { currentUser, authSettings, logout } = useAuth();

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', authSettings.theme);
  }, [authSettings.theme]);

  // Redirect to login if auth enabled and no user
  useEffect(() => {
    if (authSettings.authEnabled && !currentUser && pathname !== '/login') {
      router.push('/login');
    }
  }, [authSettings.authEnabled, currentUser, pathname]);

  const isLogin = pathname === '/login';
  if (isLogin) return (
    <html lang="en"><head><title>NexusCDH — Sign in</title></head>
      <body style={{ background:'var(--bg)' }}>{children}</body>
    </html>
  );

  const user = authSettings.authEnabled ? currentUser : {
    name: 'Demo User', role: 'tenant_admin' as const, avatarInitials: 'DU'
  };

  return (
    <html lang="en">
      <head>
        <title>NexusCDH</title>
        <meta name="description" content="NexusCDH — Enterprise Customer Decision Hub" />
      </head>
      <body className="app-shell">

        {/* Sidebar */}
        <aside className="sidebar">
          {/* Logo */}
          <div className="sidebar-logo">
            <div className="sidebar-logo-mark">
              <div className="sidebar-logo-icon">
                <Zap size={16} color="white" />
              </div>
              <div>
                <div className="sidebar-logo-text">NexusCDH</div>
                <div className="sidebar-logo-sub">Customer Decision Hub</div>
              </div>
            </div>
          </div>

          {/* Nav sections */}
          <nav style={{ flex: 1, padding: '8px 0' }}>
            {NAV_SECTIONS.map(section => (
              <div key={section.label} className="sidebar-section">
                <div className="sidebar-section-label">{section.label}</div>
                {section.items.map(({ href, label, icon: Icon }) => {
                  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
                  return (
                    <Link key={href} href={href} className="nav-item" data-active={active ? true : undefined}>
                      <span className="nav-icon"><Icon size={14} /></span>
                      {label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* User footer */}
          <div className="sidebar-footer">
            {user && (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'white', flexShrink:0 }}>
                  {(user as any).avatarInitials ?? user.name?.slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.85)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.name}</div>
                  <div className="role-chip" style={{ marginTop:2 }}>{ROLE_LABELS[user.role]}</div>
                </div>
                {authSettings.authEnabled && (
                  <button onClick={() => { logout(); router.push('/login'); }}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.4)', padding:4 }}
                    title="Sign out">
                    <LogOut size={13} />
                  </button>
                )}
              </div>
            )}
            <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:10 }}>
              <span className="dot dot-green pulse" />
              <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>All systems operational</span>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="main-content">
          {children}
        </main>

      </body>
    </html>
  );
}
