'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, RefreshCw, FlaskConical, Users, Beaker } from 'lucide-react';

const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';
const panel: React.CSSProperties = { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12 };

interface Cell { n: number; conversions: number; rate: number; }
interface StrategyLift { strategyId: string; name: string; treated: Cell; control: Cell; lift: number | null; hasControl: boolean; }
interface LiftResult {
  configured: boolean;
  sampleSize: number;
  overall: { treated: Cell; control: Cell; lift: number | null; hasControl: boolean };
  strategies: StrategyLift[];
  note: string;
}

function pct(n: number) { return `${(n * 100).toFixed(1)}%`; }
function liftLabel(l: number | null) {
  if (l === null) return '—';
  return `${l >= 0 ? '+' : ''}${(l * 100).toFixed(0)}%`;
}
function liftColor(l: number | null) {
  if (l === null) return 'var(--text-muted)';
  return l > 0 ? '#16a34a' : l < 0 ? '#dc2626' : 'var(--text-muted)';
}

export default function LiftPage() {
  const [data, setData] = useState<LiftResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/lift?tenantId=${TENANT_ID}`);
      const json = await res.json();
      if (json.configured === false) { setError('Supabase not configured.'); setData(null); }
      else setData(json);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1040, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TrendingUp size={24} color="var(--brand-accent)" />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Lift Analytics</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Measure incremental value: treated vs control conversion per strategy.</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'var(--brand-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: loading ? 0.7 : 1 }}>
          <RefreshCw size={14} /> {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <div style={{ ...panel, padding: 16, marginTop: 16, borderLeft: '3px solid #ef4444', fontSize: 13, color: 'var(--text-secondary)' }}>{error}</div>}
      {loading && !data && <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading…</div>}

      {data && (
        <>
          {/* Overall hero */}
          <div style={{ ...panel, padding: 24, margin: '20px 0', display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center', minWidth: 130 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overall Lift</div>
              <div style={{ fontSize: 40, fontWeight: 800, color: liftColor(data.overall.lift), lineHeight: 1.1 }}>{liftLabel(data.overall.lift)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{data.overall.hasControl ? 'vs control baseline' : 'no control data yet'}</div>
            </div>
            <div style={{ flex: 1, display: 'flex', gap: 16 }}>
              <Group icon={<Users size={15} />} title="Treated" cell={data.overall.treated} color="var(--brand-accent)" />
              <Group icon={<Beaker size={15} />} title="Control" cell={data.overall.control} color="#f59e0b" />
            </div>
          </div>

          {/* Per-strategy */}
          <div style={{ ...panel, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, color: 'var(--text-primary)' }}>By Strategy</div>
            {data.strategies.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No decisions logged yet. Run decisions (Simulator / Containers) and record outcomes to populate lift.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    {['Strategy', 'Treated n', 'Treated CR', 'Control n', 'Control CR', 'Lift'].map((h, i) => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: i === 0 ? 'left' : 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.strategies.map(s => (
                    <tr key={s.strategyId} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>{s.name}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{s.treated.n}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{pct(s.treated.rate)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: s.hasControl ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{s.hasControl ? s.control.n : '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: s.hasControl ? 'var(--text-primary)' : 'var(--text-muted)' }}>{s.hasControl ? pct(s.control.rate) : '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: liftColor(s.lift) }}>{s.hasControl ? liftLabel(s.lift) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 14, fontStyle: 'italic', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <FlaskConical size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {data.note} Sample: {data.sampleSize.toLocaleString()} decisions.
          </div>
        </>
      )}
    </div>
  );
}

function Group({ icon, title, cell, color }: { icon: React.ReactNode; title: string; cell: Cell; color: string }) {
  return (
    <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 10, padding: 16, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color, marginBottom: 10 }}>{icon}<span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div><div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{pct(cell.rate)}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>conversion rate</div></div>
        <div style={{ textAlign: 'right' }}><div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>{cell.conversions}/{cell.n}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>converted</div></div>
      </div>
    </div>
  );
}
