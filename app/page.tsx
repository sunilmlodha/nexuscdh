'use client';

import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { GitBranch, Layers, Radio, Brain, Activity, TrendingUp, Zap, CheckCircle2, AlertTriangle, Clock, ArrowRight, Plus } from 'lucide-react';

export default function DashboardPage() {
  const { strategies, actions, categories, topics, decisions, channels, policies, audiences, models, tenant } = useStore();
  const { currentUser, authSettings } = useAuth();

  const active   = strategies.filter(s => s.status === 'active').length;
  const served   = decisions.filter(d => d.served).length;
  const blocked  = decisions.filter(d => !d.served).length;
  const rate     = decisions.length ? ((served / decisions.length)*100).toFixed(1) : null;
  const name     = authSettings.authEnabled ? currentUser?.name?.split(' ')[0] : 'there';
  const todayStr = new Date().toISOString().slice(0, 10);
  const today    = decisions.filter(d => (d.timestamp ?? '').slice(0, 10) === todayStr).length;

  const KPIs = [
    { label:'Active Strategies',   value: active,              sub: `${strategies.length} total configured`,  href:'/strategies', icon: GitBranch, color:'#1D4ED8' },
    { label:'Actions Configured',  value: actions.length,      sub: `${categories.length} categories · ${topics.length} topics`, href:'/taxonomy', icon: Layers, color:'#7C3AED' },
    { label:'Decisions Today',     value: today,               sub: `${decisions.length} total configured`,   href:'/simulator',  icon: Zap,       color:'#059669' },
    { label:'Active Channels',     value: channels.filter(c=>c.enabled).length, sub: `${channels.length} total configured`, href:'/channels', icon: Radio, color:'#D97706' },
  ];

  const isFirstRun = strategies.length === 0 && categories.length === 0;

  return (
    <div className="animate-in">
      {/* Header */}
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4, fontWeight:500 }}>
            {tenant.name} · {new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
          </div>
          <h1 className="page-title">Good day{name ? `, ${name}` : ''}.</h1>
          <p className="page-subtitle">
            {isFirstRun
              ? 'Welcome to Stratcheck. Start by configuring your taxonomy, then create strategies.'
              : `${active} active ${active===1?'strategy':'strategies'} · ${decisions.length} decisions recorded`}
          </p>
        </div>
        {!isFirstRun && (
          <div style={{ display:'flex', gap:8, paddingTop:24 }}>
            <Link href="/simulator" className="btn btn-secondary btn-sm"><Zap size={13} /> Simulate</Link>
            <Link href="/strategies" className="btn btn-primary btn-sm"><Plus size={13} /> New Strategy</Link>
          </div>
        )}
      </div>

      <div style={{ padding:'0 24px 24px', display:'flex', flexDirection:'column', gap:20 }}>

        {/* First-run onboarding */}
        {isFirstRun && (
          <div className="card" style={{ padding:0, overflow:'hidden', border:'1.5px solid var(--border-mid)' }}>
            <div style={{ background:'linear-gradient(135deg, #1D4ED8, #7C3AED)', padding:'24px 28px', color:'white' }}>
              <div style={{ fontSize:18, fontWeight:800, letterSpacing:'-0.5px', marginBottom:6 }}>Build your first decision strategy</div>
              <div style={{ fontSize:13, opacity:0.85 }}>Stratcheck is configured in layers. Follow these steps to go live.</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', borderTop:'1px solid var(--border)' }}>
              {[
                { step:1, title:'Set up Taxonomy',     body:'Define Action Categories, Topics, and Actions for your line of business.', href:'/taxonomy', icon:'🗂️' },
                { step:2, title:'Configure Channels',   body:'Enable owned (email, web, app) and paid media channels.', href:'/channels', icon:'📡' },
                { step:3, title:'Create Audiences',     body:'Define customer segments using profile attributes and behaviours.', href:'/audiences', icon:'👥' },
                { step:4, title:'Build Strategies',     body:'Combine taxonomy, channels and audiences into decision strategies.', href:'/strategies', icon:'🧠' },
              ].map((s, i) => (
                <Link key={s.step} href={s.href} style={{ padding:'20px 20px', borderRight: i<3?'1px solid var(--border)':'none', display:'block', textDecoration:'none', transition:'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background='#FAFAFA')}
                  onMouseLeave={e => (e.currentTarget.style.background='')}>
                  <div style={{ fontSize:24, marginBottom:8 }}>{s.icon}</div>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginBottom:4 }}>STEP {s.step}</div>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', marginBottom:6 }}>{s.title}</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.5 }}>{s.body}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:10, fontSize:12, color:'var(--brand-accent)', fontWeight:600 }}>
                    Get started <ArrowRight size={12} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
          {KPIs.map(k => (
            <Link key={k.label} href={k.href} style={{ textDecoration:'none', display:'block', height:'100%' }}>
              <div className="kpi-card" style={{ transition:'box-shadow 0.15s, transform 0.15s', cursor:'pointer', height:'100%', boxSizing:'border-box' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow='var(--shadow)'; (e.currentTarget as HTMLElement).style.transform='translateY(-1px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow=''; (e.currentTarget as HTMLElement).style.transform=''; }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                  <div className="kpi-label">{k.label}</div>
                  <div style={{ width:32, height:32, borderRadius:8, background: k.color+'18', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <k.icon size={15} color={k.color} />
                  </div>
                </div>
                <div className="kpi-value">{k.value}</div>
                <div className="kpi-delta neutral">{k.sub}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Bottom row: active strategies + recent decisions */}
        <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:16 }}>

          {/* Active strategies */}
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div className="card-header">
              <span className="card-title">Active Strategies</span>
              <Link href="/strategies" style={{ fontSize:12, color:'var(--brand-accent)', fontWeight:600, display:'flex', alignItems:'center', gap:3, textDecoration:'none' }}>
                View all <ArrowRight size={12} />
              </Link>
            </div>
            {strategies.filter(s=>s.status==='active').length === 0 ? (
              <div className="empty-state" style={{ padding:'32px 20px' }}>
                <div style={{ fontSize:28, marginBottom:8, opacity:0.2 }}>🧠</div>
                <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:12 }}>No active strategies yet</div>
                <Link href="/strategies" className="btn btn-primary btn-sm"><Plus size={12} /> Create strategy</Link>
              </div>
            ) : (
              <table className="table">
                <thead><tr>
                  <th>Strategy</th><th>Category</th><th>Channels</th><th>Actions</th>
                </tr></thead>
                <tbody>
                  {strategies.filter(s=>s.status==='active').slice(0,6).map(s => {
                    const cat = categories.find(c=>c.id===s.categoryId);
                    return (
                      <tr key={s.id}>
                        <td><div style={{ fontWeight:600, fontSize:13 }}>{s.name}</div>
                            <div style={{ fontSize:11, color:'var(--text-muted)' }}>{s.priority}</div></td>
                        <td>{cat ? <span className="badge" style={{ background: cat.color+'22', color: cat.color }}>{cat.name}</span> : <span className="badge badge-gray">—</span>}</td>
                        <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{s.channelIds.length} ch.</td>
                        <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{s.actionIds.length} actions</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Recent decisions */}
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div className="card-header">
              <span className="card-title">Recent Decisions</span>
              {decisions.length > 0 && (
                <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--success)', fontWeight:600 }}>
                  <span className="dot dot-green pulse" />Live
                </span>
              )}
            </div>
            {decisions.length === 0 ? (
              <div className="empty-state" style={{ padding:'32px 20px' }}>
                <div style={{ fontSize:28, marginBottom:8, opacity:0.2 }}>⚡</div>
                <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:12 }}>No decisions yet</div>
                <Link href="/simulator" className="btn btn-secondary btn-sm"><Zap size={12} /> Run simulator</Link>
              </div>
            ) : (
              <div style={{ maxHeight:280, overflowY:'auto' }}>
                {decisions.slice(0,12).map(d => (
                  <div key={d.id} style={{ padding:'10px 16px', borderBottom:'1px solid #F3F4F6', display:'flex', alignItems:'flex-start', gap:10 }}>
                    {d.served
                      ? <CheckCircle2 size={14} color="var(--success)" style={{ flexShrink:0, marginTop:1 }} />
                      : <AlertTriangle size={14} color="var(--warning)" style={{ flexShrink:0, marginTop:1 }} />}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {d.served ? d.actionName : d.suppressionReason}
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>{d.customerId} · {d.strategyName}</div>
                    </div>
                    <div style={{ fontSize:10, color:'var(--text-muted)', flexShrink:0, display:'flex', alignItems:'center', gap:3 }}>
                      <Clock size={9} />{new Date(d.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* System summary row */}
        {!isFirstRun && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
            {[
              { label:'Taxonomy', body:`${categories.length} categories · ${topics.length} topics · ${actions.length} actions`, href:'/taxonomy', color:'#7C3AED' },
              { label:'Policies', body:`${policies.length} engagement policies configured`, href:'/policies', color:'#1D4ED8' },
              { label:'Audiences', body:`${audiences.length} audience segments defined`, href:'/audiences', color:'#059669' },
              { label:'Models',   body:`${models.length} adaptive models deployed`, href:'/models', color:'#D97706' },
            ].map(s => (
              <Link key={s.label} href={s.href} style={{ textDecoration:'none' }}>
                <div className="card" style={{ padding:'14px 16px', cursor:'pointer', transition:'box-shadow 0.15s' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.boxShadow='var(--shadow)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.boxShadow='')}>
                  <div style={{ fontSize:11, fontWeight:700, color: s.color, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>{s.label}</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{s.body}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
