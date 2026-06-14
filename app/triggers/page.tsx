'use client';
import { useState, useEffect } from 'react';
import { Zap, Plus, Trash2, X, Save, ChevronDown, ChevronRight } from 'lucide-react';

interface EventTrigger {
  id?: string;
  name: string;
  event_type: string;
  event_conditions: Record<string, unknown>;
  strategy_ids: string[];
  channel_ids: string[];
  enabled: boolean;
}

const EVENT_TYPES: Record<string, { label: string; description: string; color: string }> = {
  cart_abandoned:    { label: 'Cart Abandoned',      description: 'Customer left items without purchasing',         color: '#dc2626' },
  contract_expiry:  { label: 'Contract Expiry',      description: 'Contract expires within N days',                color: '#d97706' },
  balance_threshold:{ label: 'Balance Threshold',    description: 'Account balance crosses a defined threshold',    color: '#2563eb' },
  page_view:        { label: 'Page View',             description: 'Customer viewed a specific product or page',    color: '#6b7280' },
  life_event:       { label: 'Life Event',            description: 'Birthday, new job, house purchase, etc.',       color: '#7c3aed' },
  inactivity:       { label: 'Inactivity',            description: 'Customer inactive for N days',                  color: '#0891b2' },
  onboarding:       { label: 'Onboarding',            description: 'Customer in onboarding flow',                   color: '#16a34a' },
  payment_missed:   { label: 'Payment Missed',        description: 'Payment is overdue',                            color: '#dc2626' },
  custom:           { label: 'Custom Event',          description: 'Define your own event type',                    color: '#6b7280' },
};

const CHANNELS = ['email','web','mobile_app','sms','push','in_app'];

const EMPTY: EventTrigger = { name:'', event_type:'cart_abandoned', event_conditions:{}, strategy_ids:[], channel_ids:[], enabled:true };

