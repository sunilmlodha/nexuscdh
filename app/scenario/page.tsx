'use client';

import { useState, useEffect, useCallback } from 'react';
import { LineChart, Play, ArrowRight, Users, Target, PoundSterling } from 'lucide-react';

const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';
const panel: React.CSSProperties = { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12 };
const input: React.CSSProperties = { padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 13 };

interface Strategy { id: string; name: string; context_weight?: number; }
interface Summary { served: number; reach: number; projectedValue: number; actionDistribution: Record<string, number>; }
interface ScenarioResult { total: number; baseline: Summary; proposed: Summary | null; delta: { served: number; reach: number; projectedValue: number } | null; note: string; }

export default function ScenarioPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [stratId, setStratId] = useState('');
  const [ctxWeight, setCtxWeight] = useState(1);
  const [leverMult, setLeverMult] = useState(1.5);
  const [leverOn, setLeverOn] = useState(false);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadStrategies = useCallback(async () => {
    const res = await fetch(`/api/strategies?tenantId=${TENANT_ID}`);
    const json = await res.json();
    const list: Strategy[] = json.data ?? [];
    setStrategies(list);
    if (list.length && !stratId) { setStratId(list[0].id); setCtxWeight(list[0].context_weight ?? 1); }
  }, [stratId]);

  useEffect(() => { loadStrategies(); }, [loadStrategies]);

  const run = useCallback(async () => {
    setLoading(true); setError(''); setResult(null);
    const overrides = stratId ? {
      [stratId]: {
        context_weight: ctxWeight,
        ...(leverOn ? { business_levers: [{ label: 'Scenario lever', multiplier: leverMult, enabled: true, condition: null }] } : { business_levers: [] }),
      },
    } : undefined;
    try {
      const res = await fetch('/api/scenario', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID, overrides }),
      });
      const json = await res.json();
      if (json.configured === false) { setError('Supabase not configured.'); return; }
      setResult(json);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [stratId, ctxWeight, leverMult, leverOn]);

  const allActions = result ? Array.from(new Set([
    ...Object.keys(result.baseline.actionDistribution),
    ...Object.keys(result.proposed?.actionDistribution ?? {}),
  ])) : [];

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <LineChart size={24} color="var(--brand-accent)" />
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Scenario Planner</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Project a configuration change across your customer base before deploying it.</p>
        </div>
      </div>

      {/* Controls */}
      <div style={{ ...panel, padding: 20, margin: '18px 0', display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={miniLabel}>What-if strategy</label>
          <select value={stratId} onChange={e => { setStratId(e.target.value); const s = strategies.find(x => x.id === e.target.value); setCtxWeight(s?.context_weight ?? 1); }} style={{ ...input, minWidth: 240 }}>
            {strategies.length === 0 && <option value="">No strategies</option>}
            {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label style={miniLabel}>Context weight (C): {ctxWeight.toFixed(1)}×</label>
          <input type="range" min={0} max={2} step={0.1} value={ctxWeight} onChange={e => setCtxWeight(Number(e.target.value))} style={{ width: 160, display: 'block' }} />
        </div>
        <div>
          <label style={miniLabel}><input type="checkbox" checked={leverOn} onChange={e => setLeverOn(e.target.checked)} style={{ marginRight: 6 }} />Apply lever (L)</label>
          <input type="number" step={0.1} value={leverMult} onChange={e => setLeverMult(Number(e.target.value))} disabled={!leverOn} style={{ ...input, width: 80, opacity: leverOn ? 1 : 0.5 }} />
        </div>
        <button onClick={run} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, background: 'var(--brand-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: loading ? 0.7 : 1 }}>
          <Play size={14} /> {loading ? 'Projecting…' : 'Run Projection'}
        </button>
      </div>

      {error && <div style={{ ...panel, padding: 16, borderLeft: '3px solid #ef4444', fontSize: 13, color: 'var(--text-secondary)' }}>{error}</div>}

      {result && (
        <>
          {/* Compare cards */}
          <div style={{ display: 'grid', gridTemplateColumns: result.proposed ? '1fr auto 1fr' : '1fr', gap: 18, alignItems: 'center' }}>
            <SummaryCard title="Current config" s={result.baseline} total={result.total} />
            {result.proposed && <ArrowRight size={24} color="var(--text-muted)" />}
            {result.proposed && <SummaryCard title="Proposed config" s={result.proposed} total={result.total} delta={result.delta} highlight />}
          </div>

          {/* Distribution compare */}
          <div style={{ ...panel, padding: 20, marginTop: 18 }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Action Distribution {result.proposed && <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>(current → proposed)</span>}</div>
            {allActions.length === 0 ? <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No actions served.</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  {allActions.map(name => {
                    const b = result.baseline.actionDistribution[name] ?? 0;
                    const p = result.proposed?.actionDistribution[name] ?? 0;
                    const changed = result.proposed && b !== p;
                    return (
                      <tr key={name} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px', color: 'var(--text-primary)' }}>{name}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{b}</td>
                        {result.proposed && <td style={{ padding: '8px', width: 30, textAlign: 'center', color: 'var(--text-muted)' }}>→</td>}
                        {result.proposed && <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: changed ? 700 : 400, color: changed ? 'var(--brand-accent)' : 'var(--text-secondary)' }}>{p}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 14, fontStyle: 'italic' }}>{result.note}</div>
        </>
      )}
    </div>
  );
}

const miniLabel: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 };

function SummaryCard({ title, s, total, delta, highlight }: { title: string; s: Summary; total: number; delta?: { served: number; reach: number; projectedValue: number } | null; highlight?: boolean }) {
  return (
    <div style={{ ...panel, padding: 20, border: highlight ? '1px solid var(--brand-accent)' : '1px solid var(--border)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: highlight ? 'var(--brand-accent)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>{title}</div>
      <Row icon={<Target size={15} />} label="Reach" value={`${Math.round(s.reach * 100)}%`} delta={delta ? `${delta.reach >= 0 ? '+' : ''}${Math.round(delta.reach * 100)}pp` : undefined} up={delta ? delta.reach >= 0 : undefined} />
      <Row icon={<Users size={15} />} label="Served" value={`${s.served} / ${total}`} delta={delta ? `${delta.served >= 0 ? '+' : ''}${delta.served}` : undefined} up={delta ? delta.served >= 0 : undefined} />
      <Row icon={<PoundSterling size={15} />} label="Projected value" value={`£${s.projectedValue.toLocaleString()}`} delta={delta ? `${delta.projectedValue >= 0 ? '+' : ''}£${delta.projectedValue.toLocaleString()}` : undefined} up={delta ? delta.projectedValue >= 0 : undefined} />
    </div>
  );
}

function Row({ icon, label, value, delta, up }: { icon: React.ReactNode; label: string; value: string; delta?: string; up?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
      <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</span>
      {delta !== undefined && <span style={{ fontSize: 12, fontWeight: 600, color: up ? '#16a34a' : '#dc2626', minWidth: 54, textAlign: 'right' }}>{delta}</span>}
    </div>
  );
}
