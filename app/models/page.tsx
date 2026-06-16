'use client';
import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { Brain, Plus, ChevronDown, ChevronUp, Trash2, X, Save, Activity, TrendingUp, Zap, Eye, FlaskConical, Info, Cloud, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';

const MODEL_TYPES = [
  { value: 'logistic_regression', label: 'Logistic Regression', desc: 'Fast, interpretable, good baseline' },
  { value: 'gradient_boosting',   label: 'Gradient Boosting',   desc: 'Higher accuracy on non-linear patterns' },
  { value: 'neural_net',          label: 'Neural Network',      desc: 'Best for complex feature interactions' },
  { value: 'bayesian',            label: 'Bayesian',            desc: 'Incorporates prior beliefs, great for small data' },
];

const ALGO_DETAIL: Record<string, {
  rule: string; formula: string; learnRate: string;
  strength: string; weakness: string; color: string;
}> = {
  logistic_regression: {
    rule:      'Online gradient descent on log-loss. Correct predictions get a smaller nudge; wrong predictions get a larger correction.',
    formula:   'p ← p + (y − p) × η    where η = 0.05, y ∈ {0, 1}',
    learnRate: '0.05 fixed',
    strength:  'Interpretable, stable, works well with noisy data',
    weakness:  'Cannot capture non-linear feature interactions',
    color:     '#6366F1',
  },
  gradient_boosting: {
    rule:      'Higher base rate (0.08) dampened by signal consistency. When recent outcomes are mixed, the effective rate drops — preventing overfit to noise.',
    formula:   'p ← p + Δ × consistency_weight    (base η = 0.08)',
    learnRate: '0.08 × consistency (adaptive)',
    strength:  'Robust to noisy signals, faster convergence when signal is clear',
    weakness:  'Can update slowly when outcomes are mixed',
    color:     '#059669',
  },
  neural_net: {
    rule:      'SGD with momentum (m=0.9). Tracks the direction of the last update. Amplifies if new signal agrees (momentum), dampens if it disagrees (reversal).',
    formula:   'v ← 0.9v + 0.1∇L,   p ← p + v',
    learnRate: '0.05 base + momentum blending',
    strength:  'Adapts quickly when signal is consistent; self-corrects on reversals',
    weakness:  'Can overshoot during sudden preference changes',
    color:     '#D97706',
  },
  bayesian: {
    rule:      'Beta-Binomial conjugate update. Maintains α (successes) and β (failures) counts. Propensity = α/(α+β). No hardcoded learning rate — driven purely by evidence.',
    formula:   'p = α/(α+β),   α ← α+1 on accept,   β ← β+1 on reject',
    learnRate: 'None — posterior driven by evidence count',
    strength:  'Principled uncertainty estimates, naturally converges, best for sparse data',
    weakness:  'Slower to react to sudden shifts in customer preference',
    color:     '#7C3AED',
  },
};

interface AuditEntry {
  id: string;
  created_at: string;
  after_snapshot: {
    outcome: string; channel: string; algorithm: string;
    formula: string; explanation: string;
    before: number; after: number; delta: number;
    decisionId?: string;
  };
}

const STANDARD_FEATURES = [
  'age', 'tenure_months', 'product_count', 'credit_score', 'income_band',
  'channel_preference', 'last_contact_days', 'churn_score', 'nbo_score',
  'consentGiven', 'segment', 'region',
];

interface DBModel {
  id: string;
  name: string;
  description?: string;
  action_id: string;
  model_type: string;
  features: string[];
  auc: number;
  lift_at_decile1: number;
  trained_at: string;
  predictions_today: number;
  status: string;
  created_at: string;
  _stats?: {
    served: number; accepted: number; rejected: number;
    acceptanceRate: number; totalDecisions: number;
    currentPropensity: number | null;
  };
}

interface HistoryPoint { propensity: number; outcome: string | null; created_at: string; channel?: string; date?: string; }

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  shadow:   { label: 'Shadow',   color: '#6366F1', bg: '#EEF2FF' },
  live:     { label: 'Live',     color: '#059669', bg: '#D1FAE5' },
  training: { label: 'Training', color: '#D97706', bg: '#FEF3C7' },
  retired:  { label: 'Retired',  color: '#9CA3AF', bg: '#F3F4F6' },
};

// Simple SVG sparkline for propensity history
function Sparkline({ points, width = 180, height = 40 }: { points: number[]; width?: number; height?: number }) {
  if (points.length < 2) return <span style={{ fontSize: 11, color: '#9CA3AF' }}>Collecting data…</span>;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 0.01;
  const xs = points.map((_, i) => (i / (points.length - 1)) * width);
  const ys = points.map(p => height - ((p - min) / range) * (height - 4) - 2);
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const trend = points.length >= 5
    ? points[points.length - 1] - points[points.length - 5]
    : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        <path d={d} fill="none" stroke="#6366F1" strokeWidth={1.5} strokeLinejoin="round" />
        <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={3} fill="#6366F1" />
      </svg>
      <div style={{ fontSize: 12 }}>
        <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{last.toFixed(3)}</div>
        <div style={{ fontSize: 10, color: trend > 0 ? '#059669' : trend < 0 ? '#DC2626' : '#9CA3AF' }}>
          {trend > 0 ? '▲' : trend < 0 ? '▼' : '─'} {Math.abs(trend).toFixed(3)}
        </div>
      </div>
    </div>
  );
}

