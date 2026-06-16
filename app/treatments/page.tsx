'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package, Plus, Edit2, Trash2, X, History } from 'lucide-react';
import { AuditDrawer, ConfirmDialog } from '../components/AuditDrawer';

const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';

const CHANNELS = ['email','sms','push','in_app','direct_mail','outbound_call'];
const VARIANTS = ['A','B','C','Control'];
const TREATMENT_STATUSES = ['draft','active','paused','archived'];
const OBJECTIVES = ['acquisition','retention','cross-sell','upsell','win-back'];
const BUNDLE_STATUSES = ['draft','active','completed','paused'];

const STATUS_COLORS: Record<string,string> = {
  draft:     'var(--text-muted)',
  active:    '#22c55e',
  paused:    '#f59e0b',
  archived:  '#6b7280',
  completed: '#3b82f6',
};

const OBJ_COLORS: Record<string,string> = {
  acquisition: '#6366f1',
  retention:   '#22c55e',
  'cross-sell':'#f59e0b',
  upsell:      '#3b82f6',
  'win-back':  '#ef4444',
};

interface Treatment {
  id: string;
  action_id: string | null;
  name: string;
  description: string;
  channel: string;
  headline: string;
  body_copy: string;
  cta_label: string;
  offer_code: string;
  offer_value: number | null;
  variant_label: string;
  status: string;
}

interface Bundle {
  id: string;
  name: string;
  description: string;
  objective: string;
  treatment_ids: string[];
  start_date: string;
  end_date: string;
  status: string;
  budget: number | null;
}

interface Action {
  id: string;
  name: string;
}

const emptyTreatment = (): Partial<Treatment> => ({
  name: '', description: '', channel: 'email', headline: '', body_copy: '',
  cta_label: '', offer_code: '', offer_value: null, variant_label: 'A', status: 'draft',
});

const emptyBundle = (): Partial<Bundle> => ({
  name: '', description: '', objective: 'acquisition', treatment_ids: [],
  start_date: '', end_date: '', status: 'draft', budget: null,
});

