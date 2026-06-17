'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Users, Search, List, CheckCircle, XCircle, ChevronRight, Plus, Trash2,
  AlertTriangle, UserPlus, Upload, Download, FileText, Database, RefreshCw, CheckCircle2,
} from 'lucide-react';

const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';
const ACCENT = 'var(--brand-accent)';
const ACCENT_SOFT = 'rgba(99,102,241,0.1)';

type Tab = 'lookup' | 'browse' | 'ingest' | 'schema';

interface CustomerProfile {
  id: string;
  customer_id: string;
  attributes: Record<string, unknown>;
  segments: string[];
  interaction_count: number;
  last_seen_at?: string;
}

interface DecisionRow {
  id: string;
  strategy_name?: string;
  action_name?: string;
  served: boolean;
  suppression_reason?: string;
  outcome?: string;
  created_at: string;
}

const SAMPLE_PROFILES = [
  { customer_id: 'CUST-001', attributes: { age: 34, income_band: 'high', product_interest: 'mortgage', risk_score: 0.12, channel_preference: 'mobile' } },
  { customer_id: 'CUST-002', attributes: { age: 52, income_band: 'medium', product_interest: 'savings', risk_score: 0.45, channel_preference: 'email' } },
  { customer_id: 'CUST-003', attributes: { age: 28, income_band: 'low', product_interest: 'credit_card', risk_score: 0.67, channel_preference: 'web' } },
  { customer_id: 'CUST-004', attributes: { age: 41, income_band: 'high', product_interest: 'investment', risk_score: 0.08, channel_preference: 'branch' } },
  { customer_id: 'CUST-005', attributes: { age: 63, income_band: 'medium', product_interest: 'insurance', risk_score: 0.22, channel_preference: 'email' } },
];

const CAR_SCHEMA = [
  { field: 'customer_id',                  type: 'string',  required: true,  description: 'Unique customer identifier (PK)' },
  { field: 'name',                         type: 'string',  required: false, description: 'Full name' },
  { field: 'age',                          type: 'number',  required: false, description: 'Age in years' },
  { field: 'gender',                       type: 'string',  required: false, description: 'M / F / NB' },
  { field: 'email',                        type: 'string',  required: false, description: 'Contact email address' },
  { field: 'customer_segment',             type: 'string',  required: false, description: 'high_value / affluent / mass_affluent / mass_market / emerging' },
  { field: 'monthly_income',               type: 'number',  required: false, description: 'Gross monthly income (AUD)' },
  { field: 'monthly_spend',                type: 'number',  required: false, description: 'Avg monthly card spend (AUD)' },
  { field: 'credit_score',                 type: 'number',  required: false, description: '300 – 850' },
  { field: 'credit_card_tier',             type: 'string',  required: false, description: 'none / standard / gold / platinum' },
  { field: 'account_status',               type: 'string',  required: false, description: 'active / dormant / closed' },
  { field: 'account_age_days',             type: 'number',  required: false, description: 'Days since account opened' },
  { field: 'days_since_last_transaction',  type: 'number',  required: false, description: 'Days since last debit/credit' },
  { field: 'has_mortgage',                 type: 'boolean', required: false, description: 'Currently holds a mortgage' },
  { field: 'has_home_insurance',           type: 'boolean', required: false, description: 'Active home insurance policy' },
  { field: 'has_contents_insurance',       type: 'boolean', required: false, description: 'Active contents insurance policy' },
  { field: 'has_direct_debit',             type: 'boolean', required: false, description: 'Direct debit set up' },
  { field: 'channel_preference',           type: 'string',  required: false, description: 'email / sms / app / web / phone' },
  { field: 'consent',                      type: 'boolean', required: false, description: 'Marketing consent given' },
  { field: 'marketing_opt_in',             type: 'boolean', required: false, description: 'Opted into marketing communications' },
  { field: 'products',                     type: 'array',   required: false, description: 'List of products held' },
];

