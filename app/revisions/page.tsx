'use client';

import { useState, useEffect, useCallback } from 'react';
import { GitPullRequest, Plus, X, Send, CheckCircle2, XCircle, Rocket, Clock, Trash2 } from 'lucide-react';

const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';
const panel: React.CSSProperties = { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12 };
const input: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' };

interface ChangeRequest {
  id: string;
  title: string;
  description?: string;
  status: 'draft' | 'in_review' | 'approved' | 'deployed' | 'rejected';
  items: Array<{ entityType?: string; entityName?: string; change?: string }>;
  created_by?: string;
  reviewed_by?: string;
  review_note?: string;
  created_at: string;
  submitted_at?: string;
  deployed_at?: string;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: '#6b7280' },
  in_review: { label: 'In Review', color: '#f59e0b' },
  approved:  { label: 'Approved',  color: '#3b82f6' },
  deployed:  { label: 'Deployed',  color: '#22c55e' },
  rejected:  { label: 'Rejected',  color: '#ef4444' },
};

const STAGES = ['draft', 'in_review', 'approved', 'deployed'];

export default function RevisionsPage() {
  const [items, setItems] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [changeItems, setChangeItems] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/revisions?tenantId=${TENANT_ID}`);
      const json = await res.json();
      if (json.configured === false) setError('Supabase not configured.');
      else setItems(json.data ?? []);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function transition(id: string, action: string, note?: string) {
    await fetch('/api/revisions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, note, tenantId: TENANT_ID, actor: 'ops-ui' }),
    });
    load();
  }

  async function create() {
    if (!title.trim()) return;
    setSaving(true);
    const parsedItems = changeItems.split('\n').map(l => l.trim()).filter(Boolean).map(change => ({ change }));
    try {
      await fetch('/api/revisions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description: desc, items: parsedItems, tenantId: TENANT_ID, actor: 'ops-ui' }),
      });
      setModal(false); setTitle(''); setDesc(''); setChangeItems(''); load();
    } finally { setSaving(false); }
  }

  async function del(id: string) {
    await fetch(`/api/revisions?id=${id}&tenantId=${TENANT_ID}`, { method: 'DELETE' });
    load();
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1040, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <GitPullRequest size={24} color="var(--brand-accent)" />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>1:1 Operations — Revision Management</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Bundle config changes into reviewed, approved, auditable deployments.</p>
          </div>
        </div>
        <button onClick={() => setModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'var(--brand-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          <Plus size={14} /> New Change Request
        </button>
      </div>

      {error && <div style={{ ...panel, padding: 16, marginTop: 16, borderLeft: '3px solid #ef4444', fontSize: 13, color: 'var(--text-secondary)' }}>{error}</div>}
      {loading && <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading…</div>}

      {!loading && items.length === 0 && !error && (
        <div style={{ ...panel, padding: 48, textAlign: 'center', marginTop: 20 }}>
          <GitPullRequest size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No change requests yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Create one to track a set of configuration changes through review and deployment.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
        {items.map(cr => {
          const m = STATUS_META[cr.status];
          const stageIdx = STAGES.indexOf(cr.status === 'rejected' ? 'in_review' : cr.status);
          return (
            <div key={cr.id} style={{ ...panel, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{cr.title}</span>
                    <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${m.color}22`, color: m.color }}>{m.label}</span>
                  </div>
                  {cr.description && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{cr.description}</div>}
                </div>
                {cr.status === 'draft' && <button onClick={() => del(cr.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}><Trash2 size={14} /></button>}
              </div>

              {/* Stage progress */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '14px 0' }}>
                {STAGES.map((st, i) => {
                  const done = cr.status !== 'rejected' && i <= stageIdx;
                  const active = i === stageIdx && cr.status !== 'rejected';
                  const col = cr.status === 'rejected' && i === 1 ? '#ef4444' : done ? STATUS_META[st].color : 'var(--border)';
                  return (
                    <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: i < STAGES.length - 1 ? 1 : 'none' }}>
                      <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: done || active ? STATUS_META[st].color : 'var(--text-muted)', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{st.replace('_', ' ')}</span>
                      {i < STAGES.length - 1 && <div style={{ flex: 1, height: 2, background: col }} />}
                    </div>
                  );
                })}
              </div>

              {/* Items */}
              {cr.items?.length > 0 && (
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                  {cr.items.map((it, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '2px 0' }}>• {it.change ?? `${it.entityType}: ${it.entityName}`}</div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                <Clock size={12} /> {new Date(cr.created_at).toLocaleDateString()} · {cr.created_by ?? 'system'}
                {cr.reviewed_by && <span> · reviewed by {cr.reviewed_by}</span>}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  {(cr.status === 'draft' || cr.status === 'rejected') && <Action onClick={() => transition(cr.id, 'submit')} icon={<Send size={12} />} label="Submit" color="#f59e0b" />}
                  {cr.status === 'in_review' && <Action onClick={() => transition(cr.id, 'approve')} icon={<CheckCircle2 size={12} />} label="Approve" color="#3b82f6" />}
                  {cr.status === 'in_review' && <Action onClick={() => transition(cr.id, 'reject')} icon={<XCircle size={12} />} label="Reject" color="#ef4444" />}
                  {cr.status === 'approved' && <Action onClick={() => transition(cr.id, 'deploy')} icon={<Rocket size={12} />} label="Deploy" color="#22c55e" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{ ...panel, padding: 28, width: 520, maxWidth: '92vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>New Change Request</h2>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <label style={lbl}>Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} style={input} placeholder="e.g. Q3 mortgage push + contact-policy update" />
            <label style={{ ...lbl, marginTop: 14 }}>Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} style={{ ...input, resize: 'vertical' }} />
            <label style={{ ...lbl, marginTop: 14 }}>Change items (one per line)</label>
            <textarea value={changeItems} onChange={e => setChangeItems(e.target.value)} rows={4} style={{ ...input, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} placeholder={'Activate strategy "Home Insurance Growth"\nSet context weight to 1.3 on Mortgage Cross-Sell\nAdd suppression rule: days_since_contact < 7'} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setModal(false)} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={create} disabled={saving || !title.trim()} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: 'var(--brand-accent)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving || !title.trim() ? 0.6 : 1 }}>{saving ? 'Creating…' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 };

function Action({ onClick, icon, label, color }: { onClick: () => void; icon: React.ReactNode; label: string; color: string }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: `1px solid ${color}55`, background: `${color}12`, color, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
      {icon} {label}
    </button>
  );
}
