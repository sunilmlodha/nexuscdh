'use client';

import { useState, useEffect, useCallback } from 'react';
import { Scale, ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';

const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';
const panel: React.CSSProperties = { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12 };

const ATTRIBUTES = [
  { key: 'gender', label: 'Gender' },
  { key: 'age', label: 'Age band' },
  { key: 'customer_segment', label: 'Customer segment' },
  { key: 'income_band', label: 'Income band' },
];

interface BiasResult {
  configured: boolean;
  attribute: string;
  total: number;
  groups: Array<{ value: string; total: number; served: number; rate: number }>;
  adverseImpactRatio: number;
  threshold: number;
  flagged: boolean;
  favouredGroup: string | null;
  disadvantagedGroup: string | null;
  verdict: string;
  note: string;
}

export default function BiasPage() {
  const [attribute, setAttribute] = useState('gender');
  const [data, setData] = useState<BiasResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = useCallback(async (attr: string) => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/bias?attribute=${attr}&tenantId=${TENANT_ID}`);
      const json = await res.json();
      if (json.configured === false) { setError('Supabase not configured.'); setData(null); }
      else setData(json);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { run(attribute); }, [attribute, run]);

  return (
    <div style={{ padding: '32px 36px', maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Scale size={24} color="var(--brand-accent)" />
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Ethical Bias Check</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Test whether action selection is fair across protected attributes (4/5ths adverse-impact rule).</p>
        </div>
      </div>

      {/* Attribute selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 22px' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Protected attribute</span>
        {ATTRIBUTES.map(a => (
          <button key={a.key} onClick={() => setAttribute(a.key)} style={{
            padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: attribute === a.key ? 'var(--brand-accent)' : 'none', color: attribute === a.key ? '#fff' : 'var(--text-secondary)',
          }}>{a.label}</button>
        ))}
        <button onClick={() => run(attribute)} disabled={loading} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>
          <RefreshCw size={12} /> {loading ? 'Running…' : 'Re-run'}
        </button>
      </div>

      {error && <div style={{ ...panel, padding: 16, borderLeft: '3px solid #ef4444', fontSize: 13, color: 'var(--text-secondary)' }}>{error}</div>}
      {loading && !data && <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Evaluating fairness…</div>}

      {data && (
        <>
          {/* Verdict banner */}
          <div style={{ ...panel, padding: 20, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14, borderLeft: `4px solid ${data.flagged ? '#ef4444' : '#22c55e'}` }}>
            {data.flagged ? <ShieldAlert size={28} color="#ef4444" /> : <ShieldCheck size={28} color="#22c55e" />}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: data.flagged ? '#b91c1c' : '#15803d' }}>{data.flagged ? 'Potential adverse impact' : 'No adverse impact detected'}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{data.verdict}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'monospace', color: data.flagged ? '#ef4444' : '#22c55e' }}>{data.adverseImpactRatio.toFixed(2)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>impact ratio</div>
            </div>
          </div>

          {/* Group served rates */}
          <div style={{ ...panel, padding: 20 }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Served Rate by Group</div>
            {data.groups.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No data for this attribute.</div>
            ) : data.groups.map(g => {
              const isHigh = g.value === data.favouredGroup;
              const isLow = g.value === data.disadvantagedGroup && data.groups.length > 1;
              const c = isLow ? '#ef4444' : isHigh ? '#22c55e' : 'var(--brand-accent)';
              return (
                <div key={g.value} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{g.value}<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {g.served}/{g.total}</span></span>
                    <span style={{ color: c, fontWeight: 700, fontFamily: 'monospace' }}>{Math.round(g.rate * 100)}%</span>
                  </div>
                  <div style={{ height: 12, background: 'var(--bg)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${g.rate * 100}%`, height: '100%', background: c }} />
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
              Adverse-impact ratio = lowest group rate ÷ highest group rate. Below {data.threshold} (the “four-fifths rule”) is conventionally flagged as potential disparate impact.
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 14, fontStyle: 'italic' }}>{data.note}</div>
        </>
      )}
    </div>
  );
}
