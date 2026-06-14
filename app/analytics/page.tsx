'use client';

import { useState, useEffect } from 'react';
import {
  BarChart2, TrendingUp, Users, Zap, Clock, AlertCircle,
  CheckCircle, Activity, Layers, ChevronDown,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AnalyticsData {
  configured: boolean;
  summary: {
    total: number;
    served: number;
    suppressed: number;
    accepted: number;
    uniqueCustomers: number;
  };
  serveRate: number;
  acceptRate: number;
  latency: {
    p50: number | null;
    p95: number | null;
    p99: number | null;
    avg: number | null;
  };
  funnel: Array<{ stage: string; count: number; pct: number }>;
  suppressionBreakdown: Array<{ reason: string; count: number; pct: number }>;
  strategyPerformance: Array<{
    id: string;
    name: string;
    total: number;
    served: number;
    serveRate: number;
    accepted: number;
    acceptRate: number;
  }>;
  channelPerformance: Array<{
    channel: string;
    total: number;
    served: number;
    serveRate: number;
  }>;
  dailyTrend: Array<{
    date: string;
    total: number;
    served: number;
    accepted: number;
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function serveRateColor(rate: number): string {
  if (rate > 70) return '#059669';
  if (rate >= 40) return '#D97706';
  return '#DC2626';
}

function cleanSuppressionLabel(reason: string): string {
  const map: Record<string, string> = {
    'Daily contact limit reached': 'Daily Limit',
    'Global frequency cap': 'Frequency Cap',
    'Cooldown period active': 'Cooldown',
    'No eligible actions': 'No Actions',
    'Model score below threshold': 'Score Threshold',
    'Channel disabled': 'Channel Off',
    'Audience not matched': 'Audience Miss',
    'Policy violation': 'Policy Block',
    'Duplicate suppression': 'Duplicate',
    'Opted out': 'Opt-Out',
  };
  if (map[reason]) return map[reason];
  // Generic: take first ~18 chars
  return reason.length > 18 ? reason.slice(0, 16) + '…' : reason;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Skeleton({ width = '100%', height = 16 }: { width?: string | number; height?: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 6,
        background: 'var(--border)',
        opacity: 0.5,
        animation: 'pulse 1.4s ease-in-out infinite',
      }}
    />
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  iconColor,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  iconColor: string;
}) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'var(--text-muted)',
          }}
        >
          {label}
        </span>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: iconColor + '18',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={16} color={iconColor} />
        </div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <Skeleton width="60%" height={12} />
      <Skeleton width="40%" height={28} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/analytics?tenantId=default-tenant&days=${period}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: AnalyticsData) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [period]);

  // ── Period selector ────────────────────────────────────────────────────────
  const periodOptions: Array<{ label: string; value: 7 | 30 | 90 }> = [
    { label: '7 days', value: 7 },
    { label: '30 days', value: 30 },
    { label: '90 days', value: 90 },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '32px 40px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Global keyframe for skeleton pulse */}
      <style>{`@keyframes pulse { 0%,100%{opacity:.35} 50%{opacity:.7} }`}</style>

      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 32,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: 'var(--text)',
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Analytics
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
            Decision performance and engagement insights
          </p>
        </div>

        {/* Period selector */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 3,
          }}
        >
          {periodOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                background: period === opt.value ? 'var(--brand-accent, #1D4ED8)' : 'transparent',
                color: period === opt.value ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Error state ── */}
      {error && (
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 10,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            color: '#DC2626',
            marginBottom: 24,
          }}
        >
          <AlertCircle size={18} />
          <span style={{ fontSize: 14 }}>Failed to load analytics: {error}</span>
        </div>
      )}

      {/* ── KPI Row ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : data ? (
          <>
            <KpiCard
              label="Total Decisions"
              value={data.summary.total.toLocaleString()}
              icon={Zap}
              iconColor="#1D4ED8"
            />
            <KpiCard
              label="Serve Rate"
              value={`${data.serveRate}%`}
              icon={TrendingUp}
              iconColor="#059669"
            />
            <KpiCard
              label="Acceptance Rate"
              value={`${data.acceptRate}%`}
              icon={CheckCircle}
              iconColor="#7C3AED"
            />
            <KpiCard
              label="Unique Customers"
              value={data.summary.uniqueCustomers.toLocaleString()}
              icon={Users}
              iconColor="#D97706"
            />
            <KpiCard
              label="Avg Latency"
              value={data.latency.avg !== null ? `${data.latency.avg}ms` : 'N/A'}
              icon={Clock}
              iconColor="#0891B2"
            />
          </>
        ) : null}
      </div>

      {/* ── Two-column row: Funnel + Suppression ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '60% 1fr',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* ── Engagement Funnel ── */}
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '20px 24px',
          }}
        >
          <h2
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--text)',
              margin: '0 0 18px',
            }}
          >
            Engagement Funnel
          </h2>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} height={36} />
              ))}
            </div>
          ) : data ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {data.funnel.map((item, idx) => {
                const maxCount = data.funnel[0]?.count || 1;
                const barPct = (item.count / maxCount) * 100;
                return (
                  <div key={idx}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 5,
                      }}
                    >
                      <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                        {item.stage}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                          {item.count.toLocaleString()}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--brand-accent, #1D4ED8)',
                            minWidth: 38,
                            textAlign: 'right',
                          }}
                        >
                          {item.pct}%
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        height: 8,
                        borderRadius: 4,
                        background: 'var(--border)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${barPct}%`,
                          borderRadius: 4,
                          background: 'var(--brand-accent, #1D4ED8)',
                          opacity: 1 - idx * 0.15,
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* ── Suppression Breakdown ── */}
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '20px 24px',
          }}
        >
          <h2
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--text)',
              margin: '0 0 18px',
            }}
          >
            Suppression Breakdown
          </h2>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} height={28} />
              ))}
            </div>
          ) : data ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.suppressionBreakdown.slice(0, 6).map((item, idx) => {
                const maxCount = data.suppressionBreakdown[0]?.count || 1;
                const barPct = (item.count / maxCount) * 100;
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 12,
                        color: 'var(--text)',
                        width: 90,
                        flexShrink: 0,
                        fontWeight: 500,
                      }}
                    >
                      {cleanSuppressionLabel(item.reason)}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 6,
                        borderRadius: 3,
                        background: 'var(--border)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${barPct}%`,
                          borderRadius: 3,
                          background: '#DC2626',
                          opacity: 0.7,
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        minWidth: 36,
                        textAlign: 'right',
                        fontWeight: 600,
                      }}
                    >
                      {item.count}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Strategy Performance Table ── */}
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '20px 24px',
          marginBottom: 24,
          overflow: 'auto',
        }}
      >
        <h2
          style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 16px' }}
        >
          Strategy Performance
        </h2>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={36} />
            ))}
          </div>
        ) : data ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {[
                  'Strategy Name',
                  'Total Decisions',
                  'Served',
                  'Serve Rate',
                  'Accepted',
                  'Acceptance Rate',
                ].map((col) => (
                  <th
                    key={col}
                    style={{
                      textAlign: col === 'Strategy Name' ? 'left' : 'right',
                      padding: '8px 12px',
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--text-muted)',
                      borderBottom: '1px solid var(--border)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...data.strategyPerformance]
                .sort((a, b) => b.served - a.served)
                .slice(0, 10)
                .map((row, idx) => (
                  <tr
                    key={row.id}
                    style={{
                      background: idx % 2 === 1 ? 'rgba(0,0,0,0.02)' : 'transparent',
                    }}
                  >
                    <td
                      style={{
                        padding: '10px 12px',
                        color: 'var(--text)',
                        fontWeight: 500,
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {row.name}
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        color: 'var(--text-muted)',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {row.total.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        color: 'var(--text-muted)',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {row.served.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <span
                        style={{
                          color: serveRateColor(row.serveRate),
                          fontWeight: 600,
                        }}
                      >
                        {row.serveRate}%
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        color: 'var(--text-muted)',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {row.accepted.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        color: 'var(--text-muted)',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {row.acceptRate}%
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : null}
      </div>

      {/* ── Channel Performance Table ── */}
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '20px 24px',
          marginBottom: 24,
          overflow: 'auto',
        }}
      >
        <h2
          style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 16px' }}
        >
          Channel Performance
        </h2>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={36} />
            ))}
          </div>
        ) : data ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Channel', 'Decisions', 'Served', 'Serve Rate'].map((col) => (
                  <th
                    key={col}
                    style={{
                      textAlign: col === 'Channel' ? 'left' : 'right',
                      padding: '8px 12px',
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--text-muted)',
                      borderBottom: '1px solid var(--border)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...data.channelPerformance]
                .sort((a, b) => b.served - a.served)
                .map((row, idx) => (
                  <tr
                    key={row.channel}
                    style={{
                      background: idx % 2 === 1 ? 'rgba(0,0,0,0.02)' : 'transparent',
                    }}
                  >
                    <td
                      style={{
                        padding: '10px 12px',
                        color: 'var(--text)',
                        fontWeight: 500,
                        borderBottom: '1px solid var(--border)',
                        textTransform: 'capitalize',
                      }}
                    >
                      {row.channel}
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        color: 'var(--text-muted)',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {row.total.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        color: 'var(--text-muted)',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {row.served.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <span
                        style={{
                          color: serveRateColor(row.serveRate),
                          fontWeight: 600,
                        }}
                      >
                        {row.serveRate}%
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : null}
      </div>

      {/* ── Daily Trend ── */}
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '20px 24px',
          marginBottom: 24,
        }}
      >
        <h2
          style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 20px' }}
        >
          Daily Trend
        </h2>

        {loading ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 }}>
            {Array.from({ length: 14 }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${30 + Math.random() * 50}%`,
                  borderRadius: 4,
                  background: 'var(--border)',
                  opacity: 0.5,
                }}
              />
            ))}
          </div>
        ) : data ? (
          (() => {
            const trend = data.dailyTrend.slice(-14);
            const maxTotal = Math.max(...trend.map((d) => d.total), 1);
            const BAR_MAX = 60;
            return (
              <div style={{ overflowX: 'auto' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 6,
                    minWidth: 560,
                    paddingBottom: 4,
                  }}
                >
                  {trend.map((day) => {
                    const servedH = Math.round((day.served / maxTotal) * BAR_MAX);
                    const suppressedH = Math.round(
                      ((day.total - day.served) / maxTotal) * BAR_MAX
                    );
                    const label = day.date.slice(5); // MM-DD
                    return (
                      <div
                        key={day.date}
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column-reverse',
                            gap: 2,
                            alignItems: 'stretch',
                            width: '100%',
                          }}
                        >
                          {servedH > 0 && (
                            <div
                              title={`Served: ${day.served}`}
                              style={{
                                height: servedH,
                                borderRadius: '3px 3px 0 0',
                                background: 'var(--brand-accent, #1D4ED8)',
                                opacity: 0.85,
                              }}
                            />
                          )}
                          {suppressedH > 0 && (
                            <div
                              title={`Suppressed: ${day.total - day.served}`}
                              style={{
                                height: suppressedH,
                                borderRadius: '3px 3px 0 0',
                                background: '#DC2626',
                                opacity: 0.6,
                              }}
                            />
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            transform: 'rotate(-35deg)',
                            transformOrigin: 'center',
                            display: 'block',
                            marginTop: 4,
                          }}
                        >
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Legend */}
                <div
                  style={{
                    display: 'flex',
                    gap: 20,
                    marginTop: 20,
                    justifyContent: 'flex-end',
                  }}
                >
                  {[
                    { color: 'var(--brand-accent, #1D4ED8)', label: 'Served' },
                    { color: '#DC2626', label: 'Suppressed' },
                  ].map((leg) => (
                    <div
                      key={leg.label}
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: leg.color,
                          opacity: 0.8,
                        }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {leg.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()
        ) : null}
      </div>

      {/* ── Decision Latency ── */}
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '20px 24px',
          marginBottom: 40,
        }}
      >
        <h2
          style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 16px' }}
        >
          Decision Latency
        </h2>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} height={64} />
            ))}
          </div>
        ) : data ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 16,
            }}
          >
            {[
              { label: 'p50 (Median)', value: data.latency.p50 },
              { label: 'p95', value: data.latency.p95 },
              { label: 'p99', value: data.latency.p99 },
            ].map((tile) => (
              <div
                key={tile.label}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '14px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    color: 'var(--text-muted)',
                  }}
                >
                  {tile.label}
                </span>
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: 'var(--text)',
                    lineHeight: 1,
                  }}
                >
                  {tile.value !== null ? `${tile.value}ms` : 'N/A'}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
