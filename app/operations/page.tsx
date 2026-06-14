'use client';
import { useStore } from '@/lib/store';
import { usePermission } from '@/lib/auth';
import { CheckCircle2, AlertTriangle, Clock, Trash2 } from 'lucide-react';

const STATUS_CLS: Record<string, string> = { operational:'badge-green', idle:'badge-amber', degraded:'badge-red' };
const DOT_CLS: Record<string, string>    = { operational:'dot-green',   idle:'dot-amber',   degraded:'dot-red' };

export default function OperationsPage() {
  const { decisions, strategies, actions, clearDecisions } = useStore();
  const canWrite = usePermission('operations:write');
  const served  = decisions.filter(d => d.served).length;
  const blocked = decisions.filter(d => !d.served).length;
  const rate    = decisions.length ? ((served / decisions.length) * 100).toFixed(1) : '0';

  const SERVICES = [
    { name:'Decision Engine',  status:'operational', latency:'<10ms' },
    { name:'Taxonomy Service', status:'operational', latency:'<5ms'  },
    { name:'Policy Engine',    status:'operational', latency:'<8ms'  },
    { name:'Audit Logger',     status:'operational', latency:'<15ms' },
    { name:'Model Serving',    status: actions.length > 0 ? 'operational' : 'idle', latency:'<50ms' },
    { name:'Channel Router',   status:'operational', latency:'<12ms' },
  ];

  return (
    <div className="animate-in">
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <h1 className="page-title">Operations</h1>
          <p className="page-subtitle">System health, decision processing, and audit trail</p>
        </div>
        {canWrite && decisions.length > 0 && (
          <div style={{ paddingTop:24 }}>
            <button onClick={() => { if (confirm('Clear all decision records?')) clearDecisions(); }} className="btn btn-secondary btn-sm">
              <Trash2 size={13} /> Clear log
            </button>
          </div>
        )}
      </div>

      <div style={{ padding:'0 24px 24px', display:'flex', flexDirection:'column', gap:20 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
          {[
            { label:'Total Decisions',   value:decisions.length.toLocaleString(), icon:'⚡' },
            { label:'Served',            value:served.toLocaleString(),            icon:'✅', sub:rate+'% acceptance' },
            { label:'Suppressed',        value:blocked.toLocaleString(),           icon:'🔴' },
            { label:'Active Strategies', value:strategies.filter(s=>s.status==='active').length+'', icon:'🧠' },
          ].map(k => (
            <div key={k.label} className="kpi-card">
              <div className="kpi-label">{k.label}</div>
              <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                <div className="kpi-value">{k.value}</div>
                <div style={{ fontSize:20 }}>{k.icon}</div>
              </div>
              {k.sub && <div className="kpi-delta neutral">{k.sub}</div>}
            </div>
          ))}
        </div>

        <div className="card card-body">
          <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>System Health</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {SERVICES.map(s => (
              <div key={s.name} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 12px', borderRadius:8, background:'var(--bg)' }}>
                <span className={'dot ' + DOT_CLS[s.status]} />
                <span style={{ fontSize:13, fontWeight:600, flex:1 }}>{s.name}</span>
                <span className={'badge ' + STATUS_CLS[s.status]}>{s.status}</span>
                <span style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>{s.latency}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div className="card-header">
            <span className="card-title">Decision Audit Log</span>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>{decisions.length} records</span>
          </div>
          {decisions.length === 0 ? (
            <div style={{ textAlign:'center', padding:'32px', color:'var(--text-muted)', fontSize:13 }}>
              No decisions recorded yet. Run the simulator to generate decisions.
            </div>
          ) : (
            <div style={{ maxHeight:420, overflowY:'auto' }}>
              <table className="table">
                <thead style={{ position:'sticky', top:0, zIndex:1 }}>
                  <tr><th>Customer</th><th>Strategy</th><th>Action / Reason</th><th>Channel</th><th>Result</th><th>Propensity</th><th>Time</th></tr>
                </thead>
                <tbody>
                  {decisions.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{d.customerId}</td>
                      <td style={{ fontSize:12 }}>{d.strategyName}</td>
                      <td style={{ fontSize:12, fontWeight:d.served?600:400, color:d.served?'var(--text-primary)':'var(--text-muted)' }}>
                        {d.actionName ?? d.suppressionReason ?? '—'}
                      </td>
                      <td style={{ fontSize:11, color:'var(--text-muted)', textTransform:'capitalize' }}>
                        {d.channelId ? d.channelId.replace(/_/g,' ') : '—'}
                      </td>
                      <td>
                        {d.served
                          ? <span className="badge badge-green"><CheckCircle2 size={10}/> Served</span>
                          : <span className="badge badge-amber"><AlertTriangle size={10}/> Suppressed</span>}
                      </td>
                      <td style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--brand-accent)' }}>
                        {d.propensity ? d.propensity.toFixed(3) : '—'}
                      </td>
                      <td style={{ fontSize:11, color:'var(--text-muted)' }}>
                        <span style={{ display:'flex', alignItems:'center', gap:3 }}>
                          <Clock size={10}/>{new Date(d.timestamp).toLocaleTimeString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
