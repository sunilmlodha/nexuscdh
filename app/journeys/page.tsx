'use client';

import { useState, useEffect, useCallback } from 'react';
import { Route, Plus, Edit2, Trash2, X, ChevronDown, ChevronRight, Mail, MessageSquare, Bell, Monitor, Phone, Send } from 'lucide-react';

const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';

const INDUSTRIES = ['banking','insurance','retail','telecoms','healthcare','automotive','custom'] as const;
type Industry = typeof INDUSTRIES[number];

const JOURNEY_STATUSES = ['draft','active','paused','archived'];

const STATUS_COLORS: Record<string,string> = {
  draft:    'var(--text-muted)',
  active:   '#22c55e',
  paused:   '#f59e0b',
  archived: '#6b7280',
};

const INDUSTRY_COLORS: Record<string,string> = {
  banking:    '#3b82f6',
  insurance:  '#6366f1',
  retail:     '#f59e0b',
  telecoms:   '#22c55e',
  healthcare: '#ef4444',
  automotive: '#8b5cf6',
  custom:     '#6b7280',
};

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email:         <Mail size={11} />,
  sms:           <MessageSquare size={11} />,
  push:          <Bell size={11} />,
  in_app:        <Monitor size={11} />,
  outbound_call: <Phone size={11} />,
  direct_mail:   <Send size={11} />,
};

interface JourneyStage {
  id: string;
  name: string;
  day: number;
  channel: string;
  action_name: string;
  condition: string;
  wait_days: number;
  exit_on: string[];
}

interface Journey {
  id: string;
  name: string;
  description: string;
  industry: string;
  line_of_business: string;
  stages: JourneyStage[];
  status: string;
  template_id: string | null;
}

interface JourneyTemplate {
  id: string;
  name: string;
  industry: string;
  line_of_business: string;
  description: string;
  estimated_duration_days: number;
  stages: JourneyStage[];
}

const emptyJourney = (): Partial<Journey> => ({
  name: '', description: '', industry: 'banking', line_of_business: '', stages: [], status: 'draft',
});

