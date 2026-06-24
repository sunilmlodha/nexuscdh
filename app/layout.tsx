'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth, usePermission, ROLE_LABELS, can, type Permission } from '@/lib/auth';
import SessionBridge from '@/components/SessionBridge';
import { createClient, AUTH_AVAILABLE } from '@/lib/supabase-browser';
import HydrateStore from '@/components/HydrateStore';
import {
  LayoutDashboard, Layers, GitBranch, Radio, Shield, Scale,
  Users, Brain, Cpu, Activity, Settings, LogOut,
  ChevronRight, UserCheck, Zap, Sparkles,
  UserSearch, FlaskConical, BarChart3, Key, ScrollText, Wand2,
  Share2, Workflow, Package, Route, Gem, LineChart, ShieldCheck,
  Boxes, GitPullRequest, TrendingUp, Megaphone, Send, Gauge, ListChecks, SlidersHorizontal,
  Fingerprint, Palette,
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    label: 'Workspace',
    items: [
      { href: '/',          label: 'Dashboard',      icon: LayoutDashboard, permission: null },
      { href: '/taxonomy',    label: 'Taxonomy',             icon: Layers,   permission: 'taxonomy:read' },
      { href: '/treatments', label: 'Treatments & Bundles', icon: Package,  permission: 'taxonomy:read' },
      { href: '/journeys',   label: 'Customer Journeys',    icon: Route,    permission: 'strategies:read' },
      { href: '/campaigns',  label: 'Campaigns',            icon: Megaphone,permission: 'strategies:read' },
      { href: '/strategies', label: 'Strategies',           icon: GitBranch,permission: 'strategies:read' },
      { href: '/nba-designer',label: 'NBA Designer',        icon: Route,    permission: 'strategies:read' },
      { href: '/arbitration',label: 'Prioritization',       icon: Scale,    permission: 'strategies:read' },
      { href: '/channels',  label: 'Channels',       icon: Radio,           permission: 'channels:read' },
      { href: '/containers',label: 'Decision Endpoints',  icon: Boxes,    permission: 'channels:read' },
      { href: '/policies',  label: 'Decision Guardrails', icon: Shield,     permission: 'policies:read' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/audiences', label: 'Audiences',         icon: Users,        permission: 'audiences:read' },
      { href: '/models',    label: 'Self-Learning Models', icon: Brain,     permission: 'models:read' },
      { href: '/model-ops', label: 'Model Ops',         icon: Boxes,        permission: 'models:read' },
      { href: '/value-finder',label: 'Opportunity Finder', icon: Gem,       permission: 'analytics:read' },
      { href: '/scenario',  label: 'Scenario Planner',  icon: LineChart,    permission: 'simulator:read' },
      { href: '/bias',      label: 'Ethical Bias Check',icon: ShieldCheck,  permission: 'analytics:read' },
      { href: '/lift',      label: 'Lift Analytics',    icon: TrendingUp,   permission: 'analytics:read' },
      { href: '/simulator', label: 'Decision Simulator',icon: Cpu,          permission: 'simulator:read' },
      { href: '/profiles',  label: 'Customer Profiles', icon: UserSearch,   permission: 'profiles:read' },
      { href: '/identity',  label: 'Identity Resolution',icon: Fingerprint, permission: 'profiles:read' },
      { href: '/experiments',label: 'Experiments',      icon: FlaskConical, permission: 'experiments:read' },
      { href: '/simulate',  label: 'Simulation',        icon: Cpu,          permission: 'simulate:read' },
      { href: '/analytics', label: 'Analytics',         icon: BarChart3,    permission: 'analytics:read' },
      { href: '/copilot',   label: 'AI Co-pilot',       icon: Wand2,        permission: null },
      { href: '/dataflow',  label: 'Decision Dataflow',  icon: Workflow,     permission: null },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/seed',       label: 'Demo Data Seeder',  icon: Share2,          permission: null },
      { href: '/delivery',   label: 'Delivery',          icon: Send,            permission: 'operations:read' },
      { href: '/revisions',  label: 'Real-Time Operations', icon: GitPullRequest, permission: 'operations:read' },
      { href: '/operations', label: 'Batch Operations',  icon: Activity,        permission: 'operations:read' },
      { href: '/observability', label: 'Observability',   icon: Gauge,           permission: 'operations:read' },
      { href: '/jobs',       label: 'Decision Jobs',     icon: ListChecks,      permission: 'operations:read' },
      { href: '/platform',   label: 'Platform',          icon: SlidersHorizontal, permission: 'settings:read' },
      { href: '/compliance', label: 'Compliance',        icon: ShieldCheck,     permission: 'settings:read' },
      { href: '/triggers',  label: 'Event Triggers',  icon: Zap,            permission: 'triggers:read' },
      { href: '/apiref',    label: 'API Reference',   icon: Key,            permission: null },
      { href: '/apikeys',   label: 'API Keys',        icon: Key,            permission: 'settings:read' },
      { href: '/audit',     label: 'Audit Log',       icon: ScrollText,     permission: 'settings:read' },
      { href: '/configuration', label: 'Industry Templates', icon: Sparkles,   permission: 'settings:read' },
      { href: '/design-system', label: 'Design System',    icon: Palette,      permission: null },
      { href: '/users',     label: 'Users & Roles',  icon: UserCheck,       permission: 'users:read' },
      { href: '/settings',  label: 'Settings',       icon: Settings,        permission: 'settings:read' },
    ],
  },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { currentUser, authSettings, logout, authReady } = useAuth();

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', authSettings.theme);
  }, [authSettings.theme]);

  // Redirect to login only AFTER the session check resolves (authReady),
  // so a valid SSO session isn't bounced before SessionBridge logs the user in.
  useEffect(() => {
    if (authReady && authSettings.authEnabled && !currentUser && pathname !== '/login') {
      router.push('/login');
    }
  }, [authReady, authSettings.authEnabled, currentUser, pathname]);

  const isLogin = pathname === '/login';
  if (isLogin) return (
    <html lang="en"><head><title>Stratcheck — Sign in</title></head>
      <body style={{ background:'var(--bg)' }}>{children}</body>
    </html>
  );

  const user = authSettings.authEnabled ? currentUser : {
    name: 'Demo User', role: 'tenant_admin' as const, avatarInitials: 'DU'
  };

  async function signOut() {
    if (AUTH_AVAILABLE) { try { await createClient().auth.signOut(); } catch { /* ignore */ } }
    logout();                       // clear local session
    router.push('/login');
  }

  return (
    <html lang="en">
      <head>
        <title>Stratcheck</title>
        <meta name="description" content="Stratcheck — Enterprise AI Decisioning Platform" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&display=swap" rel="stylesheet" />
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
                <div className="sidebar-logo-text">Stratcheck</div>
                <div className="sidebar-logo-sub">AI Decisioning Platform</div>
              </div>
            </div>
          </div>

          {/* Nav sections */}
          <nav style={{ flex: 1, padding: '8px 0' }}>
            {NAV_SECTIONS.map(section => {
              // RBAC: only show offerings the current role can access (auth off = all)
              const visible = section.items.filter(it => !it.permission || can(currentUser, it.permission as Permission, authSettings.authEnabled));
              if (visible.length === 0) return null;
              return (
              <div key={section.label} className="sidebar-section">
                <div className="sidebar-section-label">{section.label}</div>
                {visible.map(({ href, label, icon: Icon }) => {
                  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
                  return (
                    <Link key={href} href={href} className="nav-item" data-active={active ? true : undefined}>
                      <span className="nav-icon"><Icon size={14} /></span>
                      {label}
                    </Link>
                  );
                })}
              </div>
              );
            })}
          </nav>

          {/* User footer */}
          <div className="sidebar-footer">
            {user && (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--sidebar-chip-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'var(--sidebar-fg-strong)', flexShrink:0 }}>
                  {(user as any).avatarInitials ?? user.name?.slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--sidebar-fg-strong)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.name}</div>
                  {(user as any).email
                    ? <div style={{ fontSize:10, color:'var(--text-nav-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{(user as any).email}</div>
                    : <div className="role-chip" style={{ marginTop:2 }}>{ROLE_LABELS[user.role]}</div>}
                </div>
                <button onClick={signOut}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-nav-muted)', padding:4, display:'flex', alignItems:'center' }}
                  title={authSettings.authEnabled ? 'Sign out' : 'Sign out (go to login)'}>
                  <LogOut size={14} />
                </button>
              </div>
            )}
            <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:10 }}>
              <span className="dot dot-green pulse" />
              <span style={{ fontSize:10, color:'var(--text-nav-muted)' }}>All systems operational</span>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="main-content">
          <HydrateStore />
          <SessionBridge />
          {children}
        </main>

      </body>
    </html>
  );
}
