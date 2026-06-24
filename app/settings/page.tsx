'use client';

import { useState, useEffect } from 'react';
import { useAuth, ROLE_LABELS } from '@/lib/auth';
import { useStore, INDUSTRY_TEMPLATES } from '@/lib/store';
import { Save, CheckCircle2, Sun, Moon, Sparkles, Shield, Building2, Palette, Database, Key } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  status: 'active' | 'revoked';
  lastUsed?: string;
  createdAt: string;
}

export default function SettingsPage() {
  const { authSettings, updateAuthSettings, currentUser } = useAuth();
  const { tenant, updateTenant } = useStore();
  const [tenantName, setTenantName] = useState(tenant.name);
  const [industry, setIndustry] = useState(tenant.industry);
  const [saved, setSaved] = useState<string|null>(null);

  const saveGeneral = () => {
    updateTenant({ name: tenantName, industry });
    setSaved('general'); setTimeout(() => setSaved(null), 2000);
  };

  const tabs = ['General', 'Appearance', 'Authentication', 'Data & Privacy', 'API Keys'];
  const [tab, setTab] = useState('General');

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string|null>(null);
  const [keysLoading, setKeysLoading] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  const loadKeys = async () => {
    setKeysLoading(true);
    try {
      const res = await fetch('/api/apikeys?tenantId=f0000000-0000-4000-a000-000000000001');
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data.keys ?? data ?? []);
      }
    } catch {
      // ignore
    } finally {
      setKeysLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'API Keys') {
      loadKeys();
    }
  }, [tab]);

  const revokeKey = async (id: string) => {
    try {
      await fetch(`/api/apikeys?id=${id}`, { method: 'DELETE' });
      await loadKeys();
    } catch {
      // ignore
    }
  };

  const generateKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      const res = await fetch('/api/apikeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim(), tenantId: 'f0000000-0000-4000-a000-000000000001' }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedKey(data.key ?? data.apiKey ?? null);
        setNewKeyName('');
        setKeyCopied(false);
        await loadKeys();
      }
    } catch {
      // ignore
    }
  };

  const copyKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setKeyCopied(true);
    }
  };

  const dismissKey = () => {
    setGeneratedKey(null);
    setKeyCopied(false);
  };

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure your Stratcheck workspace, appearance, and access controls</p>
      </div>
      <div className="tabs">{tabs.map(t => <div key={t} className="tab" data-active={tab===t||undefined} onClick={()=>setTab(t)}>{t}</div>)}</div>

      <div style={{ padding:'24px', maxWidth:640 }}>

        {tab === 'General' && (
          <div className="card card-body" style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <Building2 size={18} color="var(--brand-accent)" />
              <div style={{ fontSize:15, fontWeight:700 }}>Organisation</div>
            </div>
            <div className="field-group" style={{ marginBottom:0 }}>
              <label className="label">Organisation Name</label>
              <input className="input" value={tenantName} onChange={e=>setTenantName(e.target.value)} />
            </div>
            <div className="field-group" style={{ marginBottom:0 }}>
              <label className="label">Industry Template</label>
              <select className="input select" value={industry} onChange={e=>setIndustry(e.target.value as any)}>
                {Object.entries(INDUSTRY_TEMPLATES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <div className="field-hint">Sets default LOB names and category suggestions. Does not delete existing configuration.</div>
            </div>
            {industry && (
              <div className="alert alert-info" style={{ fontSize:12 }}>
                <strong>{INDUSTRY_TEMPLATES[industry as keyof typeof INDUSTRY_TEMPLATES].label}</strong> template includes: {INDUSTRY_TEMPLATES[industry as keyof typeof INDUSTRY_TEMPLATES].categories.join(', ')}
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <button onClick={saveGeneral} className="btn btn-primary btn-sm">
                {saved==='general' ? <><CheckCircle2 size={13}/>Saved</> : <><Save size={13}/>Save changes</>}
              </button>
            </div>
          </div>
        )}

        {tab === 'Appearance' && (
          <div className="card card-body" style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <Palette size={18} color="var(--brand-accent)" />
              <div style={{ fontSize:15, fontWeight:700 }}>Theme</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
              {(['default','editorial','vault'] as const).map(t => {
                const Icon = t==='default' ? Sun : t==='editorial' ? Moon : Sparkles;
                const desc = t==='default'
                  ? 'Clean, neutral. Standard enterprise interface.'
                  : t==='editorial'
                  ? 'Editorial typographic style. Warm tones, high contrast.'
                  : 'Soft consumer-fintech. Light sidebar, serif headings, periwinkle accent.';
                return (
                <button key={t} onClick={() => updateAuthSettings({ theme: t })}
                  style={{ padding:'16px', border:`2px solid ${authSettings.theme===t?'var(--brand-accent)':'var(--border)'}`, borderRadius:10, cursor:'pointer', background:'var(--bg-panel)', textAlign:'left', transition:'border-color 0.15s' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <Icon size={16} color={authSettings.theme===t?'var(--brand-accent)':'var(--text-muted)'}/>
                    <span style={{ fontWeight:700, fontSize:13, color: authSettings.theme===t?'var(--brand-accent)':'var(--text-primary)', textTransform:'capitalize' }}>{t}</span>
                    {authSettings.theme===t && <span className="badge badge-blue" style={{ marginLeft:'auto', fontSize:10 }}>Active</span>}
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.4 }}>{desc}</div>
                </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'Authentication' && (
          <div className="card card-body" style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <Shield size={18} color="var(--brand-accent)" />
              <div style={{ fontSize:15, fontWeight:700 }}>Authentication</div>
            </div>
            <div className="alert alert-info">
              <strong>Demo Mode is {authSettings.authEnabled ? 'off' : 'on'}.</strong> {authSettings.authEnabled ? ' Users must sign in with their credentials.' : ' Authentication is disabled — all users have full access. Enable for production.'}
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
              <div onClick={() => updateAuthSettings({ authEnabled: !authSettings.authEnabled })}
                style={{ width:44, height:24, borderRadius:100, background: authSettings.authEnabled?'var(--brand-accent)':'var(--border)', position:'relative', cursor:'pointer', transition:'background 0.2s', flexShrink:0 }}>
                <div style={{ position:'absolute', top:3, left: authSettings.authEnabled?22:3, width:18, height:18, borderRadius:'50%', background:'white', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
              </div>
              <div>
                <div style={{ fontWeight:600, fontSize:13 }}>Require authentication</div>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>When enabled, users must sign in. RBAC roles are enforced.</div>
              </div>
            </label>
            {authSettings.authEnabled && (
              <div className="alert alert-warning" style={{ fontSize:12 }}>
                You are currently signed in as <strong>{currentUser?.name}</strong> ({ROLE_LABELS[currentUser?.role??'read_only']}). Other users can sign in from the login page.
              </div>
            )}
          </div>
        )}

        {tab === 'Data & Privacy' && (
          <div className="card card-body" style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <Database size={18} color="var(--brand-accent)" />
              <div style={{ fontSize:15, fontWeight:700 }}>Data & Privacy</div>
            </div>
            <div className="alert alert-warning">
              <strong>Demo environment.</strong> All data is stored in browser localStorage. No data is transmitted to external servers.
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { label:'Consent Management', body:'Configure GDPR/consent tracking requirements for engagement policies.' },
                { label:'Data Residency',      body:'Configure regional data residency rules (PIPL, PDPA, GDPR). Production feature.' },
                { label:'Audit Retention',     body:'Set audit log retention period. Default: 90 days.' },
                { label:'Right to Erasure',    body:'Configure customer data erasure propagation rules.' },
              ].map(item => (
                <div key={item.label} style={{ padding:'12px 16px', border:'1px solid var(--border)', borderRadius:8, opacity:0.6 }}>
                  <div style={{ fontWeight:600, fontSize:13, marginBottom:3 }}>{item.label}</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{item.body}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>Available in full deployment</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'API Keys' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Info box */}
            <div className="card card-body">
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                <Key size={18} color="var(--brand-accent)" />
                <div style={{ fontSize:15, fontWeight:700 }}>API Keys</div>
              </div>
              <div className="alert alert-info" style={{ fontSize:12, marginBottom:12 }}>
                API keys allow external systems to call <code style={{ fontFamily:'var(--font-mono)', background:'rgba(0,0,0,0.06)', padding:'1px 4px', borderRadius:3 }}>/api/decide</code> securely. Always use HTTPS.
              </div>
              <div style={{ background:'var(--bg, #F8F9FA)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px', fontFamily:'var(--font-mono)', fontSize:11, lineHeight:1.7, overflowX:'auto', whiteSpace:'pre' }}>
{`curl -X POST https://nexuscdh.vercel.app/api/decide \\
  -H "X-API-Key: ncdh_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"customerId":"cust-001","attributes":{"consentGiven":true}}'`}
              </div>
            </div>

            {/* Generated key display */}
            {generatedKey && (
              <div style={{ border:'2px solid #F59E0B', borderRadius:10, padding:'14px 16px', background:'#FFFBEB', display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#92400E' }}>New API Key Generated</div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <code style={{ flex:1, fontFamily:'var(--font-mono)', fontSize:12, background:'white', border:'1px solid #FDE68A', borderRadius:6, padding:'8px 10px', overflowX:'auto', whiteSpace:'nowrap' }}>
                    {generatedKey}
                  </code>
                  <button onClick={copyKey} className="btn btn-primary btn-sm" style={{ flexShrink:0 }}>
                    {keyCopied ? <><CheckCircle2 size={12}/> Copied</> : 'Copy'}
                  </button>
                  <button onClick={dismissKey} className="btn btn-ghost btn-sm" style={{ flexShrink:0 }}>Dismiss</button>
                </div>
                <div style={{ fontSize:12, color:'#B45309', display:'flex', alignItems:'center', gap:6 }}>
                  <span>⚠</span> Store this key now — it will not be shown again
                </div>
              </div>
            )}

            {/* Active API Keys table */}
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <div className="card-header">
                <span className="card-title">Active API Keys</span>
              </div>
              {keysLoading ? (
                <div style={{ padding:'20px 16px', fontSize:13, color:'var(--text-muted)' }}>Loading…</div>
              ) : apiKeys.length === 0 ? (
                <div style={{ padding:'20px 16px', fontSize:13, color:'var(--text-muted)' }}>No API keys yet.</div>
              ) : (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ borderBottom:'1px solid var(--border)', background:'var(--bg, #F8F9FA)' }}>
                        {['Name','Prefix','Status','Last Used','Created',''].map(h => (
                          <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontWeight:600, color:'var(--text-muted)', fontSize:11 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {apiKeys.map(k => (
                        <tr key={k.id} style={{ borderBottom:'1px solid #F3F4F6' }}>
                          <td style={{ padding:'9px 12px', fontWeight:600 }}>{k.name}</td>
                          <td style={{ padding:'9px 12px', fontFamily:'var(--font-mono)', fontSize:11 }}>{k.prefix}</td>
                          <td style={{ padding:'9px 12px' }}>
                            <span className={`badge ${k.status === 'active' ? 'badge-green' : 'badge-red'}`} style={{ fontSize:10 }}>
                              {k.status}
                            </span>
                          </td>
                          <td style={{ padding:'9px 12px', color:'var(--text-muted)' }}>{k.lastUsed ? new Date(k.lastUsed).toLocaleDateString() : '—'}</td>
                          <td style={{ padding:'9px 12px', color:'var(--text-muted)' }}>{new Date(k.createdAt).toLocaleDateString()}</td>
                          <td style={{ padding:'9px 12px' }}>
                            {k.status === 'active' && (
                              <button onClick={() => revokeKey(k.id)}
                                style={{ fontSize:11, padding:'3px 8px', border:'1px solid var(--danger, #EF4444)', borderRadius:5, color:'var(--danger, #EF4444)', background:'none', cursor:'pointer' }}>
                                Revoke
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

            {/* Generate key */}
            <div className="card card-body">
              <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>Generate New Key</div>
              <div style={{ display:'flex', gap:8 }}>
                <input
                  className="input"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && generateKey()}
                  placeholder="Key name (e.g. Production, CI/CD)"
                  style={{ flex:1 }}
                />
                <button onClick={generateKey} disabled={!newKeyName.trim()} className="btn btn-primary btn-sm" style={{ flexShrink:0 }}>
                  Generate Key
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
