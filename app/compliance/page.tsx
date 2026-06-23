'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Search, Check, X, Download, Trash2, FileText } from 'lucide-react';

const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';
const panel: React.CSSProperties = { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12 };
const input: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' };

interface Consent { id: string; customer_id: string; purpose: string; granted: boolean; source?: string; created_at: string; }
interface Dsar { id: string; customer_id: string; type: string; status: string; requested_by?: string; created_at: string; }

export default function CompliancePage() {
  const [tab, setTab] = useState<'consent' | 'dsar'>('consent');
  const [customer, setCustomer] = useState('');
  const [consent, setConsent] = useState<Consent[]>([]);
  const [dsar, setDsar] = useState<Dsar[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const loadDsar = useCallback(async () => {
    const r = await fetch(`/api/dsar?tenantId=${TENANT_ID}`).then(x => x.json());
    if (r.error) setErr(r.error.includes('dsar_requests') ? 'Run migration 0004_consent.sql to enable compliance.' : r.error);
    else setDsar(r.data ?? []);
  }, []);
  useEffect(() => { loadDsar(); }, [loadDsar]);

  async function lookupConsent() {
    if (!customer.trim()) return;
    setErr('');
    const r = await fetch(`/api/consent?customerId=${encodeURIComponent(customer)}&tenantId=${TENANT_ID}`).then(x => x.json());
    if (r.error) setErr(r.error.includes('consent_records') ? 'Run migration 0004_consent.sql to enable compliance.' : r.error);
    else setConsent(r.data ?? []);
  }
  async function recordConsent(granted: boolean) {
    if (!customer.trim()) return;
    setBusy(true);
    await fetch('/api/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: TENANT_ID, customerId: customer, purpose: 'marketing', granted, source: 'preference_centre' }) });
    setBusy(false); lookupConsent();
  }
  async function dsarAction(type: 'export' | 'erasure') {
    if (!customer.trim()) return;
    if (type === 'erasure' && !confirm(`Permanently erase all data for ${customer}? This cannot be undone.`)) return;
    setBusy(true); setNote('');
    const r = await fetch('/api/dsar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: TENANT_ID, customerId: customer, type }) }).then(x => x.json());
    setBusy(false);
    if (type === 'export' && r.export) {
      const blob = new Blob([JSON.stringify(r.export, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${customer}-data-export.json`; a.click();
      setNote(`Exported data for ${customer}.`);
    } else if (type === 'erasure') setNote(r.ok ? `Erased ${customer} (+${r.deletedDecisions ?? 0} decisions).` : (r.error ?? 'Failed'));
    loadDsar();
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <ShieldCheck size={24} color="var(--brand-accent)" />
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Compliance &amp; Data Governance</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Consent ledger and GDPR data-subject requests (export / right to erasure).</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, margin: '18px 0', borderBottom: '1px solid var(--border)' }}>
        {([['consent', 'Consent ledger'], ['dsar', 'Data requests (DSAR)']] as const).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: tab === t ? 700 : 500, color: tab === t ? 'var(--brand-accent)' : 'var(--text-muted)', borderBottom: tab === t ? '2px solid var(--brand-accent)' : '2px solid transparent', marginBottom: -1 }}>{l}</button>
        ))}
      </div>

      {err && <div style={{ ...panel, padding: 16, borderLeft: '3px solid #ef4444', fontSize: 13, color: 'var(--text-secondary)' }}>{err}</div>}
      {note && <div style={{ ...panel, padding: '8px 14px', marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)' }}>{note}</div>}

      {/* Customer lookup (shared) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={customer} onChange={e => setCustomer(e.target.value)} onKeyDown={e => e.key === 'Enter' && lookupConsent()} placeholder="Customer ID (e.g. CUST-001)" style={{ ...input, width: '100%', paddingLeft: 32 }} />
        </div>
        {tab === 'consent' && <button onClick={lookupConsent} style={btn}>Look up</button>}
      </div>

      {tab === 'consent' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button onClick={() => recordConsent(true)} disabled={busy || !customer} style={{ ...btn, borderColor: '#22c55e', color: '#15803d' }}><Check size={13} /> Record consent granted</button>
            <button onClick={() => recordConsent(false)} disabled={busy || !customer} style={{ ...btn, borderColor: '#ef4444', color: '#b91c1c' }}><X size={13} /> Record withdrawn</button>
          </div>
          <div style={{ ...panel, overflow: 'hidden' }}>
            {consent.length === 0 ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>{customer ? 'No consent records for this customer.' : 'Look up a customer to see their consent history.'}</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: 'var(--bg)' }}>{['When', 'Purpose', 'State', 'Source'].map(h => <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {consent.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 14px', color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleString()}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--text-primary)' }}>{c.purpose}</td>
                      <td style={{ padding: '9px 14px' }}><span style={{ color: c.granted ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{c.granted ? 'granted' : 'withdrawn'}</span></td>
                      <td style={{ padding: '9px 14px', color: 'var(--text-muted)' }}>{c.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'dsar' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button onClick={() => dsarAction('export')} disabled={busy || !customer} style={btn}><Download size={13} /> Export data</button>
            <button onClick={() => dsarAction('erasure')} disabled={busy || !customer} style={{ ...btn, borderColor: '#ef4444', color: '#b91c1c' }}><Trash2 size={13} /> Erase (right to be forgotten)</button>
          </div>
          <div style={{ ...panel, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={15} /> Request log</div>
            {dsar.length === 0 ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No data-subject requests yet.</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  {dsar.map(d => (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: 'var(--brand-accent)' }}>{d.customer_id}</td>
                      <td style={{ padding: '9px 14px', textTransform: 'capitalize', color: 'var(--text-primary)' }}>{d.type}</td>
                      <td style={{ padding: '9px 14px', color: '#16a34a' }}>{d.status}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--text-muted)' }}>{d.requested_by}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--text-muted)' }}>{new Date(d.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const btn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 };