const SAMPLE_CSV = `customer_id,name,age,gender,email,customer_segment,monthly_income,monthly_spend,credit_score,credit_card_tier,account_status,account_age_days,days_since_last_transaction,has_mortgage,has_home_insurance,has_contents_insurance,has_direct_debit,channel_preference,consent,marketing_opt_in
cust-010,Alice Thompson,29,F,alice@example.com,emerging,4200,750,650,standard,active,180,1,false,false,false,true,app,true,true
cust-011,Robert Garcia,47,M,r.garcia@example.com,mass_affluent,8500,2800,730,gold,active,2100,3,true,false,false,true,email,true,true
cust-012,Mei Lin,35,F,mei.lin@example.com,affluent,12000,3500,790,platinum,active,1450,2,true,true,false,true,web,true,true`;

function parseCSV(text: string): Record<string, unknown>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim());
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      const v = vals[i] ?? '';
      if (v === 'true') obj[h] = true;
      else if (v === 'false') obj[h] = false;
      else if (v !== '' && !isNaN(Number(v))) obj[h] = Number(v);
      else obj[h] = v;
    });
    return obj;
  });
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const panel: React.CSSProperties = { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12 };

export default function ProfilesPage() {
  const [tab, setTab] = useState<Tab>('lookup');

  // Lookup
  const [searchId, setSearchId] = useState('');
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editAttrs, setEditAttrs] = useState<Record<string, unknown>>({});
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');
  const [addingAttr, setAddingAttr] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedDone, setSeedDone] = useState(false);
  const [searched, setSearched] = useState(false);

  // Browse
  const [allProfiles, setAllProfiles] = useState<CustomerProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [browseQuery, setBrowseQuery] = useState('');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createId, setCreateId] = useState('');
  const [createAttrs, setCreateAttrs] = useState<Record<string, string>>({ age: '', income_band: '', product_interest: '', channel_preference: '' });
  const [createLoading, setCreateLoading] = useState(false);

  // Ingest
  const [ingestMode, setIngestMode] = useState<'csv' | 'manual'>('csv');
  const [csvText, setCsvText] = useState('');
  const [csvPreview, setCsvPreview] = useState<Record<string, unknown>[]>([]);
  const [ingestStatus, setIngestStatus] = useState<{ ok: number; errors: string[] } | null>(null);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [manualJson, setManualJson] = useState('{\n  "customer_id": "cust-new",\n  "name": "New Customer",\n  "age": 30,\n  "customer_segment": "mass_market",\n  "account_status": "active",\n  "consent": true\n}');
  const fileRef = useRef<HTMLInputElement>(null);

  const lookupProfile = useCallback(async (customerId: string) => {
    if (!customerId.trim()) return;
    setLoading(true); setError(null); setSearched(true); setTab('lookup');
    try {
      const res = await fetch(`/api/profile?customerId=${encodeURIComponent(customerId)}&tenantId=${TENANT_ID}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load profile');
      if (data.configured === false) { setConfigured(false); return; }
      setConfigured(true);
      setProfile(data.profile);
      setDecisions(data.decisions || []);
      setEditAttrs(data.profile?.attributes || {});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setProfile(null); setDecisions([]);
    } finally { setLoading(false); }
  }, []);

  const loadAll = useCallback(async (q = '') => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/profile?list=true&q=${encodeURIComponent(q)}&tenantId=${TENANT_ID}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load profiles');
      if (data.configured === false) { setConfigured(false); return; }
      setConfigured(true);
      setAllProfiles(data.profiles || []);
      setTotal(data.total ?? (data.profiles?.length || 0));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setAllProfiles([]);
    } finally { setLoading(false); }
  }, []);

  // Load the browse list whenever the Browse tab is active or its query changes
  useEffect(() => {
    if (tab === 'browse') {
      const t = setTimeout(() => loadAll(browseQuery), 250);
      return () => clearTimeout(t);
    }
  }, [tab, browseQuery, loadAll]);

  const saveProfile = useCallback(async () => {
    if (!profile) return;
    setSaveLoading(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: profile.customer_id, attributes: editAttrs }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed to save'); }
      setProfile((p) => p ? { ...p, attributes: editAttrs } : p);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally { setSaveLoading(false); }
  }, [profile, editAttrs]);

  const deleteProfileById = useCallback(async (customerId: string, decisionCount?: number) => {
    const confirmed = window.confirm(
      `Delete all data for ${customerId}${decisionCount != null ? ` including ${decisionCount} decisions` : ''}? This is a permanent erasure (GDPR) and cannot be undone.`
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/profile?customerId=${encodeURIComponent(customerId)}&tenantId=${TENANT_ID}`, { method: 'DELETE' });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Delete failed'); }
      if (profile?.customer_id === customerId) {
        setProfile(null); setDecisions([]); setEditAttrs({}); setSearchId('');
      }
      setAllProfiles((prev) => prev.filter((p) => p.customer_id !== customerId));
      setTotal((t) => Math.max(0, t - 1));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }, [profile]);

  const recordOutcome = useCallback(async (decisionId: string, outcome: string) => {
    if (!profile) return;
    try {
      const res = await fetch('/api/outcome', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisionId, customerId: profile.customer_id, outcome }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed to record outcome'); }
      setDecisions((prev) => prev.map((d) => (d.id === decisionId ? { ...d, outcome } : d)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Outcome error');
    }
  }, [profile]);

  const seedSampleProfiles = useCallback(async () => {
    setSeedLoading(true); setError(null);
    try {
      await fetch('/api/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: SAMPLE_PROFILES, tenantId: TENANT_ID }),
      });
      setSeedDone(true);
      setTab('browse');
      await loadAll();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Seed failed');
    } finally { setSeedLoading(false); }
  }, [loadAll]);

  const createProfile = useCallback(async () => {
    if (!createId.trim()) return;
    setCreateLoading(true); setError(null);
    try {
      const attrs: Record<string, unknown> = {};
      Object.entries(createAttrs).forEach(([k, v]) => { if (v.trim()) attrs[k] = v.trim(); });
      const res = await fetch('/api/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: createId.trim(), attributes: attrs }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Create failed'); }
      const newId = createId.trim();
      setShowCreate(false); setCreateId('');
      setCreateAttrs({ age: '', income_band: '', product_interest: '', channel_preference: '' });
      lookupProfile(newId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally { setCreateLoading(false); }
  }, [createId, createAttrs, lookupProfile]);

  // ── Ingest actions ──────────────────────────────────────────────────────────
  function previewCSV(text: string) {
    setCsvText(text);
    setCsvPreview(parseCSV(text));
  }

  async function ingestCSV() {
    setIngestLoading(true); setIngestStatus(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: csvPreview, tenantId: TENANT_ID }),
      });
      const data = await res.json();
      setIngestStatus(data);
      if (data.ok > 0) { setCsvText(''); setCsvPreview([]); }
    } catch (e: unknown) {
      setIngestStatus({ ok: 0, errors: [e instanceof Error ? e.message : 'Ingest failed'] });
    } finally { setIngestLoading(false); }
  }

  async function ingestManual() {
    setIngestLoading(true); setIngestStatus(null);
    try {
      const parsed = JSON.parse(manualJson);
      const records = Array.isArray(parsed) ? parsed : [parsed];
      const res = await fetch('/api/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records, tenantId: TENANT_ID }),
      });
      const data = await res.json();
      setIngestStatus(data);
    } catch (e: unknown) {
      setIngestStatus({ ok: 0, errors: [e instanceof Error ? e.message : 'Invalid JSON'] });
    } finally { setIngestLoading(false); }
  }

  function downloadSampleCSV() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'car_sample.csv';
    a.click();
  }

  const attrEntries = Object.entries(editAttrs);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'lookup', label: 'Lookup' },
    { id: 'browse', label: 'Browse' },
    { id: 'ingest', label: 'Data Ingestion' },
    { id: 'schema', label: 'Attribute Schema' },
  ];

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Database size={24} color={ACCENT} />
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>Customer Profiles</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
              The Customer Attribute Repository (CAR) — persistent customer context, decision history, and bulk ingestion
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setShowCreate(true)} style={btnPrimary}><UserPlus size={15} /> Create Profile</button>
          <button onClick={seedSampleProfiles} disabled={seedLoading || seedDone} style={{ ...btnSecondary, ...(seedDone ? { background: '#dcfce7', color: '#15803d' } : {}), cursor: seedLoading || seedDone ? 'not-allowed' : 'pointer', opacity: seedLoading ? 0.7 : 1 }}>
            {seedDone ? '✓ Seeded' : seedLoading ? 'Seeding…' : '+ Seed Sample Data'}
          </button>
        </div>
      </div>

      {/* Not Configured Banner */}
      {configured === false && (
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', padding: '16px 20px', marginBottom: '24px' }}>
          <AlertTriangle size={20} color="#b45309" style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#92400e', marginBottom: '4px' }}>Supabase not configured</div>
            <div style={{ fontSize: '13px', color: '#78350f' }}>
              Customer Profiles requires a Supabase connection. Add <code>NEXT_PUBLIC_SUPABASE_URL</code>,{' '}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, and <code>SUPABASE_SERVICE_ROLE_KEY</code> to your{' '}
              <code>.env.local</code>, then run <code>schema.sql</code> and <code>schema_v2.sql</code>.
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: '8px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14,
            fontWeight: tab === id ? 700 : 500, color: tab === id ? ACCENT : 'var(--text-muted)',
            borderBottom: tab === id ? `2px solid ${ACCENT}` : '2px solid transparent', marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 16px', marginBottom: '20px', fontSize: '14px' }}>{error}</div>
      )}

      {/* ── LOOKUP TAB ── */}
      {tab === 'lookup' && (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', ...panel, padding: '12px 16px', alignItems: 'center', borderRadius: 10 }}>
            <Search size={16} color="var(--text-muted)" />
            <input type="text" value={searchId} onChange={(e) => setSearchId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && lookupProfile(searchId)}
              placeholder="Enter customer ID (e.g. CUST-001)…"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '14px' }} />
            <button onClick={() => lookupProfile(searchId)} disabled={loading || !searchId.trim()}
              style={{ ...btnPrimary, padding: '7px 18px', opacity: loading || !searchId.trim() ? 0.6 : 1, cursor: loading || !searchId.trim() ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Loading…' : 'Look up'}
            </button>
          </div>

          {loading && <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '14px' }}>Loading…</div>}

          {/* Empty / prompt state */}
          {!loading && !profile && !searched && configured !== false && (
            <div style={{ ...panel, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 32px', textAlign: 'center' }}>
              <Users size={40} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
              <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>Search for a customer</h2>
              <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: '14px', maxWidth: '360px' }}>
                Enter a customer ID above to view their profile and decision history, or browse all profiles.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowCreate(true)} style={btnPrimary}><UserPlus size={15} /> Create Profile</button>
                <button onClick={() => setTab('browse')} style={btnSecondary}><List size={15} /> Browse All</button>
              </div>
            </div>
          )}

          {/* Not found */}
          {!loading && profile === null && configured === true && searched && searchId && (
            <div style={{ ...panel, textAlign: 'center', padding: '48px 32px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '15px', margin: '0 0 16px' }}>
                No profile found for <strong style={{ color: 'var(--text-primary)' }}>{searchId}</strong>
              </p>
              <button onClick={() => { setCreateId(searchId); setShowCreate(true); }} style={{ ...btnPrimary, display: 'inline-flex' }}>
                <UserPlus size={15} /> Create profile for {searchId}
              </button>
            </div>
          )}

          {/* Profile detail */}
          {!loading && profile && (
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
              {/* LEFT */}
              <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ ...panel, padding: '20px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{profile.customer_id}</span>
                      <span style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: '999px', padding: '2px 10px', fontSize: '12px', fontWeight: 600 }}>{profile.interaction_count} interactions</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Last seen: {formatDate(profile.last_seen_at)}</div>
                  </div>

                  {/* Segments */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={labelStyle}>Segments</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {profile.segments && profile.segments.length > 0
                        ? profile.segments.map((seg) => (
                          <span key={seg} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 10px', fontSize: '12px', color: 'var(--text-muted)' }}>{seg}</span>
                        ))
                        : <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No segments</span>}
                    </div>
                  </div>

                  {/* Attributes */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={labelStyle}>Attributes</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {attrEntries.map(([key, val]) => (
                          <tr key={key}>
                            <td style={{ padding: '5px 8px 5px 0', fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-muted)', width: '40%', verticalAlign: 'middle' }}>{key}</td>
                            <td style={{ padding: '5px 0', verticalAlign: 'middle' }}>
                              <input defaultValue={String(val ?? '')}
                                onBlur={(e) => setEditAttrs((prev) => ({ ...prev, [key]: e.target.value }))}
                                style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid transparent', outline: 'none', color: 'var(--text-primary)', fontSize: '13px', padding: '2px 4px', cursor: 'text' }}
                                onFocus={(e) => { e.currentTarget.style.borderBottomColor = ACCENT; }} />
                            </td>
                            <td style={{ padding: '5px 0 5px 4px', width: '24px' }}>
                              <button onClick={() => setEditAttrs((prev) => { const n = { ...prev }; delete n[key]; return n; })}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex', alignItems: 'center' }}><Trash2 size={12} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {addingAttr ? (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                        <input placeholder="Key" value={newAttrKey} onChange={(e) => setNewAttrKey(e.target.value)} style={miniInput} />
                        <input placeholder="Value" value={newAttrValue} onChange={(e) => setNewAttrValue(e.target.value)} style={miniInput} />
                        <button onClick={() => { if (newAttrKey.trim()) { setEditAttrs((prev) => ({ ...prev, [newAttrKey.trim()]: newAttrValue })); setNewAttrKey(''); setNewAttrValue(''); setAddingAttr(false); } }}
                          style={{ padding: '5px 10px', borderRadius: '6px', background: ACCENT, color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px' }}>Add</button>
                        <button onClick={() => { setAddingAttr(false); setNewAttrKey(''); setNewAttrValue(''); }}
                          style={{ padding: '5px 10px', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setAddingAttr(true)} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', background: 'none', border: 'none', color: ACCENT, cursor: 'pointer', fontSize: '13px', padding: '4px 0' }}><Plus size={13} /> Add attribute</button>
                    )}

                    <button onClick={saveProfile} disabled={saveLoading}
                      style={{ marginTop: '12px', width: '100%', padding: '8px', borderRadius: '8px', background: ACCENT, color: '#fff', border: 'none', cursor: saveLoading ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600, opacity: saveLoading ? 0.7 : 1 }}>
                      {saveLoading ? 'Saving…' : 'Save Profile'}
                    </button>
                  </div>

                  {/* GDPR */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '4px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Right to Erasure</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>Permanently delete all data for this customer</div>
                    <button onClick={() => deleteProfileById(profile.customer_id, decisions.length)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '7px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
                      <Trash2 size={13} /> Delete all data
                    </button>
                  </div>
                </div>
              </div>

              {/* RIGHT — decision history */}
              <div style={{ flex: '0 0 calc(60% - 24px)', minWidth: 0 }}>
                <div style={{ ...panel, padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Decision History</h2>
                    <span style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '999px', padding: '2px 10px', fontSize: '12px', color: 'var(--text-muted)' }}>{decisions.length}</span>
                  </div>
                  {decisions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '14px' }}>No decisions recorded yet for this customer</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {decisions.map((row) => (
                        <div key={row.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px', borderRadius: '8px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                          <div style={{ paddingTop: '1px', flexShrink: 0 }}>{row.served ? <CheckCircle size={16} color="#16a34a" /> : <XCircle size={16} color="#dc2626" />}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 500, fontSize: '14px', color: 'var(--text-primary)' }}>{row.strategy_name || 'Unknown strategy'}</span>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>{formatRelativeTime(row.created_at)}</span>
                            </div>
                            <div style={{ fontSize: '13px', marginTop: '2px' }}>
                              {row.served ? <span style={{ color: 'var(--text-muted)' }}>{row.action_name}</span> : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{row.suppression_reason || 'Suppressed'}</span>}
                            </div>
                            <div style={{ marginTop: '8px' }}>
                              {row.outcome ? (
                                <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 500,
                                  ...(row.outcome === 'accepted' ? { background: '#dcfce7', color: '#15803d' } : row.outcome === 'rejected' ? { background: '#fee2e2', color: '#b91c1c' } : { background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }) }}>
                                  {row.outcome.charAt(0).toUpperCase() + row.outcome.slice(1)}
                                </span>
                              ) : (
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                  <button onClick={() => recordOutcome(row.id, 'accepted')} style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '12px', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', cursor: 'pointer', fontWeight: 500 }}>✓ Accept</button>
                                  <button onClick={() => recordOutcome(row.id, 'rejected')} style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '12px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', cursor: 'pointer', fontWeight: 500 }}>✗ Reject</button>
                                  <button onClick={() => recordOutcome(row.id, 'ignored')} style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '12px', background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 500 }}>— Ignore</button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── BROWSE TAB ── */}
      {tab === 'browse' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={browseQuery} onChange={(e) => setBrowseQuery(e.target.value)} placeholder="Search by customer ID…"
                style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <button onClick={() => loadAll(browseQuery)} style={{ ...btnSecondary, padding: '8px 14px' }}><RefreshCw size={13} /> Refresh</button>
            <button onClick={() => setTab('ingest')} style={{ ...btnPrimary, padding: '8px 14px' }}><Plus size={13} /> Add Profiles</button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading profiles…</div>
          ) : allProfiles.length === 0 ? (
            <div style={{ ...panel, padding: 48, textAlign: 'center' }}>
              <Database size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
              <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>No customer profiles yet</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>Seed demo data or ingest your own profiles via CSV or JSON.</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={seedSampleProfiles} style={btnSecondary}>+ Seed Sample Data</button>
                <button onClick={() => setTab('ingest')} style={btnPrimary}>Ingest Profiles</button>
              </div>
            </div>
          ) : (
            <div style={{ ...panel, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    {['Customer ID', 'Name', 'Segment', 'Status', 'Last Seen', 'Attributes', ''].map((h) => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allProfiles.map((p) => (
                    <tr key={p.id || p.customer_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 13, color: ACCENT, fontWeight: 600 }}>{p.customer_id}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)' }}>{(p.attributes?.name as string) ?? '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12 }}>
                        {p.attributes?.customer_segment ? <span style={{ background: ACCENT_SOFT, color: ACCENT, borderRadius: 12, padding: '2px 8px', fontSize: 11 }}>{p.attributes.customer_segment as string}</span> : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12 }}>
                        <span style={{ background: p.attributes?.account_status === 'active' ? '#e8f5e9' : 'var(--bg)', color: p.attributes?.account_status === 'active' ? '#2e7d32' : 'var(--text-muted)', borderRadius: 12, padding: '2px 8px', fontSize: 11 }}>{(p.attributes?.account_status as string) ?? 'unknown'}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(p.last_seen_at)}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{Object.keys(p.attributes || {}).length} fields</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => { setSearchId(p.customer_id); lookupProfile(p.customer_id); }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13 }}>View <ChevronRight size={13} /></button>
                          <button onClick={() => deleteProfileById(p.customer_id)} style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', padding: '5px 8px', color: '#dc2626', display: 'flex', alignItems: 'center' }}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>Showing {allProfiles.length} of {total} profiles</div>
            </div>
          )}
        </div>
      )}

      {/* ── SCHEMA TAB ── */}
      {tab === 'schema' && (
        <div style={{ ...panel, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, marginBottom: 3, color: 'var(--text-primary)' }}>Standard Attribute Schema</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>These attributes are recognised by the decision engine for eligibility rule evaluation. Additional custom fields are also stored and accessible.</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['Attribute', 'Type', 'Required', 'Description'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAR_SCHEMA.map((f) => (
                <tr key={f.field} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: ACCENT }}>{f.field}</td>
                  <td style={{ padding: '8px 12px', fontSize: 12 }}>
                    <span style={{ background: f.type === 'boolean' ? '#e8f5e9' : f.type === 'number' ? '#e3f2fd' : f.type === 'array' ? '#fff3e0' : '#f3e5f5', color: '#333', borderRadius: 4, padding: '1px 6px', fontSize: 11 }}>{f.type}</span>
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 12 }}>
                    {f.required && <span style={{ background: '#ffebee', color: '#c62828', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 600 }}>required</span>}
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{f.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── INGEST TAB ── */}
      {tab === 'ingest' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
          <div>
            <div style={{ ...panel, padding: 20, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 14, color: 'var(--text-primary)' }}>Ingestion Method</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['csv', 'manual'] as const).map((m) => (
                  <button key={m} onClick={() => { setIngestMode(m); setIngestStatus(null); }}
                    style={{ flex: 1, padding: '12px', borderRadius: 8, cursor: 'pointer', fontWeight: ingestMode === m ? 700 : 400,
                      border: ingestMode === m ? `2px solid ${ACCENT}` : '2px solid var(--border)',
                      background: ingestMode === m ? ACCENT_SOFT : 'var(--bg)',
                      color: ingestMode === m ? ACCENT : 'var(--text-primary)', fontSize: 13 }}>
                    {m === 'csv' ? '📄 CSV Upload' : '⚡ JSON / API'}
                  </button>
                ))}
              </div>
            </div>

            {ingestMode === 'csv' && (
              <div style={{ ...panel, padding: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 10, color: 'var(--text-primary)' }}>CSV Upload</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <button onClick={downloadSampleCSV} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}><Download size={12} /> Sample CSV</button>
                  <button onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}><Upload size={12} /> Browse File</button>
                  <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => previewCSV(ev.target?.result as string); r.readAsText(f); } }} />
                </div>
                <textarea value={csvText} onChange={(e) => previewCSV(e.target.value)}
                  placeholder={`Paste CSV here. First row = column headers:\n${SAMPLE_CSV.split('\n')[0]}`}
                  style={{ width: '100%', height: 160, padding: 10, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 11, fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }} />
                {csvPreview.length > 0 && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>✓ {csvPreview.length} row{csvPreview.length !== 1 ? 's' : ''} parsed</div>}
                <button onClick={ingestCSV} disabled={!csvPreview.length || ingestLoading}
                  style={{ marginTop: 12, width: '100%', padding: '10px', background: ACCENT, color: 'white', border: 'none', borderRadius: 6, cursor: csvPreview.length ? 'pointer' : 'not-allowed', fontWeight: 600, opacity: csvPreview.length ? 1 : 0.5, fontSize: 13 }}>
                  {ingestLoading ? 'Ingesting…' : `Ingest ${csvPreview.length} Profile${csvPreview.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            )}

            {ingestMode === 'manual' && (
              <div style={{ ...panel, padding: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 10, color: 'var(--text-primary)' }}>JSON / API Entry</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Paste a single profile object or an array of profiles.</div>
                <textarea value={manualJson} onChange={(e) => setManualJson(e.target.value)}
                  style={{ width: '100%', height: 140, padding: 10, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'monospace', resize: 'none', boxSizing: 'border-box' }} />
                <button onClick={ingestManual} disabled={ingestLoading}
                  style={{ marginTop: 12, width: '100%', padding: '10px', background: ACCENT, color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  {ingestLoading ? 'Ingesting…' : 'Ingest Profile(s)'}
                </button>
              </div>
            )}

            {ingestStatus && (
              <div style={{ ...panel, padding: 16, marginTop: 16, borderLeft: `3px solid ${ingestStatus.ok > 0 ? '#22c55e' : '#e53935'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: ingestStatus.errors.length ? 10 : 0 }}>
                  {ingestStatus.ok > 0 ? <CheckCircle2 size={16} color="#22c55e" /> : <AlertTriangle size={16} color="#e53935" />}
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{ingestStatus.ok > 0 ? `${ingestStatus.ok} profile${ingestStatus.ok !== 1 ? 's' : ''} ingested` : 'Ingestion failed'}</span>
                  {ingestStatus.ok > 0 && <button onClick={() => { setTab('browse'); }} style={{ marginLeft: 'auto', fontSize: 12, color: ACCENT, background: 'none', border: 'none', cursor: 'pointer' }}>View profiles →</button>}
                </div>
                {ingestStatus.errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: '#e53935', marginTop: 4 }}>✗ {e}</div>)}
              </div>
            )}
          </div>

          {/* API docs */}
          <div style={{ ...panel, padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 14, color: 'var(--text-primary)' }}>REST API</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>POST directly to the profile API for real-time or batch ingestion from your CDP, CRM, or data pipeline.</div>
            {[
              { method: 'POST', path: '/api/profile', desc: 'Upsert one or many profiles', body: `// Single\n{ "customerId": "cust-001", "attributes": { "age": 35 } }\n\n// Bulk (array of records, flat fields ok)\n{ "records": [{ "customer_id": "cust-001", "age": 35 }, ...] }` },
              { method: 'GET', path: '/api/profile?customerId=cust-001', desc: 'Fetch a profile + recent decisions', body: null },
              { method: 'GET', path: '/api/profile?list=true&q=cust&page=1&limit=50', desc: 'List with search + pagination', body: null },
              { method: 'DELETE', path: '/api/profile?customerId=cust-001', desc: 'Erase a profile (GDPR, permanent)', body: null },
            ].map(({ method, path, desc, body }) => (
              <div key={path + method} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: method === 'POST' ? '#e3f2fd' : method === 'DELETE' ? '#ffebee' : '#e8f5e9', color: method === 'POST' ? '#1565c0' : method === 'DELETE' ? '#c62828' : '#2e7d32' }}>{method}</span>
                  <code style={{ fontSize: 12, color: ACCENT }}>{path}</code>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: body ? 6 : 0 }}>{desc}</div>
                {body && <pre style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', fontSize: 11, fontFamily: 'monospace', margin: 0, overflowX: 'auto', color: 'var(--text-primary)' }}>{body}</pre>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Profile Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div style={{ ...panel, borderRadius: '14px', padding: '28px', width: '460px', maxWidth: '90vw' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Create Customer Profile</h2>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Customer ID *</label>
              <input value={createId} onChange={(e) => setCreateId(e.target.value)} placeholder="e.g. CUST-100"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={labelStyle}>Initial Attributes</div>
            {Object.keys(createAttrs).map((k) => (
              <div key={k} style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
                <div style={{ width: '140px', fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>{k}</div>
                <input value={createAttrs[k]} onChange={(e) => setCreateAttrs((prev) => ({ ...prev, [k]: e.target.value }))}
                  placeholder={k === 'age' ? '34' : k === 'income_band' ? 'high / medium / low' : k === 'product_interest' ? 'mortgage / savings…' : 'mobile / email / web'}
                  style={{ flex: 1, padding: '7px 10px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowCreate(false); setCreateId(''); }} style={{ ...btnSecondary }}>Cancel</button>
              <button onClick={createProfile} disabled={createLoading || !createId.trim()}
                style={{ ...btnPrimary, opacity: createLoading || !createId.trim() ? 0.7 : 1, cursor: createLoading || !createId.trim() ? 'not-allowed' : 'pointer' }}>
                {createLoading ? 'Creating…' : 'Create Profile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' };
const miniInput: React.CSSProperties = { flex: 1, padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' };
const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: ACCENT, color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 500 };
const btnSecondary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: 'var(--bg-panel)', color: 'var(--text-primary)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '14px', fontWeight: 500 };
