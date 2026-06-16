'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { usePermission } from '@/lib/auth';
import { Brain, Send, CheckCircle } from 'lucide-react';
import type { AdaptiveModel } from '@/lib/store';

export default function ModelsPage() {
  const { actions } = useStore();
  const canWrite = usePermission('models:write');
  const [models, setModels] = useState<AdaptiveModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);

  useEffect(() => {
    fetch('/api/models?tenantId=f0000000-0000-4000-a000-000000000001')
      .then(r => r.json())
      .then(d => {
        const rows = (d.data ?? []) as Record<string, unknown>[];
        setModels(rows.map(m => ({
          id:              String(m.id ?? ''),
          name:            String(m.name ?? ''),
          description:     m.description ? String(m.description) : undefined,
          actionId:        String(m.action_id ?? ''),
          modelType:       (m.model_type ?? 'logistic_regression') as AdaptiveModel['modelType'],
          features:        (m.features as string[]) ?? [],
          auc:             Number(m.auc ?? 0),
          liftAtDecile1:   Number(m.lift_at_decile1 ?? 0),
          trainedAt:       String(m.trained_at ?? ''),
          status:          (m.status ?? 'shadow') as AdaptiveModel['status'],
          predictionsToday: Number(m.predictions_today ?? 0),
          createdAt:       String(m.created_at ?? ''),
        })));
      })
      .catch(() => {})
      .finally(() => setLoadingModels(false));
  }, []);
  const STATUS_BADGE: Record<string,string> = { live:'badge-green', training:'badge-amber', shadow:'badge-blue', retired:'badge-gray' };

  const [fbDecisionId, setFbDecisionId] = useState('');
  const [fbOutcome, setFbOutcome] = useState<'accepted'|'rejected'|'ignored'>('accepted');
  const [fbStatus, setFbStatus] = useState<'idle'|'sending'|'done'|'error'>('idle');
  const [fbMsg, setFbMsg] = useState('');

  const sendFeedback = async () => {
    if (!fbDecisionId.trim()) return;
    setFbStatus('sending');
    try {
      const r = await fetch('/api/models/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisionId: fbDecisionId.trim(), outcome: fbOutcome, tenantId: 'f0000000-0000-4000-a000-000000000001' }),
      });
      const j = await r.json();
      if (!r.ok) { setFbMsg(j.error ?? 'Failed'); setFbStatus('error'); return; }
      setFbMsg(`Propensity updated: ${j.before?.toFixed(3) ?? '?'} → ${j.after?.toFixed(3) ?? '?'}`);
      setFbStatus('done');
      setFbDecisionId('');
    } catch { setFbMsg('Network error'); setFbStatus('error'); }
    setTimeout(() => setFbStatus('idle'), 4000);
  };

  return (
    <div className="animate-in">
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div><h1 className="page-title">Adaptive Models</h1>
          <p className="page-subtitle">Propensity models per action. Trained on acceptance/rejection feedback from the decision engine.</p></div>
      </div>
      <div style={{ padding:'0 24px 24px' }}>
        {loadingModels ? (
          <div className="card"><div className="empty-state"><div className="empty-state-body">Loading models…</div></div></div>
        ) : models.length===0 ? (
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

      {/* Propensity Feedback */}
      <div style={{ padding: '0 24px 24px' }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={15} /> Adaptive Feedback — Manual Override
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Submit a decision outcome to update the action&apos;s propensity score using the Bayesian learning rate (±5%).
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 2, minWidth: 200 }}>
              <label className="form-label">Decision ID</label>
              <input className="form-input" value={fbDecisionId} onChange={e => setFbDecisionId(e.target.value)} placeholder="UUID from /api/decide response" />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label className="form-label">Outcome</label>
              <select className="form-input" value={fbOutcome} onChange={e => setFbOutcome(e.target.value as typeof fbOutcome)}>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="ignored">Ignored</option>
              </select>
            </div>
            <button
              className="btn btn-primary"
              onClick={sendFeedback}
              disabled={fbStatus === 'sending' || !fbDecisionId.trim()}
            >
              <Send size={13} /> {fbStatus === 'sending' ? 'Sending…' : 'Submit'}
            </button>
          </div>
          {fbStatus === 'done' && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a', fontSize: 13 }}>
              <CheckCircle size={14} /> {fbMsg}
            </div>
          )}
          {fbStatus === 'error' && (
            <div style={{ marginTop: 10, color: '#dc2626', fontSize: 13 }}>{fbMsg}</div>
          )}
        </div>
      </div>
    </div>
  );
}
