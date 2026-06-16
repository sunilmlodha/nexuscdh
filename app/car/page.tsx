'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Database, Upload, Plus, Trash2, Search, Eye, Download,
  RefreshCw, CheckCircle, AlertCircle, FileText, User, ChevronDown, ChevronUp,
} from 'lucide-react';

interface Profile {
  customer_id: string;
  tenant_id: string;
  attributes: Record<string, unknown>;
  last_seen_at: string;
  updated_at: string;
}

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

export default function CARPage() {
  const [profiles, setProfiles]   = useState<Profile[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState('');
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [tab, setTab]             = useState<'profiles' | 'schema' | 'ingest'>('profiles');
  const [ingestMode, setIngestMode] = useState<'csv' | 'manual'>('csv');
  const [csvText, setCsvText]     = useState('');
  const [csvPreview, setCsvPreview] = useState<Record<string, unknown>[]>([]);
  const [ingestStatus, setIngestStatus] = useState<{ ok: number; errors: string[] } | null>(null);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [manualJson, setManualJson] = useState('{\n  "customer_id": "cust-new",\n  "name": "New Customer",\n  "age": 30,\n  "customer_segment": "mass_market",\n  "account_status": "active",\n  "consent": true\n}');
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadProfiles() {
    setLoading(true);
    try {
      const q = search ? `&q=${encodeURIComponent(search)}` : '';
      const res = await fetch(`/api/car?limit=20${q}`);
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProfiles(); }, [search]);

  async function deleteProfile(id: string) {
    if (!confirm(`Delete profile ${id}?`)) return;
    await fetch(`/api/car?id=${id}`, { method: 'DELETE' });
    loadProfiles();
  }

  function previewCSV(text: string) {
    setCsvText(text);
    try { setCsvPreview(parseCSV(text)); } catch { setCsvPreview([]); }
  }

  async function ingestCSV() {
    if (!csvPreview.length) return;
    setIngestLoading(true);
    try {
      const res = await fetch('/api/car', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(csvPreview),
      });
      const data = await res.json();
      setIngestStatus(data);
      if (data.ok > 0) loadProfiles();
    } finally {
      setIngestLoading(false);
    }
  }

  async function ingestManual() {
    let parsed: unknown;
    try { parsed = JSON.parse(manualJson); }
    catch { setIngestStatus({ ok: 0, errors: ['Invalid JSON'] }); return; }
    setIngestLoading(true);
    try {
      const res = await fetch('/api/car', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      setIngestStatus(data);
      if (data.ok > 0) loadProfiles();
    } finally {
      setIngestLoading(false);
    }
  }

  function downloadSampleCSV() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'car_sample.csv';
    a.click();
  }

  const schemaField = (f: typeof CAR_SCHEMA[0]) => (
    <tr key={f.field} style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)' }}>{f.field}</td>
      <td style={{ padding: '8px 12px', fontSize: 12 }}>
        <span style={{ background: f.type === 'boolean' ? '#e8f5e9' : f.type === 'number' ? '#e3f2fd' : f.type === 'array' ? '#fff3e0' : '#f3e5f5', color: '#333', borderRadius: 4, padding: '1px 6px', fontSize: 11 }}>
          {f.type}
        </span>
      </td>
      <td style={{ padding: '8px 12px', fontSize: 12 }}>
        {f.required && <span style={{ background: '#ffebee', color: '#c62828', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 600 }}>required</span>}
      </td>
      <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{f.description}</td>
    </tr>
  );

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Database size={22} style={{ color: 'var(--accent)' }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Customer Attribute Repository</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          The CAR is the central store of all customer attributes used by the decision engine for eligibility evaluation,
          propensity scoring, and personalisation. Ingest data via CSV upload, JSON API, or manual entry.
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total Profiles', value: total, icon: User },
          { label: 'Schema Attributes', value: CAR_SCHEMA.length, icon: FileText },
          { label: 'Ingest Methods', value: 3, icon: Upload },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="card" style={{ flex: 1, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(var(--accent-rgb),0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={16} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {(['profiles', 'schema', 'ingest'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '8px 18px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: tab === t ? 700 : 400, color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              textTransform: 'capitalize', fontSize: 14 }}>
            {t === 'profiles' ? 'Customer Profiles' : t === 'schema' ? 'Attribute Schema' : 'Data Ingestion'}
          </button>
        ))}
      </div>

      {/* ── Profiles tab ── */}
      {tab === 'profiles' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by customer ID…"
                style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 13 }} />
            </div>
            <button onClick={loadProfiles} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: 13 }}>
              <RefreshCw size={13} /> Refresh
            </button>
            <button onClick={() => setTab('ingest')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <Plus size={13} /> Add Profiles
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading profiles…</div>
          ) : profiles.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: 'center' }}>
              <Database size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
              <div style={{ fontWeight: 600, marginBottom: 8 }}>No customer profiles yet</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
                Seed demo data or ingest your own profiles via CSV or JSON.
              </div>
              <button onClick={() => setTab('ingest')} style={{ padding: '9px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                Ingest Profiles
              </button>
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {['Customer ID', 'Name', 'Segment', 'Account Status', 'Last Seen', 'Attributes', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {profiles.map(p => (
                    <>
                      <tr key={p.customer_id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>{p.customer_id}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13 }}>{(p.attributes.name as string) ?? '—'}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12 }}>
                          {p.attributes.customer_segment
                            ? <span style={{ background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)', borderRadius: 12, padding: '2px 8px', fontSize: 11 }}>{p.attributes.customer_segment as string}</span>
                            : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12 }}>
                          <span style={{ background: p.attributes.account_status === 'active' ? '#e8f5e9' : '#ffebee', color: p.attributes.account_status === 'active' ? '#2e7d32' : '#c62828', borderRadius: 12, padding: '2px 8px', fontSize: 11 }}>
                            {(p.attributes.account_status as string) ?? 'unknown'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{new Date(p.last_seen_at).toLocaleDateString()}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{Object.keys(p.attributes).length} fields</td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => setExpanded(expanded === p.customer_id ? null : p.customer_id)}
                              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', padding: '4px 8px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                              <Eye size={11} />
                              {expanded === p.customer_id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            </button>
                            <button onClick={() => deleteProfile(p.customer_id)}
                              style={{ background: 'none', border: '1px solid #ffcdd2', borderRadius: 5, cursor: 'pointer', padding: '4px 8px', color: '#e53935', display: 'flex', alignItems: 'center' }}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded === p.customer_id && (
                        <tr key={`${p.customer_id}-expanded`} style={{ background: 'var(--bg-secondary)' }}>
                          <td colSpan={7} style={{ padding: '12px 24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                              {Object.entries(p.attributes).map(([k, v]) => (
                                <div key={k} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px' }}>
                                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>{k}</div>
                                  <div style={{ fontSize: 13, fontWeight: 500, fontFamily: typeof v === 'object' ? 'monospace' : undefined }}>
                                    {typeof v === 'boolean' ? (v ? '✓ true' : '✗ false') : Array.isArray(v) ? v.join(', ') : String(v ?? '—')}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                Showing {profiles.length} of {total} profiles
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Schema tab ── */}
      {tab === 'schema' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 3 }}>Standard Attribute Schema</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                These attributes are recognised by the decision engine for eligibility rule evaluation.
                Additional custom fields are also stored and accessible.
              </div>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                {['Attribute', 'Type', 'Required', 'Description'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>{CAR_SCHEMA.map(schemaField)}</tbody>
          </table>
        </div>
      )}

      {/* ── Ingest tab ── */}
      {tab === 'ingest' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
          {/* Left panel — mode selector */}
          <div>
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 14 }}>Ingestion Method</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['csv', 'manual'] as const).map(m => (
                  <button key={m} onClick={() => { setIngestMode(m); setIngestStatus(null); }}
                    style={{ flex: 1, padding: '12px', borderRadius: 8, cursor: 'pointer', fontWeight: ingestMode === m ? 700 : 400,
                      border: ingestMode === m ? '2px solid var(--accent)' : '2px solid var(--border)',
                      background: ingestMode === m ? 'rgba(var(--accent-rgb),0.05)' : 'var(--bg)',
                      color: ingestMode === m ? 'var(--accent)' : 'var(--text-primary)', fontSize: 13 }}>
                    {m === 'csv' ? '📄 CSV Upload' : '⚡ JSON / API'}
                  </button>
                ))}
              </div>
            </div>

            {ingestMode === 'csv' && (
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 10 }}>CSV Upload</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <button onClick={downloadSampleCSV} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
                    <Download size={12} /> Sample CSV
                  </button>
                  <button onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
                    <Upload size={12} /> Browse File
                  </button>
                  <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) { const r = new FileReader(); r.onload = ev => previewCSV(ev.target?.result as string); r.readAsText(f); }
                    }} />
                </div>
                <textarea value={csvText} onChange={e => previewCSV(e.target.value)}
                  placeholder={`Paste CSV here, or use the first row as column headers:\n${SAMPLE_CSV.split('\n')[0]}`}
                  style={{ width: '100%', height: 160, padding: 10, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 11, fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }} />
                {csvPreview.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                    ✓ {csvPreview.length} row{csvPreview.length !== 1 ? 's' : ''} parsed
                  </div>
                )}
                <button onClick={ingestCSV} disabled={!csvPreview.length || ingestLoading}
                  style={{ marginTop: 12, width: '100%', padding: '10px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, cursor: csvPreview.length ? 'pointer' : 'not-allowed', fontWeight: 600, opacity: csvPreview.length ? 1 : 0.5, fontSize: 13 }}>
                  {ingestLoading ? 'Ingesting…' : `Ingest ${csvPreview.length} Profile${csvPreview.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            )}

            {ingestMode === 'manual' && (
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 10 }}>JSON / API Entry</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                  Paste a single profile object or an array of profiles.
                </div>
                <textarea value={manualJson} onChange={e => setManualJson(e.target.value)}
                  style={{ width: '100%', height: 140, padding: 10, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'monospace', resize: 'none', boxSizing: 'border-box' }} />
                <button onClick={ingestManual} disabled={ingestLoading}
                  style={{ marginTop: 12, width: '100%', padding: '10px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  {ingestLoading ? 'Ingesting…' : 'Ingest Profile(s)'}
                </button>
              </div>
            )}

            {ingestStatus && (
              <div className="card" style={{ padding: 16, marginTop: 16, borderLeft: `3px solid ${ingestStatus.ok > 0 ? 'var(--success)' : '#e53935'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: ingestStatus.errors.length ? 10 : 0 }}>
                  {ingestStatus.ok > 0
                    ? <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                    : <AlertCircle size={16} style={{ color: '#e53935' }} />}
                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                    {ingestStatus.ok > 0 ? `${ingestStatus.ok} profile${ingestStatus.ok !== 1 ? 's' : ''} ingested` : 'Ingestion failed'}
                  </span>
                </div>
                {ingestStatus.errors.map((e, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#e53935', marginTop: 4 }}>✗ {e}</div>
                ))}
              </div>
            )}
          </div>

          {/* Right panel — API docs */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 14 }}>REST API</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              POST directly to the CAR API for real-time or batch ingestion from your CDP, CRM, or data pipeline.
            </div>
            {[
              {
                method: 'POST', path: '/api/car',
                desc: 'Upsert one or more profiles',
                body: `// Single profile\n{ "customer_id": "cust-001", "age": 35, "has_mortgage": true }\n\n// Array of profiles\n[{ "customer_id": "cust-001", ... }, { "customer_id": "cust-002", ... }]`,
              },
              {
                method: 'GET', path: '/api/car?id=cust-001',
                desc: 'Fetch a single profile',
                body: null,
              },
              {
                method: 'GET', path: '/api/car?page=1&limit=20&q=cust',
                desc: 'List profiles with pagination + search',
                body: null,
              },
              {
                method: 'DELETE', path: '/api/car?id=cust-001',
                desc: 'Delete a profile',
                body: null,
              },
            ].map(({ method, path, desc, body }) => (
              <div key={path + method} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: method === 'POST' ? '#e3f2fd' : method === 'DELETE' ? '#ffebee' : '#e8f5e9', color: method === 'POST' ? '#1565c0' : method === 'DELETE' ? '#c62828' : '#2e7d32' }}>
                    {method}
                  </span>
                  <code style={{ fontSize: 12, color: 'var(--accent)' }}>{path}</code>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: body ? 6 : 0 }}>{desc}</div>
                {body && (
                  <pre style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', fontSize: 11, fontFamily: 'monospace', margin: 0, overflowX: 'auto', color: 'var(--text-primary)' }}>
                    {body}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
