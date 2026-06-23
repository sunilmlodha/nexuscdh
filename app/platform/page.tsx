'use client';

import { useState, useEffect, useCallback } from 'react';
import { SlidersHorizontal, Plus, Trash2, X, Gauge, CreditCard, ToggleLeft, ToggleRight } from 'lucide-react';

const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';
const panel: React.CSSProperties = { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12 };
const input: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 };

interface Flag { id: string; key: string; label?: string; description?: string; enabled: boolean; rollout_pct: number; }
interface Usage { plan: string; seatLimit: number; decisionLimit: number; used: number; remaining: number; pct: number; overLimit: boolean; }

export default function PlatformPage() {
  const [tab, setTab] = useState<'flags' | 'usage'>('flags');
  const [flags, setFlags] = useState<Flag[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [err, setErr] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Partial<Flag>>({ key: '', label: '', enabled: false, rollout_pct: 1 });

  const load = useCallback(async () => {
    setErr('');
    try {
      const [f, u] = await Promise.all([
        fetch(`/api/flags?tenantId=${TENANT_ID}`).then(r => r.json()),
        fetch(`/api/usage?tenantId=${TENANT_ID}`).then(r => r.json()),
      ]);
      if (f.error) setErr(f.error.includes('feature_flags') ? 'Run migration 0003_platform.sql to enable flags + plans.' : f.error);
      else setFlags(f.data ?? []);
      if (u.configured !== false) setUsage(u);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Failed'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function saveFlag(patch: Partial<Flag>) {
    await fetch('/api/flags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...patch, tenantId: TENANT_ID }) });
    load();
  }
  async function del(id: string) { await fetch(`/api/flags?id=${id}&tenantId=${TENANT_ID}`, { method: 'DELETE' }); load(); }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SlidersHorizontal size={24} color="var(--brand-accent)" />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Platform</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Feature flags for controlled rollout, and plan usage / entitlements.</p>
          </div>
        </div>
        {tab === 'flags' && <button onClick={() => { setForm({ key: '', label: '', enabled: false, rollout_pct: 1 }); setModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'var(--brand-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}><Plus size={14} /> New Flag</button>}
      </div>

      <div style={{ display: 'flex', gap: 4, margin: '18px 0', borderBottom: '1px solid var(--border)' }}>
        {([['flags', 'Feature Flags'], ['usage', 'Usage & Plan']] as const).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: tab === t ? 700 : 500, color: tab === t ? 'var(--brand-accent)' : 'var(--text-muted)', borderBottom: tab === t ? '2px solid var(--brand-accent)' : '2px solid transparent', marginBottom: -1 }}>{l}</button>
        ))}
      </div>

      {err && <div style={{ ...panel, padding: 16, borderLeft: '3px solid #ef4444', fontSize: 13, color: 'var(--text-secondary)' }}>{err}</div>}

      {tab === 'flags' && !err && (
        flags.length === 0 ? <div style={{ ...panel, padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No flags yet. Create one to gate a feature or roll it out gradually.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {flags.map(f => (
              <div key={f.id} style={{ ...panel, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                <button onClick={() => saveFlag({ ...f, enabled: !f.enabled })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: f.enabled ? '#22c55e' : 'var(--text-muted)', display: 'flex' }}>
                  {f.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.label || f.key} <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.key}</code></div>
                  {f.description && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.description}</div>}
                </div>
                {f.enabled && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 200 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>rollout</span>
                    <input type="range" min={0} max={1} step={0.05} value={f.rollout_pct} onChange={e => saveFlag({ ...f, rollout_pct: Number(e.target.value) })} style={{ flex: 1 }} />
                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--brand-accent)', minWidth: 36, textAlign: 'right' }}>{Math.round(f.rollout_pct * 100)}%</span>
                  </div>
                )}
                <button onClick={() => del(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'usage' && usage && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ ...panel, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><CreditCard size={16} color="var(--brand-accent)" /><span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Plan</span></div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{usage.plan}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{usage.decisionLimit.toLocaleString()} decisions/mo · {usage.seatLimit} seats</div>
          </div>
          <div style={{ ...panel, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><Gauge size={16} color={usage.overLimit ? '#ef4444' : 'var(--brand-accent)'} /><span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Decisions this month</span></div>
            <div style={{ fontSize: 28, fontWeight: 700, color: usage.overLimit ? '#ef4444' : 'var(--text-primary)' }}>{usage.used.toLocaleString()} <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 400 }}>/ {usage.decisionLimit.toLocaleString()}</span></div>
            <div style={{ height: 10, background: 'var(--bg)', borderRadius: 5, overflow: 'hidden', marginTop: 10 }}>
              <div style={{ width: `${Math.round(usage.pct * 100)}%`, height: '100%', background: usage.overLimit ? '#ef4444' : usage.pct > 0.8 ? '#f59e0b' : '#22c55e' }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{usage.remaining.toLocaleString()} remaining{usage.overLimit ? ' · over limit' : ''}</div>
          </div>
          <div style={{ gridColumn: 'span 2', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Metering counts logged decisions per calendar month. Stripe billing wires in via a STRIPE_SECRET_KEY env var (scaffold pending). Quotas can be enforced in /api/decide once you choose hard vs soft limits.</div>
        </div>
      )}

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{ ...panel, padding: 26, width: 460, maxWidth: '92vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>New Feature Flag</h2>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <label style={lbl}>Key (code reference)</label>
            <input value={form.key ?? ''} onChange={e => setForm(f => ({ ...f, key: e.target.value }))} placeholder="new_arbitration_v2" style={input} />
            <label style={{ ...lbl, marginTop: 12 }}>Label</label>
            <input value={form.label ?? ''} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} style={input} />
            <label style={{ ...lbl, marginTop: 12 }}>Description</label>
            <input value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={input} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button onClick={() => setModal(false)} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={() => { if (form.key?.trim()) { saveFlag(form); setModal(false); } }} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: 'var(--brand-accent)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
