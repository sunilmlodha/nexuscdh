'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2, AlertTriangle, Clock, Trash2, Play, RefreshCw,
  X, ChevronRight, Loader2, Sparkles,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DecisionRecord {
  id: string;
  customer_id: string;
  strategy_id: string;
  strategy_name: string;
  action_id?: string;
  action_name?: string;
  channel_id?: string;
  served: boolean;
  suppression_reason?: string;
  propensity?: number;
  created_at: string;
}

interface Strategy {
  id: string;
  name: string;
  status: string;
}

interface BatchJob {
  id: string;
  name: string;
  strategy_ids: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_customers?: number;
  served_count?: number;
  suppressed_count?: number;
  run_at?: string;
  completed_at?: string;
  error_message?: string;
}

interface AuditEntry {
  id: string;
  entity_type: string;
  entity_name?: string;
  action: string;
  changed_by?: string;
  created_at: string;
}

type HealthStatus = 'operational' | 'idle' | 'degraded' | 'checking';

interface HealthService {
  name: string;
  status: HealthStatus;
  latency: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_BADGE: Record<string, string> = {
  operational: 'badge-green',
  idle: 'badge-amber',
  degraded: 'badge-red',
  checking: 'badge-amber',
};
const DOT_CLS: Record<string, string> = {
  operational: 'dot-green',
  idle: 'dot-amber',
  degraded: 'dot-red',
  checking: 'dot-amber',
};
const BATCH_STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  pending:   { bg: 'var(--bg-muted)',    color: 'var(--text-muted)' },
  running:   { bg: 'rgba(59,130,246,.15)', color: '#60a5fa' },
  completed: { bg: 'rgba(34,197,94,.15)', color: '#4ade80' },
  failed:    { bg: 'rgba(239,68,68,.15)', color: '#f87171' },
};
const ENTITY_BADGE: Record<string, string> = {
  strategy: 'badge-blue',
  policy: 'badge-purple',
  decision_outcome: 'badge-green',
};
const ACTION_BADGE: Record<string, string> = {
  created: 'badge-green',
  updated: 'badge-amber',
  deleted: 'badge-red',
  activated: 'badge-blue',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OperationsPage() {
  // KPI state
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [decisionsLoading, setDecisionsLoading] = useState(true);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [strategiesLoading, setStrategiesLoading] = useState(true);

  // Health state
  const [health, setHealth] = useState<HealthService[]>([
    { name: 'Decision Engine',  status: 'checking', latency: null },
    { name: 'Database',         status: 'checking', latency: null },
    { name: 'Audit Logger',     status: 'checking', latency: null },
    { name: 'Batch Processor',  status: 'checking', latency: null },
    { name: 'Profile Store',    status: 'checking', latency: null },
    { name: 'Analytics',        status: 'checking', latency: null },
  ]);

  // Batch state
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [batchLoading, setBatchLoading] = useState(true);

  // Audit state
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);

  // AI explain state
  const [explaining, setExplaining] = useState<string | null>(null);
  const [explainResult, setExplainResult] = useState<{ id: string; headline: string; explanation: string; keyFactors: string[]; recommendation: string | null } | null>(null);

  const explainDecision = async (d: DecisionRecord) => {
    setExplaining(d.id);
    setExplainResult(null);
    const r = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'explain_decision',
        context: {
          actionName: d.action_name ?? 'unknown',
          strategyName: d.strategy_name,
          served: d.served,
          propensity: d.propensity ?? 0,
          suppressionReason: d.suppression_reason,
        },
      }),
    });
    const j = await r.json();
    setExplaining(null);
    if (r.ok) setExplainResult({ id: d.id, ...j });
  };

  // Modal state
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchForm, setBatchForm] = useState({
    name: '',
    strategyIds: [] as string[],
    channelId: '',
    runNow: true,
  });
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  // ── Fetchers ────────────────────────────────────────────────────────────────

  const fetchDecisions = useCallback(async () => {
    setDecisionsLoading(true);
    try {
      const res = await fetch('/api/decisions?tenantId=default-tenant&limit=1000');
      const json = await res.json();
      setDecisions(json.data ?? []);
    } catch {
      setDecisions([]);
    } finally {
      setDecisionsLoading(false);
    }
  }, []);

  const fetchStrategiesData = useCallback(async () => {
    setStrategiesLoading(true);
    try {
      const res = await fetch('/api/strategies?tenantId=default-tenant');
      const json = await res.json();
      setStrategies(json.data ?? []);
    } catch {
      setStrategies([]);
    } finally {
      setStrategiesLoading(false);
    }
  }, []);

  const runHealthChecks = useCallback(async () => {
    setHealth(prev => prev.map(s => ({ ...s, status: 'checking' as HealthStatus, latency: null })));

    const checks: Array<{ name: string; fn: () => Promise<HealthStatus> }> = [
      {
        name: 'Decision Engine',
        fn: async () => {
          const t = Date.now();
          try {
            await fetch('/api/decide', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ customerId: '__health__', strategyId: '__health__' }),
            });
            return 'operational';
          } catch {
            return 'degraded';
          } finally {
            // latency recorded below
            void t;
          }
        },
      },
      {
        name: 'Database',
        fn: async () => {
          const res = await fetch('/api/strategies?tenantId=default-tenant');
          const json = await res.json();
          return json.configured ? 'operational' : 'idle';
        },
      },
      {
        name: 'Audit Logger',
        fn: async () => {
          await fetch('/api/audit?tenantId=default-tenant&limit=1');
          return 'operational';
        },
      },
      {
        name: 'Batch Processor',
        fn: async () => {
          await fetch('/api/batch?tenantId=default-tenant');
          return 'operational';
        },
      },
      {
        name: 'Profile Store',
        fn: async () => {
          await fetch('/api/profile?list=true&tenantId=default-tenant');
          return 'operational';
        },
      },
      {
        name: 'Analytics',
        fn: async () => {
          await fetch('/api/analytics?tenantId=default-tenant');
          return 'operational';
        },
      },
    ];

    await Promise.allSettled(
      checks.map(async ({ name, fn }) => {
        const t0 = Date.now();
        let status: HealthStatus = 'degraded';
        try {
          status = await fn();
        } catch {
          status = 'degraded';
        }
        const ms = Date.now() - t0;
        const latency = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
        setHealth(prev =>
          prev.map(s => s.name === name ? { ...s, status, latency } : s)
        );
      })
    );
  }, []);

  const fetchBatchJobs = useCallback(async () => {
    setBatchLoading(true);
    try {
      const res = await fetch('/api/batch?tenantId=default-tenant');
      const json = await res.json();
      setBatchJobs(json.data ?? []);
    } catch {
      setBatchJobs([]);
    } finally {
      setBatchLoading(false);
    }
  }, []);

  const fetchAuditLog = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await fetch('/api/audit?tenantId=default-tenant&limit=50');
      const json = await res.json();
      setAuditLog(json.data ?? []);
    } catch {
      setAuditLog([]);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchDecisions();
    fetchStrategiesData();
    runHealthChecks();
    fetchBatchJobs();
    fetchAuditLog();
  }, [fetchDecisions, fetchStrategiesData, runHealthChecks, fetchBatchJobs, fetchAuditLog]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // ── Derived KPIs ─────────────────────────────────────────────────────────────

  const total = decisions.length;
  const served = decisions.filter(d => d.served).length;
  const suppressed = decisions.filter(d => !d.served).length;
  const servedPct = total ? ((served / total) * 100).toFixed(1) : '0';
  const suppressedPct = total ? ((suppressed / total) * 100).toFixed(1) : '0';
  const activeStrategies = strategies.filter(s => s.status === 'active').length;

  const kpiCards = [
    { label: 'Total Decisions',   value: decisionsLoading ? '...' : total.toLocaleString() },
    { label: 'Served',            value: decisionsLoading ? '...' : served.toLocaleString(),     sub: decisionsLoading ? '' : `${servedPct}% of total` },
    { label: 'Suppressed',        value: decisionsLoading ? '...' : suppressed.toLocaleString(), sub: decisionsLoading ? '' : `${suppressedPct}% of total` },
    { label: 'Active Strategies', value: strategiesLoading ? '...' : activeStrategies.toString() },
  ];

  // ── Batch submission ─────────────────────────────────────────────────────────

  const handleDeleteBatch = async (id: string) => {
    if (!confirm('Delete this batch job?')) return;
    await fetch(`/api/batch?id=${id}`, { method: 'DELETE' });
    fetchBatchJobs();
  };

  const handleSubmitBatch = async () => {
    if (!batchForm.name || !batchForm.strategyIds.length) return;
    setBatchSubmitting(true);
    try {
      await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: batchForm.name,
          strategyIds: batchForm.strategyIds,
          channelId: batchForm.channelId || undefined,
          runNow: batchForm.runNow,
          tenantId: 'default-tenant',
        }),
      });
      setShowBatchModal(false);
      setBatchForm({ name: '', strategyIds: [], channelId: '', runNow: true });
      setTimeout(() => fetchBatchJobs(), 2000);
    } finally {
      setBatchSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="animate-in">
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Operations</h1>
          <p className="page-subtitle">System health, batch processing, and audit trail</p>
        </div>
        <div style={{ display: 'flex', gap: 8, paddingTop: 24 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setShowBatchModal(true)}>
            <Play size={13} /> Run Batch
          </button>
          <button className="btn btn-secondary btn-sm" onClick={refreshAll}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {kpiCards.map(k => (
            <div key={k.label} className="kpi-card">
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value" style={{ fontSize: k.value === '...' ? 18 : undefined, color: k.value === '...' ? 'var(--text-muted)' : undefined }}>
                {k.value}
              </div>
              {k.sub && <div className="kpi-delta neutral">{k.sub}</div>}
            </div>
          ))}
        </div>

        {/* ── System Health ──────────────────────────────────────────────────── */}
        <div className="card card-body">
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>System Health</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {health.map(s => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--bg)' }}>
                {s.status === 'checking'
                  ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />
                  : <span className={'dot ' + DOT_CLS[s.status]} />}
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{s.name}</span>
                <span className={'badge ' + STATUS_BADGE[s.status]}>{s.status}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: 48, textAlign: 'right' }}>
                  {s.latency ?? '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Batch Jobs ─────────────────────────────────────────────────────── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-header">
            <span className="card-title">Batch Jobs</span>
            <button className="btn btn-primary btn-sm" onClick={() => setShowBatchModal(true)}>
              <Play size={12} /> Run Batch Now
            </button>
          </div>
          {batchLoading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
          ) : batchJobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: 13 }}>
              No batch jobs yet. Click "Run Batch Now" to create one.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Strategies</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Served</th>
                    <th>Suppressed</th>
                    <th>Run Time</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {batchJobs.map(job => {
                    const colors = BATCH_STATUS_COLOR[job.status] ?? BATCH_STATUS_COLOR.pending;
                    return (
                      <tr key={job.id}>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{job.name}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {job.strategy_ids?.length ?? 0} strateg{job.strategy_ids?.length === 1 ? 'y' : 'ies'}
                        </td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: colors.bg, color: colors.color }}>
                            {job.status === 'running' && (
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors.color, animation: 'pulse 1.5s ease-in-out infinite' }} />
                            )}
                            {job.status}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                          {job.total_customers?.toLocaleString() ?? '—'}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--success)' }}>
                          {job.served_count?.toLocaleString() ?? '—'}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--warning)' }}>
                          {job.suppressed_count?.toLocaleString() ?? '—'}
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {job.run_at ? timeAgo(job.run_at) : '—'}
                        </td>
                        <td>
                          <button
                            onClick={() => handleDeleteBatch(job.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', alignItems: 'center' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Config Audit Log ───────────────────────────────────────────────── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-header">
            <span className="card-title">Config Audit Log</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{auditLog.length} records</span>
          </div>
          {auditLoading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
          ) : auditLog.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: 13 }}>No audit records yet.</div>
          ) : (
            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              <table className="table">
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th>Entity Type</th>
                    <th>Entity Name</th>
                    <th>Action</th>
                    <th>Changed By</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map(entry => (
                    <tr key={entry.id}>
                      <td>
                        <span className={'badge ' + (ENTITY_BADGE[entry.entity_type] ?? 'badge-blue')} style={{ fontSize: 11 }}>
                          {entry.entity_type}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, fontWeight: 500 }}>{entry.entity_name ?? '—'}</td>
                      <td>
                        <span className={'badge ' + (ACTION_BADGE[entry.action] ?? 'badge-amber')} style={{ fontSize: 11 }}>
                          {entry.action}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {entry.changed_by ?? 'system'}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={10} />{timeAgo(entry.created_at)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Decision Log ───────────────────────────────────────────────────── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-header">
            <span className="card-title">Decision Log</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{total} records</span>
          </div>
          {decisionsLoading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
          ) : decisions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: 13 }}>
              No decisions recorded yet. Run the simulator or a batch job.
            </div>
          ) : (
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className="table">
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th>Customer ID</th>
                    <th>Strategy</th>
                    <th>Action</th>
                    <th>Channel</th>
                    <th>Result</th>
                    <th>Propensity</th>
                    <th>Time</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {decisions.map(d => (
                    <>
                    <tr key={d.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{d.customer_id}</td>
                      <td style={{ fontSize: 12 }}>{d.strategy_name}</td>
                      <td style={{ fontSize: 12, fontWeight: d.served ? 600 : 400, color: d.served ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {d.action_name ?? d.suppression_reason ?? '—'}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {d.channel_id ? d.channel_id.replace(/_/g, ' ') : '—'}
                      </td>
                      <td>
                        {d.served
                          ? <span className="badge badge-green"><CheckCircle2 size={10} /> Served</span>
                          : <span className="badge badge-amber"><AlertTriangle size={10} /> Suppressed</span>}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--brand-accent)' }}>
                        {d.propensity ? d.propensity.toFixed(3) : '—'}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Clock size={10} />{timeAgo(d.created_at)}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => explainDecision(d)}
                          disabled={explaining === d.id}
                          title="Explain with AI"
                          style={{ background: 'none', border: '1px solid #e9d5ff', borderRadius: 6, cursor: 'pointer', color: '#7c3aed', padding: '3px 7px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Sparkles size={10} /> {explaining === d.id ? '…' : 'Explain'}
                        </button>
                      </td>
                    </tr>
                    {explainResult?.id === d.id && (
                      <tr key={`${d.id}-explain`}>
                        <td colSpan={8} style={{ padding: '10px 14px', background: '#f5f3ff', borderBottom: '1px solid #e9d5ff' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#6d28d9', marginBottom: 4 }}>{explainResult.headline}</div>
                          <div style={{ fontSize: 12, color: '#4c1d95', marginBottom: 6 }}>{explainResult.explanation}</div>
                          {explainResult.keyFactors?.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                              {explainResult.keyFactors.map((f, i) => (
                                <span key={i} style={{ background: '#ede9fe', color: '#5b21b6', borderRadius: 4, padding: '2px 8px', fontSize: 11 }}>{f}</span>
                              ))}
                            </div>
                          )}
                          {explainResult.recommendation && (
                            <div style={{ fontSize: 11, color: '#7c3aed', fontStyle: 'italic' }}>💡 {explainResult.recommendation}</div>
                          )}
                          <button onClick={() => setExplainResult(null)} style={{ marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#7c3aed', textDecoration: 'underline' }}>Dismiss</button>
                        </td>
                      </tr>
                    )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Batch Modal ─────────────────────────────────────────────────────── */}
      {showBatchModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="card card-body" style={{ width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Run Batch Job</span>
              <button onClick={() => setShowBatchModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>

            {/* Job Name */}
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Job Name *</label>
            <input
              className="form-input"
              placeholder="e.g. Nightly retention batch"
              value={batchForm.name}
              onChange={e => setBatchForm(f => ({ ...f, name: e.target.value }))}
              style={{ width: '100%', marginBottom: 16 }}
            />

            {/* Strategy Multi-select */}
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
              Strategies * ({batchForm.strategyIds.length} selected)
            </label>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', marginBottom: 16, maxHeight: 180, overflowY: 'auto', background: 'var(--bg)' }}>
              {strategiesLoading ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading strategies…</div>
              ) : strategies.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No strategies available</div>
              ) : strategies.map(s => (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={batchForm.strategyIds.includes(s.id)}
                    onChange={e => setBatchForm(f => ({
                      ...f,
                      strategyIds: e.target.checked
                        ? [...f.strategyIds, s.id]
                        : f.strategyIds.filter(id => id !== s.id),
                    }))}
                  />
                  <span style={{ fontSize: 13 }}>{s.name}</span>
                  <span className={`badge badge-${s.status === 'active' ? 'green' : 'amber'}`} style={{ fontSize: 10 }}>{s.status}</span>
                </label>
              ))}
            </div>

            {/* Channel */}
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Channel</label>
            <select
              className="form-input"
              value={batchForm.channelId}
              onChange={e => setBatchForm(f => ({ ...f, channelId: e.target.value }))}
              style={{ width: '100%', marginBottom: 16 }}
            >
              <option value="">— None —</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="push_notification">Push Notification</option>
              <option value="in_app">In-App</option>
              <option value="web">Web</option>
              <option value="call_centre">Call Centre</option>
            </select>

            {/* Run Now toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
              <div
                onClick={() => setBatchForm(f => ({ ...f, runNow: !f.runNow }))}
                style={{
                  width: 36, height: 20, borderRadius: 10, background: batchForm.runNow ? 'var(--brand)' : 'var(--border)',
                  position: 'relative', cursor: 'pointer', transition: 'background .2s',
                }}
              >
                <div style={{
                  position: 'absolute', top: 2, left: batchForm.runNow ? 18 : 2,
                  width: 16, height: 16, borderRadius: '50%', background: 'white',
                  transition: 'left .2s',
                }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Run Now</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(execute immediately in background)</span>
            </label>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowBatchModal(false)}>Cancel</button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSubmitBatch}
                disabled={batchSubmitting || !batchForm.name || batchForm.strategyIds.length === 0}
              >
                {batchSubmitting ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Submitting…</> : <><ChevronRight size={12} /> Submit Job</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
