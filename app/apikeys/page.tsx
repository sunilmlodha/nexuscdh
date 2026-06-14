'use client';
import { useState, useEffect, useCallback } from 'react';
import { Key, Plus, Trash2, Copy, Eye, EyeOff, AlertTriangle, CheckCircle } from 'lucide-react';

interface ApiKeyRecord {
  id: string;
  name: string;
  key_prefix: string;
  status: 'active' | 'revoked';
  created_at: string;
  last_used_at: string | null;
  created_by: string | null;
}

interface NewKeyResult {
  key: string;
  record: ApiKeyRecord;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newResult, setNewResult] = useState<NewKeyResult | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [configured, setConfigured] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/apikeys?tenantId=default-tenant');
    const j = await r.json();
    setConfigured(j.configured !== false);
    setKeys(j.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const r = await fetch('/api/apikeys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), tenantId: 'default-tenant' }),
    });
    const j = await r.json();
    setCreating(false);
    if (r.ok) {
      setNewResult(j);
      setNewName('');
      setShowNew(false);
      load();
    }
  };

  const revoke = async (id: string, name: string) => {
    if (!confirm(`Revoke API key "${name}"? Any integrations using this key will stop working immediately.`)) return;
    await fetch(`/api/apikeys?id=${id}`, { method: 'DELETE' });
    load();
  };

  const copyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const td = { padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, verticalAlign: 'top' as const };

  return (
    <div className="animate-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">API Keys</h1>
          <p className="page-subtitle">Manage authentication keys for external integrations — CDPs, CRMs, and channel connectors</p>
        </div>
        <div style={{ paddingTop: 24 }}>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            <Plus size={14} /> New API Key
          </button>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Newly created key — shown once */}
        {newResult && (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <CheckCircle size={16} style={{ color: '#16a34a' }} />
              <span style={{ fontWeight: 600, color: '#166534' }}>API key created — copy it now, it won&apos;t be shown again</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, fontFamily: 'monospace', fontSize: 13, background: '#dcfce7', border: '1px solid #86efac', borderRadius: 6, padding: '8px 12px', letterSpacing: '0.5px', wordBreak: 'break-all' }}>
                {revealed ? newResult.key : `${newResult.key.slice(0, 12)}${'•'.repeat(32)}`}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setRevealed(r => !r)} title={revealed ? 'Hide' : 'Reveal'}>
                {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => copyKey(newResult.key)}>
                {copied ? <CheckCircle size={13} style={{ color: '#16a34a' }} /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: '#166534' }}>
              Use as: <code>X-API-Key: {newResult.key.slice(0, 12)}…</code> in request headers
            </div>
            <button onClick={() => setNewResult(null)} style={{ marginTop: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#16a34a', textDecoration: 'underline' }}>
              Dismiss
            </button>
          </div>
        )}

        {/* Create form */}
        {showNew && (
          <div className="card" style={{ padding: 20, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">Key Name *</label>
              <input
                className="form-input"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && create()}
                placeholder="e.g. Salesforce CDP Integration"
                autoFocus
              />
            </div>
            <button className="btn btn-primary" onClick={create} disabled={creating || !newName.trim()}>
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
          </div>
        )}

        {/* How to use */}
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 14, fontSize: 13, color: '#1e40af' }}>
          <strong>Usage:</strong> Send <code style={{ background: '#dbeafe', padding: '1px 5px', borderRadius: 3 }}>X-API-Key: &lt;key&gt;</code> header on all requests to <code style={{ background: '#dbeafe', padding: '1px 5px', borderRadius: 3 }}>/api/decide</code>. Browser sessions are exempted automatically.
        </div>

        {!configured && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 14, background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
            <AlertTriangle size={14} /> Supabase is not configured — API keys require a database connection. Running in demo mode.
          </div>
        )}

        {/* Keys table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Loading…</div>
        ) : keys.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            <Key size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
            <div style={{ fontWeight: 600, marginBottom: 6 }}>No API keys</div>
            <div style={{ fontSize: 13 }}>Create a key to authenticate external integrations</div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Name', 'Prefix', 'Status', 'Created', 'Last Used', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keys.map(k => (
                  <tr key={k.id}>
                    <td style={td}><span style={{ fontWeight: 500 }}>{k.name}</span></td>
                    <td style={td}><code style={{ fontSize: 12, background: 'var(--bg)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>{k.key_prefix}…</code></td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: k.status === 'active' ? '#16a34a' : '#9ca3af' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: k.status === 'active' ? '#16a34a' : '#9ca3af', display: 'inline-block' }} />
                        {k.status}
                      </span>
                    </td>
                    <td style={td}><span style={{ color: 'var(--text-muted)' }}>{new Date(k.created_at).toLocaleDateString()}</span></td>
                    <td style={td}><span style={{ color: 'var(--text-muted)' }}>{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : '—'}</span></td>
                    <td style={td}>
                      {k.status === 'active' && (
                        <button className="btn btn-secondary btn-sm" onClick={() => revoke(k.id, k.name)} style={{ color: '#dc2626' }}>
                          <Trash2 size={12} /> Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
