'use client';
import { useState, useEffect } from 'react';
import { Play, RotateCcw, ChevronDown, Plus, Minus, Database, AlertCircle, CheckCircle2, XCircle, BarChart2, TrendingUp, Info, Download, Clock, Shield, FileText } from 'lucide-react';
import type { CustomerTrace } from '@/types/simulate';

interface SimStrategy {
  id: string;
  name: string;
  status: string;
}

interface SuppressionEntry {
  reason: string;
  label:  string;
  count:  number;
  pct:    number;
}

interface ActionEntry {
  actionId:   string;
  actionName: string;
  count:      number;
  pct:        number;
}

interface SimResults {
  runId:           string;
  totalSimulated:  number;
  served:          number;
  servedPct:       number;
  suppressed:      number;
  suppressedPct:   number;
  noMatch:         number;
  noMatchPct:      number;
  suppressionBreakdown: SuppressionEntry[];
  actionBreakdown:      ActionEntry[];
  projectedRevenue:     number;
  latencyMs:            number;
  strategyId:           string;
  strategyName:         string;
  source:               'synthetic' | 'real';
  traceSample:          CustomerTrace[];
  auditedAt:            string;
}

const OUTCOME_COLOUR: Record<string, string> = {
  PASS:       '#22c55e',
  SUPPRESSED: '#ef4444',
  NO_MATCH:   '#6b7280',
};

