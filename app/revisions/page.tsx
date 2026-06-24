'use client';

import { useState, useEffect, useCallback } from 'react';
import { GitPullRequest, Plus, X, Send, CheckCircle2, XCircle, Rocket, Clock, Trash2, Undo2, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth, usePermission, ROLE_LABELS } from '@/lib/auth';

const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';
const panel: React.CSSProperties = { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12 };
const input: React.CSSProperties = { width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 };

interface FieldDef { key: string; label: string; type: string; options?: string[]; }
interface Catalogue { type: string; label: string; fields: FieldDef[]; }
interface ChangeItem { id: string; entityType: string; entityId: string; entityName: string; operation: 'update' | 'archive'; before?: Record<string, unknown>; after: Record<string, unknown>; appliedAt?: string; }
interface ChangeRequest {
  id: string; title: string; description?: string;
  status: 'draft' | 'in_review' | 'approved' | 'deployed' | 'rejected';
  items: ChangeItem[]; created_by?: string; reviewed_by?: string; review_note?: string;
  created_at: string; deployed_at?: string;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#6b7280' }, in_review: { label: 'In Review', color: '#f59e0b' },
  approved: { label: 'Approved', color: '#3b82f6' }, deployed: { label: 'Deployed', color: '#22c55e' },
  rejected: { label: 'Rejected / Rolled back', color: '#ef4444' },
};
const STAGES = ['draft', 'in_review', 'approved', 'deployed'];

