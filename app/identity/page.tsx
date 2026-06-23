'use client';

import { useState, useEffect, useCallback } from 'react';
import { Fingerprint, Search, Link2, GitMerge, Mail, Phone, Smartphone, Globe, Cookie } from 'lucide-react';

const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';
const TYPES = ['email', 'phone', 'device', 'external', 'cookie'];
const panel: React.CSSProperties = { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12 };
const input: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 };
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'var(--brand-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 };

const TYPE_ICON: Record<string, React.ReactNode> = {
  email: <Mail size={13} />, phone: <Phone size={13} />, device: <Smartphone size={13} />, external: <Globe size={13} />, cookie: <Cookie size={13} />,
};

interface Alias { id: string; customer_id: string; alias_type: string; alias_value: string; created_at: string; }

export default function IdentityPage() {
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('');
  const [link, setLink] = useState({ customerId: '', aliasType: 'email', aliasValue: '' });
  const [merge, setMerge] = useState({ from: '', to: '' });
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const r = await fetch(`/api/identity?tenantId=${TENANT_ID}`).then(x => x.json());
      if (r.error) setErr(r.error.includes('identity_aliases') ? 'Run migration 0006_identity.sql to enable identity resolution.' : r.error);
      else setAliases(r.data ?? []);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Failed'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function doLink() {
    if (!link.customerId || !link.aliasValue) return;
    const r = await fetch('/api/identity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(link) }).then(x => x.json());
    setMsg(r.error ? `Error: ${r.error}` : `Linked ${link.aliasType}:${link.aliasValue}`);
    setLink({ customerId: '', aliasType: 'email', aliasValue: '' }); load();
  }
  async function doMerge() {
    if (!merge.from || !merge.to) return;
    const r = await fetch('/api/identity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'merge', fromCustomerId: merge.from, toCustomerId: merge.to }) }).then(x => x.json());
    setMsg(r.error ? `Error: ${r.error}` : `Merged ${merge.from} → ${merge.to}`);
    setMerge({ from: '', to: '' }); load();
  }

  // group aliases by canonical customer
  const byCustomer: Record<string, Alias[]> = {};
  for (const a of aliases) {
    if (filter && !a.customer_id.includes(filter) && !a.alias_value.toLowerCase().includes(filter.toLowerCase())) continue;
    (byCustomer[a.customer_id] ??= []).push(a);
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Fingerprint size={24} color="var(--brand-accent)" />
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Identity Resolution</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Stitch emails, devices, phones, and external keys into one canonical customer (CDP).</p>
        </div>
      </div>

      {msg && <div style={{ ...panel, padding: 12, marginTop: 14, borderLeft: '3px solid var(--brand-accent)', fontSize: 13, color: 'var(--text-secondary)' }}>{msg}</div>}
      {err && <div style={{ ...panel, padding: 16, marginTop: 14, borderLeft: '3px solid #ef4444', fontSize: 13, color: 'var(--text-secondary)' }}>{err}</div>}

      {/* actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
        <div style={{ ...panel, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}><Link2 size={15} /> Link identifier</div>
          <label style={lbl}>Canonical customer ID</label>
          <input value={link.customerId} onChange={e => setLink(l => ({ ...l, customerId: e.target.value }))} placeholder="cust_123" style={input} />
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, marginTop: 10 }}>
            <div><label style={lbl}>Type</label><select value={link.aliasType} onChange={e => setLink(l => ({ ...l, aliasType: e.target.value }))} style={input}>{TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label style={lbl}>Value</label><input value={link.aliasValue} onChange={e => setLink(l => ({ ...l, aliasValue: e.target.value }))} placeholder="user@example.com" style={input} /></div>
          </div>
          <button onClick={doLink} disabled={!link.customerId || !link.aliasValue} style={{ ...btn, marginTop: 14, opacity: link.customerId && link.aliasValue ? 1 : 0.6 }}><Link2 size={14} /> Link</button>
        </div>

        <div style={{ ...panel, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}><GitMerge size={15} /> Merge profiles</div>
          <label style={lbl}>From (absorbed)</label>
          <input value={merge.from} onChange={e => setMerge(m => ({ ...m, from: e.target.value }))} placeholder="duplicate cust_456" style={input} />
          <label style={{ ...lbl, marginTop: 10 }}>Into (survivor)</label>
          <input value={merge.to} onChange={e => setMerge(m => ({ ...m, to: e.target.value }))} placeholder="canonical cust_123" style={input} />
          <button onClick={doMerge} disabled={!merge.from || !merge.to} style={{ ...btn, marginTop: 14, background: '#f59e0b', opacity: merge.from && merge.to ? 1 : 0.6 }}><GitMerge size={14} /> Merge</button>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>Repoints aliases + decisions, then drops the absorbed profile.</p>
        </div>
      </div>

      {/* identity graph */}
      <div style={{ ...panel, padding: 18, marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Identity graph <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>· {Object.keys(byCustomer).length} customers · {aliases.length} aliases</span></div>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 9, top: 9, color: 'var(--text-muted)' }} />
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="filter by id or value" style={{ ...input, width: 220, paddingLeft: 28 }} />
          </div>
        </div>
        {Object.keys(byCustomer).length === 0 ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No linked identities yet.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(byCustomer).map(([cid, list]) => (
              <div key={cid} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{cid}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {list.map(a => (
                    <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 16, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--brand-accent)' }}>{TYPE_ICON[a.alias_type] ?? <Globe size={13} />}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{a.alias_type}</span>
                      <span style={{ fontFamily: 'monospace' }}>{a.alias_value}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
