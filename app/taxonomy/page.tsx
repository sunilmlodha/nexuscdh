'use client';

import { useState } from 'react';
import { useStore, ActionCategory, ActionTopic, Action } from '@/lib/store';
import { usePermission } from '@/lib/auth';
import { Plus, ChevronRight, Edit2, Trash2, X, Save, CheckCircle2, Layers } from 'lucide-react';

const CATEGORY_COLORS = ['#1D4ED8','#7C3AED','#059669','#D97706','#DC2626','#0891B2','#9333EA','#16A34A','#EA580C','#BE185D'];
const CHANNELS_LIST = ['email','web','mobile_app','sms','push','paid_social','display','programmatic','paid_search','branch','call_centre'];

// ── Small modals ─────────────────────────────────────────────────────────────

function CategoryModal({ cat, onClose }: { cat?: ActionCategory; onClose: () => void }) {
  const { addCategory, updateCategory } = useStore();
  const [name, setName]   = useState(cat?.name ?? '');
  const [desc, setDesc]   = useState(cat?.description ?? '');
  const [color, setColor] = useState(cat?.color ?? CATEGORY_COLORS[0]);
  const [saved, setSaved] = useState(false);

  const save = () => {
    if (!name.trim()) return;
    if (cat) updateCategory(cat.id, { name, description: desc, color });
    else addCategory({ name, description: desc, color });
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

  const save = () => {
    if (!name.trim() || !catId) return;
    if (topic) updateTopic(topic.id, { name, description: desc, categoryId: catId });
    else addTopic({ name, description: desc, categoryId: catId });
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

  const save = () => {
    if (!name.trim() || !topicId) return;
    const payload = { name, description:desc, topicId, categoryId: topic?.categoryId??'', headline, body, ctaLabel:cta, offerCode:code, value:value?+value:undefined, basePropensity:+propensity, channels:selChannels as any, status };
    if (action) updateAction(action.id, payload);
    else addAction(payload);
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
                      <button onClick={() => confirm(`Delete "${cat.name}" and all its topics and actions?`) && deleteCategory(cat.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:2 }}><Trash2 size={11}/></button>
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
                        <button onClick={()=>confirm(`Delete "${t.name}"?`)&&deleteTopic(t.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:2 }}><Trash2 size={11}/></button>
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
              <thead><tr><th>Action</th><th>Topic</th><th>Channels</th><th>Propensity</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {visibleActions.map(a => {
                  const topic = topics.find(t=>t.id===a.topicId);
                  const cat   = categories.find(c=>c.id===a.categoryId);
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
                        {canWrite && (
                          <div style={{ display:'flex', gap:4 }}>
                            <button onClick={()=>setModal({type:'action',data:a})} className="btn btn-ghost btn-sm" style={{ padding:'4px 8px' }}><Edit2 size={12}/></button>
                            <button onClick={()=>confirm(`Delete "${a.name}"?`)&&deleteAction(a.id)} className="btn btn-ghost btn-sm" style={{ padding:'4px 8px', color:'var(--danger)' }}><Trash2 size={12}/></button>
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
    </div>
  );
}