function Modal({ trigger, onClose, onSave }: { trigger: EventTrigger; onClose: () => void; onSave: (t: EventTrigger) => void }) {
  const [form, setForm] = useState<EventTrigger>({ ...trigger });
  const [stratInput, setStratInput] = useState('');
  const [condKey, setCondKey] = useState('');
  const [condOp, setCondOp] = useState('<');
  const [condVal, setCondVal] = useState('');

  const addStrategy = () => {
    if (!stratInput.trim()) return;
    setForm(f => ({ ...f, strategy_ids: [...f.strategy_ids, stratInput.trim()] }));
    setStratInput('');
  };
  const addCondition = () => {
    if (!condKey.trim()) return;
    setForm(f => ({ ...f, event_conditions: { ...f.event_conditions, [condKey]: { op: condOp, value: condVal } } }));
    setCondKey(''); setCondVal('');
  };
  const toggleChannel = (ch: string) => setForm(f => ({
    ...f, channel_ids: f.channel_ids.includes(ch) ? f.channel_ids.filter(c => c !== ch) : [...f.channel_ids, ch]
  }));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:600, maxHeight:'88vh' }}>
        <div className="modal-header">
          <span className="modal-title">{form.id ? 'Edit Trigger' : 'New Event Trigger'}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={16}/></button>
        </div>
        <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label className="form-label">Name *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Cart Abandoned — High Value" />
          </div>
          <div>
            <label className="form-label">Event Type</label>
            <select className="form-input" value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}>
              {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>{EVENT_TYPES[form.event_type]?.description}</div>
          </div>

          <div>
            <label className="form-label">Event Conditions</label>
            <div style={{ display:'flex', gap:6, marginBottom:6 }}>
              <input className="form-input" style={{ flex:2 }} value={condKey} onChange={e => setCondKey(e.target.value)} placeholder="attribute (e.g. cart_value)" />
              <select className="form-input" style={{ flex:1 }} value={condOp} onChange={e => setCondOp(e.target.value)}>
                {['<','>','<=','>=','=','!='].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <input className="form-input" style={{ flex:1 }} value={condVal} onChange={e => setCondVal(e.target.value)} placeholder="value" />
              <button className="btn btn-secondary btn-sm" onClick={addCondition}>Add</button>
            </div>
            {Object.entries(form.event_conditions).map(([k, v]) => (
              <div key={k} style={{ display:'flex', alignItems:'center', gap:6, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, padding:'4px 8px', marginBottom:4, fontSize:12 }}>
                <code style={{ flex:1 }}>{k} {(v as {op:string;value:string}).op} {(v as {op:string;value:string}).value}</code>
                <button onClick={() => setForm(f => { const c = { ...f.event_conditions }; delete c[k]; return { ...f, event_conditions: c }; })} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={12}/></button>
              </div>
            ))}
          </div>

          <div>
            <label className="form-label">Strategy IDs to Evaluate</label>
            <div style={{ display:'flex', gap:6, marginBottom:6 }}>
              <input className="form-input" value={stratInput} onChange={e => setStratInput(e.target.value)} placeholder="Strategy UUID" onKeyDown={e => e.key === 'Enter' && addStrategy()} />
              <button className="btn btn-secondary btn-sm" onClick={addStrategy}>Add</button>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
              {form.strategy_ids.map(s => (
                <span key={s} style={{ background:'#dbeafe', color:'#1e40af', borderRadius:4, padding:'2px 8px', fontSize:11, display:'flex', alignItems:'center', gap:4 }}>
                  {s.substring(0,8)}… <X size={10} style={{ cursor:'pointer' }} onClick={() => setForm(f => ({ ...f, strategy_ids: f.strategy_ids.filter(x => x !== s) }))} />
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label">Channels</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {CHANNELS.map(ch => (
                <label key={ch} style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}>
                  <input type="checkbox" checked={form.channel_ids.includes(ch)} onChange={() => toggleChannel(ch)} />
                  {ch.replace('_',' ')}
                </label>
              ))}
            </div>
          </div>

          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
            <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} />
            Enabled
          </label>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.name.trim()}>
            <Save size={14}/> Save Trigger
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TriggersPage() {
  const [triggers, setTriggers] = useState<EventTrigger[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]   = useState<EventTrigger>(EMPTY);
  const [showWebhook, setShowWebhook] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/triggers?tenantId=default-tenant');
      const j = await r.json();
      setTriggers(j.data ?? []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async (t: EventTrigger) => {
    await fetch('/api/triggers', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...t, tenantId:'default-tenant' }) });
    setShowModal(false); load();
  };

  const del = async (id: string) => {
    if (!confirm('Delete this trigger?')) return;
    await fetch(`/api/triggers?id=${id}`, { method:'DELETE' });
    load();
  };

  const td = { padding:'10px 12px', borderBottom:'1px solid var(--border)', fontSize:13, verticalAlign:'top' as const };

  return (
    <div className="animate-in">
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <h1 className="page-title">Event Triggers</h1>
          <p className="page-subtitle">Fire decisions automatically when customer events occur</p>
        </div>
        <div style={{ paddingTop:24 }}>
          <button className="btn btn-primary" onClick={() => { setEditing(EMPTY); setShowModal(true); }}>
            <Plus size={14}/> New Trigger
          </button>
        </div>
      </div>

      <div style={{ padding:'0 24px 24px', display:'flex', flexDirection:'column', gap:16 }}>
        {/* Webhook info */}
        <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:14 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }} onClick={() => setShowWebhook(!showWebhook)}>
            <span style={{ fontWeight:600, fontSize:13, color:'#166534' }}>Webhook Endpoint — send events from your CDP or CRM</span>
            {showWebhook ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
          </div>
          {showWebhook && (
            <div style={{ marginTop:10 }}>
              <div style={{ fontFamily:'monospace', fontSize:12, background:'#1c1917', color:'#d4d4d8', borderRadius:6, padding:12, marginBottom:8 }}>
                POST https://nexuscdh.vercel.app/api/triggers/fire
              </div>
              <div style={{ fontFamily:'monospace', fontSize:11, background:'#1c1917', color:'#d4d4d8', borderRadius:6, padding:12 }}>
                {`{
  "eventType": "cart_abandoned",
  "customerId": "cust-001",
  "tenantId": "default-tenant",
  "payload": { "cart_value": 85.50, "items": 3 }
}`}
              </div>
            </div>
          )}
        </div>

        {loading ? <div style={{ color:'var(--text-muted)', textAlign:'center', padding:40 }}>Loading…</div>
        : triggers.length === 0 ? (
          <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}>
            <Zap size={40} style={{ margin:'0 auto 12px', display:'block', opacity:0.3 }}/>
            <div style={{ fontWeight:600, marginBottom:6 }}>No triggers configured</div>
            <div style={{ fontSize:13 }}>Create a trigger to fire decisions when customer events occur</div>
          </div>
        ) : (
          <div className="card">
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Name','Event Type','Conditions','Strategies','Channels','Enabled',''].map(h => (
                    <th key={h} style={{ textAlign:'left', fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', padding:'8px 12px', borderBottom:'1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {triggers.map(t => {
                  const et = EVENT_TYPES[t.event_type];
                  return (
                    <tr key={t.id}>
                      <td style={td}><span style={{ fontWeight:500 }}>{t.name}</span></td>
                      <td style={td}><span style={{ background: et?.color + '22', color: et?.color, borderRadius:4, padding:'2px 8px', fontSize:11, fontWeight:600 }}>{et?.label ?? t.event_type}</span></td>
                      <td style={td}><span style={{ color:'var(--text-muted)', fontSize:12 }}>{Object.keys(t.event_conditions).length} conditions</span></td>
                      <td style={td}><span style={{ color:'var(--text-muted)' }}>{t.strategy_ids.length}</span></td>
                      <td style={td}><span style={{ color:'var(--text-muted)' }}>{t.channel_ids.length}</span></td>
                      <td style={td}>
                        <span style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', background: t.enabled ? '#16a34a' : '#9ca3af', marginRight:4 }}/>
                        {t.enabled ? 'On' : 'Off'}
                      </td>
                      <td style={td}>
                        <div style={{ display:'flex', gap:6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(t); setShowModal(true); }}>Edit</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => del(t.id!)} style={{ color:'#dc2626' }}><Trash2 size={12}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showModal && <Modal trigger={editing} onClose={() => setShowModal(false)} onSave={save} />}
    </div>
  );
}
