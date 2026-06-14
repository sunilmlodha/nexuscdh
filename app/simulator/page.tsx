'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { usePermission } from '@/lib/auth';
import { IS_CONFIGURED } from '@/lib/supabase';
import { Zap, CheckCircle2, AlertTriangle, Loader2, Plus, Minus, Database, AlertCircle, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface DecisionResult {
  served: boolean;
  action?: { id: string; name: string; channel: string; propensity: number; headline?: string; offerCode?: string };
  suppressionReason?: string;
  suppressionExplanation?: { plain: string; technical: string; category: string };
  strategyName: string;
  latencyMs: number;
  persistedToDatabase?: boolean;
  trace?: { step: string; outcome: string }[];
  demo?: boolean;
  error?: string;
  message?: string;
}

export default function SimulatorPage() {
  const { strategies, actions } = useStore();
  const canWrite = usePermission('simulator:write');
  const [customerId, setCustomerId] = useState('');
  const [attrs, setAttrs] = useState<{key:string;val:string}[]>([
    {key:'consentGiven', val:'true'},
    {key:'age', val:'35'},
    {key:'segment', val:'premier'},
    {key:'channel', val:'web'},
  ]);
  const [selStrategy, setSelStrategy] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DecisionResult|null>(null);
  const [history, setHistory] = useState<(DecisionResult & {customerId:string;strategyId:string;ts:string})[]>([]);

  const activeStrategies = strategies.filter(s => s.status === 'active');

  const buildAttributes = () => {
    const out: Record<string,unknown> = {};
    for (const { key, val } of attrs) {
      if (!key.trim()) continue;
      if (val === 'true')  out[key] = true;
      else if (val === 'false') out[key] = false;
      else if (!isNaN(+val) && val !== '') out[key] = +val;
      else out[key] = val;
    }
    return out;
  };

  const run = async () => {
    if (!customerId.trim() || !selStrategy) return;
    setRunning(true); setResult(null);

    try {
      const res = await fetch('/api/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customerId.trim(),
          strategyId: selStrategy,
          attributes: buildAttributes(),
        }),
      });

      const data: DecisionResult = await res.json();
      setResult(data);

      if (!data.error || data.demo === false) {
        const strategy = strategies.find(s => s.id === selStrategy);
        setHistory(h => [{
          ...data,
          customerId: customerId.trim(),
          strategyId: selStrategy,
          strategyName: data.strategyName ?? strategy?.name ?? selStrategy,
          ts: new Date().toISOString(),
        }, ...h.slice(0,19)]);
      }
    } catch (err) {
      setResult({ served:false, suppressionReason:'Network error', strategyName:'', latencyMs:0, error:'fetch failed' });
    }
    setRunning(false);
  };

  return (
    <div className="animate-in">
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <h1 className="page-title">Decision Simulator</h1>
          <p className="page-subtitle">Test strategies in real time. Results run through the full execution engine and persist to the audit log.</p>
        </div>
        <div style={{ paddingTop:24, display:'flex', alignItems:'center', gap:8 }}>
          {IS_CONFIGURED
            ? <span className="badge badge-green"><Database size={10}/> Supabase connected</span>
            : <span className="badge badge-amber"><Database size={10}/> localStorage only</span>}
        </div>
      </div>

      {/* Supabase setup prompt */}
      {!IS_CONFIGURED && (
        <div style={{ padding:'0 24px 8px' }}>
          <div className="alert alert-warning" style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
            <AlertCircle size={16} style={{ flexShrink:0, marginTop:1 }}/>
            <div>
              <div style={{ fontWeight:700, fontSize:13, marginBottom:3 }}>Decisions are not persisted to a database</div>
              <div style={{ fontSize:12, lineHeight:1.5 }}>
                The simulator will run against strategies stored in your browser only. To persist decisions, configure Supabase:
                <br/>1. Create a project at <a href="https://supabase.com" target="_blank" style={{ color:'var(--brand-accent)' }}>supabase.com</a> (free)
                <br/>2. Run <code style={{ background:'rgba(0,0,0,0.06)', padding:'1px 5px', borderRadius:3, fontFamily:'var(--font-mono)', fontSize:11 }}>supabase/schema.sql</code> in your SQL editor
                <br/>3. Add <code style={{ background:'rgba(0,0,0,0.06)', padding:'1px 5px', borderRadius:3, fontFamily:'var(--font-mono)', fontSize:11 }}>NEXT_PUBLIC_SUPABASE_URL</code> and <code style={{ background:'rgba(0,0,0,0.06)', padding:'1px 5px', borderRadius:3, fontFamily:'var(--font-mono)', fontSize:11 }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code style={{ background:'rgba(0,0,0,0.06)', padding:'1px 5px', borderRadius:3, fontFamily:'var(--font-mono)', fontSize:11 }}>.env.local</code>
                <br/>4. Restart the dev server
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding:'0 24px 24px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, alignItems:'start' }}>

        {/* Input panel */}
        <div className="card card-body" style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ fontWeight:700, fontSize:14, borderBottom:'1px solid var(--border)', paddingBottom:10, marginBottom:4 }}>Customer Profile</div>

          <div className="field-group" style={{ marginBottom:0 }}>
            <label className="label">Customer ID</label>
            <input className="input" value={customerId} onChange={e=>setCustomerId(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&run()} placeholder="e.g. CUST-00123456" />
          </div>

          <div className="field-group" style={{ marginBottom:0 }}>
            <label className="label">Strategy</label>
            <select className="input select" value={selStrategy} onChange={e=>setSelStrategy(e.target.value)}>
              <option value="">Select strategy…</option>
              {activeStrategies.length === 0
                ? <option disabled>No active strategies — create one first</option>
                : activeStrategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {activeStrategies.length === 0 && (
              <div className="field-hint">
                <Link href="/strategies" style={{ color:'var(--brand-accent)' }}>Create a strategy</Link> first, then come back here.
              </div>
            )}
          </div>

          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <label className="label" style={{ margin:0 }}>Customer Attributes</label>
              <button onClick={()=>setAttrs(p=>[...p,{key:'',val:''}])} className="btn btn-ghost btn-sm"><Plus size={11}/>Add</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {attrs.map((a,i)=>(
                <div key={i} style={{ display:'flex', gap:6 }}>
                  <input className="input" value={a.key} onChange={e=>setAttrs(p=>p.map((x,j)=>j===i?{...x,key:e.target.value}:x))}
                    placeholder="attribute" style={{ flex:1, fontFamily:'var(--font-mono)', fontSize:12 }} />
                  <input className="input" value={a.val} onChange={e=>setAttrs(p=>p.map((x,j)=>j===i?{...x,val:e.target.value}:x))}
                    placeholder="value" style={{ flex:1.5 }} />
                  <button onClick={()=>setAttrs(p=>p.filter((_,j)=>j!==i))}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }}><Minus size={13}/></button>
                </div>
              ))}
            </div>
            <div className="field-hint">Set consentGiven=false to test suppression. Attributes map to customer profile fields.</div>
          </div>

          <button onClick={run} disabled={!customerId.trim()||!selStrategy||running||!canWrite}
            className="btn btn-primary" style={{ justifyContent:'center' }}>
            {running
              ? <><Loader2 size={15} style={{ animation:'spin 1s linear infinite' }}/> Running decision…</>
              : <><Zap size={15}/> Run Decision</>}
          </button>
        </div>

        {/* Result panel */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {result ? (
            <div className="card card-body animate-in">
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                {result.error
                  ? <AlertCircle size={20} color="var(--danger)" />
                  : result.served
                    ? <CheckCircle2 size={20} color="var(--success)" />
                    : <AlertTriangle size={20} color="var(--warning)" />}
                <span style={{ fontWeight:800, fontSize:16, letterSpacing:'-0.3px' }}>
                  {result.error ? 'Engine Error' : result.served ? 'Action Served' : 'Decision Suppressed'}
                </span>
                <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:'auto', display:'flex', alignItems:'center', gap:3 }}>
                  <Clock size={10}/>{result.latencyMs}ms
                </span>
              </div>

              {result.error ? (
                <div className="alert alert-danger" style={{ fontSize:12 }}>
                  <AlertCircle size={13}/>
                  <div>
                    <strong>{result.error}</strong>
                    {result.message && <div style={{ marginTop:4 }}>{result.message}</div>}
                  </div>
                </div>
              ) : result.served ? (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { label:'Action', value: result.action!.name },
                    { label:'Headline', value: result.action!.headline ?? '—' },
                    { label:'Offer Code', value: result.action!.offerCode ?? '—' },
                    { label:'Propensity', value: result.action!.propensity?.toFixed(4) },
                    { label:'Channel', value: result.action!.channel?.replace(/_/g,' ') },
                    { label:'Strategy', value: result.strategyName },
                  ].map(r => (
                    <div key={r.label} style={{ display:'flex', justifyContent:'space-between', paddingBottom:8, borderBottom:'1px solid #F3F4F6' }}>
                      <span style={{ fontSize:12, color:'var(--text-muted)' }}>{r.label}</span>
                      <span style={{ fontSize:13, fontWeight:600 }}>{r.value}</span>
                    </div>
                  ))}
                  <div className={result.persistedToDatabase ? 'alert alert-success' : 'alert alert-info'} style={{ fontSize:12, marginTop:4 }}>
                    <Database size={12}/>
                    {result.persistedToDatabase
                      ? 'Decision persisted to Supabase audit log.'
                      : 'Decision recorded to browser store (configure Supabase to persist to database).'}
                  </div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>
                    {result.suppressionExplanation?.plain ?? result.suppressionReason}
                  </div>
                  {result.suppressionExplanation && (
                    <details style={{ fontSize:12, color:'var(--text-muted)' }}>
                      <summary style={{ cursor:'pointer', fontWeight:600 }}>Technical detail</summary>
                      <div style={{ marginTop:6, fontFamily:'var(--font-mono)', background:'var(--bg)', padding:'8px 10px', borderRadius:6, fontSize:11 }}>
                        {result.suppressionExplanation.technical}
                      </div>
                    </details>
                  )}
                  <div className={result.persistedToDatabase ? 'alert alert-warning' : 'alert alert-info'} style={{ fontSize:12 }}>
                    <Database size={12}/>
                    {result.persistedToDatabase
                      ? 'Suppression persisted to Supabase audit log.'
                      : 'Suppression recorded to browser store.'}
                  </div>
                </div>
              )}

              {/* Trace */}
              {result.trace && result.trace.length > 0 && (
                <div style={{ marginTop:12, borderTop:'1px solid var(--border)', paddingTop:10 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>Evaluation Trace</div>
                  {result.trace.map((t,i) => (
                    <div key={i} style={{ display:'flex', gap:8, alignItems:'center', fontSize:12, marginBottom:4 }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background: t.outcome.includes('PASS')||t.outcome.includes('Selected')?'var(--success)':'var(--warning)', flexShrink:0 }} />
                      <span style={{ fontWeight:600, color:'var(--text-muted)', textTransform:'capitalize', minWidth:90 }}>{t.step}</span>
                      <span style={{ color:'var(--text-secondary)' }}>{t.outcome}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="card card-body" style={{ textAlign:'center', padding:'40px 20px' }}>
              <div style={{ fontSize:40, marginBottom:12, opacity:0.12 }}>⚡</div>
              <div style={{ fontSize:14, color:'var(--text-secondary)' }}>
                Configure a customer profile and select a strategy,<br/>then run a decision to see the result.
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <div className="card-header"><span className="card-title">Session History</span></div>
              <div style={{ maxHeight:240, overflowY:'auto' }}>
                {history.map((h,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 16px', borderBottom:'1px solid #F3F4F6' }}>
                    {h.served
                      ? <CheckCircle2 size={13} color="var(--success)" />
                      : <AlertTriangle size={13} color="var(--warning)" />}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {h.served ? h.action?.name : h.suppressionExplanation?.plain ?? h.suppressionReason}
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>{h.customerId} · {h.strategyName}</div>
                    </div>
                    <div style={{ fontSize:10, color:'var(--text-muted)', flexShrink:0 }}>{new Date(h.ts).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
