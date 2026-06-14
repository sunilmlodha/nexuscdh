'use client';
import { useState } from 'react';
import { useStore, Strategy, INDUSTRY_TEMPLATES } from '@/lib/store';
import { usePermission } from '@/lib/auth';
import { Plus, Edit2, Trash2, Play, Pause, X, Save, CheckCircle2, GitBranch, Clock } from 'lucide-react';

const ARBITRATION_LABELS = { propensity:'Highest propensity', value:'Highest value', weighted:'Weighted score', random_ab:'A/B test' };
const PRIORITY_BADGE: Record<string,string> = { low:'badge-gray', standard:'badge-blue', high:'badge-amber', critical:'badge-red' };
const STATUS_COLOR = { active:'badge-green', draft:'badge-gray', paused:'badge-amber', ended:'badge-red' };

function StrategyModal({ strategy, onClose }: { strategy?: Strategy; onClose: () => void }) {
  const { categories, topics, actions, channels, policies, audiences, addStrategy, updateStrategy } = useStore();
  const [name, setName]     = useState(strategy?.name ?? '');
  const [desc, setDesc]     = useState(strategy?.description ?? '');
  const [catId, setCatId]   = useState(strategy?.categoryId ?? '');
  const [topicId, setTopicId] = useState(strategy?.topicId ?? '');
  const [selActions, setSelActions] = useState<string[]>(strategy?.actionIds ?? []);
  const [selChannels, setSelChannels] = useState<string[]>(strategy?.channelIds ?? []);
  const [selAudiences, setSelAudiences] = useState<string[]>(strategy?.audienceIds ?? []);
  const [policyId, setPolicyId] = useState(strategy?.policyId ?? '');
  const [arbitration, setArbitration] = useState(strategy?.arbitration ?? 'propensity');
  const [priority, setPriority] = useState(strategy?.priority ?? 'standard');
  const [status, setStatus] = useState(strategy?.status ?? 'draft');
  const [tab, setTab]       = useState('scope');
  const [saved, setSaved]   = useState(false);

  const topicActions = actions.filter(a => (!topicId || a.topicId===topicId) && (!catId || a.categoryId===catId));
  const toggle = (arr: string[], id: string) => arr.includes(id) ? arr.filter(x=>x!==id) : [...arr, id];

  const save = () => {
    if (!name.trim()) return;
    const payload = { name, description:desc, categoryId:catId||undefined, topicId:topicId||undefined, actionIds:selActions, channelIds:selChannels as any, audienceIds:selAudiences, policyId:policyId||undefined, arbitration: arbitration as any, priority: priority as any, status: status as any };
    if (strategy) updateStrategy(strategy.id, payload);
    else addStrategy(payload);
    setSaved(true); setTimeout(onClose, 500);
  };

  const TABS = ['scope','actions','channels','arbitration'];

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:680, maxHeight:'85vh' }}>
        <div className="modal-header">
          <span className="modal-title">{strategy?'Edit Strategy':'New Strategy'}</span>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)' }}><X size={16}/></button>
        </div>

        {/* Basic fields */}
        <div style={{ padding:'16px 24px 0', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
          <div className="field-group" style={{ marginBottom:0, gridColumn:'1/-1' }}>
            <label className="label">Strategy Name *</label>
            <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Credit Card Cross-sell — Digital" autoFocus />
          </div>
          <div className="field-group" style={{ marginBottom:0 }}>
            <label className="label">Priority</label>
            <select className="input select" value={priority} onChange={e=>setPriority(e.target.value as any)}>
              {['low','standard','high','critical'].map(p=><option key={p} value={p} style={{ textTransform:'capitalize' }}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
            </select>
          </div>
          <div className="field-group" style={{ marginBottom:0 }}>
            <label className="label">Status</label>
            <select className="input select" value={status} onChange={e=>setStatus(e.target.value as any)}>
              <option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option>
            </select>
          </div>
          <div className="field-group" style={{ marginBottom:0 }}>
            <label className="label">Engagement Policy</label>
            <select className="input select" value={policyId} onChange={e=>setPolicyId(e.target.value)}>
              <option value="">None</option>
              {policies.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:0, borderBottom:'1px solid var(--border)', padding:'0 24px', marginTop:16 }}>
          {TABS.map(t=>(
            <div key={t} className="tab" data-active={tab===t||undefined} onClick={()=>setTab(t)} style={{ textTransform:'capitalize', fontSize:12 }}>{t}</div>
          ))}
        </div>

        <div style={{ padding:'20px 24px', maxHeight:260, overflowY:'auto' }}>

          {tab==='scope' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="field-group" style={{ marginBottom:0 }}>
                <label className="label">Category</label>
                <select className="input select" value={catId} onChange={e=>{ setCatId(e.target.value); setTopicId(''); setSelActions([]); }}>
                  <option value="">All categories</option>
                  {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field-group" style={{ marginBottom:0 }}>
                <label className="label">Topic</label>
                <select className="input select" value={topicId} onChange={e=>{ setTopicId(e.target.value); setSelActions([]); }}>
                  <option value="">All topics</option>
                  {topics.filter(t=>!catId||t.categoryId===catId).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label className="label">Target Audiences</label>
                {audiences.length===0 ? <div style={{ fontSize:12, color:'var(--text-muted)' }}>No audiences configured. Create them in Audiences.</div> : (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {audiences.map(a=>(
                      <button key={a.id} onClick={()=>setSelAudiences(p=>toggle(p,a.id))}
                        className={selAudiences.includes(a.id)?'btn btn-primary btn-sm':'btn btn-secondary btn-sm'}>{a.name}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab==='actions' && (
            <div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:10 }}>Select actions from your taxonomy. {topicActions.length===0?'No actions match the scope filter.':''}</div>
              {topicActions.length===0 ? (
                <div className="alert alert-warning" style={{ fontSize:12 }}>No actions found. Create actions in Taxonomy first, or broaden the scope filter.</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {topicActions.map(a => {
                    const cat = categories.find(c=>c.id===a.categoryId);
                    return (
                      <label key={a.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', border:`1px solid ${selActions.includes(a.id)?'var(--brand-accent)':'var(--border)'}`, borderRadius:8, cursor:'pointer', background:selActions.includes(a.id)?'#EFF6FF':'white', transition:'all 0.15s' }}>
                        <input type="checkbox" checked={selActions.includes(a.id)} onChange={()=>setSelActions(p=>toggle(p,a.id))} />
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:600, fontSize:13 }}>{a.name}</div>
                          {cat && <span className="badge" style={{ background:cat.color+'18', color:cat.color, fontSize:10 }}>{cat.name}</span>}
                        </div>
                        <div style={{ fontWeight:700, fontSize:12, color:'var(--brand-accent)', fontFamily:'var(--font-mono)' }}>{a.basePropensity.toFixed(2)}</div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab==='channels' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {channels.map(ch => (
                <label key={ch.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', border:`1px solid ${selChannels.includes(ch.id)?'var(--brand-accent)':'var(--border)'}`, borderRadius:8, cursor:'pointer', background:selChannels.includes(ch.id)?'#EFF6FF':'white', transition:'all 0.15s', opacity:ch.enabled?1:0.5 }}>
                  <input type="checkbox" checked={selChannels.includes(ch.id)} onChange={()=>setSelChannels(p=>toggle(p,ch.id))} disabled={!ch.enabled} />
                  <span>{ch.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:600 }}>{ch.name}</div>
                    <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'capitalize' }}>{ch.type} · {ch.latency.replace(/_/g,' ')}</div>
                  </div>
                  {!ch.enabled && <span style={{ fontSize:10, color:'var(--text-muted)' }}>Disabled</span>}
                </label>
              ))}
            </div>
          )}

          {tab==='arbitration' && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>When multiple actions qualify, how should the best action be selected?</div>
              {Object.entries(ARBITRATION_LABELS).map(([k,v])=>(
                <label key={k} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 14px', border:`1px solid ${arbitration===k?'var(--brand-accent)':'var(--border)'}`, borderRadius:8, cursor:'pointer', background:arbitration===k?'#EFF6FF':'white' }}>
                  <input type="radio" name="arb" value={k} checked={arbitration===k} onChange={()=>setArbitration(k as any)} style={{ marginTop:2 }} />
                  <div>
                    <div style={{ fontWeight:600, fontSize:13 }}>{v}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                      {k==='propensity'&&'Select action with highest model propensity score.'}
                      {k==='value'&&'Select action with highest expected commercial value.'}
                      {k==='weighted'&&'Weighted combination of propensity and value.'}
                      {k==='random_ab'&&'Random split for A/B testing — tracks acceptance per variant.'}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={save} disabled={!name.trim()||saved} className="btn btn-primary btn-sm">
            {saved?<><CheckCircle2 size={13}/>Saved</>:<><Save size={13}/>Save strategy</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StrategiesPage() {
  const { strategies, categories, deleteStrategy, updateStrategy } = useStore();
  const canWrite = usePermission('strategies:write');
  const [modal, setModal] = useState<{data?:Strategy}|null>(null);
  const [filter, setFilter] = useState<string>('all');

  const visible = filter==='all' ? strategies : strategies.filter(s=>s.status===filter);

  return (
    <div className="animate-in">
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div><h1 className="page-title">Strategies</h1>
          <p className="page-subtitle">{strategies.length} strategies · {strategies.filter(s=>s.status==='active').length} active</p></div>
        {canWrite && <div style={{ paddingTop:24 }}><button onClick={()=>setModal({})} className="btn btn-primary btn-sm"><Plus size={13}/>New Strategy</button></div>}
      </div>

      <div style={{ padding:'0 24px 24px', display:'flex', flexDirection:'column', gap:16 }}>
        <div style={{ display:'flex', gap:6 }}>
          {['all','active','draft','paused'].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} className={filter===f?'btn btn-primary btn-sm':'btn btn-secondary btn-sm'} style={{ textTransform:'capitalize' }}>{f}</button>
          ))}
        </div>

        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          {visible.length===0 ? (
            <div className="empty-state">
              <div style={{ fontSize:32, marginBottom:8, opacity:0.2 }}>🧠</div>
              <div className="empty-state-title">No strategies yet</div>
              <div className="empty-state-body">Strategies combine your taxonomy, audiences, and channels into decision flows.</div>
              {canWrite && <button onClick={()=>setModal({})} className="btn btn-primary btn-sm"><Plus size={13}/>Create strategy</button>}
            </div>
          ) : (
            <table className="table">
              <thead><tr><th>Strategy</th><th>Category</th><th>Channels</th><th>Actions</th><th>Arbitration</th><th>Priority</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {visible.map(s => {
                  const cat = categories.find(c=>c.id===s.categoryId);
                  return (
                    <tr key={s.id}>
                      <td><div style={{ fontWeight:600, fontSize:13 }}>{s.name}</div>
                          <div style={{ fontSize:11, color:'var(--text-muted)' }}>{s.id}</div></td>
                      <td>{cat?<span className="badge" style={{ background:cat.color+'18', color:cat.color }}>{cat.name}</span>:<span className="badge badge-gray">All</span>}</td>
                      <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{s.channelIds.length} ch</td>
                      <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{s.actionIds.length}</td>
                      <td><span className="badge badge-gray" style={{ fontSize:10 }}>{ARBITRATION_LABELS[s.arbitration]}</span></td>
                      <td><span className={`badge ${PRIORITY_BADGE[s.priority]}`} style={{ textTransform:'capitalize' }}>{s.priority}</span></td>
                      <td><span className={`badge ${STATUS_COLOR[s.status]}`}>{s.status}</span></td>
                      <td>
                        <div style={{ display:'flex', gap:4 }} className="group-hover">
                          {canWrite && <>
                            <button onClick={()=>setModal({data:s})} className="btn btn-ghost btn-sm" style={{ padding:'4px 8px' }}><Edit2 size={12}/></button>
                            <button onClick={()=>updateStrategy(s.id,{status:s.status==='active'?'paused':'active'})} className="btn btn-ghost btn-sm" style={{ padding:'4px 8px' }}
                              title={s.status==='active'?'Pause':'Activate'}>{s.status==='active'?<Pause size={12}/>:<Play size={12}/>}</button>
                            <button onClick={()=>confirm(`Delete "${s.name}"?`)&&deleteStrategy(s.id)} className="btn btn-ghost btn-sm" style={{ padding:'4px 8px', color:'var(--danger)' }}><Trash2 size={12}/></button>
                          </>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {modal&&<StrategyModal strategy={modal.data} onClose={()=>setModal(null)} />}
    </div>
  );
}
