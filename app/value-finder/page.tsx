'use client';

import { useState, useEffect, useCallback } from 'react';
import { Gem, AlertTriangle, TrendingDown, Target, RefreshCw, Users } from 'lucide-react';

const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';
const panel: React.CSSProperties = { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12 };

interface VFResult {
  configured: boolean;
  total: number;
  served: number;
  underServedCount: number;
  lowValueCount: number;
  coverage: number;
  actionWins: Record<string, number>;
  underServed: Array<{ customerId: string; reason: string }>;
  lowValue: Array<{ customerId: string; action: string; propensity: number }>;
  actionGaps: Array<{ id: string; name: string }>;
  lowThreshold: number;
  note: string;
}

export default function ValueFinderPage() {
  const [data, setData] = useState<VFResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const run = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/value-finder?tenantId=${TENANT_ID}`);
      const json = await res.json();
      if (json.configured === false) { setError('Supabase not configured.'); setData(null); }
      else setData(json);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { run(); }, [run]);

  const maxWins = data ? Math.max(1, ...Object.values(data.actionWins)) : 1;

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Gem size={24} color="var(--brand-accent)" />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Opportunity Finder</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Find under-served customers and unrealised action value across your base.</p>
          </div>
        </div>
        <button onClick={run} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'var(--brand-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: loading ? 0.7 : 1 }}>
          <RefreshCw size={14} /> {loading ? 'Scanning…' : 'Re-scan'}
        </button>
      </div>

      {error && <div style={{ ...panel, padding: 16, marginTop: 16, borderLeft: '3px solid #ef4444', fontSize: 13, color: 'var(--text-secondary)' }}>{error}</div>}
      {loading && !data && <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Scanning customer base…</div>}

      {data && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, margin: '20px 0' }}>
            <Stat icon={<Users size={16} />} label="Customers scanned" value={data.total} color="#3b82f6" />
            <Stat icon={<Target size={16} />} label="Coverage" value={`${Math.round(data.coverage * 100)}%`} sub={`${data.served} served`} color="#22c55e" />
            <Stat icon={<AlertTriangle size={16} />} label="Under-served" value={data.underServedCount} sub="no action qualifies" color="#ef4444" />
            <Stat icon={<TrendingDown size={16} />} label="Low-propensity" value={data.lowValueCount} sub={`P < ${data.lowThreshold}`} color="#f59e0b" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Action win distribution */}
            <div style={{ ...panel, padding: 20 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Action Win Distribution</div>
              {Object.keys(data.actionWins).length === 0 ? <Empty>No actions are winning.</Empty> : (
                Object.entries(data.actionWins).sort((a, b) => b[1] - a[1]).map(([name, n]) => (
                  <div key={name} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: 'var(--text-primary)' }}>{name}</span>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{n}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${(n / maxWins) * 100}%`, height: '100%', background: 'var(--brand-accent)' }} />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Action gaps */}
            <div style={{ ...panel, padding: 20 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Relevant-Action Gaps</div>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' }}>Active actions that never win for anyone — review eligibility, propensity, or value.</p>
              {data.actionGaps.length === 0 ? <Empty>Every action wins for someone. 🎉</Empty> : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {data.actionGaps.map(a => (
                    <span key={a.id} style={{ padding: '4px 10px', borderRadius: 16, background: 'rgba(245,158,11,0.12)', color: '#b45309', fontSize: 12, fontWeight: 600 }}>{a.name}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Under-served list */}
          <div style={{ ...panel, padding: 20, marginTop: 16 }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Under-Served Customers <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({data.underServedCount})</span></div>
            {data.underServed.length === 0 ? <Empty>No under-served customers — full coverage.</Empty> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr>{['Customer', 'Why no action'].map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.underServed.map(u => (
                    <tr key={u.customerId} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px', fontFamily: 'monospace', color: 'var(--brand-accent)' }}>{u.customerId}</td>
                      <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{u.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 14, fontStyle: 'italic' }}>{data.note}</div>
        </>
      )}
    </div>
  );
}

function Stat({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; color: string }) {
  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color, marginBottom: 8 }}>{icon}<span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span></div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>{children}</div>;
}