export default function RevisionsPage() {
  const { currentUser, authSettings } = useAuth();
  const canApprove = usePermission('operations:write');
  const actor       = currentUser?.email ?? 'system';
  const actorName   = currentUser?.name ?? 'System';
  const actorRole   = currentUser?.role;
  const authEnabled = authSettings.authEnabled;

  const [items, setItems] = useState<ChangeRequest[]>([]);
  const [catalogue, setCatalogue] = useState<Catalogue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);

  // new CR form
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [staged, setStaged] = useState<ChangeItem[]>([]);
  const [saving, setSaving] = useState(false);

  // change builder
  const [bType, setBType] = useState('action');
  const [bEntities, setBEntities] = useState<Record<string, unknown>[]>([]);
  const [bNameField, setBNameField] = useState('name');
  const [bEntityId, setBEntityId] = useState('');
  const [bEdits, setBEdits] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [crs, cat] = await Promise.all([
        fetch(`/api/revisions?tenantId=${TENANT_ID}`).then(r => r.json()),
        fetch(`/api/revisions?catalogue=true`).then(r => r.json()),
      ]);
      if (crs.configured === false) setError('Supabase not configured.');
      else setItems(crs.data ?? []);
      setCatalogue(cat.artefacts ?? []);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadEntities = useCallback(async (type: string) => {
    const res = await fetch(`/api/revisions?artefacts=${type}&tenantId=${TENANT_ID}`);
    const j = await res.json();
    setBEntities(j.data ?? []); setBNameField(j.nameField ?? 'name'); setBEntityId(''); setBEdits({});
  }, []);
  useEffect(() => { if (modal) loadEntities(bType); }, [modal, bType, loadEntities]);

  const def = catalogue.find(c => c.type === bType);
  const selectedEntity = bEntities.find(e => String(e.id) === bEntityId);

  function pickEntity(id: string) {
    setBEntityId(id);
    const ent = bEntities.find(e => String(e.id) === id);
    const seed: Record<string, string> = {};
    (def?.fields ?? []).forEach(f => { const v = ent?.[f.key]; seed[f.key] = v === null || v === undefined ? '' : String(v); });
    setBEdits(seed);
  }

  function addChange(operation: 'update' | 'archive') {
    if (!selectedEntity || !def) return;
    const after: Record<string, unknown> = {};
    if (operation === 'update') {
      for (const f of def.fields) {
        const cur = selectedEntity[f.key]; const curStr = cur === null || cur === undefined ? '' : String(cur);
        if (bEdits[f.key] !== curStr) after[f.key] = bEdits[f.key];
      }
      if (Object.keys(after).length === 0) { setError('No fields changed.'); return; }
    }
    const before: Record<string, unknown> = {};
    Object.keys(operation === 'archive' ? { status: 1 } : after).forEach(k => { before[k] = selectedEntity[k]; });
    setStaged(s => [...s, {
      id: `ci-${Date.now()}`, entityType: bType, entityId: bEntityId,
      entityName: String(selectedEntity[bNameField] ?? bEntityId), operation, before, after,
    }]);
    setError(''); setBEntityId(''); setBEdits({});
  }

  async function createCR() {
    if (!title.trim() || staged.length === 0) { setError('Add a title and at least one change.'); return; }
    setSaving(true);
    try {
      await fetch('/api/revisions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description: desc, items: staged, tenantId: TENANT_ID, actor }),
      });
      setModal(false); setTitle(''); setDesc(''); setStaged([]); load();
    } finally { setSaving(false); }
  }

  async function transition(id: string, action: string) {
    const res = await fetch('/api/revisions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, tenantId: TENANT_ID, actor, actorRole, authEnabled }),
    });
    if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Action failed'); }
    load();
  }
  async function del(id: string) { await fetch(`/api/revisions?id=${id}&tenantId=${TENANT_ID}`, { method: 'DELETE' }); load(); }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1060, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <GitPullRequest size={24} color="var(--brand-accent)" />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Real-Time Operations — Change Management</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Propose field-level changes to live artefacts, review the diff, approve, and deploy — with audit and rollback.</p>
          </div>
        </div>
        <button onClick={() => { setModal(true); setStaged([]); setError(''); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'var(--brand-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          <Plus size={14} /> New Change Request
        </button>
      </div>

      {/* Who's acting + governance posture */}
      <div style={{ ...panel, padding: '10px 16px', margin: '14px 0', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
        <ShieldCheck size={15} color={canApprove ? '#22c55e' : 'var(--text-muted)'} />
        <span style={{ color: 'var(--text-secondary)' }}>Acting as <strong style={{ color: 'var(--text-primary)' }}>{actorName}</strong>{actorRole && <span style={{ color: 'var(--text-muted)' }}> · {ROLE_LABELS[actorRole]}</span>}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          {!authEnabled ? 'Auth disabled — full access (governance not enforced)'
            : canApprove ? 'Can author, approve & deploy' : 'Can author & submit; approval needs Ops Manager / Tenant Admin'}
        </span>
      </div>

      {error && <div style={{ ...panel, padding: 12, marginTop: 14, borderLeft: '3px solid #ef4444', fontSize: 13, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}><span>{error}</span><button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button></div>}
      {loading && <div style={{ textAlign: 'center', padding: 50, color: 'var(--text-muted)' }}>Loading…</div>}

      {!loading && items.length === 0 && !error && (
        <div style={{ ...panel, padding: 48, textAlign: 'center', marginTop: 20 }}>
          <GitPullRequest size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No change requests yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Bundle artefact changes into a reviewed, approved, auditable deployment.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
        {items.map(cr => {
          const m = STATUS_META[cr.status]; const stageIdx = STAGES.indexOf(cr.status === 'rejected' ? 'in_review' : cr.status);
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

              {/* Stage rail */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '14px 0' }}>
                {STAGES.map((st, i) => {
                  const done = cr.status !== 'rejected' && i <= stageIdx;
                  const col = cr.status === 'rejected' && i === 1 ? '#ef4444' : done ? STATUS_META[st].color : 'var(--border)';
                  return (
                    <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: i < STAGES.length - 1 ? 1 : 'none' }}>
                      <span style={{ fontSize: 11, fontWeight: i === stageIdx ? 700 : 500, color: done ? STATUS_META[st].color : 'var(--text-muted)', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{st.replace('_', ' ')}</span>
                      {i < STAGES.length - 1 && <div style={{ flex: 1, height: 2, background: col }} />}
                    </div>
                  );
                })}
              </div>

              {/* Change items with diffs */}
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                {(cr.items ?? []).length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No changes.</div> :
                  (cr.items ?? []).map((it, i) => (
                    <div key={it.id ?? i} style={{ padding: '6px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.1)', color: 'var(--brand-accent)', fontSize: 10, marginRight: 6, textTransform: 'capitalize' }}>{it.entityType}</span>
                        {it.entityName}
                        {it.operation === 'archive' && <span style={{ color: '#ef4444', marginLeft: 6 }}>· archive</span>}
                      </div>
                      {it.operation === 'update' && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                          {Object.keys(it.after).map(k => (
                            <span key={k} style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              {k}: <span style={{ color: '#ef4444', textDecoration: 'line-through' }}>{String(it.before?.[k] ?? '∅')}</span>
                              <ArrowRight size={9} style={{ verticalAlign: 'middle', margin: '0 2px' }} />
                              <span style={{ color: '#16a34a' }}>{String(it.after[k] ?? '∅')}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                <Clock size={12} /> {new Date(cr.created_at).toLocaleDateString()} · by {cr.created_by ?? 'system'}
                {cr.reviewed_by && <span> · reviewed by {cr.reviewed_by}</span>}
                {cr.review_note && <span style={{ fontStyle: 'italic' }}> · {cr.review_note}</span>}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  {(cr.status === 'draft' || cr.status === 'rejected') && <Action onClick={() => transition(cr.id, 'submit')} icon={<Send size={12} />} label="Submit" color="#f59e0b" />}
                  {cr.status === 'in_review' && canApprove && !(authEnabled && cr.created_by === actor) && <Action onClick={() => transition(cr.id, 'approve')} icon={<CheckCircle2 size={12} />} label="Approve" color="#3b82f6" />}
                  {cr.status === 'in_review' && authEnabled && cr.created_by === actor && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>awaiting another approver</span>}
                  {cr.status === 'in_review' && canApprove && <Action onClick={() => transition(cr.id, 'reject')} icon={<XCircle size={12} />} label="Reject" color="#ef4444" />}
                  {cr.status === 'approved' && canApprove && <Action onClick={() => transition(cr.id, 'deploy')} icon={<Rocket size={12} />} label="Deploy" color="#22c55e" />}
                  {cr.status === 'deployed' && canApprove && <Action onClick={() => transition(cr.id, 'rollback')} icon={<Undo2 size={12} />} label="Rollback" color="#ef4444" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* New CR modal with change builder */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{ ...panel, padding: 26, width: 640, maxWidth: '94vw', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>New Change Request</h2>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div><label style={lbl}>Title *</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Q3 mortgage push" style={input} /></div>
              <div><label style={lbl}>Description</label><input value={desc} onChange={e => setDesc(e.target.value)} style={input} /></div>
            </div>

            {/* Builder */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Add a change</div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1 }}><label style={lbl}>Artefact</label>
                  <select value={bType} onChange={e => setBType(e.target.value)} style={input}>
                    {catalogue.map(c => <option key={c.type} value={c.type}>{c.label}</option>)}
                  </select>
                </div>
                <div style={{ flex: 2 }}><label style={lbl}>Which one</label>
                  <select value={bEntityId} onChange={e => pickEntity(e.target.value)} style={input}>
                    <option value="">— select —</option>
                    {bEntities.map(e => <option key={String(e.id)} value={String(e.id)}>{String(e[bNameField] ?? e.id)}</option>)}
                  </select>
                </div>
              </div>

              {selectedEntity && def && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {def.fields.map(f => (
                      <div key={f.key}>
                        <label style={lbl}>{f.label}</label>
                        {f.type === 'select' ? (
                          <select value={bEdits[f.key] ?? ''} onChange={e => setBEdits(s => ({ ...s, [f.key]: e.target.value }))} style={input}>
                            {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} value={bEdits[f.key] ?? ''} onChange={e => setBEdits(s => ({ ...s, [f.key]: e.target.value }))} style={input} />
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={() => addChange('update')} style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid var(--brand-accent)', background: 'rgba(99,102,241,0.08)', color: 'var(--brand-accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>+ Stage field changes</button>
                    <button onClick={() => addChange('archive')} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #fca5a5', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Archive this</button>
                  </div>
                </>
              )}
            </div>

            {/* Staged items */}
            {staged.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={lbl}>Staged changes ({staged.length})</div>
                {staged.map((it, i) => (
                  <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                    <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.1)', color: 'var(--brand-accent)', fontSize: 10, textTransform: 'capitalize' }}>{it.entityType}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{it.entityName}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{it.operation === 'archive' ? 'archive' : Object.keys(it.after).join(', ')}</span>
                    <button onClick={() => setStaged(s => s.filter((_, j) => j !== i))} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>Changes are staged here and only applied to live config when the request is approved and deployed. The author can’t approve their own request.</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setModal(false)} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={createCR} disabled={saving || !title.trim() || staged.length === 0} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: 'var(--brand-accent)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving || !title.trim() || staged.length === 0 ? 0.6 : 1 }}>{saving ? 'Creating…' : 'Create Request'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Action({ onClick, icon, label, color }: { onClick: () => void; icon: React.ReactNode; label: string; color: string }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: `1px solid ${color}55`, background: `${color}12`, color, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{icon} {label}</button>
  );
}
