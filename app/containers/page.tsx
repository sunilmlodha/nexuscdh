'use client';

import { useState, useEffect, useCallback } from 'react';
import { Boxes, Plus, X, Trash2, Edit2, Play, Globe, Smartphone, Phone, Mail } from 'lucide-react';

const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';
const panel: React.CSSProperties = { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12 };
const input: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' };

const CHANNELS = [
  { key: 'web', label: 'Web', icon: <Globe size={13} /> },
  { key: 'mobile', label: 'Mobile', icon: <Smartphone size={13} /> },
  { key: 'contact_center', label: 'Contact Center', icon: <Phone size={13} /> },
  { key: 'email', label: 'Email', icon: <Mail size={13} /> },
];

interface Container { id: string; name: string; description?: string; channel: string; placement?: string; strategy_ids: string[]; max_actions: number; status: string; }
interface Strategy { id: string; name: string; }

const empty = (): Partial<Container> => ({ name: '', description: '', channel: 'web', placement: '', strategy_ids: [], max_actions: 3, status: 'active' });

export default function ContainersPage() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Partial<Container>>(empty());
  const [saving, setSaving] = useState(false);

  // test console
  const [testName, setTestName] = useState('');
  const [testCustomer, setTestCustomer] = useState('CUST-001');
  const [testResult, setTestResult] = useState<unknown>(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [c, s] = await Promise.all([
        fetch(`/api/containers?tenantId=${TENANT_ID}`).then(r => r.json()),
        fetch(`/api/strategies?tenantId=${TENANT_ID}`).then(r => r.json()),
      ]);
      if (c.configured === false) setError('Supabase not configured.');
      else setContainers(c.data ?? []);
      setStrategies(s.data ?? []);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!form.name?.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/containers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tenantId: TENANT_ID, actor: 'containers-ui' }),
      });
      setModal(false); setForm(empty()); load();
    } finally { setSaving(false); }
  }

  async function del(id: string) {
    await fetch(`/api/containers?id=${id}&tenantId=${TENANT_ID}`, { method: 'DELETE' });
    load();
  }

  async function runTest() {
    if (!testName) return;
    setTesting(true); setTestResult(null);
    try {
      const res = await fetch(`/api/v4/containers/${encodeURIComponent(testName)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: { customer: { CustomerID: testCustomer } }, tenantId: TENANT_ID, maxActions: 5 }),
      });
      setTestResult(await res.json());
    } catch (e: unknown) { setTestResult({ error: e instanceof Error ? e.message : 'Failed' }); }
    finally { setTesting(false); }
  }

  const stratName = (id: string) => strategies.find(s => s.id === id)?.name ?? id.slice(0, 8);

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Boxes size={24} color="var(--brand-accent)" />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Decision Endpoints</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Named inbound decision endpoints (V4-compatible) for web, mobile, and contact-centre placements.</p>
          </div>
        </div>
        <button onClick={() => { setForm(empty()); setModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'var(--brand-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          <Plus size={14} /> New Container
        </button>
      </div>

      {error && <div style={{ ...panel, padding: 16, marginTop: 16, borderLeft: '3px solid #ef4444', fontSize: 13, color: 'var(--text-secondary)' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18, marginTop: 20, alignItems: 'start' }}>
        {/* Container list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? <div style={{ color: 'var(--text-muted)', padding: 20 }}>Loading…</div> :
            containers.length === 0 ? <div style={{ ...panel, padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No containers yet. Create one to expose a named NBA endpoint.</div> :
            containers.map(c => {
              const ch = CHANNELS.find(x => x.key === c.channel);
              return (
                <div key={c.id} style={{ ...panel, padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 16, background: 'rgba(99,102,241,0.1)', color: 'var(--brand-accent)', fontSize: 11, fontWeight: 600 }}>{ch?.icon}{ch?.label ?? c.channel}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 16, fontSize: 11, fontWeight: 600, background: c.status === 'active' ? '#dcfce7' : 'var(--bg)', color: c.status === 'active' ? '#15803d' : 'var(--text-muted)' }}>{c.status}</span>
                      </div>
                      {c.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{c.description}</div>}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontFamily: 'monospace' }}>POST /api/v4/containers/{c.name}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => { setTestName(c.name); }} title="Load into tester" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-accent)', padding: 4 }}><Play size={14} /></button>
                      <button onClick={() => { setForm(c); setModal(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><Edit2 size={13} /></button>
                      <button onClick={() => del(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(c.strategy_ids ?? []).length === 0
                      ? <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>All active strategies · top {c.max_actions}</span>
                      : <>
                          {c.strategy_ids.map(id => <span key={id} style={{ padding: '2px 8px', borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 11, color: 'var(--text-secondary)' }}>{stratName(id)}</span>)}
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· top {c.max_actions}</span>
                        </>}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Test console */}
        <div style={{ ...panel, padding: 18, position: 'sticky', top: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><Play size={15} color="var(--brand-accent)" /><span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Test Console</span></div>
          <label style={lbl}>Container name</label>
          <input value={testName} onChange={e => setTestName(e.target.value)} placeholder="e.g. PrimaryContainer" style={input} />
          <label style={{ ...lbl, marginTop: 10 }}>Customer ID</label>
          <input value={testCustomer} onChange={e => setTestCustomer(e.target.value)} style={input} />
          <button onClick={runTest} disabled={testing || !testName} style={{ marginTop: 12, width: '100%', padding: 9, borderRadius: 8, background: 'var(--brand-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: testing || !testName ? 0.6 : 1 }}>{testing ? 'Calling…' : 'Call Container'}</button>
          {testResult != null && (
            <pre style={{ marginTop: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 11, fontFamily: 'monospace', color: 'var(--text-primary)', maxHeight: 320, overflow: 'auto' }}>{JSON.stringify(testResult, null, 2)}</pre>
          )}
        </div>
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{ ...panel, padding: 28, width: 540, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{form.id ? 'Edit' : 'New'} Container</h2>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div><label style={lbl}>Name * (URL-safe)</label><input value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={input} placeholder="PrimaryContainer" /></div>
              <div><label style={lbl}>Channel</label>
                <select value={form.channel ?? 'web'} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} style={input}>{CHANNELS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select></div>
              <div><label style={lbl}>Placement</label><input value={form.placement ?? ''} onChange={e => setForm(f => ({ ...f, placement: e.target.value }))} style={input} placeholder="homepage_hero" /></div>
              <div><label style={lbl}>Max actions</label><input type="number" value={form.max_actions ?? 3} onChange={e => setForm(f => ({ ...f, max_actions: Number(e.target.value) }))} style={input} /></div>
              <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Description</label><input value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={input} /></div>
            </div>
            <label style={{ ...lbl, marginTop: 14 }}>Strategies (none selected = all active)</label>
            <div style={{ border: '1px solid var(--border)', borderRadius: 6, maxHeight: 160, overflowY: 'auto', padding: 8 }}>
              {strategies.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No strategies.</div> : strategies.map(s => (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={(form.strategy_ids ?? []).includes(s.id)} onChange={e => {
                    const ids = form.strategy_ids ?? [];
                    setForm(f => ({ ...f, strategy_ids: e.target.checked ? [...ids, s.id] : ids.filter(x => x !== s.id) }));
                  }} />
                  <span style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setModal(false)} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={save} disabled={saving || !form.name?.trim()} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: 'var(--brand-accent)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving || !form.name?.trim() ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 };
