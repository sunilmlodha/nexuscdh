'use client';

import { useState, useCallback } from 'react';
import { Users, Search, List, CheckCircle, XCircle, ChevronRight, Plus, Trash2 } from 'lucide-react';

interface CustomerProfile {
  id: string;
  customer_id: string;
  attributes: Record<string, unknown>;
  segments: string[];
  interaction_count: number;
  last_seen_at?: string;
}

interface DecisionRow {
  id: string;
  strategy_name?: string;
  action_name?: string;
  served: boolean;
  suppression_reason?: string;
  outcome?: string;
  created_at: string;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ProfilesPage() {
  const [searchId, setSearchId] = useState('');
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [browseMode, setBrowseMode] = useState(false);
  const [allProfiles, setAllProfiles] = useState<CustomerProfile[]>([]);
  const [editAttrs, setEditAttrs] = useState<Record<string, unknown>>({});
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');
  const [addingAttr, setAddingAttr] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupProfile = useCallback(async (customerId: string) => {
    if (!customerId.trim()) return;
    setLoading(true);
    setError(null);
    setBrowseMode(false);
    try {
      const res = await fetch(`/api/profile?customerId=${encodeURIComponent(customerId)}&tenantId=f0000000-0000-4000-a000-000000000001`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load profile');
      setProfile(data.profile);
      setDecisions(data.decisions || []);
      setEditAttrs(data.profile?.attributes || {});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setProfile(null);
      setDecisions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    setProfile(null);
    setDecisions([]);
    setBrowseMode(true);
    try {
      const res = await fetch('/api/profile?list=true&tenantId=f0000000-0000-4000-a000-000000000001');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load profiles');
      setAllProfiles(data.profiles || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setAllProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveProfile = useCallback(async () => {
    if (!profile) return;
    setSaveLoading(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: profile.customer_id, attributes: editAttrs }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      setProfile((p) => p ? { ...p, attributes: editAttrs } : p);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaveLoading(false);
    }
  }, [profile, editAttrs]);

  const deleteProfile = useCallback(async () => {
    if (!profile) return;
    const confirmed = window.confirm(
      `Delete all data for ${profile.customer_id} including ${decisions.length} decisions? This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      const res = await fetch(
        `/api/profile?customerId=${encodeURIComponent(profile.customer_id)}&tenantId=f0000000-0000-4000-a000-000000000001`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed');
      }
      setProfile(null);
      setDecisions([]);
      setEditAttrs({});
      setSearchId('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }, [profile, decisions.length]);

  const recordOutcome = useCallback(async (decisionId: string, outcome: string) => {
    if (!profile) return;
    try {
      const res = await fetch('/api/outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisionId, customerId: profile.customer_id, outcome }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to record outcome');
      }
      setDecisions((prev) =>
        prev.map((d) => (d.id === decisionId ? { ...d, outcome } : d))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Outcome error');
    }
  }, [profile]);

  const attrEntries = Object.entries(editAttrs);

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--text)' }}>Customer Profiles</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
            Persistent customer context and interaction history
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={loadAll}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '8px',
              background: browseMode ? 'var(--brand-accent)' : 'var(--card)',
              color: browseMode ? '#fff' : 'var(--text)',
              border: '1px solid var(--border)',
              cursor: 'pointer', fontSize: '14px', fontWeight: 500,
            }}
          >
            <List size={15} /> Browse All
          </button>
          <button
            onClick={() => { setBrowseMode(false); setProfile(null); setDecisions([]); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '8px',
              background: !browseMode ? 'var(--brand-accent)' : 'var(--card)',
              color: !browseMode ? '#fff' : 'var(--text)',
              border: '1px solid var(--border)',
              cursor: 'pointer', fontSize: '14px', fontWeight: 500,
            }}
          >
            <Search size={15} /> Search
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{
        display: 'flex', gap: '8px', marginBottom: '28px',
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: '10px', padding: '12px 16px', alignItems: 'center',
      }}>
        <Search size={16} color="var(--text-muted)" />
        <input
          type="text"
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && lookupProfile(searchId)}
          placeholder="Enter customer ID..."
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text)', fontSize: '14px',
          }}
        />
        <button
          onClick={() => lookupProfile(searchId)}
          disabled={loading || !searchId.trim()}
          style={{
            padding: '7px 18px', borderRadius: '7px',
            background: 'var(--brand-accent)', color: '#fff',
            border: 'none', cursor: loading || !searchId.trim() ? 'not-allowed' : 'pointer',
            fontSize: '14px', fontWeight: 500, opacity: loading || !searchId.trim() ? 0.6 : 1,
          }}
        >
          {loading ? 'Loading…' : 'Look up'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5',
          borderRadius: '8px', padding: '10px 16px', marginBottom: '20px', fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      {/* Browse All Table */}
      {browseMode && !loading && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                {['Customer ID', 'Interactions', 'Last Seen', 'Attributes', ''].map((h) => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left', fontSize: '12px',
                    fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allProfiles.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                    No profiles found
                  </td>
                </tr>
              ) : (
                allProfiles.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '13px', color: 'var(--text)' }}>{p.customer_id}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text)', fontSize: '14px' }}>{p.interaction_count}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>{formatDate(p.last_seen_at)}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text)', fontSize: '14px' }}>{Object.keys(p.attributes || {}).length}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => { setSearchId(p.customer_id); lookupProfile(p.customer_id); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          padding: '5px 12px', borderRadius: '6px',
                          background: 'var(--bg)', border: '1px solid var(--border)',
                          color: 'var(--text)', cursor: 'pointer', fontSize: '13px',
                        }}
                      >
                        View <ChevronRight size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Loading spinner */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '14px' }}>
          Loading…
        </div>
      )}

      {/* Empty state */}
      {!loading && !browseMode && !profile && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '80px 32px', background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: '12px', textAlign: 'center',
        }}>
          <Users size={40} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
          <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>
            Search for a customer
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px', maxWidth: '360px' }}>
            Enter a customer ID above to view their profile and decision history
          </p>
        </div>
      )}

      {/* Profile detail */}
      {!loading && profile && (
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          {/* LEFT COLUMN */}
          <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Profile card */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
              {/* Header */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>
                    {profile.customer_id}
                  </span>
                  <span style={{
                    background: '#dbeafe', color: '#1d4ed8',
                    borderRadius: '999px', padding: '2px 10px', fontSize: '12px', fontWeight: 600,
                  }}>
                    {profile.interaction_count} interactions
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Last seen: {formatDate(profile.last_seen_at)}
                </div>
              </div>

              {/* Segments */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Segments
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {profile.segments && profile.segments.length > 0 ? (
                    profile.segments.map((seg) => (
                      <span key={seg} style={{
                        background: 'var(--bg)', border: '1px solid var(--border)',
                        borderRadius: '6px', padding: '3px 10px', fontSize: '12px', color: 'var(--text-muted)',
                      }}>
                        {seg}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No segments</span>
                  )}
                </div>
              </div>

              {/* Attributes */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Attributes
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {attrEntries.map(([key, val]) => (
                      <tr key={key}>
                        <td style={{ padding: '5px 8px 5px 0', fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-muted)', width: '40%', verticalAlign: 'middle' }}>
                          {key}
                        </td>
                        <td style={{ padding: '5px 0', verticalAlign: 'middle' }}>
                          <input
                            defaultValue={String(val ?? '')}
                            onBlur={(e) => setEditAttrs((prev) => ({ ...prev, [key]: e.target.value }))}
                            style={{
                              width: '100%', background: 'transparent', border: 'none',
                              borderBottom: '1px solid transparent', outline: 'none',
                              color: 'var(--text)', fontSize: '13px', padding: '2px 4px',
                              cursor: 'text',
                            }}
                            onFocus={(e) => { e.currentTarget.style.borderBottomColor = 'var(--brand-accent)'; }}
                            onBlurCapture={(e) => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
                          />
                        </td>
                        <td style={{ padding: '5px 0 5px 4px', width: '24px' }}>
                          <button
                            onClick={() => setEditAttrs((prev) => { const n = { ...prev }; delete n[key]; return n; })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex', alignItems: 'center' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Add attribute */}
                {addingAttr ? (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    <input
                      placeholder="Key"
                      value={newAttrKey}
                      onChange={(e) => setNewAttrKey(e.target.value)}
                      style={{
                        flex: 1, padding: '5px 8px', borderRadius: '6px',
                        border: '1px solid var(--border)', background: 'var(--bg)',
                        color: 'var(--text)', fontSize: '12px', outline: 'none',
                      }}
                    />
                    <input
                      placeholder="Value"
                      value={newAttrValue}
                      onChange={(e) => setNewAttrValue(e.target.value)}
                      style={{
                        flex: 1, padding: '5px 8px', borderRadius: '6px',
                        border: '1px solid var(--border)', background: 'var(--bg)',
                        color: 'var(--text)', fontSize: '12px', outline: 'none',
                      }}
                    />
                    <button
                      onClick={() => {
                        if (newAttrKey.trim()) {
                          setEditAttrs((prev) => ({ ...prev, [newAttrKey.trim()]: newAttrValue }));
                          setNewAttrKey('');
                          setNewAttrValue('');
                          setAddingAttr(false);
                        }
                      }}
                      style={{
                        padding: '5px 10px', borderRadius: '6px',
                        background: 'var(--brand-accent)', color: '#fff',
                        border: 'none', cursor: 'pointer', fontSize: '12px',
                      }}
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setAddingAttr(false); setNewAttrKey(''); setNewAttrValue(''); }}
                      style={{
                        padding: '5px 10px', borderRadius: '6px',
                        background: 'var(--bg)', color: 'var(--text-muted)',
                        border: '1px solid var(--border)', cursor: 'pointer', fontSize: '12px',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingAttr(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      marginTop: '8px', background: 'none', border: 'none',
                      color: 'var(--brand-accent)', cursor: 'pointer', fontSize: '13px', padding: '4px 0',
                    }}
                  >
                    <Plus size={13} /> Add attribute
                  </button>
                )}

                <button
                  onClick={saveProfile}
                  disabled={saveLoading}
                  style={{
                    marginTop: '12px', width: '100%', padding: '8px',
                    borderRadius: '8px', background: 'var(--brand-accent)', color: '#fff',
                    border: 'none', cursor: saveLoading ? 'not-allowed' : 'pointer',
                    fontSize: '13px', fontWeight: 600, opacity: saveLoading ? 0.7 : 1,
                  }}
                >
                  {saveLoading ? 'Saving…' : 'Save Profile'}
                </button>
              </div>

              {/* GDPR */}
              <div style={{
                borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '4px',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
                  Right to Erasure
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  Delete all data for this customer
                </div>
                <button
                  onClick={deleteProfile}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '7px 14px', borderRadius: '7px',
                    background: '#fee2e2', color: '#b91c1c',
                    border: '1px solid #fca5a5', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                  }}
                >
                  <Trash2 size={13} /> Delete all data
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ flex: '0 0 calc(60% - 24px)', minWidth: 0 }}>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>Decision History</h2>
                <span style={{
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: '999px', padding: '2px 10px', fontSize: '12px', color: 'var(--text-muted)',
                }}>
                  {decisions.length}
                </span>
              </div>

              {decisions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '14px' }}>
                  No decisions recorded yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {decisions.map((row) => (
                    <div key={row.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px',
                      padding: '12px 14px', borderRadius: '8px',
                      background: 'var(--bg)', border: '1px solid var(--border)',
                    }}>
                      <div style={{ paddingTop: '1px', flexShrink: 0 }}>
                        {row.served
                          ? <CheckCircle size={16} color="#16a34a" />
                          : <XCircle size={16} color="#dc2626" />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 500, fontSize: '14px', color: 'var(--text)' }}>
                            {row.strategy_name || 'Unknown strategy'}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>
                            {formatRelativeTime(row.created_at)}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', marginTop: '2px' }}>
                          {row.served
                            ? <span style={{ color: 'var(--text-muted)' }}>{row.action_name}</span>
                            : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{row.suppression_reason || 'Suppressed'}</span>}
                        </div>
                        <div style={{ marginTop: '8px' }}>
                          {row.outcome ? (
                            <span style={{
                              display: 'inline-block', padding: '2px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 500,
                              ...(row.outcome === 'accepted'
                                ? { background: '#dcfce7', color: '#15803d' }
                                : row.outcome === 'rejected'
                                ? { background: '#fee2e2', color: '#b91c1c' }
                                : { background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }),
                            }}>
                              {row.outcome.charAt(0).toUpperCase() + row.outcome.slice(1)}
                            </span>
                          ) : (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => recordOutcome(row.id, 'accepted')}
                                style={{
                                  padding: '3px 10px', borderRadius: '6px', fontSize: '12px',
                                  background: '#dcfce7', color: '#15803d', border: '1px solid #86efac',
                                  cursor: 'pointer', fontWeight: 500,
                                }}
                              >
                                ✓ Accept
                              </button>
                              <button
                                onClick={() => recordOutcome(row.id, 'rejected')}
                                style={{
                                  padding: '3px 10px', borderRadius: '6px', fontSize: '12px',
                                  background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5',
                                  cursor: 'pointer', fontWeight: 500,
                                }}
                              >
                                ✗ Reject
                              </button>
                              <button
                                onClick={() => recordOutcome(row.id, 'ignored')}
                                style={{
                                  padding: '3px 10px', borderRadius: '6px', fontSize: '12px',
                                  background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)',
                                  cursor: 'pointer', fontWeight: 500,
                                }}
                              >
                                — Ignore
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
