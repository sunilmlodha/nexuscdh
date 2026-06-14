'use client';
import { useState } from 'react';
import { useStore, ContactPolicy } from '@/lib/store';
import { usePermission } from '@/lib/auth';
import { Plus, Edit2, Trash2, X, Save, CheckCircle2, Shield } from 'lucide-react';

function PolicyModal({ policy, onClose }: { policy?: ContactPolicy; onClose: ()=>void }) {
  const { addPolicy, updatePolicy, channels } = useStore();
  const [name, setName]   = useState(policy?.name??'');
  const [desc, setDesc]   = useState(policy?.description??'');
  const [maxDay, setMaxDay]  = useState(policy?.maxPerDay??1);
  const [maxWeek, setMaxWeek] = useState(policy?.maxPerWeek??5);
  const [maxMonth, setMaxMonth] = useState(policy?.maxPerMonth??15);
  const [cooldown, setCooldown] = useState(policy?.conversionCooldownDays??30);
  const [requireConsent, setRequireConsent] = useState(policy?.requiresConsent??true);
  const [fairness, setFairness] = useState(policy?.fairnessEnabled??false);
  const [fairnessThreshold, setFairnessThreshold] = useState(policy?.fairnessThreshold??0.85);
  const [fairnessAttr, setFairnessAttr] = useState(policy?.fairnessAttribute??'');
  const [selChannels, setSelChannels] = useState<string[]>(policy?.channelIds??[]);
  const [suppression, setSuppression] = useState<string[]>(policy?.suppressionRules??[]);
  const [newRule, setNewRule] = useState('');
  const [status, setStatus] = useState(policy?.status??'draft');
  const [saved, setSaved] = useState(false);

  const save = () => {
    if (!name.trim()) return;
    const payload = { name, description:desc, maxPerDay:maxDay, maxPerWeek:maxWeek, maxPerMonth:maxMonth, fatigueWindowDays:30, conversionCooldownDays:cooldown, requiresConsent:requireConsent, consentTypes:['marketing'], fairnessEnabled:fairness, fairnessThreshold, fairnessAttribute:fairnessAttr||undefined, channelIds:selChannels as any, suppressionRules:suppression, lobId:undefined, status: status as any };
    if (policy) updatePolicy(policy.id, payload);
    else addPolicy(payload);
    setSaved(true); setTimeout(onClose, 500);
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:640 }}>
        <div className="modal-header"><span className="modal-title">{policy?'Edit Policy':'New Engagement Policy'}</span>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)' }}><X size={16}/></button></div>
        <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div className="field-group" style={{ marginBottom:0, gridColumn:'1/-1' }}><label className="label">Policy Name *</label>
              <input className="input" value={name} onChange={e=>setName(e.target.value)} autoFocus /></div>
            <div className="field-group" style={{ marginBottom:0 }}><label className="label">Max contacts / day</label>
              <input className="input" type="number" min={0} value={maxDay} onChange={e=>setMaxDay(+e.target.value)} /></div>
            <div className="field-group" style={{ marginBottom:0 }}><label className="label">Max contacts / week</label>
              <input className="input" type="number" min={0} value={maxWeek} onChange={e=>setMaxWeek(+e.target.value)} /></div>
            <div className="field-group" style={{ marginBottom:0 }}><label className="label">Max contacts / month</label>
              <input className="input" type="number" min={0} value={maxMonth} onChange={e=>setMaxMonth(+e.target.value)} /></div>
            <div className="field-group" style={{ marginBottom:0 }}><label className="label">Conversion cooldown (days)</label>
              <input className="input" type="number" min={0} value={cooldown} onChange={e=>setCooldown(+e.target.value)} /></div>
          </div>
          <label style={{ display:'flex', gap:8, alignItems:'center', cursor:'pointer' }}>
            <input type="checkbox" checked={requireConsent} onChange={e=>setRequireConsent(e.target.checked)} />
            <span style={{ fontSize:13 }}>Require marketing consent (GDPR/CCPA)</span>
          </label>
          <div style={{ borderTop:'1px solid var(--border)', paddingTop:12 }}>
            <label style={{ display:'flex', gap:8, alignItems:'center', cursor:'pointer', marginBottom:10 }}>
              <input type="checkbox" checked={fairness} onChange={e=>setFairness(e.target.checked)} />
              <span style={{ fontSize:13, fontWeight:600 }}>Enable fairness / bias control</span>
            </label>
            {fairness && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="field-group" style={{ marginBottom:0 }}><label className="label">Protected attribute</label>
                  <input className="input" value={fairnessAttr} onChange={e=>setFairnessAttr(e.target.value)} placeholder="e.g. gender, ethnicity, age_band" /></div>
                <div className="field-group" style={{ marginBottom:0 }}><label className="label">Min representation ({(fairnessThreshold*100).toFixed(0)}%)</label>
                  <input type="range" min={0.5} max={1} step={0.01} value={fairnessThreshold} onChange={e=>setFairnessThreshold(+e.target.value)} className="w-full" style={{ accentColor:'var(--brand-accent)' }} /></div>
              </div>
            )}
          </div>
          <div>
            <label className="label">Suppression rules</label>
            <div style={{ display:'flex', gap:6, marginBottom:8 }}>
              <input className="input" value={newRule} onChange={e=>setNewRule(e.target.value)} placeholder='e.g. accountStatus = "closed"' onKeyDown={e=>{ if(e.key==='Enter'&&newRule.trim()){ setSuppression(p=>[...p,newRule.trim()]); setNewRule(''); } }} style={{ fontFamily:'var(--font-mono)', fontSize:12 }} />
              <button onClick={()=>{ if(newRule.trim()){ setSuppression(p=>[...p,newRule.trim()]); setNewRule(''); } }} className="btn btn-secondary btn-sm"><Plus size={12}/></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {suppression.map((r,i)=>(
                <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', background:'var(--bg)', borderRadius:6, fontFamily:'var(--font-mono)', fontSize:12 }}>
                  <span style={{ flex:1 }}>{r}</span>
                  <button onClick={()=>setSuppression(p=>p.filter((_,j)=>j!==i))} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={11}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={save} disabled={!name.trim()||saved} className="btn btn-primary btn-sm">
            {saved?<><CheckCircle2 size={13}/>Saved</>:<><Save size={13}/>Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PoliciesPage() {
  const { policies, deletePolicy } = useStore();
  const canWrite = usePermission('policies:write');
  const [modal, setModal] = useState<{data?:ContactPolicy}|null>(null);

  return (
    <div className="animate-in">
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div><h1 className="page-title">Engagement Policies</h1>
          <p className="page-subtitle">Contact frequency limits, consent gates, fairness controls, suppression rules</p></div>
        {canWrite && <div style={{ paddingTop:24 }}><button onClick={()=>setModal({})} className="btn btn-primary btn-sm"><Plus size={13}/>New Policy</button></div>}
      </div>
      <div style={{ padding:'0 24px 24px' }}>
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          {policies.length===0 ? (
            <div className="empty-state">
              <div style={{ fontSize:32, marginBottom:8, opacity:0.2 }}>🛡️</div>
              <div className="empty-state-title">No policies yet</div>
              <div className="empty-state-body">Engagement policies govern contact frequency, consent requirements, and fairness controls across all strategies.</div>
              {canWrite && <button onClick={()=>setModal({})} className="btn btn-primary btn-sm"><Plus size={13}/>Create policy</button>}
            </div>
          ) : (
            <table className="table">
              <thead><tr><th>Policy</th><th>Contact Limits</th><th>Consent</th><th>Fairness</th><th>Suppression</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {policies.map(p=>(
                  <tr key={p.id}>
                    <td><div style={{ fontWeight:600 }}>{p.name}</div></td>
                    <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{p.maxPerDay}/d · {p.maxPerWeek}/w · {p.maxPerMonth}/m</td>
                    <td><span className={`badge ${p.requiresConsent?'badge-green':'badge-gray'}`}>{p.requiresConsent?'Required':'Optional'}</span></td>
                    <td><span className={`badge ${p.fairnessEnabled?'badge-blue':'badge-gray'}`}>{p.fairnessEnabled?`≥${(p.fairnessThreshold*100).toFixed(0)}%`:'Off'}</span></td>
                    <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{p.suppressionRules.length} rules</td>
                    <td><span className={`badge ${p.status==='active'?'badge-green':'badge-gray'}`}>{p.status}</span></td>
                    <td>{canWrite&&<div style={{ display:'flex', gap:4 }}>
                      <button onClick={()=>setModal({data:p})} className="btn btn-ghost btn-sm" style={{ padding:'4px 8px' }}><Edit2 size={12}/></button>
                      <button onClick={()=>confirm(`Delete "${p.name}"?`)&&deletePolicy(p.id)} className="btn btn-ghost btn-sm" style={{ padding:'4px 8px', color:'var(--danger)' }}><Trash2 size={12}/></button>
                    </div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {modal&&<PolicyModal policy={modal.data} onClose={()=>setModal(null)} />}
    </div>
  );
}