export default function SimulatePage() {
  const [strategies, setStrategies]       = useState<SimStrategy[]>([]);
  const [strategyId, setStrategyId]       = useState('');
  const [populationSize, setPopulationSize] = useState(1000);
  const [useRealProfiles, setUseRealProfiles] = useState(false);
  const [seedAttrs, setSeedAttrs]         = useState<{ key: string; value: string }[]>([
    { key: 'consentGiven', value: 'true' },
    { key: 'segment',      value: 'standard' },
  ]);
  const [running, setRunning]   = useState(false);
  const [results, setResults]   = useState<SimResults | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [traceFilter, setTraceFilter] = useState<'ALL' | 'PASS' | 'SUPPRESSED' | 'NO_MATCH'>('ALL');
  const [traceSearch, setTraceSearch] = useState('');

  useEffect(() => {
    fetch('/api/strategies?tenantId=f0000000-0000-4000-a000-000000000001')
      .then(r => r.json())
      .then(data => {
        const list: SimStrategy[] = Array.isArray(data) ? data : data.data ?? data.strategies ?? [];
        const active = list.filter(s => s.status === 'active');
        setStrategies(active);
        if (active.length > 0) setStrategyId(active[0].id);
      })
      .catch(() => {});
  }, []);

  const addAttr    = () => setSeedAttrs(a => [...a, { key: '', value: '' }]);
  const removeAttr = (i: number) => setSeedAttrs(a => a.filter((_, idx) => idx !== i));
  const updateAttr = (i: number, field: 'key' | 'value', val: string) =>
    setSeedAttrs(a => a.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const runSimulation = async () => {
    if (!strategyId) return;
    setRunning(true); setResults(null); setError(null); setTraceFilter('ALL'); setTraceSearch('');
    try {
      const body: Record<string, unknown> = {
        strategyId, populationSize,
        source: useRealProfiles ? 'real' : 'synthetic',
        tenantId: 'f0000000-0000-4000-a000-000000000001',
      };
      if (!useRealProfiles) {
        const attrs: Record<string, string> = {};
        seedAttrs.forEach(({ key, value }) => { if (key) attrs[key] = value; });
        body.seedAttributes = attrs;
      }
      const res = await fetch('/api/simulate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SimResults = await res.json();
      setResults(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Simulation failed');
    } finally {
      setRunning(false);
    }
  };

  const exportCSV = () => {
    if (!results) return;
    const headers = ['customerId', 'outcome', 'gate', 'reason', 'actionName', 'age', 'credit_score', 'tenure_months'];
    const rows = results.traceSample.map(t => [
      t.customerId, t.outcome, t.gate, t.reason, t.actionName ?? '',
      t.attributes.age ?? '', t.attributes.credit_score ?? '', t.attributes.tenure_months ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `sim-${results.runId?.slice(0, 8) ?? 'run'}-trace.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);

  const selectedStrategy = strategies.find(s => s.id === strategyId);

  const filteredTrace = (results?.traceSample ?? []).filter(t => {
    if (traceFilter !== 'ALL' && t.outcome !== traceFilter) return false;
    if (traceSearch && !t.customerId.toLowerCase().includes(traceSearch.toLowerCase()) &&
        !t.gate.toLowerCase().includes(traceSearch.toLowerCase()) &&
        !t.reason.toLowerCase().includes(traceSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ padding: '32px 40px', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Population Simulation</h1>
        <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
          Run a strategy against thousands of customers, inspect per-customer decisions, and export a full audit trail.
        </p>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 24, alignItems: 'start' }}>

        {/* LEFT: Config */}
        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <h2 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Simulation Setup</h2>

          {/* Strategy */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>Strategy</label>
            <div style={{ position: 'relative' }}>
              <select value={strategyId} onChange={e => setStrategyId(e.target.value)}
                style={{ width: '100%', padding: '8px 32px 8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 14, appearance: 'none', cursor: 'pointer' }}>
                {strategies.length === 0 && <option value="">No active strategies</option>}
                {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            </div>
          </div>

          {/* Population size */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
              Population Size: <strong>{populationSize.toLocaleString()}</strong>
            </label>
            <input type="range" min={100} max={10000} step={100} value={populationSize}
              onChange={e => setPopulationSize(Number(e.target.value))}
              style={{ width: '100%', marginBottom: 8, accentColor: 'var(--brand-accent)' }} />
            <input type="number" min={100} max={10000} value={populationSize}
              onChange={e => setPopulationSize(Math.min(10000, Math.max(100, Number(e.target.value))))}
              style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 14 }} />
          </div>

          {/* Data source */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>Data Source</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: 'Synthetic', val: false, icon: <BarChart2 size={13} /> },
                { label: 'Real Profiles', val: true, icon: <Database size={13} /> },
              ].map(opt => (
                <button key={String(opt.val)} onClick={() => setUseRealProfiles(opt.val)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: `1px solid ${useRealProfiles === opt.val ? 'var(--brand-accent)' : 'var(--border)'}`, background: useRealProfiles === opt.val ? 'var(--brand-accent)' : 'var(--bg)', color: useRealProfiles === opt.val ? '#fff' : 'var(--text-primary)' }}>
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Seed attributes */}
          {!useRealProfiles && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Seed Attributes</label>
                <button onClick={addAttr} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-accent)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  <Plus size={12} /> Add
                </button>
              </div>
              {seedAttrs.map((attr, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input value={attr.key} onChange={e => updateAttr(i, 'key', e.target.value)} placeholder="key"
                    style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 12 }} />
                  <input value={attr.value} onChange={e => updateAttr(i, 'value', e.target.value)} placeholder="value"
                    style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 12 }} />
                  <button onClick={() => removeAttr(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                    <Minus size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {useRealProfiles && (
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 8, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
              <Info size={14} style={{ color: 'var(--brand-accent)', marginTop: 1, flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>Uses actual customer profiles. Results reflect your real audience.</p>
            </div>
          )}

          <button onClick={runSimulation} disabled={running || !strategyId}
            style={{ width: '100%', padding: '12px', borderRadius: 10, fontSize: 15, fontWeight: 600, background: running || !strategyId ? 'var(--border)' : 'var(--brand-accent)', color: running || !strategyId ? 'var(--text-muted)' : '#fff', border: 'none', cursor: running || !strategyId ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Play size={15} />
            {running ? `Simulating ${populationSize.toLocaleString()} customers…` : 'Run Simulation'}
          </button>

          {running && (
            <div style={{ marginTop: 12, height: 4, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 4, background: 'var(--brand-accent)', width: '60%', animation: 'shimmer 1.2s ease-in-out infinite' }} />
            </div>
          )}

          {error && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontSize: 13 }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}
        </div>

        {/* RIGHT: Results */}
        <div>
          {!results && !running && (
            <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
              <BarChart2 size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p style={{ margin: 0, fontSize: 14 }}>Configure a strategy and click <strong>Run Simulation</strong> to see results.</p>
            </div>
          )}

          {results && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Audit banner */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderRadius: 10, background: 'var(--bg-panel)', border: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                    <Shield size={13} color="var(--brand-accent)" />
                    <strong style={{ color: 'var(--text-primary)' }}>Run ID:</strong> {results.runId?.slice(0, 8).toUpperCase() ?? '—'}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                    <Clock size={13} />
                    {new Date(results.auditedAt).toLocaleString()}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                    <FileText size={13} />
                    {results.totalSimulated.toLocaleString()} customers · {results.latencyMs}ms · {results.source === 'real' ? 'Real Profiles' : 'Synthetic'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={exportCSV}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                    <Download size={13} /> Export CSV
                  </button>
                  <button onClick={runSimulation}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                    <RotateCcw size={13} /> Re-run
                  </button>
                </div>
              </div>

              {/* Summary stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                {[
                  { label: 'Served',     count: results.served,     pct: results.servedPct,     color: '#22c55e', icon: <CheckCircle2 size={18} /> },
                  { label: 'Suppressed', count: results.suppressed,  pct: results.suppressedPct, color: '#ef4444', icon: <XCircle size={18} /> },
                  { label: 'No Match',   count: results.noMatch,     pct: results.noMatchPct,    color: '#6b7280', icon: <AlertCircle size={18} /> },
                ].map(stat => (
                  <div key={stat.label} style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: stat.color, marginBottom: 8 }}>
                      {stat.icon}
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{stat.label}</span>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>{stat.count.toLocaleString()}</div>
                    <div style={{ fontSize: 13, color: stat.color, fontWeight: 600 }}>{stat.pct.toFixed(1)}%</div>
                  </div>
                ))}
              </div>

              {/* Stacked bar */}
              <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Visual Breakdown</div>
                <div style={{ display: 'flex', height: 28, borderRadius: 8, overflow: 'hidden' }}>
                  {results.servedPct > 0     && <div title={`Served: ${results.servedPct.toFixed(1)}%`}     style={{ width: `${results.servedPct}%`,     background: 'var(--brand-accent)' }} />}
                  {results.suppressedPct > 0 && <div title={`Suppressed: ${results.suppressedPct.toFixed(1)}%`} style={{ width: `${results.suppressedPct}%`, background: '#ef4444' }} />}
                  {results.noMatchPct > 0    && <div title={`No Match: ${results.noMatchPct.toFixed(1)}%`}   style={{ width: `${results.noMatchPct}%`,    background: '#9ca3af' }} />}
                </div>
                <div style={{ display: 'flex', gap: 20, marginTop: 10 }}>
                  {[{ label: 'Served', color: 'var(--brand-accent)' }, { label: 'Suppressed', color: '#ef4444' }, { label: 'No Match', color: '#9ca3af' }]
                    .map(l => (
                      <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} /> {l.label}
                      </div>
                    ))}
                </div>
              </div>

              {/* Suppression analysis */}
              {results.suppressionBreakdown.length > 0 && (
                <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>Suppression Analysis</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Gate / Reason', 'Count', '%'].map(h => (
                          <th key={h} style={{ textAlign: h === 'Gate / Reason' ? 'left' : 'right', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.suppressionBreakdown.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 8px', color: 'var(--text-primary)' }}>{row.label ?? row.reason}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>{row.count.toLocaleString()}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right', color: '#ef4444', fontWeight: 500 }}>{row.pct.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Action distribution */}
              {results.actionBreakdown.length > 0 && (
                <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>Action Distribution</div>
                  {(() => {
                    const max = Math.max(...results.actionBreakdown.map(a => a.count), 1);
                    return results.actionBreakdown.map((a, i) => (
                      <div key={i} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                          <span style={{ color: 'var(--text-primary)' }}>{a.actionName || a.actionId}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{a.count.toLocaleString()} ({a.pct.toFixed(1)}%)</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 4, background: 'var(--border)' }}>
                          <div style={{ height: '100%', borderRadius: 4, background: 'var(--brand-accent)', width: `${(a.count / max) * 100}%`, transition: 'width 0.4s' }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}

              {/* Projected revenue */}
              {results.projectedRevenue !== undefined && (
                <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <TrendingUp size={24} style={{ color: '#22c55e' }} />
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Projected Revenue</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: '#22c55e' }}>{fmtCurrency(results.projectedRevenue)}</div>
                  </div>
                </div>
              )}

              {/* Per-customer trace */}
              {results.traceSample && results.traceSample.length > 0 && (
                <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Per-Customer Decision Trace</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        Showing {filteredTrace.length} of {results.traceSample.length} sampled customers · Full trace saved to audit log (Run {results.runId?.slice(0, 8).toUpperCase()})
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(['ALL', 'PASS', 'SUPPRESSED', 'NO_MATCH'] as const).map(f => (
                        <button key={f} onClick={() => setTraceFilter(f)}
                          style={{ padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: `1px solid ${traceFilter === f ? OUTCOME_COLOUR[f] ?? 'var(--brand-accent)' : 'var(--border)'}`, background: traceFilter === f ? (OUTCOME_COLOUR[f] ?? 'var(--brand-accent)') : 'var(--bg)', color: traceFilter === f ? '#fff' : 'var(--text-muted)' }}>
                          {f === 'ALL' ? 'All' : f === 'NO_MATCH' ? 'No Match' : f.charAt(0) + f.slice(1).toLowerCase()}
                        </button>
                      ))}
                      <input value={traceSearch} onChange={e => setTraceSearch(e.target.value)} placeholder="Search customer / gate…"
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', width: 180 }} />
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                          {['Customer ID', 'Outcome', 'Gate / Reason', 'Action', 'Age', 'Credit Score'].map(h => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTrace.slice(0, 50).map((row, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{row.customerId}</td>
                            <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: row.outcome === 'PASS' ? '#dcfce7' : row.outcome === 'SUPPRESSED' ? '#fee2e2' : '#f3f4f6', color: OUTCOME_COLOUR[row.outcome] ?? '#6b7280' }}>
                                {row.outcome === 'NO_MATCH' ? 'No Match' : row.outcome.charAt(0) + row.outcome.slice(1).toLowerCase()}
                              </span>
                            </td>
                            <td style={{ padding: '7px 10px', color: 'var(--text-muted)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.gate}>{row.gate}</td>
                            <td style={{ padding: '7px 10px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{row.actionName ?? '—'}</td>
                            <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{String(row.attributes.age ?? '—')}</td>
                            <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{String(row.attributes.credit_score ?? '—')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredTrace.length > 50 && (
                      <div style={{ padding: '10px 10px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                        Showing 50 of {filteredTrace.length} matching rows. Export CSV for the full trace.
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shimmer { 0% { width: 10%; } 50% { width: 80%; } 100% { width: 10%; } }
      `}</style>
    </div>
  );
}
