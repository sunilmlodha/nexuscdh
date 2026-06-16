'use client';

import { useState, useEffect } from 'react';
import {
  Database, CheckCircle, AlertCircle, RefreshCw, Trash2, Sparkles,
  Users, GitBranch, Radio, Shield, Brain, Zap, FlaskConical, ScrollText,
} from 'lucide-react';

interface Counts {
  categories: number; topics: number; actions: number;
  strategies: number; audiences: number; customer_profiles: number;
  event_triggers: number; experiments: number; decision_logs: number;
  contact_policies: number;
}

interface SeedResult {
  ok: boolean;
  seeded?: Record<string, number | string>;
  error?: string;
}

const ITEMS = [
  { key: 'categories',       label: 'Taxonomy Categories', icon: Sparkles, color: '#6c63ff' },
  { key: 'topics',           label: 'Taxonomy Topics',     icon: Sparkles, color: '#5c53ef' },
  { key: 'actions',          label: 'Actions',             icon: Zap,       color: '#ef6c00' },
  { key: 'contact_policies', label: 'Contact Policies',    icon: Shield,    color: '#c62828' },
  { key: 'strategies',       label: 'Strategies',          icon: GitBranch, color: '#2e7d32' },
  { key: 'audiences',        label: 'Audiences',           icon: Users,     color: '#1565c0' },
  { key: 'event_triggers',   label: 'Event Triggers',      icon: Zap,       color: '#ef6c00' },
  { key: 'experiments',      label: 'Experiments',         icon: FlaskConical, color: '#7b1fa2' },
  { key: 'customer_profiles',label: 'Customer Profiles',   icon: Users,     color: '#0288d1' },
  { key: 'decision_logs',    label: 'Decision Logs',       icon: ScrollText, color: '#00838f' },
];