export default function JourneysPage() {
  const [tab, setTab] = useState<'journeys'|'templates'>('journeys');

  const [journeys, setJourneys]     = useState<Journey[]>([]);
  const [templates, setTemplates]   = useState<JourneyTemplate[]>([]);
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState<Partial<Journey>>(emptyJourney());
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const fetchJourneys = useCallback(async () => {
    const res = await fetch(`/api/journeys?tenantId=${TENANT_ID}`);
    const json = await res.json();
    setJourneys(json.data ?? []);
  }, []);

  const fetchTemplates = useCallback(async () => {
    const res = await fetch('/api/journeys?templates=true');
    const json = await res.json();
    setTemplates(json.data ?? []);
  }, []);

  useEffect(() => { fetchJourneys(); fetchTemplates(); }, [fetchJourneys, fetchTemplates]);

  async function saveJourney() {
    if (!form.name?.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/journeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tenantId: TENANT_ID }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      setModal(false); setForm(emptyJourney()); fetchJourneys();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  async function deleteJourney(id: string) {
    if (!confirm('Delete this journey?')) return;
    await fetch(`/api/journeys?id=${id}&tenantId=${TENANT_ID}`, { method: 'DELETE' });
    fetchJourneys();
  }

  async function useTemplate(tpl: JourneyTemplate) {
    setSaving(true);
    try {
      const res = await fetch('/api/journeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: TENANT_ID,
          name: tpl.name,
          description: tpl.description,
          industry: tpl.industry,
          line_of_business: tpl.line_of_business,
          status: 'draft',
          from_template: true,
          template_id: tpl.id,
        }),
      });
      if (res.ok) { setTab('journeys'); fetchJourneys(); }
    } finally { setSaving(false); }
  }

  function openEdit(j: Journey) {
    setForm({ ...j }); setModal(true); setError('');
  }

  const filteredTemplates = industryFilter === 'all'
    ? templates
    : templates.filter(t => t.industry === industryFilter);

  const industryTemplates = form.industry
    ? templates.filter(t => t.industry === form.industry)
    : [];

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 28 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 12 }}>
          <Route size={24} color="var(--brand-accent)" />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Customer Journeys</h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Design multi-stage customer engagement journeys</p>
          </div>
        </div>
        {tab === 'journeys' && (
          <button
            onClick={() => { setError(''); setForm(emptyJourney()); setModal(true); }}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background:'var(--brand-accent)', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
            <Plus size={14} /> New Journey
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:24, borderBottom:'1px solid var(--border)' }}>
        {([['journeys','My Journeys'],['templates','Templates']] as const).map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:'8px 20px', border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
            background:'none', borderBottom: tab===t ? '2px solid var(--brand-accent)' : '2px solid transparent',
            color: tab===t ? 'var(--brand-accent)' : 'var(--text-muted)', marginBottom:-1,
          }}>{l}</button>
        ))}
      </div>

      {/* My Journeys Tab */}
      {tab === 'journeys' && (
        <div>
          {journeys.length === 0 ? (
            <div style={{ padding:48, textAlign:'center', color:'var(--text-muted)', fontSize:14, background:'var(--bg-panel)', border:'1px solid var(--border)', borderRadius:10 }}>
              No journeys yet. Create one or start from a template.
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {journeys.map(j => (
                <div key={j.id} style={{ background:'var(--bg-panel)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
                  <div
                    style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', cursor:'pointer' }}
                    onClick={() => setExpandedId(expandedId === j.id ? null : j.id)}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <ChevronRight size={14} style={{ transform: expandedId===j.id ? 'rotate(90deg)' : 'none', transition:'transform 0.15s', color:'var(--text-muted)' }} />
                      <div>
                        <div style={{ fontWeight:700, color:'var(--text-primary)', fontSize:15 }}>{j.name}</div>
                        <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
                          {j.line_of_business && <span>{j.line_of_business} · </span>}
                          {j.stages?.length ?? 0} stages
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      {j.industry && (
                        <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, background:`${INDUSTRY_COLORS[j.industry] ?? '#6b7280'}20`, color:INDUSTRY_COLORS[j.industry] ?? '#6b7280', textTransform:'capitalize' }}>{j.industry}</span>
                      )}
                      <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, background:`${STATUS_COLORS[j.status]}20`, color:STATUS_COLORS[j.status], textTransform:'capitalize' }}>{j.status}</span>
                      <button onClick={e => { e.stopPropagation(); openEdit(j); }} style={{ padding:4, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><Edit2 size={13} /></button>
                      <button onClick={e => { e.stopPropagation(); deleteJourney(j.id); }} style={{ padding:4, background:'none', border:'none', cursor:'pointer', color:'#ef4444' }}><Trash2 size={13} /></button>
                    </div>
                  </div>

                  {/* Stage Timeline */}
                  {expandedId === j.id && j.stages && j.stages.length > 0 && (
                    <div style={{ borderTop:'1px solid var(--border)', padding:'16px 20px', overflowX:'auto' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:0, minWidth:'max-content' }}>
                        {j.stages.map((stage, idx) => (
                          <div key={stage.id} style={{ display:'flex', alignItems:'center', gap:0 }}>
                            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, width:140 }}>
                              <div style={{ fontSize:10, fontWeight:600, color:'var(--brand-accent)' }}>Day {stage.day}</div>
                              <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 10px', width:'100%', boxSizing:'border-box' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
                                  <span style={{ color:'var(--brand-accent)' }}>{CHANNEL_ICONS[stage.channel] ?? <Send size={11} />}</span>
                                  <span style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', fontWeight:600 }}>{stage.channel}</span>
                                </div>
                                <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', marginBottom:3, lineHeight:1.3 }}>{stage.name}</div>
                                {stage.action_name && <div style={{ fontSize:10, color:'var(--text-secondary)', marginBottom:3 }}>{stage.action_name}</div>}
                                {stage.condition && <div style={{ fontSize:10, color:'var(--text-muted)', fontStyle:'italic' }}>if {stage.condition}</div>}
                              </div>
                            </div>
                            {idx < j.stages.length - 1 && (
                              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'0 4px', paddingTop:18 }}>
                                <div style={{ width:32, height:2, background:'var(--border)' }} />
                                {j.stages[idx+1].wait_days > 0 && (
                                  <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:3, whiteSpace:'nowrap' }}>+{j.stages[idx+1].wait_days}d</div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {expandedId === j.id && (!j.stages || j.stages.length === 0) && (
                    <div style={{ borderTop:'1px solid var(--border)', padding:'16px 20px', color:'var(--text-muted)', fontSize:13 }}>No stages defined for this journey.</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Templates Tab */}
      {tab === 'templates' && (
        <div>
          {/* Industry Filter Pills */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
            {(['all', ...INDUSTRIES] as const).map(ind => (
              <button key={ind} onClick={() => setIndustryFilter(ind)} style={{
                padding:'5px 14px', borderRadius:20, border:'1px solid var(--border)', cursor:'pointer', fontSize:12, fontWeight:600,
                background: industryFilter===ind ? 'var(--brand-accent)' : 'none',
                color: industryFilter===ind ? 'white' : 'var(--text-secondary)',
                textTransform:'capitalize',
              }}>{ind === 'all' ? 'All' : ind}</button>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:16 }}>
            {filteredTemplates.map(tpl => (
              <div key={tpl.id} style={{ background:'var(--bg-panel)', border:'1px solid var(--border)', borderRadius:10, padding:20, display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
                  <div style={{ flex:1 }}>
                    <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, background:`${INDUSTRY_COLORS[tpl.industry] ?? '#6b7280'}20`, color:INDUSTRY_COLORS[tpl.industry] ?? '#6b7280', textTransform:'capitalize', display:'inline-block', marginBottom:6 }}>{tpl.industry}</span>
                    <div style={{ fontWeight:700, color:'var(--text-primary)', fontSize:14 }}>{tpl.name}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4, lineHeight:1.5 }}>{tpl.description}</div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:16, fontSize:12, color:'var(--text-muted)' }}>
                  <span>{tpl.stages.length} stages</span>
                  <span>{tpl.estimated_duration_days} days</span>
                  <span style={{ color:'var(--text-secondary)' }}>{tpl.line_of_business}</span>
                </div>
                {/* Mini stage preview */}
                <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                  {tpl.stages.map(s => (
                    <span key={s.id} style={{ display:'flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:4, background:'rgba(0,0,0,0.05)', fontSize:10, color:'var(--text-secondary)' }}>
                      {CHANNEL_ICONS[s.channel] ?? <Send size={10} />} Day {s.day}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => useTemplate(tpl)}
                  disabled={saving}
                  style={{ padding:'7px 14px', borderRadius:6, border:'1px solid var(--brand-accent)', background:'none', color:'var(--brand-accent)', cursor:'pointer', fontSize:12, fontWeight:600, marginTop:'auto', opacity: saving ? 0.7 : 1 }}>
                  Use Template
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Journey Modal */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'var(--bg-panel)', border:'1px solid var(--border)', borderRadius:12, padding:28, width:'100%', maxWidth:600, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:'var(--text-primary)' }}>{form.id ? 'Edit Journey' : 'New Journey'}</h2>
              <button onClick={() => { setModal(false); setError(''); }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }}><X size={16} /></button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div style={{ gridColumn:'span 2' }}>
                <FieldLabel label="Name" required />
                <input value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ gridColumn:'span 2' }}>
                <FieldLabel label="Description" />
                <textarea value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ ...inputStyle, resize:'vertical' }} />
              </div>
              <div>
                <FieldLabel label="Industry" />
                <select value={form.industry ?? 'banking'} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} style={inputStyle}>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel label="Line of Business" />
                <input value={form.line_of_business ?? ''} onChange={e => setForm(f => ({ ...f, line_of_business: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <FieldLabel label="Status" />
                <select value={form.status ?? 'draft'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                  {JOURNEY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Template suggestions */}
            {!form.id && industryTemplates.length > 0 && (
              <div style={{ marginTop:20 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>Or start from a template</div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:180, overflowY:'auto' }}>
                  {industryTemplates.map(tpl => (
                    <button key={tpl.id} onClick={() => {
                      setForm(f => ({ ...f, name: f.name || tpl.name, description: f.description || tpl.description, line_of_business: f.line_of_business || tpl.line_of_business }));
                      useTemplate(tpl);
                      setModal(false);
                    }}
                      style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', cursor:'pointer', textAlign:'left' }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{tpl.name}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>{tpl.stages.length} stages · {tpl.estimated_duration_days} days</div>
                      </div>
                      <ChevronRight size={14} color="var(--text-muted)" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <div style={{ color:'#ef4444', fontSize:12, marginTop:8 }}>{error}</div>}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:20 }}>
              <button onClick={() => { setModal(false); setError(''); }} style={{ padding:'7px 16px', borderRadius:6, border:'1px solid var(--border)', background:'none', color:'var(--text-secondary)', cursor:'pointer', fontSize:13 }}>Cancel</button>
              <button onClick={saveJourney} disabled={saving} style={{ padding:'7px 16px', borderRadius:6, border:'none', background:'var(--brand-accent)', color:'white', cursor:'pointer', fontSize:13, fontWeight:600, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box',
};

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>
      {label}{required && <span style={{ color:'#ef4444' }}> *</span>}
    </label>
  );
}
