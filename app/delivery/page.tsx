'use client';

import { useState, useEffect, useCallback } from 'react';
import { Send, Plus, X, Trash2, Edit2, Copy, CheckCircle2, XCircle, Webhook } from 'lucide-react';

const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';
const CHANNELS = ['email', 'sms', 'push', 'in_app', 'direct_mail', 'outbound_call'];
const PROVIDERS = [
  { key: 'mock', label: 'Mock (log only)', needs: [] },
  { key: 'webhook', label: 'Webhook (your ESP/CDP)', needs: ['endpoint_url'] },
  { key: 'sendgrid', label: 'SendGrid (email)', needs: ['api_key'] },
  { key: 'twilio', label: 'Twilio (SMS)', needs: ['api_key'] },
];
const panel: React.CSSProperties = { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12 };
const input: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 };

interface Adapter { id: string; channel: string; provider: string; endpoint_url?: string; api_key?: string; status: string; }
interface Delivery { id: string; customer_id: string; channel: string; action_name?: string; provider: string; status: string; provider_message_id?: string; error?: string; sent_at: string; }

const STATUS_COLOR: Record<string, string> = { sent: '#3b82f6', delivered: '#22c55e', opened: '#16a34a', clicked: '#15803d', failed: '#ef4444', bounced: '#f59e0b' };

export default function DeliveryPage() {
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Partial<Adapter>>({ channel: 'email', provider: 'mock', status: 'active' });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => { setWebhookUrl(`${window.location.origin}/api/webhooks/outcome`); }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [a, d] = await Promise.all([
        fetch(`/api/channels/adapters?tenantId=${TENANT_ID}`).then(r => r.json()),
        fetch(`/api/deliver?tenantId=${TENANT_ID}&limit=100`).then(r => r.json()),
      ]);
      if (a.configured === false) setError('Supabase not configured.');
      else setAdapters(a.data ?? []);
      setDeliveries(d.data ?? []);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!form.channel) return;
    setSaving(true);
    try {
      await fetch('/api/channels/adapters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, tenantId: TENANT_ID }) });
      setModal(false); setForm({ channel: 'email', provider: 'mock', status: 'active' }); load();
    } finally { setSaving(false); }
  }
  async function del(id: string) { await fetch(`/api/channels/adapters?id=${id}&tenantId=${TENANT_ID}`, { method: 'DELETE' }); load(); }

  const provMeta = PROVIDERS.find(p => p.key === form.provider) ?? PROVIDERS[0];

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1060, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Send size={24} color="var(--brand-accent)" />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Delivery</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Channel adapters that send served decisions, and the inbound outcome webhook that closes the loop.</p>
          </div>
        </div>
        <button onClick={() => { setForm({ channel: 'email', provider: 'mock', status: 'active' }); setModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'var(--brand-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          <Plus size={14} /> Configure Channel
        </button>
      </div>

      {error && <div style={{ ...panel, padding: 16, marginTop: 16, borderLeft: '3px solid #ef4444', fontSize: 13, color: 'var(--text-secondary)' }}>{error}</div>}

      {/* Outcome webhook */}
      <div style={{ ...panel, padding: 18, margin: '18px 0', borderLeft: '3px solid var(--brand-accent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><Webhook size={15} color="var(--brand-accent)" /><span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Outcome Webhook</span></div>
        <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-muted)' }}>Point your channel/ESP delivery & engagement events here. POST <code>{`{ event, messageId }`}</code> — it maps the event to an outcome, records it on the decision, and updates the adaptive model.</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <code style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: 'var(--text-primary)' }}>{webhookUrl || '…'}</code>
          <button onClick={() => { navigator.clipboard?.writeText(webhookUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>
            <Copy size={12} /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Adapters */}
      <div style={{ ...panel, padding: 20, marginBottom: 18 }}>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Channel Adapters</div>
        {adapters.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No adapters configured — channels fall back to <strong>mock</strong> (sends are logged, not transmitted). Configure a channel to use a webhook or provider.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {adapters.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', width: 110, textTransform: 'capitalize' }}>{a.channel.replace('_', ' ')}</span>
                <span style={{ padding: '2px 8px', borderRadius: 16, fontSize: 11, fontWeight: 600, background: 'rgba(99,102,241,0.1)', color: 'var(--brand-accent)' }}>{a.provider}</span>
                {a.endpoint_url && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.endpoint_url}</span>}
                <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 16, fontSize: 11, fontWeight: 600, background: a.status === 'active' ? '#dcfce7' : 'var(--bg-panel)', color: a.status === 'active' ? '#15803d' : 'var(--text-muted)' }}>{a.status}</span>
                <button onClick={() => { setForm(a); setModal(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><Edit2 size={13} /></button>
                <button onClick={() => del(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delivery log */}
      <div style={{ ...panel, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, color: 'var(--text-primary)' }}>Recent Deliveries <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>({deliveries.length})</span></div>
        {loading ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div> :
          deliveries.length === 0 ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No deliveries yet. Run a campaign or the journey worker to generate sends.</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: 'var(--bg)' }}>{['Customer', 'Channel', 'Action', 'Provider', 'Status', 'Message ID', 'Sent'].map(h => <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {deliveries.map(d => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: 'var(--brand-accent)' }}>{d.customer_id}</td>
                  <td style={{ padding: '9px 14px', color: 'var(--text-secondary)' }}>{d.channel}</td>
                  <td style={{ padding: '9px 14px', color: 'var(--text-primary)' }}>{d.action_name ?? '—'}</td>
                  <td style={{ padding: '9px 14px', color: 'var(--text-muted)' }}>{d.provider}</td>
                  <td style={{ padding: '9px 14px' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: STATUS_COLOR[d.status] ?? 'var(--text-muted)', fontWeight: 600 }}>{d.status === 'failed' ? <XCircle size={12} /> : <CheckCircle2 size={12} />}{d.status}</span></td>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{d.provider_message_id ?? '—'}</td>
                  <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{new Date(d.sent_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{ ...panel, padding: 26, width: 460, maxWidth: '92vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{form.id ? 'Edit' : 'Configure'} Channel Adapter</h2>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={lbl}>Channel</label>
                <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} style={input} disabled={!!form.id}>
                  {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Provider</label>
                <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} style={input}>
                  {PROVIDERS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
              {provMeta.needs.includes('endpoint_url') && (
                <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Endpoint URL</label><input value={form.endpoint_url ?? ''} onChange={e => setForm(f => ({ ...f, endpoint_url: e.target.value }))} placeholder="https://your-esp.example.com/send" style={input} /></div>
              )}
              {provMeta.needs.includes('api_key') && (
                <div style={{ gridColumn: 'span 2' }}><label style={lbl}>API Key</label><input type="password" value={form.api_key ?? ''} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))} placeholder="provider secret" style={input} /></div>
              )}
              <div><label style={lbl}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={input}>
                  <option value="active">active</option><option value="inactive">inactive</option>
                </select>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>{form.provider === 'mock' ? 'Mock records the send without transmitting — good for testing the full loop.' : 'Falls back to mock if credentials are missing.'}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button onClick={() => setModal(false)} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: 'var(--brand-accent)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
