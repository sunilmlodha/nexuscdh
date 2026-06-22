'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw, Zap, CheckCircle2, Gauge, AlertTriangle, Beaker } from 'lucide-react';

const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';
const panel: React.CSSProperties = { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12 };

interface Metrics {
  configured: boolean;
  windowHours: number;
  total: number; served: number; suppressed: number; control: number;
  servedRate: number; conversionRate: number;
  latencyMs: { avg: number; p50: number; p95: number; p99: number; max: number };
  outcomes: Record<string, number>;
  suppression: Record<string, number>;
  throughput: { hour: string; count: number }[];
}

export default function ObservabilityPage() {
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [windowH, setWindowH] = useState(24);

  const load = useCallback(async (h: number) => {
    setLoading(true); setErr('');
    try {
      const res = await fetch(`/api/metrics?tenantId=${TENANT_ID}&window=${h}`);
      const j = await res.json();
      if (j.configured === false) setErr('Supabase not configured.');
      else setData(j);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(windowH); }, [load, windowH]);

  const maxBar = data ? Math.max(1, ...data.throughput.map(t => t.count)) : 1;

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Activity size={24} color="var(--brand-accent)" />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Observability</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Decision throughput, latency, and outcomes from the live decision log.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={windowH} onChange={e => setWindowH(Number(e.target.value))} style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 13 }}>
            <option value={1}>Last 1h</option><option value={24}>Last 24h</option><option value={168}>Last 7d</option><option value={720}>Last 30d</option>
          </select>
          <button onClick={() => load(windowH)} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}><RefreshCw size={13} /> Refresh</button>
        </div>
      </div>

      {err && <div style={{ ...panel, padding: 16, marginTop: 16, borderLeft: '3px solid #ef4444', fontSize: 13, color: 'var(--text-secondary)' }}>{err}</div>}
      {loading && !data && <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading…</div>}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, margin: '20px 0' }}>
            <Stat icon={<Zap size={16} />} label="Decisions" value={data.total.toLocaleString()} sub={`last ${data.windowHours}h`} color="#3b82f6" />
            <Stat icon={<CheckCircle2 size={16} />} label="Served rate" value={`${Math.round(data.servedRate * 100)}%`} sub={`${data.served} served · ${data.suppressed} suppressed`} color="#22c55e" />
            <Stat icon={<Gauge size={16} />} label="Latency p95" value={`${data.latencyMs.p95}ms`} sub={`p50 ${data.latencyMs.p50} · p99 ${data.latencyMs.p99} · max ${data.latencyMs.max}`} color="#8b5cf6" />
            <Stat icon={<Beaker size={16} />} label="Conversion" value={`${Math.round(data.conversionRate * 100)}%`} sub={`${data.control} in control`} color="#f59e0b" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
            {/* Throughput */}
            <div style={{ ...panel, padding: 20 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Throughput</div>
              {data.throughput.length === 0 ? <Empty>No decisions in this window.</Empty> : (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
                  {data.throughput.slice(-48).map(t => (
                    <div key={t.hour} title={`${t.hour}:00 · ${t.count}`} style={{ flex: 1, background: 'var(--brand-accent)', borderRadius: '2px 2px 0 0', height: `${Math.max(2, (t.count / maxBar) * 100)}%`, minWidth: 3 }} />
                  ))}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>decisions per hour</div>
            </div>

            {/* Suppression breakdown */}
            <div style={{ ...panel, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}><AlertTriangle size={15} color="#f59e0b" /> Suppression reasons</div>
              {Object.keys(data.suppression).length === 0 ? <Empty>Nothing suppressed.</Empty> : (
                Object.entries(data.suppression).sort((a, b) => b[1] - a[1]).map(([reason, n]) => (
                  <div key={reason} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{reason}</span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{n}</span>
                  </div>
                ))
              )}
              <div style={{ marginTop: 14, fontWeight: 700, color: 'var(--text-primary)', fontSize: 13, marginBottom: 8 }}>Outcomes</div>
              {Object.keys(data.outcomes).length === 0 ? <Empty>No outcomes recorded.</Empty> : (
                Object.entries(data.outcomes).map(([o, n]) => (
                  <div key={o} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0' }}>
                    <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{o}</span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{n}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 14, fontStyle: 'italic' }}>Server logs are emitted as structured JSON (lib/logger) for ingestion by a log drain / Sentry. This view aggregates the decision log.</div>
        </>
      )}
    </div>
  );
}

function Stat({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color, marginBottom: 8 }}>{icon}<span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span></div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{children}</div>; }
