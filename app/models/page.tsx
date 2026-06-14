'use client';
import { useStore } from '@/lib/store';
import { usePermission } from '@/lib/auth';
import { Brain, Plus } from 'lucide-react';

export default function ModelsPage() {
  const { models, actions } = useStore();
  const canWrite = usePermission('models:write');
  const STATUS_BADGE: Record<string,string> = { live:'badge-green', training:'badge-amber', shadow:'badge-blue', retired:'badge-gray' };

  return (
    <div className="animate-in">
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div><h1 className="page-title">Adaptive Models</h1>
          <p className="page-subtitle">Propensity models per action. Trained on acceptance/rejection feedback from the decision engine.</p></div>
      </div>
      <div style={{ padding:'0 24px 24px' }}>
        {models.length===0 ? (
          <div className="card">
            <div className="empty-state">
              <div style={{ fontSize:32, marginBottom:8, opacity:0.2 }}>🧠</div>
              <div className="empty-state-title">No models deployed</div>
              <div className="empty-state-body">Adaptive models are trained automatically from decision feedback. Run the simulator and record outcomes to bootstrap training data.</div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <table className="table">
              <thead><tr><th>Model</th><th>Action</th><th>Type</th><th>AUC</th><th>Lift D1</th><th>Predictions</th><th>Status</th></tr></thead>
              <tbody>
                {models.map(m => {
                  const action = actions.find(a=>a.id===m.actionId);
                  return (
                    <tr key={m.id}>
                      <td><div style={{ fontWeight:600 }}>{m.name}</div></td>
                      <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{action?.name??m.actionId}</td>
                      <td><span className="badge badge-gray" style={{ textTransform:'capitalize' }}>{m.modelType.replace(/_/g,' ')}</span></td>
                      <td style={{ fontWeight:700, fontFamily:'var(--font-mono)' }}>{m.auc.toFixed(3)}</td>
                      <td style={{ fontWeight:700, color:'var(--success)', fontFamily:'var(--font-mono)' }}>{m.liftAtDecile1.toFixed(1)}x</td>
                      <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{m.predictionsToday.toLocaleString()}</td>
                      <td><span className={STATUS_BADGE[m.status]+' badge'}>{m.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