function ModelModal({
  model, actions, onClose, onSaved,
}: {
  model: DBModel | null;
  actions: Array<{ id: string; name: string; basePropensity: number }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName]         = useState(model?.name ?? '');
  const [desc, setDesc]         = useState(model?.description ?? '');
  const [actionId, setActionId] = useState(model?.action_id ?? '');
  const [modelType, setModelType] = useState(model?.model_type ?? 'logistic_regression');
  const [features, setFeatures] = useState<string[]>(model?.features ?? []);
  const [customFeature, setCustomFeature] = useState('');
  const [auc, setAuc]           = useState(model?.auc ?? 0.75);
  const [lift, setLift]         = useState(model?.lift_at_decile1 ?? 2.0);
  const [status, setStatus]     = useState(model?.status ?? 'shadow');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const toggleFeature = (f: string) =>
    setFeatures(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  const addCustom = () => {
    const f = customFeature.trim();
    if (f && !features.includes(f)) { setFeatures(prev => [...prev, f]); setCustomFeature(''); }
  };

  const save = async () => {
    if (!name.trim() || !actionId) { setError('Name and action are required'); return; }
    setSaving(true); setError('');
    const body = {
      ...(model?.id ? { id: model.id } : {}),
      name, description: desc, action_id: actionId, model_type: modelType,
      features, auc, lift_at_decile1: lift, status, tenantId: TENANT_ID,
    };
    const r = await fetch('/api/models', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const j = await r.json();
    setSaving(false);
    if (!r.ok) { setError(j.error ?? 'Failed to save'); return; }
    onSaved();
  };

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}
    >
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12,
        width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Brain size={18} color="#6366F1" />
            <span style={{ fontWeight: 600, fontSize: 16 }}>
              {model ? 'Edit Model' : 'New Adaptive Model'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Name */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Model Name *
            </label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Credit Card Propensity v2"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 7,
                fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Description
            </label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
              placeholder="What customer behaviour does this model predict?"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 7,
                fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg)', outline: 'none',
                resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>

          {/* Action assignment */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Assigned to Action *
            </label>
            <select value={actionId} onChange={e => setActionId(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 7,
                fontSize: 13, color: actionId ? 'var(--text)' : '#9CA3AF', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }}>
              <option value="">Select an action…</option>
              {actions.map(a => (
                <option key={a.id} value={a.id}>{a.name} (propensity: {a.basePropensity.toFixed(3)})</option>
              ))}
            </select>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '5px 0 0' }}>
              This model will update this action&apos;s propensity score as feedback arrives.
            </p>
          </div>

          {/* Model type */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Algorithm
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {MODEL_TYPES.map(mt => (
                <button key={mt.value} onClick={() => setModelType(mt.value)}
                  style={{ padding: '10px 14px', border: `2px solid ${modelType === mt.value ? '#6366F1' : 'var(--border)'}`,
                    borderRadius: 8, background: modelType === mt.value ? '#EEF2FF' : 'var(--bg-panel)',
                    cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: modelType === mt.value ? '#6366F1' : 'var(--text)' }}>
                    {mt.label}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{mt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Features */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Input Features ({features.length} selected)
            </label>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 10px' }}>
              Select the customer attributes this model uses to predict propensity.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {STANDARD_FEATURES.map(f => (
                <button key={f} onClick={() => toggleFeature(f)}
                  style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                    border: `1px solid ${features.includes(f) ? '#6366F1' : 'var(--border)'}`,
                    background: features.includes(f) ? '#EEF2FF' : 'var(--bg-panel)',
                    color: features.includes(f) ? '#6366F1' : 'var(--text-muted)',
                    fontWeight: features.includes(f) ? 600 : 400 }}>
                  {features.includes(f) ? '✓ ' : ''}{f}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={customFeature} onChange={e => setCustomFeature(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustom()}
                placeholder="Add custom attribute…"
                style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6,
                  fontSize: 12, color: 'var(--text-primary)', background: 'var(--bg)', outline: 'none' }} />
              <button onClick={addCustom}
                style={{ padding: '7px 14px', background: 'none', border: '1px solid var(--border)',
                  borderRadius: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)' }}>
                + Add
              </button>
            </div>
            {features.filter(f => !STANDARD_FEATURES.includes(f)).map(f => (
              <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, margin: '6px 6px 0 0',
                padding: '3px 10px', background: '#F3F4F6', borderRadius: 20, fontSize: 12 }}>
                {f}
                <button onClick={() => setFeatures(prev => prev.filter(x => x !== f))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9CA3AF', lineHeight: 1 }}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>

          {/* Metrics + Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                AUC
              </label>
              <input type="number" value={auc} onChange={e => setAuc(Number(e.target.value))}
                min={0} max={1} step={0.001}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 7,
                  fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Lift @ Decile 1
              </label>
              <input type="number" value={lift} onChange={e => setLift(Number(e.target.value))}
                min={1} max={10} step={0.1}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 7,
                  fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Status
              </label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 7,
                  fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }}>
                <option value="shadow">Shadow (monitor only)</option>
                <option value="training">Training</option>
                <option value="live">Live (active updates)</option>
                <option value="retired">Retired</option>
              </select>
            </div>
          </div>

          {/* How learning works — context for user */}
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#166534', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={13} /> How this model learns
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#166534', lineHeight: 1.7 }}>
              <li>Every decision recorded via <code>/api/decide</code> logs propensity + outcome to the decision log</li>
              <li>When an outcome is submitted (accepted / rejected / ignored), the action&apos;s propensity nudges ±5%</li>
              <li><strong>Shadow</strong> mode: model observes and logs but does not affect live decisions</li>
              <li><strong>Live</strong> mode: propensity scores influence arbitration in real-time</li>
              <li>Promote to Live once AUC stabilises above 0.6 and lift exceeds 1.5×</li>
            </ul>
          </div>

          {error && <div style={{ color: '#DC2626', fontSize: 13 }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose}
            style={{ padding: '9px 18px', borderRadius: 7, border: '1px solid var(--border)',
              background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>
            Cancel
          </button>
          <button onClick={save} disabled={saving || !name.trim() || !actionId}
            style={{ padding: '9px 20px', borderRadius: 7, border: 'none',
              background: name.trim() && actionId ? '#6366F1' : '#9CA3AF',
              cursor: name.trim() && actionId ? 'pointer' : 'not-allowed',
              fontSize: 13, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 7 }}>
            <Save size={13} /> {saving ? 'Saving…' : (model ? 'Update Model' : 'Create Model')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ChannelBreakdown {
  channel: string; served: number; accepted: number; acceptanceRate: number;
}

function ModelCard({
  model, actions, onEdit, onDelete, onPromote,
}: {
  model: DBModel;
  actions: Array<{ id: string; name: string }>;
  onEdit: () => void;
  onDelete: () => void;
  onPromote: (status: string) => void;
}) {
  const [expanded, setExpanded]             = useState(false);
  const [history, setHistory]               = useState<HistoryPoint[]>([]);
  const [channelBreakdown, setChannelBreakdown] = useState<ChannelBreakdown[]>([]);
  const [recentResponses, setRecentResponses]   = useState<HistoryPoint[]>([]);
  const [auditLog, setAuditLog]             = useState<AuditEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab]           = useState<'chart'|'algorithm'|'audit'>('chart');

  const action = actions.find(a => a.id === model.action_id);
  const sm = STATUS_META[model.status] ?? STATUS_META.shadow;
  const s  = model._stats;

  const loadHistory = async () => {
    if (history.length > 0) { setExpanded(e => !e); return; }
    setLoadingHistory(true);
    const [histRes, feedbackRes, auditRes] = await Promise.all([
      fetch(`/api/models?id=${model.id}&tenantId=${TENANT_ID}`),
      fetch(`/api/models/feedback?actionId=${model.action_id}&tenantId=${TENANT_ID}`),
      fetch(`/api/models/audit?actionId=${model.action_id}&tenantId=${TENANT_ID}&limit=30`),
    ]);
    const histData     = await histRes.json();
    const feedbackData = await feedbackRes.json();
    const auditData    = await auditRes.json();
    setHistory(histData.history ?? []);
    setChannelBreakdown(feedbackData.channelBreakdown ?? []);
    setRecentResponses(
      (feedbackData.history ?? []).filter((h: HistoryPoint) => h.outcome).slice(0, 10)
    );
    setAuditLog(auditData.data ?? []);
    setLoadingHistory(false);
    setExpanded(true);
  };

  const propensities = history.map(h => h.propensity).filter(Boolean) as number[];

  return (
    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12,
      overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      {/* Top strip by status */}
      <div style={{ height: 3, background: sm.color }} />

      <div style={{ padding: '16px 20px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{model.name}</span>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                background: sm.bg, color: sm.color }}>
                {sm.label}
              </span>
            </div>
            {model.description && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                {model.description}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={onEdit}
              style={{ padding: '5px 12px', fontSize: 12, border: '1px solid var(--border)',
                borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              Edit
            </button>
            <button onClick={onDelete}
              style={{ padding: '5px 8px', border: '1px solid transparent', borderRadius: 6,
                background: 'none', cursor: 'pointer', color: '#DC2626', display: 'flex', alignItems: 'center' }}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Metadata chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '12px 0' }}>
          <span style={{ fontSize: 11, padding: '3px 9px', background: '#EEF2FF', color: '#6366F1', borderRadius: 20, fontWeight: 500 }}>
            {MODEL_TYPES.find(m => m.value === model.model_type)?.label ?? model.model_type}
          </span>
          <span style={{ fontSize: 11, padding: '3px 9px', background: '#F3F4F6', color: '#374151', borderRadius: 20 }}>
            Action: {action?.name ?? model.action_id}
          </span>
          {model.features.slice(0, 4).map(f => (
            <span key={f} style={{ fontSize: 11, padding: '3px 9px', background: '#F9FAFB', color: '#6B7280', borderRadius: 20, border: '1px solid #E5E7EB' }}>
              {f}
            </span>
          ))}
          {model.features.length > 4 && (
            <span style={{ fontSize: 11, padding: '3px 9px', color: '#9CA3AF' }}>+{model.features.length - 4} more</span>
          )}
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1,
          background: 'var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
          {[
            { label: 'AUC',         value: model.auc.toFixed(3),                   mono: true },
            { label: 'Lift D1',     value: model.lift_at_decile1.toFixed(1) + '×', mono: true, accent: true },
            { label: 'Decisions',   value: (s?.totalDecisions ?? 0).toLocaleString() },
            { label: 'Acceptance',  value: s ? (s.acceptanceRate * 100).toFixed(1) + '%' : '—' },
            { label: 'Propensity',  value: s?.currentPropensity != null ? s.currentPropensity.toFixed(3) : model.auc.toFixed(3), mono: true },
          ].map(({ label, value, mono, accent }) => (
            <div key={label} style={{ background: 'var(--bg-panel)', padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: mono ? 'monospace' : 'inherit',
                color: accent ? '#059669' : 'var(--text)' }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Lifecycle controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {model.status === 'shadow' && (
            <button onClick={() => onPromote('live')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                border: '1px solid #6366F1', borderRadius: 6, background: 'none',
                fontSize: 12, fontWeight: 500, cursor: 'pointer', color: '#6366F1' }}>
              <Zap size={12} /> Promote to Live
            </button>
          )}
          {model.status === 'live' && (
            <button onClick={() => onPromote('shadow')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                border: '1px solid var(--border)', borderRadius: 6, background: 'none',
                fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)' }}>
              <Eye size={12} /> Move to Shadow
            </button>
          )}
          {(model.status === 'live' || model.status === 'shadow') && (
            <button onClick={() => onPromote('retired')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                border: '1px solid var(--border)', borderRadius: 6, background: 'none',
                fontSize: 12, cursor: 'pointer', color: '#9CA3AF' }}>
              Retire
            </button>
          )}
          {model.status === 'retired' && (
            <button onClick={() => onPromote('shadow')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                border: '1px solid var(--border)', borderRadius: 6, background: 'none',
                fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)' }}>
              Reactivate
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={loadHistory}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
              border: '1px solid var(--border)', borderRadius: 6, background: 'none',
              fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)' }}>
            <Activity size={12} />
            {loadingHistory ? 'Loading…' : expanded ? 'Hide chart' : 'Propensity history'}
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Expanded tabbed panel */}
        {expanded && (() => {
          const algo = ALGO_DETAIL[model.model_type] ?? ALGO_DETAIL.logistic_regression;
          const tabs = [
            { id: 'chart' as const,     label: 'Learning Curve', icon: <TrendingUp size={12} /> },
            { id: 'algorithm' as const, label: 'Algorithm',      icon: <FlaskConical size={12} /> },
            { id: 'audit' as const,     label: `Audit Trail (${auditLog.length})`, icon: <Info size={12} /> },
          ];
          return (
            <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              {/* Tab bar */}
              <div style={{ display: 'flex', gap: 2, marginBottom: 16, background: '#F3F4F6', borderRadius: 8, padding: 3 }}>
                {tabs.map(t => (
                  <button key={t.id} onClick={() => setActiveTab(t.id)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                      background: activeTab === t.id ? '#fff' : 'transparent',
                      color: activeTab === t.id ? 'var(--text-primary)' : '#6B7280',
                      boxShadow: activeTab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.15s',
                    }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {/* ── Tab: Learning Curve ── */}
              {activeTab === 'chart' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 10,
                      textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Propensity over last {history.length} decisions
                    </div>
                    {propensities.length < 2 ? (
                      <div style={{ fontSize: 13, color: '#9CA3AF', padding: '12px 0' }}>
                        No feedback recorded yet — submit outcomes via /api/outcome to see the learning curve.
                      </div>
                    ) : (
                      <>
                        <Sparkline points={propensities} width={540} height={60} />
                        <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
                          {(['accepted','rejected','ignored'] as const).map(o => {
                            const count = history.filter(h => h.outcome === o).length;
                            const colors: Record<string, string> = { accepted:'#059669', rejected:'#DC2626', ignored:'#9CA3AF' };
                            return (
                              <div key={o} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors[o] }} />
                                <span style={{ fontSize: 12, color: '#6B7280' }}>{o}: <strong>{count}</strong></span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Channel breakdown */}
                  {channelBreakdown.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 10,
                        textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Response by Channel
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                        {channelBreakdown.map(ch => (
                          <div key={ch.channel} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 14px' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'capitalize', marginBottom: 4 }}>{ch.channel}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{(ch.acceptanceRate * 100).toFixed(1)}%</div>
                            <div style={{ fontSize: 11, color: '#9CA3AF' }}>{ch.accepted}/{ch.served} served</div>
                            <div style={{ height: 3, background: '#E5E7EB', borderRadius: 2, marginTop: 6 }}>
                              <div style={{ height: '100%', width: `${ch.acceptanceRate * 100}%`,
                                background: ch.acceptanceRate > 0.5 ? '#059669' : ch.acceptanceRate > 0.2 ? '#D97706' : '#DC2626',
                                borderRadius: 2 }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab: Algorithm Transparency ── */}
              {activeTab === 'algorithm' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Algorithm identity */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: algo.color, flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                      {MODEL_TYPES.find(m => m.value === model.model_type)?.label ?? model.model_type}
                    </span>
                    <span style={{ fontSize: 12, color: '#9CA3AF' }}>Learning rate: {algo.learnRate}</span>
                  </div>

                  {/* How it works */}
                  <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      Update Rule
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: '0 0 10px', lineHeight: 1.6 }}>{algo.rule}</p>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, background: '#1E1E2E', color: '#A6E3A1',
                      padding: '10px 14px', borderRadius: 6, letterSpacing: '0.02em' }}>
                      {algo.formula}
                    </div>
                  </div>

                  {/* Strengths / Weaknesses */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
                        Strengths
                      </div>
                      <p style={{ fontSize: 12, color: '#166534', margin: 0, lineHeight: 1.5 }}>{algo.strength}</p>
                    </div>
                    <div style={{ background: '#FEF2F2', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
                        Limitations
                      </div>
                      <p style={{ fontSize: 12, color: '#991B1B', margin: 0, lineHeight: 1.5 }}>{algo.weakness}</p>
                    </div>
                  </div>

                  {/* Last update explanation */}
                  {auditLog[0] && (
                    <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#4338CA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                        Last Update Explanation
                      </div>
                      <p style={{ fontSize: 12, color: '#3730A3', margin: '0 0 8px', lineHeight: 1.6 }}>
                        {auditLog[0].after_snapshot.explanation}
                      </p>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#6366F1', background: '#fff', padding: '6px 10px', borderRadius: 5 }}>
                        {auditLog[0].after_snapshot.formula}
                      </div>
                    </div>
                  )}

                  {/* Algorithm comparison hint */}
                  <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.5, borderTop: '1px solid #F3F4F6', paddingTop: 12 }}>
                    <strong style={{ color: '#6B7280' }}>Tip:</strong> Run the same action in Shadow mode with a different algorithm to compare propensity trajectories before promoting to Live.
                  </div>
                </div>
              )}

              {/* ── Tab: Audit Trail ── */}
              {activeTab === 'audit' && (
                <div>
                  {auditLog.length === 0 ? (
                    <div style={{ fontSize: 13, color: '#9CA3AF', padding: '20px 0', textAlign: 'center' }}>
                      No updates recorded yet. Every propensity change will appear here.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                      {auditLog.map((entry, i) => {
                        const snap = entry.after_snapshot;
                        const outcomeColor: Record<string, string> = { accepted: '#059669', rejected: '#DC2626', ignored: '#9CA3AF' };
                        const deltaColor = snap.delta > 0 ? '#059669' : snap.delta < 0 ? '#DC2626' : '#9CA3AF';
                        return (
                          <div key={entry.id} style={{ padding: '10px 14px', background: '#fff',
                            borderBottom: i < auditLog.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                            {/* Row 1: outcome + delta + channel + time */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                                background: snap.outcome === 'accepted' ? '#D1FAE5' : snap.outcome === 'rejected' ? '#FEE2E2' : '#F3F4F6',
                                color: outcomeColor[snap.outcome] ?? '#9CA3AF' }}>
                                {snap.outcome}
                              </span>
                              <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: deltaColor }}>
                                {snap.delta >= 0 ? '+' : ''}{snap.delta.toFixed(4)}
                              </span>
                              <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>
                                {snap.before.toFixed(4)} → {snap.after.toFixed(4)}
                              </span>
                              <span style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'capitalize' }}>
                                via {snap.channel}
                              </span>
                              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9CA3AF' }}>
                                {new Date(entry.created_at).toLocaleString()}
                              </span>
                            </div>
                            {/* Row 2: explanation */}
                            <p style={{ margin: '0 0 5px', fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                              {snap.explanation}
                            </p>
                            {/* Row 3: formula chip */}
                            <code style={{ fontSize: 11, color: '#6366F1', background: '#EEF2FF',
                              padding: '2px 7px', borderRadius: 4 }}>
                              {snap.formula}
                            </code>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── External Provider Definitions ─────────────────────────────────────────────

const PROVIDERS = [
  {
    value: 'vertex_ai', label: 'Google Vertex AI',
    logo: '🟢', color: '#1a73e8',
    desc: 'Managed ML platform on Google Cloud. Supports AutoML and custom training.',
    docsUrl: 'https://cloud.google.com/vertex-ai/docs/predictions/get-online-predictions',
    fields: ['endpoint_url', 'api_key', 'project_id', 'region'],
    payloadHint: '{"instances": [{...features}]} → predictions[0]',
  },
  {
    value: 'sagemaker', label: 'AWS SageMaker',
    logo: '🟠', color: '#FF9900',
    desc: 'Amazon SageMaker real-time inference endpoints. Sign requests with AWS credentials.',
    docsUrl: 'https://docs.aws.amazon.com/sagemaker/latest/dg/realtime-endpoints-deployment.html',
    fields: ['endpoint_url', 'api_key', 'region', 'model_id'],
    payloadHint: '{...features} → predictions[0]',
  },
  {
    value: 'h2o', label: 'H2O.ai',
    logo: '💧', color: '#FFD700',
    desc: 'H2O-3 / MOJO scoring server. REST scoring endpoint for deployed models.',
    docsUrl: 'https://docs.h2o.ai/h2o/latest-stable/h2o-docs/productionizing.html',
    fields: ['endpoint_url', 'api_key', 'model_id'],
    payloadHint: '{...features} → score',
  },
  {
    value: 'azure_ml', label: 'Azure ML',
    logo: '🔵', color: '#0078D4',
    desc: 'Azure Machine Learning real-time endpoints. Managed online endpoints.',
    docsUrl: 'https://learn.microsoft.com/en-us/azure/machine-learning/concept-endpoints',
    fields: ['endpoint_url', 'api_key', 'project_id', 'model_id'],
    payloadHint: '{"data": [[...values]]} → result[0]',
  },
  {
    value: 'databricks', label: 'Databricks MLflow',
    logo: '🧱', color: '#FF3621',
    desc: 'MLflow Model Serving on Databricks. Deploy registered models as REST endpoints.',
    docsUrl: 'https://docs.databricks.com/en/machine-learning/model-serving/index.html',
    fields: ['endpoint_url', 'api_key', 'model_id'],
    payloadHint: '{"inputs": [{...features}]} → predictions[0]',
  },
  {
    value: 'custom', label: 'Custom HTTP',
    logo: '⚡', color: '#6366F1',
    desc: 'Any REST scoring endpoint. Configure payload mapping and response field extraction.',
    docsUrl: '',
    fields: ['endpoint_url', 'api_key', 'model_id', 'output_field'],
    payloadHint: '{...features} → output_field',
  },
];

const FIELD_LABELS: Record<string, { label: string; placeholder: string; secret?: boolean }> = {
  endpoint_url: { label: 'Scoring Endpoint URL', placeholder: 'https://…/predict' },
  api_key:      { label: 'API Key / Token', placeholder: 'sk-…', secret: true },
  model_id:     { label: 'Model ID / ARN / Name', placeholder: 'projects/…/models/…' },
  region:       { label: 'Region', placeholder: 'us-central1 / us-east-1' },
  project_id:   { label: 'Project / Subscription ID', placeholder: 'my-gcp-project' },
  output_field: { label: 'Score Field Name', placeholder: 'score' },
};

interface ExternalModelConfig {
  id?: string;
  tenant_id?: string;
  name: string;
  description: string;
  provider: string;
  endpoint_url: string;
  api_key: string;
  model_id: string;
  region: string;
  project_id: string;
  output_field: string;
  feature_map: Record<string, string>;
  status: string;
  action_id?: string | null;
  last_tested_at?: string;
  last_test_result?: { success: boolean; score?: number; latencyMs?: number; error?: string } | null;
}

function ExternalModelModal({
  config, onClose, onSaved,
}: {
  config: ExternalModelConfig | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const provider = PROVIDERS.find(p => p.value === (config?.provider ?? ''));
  const [selectedProvider, setSelectedProvider] = useState(config?.provider ?? '');
  const [name, setName]               = useState(config?.name ?? '');
  const [desc, setDesc]               = useState(config?.description ?? '');
  const [endpointUrl, setEndpointUrl] = useState(config?.endpoint_url ?? '');
  const [apiKey, setApiKey]           = useState(config?.api_key ?? '');
  const [modelId, setModelId]         = useState(config?.model_id ?? '');
  const [region, setRegion]           = useState(config?.region ?? '');
  const [projectId, setProjectId]     = useState(config?.project_id ?? '');
  const [outputField, setOutputField] = useState(config?.output_field ?? 'score');
  const [status, setStatus]           = useState(config?.status ?? 'inactive');
  const [saving, setSaving]           = useState(false);
  const [testing, setTesting]         = useState(false);
  const [testResult, setTestResult]   = useState<{ success: boolean; score?: number; latencyMs?: number; error?: string } | null>(
    config?.last_test_result ?? null
  );
  const [error, setError] = useState('');

  const activeProvider = PROVIDERS.find(p => p.value === selectedProvider);

  const buildBody = () => ({
    ...(config?.id ? { id: config.id } : {}),
    name, description: desc,
    provider: selectedProvider,
    endpoint_url: endpointUrl,
    api_key: apiKey,
    model_id: modelId,
    region, project_id: projectId,
    output_field: outputField,
    status,
    feature_map: {},
    tenantId: TENANT_ID,
  });

  const save = async () => {
    if (!name.trim() || !selectedProvider) { setError('Name and provider are required'); return; }
    setSaving(true); setError('');
    const res = await fetch('/api/models/external', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildBody()),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Save failed'); return; }
    onSaved();
  };

  const testConnection = async () => {
    setTesting(true); setError(''); setTestResult(null);
    const res = await fetch('/api/models/external?test=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildBody()),
    });
    const d = await res.json();
    setTestResult(d);
    setTesting(false);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 14,
        padding: 28, width: 560, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            {config?.id ? 'Edit External Model' : 'Import External Model'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '8px 14px', marginBottom: 14, fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Provider picker — shown only when creating */}
        {!config?.id && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Provider *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {PROVIDERS.map(p => (
                <button key={p.value} onClick={() => setSelectedProvider(p.value)}
                  style={{
                    padding: '10px 12px', borderRadius: 8, border: `2px solid ${selectedProvider === p.value ? p.color : 'var(--border)'}`,
                    background: selectedProvider === p.value ? `${p.color}11` : 'var(--bg)',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                  }}>
                  <div style={{ fontSize: 16, marginBottom: 2 }}>{p.logo}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{p.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeProvider && (
          <div style={{
            background: `${activeProvider.color}08`, border: `1px solid ${activeProvider.color}33`,
            borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12, color: 'var(--text-muted)',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 18 }}>{activeProvider.logo}</span>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{activeProvider.label}</div>
              <div>{activeProvider.desc}</div>
              <div style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 11, color: activeProvider.color }}>
                Payload: {activeProvider.payloadHint}
              </div>
            </div>
          </div>
        )}

        {/* Name */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Vertex AI Propensity Model v2"
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* Description */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Description</label>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional description"
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* Dynamic fields per provider */}
        {activeProvider && activeProvider.fields.map(fieldKey => {
          const f = FIELD_LABELS[fieldKey];
          if (!f) return null;
          const vals: Record<string, string> = { endpoint_url: endpointUrl, api_key: apiKey, model_id: modelId, region, project_id: projectId, output_field: outputField };
          const setters: Record<string, (v: string) => void> = { endpoint_url: setEndpointUrl, api_key: setApiKey, model_id: setModelId, region: setRegion, project_id: setProjectId, output_field: setOutputField };
          return (
            <div key={fieldKey} style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{f.label}</label>
              <input
                type={f.secret ? 'password' : 'text'}
                value={vals[fieldKey]}
                onChange={e => setters[fieldKey](e.target.value)}
                placeholder={f.placeholder}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: f.secret ? 'monospace' : 'inherit' }}
              />
            </div>
          );
        })}

        {/* Status */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: '100%' }}>
            <option value="inactive">Inactive — configured but not scoring</option>
            <option value="testing">Testing — validate connection only</option>
            <option value="active">Active — use for live scoring</option>
          </select>
        </div>

        {/* Test result */}
        {testResult && (
          <div style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 8,
            background: testResult.success ? '#dcfce7' : '#fee2e2',
            border: `1px solid ${testResult.success ? '#86efac' : '#fca5a5'}`,
            fontSize: 13,
          }}>
            {testResult.success ? (
              <div style={{ color: '#15803d' }}>
                <strong>Connection successful</strong>{' '}
                {testResult.score !== undefined && `— score: ${testResult.score.toFixed(4)}`}{' '}
                {testResult.latencyMs !== undefined && `(${testResult.latencyMs}ms)`}
              </div>
            ) : (
              <div style={{ color: '#b91c1c' }}>
                <strong>Test failed:</strong> {testResult.error}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={testConnection} disabled={testing || !endpointUrl.trim()}
            style={{
              padding: '9px 18px', borderRadius: 8,
              background: 'var(--bg)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', cursor: testing || !endpointUrl.trim() ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 500, opacity: testing || !endpointUrl.trim() ? 0.6 : 1,
            }}>
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose}
              style={{ padding: '9px 18px', borderRadius: 8, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13 }}>
              Cancel
            </button>
            <button onClick={save} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 8, background: '#6366F1', color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
              <Save size={14} /> {saving ? 'Saving…' : config?.id ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExternalModelsTab({ actions }: { actions: Array<{ id: string; name: string; basePropensity: number }> }) {
  const [configs, setConfigs]       = useState<ExternalModelConfig[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState<ExternalModelConfig | null>(null);
  const [configured, setConfigured] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/models/external?tenantId=${TENANT_ID}`);
      const d = await r.json();
      setConfigured(d.configured !== false);
      setConfigs(d.data ?? []);
    } catch {
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onSaved = () => { setShowModal(false); load(); };

  const deleteConfig = async (cfg: ExternalModelConfig) => {
    if (!cfg.id || !confirm(`Delete "${cfg.name}"?`)) return;
    await fetch(`/api/models/external?id=${cfg.id}&tenantId=${TENANT_ID}`, { method: 'DELETE' });
    load();
  };

  const openEdit = (cfg: ExternalModelConfig) => { setEditing(cfg); setShowModal(true); };
  const openNew  = () => { setEditing(null); setShowModal(true); };

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>;

  if (!configured) return (
    <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '16px 20px', fontSize: 13, color: '#78350f' }}>
      Supabase not configured — run <code>schema_v6.sql</code> and set environment variables to use external model imports.
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>External Model Integrations</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Connect cloud-hosted models from Google, AWS, H2O, Azure, and Databricks for real-time propensity scoring
          </p>
        </div>
        <button onClick={openNew}
          style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#6366F1', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          <Plus size={15} /> Import Model
        </button>
      </div>

      {/* Provider overview chips */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 28 }}>
        {PROVIDERS.map(p => {
          const count = configs.filter(c => c.provider === p.value).length;
          return (
            <div key={p.value} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 999,
              background: count > 0 ? `${p.color}11` : 'var(--bg-panel)',
              border: `1px solid ${count > 0 ? p.color + '44' : 'var(--border)'}`,
              fontSize: 12, fontWeight: count > 0 ? 600 : 400,
              color: count > 0 ? p.color : 'var(--text-muted)',
            }}>
              <span>{p.logo}</span>
              <span>{p.label}</span>
              {count > 0 && <span style={{ background: p.color, color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '1px 6px' }}>{count}</span>}
            </div>
          );
        })}
      </div>

      {configs.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '80px 24px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-panel)',
          textAlign: 'center',
        }}>
          <Cloud size={52} color="#C7D2FE" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>No external models connected</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 440, margin: '0 0 24px' }}>
            Import scoring models from Google Vertex AI, AWS SageMaker, H2O.ai, Azure ML, or Databricks MLflow.
            Configure the endpoint URL and credentials to start using external propensity scores.
          </p>
          <button onClick={openNew}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#6366F1', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            <Plus size={15} /> Import first model
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))', gap: 16 }}>
          {configs.map(cfg => {
            const prov = PROVIDERS.find(p => p.value === cfg.provider);
            const statusColors: Record<string, { bg: string; color: string }> = {
              active:   { bg: '#D1FAE5', color: '#059669' },
              testing:  { bg: '#FEF3C7', color: '#D97706' },
              inactive: { bg: '#F3F4F6', color: '#6B7280' },
            };
            const sc = statusColors[cfg.status] ?? statusColors.inactive;
            return (
              <div key={cfg.id} style={{
                background: 'var(--bg-panel)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 20,
                borderLeft: `4px solid ${prov?.color ?? '#6366F1'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 20 }}>{prov?.logo ?? '🔌'}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{cfg.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{prov?.label ?? cfg.provider}</div>
                    </div>
                  </div>
                  <span style={{ background: sc.bg, color: sc.color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
                    {cfg.status.charAt(0).toUpperCase() + cfg.status.slice(1)}
                  </span>
                </div>

                {cfg.description && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>{cfg.description}</p>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  {cfg.endpoint_url && (
                    <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '6px 10px' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Endpoint</div>
                      <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cfg.endpoint_url.replace(/^https?:\/\//, '')}
                      </div>
                    </div>
                  )}
                  {cfg.model_id && (
                    <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '6px 10px' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Model ID</div>
                      <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cfg.model_id}
                      </div>
                    </div>
                  )}
                </div>

                {cfg.last_test_result && (
                  <div style={{
                    padding: '7px 10px', borderRadius: 7, marginBottom: 12, fontSize: 12,
                    background: cfg.last_test_result.success ? '#dcfce7' : '#fee2e2',
                    color: cfg.last_test_result.success ? '#15803d' : '#b91c1c',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {cfg.last_test_result.success
                      ? <><CheckCircle2 size={13} /> Last test: score {cfg.last_test_result.score?.toFixed(4) ?? '—'} ({cfg.last_test_result.latencyMs}ms)</>
                      : <><AlertCircle size={13} /> {cfg.last_test_result.error}</>
                    }
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => openEdit(cfg)}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                    Configure
                  </button>
                  {prov?.docsUrl && (
                    <a href={prov.docsUrl} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 10px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12, textDecoration: 'none' }}>
                      <ExternalLink size={12} /> Docs
                    </a>
                  )}
                  <button onClick={() => deleteConfig(cfg)}
                    style={{ padding: '7px 10px', borderRadius: 7, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', cursor: 'pointer', fontSize: 12 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <ExternalModelModal config={editing} onClose={() => setShowModal(false)} onSaved={onSaved} />
      )}
    </div>
  );
}

export default function ModelsPage() {
  const { actions } = useStore();
  const [models, setModels]       = useState<DBModel[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<DBModel | null>(null);
  const [activeTab, setActiveTab] = useState<'native' | 'external'>('native');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/models?tenantId=${TENANT_ID}`);
    const d = await r.json();
    setModels(d.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew  = () => { setEditing(null);  setShowModal(true); };
  const openEdit = (m: DBModel) => { setEditing(m); setShowModal(true); };
  const onSaved  = () => { setShowModal(false); load(); };

  const deleteModel = async (m: DBModel) => {
    if (!confirm(`Delete model "${m.name}"? This cannot be undone.`)) return;
    await fetch(`/api/models?id=${m.id}&tenantId=${TENANT_ID}`, { method: 'DELETE' });
    load();
  };

  const promoteModel = async (m: DBModel, status: string) => {
    await fetch('/api/models', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...m, action_id: m.action_id, status, tenantId: TENANT_ID }),
    });
    load();
  };

  const live    = models.filter(m => m.status === 'live');
  const shadow  = models.filter(m => m.status === 'shadow');
  const other   = models.filter(m => m.status !== 'live' && m.status !== 'shadow');

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Adaptive Models</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '6px 0 0' }}>
            Propensity models per action — learn continuously from decision outcomes
          </p>
        </div>
        {activeTab === 'native' && (
          <button onClick={openNew}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#6366F1', color: '#fff',
              border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            <Plus size={15} /> New Model
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 28, borderBottom: '2px solid var(--border)', paddingBottom: 0 }}>
        {[
          { key: 'native', label: 'Native Models', icon: <Brain size={14} /> },
          { key: 'external', label: 'External Integrations', icon: <Cloud size={14} /> },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as 'native' | 'external')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 18px', borderRadius: '8px 8px 0 0',
              background: activeTab === tab.key ? 'var(--bg-panel)' : 'transparent',
              border: activeTab === tab.key ? '2px solid var(--border)' : '2px solid transparent',
              borderBottom: activeTab === tab.key ? '2px solid var(--bg-panel)' : '2px solid transparent',
              marginBottom: activeTab === tab.key ? '-2px' : 0,
              color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: activeTab === tab.key ? 600 : 400,
              fontSize: 13, cursor: 'pointer',
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'external' && <ExternalModelsTab actions={actions} />}

      {activeTab === 'native' && <>
      {/* How learning works — always visible banner */}
      <div style={{ background: '#F0F0FF', border: '1px solid #C7D2FE', borderRadius: 10, padding: '14px 20px', marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#4338CA', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Zap size={14} /> How adaptive learning works in NexusCDH
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { n: '1', title: 'Decision made', body: 'Customer is served an action via /api/decide. Propensity score recorded in decision_log.' },
            { n: '2', title: 'Outcome captured', body: 'Accepted / Rejected / Ignored outcome submitted to /api/models/feedback.' },
            { n: '3', title: 'Propensity updated', body: 'Bayesian nudge: accepted +5% toward 1.0, rejected -5% toward 0.0, ignored -1.5%.' },
            { n: '4', title: 'Model improves', body: 'Next decision uses the updated propensity. Shadow models observe without changing live scores.' },
          ].map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 10 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#6366F1', color: '#fff',
                fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {s.n}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#3730A3' }}>{s.title}</div>
                <div style={{ fontSize: 11, color: '#6366F1', lineHeight: 1.5, marginTop: 2 }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 14 }}>
          Loading models…
        </div>
      )}

      {!loading && models.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '80px 24px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-panel)' }}>
          <Brain size={56} color="#C7D2FE" style={{ marginBottom: 16 }} />
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>No models yet</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 420, margin: '0 0 24px' }}>
            Create an adaptive model for each action you want to optimise. Assign features, pick an algorithm, then promote to Live when ready.
          </p>
          <button onClick={openNew}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#6366F1', color: '#fff',
              border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            <Plus size={15} /> Create first model
          </button>
        </div>
      )}

      {!loading && models.length > 0 && (
        <>
          {live.length > 0 && (
            <section style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', textTransform: 'uppercase',
                letterSpacing: '0.07em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#059669' }} />
                Live ({live.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(560px, 1fr))', gap: 16 }}>
                {live.map(m => (
                  <ModelCard key={m.id} model={m} actions={actions}
                    onEdit={() => openEdit(m)}
                    onDelete={() => deleteModel(m)}
                    onPromote={s => promoteModel(m, s)} />
                ))}
              </div>
            </section>
          )}

          {shadow.length > 0 && (
            <section style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6366F1', textTransform: 'uppercase',
                letterSpacing: '0.07em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366F1' }} />
                Shadow / Monitoring ({shadow.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(560px, 1fr))', gap: 16 }}>
                {shadow.map(m => (
                  <ModelCard key={m.id} model={m} actions={actions}
                    onEdit={() => openEdit(m)}
                    onDelete={() => deleteModel(m)}
                    onPromote={s => promoteModel(m, s)} />
                ))}
              </div>
            </section>
          )}

          {other.length > 0 && (
            <section>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
                letterSpacing: '0.07em', marginBottom: 12 }}>
                Training / Retired ({other.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(560px, 1fr))', gap: 16 }}>
                {other.map(m => (
                  <ModelCard key={m.id} model={m} actions={actions}
                    onEdit={() => openEdit(m)}
                    onDelete={() => deleteModel(m)}
                    onPromote={s => promoteModel(m, s)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {showModal && (
        <ModelModal model={editing} actions={actions} onClose={() => setShowModal(false)} onSaved={onSaved} />
      )}
      </>}
    </div>
  );
}
