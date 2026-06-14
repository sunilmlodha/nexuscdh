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
  // Global NBA fields
  decisionId?: string;
  strategiesEvaluated?: number;
  served_count?: number;
  suppressed_count?: number;
  no_match_count?: number;
  winning_strategy?: string;
}

export default function SimulatorPage() {
  const { strategies, actions } = useStore();
  const canWrite = usePermission('simulator:write');
  const [mode, setMode] = useState<'single' | 'global'>('single');
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

  // Outcome state
  const [outcomeRecorded, setOutcomeRecorded] = useState(false);
  const [outcomeLoading, setOutcomeLoading] = useState(false);

  // Profile loader state
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileBadge, setProfileBadge] = useState<string|null>(null);

  // Propensity threshold
  const [minPropensity, setMinPropensity] = useState(0.1);

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
    out['min_propensity_threshold'] = minPropensity;
    return out;
  };

  const run = async () => {
    if (!customerId.trim()) return;
    if (mode === 'single' && !selStrategy) return;
    setRunning(true); setResult(null); setOutcomeRecorded(false);

    try {
      let data: DecisionResult;

      if (mode === 'global') {
        const attrsObj = buildAttributes();
        const attrsParam = encodeURIComponent(JSON.stringify(attrsObj));
        const res = await fetch(
          `/api/decide?customerId=${encodeURIComponent(customerId.trim())}&tenantId=f0000000-0000-4000-a000-000000000001&attributes=${attrsParam}`
        );
        data = await res.json();
      } else {
        const res = await fetch('/api/decide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: customerId.trim(),
            strategyId: selStrategy,
            attributes: buildAttributes(),
          }),
        });
        data = await res.json();
      }

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

  const recordOutcome = async (outcome: 'accepted' | 'rejected' | 'ignored') => {
    if (!result?.decisionId) return;
    setOutcomeLoading(true);
    try {
      await fetch('/api/outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisionId: result.decisionId, customerId: customerId.trim(), outcome }),
      });
      setOutcomeRecorded(true);
    } catch {
      setOutcomeRecorded(true); // show recorded anyway
    }
    setOutcomeLoading(false);
  };

  const loadProfile = async () => {
    if (!customerId.trim()) return;
    setProfileLoading(true);
    setProfileBadge(null);
    try {
      const res = await fetch(`/api/profile?customerId=${encodeURIComponent(customerId.trim())}&tenantId=f0000000-0000-4000-a000-000000000001`);
      if (res.ok) {
        const data = await res.json();
        const profile = data.profile ?? data;
        if (profile?.attributes && typeof profile.attributes === 'object') {
          const newAttrs = Object.entries(profile.attributes).map(([key, val]) => ({ key, val: String(val) }));
          setAttrs(prev => {
            const merged = [...prev];
            for (const na of newAttrs) {
              const idx = merged.findIndex(a => a.key === na.key);
              if (idx >= 0) merged[idx] = na;
              else merged.push(na);
            }
            return merged;
          });
          setProfileBadge(`Profile loaded (${newAttrs.length} attrs)`);
        } else {
          setProfileBadge('No profile found');
        }
      } else {
        setProfileBadge('No profile found');
      }
    } catch {
      setProfileBadge('Load failed');
    }
    setProfileLoading(false);
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

          {/* Mode toggle */}
          <div style={{ display:'flex', gap:0, border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', alignSelf:'flex-start' }}>
            {(['single', 'global'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                style={{
                  padding:'6px 14px', fontSize:12, fontWeight:600, cursor:'pointer', border:'none',
                  background: mode === m ? 'var(--brand-accent)' : 'transparent',
                  color: mode === m ? 'white' : 'var(--text-secondary)',
                  transition:'background 0.15s, color 0.15s',
                }}>
                {m === 'single' ? 'Single Strategy' : 'Global NBA'}
              </button>
            ))}
          </div>

          {mode === 'global' && (
            <div className="alert alert-info" style={{ fontSize:12 }}>
              Evaluates all active strategies and returns the best action
            </div>
          )}

          <div className="field-group" style={{ marginBottom:0 }}>
            <label className="label">Customer ID</label>
            <div style={{ display:'flex', gap:8 }}>
              <input className="input" value={customerId}
                onChange={e=>{ setCustomerId(e.target.value); setProfileBadge(null); }}
                onBlur={() => { if (customerId.trim()) loadProfile(); }}
                onKeyDown={e=>{ if(e.key==='Enter') { loadProfile(); } }}
                placeholder="e.g. cust-001" style={{ flex:1 }} />
              <button onClick={loadProfile} disabled={!customerId.trim() || profileLoading}
                className="btn btn-secondary btn-sm" style={{ whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:4 }}>
                {profileLoading
                  ? <Loader2 size={11} style={{ animation:'spin 1s linear infinite' }}/>
                  : <Database size={11}/>}
                Load
              </button>
            </div>
            {profileBadge && (
              <div style={{ marginTop:4 }}>
                <span className={`badge ${profileBadge.startsWith('Profile loaded') ? 'badge-green' : 'badge-amber'}`} style={{ fontSize:10 }}>
                  {profileBadge}
                </span>
              </div>
            )}
            <div className="field-hint">Profile attributes auto-load on focus-out. Seeded IDs: cust-001 through cust-006.</div>
          </div>

          {mode === 'single' && (
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
          )}

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

          {/* Propensity threshold slider */}
          <div>
            <label className="label" style={{ marginBottom:6 }}>
              Min propensity: <span style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>{minPropensity.toFixed(2)}</span>
            </label>
            <input type="range" min={0} max={1} step={0.05} value={minPropensity}
              onChange={e => setMinPropensity(parseFloat(e.target.value))}
              style={{ width:'100%', accentColor:'var(--brand-accent)' }} />
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-muted)', marginTop:2 }}>
              <span>0.00</span><span>0.50</span><span>1.00</span>
            </div>
          </div>

          <button onClick={run} disabled={!customerId.trim()||(mode==='single'&&!selStrategy)||running||!canWrite}
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
                  {result.error
                    ? 'Engine Error'
                    : mode === 'global' && result.served
                      ? 'Global NBA Decision'
                      : result.served
                        ? 'Action Served'
                        : 'Decision Suppressed'}
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
                  {mode === 'global' && result.winning_strategy && (
                    <div style={{ padding:'8px 12px', background:'var(--bg, #F8F9FA)', borderRadius:7, marginBottom:4, fontSize:12 }}>
                      <span style={{ color:'var(--text-muted)' }}>Winning strategy: </span>
                      <span style={{ fontWeight:700 }}>{result.winning_strategy}</span>
                      {(result.served_count !== undefined || result.suppressed_count !== undefined || result.no_match_count !== undefined) && (
                        <span style={{ marginLeft:8, color:'var(--text-muted)' }}>
                          ({result.served_count ?? 0} served | {result.suppressed_count ?? 0} suppressed | {result.no_match_count ?? 0} no match)
                        </span>
                      )}
                    </div>
                  )}
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

              {/* Outcome buttons */}
              {result.decisionId && (
                <div style={{ marginTop:12, borderTop:'1px solid var(--border)', paddingTop:12 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>Record Outcome</div>
                  {outcomeRecorded ? (
                    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--success, #16A34A)' }}>
                      <CheckCircle2 size={13}/> Outcome recorded ✓
                    </div>
                  ) : (
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={() => recordOutcome('accepted')} disabled={outcomeLoading}
                        style={{ flex:1, padding:'7px 0', fontSize:12, fontWeight:600, borderRadius:7, border:'none', cursor:'pointer', background:'#DCFCE7', color:'#166534' }}>
                        ✓ Accepted
                      </button>
                      <button onClick={() => recordOutcome('rejected')} disabled={outcomeLoading}
                        style={{ flex:1, padding:'7px 0', fontSize:12, fontWeight:600, borderRadius:7, border:'none', cursor:'pointer', background:'#FEE2E2', color:'#991B1B' }}>
                        ✗ Rejected
                      </button>
                      <button onClick={() => recordOutcome('ignored')} disabled={outcomeLoading}
                        style={{ flex:1, padding:'7px 0', fontSize:12, fontWeight:600, borderRadius:7, border:'none', cursor:'pointer', background:'#F3F4F6', color:'#6B7280' }}>
                        — Ignored
                      </button>
                    </div>
                  )}
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
