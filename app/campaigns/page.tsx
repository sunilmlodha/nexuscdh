'use client';

import { useState, useEffect, useCallback } from 'react';
import { Megaphone, Plus, X, Trash2, Edit2, Play, Users, Target, Zap } from 'lucide-react';

const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';
const OPS = ['=', '!=', '>=', '<=', '>', '<', 'IN', 'NOT IN'];
const CHANNELS = ['email','sms','push','in_app','direct_mail','outbound_call'];
const panel: React.CSSProperties = { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12 };
const input: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' };

interface Rule { attribute: string; op: string; value: string; }
interface Campaign {
  id: string; name: string; description?: string;
  mode: '1:1' | 'segment';
  audience_rules: Rule[];
  action_id?: string | null; treatment_id?: string | null; channel?: string | null;
  start_date?: string | null; end_date?: string | null;
  status: string;
  last_run_at?: string | null;
  last_run_stats?: { total: number; matched: number; served: number; suppressed: number } | null;
}
interface ActionRef { id: string; name: string; }
interface TreatmentRef { id: string; name: string; action_id: string | null; channel: string; offer_state: string; }

const empty = (): Partial<Campaign> => ({ name: '', description: '', mode: '1:1', audience_rules: [], status: 'draft' });

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [actions, setActions] = useState<ActionRef[]>([]);
  const [treatments, setTreatments] = useState<TreatmentRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Partial<Campaign>>(empty());
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<{ id: string; stats: { matched: number; served: number; suppressed: number }; error?: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [c, h, t] = await Promise.all([
        fetch(`/api/campaigns?tenantId=${TENANT_ID}`).then(r => r.json()),
        fetch(`/api/hydrate?tenantId=${TENANT_ID}`).then(r => r.json()),
        fetch(`/api/treatments?tenantId=${TENANT_ID}`).then(r => r.json()),
      ]);
      if (c.configured === false) setError('Supabase not configured.');
      else setCampaigns(c.data ?? []);
      setActions((h.actions ?? []).map((a: { id: string; name: string }) => ({ id: a.id, name: a.name })));
      setTreatments((t.data ?? []).map((x: { id: string; name: string; action_id: string | null; channel: string; offer_state: string }) => ({ id: x.id, name: x.name, action_id: x.action_id, channel: x.channel, offer_state: x.offer_state })));
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!form.name?.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/campaigns', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tenantId: TENANT_ID }),
      });
      setModal(false); setForm(empty()); load();
    } finally { setSaving(false); }
  }

  async function del(id: string) {
    await fetch(`/api/campaigns?id=${id}&tenantId=${TENANT_ID}`, { method: 'DELETE' });
    load();
  }

  async function run(id: string) {
    setRunning(id); setRunResult(null);
    try {
      const res = await fetch('/api/campaigns/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, tenantId: TENANT_ID }),
      });
      const j = await res.json();
      if (!res.ok) setRunResult({ id, stats: { matched: 0, served: 0, suppressed: 0 }, error: j.error });
      else setRunResult({ id, stats: j.stats });
      load();
    } finally { setRunning(null); }
  }

  const setRule = (i: number, patch: Partial<Rule>) => setForm(f => { const r = [...(f.audience_rules ?? [])]; r[i] = { ...r[i], ...patch }; return { ...f, audience_rules: r }; });
  const stratTreatments = treatments.filter(t => t.action_id === form.action_id);

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1060, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Megaphone size={24} color="var(--brand-accent)" />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Campaigns</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Run <strong>1:1</strong> (arbitrated next-best-action) or <strong>segment</strong> (one fixed offer to a segment) marketing.</p>
          </div>
        </div>
        <button onClick={() => { setForm(empty()); setModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'var(--brand-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          <Plus size={14} /> New Campaign
        </button>
      </div>

      {error && <div style={{ ...panel, padding: 16, marginTop: 16, borderLeft: '3px solid #ef4444', fontSize: 13, color: 'var(--text-secondary)' }}>{error}</div>}
      {loading && <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading…</div>}

      {!loading && campaigns.length === 0 && !error && (
        <div style={{ ...panel, padding: 48, textAlign: 'center', marginTop: 20 }}>
          <Megaphone size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No campaigns yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Create a 1:1 or segment campaign to start targeting customers.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
        {campaigns.map(c => (
          <div key={c.id} style={{ ...panel, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{c.name}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.mode === '1:1' ? 'rgba(99,102,241,0.12)' : 'rgba(245,158,11,0.14)', color: c.mode === '1:1' ? 'var(--brand-accent)' : '#b45309' }}>
                    {c.mode === '1:1' ? <Zap size={11} /> : <Target size={11} />}{c.mode === '1:1' ? '1:1 NBA' : 'Segment'}
                  </span>
                  <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: c.status === 'active' ? '#dcfce7' : 'var(--bg)', color: c.status === 'active' ? '#15803d' : 'var(--text-muted)', textTransform: 'capitalize' }}>{c.status}</span>
                </div>
                {c.description && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{c.description}</div>}
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                  <Users size={11} style={{ verticalAlign: 'middle' }} /> {(c.audience_rules ?? []).length === 0 ? 'All customers' : `${c.audience_rules.length} segment rule(s)`}
                  {c.mode === 'segment' && c.action_id && <span> · offer: {actions.find(a => a.id === c.action_id)?.name ?? '—'}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => run(c.id)} disabled={running === c.id} title="Run campaign" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--brand-accent)', background: 'rgba(99,102,241,0.08)', color: 'var(--brand-accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  <Play size={12} /> {running === c.id ? 'Running…' : 'Run'}
                </button>
                <button onClick={() => { setForm(c); setModal(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><Edit2 size={13} /></button>
                <button onClick={() => del(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}><Trash2 size={13} /></button>
              </div>
            </div>

            {/* Run result / last run */}
            {(runResult?.id === c.id || c.last_run_stats) && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, fontSize: 12 }}>
                {runResult?.id === c.id && runResult.error ? (
                  <span style={{ color: '#b91c1c' }}>{runResult.error}</span>
                ) : (() => {
                  const s = runResult?.id === c.id ? runResult.stats : c.last_run_stats!;
                  return <span style={{ color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{s.matched}</strong> matched · <strong style={{ color: '#16a34a' }}>{s.served}</strong> served · <strong style={{ color: '#f59e0b' }}>{s.suppressed}</strong> suppressed
                    {c.last_run_at && runResult?.id !== c.id && <span style={{ color: 'var(--text-muted)' }}> · last run {new Date(c.last_run_at).toLocaleString()}</span>}
                  </span>;
                })()}
              </div>
            )}
          </div>
        ))}
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{ ...panel, padding: 28, width: 620, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{form.id ? 'Edit' : 'New'} Campaign</h2>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>

            {/* Mode toggle */}
            <label style={lbl}>Mode</label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              {(['1:1', 'segment'] as const).map(m => (
                <button key={m} onClick={() => setForm(f => ({ ...f, mode: m }))} style={{
                  flex: 1, padding: '12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                  border: form.mode === m ? '2px solid var(--brand-accent)' : '2px solid var(--border)',
                  background: form.mode === m ? 'rgba(99,102,241,0.06)' : 'var(--bg)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: form.mode === m ? 'var(--brand-accent)' : 'var(--text-primary)' }}>
                    {m === '1:1' ? <Zap size={14} /> : <Target size={14} />}{m === '1:1' ? '1:1 — Next-Best-Action' : 'Segment — Fixed offer'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{m === '1:1' ? 'Arbitrate the best action per customer' : 'Send one action+treatment to all in segment'}</div>
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Name *</label><input value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={input} /></div>
              <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Description</label><input value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={input} /></div>
              <div><label style={lbl}>Start date</label><input type="date" value={form.start_date ?? ''} onChange={e => setForm(f => ({ ...f, start_date: e.target.value || null }))} style={input} /></div>
              <div><label style={lbl}>End date</label><input type="date" value={form.end_date ?? ''} onChange={e => setForm(f => ({ ...f, end_date: e.target.value || null }))} style={input} /></div>
              <div><label style={lbl}>Status</label>
                <select value={form.status ?? 'draft'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={input}>
                  {['draft','active','paused','completed'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Segment offer pickers */}
            {form.mode === 'segment' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14, padding: 14, background: 'var(--bg)', borderRadius: 8 }}>
                <div><label style={lbl}>Action *</label>
                  <select value={form.action_id ?? ''} onChange={e => setForm(f => ({ ...f, action_id: e.target.value || null, treatment_id: null }))} style={input}>
                    <option value="">— select —</option>
                    {actions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Treatment</label>
                  <select value={form.treatment_id ?? ''} onChange={e => setForm(f => ({ ...f, treatment_id: e.target.value || null }))} style={input} disabled={!form.action_id}>
                    <option value="">{form.action_id ? 'Auto (none)' : 'Pick action first'}</option>
                    {stratTreatments.map(t => <option key={t.id} value={t.id}>{t.name} {t.offer_state !== 'live' ? `(${t.offer_state})` : ''}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Channel</label>
                  <select value={form.channel ?? 'email'} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} style={input}>
                    {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Audience rule builder */}
            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ ...lbl, marginBottom: 0 }}>Segment rules <span style={{ textTransform: 'none', fontWeight: 400 }}>(all must match; empty = all customers)</span></label>
                <button onClick={() => setForm(f => ({ ...f, audience_rules: [...(f.audience_rules ?? []), { attribute: '', op: '=', value: '' }] }))} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--brand-accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}><Plus size={12} /> rule</button>
              </div>
              {(form.audience_rules ?? []).map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                  <input value={r.attribute} onChange={e => setRule(i, { attribute: e.target.value })} placeholder="attribute (e.g. customer_segment)" style={{ ...input, flex: 1 }} />
                  <select value={r.op} onChange={e => setRule(i, { op: e.target.value })} style={{ ...input, width: 70 }}>{OPS.map(o => <option key={o}>{o}</option>)}</select>
                  <input value={r.value} onChange={e => setRule(i, { value: e.target.value })} placeholder="value" style={{ ...input, flex: 1 }} />
                  <button onClick={() => setForm(f => ({ ...f, audience_rules: (f.audience_rules ?? []).filter((_, j) => j !== i) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
              <button onClick={() => setModal(false)} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={save} disabled={saving || !form.name?.trim() || (form.mode === 'segment' && !form.action_id)} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: 'var(--brand-accent)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving || !form.name?.trim() || (form.mode === 'segment' && !form.action_id) ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 };
