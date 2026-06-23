'use client';

import { useState, useEffect, useCallback } from 'react';
import { Boxes, Plus, X, Crown, Eye, Archive, GitBranch } from 'lucide-react';

const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';
const ALGOS = ['logistic_regression', 'gradient_boosting', 'neural_net', 'bayesian'];
const panel: React.CSSProperties = { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12 };
const input: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 };

interface Version { id: string; action_id: string; action_name?: string; algorithm: string; version: number; status: string; auc?: number; lift?: number; samples: number; promoted_at?: string; created_at: string; }
interface ActionRef { id: string; name: string; }

const STATUS: Record<string, { color: string; icon: React.ReactNode }> = {
  training:  { color: '#6b7280', icon: <GitBranch size={13} /> },
  shadow:    { color: '#3b82f6', icon: <Eye size={13} /> },
  champion:  { color: '#22c55e', icon: <Crown size={13} /> },
  retired:   { color: '#9ca3af', icon: <Archive size={13} /> },
};

export default function ModelOpsPage() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [actions, setActions] = useState<ActionRef[]>([]);
  const [err, setErr] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ action_id: '', algorithm: 'logistic_regression', auc: '', lift: '', samples: '', notes: '' });

  const load = useCallback(async () => {
    setErr('');
    try {
      const [m, h] = await Promise.all([
        fetch(`/api/model-registry?tenantId=${TENANT_ID}`).then(r => r.json()),
        fetch(`/api/hydrate?tenantId=${TENANT_ID}`).then(r => r.json()),
      ]);
      if (m.error) setErr(m.error.includes('model_versions') ? 'Run migration 0005_model_registry.sql to enable the model registry.' : m.error);
      else setVersions(m.data ?? []);
      setActions((h.actions ?? []).map((a: { id: string; name: string }) => ({ id: a.id, name: a.name })));
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Failed'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function transition(id: string, action: string) {
    await fetch('/api/model-registry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, tenantId: TENANT_ID }) });
    load();
  }
  async function register() {
    if (!form.action_id) return;
    const a = actions.find(x => x.id === form.action_id);
    await fetch('/api/model-registry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      tenantId: TENANT_ID, action_id: form.action_id, action_name: a?.name, algorithm: form.algorithm,
      auc: form.auc ? Number(form.auc) : null, lift: form.lift ? Number(form.lift) : null, samples: form.samples ? Number(form.samples) : 0, notes: form.notes,
    }) });
    setModal(false); setForm({ action_id: '', algorithm: 'logistic_regression', auc: '', lift: '', samples: '', notes: '' }); load();
  }

  // group by action
  const byAction: Record<string, Version[]> = {};
  for (const v of versions) { (byAction[v.action_name || v.action_id] ??= []).push(v); }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Boxes size={24} color="var(--brand-accent)" />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Model Ops</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Versioned models with a champion / challenger lifecycle and offline metrics.</p>
          </div>
        </div>
        <button onClick={() => setModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'var(--brand-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}><Plus size={14} /> Register version</button>
      </div>

      {err && <div style={{ ...panel, padding: 16, marginTop: 16, borderLeft: '3px solid #ef4444', fontSize: 13, color: 'var(--text-secondary)' }}>{err}</div>}

      {!err && Object.keys(byAction).length === 0 ? <div style={{ ...panel, padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 16 }}>No model versions yet. Register one against an action to start tracking its lifecycle.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
          {Object.entries(byAction).map(([name, vs]) => (
            <div key={name} style={{ ...panel, padding: 18 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>{name}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr>{['Version', 'Algorithm', 'AUC', 'Lift', 'Samples', 'Status', ''].map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {vs.sort((a, b) => b.version - a.version).map(v => {
                    const s = STATUS[v.status];
                    return (
                      <tr key={v.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>v{v.version}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>{v.algorithm}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{v.auc != null ? v.auc.toFixed(3) : '—'}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{v.lift != null ? `${v.lift > 0 ? '+' : ''}${Math.round(v.lift * 100)}%` : '—'}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{v.samples.toLocaleString()}</td>
                        <td style={{ padding: '8px 10px' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 16, background: `${s.color}22`, color: s.color, fontSize: 11, fontWeight: 600 }}>{s.icon}{v.status}</span></td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 4 }}>
                            {v.status !== 'champion' && <button onClick={() => transition(v.id, 'promote')} title="Promote to champion" style={miniBtn('#22c55e')}><Crown size={12} /></button>}
                            {v.status === 'retired' && <button onClick={() => transition(v.id, 'shadow')} title="Re-enable as shadow" style={miniBtn('#3b82f6')}><Eye size={12} /></button>}
                            {v.status !== 'retired' && <button onClick={() => transition(v.id, 'retire')} title="Retire" style={miniBtn('#9ca3af')}><Archive size={12} /></button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{ ...panel, padding: 26, width: 460, maxWidth: '92vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Register Model Version</h2>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <label style={lbl}>Action</label>
            <select value={form.action_id} onChange={e => setForm(f => ({ ...f, action_id: e.target.value }))} style={input}>
              <option value="">— select —</option>
              {actions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <label style={{ ...lbl, marginTop: 12 }}>Algorithm</label>
            <select value={form.algorithm} onChange={e => setForm(f => ({ ...f, algorithm: e.target.value }))} style={input}>{ALGOS.map(a => <option key={a} value={a}>{a}</option>)}</select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 12 }}>
              <div><label style={lbl}>AUC</label><input value={form.auc} onChange={e => setForm(f => ({ ...f, auc: e.target.value }))} placeholder="0.82" style={input} /></div>
              <div><label style={lbl}>Lift</label><input value={form.lift} onChange={e => setForm(f => ({ ...f, lift: e.target.value }))} placeholder="0.15" style={input} /></div>
              <div><label style={lbl}>Samples</label><input value={form.samples} onChange={e => setForm(f => ({ ...f, samples: e.target.value }))} placeholder="50000" style={input} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button onClick={() => setModal(false)} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={register} disabled={!form.action_id} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: 'var(--brand-accent)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: form.action_id ? 1 : 0.6 }}>Register (shadow)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function miniBtn(color: string): React.CSSProperties {
  return { display: 'inline-flex', padding: 5, borderRadius: 6, border: `1px solid ${color}55`, background: `${color}12`, color, cursor: 'pointer' };
}