export default function SeedPage() {
  const [counts, setCounts]     = useState<Counts | null>(null);
  const [loading, setLoading]   = useState(false);
  const [seeding, setSeeding]   = useState(false);
  const [wiping, setWiping]     = useState(false);
  const [result, setResult]     = useState<SeedResult | null>(null);
  const [error, setError]       = useState<string | null>(null);

  async function fetchCounts() {
    setLoading(true);
    try {
      const res = await fetch('/api/seed');
      if (res.ok) setCounts(await res.json());
      else setError((await res.json()).error ?? 'Failed to fetch counts');
    } catch { setError('Could not reach API'); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchCounts(); }, []);

  async function runSeed(wipe = false) {
    wipe ? setWiping(true) : setSeeding(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch('/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wipe }),
      });
      const data = await res.json();
      if (res.ok) { setResult(data); await fetchCounts(); }
      else setError(data.error ?? 'Seed failed');
    } catch { setError('Network error'); }
    finally { setSeeding(false); setWiping(false); }
  }

  const totalRecords = counts ? Object.values(counts).reduce((a, b) => a + (b as number), 0) : 0;

  return (
    <div style={{ padding: '32px 36px', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Database size={22} style={{ color: 'var(--accent)' }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Demo Data Seeder</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Populate NexusCDH with realistic demo data — taxonomy, strategies, actions, audiences, customer profiles,
          event triggers, experiments and decision logs — so every Intelligence feature shows live data.
        </p>
      </div>

      {/* Status alert */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#ffebee', borderRadius: 8, marginBottom: 20, borderLeft: '3px solid #c62828' }}>
          <AlertCircle size={16} style={{ color: '#c62828' }} />
          <span style={{ fontSize: 13, color: '#c62828' }}>{error}</span>
        </div>
      )}

      {/* Counts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
        {ITEMS.map(({ key, label, icon: Icon, color }) => {
          const count = counts ? (counts as unknown as Record<string, number>)[key] ?? 0 : null;
          return (
            <div key={key} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={14} style={{ color }} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: count && count > 0 ? 'var(--text)' : 'var(--text-muted)' }}>
                  {loading ? '…' : count ?? 0}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3 }}>{label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Seed Actions</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
          <strong>Seed (safe)</strong> uses upsert — existing records are updated, nothing is deleted.
          <strong> Reset &amp; Seed</strong> wipes all demo data first, then seeds fresh.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => runSeed(false)} disabled={seeding || wiping}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14, opacity: seeding ? 0.6 : 1 }}>
            {seeding ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Database size={15} />}
            {seeding ? 'Seeding…' : `Seed Demo Data (${totalRecords} records exist)`}
          </button>
          <button onClick={() => { if (confirm('This will delete ALL demo data then re-seed. Continue?')) runSeed(true); }}
            disabled={seeding || wiping}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'none', color: '#c62828', border: '1px solid #ffcdd2', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14, opacity: wiping ? 0.6 : 1 }}>
            {wiping ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={15} />}
            {wiping ? 'Resetting…' : 'Reset & Seed'}
          </button>
          <button onClick={fetchCounts} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: 13 }}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Seed result */}
      {result && (
        <div className="card" style={{ padding: 20, borderLeft: '3px solid var(--success)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <CheckCircle size={18} style={{ color: 'var(--success)' }} />
            <span style={{ fontWeight: 700 }}>Seed complete</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
            {result.seeded && Object.entries(result.seeded).map(([k, v]) => (
              <div key={k} style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '8px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{k.replace(/_/g, ' ')}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: typeof v === 'string' && v.startsWith('error') ? '#e53935' : 'var(--success)' }}>
                    {typeof v === 'string' && v.startsWith('error') ? '✗' : `+${v}`}
                  </span>
                </div>
                {typeof v === 'string' && v.startsWith('error') && (
                  <div style={{ fontSize: 10, color: '#e53935', marginTop: 2, wordBreak: 'break-all' }}>{v}</div>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'View Strategies', href: '/strategies' },
              { label: 'View Profiles', href: '/car' },
              { label: 'Run Decision', href: '/simulator' },
              { label: 'View Analytics', href: '/analytics' },
            ].map(({ label, href }) => (
              <a key={href} href={href} style={{ fontSize: 12, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 6, textDecoration: 'none', color: 'var(--text-primary)' }}>
                {label} →
              </a>
            ))}
          </div>
        </div>
      )}

      {/* What gets seeded */}
      <div className="card" style={{ padding: 20, marginTop: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 14 }}>What the seeder creates</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: '5 Taxonomy categories', detail: 'Sales, Service, Retention, Onboarding, Cross-sell' },
            { label: '7 Topics', detail: 'Home Insurance, Mortgage, Credit Cards, Savings, Loyalty, Self-Service, Welcome' },
            { label: '8 Actions', detail: 'Home Insurance Upsell, Mortgage Refinance, Platinum Card, Term Deposit, Loyalty Boost, App Nudge, Direct Debit, Contents Add-on' },
            { label: '2 Contact Policies', detail: 'Standard Policy + VIP Policy with fairness guard' },
            { label: '4 Strategies', detail: 'Home Insurance Growth, Premium Card Cross-sell, Re-engagement, New Customer Onboarding' },
            { label: '4 Audiences', detail: 'Mortgage Holders, High Spend Transactors, Dormant Customers, New Joiners' },
            { label: '4 Event Triggers', detail: 'Mortgage Approved, High-Value Purchase, 60-day Login Gap, New Account Created' },
            { label: '2 Experiments', detail: 'Insurance Email vs Web, Platinum Card Copy A/B' },
            { label: '6 Customer Profiles', detail: 'Sarah, James, Emma, David, Priya, Marcus — varied segments and attributes' },
            { label: '8 Decision Logs', detail: 'Mix of served/suppressed, accepted/rejected across all strategies' },
          ].map(({ label, detail }) => (
            <div key={label} style={{ display: 'flex', gap: 8 }}>
              <CheckCircle size={14} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
