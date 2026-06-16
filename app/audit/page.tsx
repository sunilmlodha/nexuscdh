'use client';
import { useState, useEffect, useCallback } from 'react';
import { Shield, ChevronDown, ChevronRight, RefreshCw, Download, FlaskConical, Zap } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  action: string;
  changed_by: string | null;
  before_snapshot: Record<string, unknown> | null;
  after_snapshot: Record<string, unknown> | null;
  created_at: string;
}

interface DecisionRow {
  id: string;
  customer_id: string;
  strategy_name: string | null;
  action_name: string | null;
  channel_id: string | null;
  served: boolean;
  propensity: number | null;
  outcome: string | null;
  suppression_reason: string | null;
  decision_latency_ms: number | null;
  created_at: string;
}

interface SimRun {
  id: string;
  strategy_name: string | null;
  population_size: number;
  source: string;
  served: number;
  suppressed: number;
  no_match: number;
  serve_pct: number | null;
  projected_revenue: number | null;
  latency_ms: number | null;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACTION_COLOR: Record<string, string> = {
  created: '#16a34a', updated: '#2563eb', deleted: '#dc2626',
};
const ENTITY_LABELS: Record<string, string> = {
  strategy: 'Strategy', policy: 'Policy', action: 'Action',
  taxonomy: 'Taxonomy', channel: 'Channel', decision_outcome: 'Outcome',
};
const OUTCOME_COLOR: Record<string, string> = {
  accepted: '#16a34a', rejected: '#dc2626', ignored: '#6b7280',
};

function rel(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmt(d: string) {
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtGBP(n: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SnapshotDiff({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  if (!before && !after) return null;
  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])).filter(k => k !== 'updated_at');
  const changed = keys.filter(k => JSON.stringify((before ?? {})[k]) !== JSON.stringify((after ?? {})[k]));
  if (!changed.length) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No field changes detected</div>;
  return (
    <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: 8, marginBottom: 4 }}>
        <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>Field</span>
        <span style={{ fontWeight: 600, color: '#dc2626', fontSize: 11, textTransform: 'uppercase' }}>Before</span>
        <span style={{ fontWeight: 600, color: '#16a34a', fontSize: 11, textTransform: 'uppercase' }}>After</span>
      </div>
      {changed.map(k => (
        <div key={k} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: 8, alignItems: 'start' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{k}</span>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '2px 6px', wordBreak: 'break-all', color: '#7f1d1d' }}>
            {before ? JSON.stringify((before)[k]) : '—'}
          </div>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4, padding: '2px 6px', wordBreak: 'break-all', color: '#14532d' }}>
            {after ? JSON.stringify((after)[k]) : '—'}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Config Audit ─────────────────────────────────────────────────────────

function ConfigTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ tenantId: 'f0000000-0000-4000-a000-000000000001', limit: '100' });
    if (filterType) p.set('entityType', filterType);
    const j = await fetch(`/api/audit?${p}`).then(r => r.json());
    setEntries(j.data ?? []);
    setLoading(false);
  }, [filterType]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const visible = entries.filter(e => !filterAction || e.action === filterAction);
  const td = { padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, verticalAlign: 'top' as const };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <select className="form-input" style={{ width: 180 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All entity types</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="form-input" style={{ width: 160 }} value={filterAction} onChange={e => setFilterAction(e.target.value)}>
          <option value="">All actions</option>
          <option value="created">Created</option>
          <option value="updated">Updated</option>
          <option value="deleted">Deleted</option>
        </select>
        {(filterType || filterAction) && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setFilterType(''); setFilterAction(''); }}>Clear</button>
        )}
        <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={load}><RefreshCw size={13} /></button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Loading…</div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <Shield size={36} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.25 }} />
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No config changes yet</div>
          <div style={{ fontSize: 13 }}>Changes to strategies, policies, and actions appear here</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['', 'Entity', 'Type', 'Action', 'By', 'When'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(e => {
                const open = expanded.has(e.id);
                const hasDiff = !!(e.before_snapshot || e.after_snapshot);
                return (
                  <>
                    <tr key={e.id} style={{ cursor: hasDiff ? 'pointer' : 'default' }} onClick={() => hasDiff && toggle(e.id)}>
                      <td style={{ ...td, width: 24, color: 'var(--text-muted)' }}>
                        {hasDiff ? (open ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : null}
                      </td>
                      <td style={td}><span style={{ fontWeight: 500 }}>{e.entity_name ?? e.entity_id.slice(0, 8)}</span></td>
                      <td style={td}><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ENTITY_LABELS[e.entity_type] ?? e.entity_type}</span></td>
                      <td style={td}><span style={{ fontWeight: 600, fontSize: 12, color: ACTION_COLOR[e.action] ?? '#6b7280', textTransform: 'capitalize' }}>{e.action}</span></td>
                      <td style={td}><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{e.changed_by ?? 'system'}</span></td>
                      <td style={td} title={fmt(e.created_at)}><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{rel(e.created_at)}</span></td>
                    </tr>
                    {open && hasDiff && (
                      <tr key={`${e.id}-diff`}>
                        <td />
                        <td colSpan={5} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                          <SnapshotDiff before={e.before_snapshot} after={e.after_snapshot} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>{visible.length} entries</div>
    </div>
  );
}

// ── Tab: Decision Log ─────────────────────────────────────────────────────────

function DecisionTab() {
  const [rows, setRows]       = useState<DecisionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filterOutcome, setFilterOutcome] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch('/api/decisions?tenantId=f0000000-0000-4000-a000-000000000001&limit=200').then(r => r.json());
    setRows(j.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const exportCSV = () => {
    const headers = ['id', 'customer_id', 'strategy', 'action', 'channel', 'served', 'propensity', 'outcome', 'suppression_reason', 'latency_ms', 'created_at'];
    const data = visible.map(r => [r.id, r.customer_id, r.strategy_name ?? '', r.action_name ?? '', r.channel_id ?? '', r.served, r.propensity ?? '', r.outcome ?? '', r.suppression_reason ?? '', r.decision_latency_ms ?? '', r.created_at]);
    const csv = [headers, ...data].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'decision-log.csv';
    a.click();
  };

  const visible = rows.filter(r => {
    if (filterOutcome === 'served' && !r.served) return false;
    if (filterOutcome === 'suppressed' && r.served) return false;
    if (filterOutcome === 'accepted' && r.outcome !== 'accepted') return false;
    if (filterOutcome === 'rejected' && r.outcome !== 'rejected') return false;
    if (search && !r.customer_id.toLowerCase().includes(search.toLowerCase()) &&
        !(r.strategy_name ?? '').toLowerCase().includes(search.toLowerCase()) &&
        !(r.action_name ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const td = { padding: '9px 14px', borderBottom: '1px solid var(--border)', fontSize: 13 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer / strategy / action…"
          className="form-input" style={{ width: 260 }} />
        <select className="form-input" style={{ width: 180 }} value={filterOutcome} onChange={e => setFilterOutcome(e.target.value)}>
          <option value="">All outcomes</option>
          <option value="served">Served</option>
          <option value="suppressed">Suppressed</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
        {(search || filterOutcome) && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setFilterOutcome(''); }}>Clear</button>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={exportCSV}><Download size={13} /> CSV</button>
          <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={13} /></button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Loading…</div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <Zap size={36} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.25 }} />
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No decisions yet</div>
          <div style={{ fontSize: 13 }}>NBA decisions served via the simulator or API appear here</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Customer', 'Strategy', 'Action', 'Channel', 'Served', 'Propensity', 'Outcome', 'Latency', 'When'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '8px 14px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(r => (
                <tr key={r.id}>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{r.customer_id}</td>
                  <td style={{ ...td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.strategy_name ?? ''}>{r.strategy_name ?? '—'}</td>
                  <td style={{ ...td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.action_name ?? ''}>{r.action_name ?? '—'}</td>
                  <td style={{ ...td, fontSize: 12, color: 'var(--text-muted)' }}>{r.channel_id ?? '—'}</td>
                  <td style={td}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: r.served ? '#dcfce7' : '#fee2e2', color: r.served ? '#15803d' : '#b91c1c' }}>
                      {r.served ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td style={{ ...td, fontSize: 12, color: 'var(--text-muted)' }}>{r.propensity != null ? (r.propensity * 100).toFixed(0) + '%' : '—'}</td>
                  <td style={td}>
                    {r.outcome ? (
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: r.outcome === 'accepted' ? '#dcfce7' : r.outcome === 'rejected' ? '#fee2e2' : '#f3f4f6', color: OUTCOME_COLOR[r.outcome] ?? '#6b7280' }}>
                        {r.outcome.charAt(0).toUpperCase() + r.outcome.slice(1)}
                      </span>
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.suppression_reason ?? 'Pending'}</span>}
                  </td>
                  <td style={{ ...td, fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{r.decision_latency_ms != null ? `${r.decision_latency_ms}ms` : '—'}</td>
                  <td style={{ ...td, fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }} title={fmt(r.created_at)}>{rel(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>{visible.length} of {rows.length} decisions</div>
    </div>
  );
}

// ── Tab: Simulation Runs ──────────────────────────────────────────────────────

function SimulationTab() {
  const [runs, setRuns]       = useState<SimRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail]   = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch('/api/simulate?tenantId=f0000000-0000-4000-a000-000000000001').then(r => r.json());
    setRuns(j.runs ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const expand = async (runId: string) => {
    if (expanded === runId) { setExpanded(null); setDetail(null); return; }
    setExpanded(runId);
    setDetailLoading(true);
    const j = await fetch(`/api/simulate?runId=${runId}&tenantId=f0000000-0000-4000-a000-000000000001`).then(r => r.json());
    setDetail(j.run ?? null);
    setDetailLoading(false);
  };

  const exportTrace = (run: Record<string, unknown>) => {
    const trace = (run.customer_trace as Array<Record<string, unknown>>) ?? [];
    const headers = ['customerId', 'outcome', 'gate', 'reason', 'actionName'];
    const rows = trace.map((t) => [t.customerId, t.outcome, t.gate, t.reason, t.actionName ?? '']);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `sim-${String(run.id).slice(0, 8)}-trace.csv`;
    a.click();
  };

  const td = { padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={13} /></button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Loading…</div>
      ) : runs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <FlaskConical size={36} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.25 }} />
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No simulation runs yet</div>
          <div style={{ fontSize: 13 }}>Run a simulation from the Simulation page to see audit records here</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['', 'Run ID', 'Strategy', 'Population', 'Source', 'Served', 'Suppressed', 'Revenue', 'Latency', 'When'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '8px 14px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map(r => {
                const open = expanded === r.id;
                return (
                  <>
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => expand(r.id)}>
                      <td style={{ ...td, width: 24, color: 'var(--text-muted)' }}>
                        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      </td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{r.id.slice(0, 8).toUpperCase()}</td>
                      <td style={{ ...td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.strategy_name ?? '—'}</td>
                      <td style={{ ...td, fontSize: 12 }}>{r.population_size.toLocaleString()}</td>
                      <td style={{ ...td, fontSize: 12 }}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500, background: r.source === 'real' ? '#dbeafe' : '#f3f4f6', color: r.source === 'real' ? '#1d4ed8' : '#6b7280' }}>
                          {r.source === 'real' ? 'Real' : 'Synthetic'}
                        </span>
                      </td>
                      <td style={td}>
                        <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>{r.served.toLocaleString()}</span>
                        {r.serve_pct != null && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>({r.serve_pct.toFixed(1)}%)</span>}
                      </td>
                      <td style={{ ...td, fontSize: 12, color: '#ef4444' }}>{r.suppressed.toLocaleString()}</td>
                      <td style={{ ...td, fontSize: 12, color: '#16a34a' }}>{fmtGBP(r.projected_revenue)}</td>
                      <td style={{ ...td, fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{r.latency_ms != null ? `${r.latency_ms}ms` : '—'}</td>
                      <td style={{ ...td, fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }} title={fmt(r.created_at)}>{rel(r.created_at)}</td>
                    </tr>
                    {open && (
                      <tr key={`${r.id}-detail`}>
                        <td />
                        <td colSpan={9} style={{ padding: '16px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                          {detailLoading ? (
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading trace…</div>
                          ) : detail ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => exportTrace(detail)}>
                                  <Download size={12} /> Export full trace CSV
                                </button>
                              </div>
                              {!!((detail.results_snapshot as Record<string, unknown>)?.suppressionBreakdown) && (
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Suppression Breakdown</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {(((detail.results_snapshot as Record<string, unknown>).suppressionBreakdown) as Array<{ label?: string; reason: string; count: number; pct: number }>).map((s, i) => (
                                      <div key={i} style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)', fontSize: 12 }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{s.label ?? s.reason}</span>
                                        <span style={{ color: '#ef4444', marginLeft: 8 }}>{s.count.toLocaleString()} ({s.pct.toFixed(1)}%)</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Sample trace */}
                              {Array.isArray(detail.customer_trace) && detail.customer_trace.length > 0 && (
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                                    Customer Trace — first 20 of {(detail.customer_trace as unknown[]).length}
                                  </div>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                    <thead>
                                      <tr>
                                        {['Customer', 'Outcome', 'Gate / Reason', 'Action'].map(h => (
                                          <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(detail.customer_trace as Array<{ customerId: string; outcome: string; gate: string; actionName?: string }>).slice(0, 20).map((t, i) => (
                                        <tr key={i}>
                                          <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>{t.customerId}</td>
                                          <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
                                            <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: t.outcome === 'PASS' ? '#dcfce7' : t.outcome === 'SUPPRESSED' ? '#fee2e2' : '#f3f4f6', color: t.outcome === 'PASS' ? '#15803d' : t.outcome === 'SUPPRESSED' ? '#b91c1c' : '#6b7280' }}>
                                              {t.outcome === 'NO_MATCH' ? 'No Match' : t.outcome.charAt(0) + t.outcome.slice(1).toLowerCase()}
                                            </span>
                                          </td>
                                          <td style={{ padding: '6px 10px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{t.gate}</td>
                                          <td style={{ padding: '6px 10px', color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>{t.actionName ?? '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          ) : <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No detail available</div>}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>{runs.length} runs</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'config',     label: 'Config Changes', icon: <Shield size={14} /> },
  { id: 'decisions',  label: 'Decision Log',   icon: <Zap size={14} /> },
  { id: 'simulation', label: 'Simulation Runs', icon: <FlaskConical size={14} /> },
];

export default function AuditPage() {
  const [tab, setTab] = useState<'config' | 'decisions' | 'simulation'>('config');

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit &amp; Transparency</h1>
          <p className="page-subtitle">Full history of config changes, NBA decisions served, and simulation runs</p>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? 'var(--brand-accent)' : 'var(--text-muted)', borderBottom: tab === t.id ? '2px solid var(--brand-accent)' : '2px solid transparent', marginBottom: -1 }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === 'config'     && <ConfigTab />}
        {tab === 'decisions'  && <DecisionTab />}
        {tab === 'simulation' && <SimulationTab />}
      </div>
    </div>
  );
}
