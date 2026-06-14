'use client';
import { useState } from 'react';
import { useStore, Audience, SegmentRule, RuleOp } from '@/lib/store';
import { usePermission } from '@/lib/auth';
import { Plus, Edit2, Trash2, X, Save, CheckCircle2, Share2, CheckCircle } from 'lucide-react';

type SyncPlatform = 'meta' | 'google' | 'linkedin' | 'tiktok' | 'programmatic';

const PLATFORMS: { id: SyncPlatform; label: string; icon: string; color: string }[] = [
  { id: 'meta',         label: 'Meta Ads',        icon: 'f', color: '#1877f2' },
  { id: 'google',       label: 'Google Ads',       icon: 'G', color: '#ea4335' },
  { id: 'linkedin',     label: 'LinkedIn',         icon: 'in', color: '#0a66c2' },
  { id: 'tiktok',       label: 'TikTok',           icon: 'tt', color: '#010101' },
  { id: 'programmatic', label: 'Programmatic DSP', icon: '◈',  color: '#7c3aed' },
];

function SyncModal({ audienceId, audienceName, onClose }: { audienceId: string; audienceName: string; onClose: () => void }) {
  const [platform, setPlatform] = useState<SyncPlatform>('meta');
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ jobId: string; profileCount: number; note: string } | null>(null);

  const doSync = async () => {
    setSyncing(true);
    const r = await fetch('/api/audiences/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audienceId, platform, tenantId: 'default-tenant' }),
    });
    const j = await r.json();
    setSyncing(false);
    setResult({ jobId: j.jobId, profileCount: j.profileCount ?? 0, note: j.note ?? '' });
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <span className="modal-title"><Share2 size={14} style={{ marginRight: 6 }} />Sync to Paid Media — {audienceName}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {result ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a' }}>
                <CheckCircle size={18} /> <span style={{ fontWeight: 600 }}>Sync job queued</span>
              </div>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div><span style={{ color: 'var(--text-muted)' }}>Job ID:</span> <code>{result.jobId}</code></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Profiles:</span> {result.profileCount.toLocaleString()}</div>
                <div><span style={{ color: 'var(--text-muted)' }}>PII hashing:</span> SHA-256 (email + phone)</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 6, padding: 10 }}>
                {result.note}
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="form-label">Target Platform</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {PLATFORMS.map(p => (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: `1px solid ${platform === p.id ? p.color : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', background: platform === p.id ? p.color + '11' : 'transparent' }}>
                      <input type="radio" name="platform" checked={platform === p.id} onChange={() => setPlatform(p.id)} />
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 11 }}>{p.icon}</div>
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: 10 }}>
                Profiles are hashed with SHA-256 before upload. Connect platform credentials in Settings → Integrations to enable live sync.
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{result ? 'Close' : 'Cancel'}</button>
          {!result && (
            <button className="btn btn-primary" onClick={doSync} disabled={syncing}>
              <Share2 size={13} /> {syncing ? 'Queuing…' : 'Sync Audience'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const OPS: RuleOp[] = ['>=','<=','=','!=','IN','NOT IN','CONTAINS','STARTS_WITH'];

function AudienceModal({ aud, onClose }: { aud?: Audience; onClose: ()=>void }) {
  const { addAudience, updateAudience } = useStore();
  const [name, setName]   = useState(aud?.name??'');
  const [desc, setDesc]   = useState(aud?.description??'');
  const [rules, setRules] = useState<SegmentRule[]>(aud?.rules??[]);
  const [size, setSize]   = useState(aud?.estimatedSize??undefined);
  const [status, setStatus] = useState(aud?.status??'draft');
  const [saved, setSaved] = useState(false);

  const addRule = () => setRules(p=>[...p,{attribute:'age',op:'>=',value:'18'}]);
  const updateRule = (i:number, patch: Partial<SegmentRule>) => setRules(p=>p.map((r,j)=>j===i?{...r,...patch}:r));
  const removeRule = (i:number) => setRules(p=>p.filter((_,j)=>j!==i));

  const save = () => {
    if (!name.trim()) return;
    const payload = { name, description:desc, rules, estimatedSize:size, status: status as any };
    if (aud) updateAudience(aud.id, payload);
    else addAudience(payload);
    setSaved(true); setTimeout(onClose, 500);
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:600 }}>
        <div className="modal-header"><span className="modal-title">{aud?'Edit Audience':'New Audience'}</span>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)' }}><X size={16}/></button></div>
        <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div className="field-group" style={{ marginBottom:0, gridColumn:'1/-1' }}><label className="label">Audience Name *</label>
              <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. High Value Customers" autoFocus /></div>
            <div className="field-group" style={{ marginBottom:0 }}><label className="label">Estimated Size</label>
              <input className="input" type="number" value={size??''} onChange={e=>setSize(+e.target.value||undefined)} placeholder="optional" /></div>
            <div className="field-group" style={{ marginBottom:0 }}><label className="label">Status</label>
              <select className="input select" value={status} onChange={e=>setStatus(e.target.value as any)}>
                <option value="draft">Draft</option><option value="active">Active</option></select></div>
          </div>
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <label className="label" style={{ margin:0 }}>Segment Rules</label>
              <button onClick={addRule} className="btn btn-secondary btn-sm"><Plus size={11}/>Add rule</button>
            </div>
            {rules.length===0 ? <div style={{ fontSize:12, color:'var(--text-muted)' }}>No rules — audience will include all customers.</div> : (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {rules.map((r,i)=>(
                  <div key={i} style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input className="input" value={r.attribute} onChange={e=>updateRule(i,{attribute:e.target.value})} placeholder="attribute" style={{ flex:1.5, fontFamily:'var(--font-mono)', fontSize:12 }} />
                    <select className="input select" value={r.op} onChange={e=>updateRule(i,{op:e.target.value as RuleOp})} style={{ width:100 }}>
                      {OPS.map(o=><option key={o}>{o}</option>)}
                    </select>
                    <input className="input" value={r.value} onChange={e=>updateRule(i,{value:e.target.value})} placeholder="value" style={{ flex:1 }} />
                    {i>0&&<select className="input select" value={r.logicOp??'AND'} onChange={e=>updateRule(i,{logicOp:e.target.value as any})} style={{ width:64, fontSize:11 }}>
                      <option>AND</option><option>OR</option></select>}
                    <button onClick={()=>removeRule(i)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:4 }}><X size={13}/></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={save} disabled={!name.trim()||saved} className="btn btn-primary btn-sm">
            {saved?<><CheckCircle2 size={13}/>Saved</>:<><Save size={13}/>Save</>}</button>
        </div>
      </div>
    </div>
  );
}

export default function AudiencesPage() {
  const { audiences, deleteAudience } = useStore();
  const canWrite = usePermission('audiences:write');
  const [modal, setModal] = useState<{data?:Audience}|null>(null);
  const [syncModal, setSyncModal] = useState<{ id: string; name: string } | null>(null);

  return (
    <div className="animate-in">
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div><h1 className="page-title">Audiences</h1>
          <p className="page-subtitle">Define customer segments using profile attributes and behavioural signals</p></div>
        {canWrite&&<div style={{ paddingTop:24 }}><button onClick={()=>setModal({})} className="btn btn-primary btn-sm"><Plus size={13}/>New Audience</button></div>}
      </div>
      <div style={{ padding:'0 24px 24px' }}>
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          {audiences.length===0 ? (
            <div className="empty-state">
              <div style={{ fontSize:32, marginBottom:8, opacity:0.2 }}>👥</div>
              <div className="empty-state-title">No audiences defined</div>
              <div className="empty-state-body">Audiences let you target specific customer segments in your strategies.</div>
              {canWrite&&<button onClick={()=>setModal({})} className="btn btn-primary btn-sm"><Plus size={13}/>Create audience</button>}
            </div>
          ) : (
            <table className="table">
              <thead><tr><th>Audience</th><th>Rules</th><th>Size</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {audiences.map(a=>(
                  <tr key={a.id}>
                    <td><div style={{ fontWeight:600 }}>{a.name}</div>
                        {a.description&&<div style={{ fontSize:12, color:'var(--text-muted)' }}>{a.description}</div>}</td>
                    <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{a.rules.length} rules</td>
                    <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{a.estimatedSize?a.estimatedSize.toLocaleString():'—'}</td>
                    <td><span className={a.status==='active'?'badge badge-green':'badge badge-gray'}>{a.status}</span></td>
                    <td><div style={{ display:'flex', gap:4 }}>
                      <button onClick={() => setSyncModal({ id: a.id, name: a.name })} className="btn btn-ghost btn-sm" style={{ padding:'4px 8px' }} title="Sync to paid media"><Share2 size={12}/></button>
                      {canWrite&&<>
                        <button onClick={()=>setModal({data:a})} className="btn btn-ghost btn-sm" style={{ padding:'4px 8px' }}><Edit2 size={12}/></button>
                        <button onClick={()=>confirm(`Delete "${a.name}"?`)&&deleteAudience(a.id)} className="btn btn-ghost btn-sm" style={{ padding:'4px 8px', color:'var(--danger)' }}><Trash2 size={12}/></button>
                      </>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {modal&&<AudienceModal aud={modal.data} onClose={()=>setModal(null)} />}
      {syncModal && <SyncModal audienceId={syncModal.id} audienceName={syncModal.name} onClose={() => setSyncModal(null)} />}
    </div>
  );
}
