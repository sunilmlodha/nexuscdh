'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStore, ActionCategory, ActionTopic, Action } from '@/lib/store';
import { usePermission } from '@/lib/auth';
import { Plus, ChevronRight, Edit2, Trash2, X, Save, CheckCircle2, Layers, Brain, ExternalLink } from 'lucide-react';

const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';

// ── DB persistence for the taxonomy tree (categories / topics / actions) ──────
type TaxKind = 'category' | 'topic' | 'action';

/** Create or update a row; returns the saved record (with its real DB id) or null. */
async function persistTaxonomy(kind: TaxKind, fields: Record<string, unknown>, id?: string): Promise<any | null> {
  try {
    const r = await fetch('/api/taxonomy', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, id, tenantId: TENANT_ID, ...fields }),
    });
    const j = await r.json();
    if (!r.ok) { alert(`Could not save: ${j.error ?? r.status}`); return null; }
    return j.data;
  } catch (e) { alert('Could not save — network error.'); return null; }
}

/** Delete a row (cascades on the server). Returns true on success. */
async function deleteTaxonomy(kind: TaxKind, id: string): Promise<boolean> {
  // locally-created rows (non-UUID ids) only live in the store — nothing to delete server-side
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id)) return true;
  try {
    const r = await fetch(`/api/taxonomy?kind=${kind}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!r.ok) { const j = await r.json().catch(() => ({})); alert(`Could not delete: ${j.error ?? r.status}`); return false; }
    return true;
  } catch { alert('Could not delete — network error.'); return false; }
}

const MODEL_TYPES = [
  { value: 'logistic_regression', label: 'Logistic Regression', desc: 'Fast, interpretable, good baseline' },
  { value: 'gradient_boosting',   label: 'Gradient Boosting',   desc: 'Adaptive rate based on signal consistency' },
  { value: 'neural_net',          label: 'Neural Network',      desc: 'Momentum SGD, best for complex patterns' },
  { value: 'bayesian',            label: 'Bayesian',            desc: 'Beta-Binomial — no learning rate, data-driven' },
];

interface ADMModel {
  id: string;
  name: string;
  action_id: string;
  model_type: string;
  status: string;
  auc?: number;
  predictions_today?: number;
  _stats?: { totalDecisions: number; acceptanceRate: number; currentPropensity: number | null };
}

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  live:     { color: '#059669', bg: '#D1FAE5' },
  shadow:   { color: '#6366F1', bg: '#EEF2FF' },
  training: { color: '#D97706', bg: '#FEF3C7' },
  retired:  { color: '#9CA3AF', bg: '#F3F4F6' },
};

// ── Quick ADM panel opened from taxonomy row ──────────────────────────────────

function ActionModelPanel({
  action,
  model,
  onClose,
  onRefresh,
}: {
  action: Action;
  model: ADMModel | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [modelType, setModelType] = useState(model?.model_type ?? 'logistic_regression');
  const [status, setStatus]       = useState(model?.status ?? 'shadow');
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [promoting, setPromoting] = useState(false);

  const save = async () => {
    setSaving(true);
    const body = {
      ...(model?.id ? { id: model.id } : {}),
      name:         `${action.name} — ${MODEL_TYPES.find(m => m.value === modelType)?.label ?? modelType}`,
      description:  `Auto-created from taxonomy for action "${action.name}"`,
      action_id:    action.id,
      model_type:   modelType,
      features:     ['age', 'tenure_months', 'product_count', 'channel_preference', 'churn_score'],
      auc:          0.75,
      lift_at_decile1: 2.0,
      status,
      tenantId:     TENANT_ID,
    };
    await fetch('/api/models', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => { onRefresh(); }, 500);
  };

  const promote = async (newStatus: string) => {
    if (!model) return;
    setPromoting(true);
    await fetch('/api/models', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...model, status: newStatus, tenantId: TENANT_ID }),
    });
    setPromoting(false);
    onRefresh();
  };

  const sc = model ? (STATUS_COLORS[model.status] ?? STATUS_COLORS.retired) : null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 14,
        padding: 28, width: 520, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Brain size={16} color="#6366F1" />
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                Self-Learning Model
              </h2>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{action.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Current model status */}
        {model && (
          <div style={{
            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10,
            padding: '14px 16px', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{model.name}</div>
              {sc && (
                <span style={{ background: sc.bg, color: sc.color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
                  {model.status.charAt(0).toUpperCase() + model.status.slice(1)}
                </span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { label: 'Algorithm', val: MODEL_TYPES.find(m => m.value === model.model_type)?.label ?? model.model_type },
                { label: 'Decisions today', val: model.predictions_today ?? 0 },
                { label: 'Acceptance rate', val: model._stats ? `${(model._stats.acceptanceRate * 100).toFixed(0)}%` : '—' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg-panel)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 3 }}>{s.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{String(s.val)}</div>
                </div>
              ))}
            </div>

            {/* Lifecycle controls */}
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {model.status === 'shadow' && (
                <button onClick={() => promote('live')} disabled={promoting}
                  style={{ padding: '6px 14px', borderRadius: 7, background: '#D1FAE5', color: '#059669', border: '1px solid #6EE7B7', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  {promoting ? 'Promoting…' : '▲ Promote to Live'}
                </button>
              )}
              {model.status === 'live' && (
                <button onClick={() => promote('shadow')} disabled={promoting}
                  style={{ padding: '6px 14px', borderRadius: 7, background: '#EEF2FF', color: '#6366F1', border: '1px solid #C7D2FE', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  {promoting ? '…' : '▼ Demote to Shadow'}
                </button>
              )}
              {model.status !== 'retired' && (
                <button onClick={() => promote('retired')} disabled={promoting}
                  style={{ padding: '6px 14px', borderRadius: 7, background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB', cursor: 'pointer', fontSize: 12 }}>
                  Retire
                </button>
              )}
              <a href="/models" target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 7, background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12, textDecoration: 'none' }}>
                <ExternalLink size={11} /> Full detail
              </a>
            </div>
          </div>
        )}

        {/* Create / reconfigure */}
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          {model ? 'Reconfigure Algorithm' : 'Create Self-Learning Model'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {MODEL_TYPES.map(mt => (
            <button key={mt.value} onClick={() => setModelType(mt.value)}
              style={{
                padding: '10px 12px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                border: `2px solid ${modelType === mt.value ? '#6366F1' : 'var(--border)'}`,
                background: modelType === mt.value ? '#EEF2FF' : 'var(--bg)',
              }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{mt.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{mt.desc}</div>
            </button>
          ))}
        </div>

        {!model && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Initial status
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['shadow', 'live'].map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  style={{
                    padding: '7px 16px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: `2px solid ${status === s ? (STATUS_COLORS[s]?.color ?? '#6366F1') : 'var(--border)'}`,
                    background: status === s ? (STATUS_COLORS[s]?.bg ?? '#EEF2FF') : 'var(--bg)',
                    color: status === s ? (STATUS_COLORS[s]?.color ?? '#6366F1') : 'var(--text-muted)',
                  }}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Info box */}
        <div style={{ background: '#F0F0FF', border: '1px solid #C7D2FE', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#4338CA' }}>
          <strong>Shadow</strong> — observes decisions and accumulates learning without affecting live propensity scores.{' '}
          <strong>Live</strong> — actively updates <code style={{ fontFamily: 'monospace' }}>base_propensity</code> on every accepted/rejected outcome.
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ padding: '9px 18px', borderRadius: 8, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13 }}>
            Cancel
          </button>
          <button onClick={save} disabled={saving || saved}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 8, background: '#6366F1', color: '#fff', border: 'none', cursor: saving || saved ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
            {saved ? <><CheckCircle2 size={14} /> Saved</> : saving ? 'Saving…' : <><Save size={14} /> {model ? 'Update Algorithm' : 'Create Model'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

const CATEGORY_COLORS = ['#1D4ED8','#7C3AED','#059669','#D97706','#DC2626','#0891B2','#9333EA','#16A34A','#EA580C','#BE185D'];
const CHANNELS_LIST = ['email','web','mobile_app','sms','push','paid_social','display','programmatic','paid_search','branch','call_centre'];

// ── Small modals ─────────────────────────────────────────────────────────────

function CategoryModal({ cat, onClose }: { cat?: ActionCategory; onClose: () => void }) {
  const { addCategory, updateCategory } = useStore();
  const [name, setName]   = useState(cat?.name ?? '');
  const [desc, setDesc]   = useState(cat?.description ?? '');
  const [color, setColor] = useState(cat?.color ?? CATEGORY_COLORS[0]);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    const row = await persistTaxonomy('category', { name, description: desc, color }, cat?.id);
    if (!row) return;
    if (cat) updateCategory(cat.id, { name, description: desc, color });
    else addCategory({ name, description: desc, color }, row.id);
    setSaved(true); setTimeout(onClose, 500);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{cat ? 'Edit Category' : 'New Action Category'}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={16}/></button>
        </div>
        <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="field-group" style={{ marginBottom:0 }}>
            <label className="label">Category Name *</label>
            <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Cross-sell, Retention, Acquisition" autoFocus />
          </div>
          <div className="field-group" style={{ marginBottom:0 }}>
            <label className="label">Description</label>
            <input className="input" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="What decisions does this category cover?" />
          </div>
          <div className="field-group" style={{ marginBottom:0 }}>
            <label className="label">Colour</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {CATEGORY_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  style={{ width:24, height:24, borderRadius:'50%', background:c, border: color===c ? '3px solid var(--text-primary)' : '2px solid transparent', cursor:'pointer' }} />
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={save} className="btn btn-primary btn-sm" disabled={!name.trim()||saved}>
            {saved ? <><CheckCircle2 size={13}/>Saved</> : <><Save size={13}/>Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function TopicModal({ topic, categories, onClose }: { topic?: ActionTopic; categories: ActionCategory[]; onClose: () => void }) {
  const { addTopic, updateTopic } = useStore();
  const [name, setName]     = useState(topic?.name ?? '');
  const [desc, setDesc]     = useState(topic?.description ?? '');
  const [catId, setCatId]   = useState(topic?.categoryId ?? categories[0]?.id ?? '');
  const [saved, setSaved]   = useState(false);

  const save = async () => {
    if (!name.trim() || !catId) return;
    const row = await persistTaxonomy('topic', { name, description: desc, categoryId: catId }, topic?.id);
    if (!row) return;
    if (topic) updateTopic(topic.id, { name, description: desc, categoryId: catId });
    else addTopic({ name, description: desc, categoryId: catId }, row.id);
    setSaved(true); setTimeout(onClose, 500);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{topic ? 'Edit Topic' : 'New Action Topic'}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={16}/></button>
        </div>
        <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="field-group" style={{ marginBottom:0 }}>
            <label className="label">Category *</label>
            <select className="input select" value={catId} onChange={e=>setCatId(e.target.value)}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field-group" style={{ marginBottom:0 }}>
            <label className="label">Topic Name *</label>
            <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Credit Card Upgrade, Savings Account" autoFocus />
          </div>
          <div className="field-group" style={{ marginBottom:0 }}>
            <label className="label">Description</label>
            <input className="input" value={desc} onChange={e=>setDesc(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={save} className="btn btn-primary btn-sm" disabled={!name.trim()||!catId||saved}>
            {saved ? <><CheckCircle2 size={13}/>Saved</> : <><Save size={13}/>Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionModal({ action, topics, categories, onClose }: { action?: Action; topics: ActionTopic[]; categories: ActionCategory[]; onClose: () => void }) {
  const { addAction, updateAction } = useStore();
  const [name, setName]         = useState(action?.name ?? '');
  const [desc, setDesc]         = useState(action?.description ?? '');
  const [topicId, setTopicId]   = useState(action?.topicId ?? topics[0]?.id ?? '');
  const [headline, setHeadline] = useState(action?.headline ?? '');
  const [body, setBody]         = useState(action?.body ?? '');
  const [cta, setCta]           = useState(action?.ctaLabel ?? '');
  const [code, setCode]         = useState(action?.offerCode ?? '');
  const [value, setValue]       = useState(String(action?.value ?? ''));
  const [propensity, setPropensity] = useState(String(action?.basePropensity ?? 0.5));
  const [selChannels, setSelChannels] = useState<string[]>(action?.channels ?? []);
  const [status, setStatus]     = useState<Action['status']>(action?.status ?? 'draft');
  const [saved, setSaved]       = useState(false);

  const toggleCh = (ch: string) => setSelChannels(p => p.includes(ch) ? p.filter(c=>c!==ch) : [...p, ch]);
  const topic = topics.find(t => t.id === topicId);

  const save = async () => {
    if (!name.trim() || !topicId) return;
    const payload = { name, description:desc, topicId, categoryId: topic?.categoryId??'', headline, body, ctaLabel:cta, offerCode:code, value:value?+value:undefined, basePropensity:+propensity, channels:selChannels as any, status };
    const row = await persistTaxonomy('action', payload, action?.id);
    if (!row) return;
    if (action) updateAction(action.id, payload);
    else addAction(payload, row.id);
    setSaved(true); setTimeout(onClose, 500);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:640 }}>
        <div className="modal-header">
          <span className="modal-title">{action ? 'Edit Action' : 'New Action'}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={16}/></button>
        </div>
        <div className="modal-body" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div className="field-group" style={{ marginBottom:0, gridColumn:'1/-1' }}>
            <label className="label">Topic *</label>
            <select className="input select" value={topicId} onChange={e=>setTopicId(e.target.value)}>
              {topics.map(t => {
                const cat = categories.find(c=>c.id===t.categoryId);
                return <option key={t.id} value={t.id}>{cat?.name} › {t.name}</option>;
              })}
            </select>
          </div>
          <div className="field-group" style={{ marginBottom:0, gridColumn:'1/-1' }}>
            <label className="label">Action Name *</label>
            <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Platinum Credit Card Upgrade" autoFocus />
          </div>
          <div className="field-group" style={{ marginBottom:0 }}>
            <label className="label">Headline</label>
            <input className="input" value={headline} onChange={e=>setHeadline(e.target.value)} placeholder="e.g. Upgrade to Platinum today" />
          </div>
          <div className="field-group" style={{ marginBottom:0 }}>
            <label className="label">CTA Label</label>
            <input className="input" value={cta} onChange={e=>setCta(e.target.value)} placeholder="e.g. Find out more" />
          </div>
          <div className="field-group" style={{ marginBottom:0 }}>
            <label className="label">Offer Code</label>
            <input className="input" value={code} onChange={e=>setCode(e.target.value)} placeholder="e.g. PLAT2026" style={{ fontFamily:'var(--font-mono)' }} />
          </div>
          <div className="field-group" style={{ marginBottom:0 }}>
            <label className="label">Base Propensity (0–1)</label>
            <input className="input" type="number" min={0} max={1} step={0.01} value={propensity} onChange={e=>setPropensity(e.target.value)} />
          </div>
          <div className="field-group" style={{ marginBottom:0 }}>
            <label className="label">Expected Value (£)</label>
            <input className="input" type="number" value={value} onChange={e=>setValue(e.target.value)} placeholder="e.g. 450" />
          </div>
          <div className="field-group" style={{ marginBottom:0 }}>
            <label className="label">Status</label>
            <select className="input select" value={status} onChange={e=>setStatus(e.target.value as any)}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="field-group" style={{ marginBottom:0, gridColumn:'1/-1' }}>
            <label className="label">Channels</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
              {CHANNELS_LIST.map(ch => (
                <button key={ch} onClick={() => toggleCh(ch)}
                  className={selChannels.includes(ch) ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                  style={{ textTransform:'capitalize' }}>
                  {ch.replace(/_/g,' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={save} className="btn btn-primary btn-sm" disabled={!name.trim()||!topicId||saved}>
            {saved ? <><CheckCircle2 size={13}/>Saved</> : <><Save size={13}/>Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function TaxonomyPage() {
  const { categories, topics, actions, deleteCategory, deleteTopic, deleteAction } = useStore();
  const canWrite = usePermission('taxonomy:write');
  const [modal, setModal] = useState<
    | { type:'category'; data?: ActionCategory }
    | { type:'topic'; data?: ActionTopic }
    | { type:'action'; data?: Action }
    | null
  >(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  // ADM state
  const [models, setModels] = useState<ADMModel[]>([]);
  const [admPanel, setAdmPanel] = useState<Action | null>(null);

  const loadModels = useCallback(async () => {
    try {
      const r = await fetch(`/api/models?tenantId=${TENANT_ID}`);
      const d = await r.json();
      setModels(d.data ?? []);
    } catch { /* Supabase not configured — silently skip */ }
  }, []);

  useEffect(() => { loadModels(); }, [loadModels]);

  const modelByActionId = Object.fromEntries(models.map(m => [m.action_id as string, m]));

  const visibleTopics = topics.filter(t => !activeCat || t.categoryId === activeCat);
  const visibleActions = actions.filter(a => {
    if (activeTopic) return a.topicId === activeTopic;
    if (activeCat)   return a.categoryId === activeCat;
    return true;
  });

  return (
    <div className="animate-in">
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <h1 className="page-title">Taxonomy</h1>
          <p className="page-subtitle">Action Category → Topic → Action hierarchy · configures what the decision engine can offer</p>
        </div>
        {canWrite && (
          <div style={{ display:'flex', gap:8, paddingTop:24 }}>
            <button onClick={() => setModal({type:'category'})} className="btn btn-secondary btn-sm"><Plus size={13}/> Category</button>
            <button onClick={() => setModal({type:'topic'})} className="btn btn-secondary btn-sm" disabled={categories.length===0}><Plus size={13}/> Topic</button>
            <button onClick={() => setModal({type:'action'})} className="btn btn-primary btn-sm" disabled={topics.length===0}><Plus size={13}/> Action</button>
          </div>
        )}
      </div>

      <div style={{ padding:'0 24px 24px', display:'grid', gridTemplateColumns:'200px 220px 1fr', gap:16 }}>

        {/* Categories */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div className="card-header" style={{ padding:'12px 14px' }}>
            <span className="card-title" style={{ fontSize:11 }}>Categories</span>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>{categories.length}</span>
          </div>
          {categories.length === 0 ? (
            <div style={{ padding:'20px 14px', textAlign:'center' }}>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8 }}>No categories yet</div>
              {canWrite && <button onClick={() => setModal({type:'category'})} className="btn btn-primary btn-sm" style={{ fontSize:11 }}><Plus size={11}/>Add</button>}
            </div>
          ) : (
            <div style={{ overflowY:'auto' }}>
              {categories.map(cat => (
                <div key={cat.id} onClick={() => { setActiveCat(activeCat===cat.id?null:cat.id); setActiveTopic(null); }}
                  style={{ padding:'9px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid #F3F4F6',
                    background: activeCat===cat.id ? 'var(--bg)' : '',
                    borderLeft: activeCat===cat.id ? `3px solid ${cat.color}` : '3px solid transparent',
                  }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:cat.color, flexShrink:0 }} />
                  <span style={{ flex:1, fontSize:12, fontWeight:activeCat===cat.id?700:500, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cat.name}</span>
                  <span style={{ fontSize:10, color:'var(--text-muted)' }}>{topics.filter(t=>t.categoryId===cat.id).length}</span>
                  {canWrite && (
                    <div style={{ display:'flex', gap:2 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => setModal({type:'category', data:cat})} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:2 }}><Edit2 size={11}/></button>
                      <button onClick={async () => { if (confirm(`Delete "${cat.name}" and all its topics and actions?`) && await deleteTaxonomy('category', cat.id)) deleteCategory(cat.id); }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:2 }}><Trash2 size={11}/></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Topics */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div className="card-header" style={{ padding:'12px 14px' }}>
            <span className="card-title" style={{ fontSize:11 }}>Topics</span>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>{visibleTopics.length}</span>
          </div>
          {visibleTopics.length === 0 ? (
            <div style={{ padding:'20px 14px', textAlign:'center' }}>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8 }}>
                {categories.length === 0 ? 'Create a category first' : 'No topics yet'}
              </div>
              {canWrite && categories.length > 0 && <button onClick={() => setModal({type:'topic'})} className="btn btn-secondary btn-sm" style={{ fontSize:11 }}><Plus size={11}/>Add</button>}
            </div>
          ) : (
            <div style={{ overflowY:'auto' }}>
              {visibleTopics.map(t => {
                const cat = categories.find(c=>c.id===t.categoryId);
                return (
                  <div key={t.id} onClick={() => setActiveTopic(activeTopic===t.id?null:t.id)}
                    style={{ padding:'9px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid #F3F4F6',
                      background: activeTopic===t.id ? 'var(--bg)' : '',
                      borderLeft: activeTopic===t.id ? `3px solid ${cat?.color??'var(--brand-accent)'}` : '3px solid transparent',
                    }}>
                    <span style={{ flex:1, fontSize:12, fontWeight:activeTopic===t.id?700:500, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</span>
                    <span style={{ fontSize:10, color:'var(--text-muted)' }}>{actions.filter(a=>a.topicId===t.id).length}</span>
                    {canWrite && (
                      <div style={{ display:'flex', gap:2 }} onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>setModal({type:'topic',data:t})} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:2 }}><Edit2 size={11}/></button>
                        <button onClick={async ()=>{ if (confirm(`Delete "${t.name}"?`) && await deleteTaxonomy('topic', t.id)) deleteTopic(t.id); }} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:2 }}><Trash2 size={11}/></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div className="card-header">
            <span className="card-title">Actions <span style={{ fontWeight:400, color:'var(--text-muted)', marginLeft:6 }}>{visibleActions.length}</span></span>
            {canWrite && <button onClick={() => setModal({type:'action'})} disabled={topics.length===0} className="btn btn-primary btn-sm"><Plus size={13}/>New Action</button>}
          </div>
          {visibleActions.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize:32, marginBottom:8, opacity:0.2 }}>⚡</div>
              <div className="empty-state-title">{topics.length===0 ? 'Create a topic first' : 'No actions yet'}</div>
              {canWrite && topics.length > 0 && <button onClick={()=>setModal({type:'action'})} className="btn btn-primary btn-sm" style={{ marginTop:12 }}><Plus size={13}/>Add action</button>}
            </div>
          ) : (
            <table className="table">
              <thead><tr><th>Action</th><th>Topic</th><th>Channels</th><th>Propensity</th><th>Status</th><th>ADM</th><th></th></tr></thead>
              <tbody>
                {visibleActions.map(a => {
                  const topic = topics.find(t=>t.id===a.topicId);
                  const cat   = categories.find(c=>c.id===a.categoryId);
                  const adm   = modelByActionId[a.id];
                  const sc    = adm ? (STATUS_COLORS[adm.status] ?? STATUS_COLORS.retired) : null;
                  return (
                    <tr key={a.id}>
                      <td>
                        <div style={{ fontWeight:600, fontSize:13 }}>{a.name}</div>
                        {a.offerCode && <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>{a.offerCode}</div>}
                      </td>
                      <td>
                        {cat && <span className="badge" style={{ background:cat.color+'18', color:cat.color, marginBottom:3, display:'block', width:'fit-content' }}>{cat.name}</span>}
                        <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{topic?.name}</div>
                      </td>
                      <td style={{ fontSize:12, color:'var(--text-secondary)' }}>
                        {a.channels.length > 0 ? a.channels.map(c=>c.replace(/_/g,' ')).join(', ') : '—'}
                      </td>
                      <td style={{ fontWeight:700, color:'var(--brand-accent)', fontFamily:'var(--font-mono)' }}>{a.basePropensity.toFixed(2)}</td>
                      <td>
                        <span className={`badge ${a.status==='active'?'badge-green':a.status==='draft'?'badge-gray':'badge-amber'}`}>{a.status}</span>
                      </td>
                      <td>
                        <button
                          onClick={() => setAdmPanel(a)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            cursor: 'pointer', border: `1px solid ${adm && sc ? sc.color+'44' : 'var(--border)'}`,
                            background: adm ? (sc?.bg ?? 'var(--bg)') : 'var(--bg)',
                            color: adm ? (sc?.color ?? 'var(--text-muted)') : 'var(--text-muted)',
                          }}
                        >
                          <Brain size={11} />
                          {adm
                            ? adm.status.charAt(0).toUpperCase() + adm.status.slice(1)
                            : 'Set up'}
                        </button>
                      </td>
                      <td>
                        {canWrite && (
                          <div style={{ display:'flex', gap:4 }}>
                            <button onClick={()=>setModal({type:'action',data:a})} className="btn btn-ghost btn-sm" style={{ padding:'4px 8px' }}><Edit2 size={12}/></button>
                            <button onClick={async ()=>{ if (confirm(`Delete "${a.name}"?`) && await deleteTaxonomy('action', a.id)) deleteAction(a.id); }} className="btn btn-ghost btn-sm" style={{ padding:'4px 8px', color:'var(--danger)' }}><Trash2 size={12}/></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modals */}
      {modal?.type==='category' && <CategoryModal cat={modal.data} onClose={()=>setModal(null)} />}
      {modal?.type==='topic'    && <TopicModal topic={modal.data} categories={categories} onClose={()=>setModal(null)} />}
      {modal?.type==='action'   && <ActionModal action={modal.data} topics={topics} categories={categories} onClose={()=>setModal(null)} />}
      {admPanel && (
        <ActionModelPanel
          action={admPanel}
          model={modelByActionId[admPanel.id] ?? null}
          onClose={() => setAdmPanel(null)}
          onRefresh={() => { loadModels(); setAdmPanel(null); }}
        />
      )}
    </div>
  );
}
