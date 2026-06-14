'use client';

import { useState } from 'react';
import { useAuth, ROLE_LABELS } from '@/lib/auth';
import { useStore, INDUSTRY_TEMPLATES } from '@/lib/store';
import { Save, CheckCircle2, Sun, Moon, Shield, Building2, Palette, Database } from 'lucide-react';

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

  const tabs = ['General', 'Appearance', 'Authentication', 'Data & Privacy'];
  const [tab, setTab] = useState('General');

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure your NexusCDH workspace, appearance, and access controls</p>
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
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {(['default','editorial'] as const).map(t => (
                <button key={t} onClick={() => updateAuthSettings({ theme: t })}
                  style={{ padding:'16px', border:`2px solid ${authSettings.theme===t?'var(--brand-accent)':'var(--border)'}`, borderRadius:10, cursor:'pointer', background:'white', textAlign:'left', transition:'border-color 0.15s' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    {t==='default' ? <Sun size={16} color={authSettings.theme===t?'var(--brand-accent)':'var(--text-muted)'}/> : <Moon size={16} color={authSettings.theme===t?'var(--brand-accent)':'var(--text-muted)'}/>}
                    <span style={{ fontWeight:700, fontSize:13, color: authSettings.theme===t?'var(--brand-accent)':'var(--text-primary)', textTransform:'capitalize' }}>{t}</span>
                    {authSettings.theme===t && <span className="badge badge-blue" style={{ marginLeft:'auto', fontSize:10 }}>Active</span>}
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.4 }}>
                    {t==='default' ? 'Clean, neutral. Standard enterprise interface.' : 'Editorial typographic style. Warm tones, high contrast. Premium feel.'}
                  </div>
                </button>
              ))}
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
      </div>
    </div>
  );
}
