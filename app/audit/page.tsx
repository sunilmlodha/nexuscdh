'use client';
import { useState, useEffect, useCallback } from 'react';
import { Shield, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';

interface AuditEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  action: 'created' | 'updated' | 'deleted' | string;
  changed_by: string | null;
  before_snapshot: Record<string, unknown> | null;
  after_snapshot: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_COLOR: Record<string, string> = {
  created: '#16a34a',
  updated: '#2563eb',
  deleted: '#dc2626',
};

const ENTITY_LABELS: Record<string, string> = {
  strategy: 'Strategy',
  policy: 'Policy',
  action: 'Action',
  taxonomy: 'Taxonomy',
  channel: 'Channel',
  decision_outcome: 'Outcome',
};

function SnapshotDiff({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  if (!before && !after) return null;
  const allKeys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])).filter(k => k !== 'updated_at');
  const changed = allKeys.filter(k => JSON.stringify((before ?? {})[k]) !== JSON.stringify((after ?? {})[k]));
  if (changed.length === 0) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No field changes detected</div>;
  return (
    <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
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

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [configured, setConfigured] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ tenantId: 'f0000000-0000-4000-a000-000000000001', limit: '100' });
    if (filterType) params.set('entityType', filterType);
    const r = await fetch(`/api/audit?${params}`);
    const j = await r.json();
    setConfigured(j.configured !== false);
    setEntries(j.data ?? []);
    setLoading(false);
  }, [filterType]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const visible = entries.filter(e => !filterAction || e.action === filterAction);

  const td = { padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, verticalAlign: 'top' as const };

  return (
    <div className="animate-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Config Audit Log</h1>
          <p className="page-subtitle">Full history of all configuration changes — strategies, policies, actions, channels</p>
        </div>
        <div style={{ paddingTop: 24 }}>
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={13} /> Refresh</button>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: 10 }}>
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
        </div>

        {!configured && (
          <div style={{ padding: 14, background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
            Supabase not configured — audit log requires a database connection.
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Loading…</div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            <Shield size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
            <div style={{ fontWeight: 600, marginBottom: 6 }}>No audit entries</div>
            <div style={{ fontSize: 13 }}>Changes to strategies, policies, and actions will appear here</div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['', 'Entity', 'Type', 'Action', 'Changed By', 'When'].map(h => (
                    <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(e => {
                  const open = expanded.has(e.id);
                  const hasDiff = e.before_snapshot || e.after_snapshot;
                  return (
                    <>
                      <tr key={e.id} style={{ cursor: hasDiff ? 'pointer' : 'default' }} onClick={() => hasDiff && toggle(e.id)}>
                        <td style={{ ...td, width: 24, color: 'var(--text-muted)' }}>
                          {hasDiff ? (open ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : null}
                        </td>
                        <td style={td}><span style={{ fontWeight: 500 }}>{e.entity_name ?? e.entity_id.slice(0, 8)}</span></td>
                        <td style={td}><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ENTITY_LABELS[e.entity_type] ?? e.entity_type}</span></td>
                        <td style={td}>
                          <span style={{ fontWeight: 600, fontSize: 12, color: ACTION_COLOR[e.action] ?? '#6b7280', textTransform: 'capitalize' }}>{e.action}</span>
                        </td>
                        <td style={td}><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{e.changed_by ?? 'system'}</span></td>
                        <td style={td}><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(e.created_at).toLocaleString()}</span></td>
                      </tr>
                      {open && hasDiff && (
                        <tr key={`${e.id}-diff`}>
                          <td />
                          <td colSpan={5} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                            <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: 8 }}>
                              <span>Field</span><span style={{ color: '#dc2626' }}>Before</span><span style={{ color: '#16a34a' }}>After</span>
                            </div>
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

        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
          {visible.length} entries{filterType || filterAction ? ' (filtered)' : ''}
        </div>
      </div>
    </div>
  );
}