export default function TreatmentsPage() {
  const [tab, setTab] = useState<'treatments'|'bundles'>('treatments');

  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [bundles, setBundles]       = useState<Bundle[]>([]);
  const [actions, setActions]       = useState<Action[]>([]);

  const [tModal, setTModal]   = useState(false);
  const [bModal, setBModal]   = useState(false);
  const [tForm, setTForm]     = useState<Partial<Treatment>>(emptyTreatment());
  const [bForm, setBForm]     = useState<Partial<Bundle>>(emptyBundle());
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const [audit, setAudit]     = useState<{ type: string; id?: string; name: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ kind: 'treatment'|'bundle'; id: string; name: string } | null>(null);

  const fetchTreatments = useCallback(async () => {
    const res = await fetch(`/api/treatments?tenantId=${TENANT_ID}`);
    const json = await res.json();
    setTreatments(json.data ?? []);
  }, []);

  const fetchBundles = useCallback(async () => {
    const res = await fetch(`/api/bundles?tenantId=${TENANT_ID}`);
    const json = await res.json();
    setBundles(json.data ?? []);
  }, []);

  const fetchActions = useCallback(async () => {
    try {
      const res = await fetch(`/api/hydrate?tenantId=${TENANT_ID}`);
      const json = await res.json();
      const acts: Action[] = (json.actions ?? []).map((a: { id: string; name: string }) => ({ id: a.id, name: a.name }));
      setActions(acts);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { fetchTreatments(); fetchBundles(); fetchActions(); }, [fetchTreatments, fetchBundles, fetchActions]);

  async function saveTreatment() {
    if (!tForm.name?.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/treatments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...tForm, tenantId: TENANT_ID }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      setTModal(false); setTForm(emptyTreatment()); fetchTreatments();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  async function deleteTreatment(id: string) {
    await fetch(`/api/treatments?id=${id}&tenantId=${TENANT_ID}`, { method: 'DELETE' });
    setConfirmDel(null);
    fetchTreatments();
  }

  async function saveBundle() {
    if (!bForm.name?.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bForm, tenantId: TENANT_ID }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      setBModal(false); setBForm(emptyBundle()); fetchBundles();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  async function deleteBundle(id: string) {
    await fetch(`/api/bundles?id=${id}&tenantId=${TENANT_ID}`, { method: 'DELETE' });
    setConfirmDel(null);
    fetchBundles();
  }

  function openEditTreatment(t: Treatment) {
    setTForm({ ...t }); setTModal(true); setError('');
  }

  function openEditBundle(b: Bundle) {
    setBForm({ ...b }); setBModal(true); setError('');
  }

  const actionName = (id: string | null) =>
    id ? (actions.find(a => a.id === id)?.name ?? id.slice(0,8)+'…') : '—';

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 28 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 12 }}>
          <Package size={24} color="var(--brand-accent)" />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Treatments &amp; Bundles</h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Manage creative executions and campaign bundles</p>
          </div>
        </div>
        <button
          onClick={() => { setError(''); tab === 'treatments' ? (setTForm(emptyTreatment()), setTModal(true)) : (setBForm(emptyBundle()), setBModal(true)); }}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background:'var(--brand-accent)', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
          <Plus size={14} />
          {tab === 'treatments' ? 'New Treatment' : 'New Bundle'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:24, borderBottom:'1px solid var(--border)', paddingBottom:0 }}>
        {(['treatments','bundles'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:'8px 20px', border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
            background:'none', borderBottom: tab===t ? '2px solid var(--brand-accent)' : '2px solid transparent',
            color: tab===t ? 'var(--brand-accent)' : 'var(--text-muted)',
            marginBottom: -1, textTransform: 'capitalize',
          }}>{t}</button>
        ))}
      </div>

      {/* Treatments Tab */}
      {tab === 'treatments' && (
        <div style={{ background:'var(--bg-panel)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
          {treatments.length === 0 ? (
            <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)', fontSize:14 }}>No treatments yet. Click "New Treatment" to get started.</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border)', background:'rgba(0,0,0,0.02)' }}>
                  {['Name','Action','Channel','Variant','Offer','Status',''].map(h => (
                    <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontWeight:600, color:'var(--text-muted)', fontSize:11, textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {treatments.map((t, i) => (
                  <tr key={t.id} style={{ borderBottom: i < treatments.length-1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding:'12px 16px' }}>
                      <div style={{ fontWeight:600, color:'var(--text-primary)' }}>{t.name}</div>
                      {t.headline && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{t.headline}</div>}
                    </td>
                    <td style={{ padding:'12px 16px', color:'var(--text-secondary)' }}>{actionName(t.action_id)}</td>
                    <td style={{ padding:'12px 16px' }}>
                      <span style={{ padding:'2px 8px', borderRadius:4, background:'rgba(99,102,241,0.1)', color:'var(--brand-accent)', fontSize:11, fontWeight:600, textTransform:'uppercase' }}>{t.channel}</span>
                    </td>
                    <td style={{ padding:'12px 16px', color:'var(--text-secondary)' }}>{t.variant_label ?? '—'}</td>
                    <td style={{ padding:'12px 16px', color:'var(--text-secondary)' }}>
                      {t.offer_code ? <span>{t.offer_code}{t.offer_value != null ? ` (${t.offer_value})` : ''}</span> : '—'}
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, background:`${STATUS_COLORS[t.status]}20`, color:STATUS_COLORS[t.status], textTransform:'capitalize' }}>{t.status}</span>
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      <div style={{ display:'flex', gap:4 }}>
                        <button onClick={() => setAudit({ type:'treatment', id:t.id, name:t.name })} title="Audit history" style={{ padding:4, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><History size={13} /></button>
                        <button onClick={() => openEditTreatment(t)} title="Edit" style={{ padding:4, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><Edit2 size={13} /></button>
                        <button onClick={() => setConfirmDel({ kind:'treatment', id:t.id, name:t.name })} title="Delete" style={{ padding:4, background:'none', border:'none', cursor:'pointer', color:'#ef4444' }}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Bundles Tab */}
      {tab === 'bundles' && (
        <div>
          {bundles.length === 0 ? (
            <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)', fontSize:14, background:'var(--bg-panel)', border:'1px solid var(--border)', borderRadius:10 }}>No bundles yet. Click "New Bundle" to get started.</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:16 }}>
              {bundles.map(b => (
                <div key={b.id} style={{ background:'var(--bg-panel)', border:'1px solid var(--border)', borderRadius:10, padding:20 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, color:'var(--text-primary)', fontSize:15 }}>{b.name}</div>
                      {b.description && <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>{b.description}</div>}
                    </div>
                    <div style={{ display:'flex', gap:4 }}>
                      <button onClick={() => setAudit({ type:'bundle', id:b.id, name:b.name })} title="Audit history" style={{ padding:4, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><History size={13} /></button>
                      <button onClick={() => openEditBundle(b)} title="Edit" style={{ padding:4, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><Edit2 size={13} /></button>
                      <button onClick={() => setConfirmDel({ kind:'bundle', id:b.id, name:b.name })} title="Delete" style={{ padding:4, background:'none', border:'none', cursor:'pointer', color:'#ef4444' }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
                    {b.objective && (
                      <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, background:`${OBJ_COLORS[b.objective] ?? '#6366f1'}20`, color:OBJ_COLORS[b.objective] ?? '#6366f1', textTransform:'capitalize' }}>{b.objective}</span>
                    )}
                    <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, background:`${STATUS_COLORS[b.status]}20`, color:STATUS_COLORS[b.status], textTransform:'capitalize' }}>{b.status}</span>
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', display:'flex', gap:16 }}>
                    <span>{Array.isArray(b.treatment_ids) ? b.treatment_ids.length : 0} treatments</span>
                    {b.start_date && <span>{b.start_date} → {b.end_date ?? '…'}</span>}
                    {b.budget != null && <span>Budget: £{b.budget.toLocaleString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Treatment Modal */}
      {tModal && (
        <Modal title={tForm.id ? 'Edit Treatment' : 'New Treatment'} onClose={() => { setTModal(false); setError(''); }}>
          <FormGrid>
            <Field label="Name" required>
              <input value={tForm.name ?? ''} onChange={e => setTForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
            </Field>
            <Field label="Action">
              <select value={tForm.action_id ?? ''} onChange={e => setTForm(f => ({ ...f, action_id: e.target.value || null }))} style={inputStyle}>
                <option value="">— None —</option>
                {actions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <Field label="Description" span={2}>
              <textarea value={tForm.description ?? ''} onChange={e => setTForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ ...inputStyle, resize:'vertical' }} />
            </Field>
            <Field label="Channel">
              <select value={tForm.channel ?? 'email'} onChange={e => setTForm(f => ({ ...f, channel: e.target.value }))} style={inputStyle}>
                {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Variant Label">
              <select value={tForm.variant_label ?? 'A'} onChange={e => setTForm(f => ({ ...f, variant_label: e.target.value }))} style={inputStyle}>
                {VARIANTS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Headline" span={2}>
              <input value={tForm.headline ?? ''} onChange={e => setTForm(f => ({ ...f, headline: e.target.value }))} style={inputStyle} />
            </Field>
            <Field label="Body Copy" span={2}>
              <textarea value={tForm.body_copy ?? ''} onChange={e => setTForm(f => ({ ...f, body_copy: e.target.value }))} rows={3} style={{ ...inputStyle, resize:'vertical' }} />
            </Field>
            <Field label="CTA Label">
              <input value={tForm.cta_label ?? ''} onChange={e => setTForm(f => ({ ...f, cta_label: e.target.value }))} style={inputStyle} />
            </Field>
            <Field label="Offer Code">
              <input value={tForm.offer_code ?? ''} onChange={e => setTForm(f => ({ ...f, offer_code: e.target.value }))} style={inputStyle} />
            </Field>
            <Field label="Offer Value">
              <input type="number" value={tForm.offer_value ?? ''} onChange={e => setTForm(f => ({ ...f, offer_value: e.target.value ? Number(e.target.value) : null }))} style={inputStyle} />
            </Field>
            <Field label="Status">
              <select value={tForm.status ?? 'draft'} onChange={e => setTForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                {TREATMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </FormGrid>
          {error && <div style={{ color:'#ef4444', fontSize:12, marginTop:8 }}>{error}</div>}
          <ModalFooter onCancel={() => { setTModal(false); setError(''); }} onSave={saveTreatment} saving={saving} />
        </Modal>
      )}

      {/* Bundle Modal */}
      {bModal && (
        <Modal title={bForm.id ? 'Edit Bundle' : 'New Bundle'} onClose={() => { setBModal(false); setError(''); }}>
          <FormGrid>
            <Field label="Name" required>
              <input value={bForm.name ?? ''} onChange={e => setBForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
            </Field>
            <Field label="Objective">
              <select value={bForm.objective ?? 'acquisition'} onChange={e => setBForm(f => ({ ...f, objective: e.target.value }))} style={inputStyle}>
                {OBJECTIVES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Description" span={2}>
              <textarea value={bForm.description ?? ''} onChange={e => setBForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ ...inputStyle, resize:'vertical' }} />
            </Field>
            <Field label="Start Date">
              <input type="date" value={bForm.start_date ?? ''} onChange={e => setBForm(f => ({ ...f, start_date: e.target.value }))} style={inputStyle} />
            </Field>
            <Field label="End Date">
              <input type="date" value={bForm.end_date ?? ''} onChange={e => setBForm(f => ({ ...f, end_date: e.target.value }))} style={inputStyle} />
            </Field>
            <Field label="Budget (£)">
              <input type="number" value={bForm.budget ?? ''} onChange={e => setBForm(f => ({ ...f, budget: e.target.value ? Number(e.target.value) : null }))} style={inputStyle} />
            </Field>
            <Field label="Status">
              <select value={bForm.status ?? 'draft'} onChange={e => setBForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                {BUNDLE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Treatments" span={2}>
              <div style={{ border:'1px solid var(--border)', borderRadius:6, maxHeight:160, overflowY:'auto', padding:8 }}>
                {treatments.length === 0 ? (
                  <div style={{ color:'var(--text-muted)', fontSize:12 }}>No treatments available.</div>
                ) : treatments.map(t => (
                  <label key={t.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0', cursor:'pointer', fontSize:13 }}>
                    <input
                      type="checkbox"
                      checked={(bForm.treatment_ids ?? []).includes(t.id)}
                      onChange={e => {
                        const ids = bForm.treatment_ids ?? [];
                        setBForm(f => ({ ...f, treatment_ids: e.target.checked ? [...ids, t.id] : ids.filter(id => id !== t.id) }));
                      }}
                    />
                    <span style={{ color:'var(--text-primary)' }}>{t.name}</span>
                    <span style={{ color:'var(--text-muted)', fontSize:11 }}>{t.channel} · {t.variant_label}</span>
                  </label>
                ))}
              </div>
            </Field>
          </FormGrid>
          {error && <div style={{ color:'#ef4444', fontSize:12, marginTop:8 }}>{error}</div>}
          <ModalFooter onCancel={() => { setBModal(false); setError(''); }} onSave={saveBundle} saving={saving} />
        </Modal>
      )}

      {/* Audit History Drawer */}
      {audit && (
        <AuditDrawer entityType={audit.type} entityId={audit.id} entityName={audit.name} onClose={() => setAudit(null)} />
      )}

      {/* Delete Confirmation */}
      {confirmDel && (
        <ConfirmDialog
          title={`Delete ${confirmDel.kind}?`}
          message={`"${confirmDel.name}" will be archived and removed from active lists. This action is recorded in the audit log.`}
          onConfirm={() => confirmDel.kind === 'treatment' ? deleteTreatment(confirmDel.id) : deleteBundle(confirmDel.id)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}

// ── Shared UI helpers ──────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box',
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background:'var(--bg-panel)', border:'1px solid var(--border)', borderRadius:12, padding:28, width:'100%', maxWidth:620, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:'var(--text-primary)' }}>{title}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>{children}</div>;
}

function Field({ label, children, required, span }: { label: string; children: React.ReactNode; required?: boolean; span?: number }) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>
        {label}{required && <span style={{ color:'#ef4444' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function ModalFooter({ onCancel, onSave, saving }: { onCancel: () => void; onSave: () => void; saving: boolean }) {
  return (
    <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:20 }}>
      <button onClick={onCancel} style={{ padding:'7px 16px', borderRadius:6, border:'1px solid var(--border)', background:'none', color:'var(--text-secondary)', cursor:'pointer', fontSize:13 }}>Cancel</button>
      <button onClick={onSave} disabled={saving} style={{ padding:'7px 16px', borderRadius:6, border:'none', background:'var(--brand-accent)', color:'white', cursor:'pointer', fontSize:13, fontWeight:600, opacity: saving ? 0.7 : 1 }}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
