'use client';

import { useState, useEffect, useCallback } from 'react';
import { Route, Plus, Edit2, Trash2, X, ChevronRight, Mail, MessageSquare, Bell, Monitor, Phone, Send, History, UserPlus, Play, FastForward } from 'lucide-react';
import { AuditDrawer, ConfirmDialog } from '../components/AuditDrawer';

const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';

const INDUSTRIES = ['banking','insurance','retail','telecoms','healthcare','automotive','custom'] as const;
type Industry = typeof INDUSTRIES[number];

const JOURNEY_STATUSES = ['draft','active','paused','archived'];
const STAGE_CHANNELS = ['email','sms','push','in_app','outbound_call','direct_mail'];

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
  action_id?: string;
  action_name: string;
  treatment_id?: string;
  condition: string;
  wait_days: number;
  exit_on: string[];
}

interface ActionRef { id: string; name: string; channels: string[]; }
interface TreatmentRef { id: string; name: string; action_id: string | null; channel: string; variant_label: string; }

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
  const [actions, setActions]       = useState<ActionRef[]>([]);
  const [treatments, setTreatments] = useState<TreatmentRef[]>([]);
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState<Partial<Journey>>(emptyJourney());
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const [audit, setAudit]     = useState<{ id?: string; name: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ id: string; name: string } | null>(null);

  const [enrollCounts, setEnrollCounts] = useState<Record<string, { active: number; completed: number; exited: number }>>({});
  const [enrollFor, setEnrollFor] = useState<{ id: string; name: string } | null>(null);
  const [enrollIds, setEnrollIds] = useState('');
  const [enrollBusy, setEnrollBusy] = useState(false);
  const [worker, setWorker] = useState<string>('');

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

  const fetchActions = useCallback(async () => {
    try {
      const res = await fetch(`/api/hydrate?tenantId=${TENANT_ID}`);
      const json = await res.json();
      setActions((json.actions ?? []).map((a: { id: string; name: string; channels?: string[] }) => ({ id: a.id, name: a.name, channels: a.channels ?? [] })));
    } catch { /* non-fatal */ }
  }, []);

  const fetchTreatments = useCallback(async () => {
    try {
      const res = await fetch(`/api/treatments?tenantId=${TENANT_ID}`);
      const json = await res.json();
      setTreatments((json.data ?? []).map((t: { id: string; name: string; action_id: string | null; channel: string; variant_label: string }) =>
        ({ id: t.id, name: t.name, action_id: t.action_id, channel: t.channel, variant_label: t.variant_label })));
    } catch { /* non-fatal */ }
  }, []);

  const fetchEnrollCounts = useCallback(async () => {
    try {
      const res = await fetch(`/api/journeys/enroll?tenantId=${TENANT_ID}`);
      const json = await res.json();
      setEnrollCounts(json.counts ?? {});
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { fetchJourneys(); fetchTemplates(); fetchActions(); fetchTreatments(); fetchEnrollCounts(); }, [fetchJourneys, fetchTemplates, fetchActions, fetchTreatments, fetchEnrollCounts]);

  async function enrollCustomers() {
    if (!enrollFor) return;
    setEnrollBusy(true);
    const ids = enrollIds.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
    try {
      const res = await fetch('/api/journeys/enroll', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journeyId: enrollFor.id, tenantId: TENANT_ID, customerIds: ids, audienceRules: [] }),
      });
      const j = await res.json();
      setWorker(res.ok ? `Enrolled ${j.enrolled} of ${j.targeted} into "${enrollFor.name}"` : (j.error ?? 'Enroll failed'));
      setEnrollFor(null); setEnrollIds(''); fetchEnrollCounts();
    } finally { setEnrollBusy(false); }
  }

  async function runWorker(fastForward: boolean) {
    setWorker('Running worker…');
    try {
      const res = await fetch(`/api/journeys/tick?tenantId=${TENANT_ID}${fastForward ? '&fastForward=true' : ''}`, { method: 'POST' });
      const j = await res.json();
      setWorker(res.ok
        ? `Worker: ${j.processed} processed · ${j.stagesFired} stages fired · ${j.completed} completed · ${j.exited} exited`
        : (j.error ?? 'Worker failed'));
      fetchEnrollCounts();
    } catch (e: unknown) { setWorker(e instanceof Error ? e.message : 'Worker failed'); }
  }

  // ── Stage editing helpers ─────────────────────────────────────────────────
  const newStage = (): JourneyStage => ({ id: `s${Date.now()}`, name: '', day: 0, channel: 'email', action_id: undefined, action_name: '', treatment_id: undefined, condition: '', wait_days: 0, exit_on: [] });

  function updateStage(idx: number, patch: Partial<JourneyStage>) {
    setForm(f => {
      const stages = [...(f.stages ?? [])];
      stages[idx] = { ...stages[idx], ...patch };
      return { ...f, stages };
    });
  }
  function addStage() { setForm(f => ({ ...f, stages: [...(f.stages ?? []), newStage()] })); }
  function removeStage(idx: number) { setForm(f => ({ ...f, stages: (f.stages ?? []).filter((_, i) => i !== idx) })); }
  function moveStage(idx: number, dir: -1 | 1) {
    setForm(f => {
      const stages = [...(f.stages ?? [])];
      const j = idx + dir;
      if (j < 0 || j >= stages.length) return f;
      [stages[idx], stages[j]] = [stages[j], stages[idx]];
      return { ...f, stages };
    });
  }

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
    await fetch(`/api/journeys?id=${id}&tenantId=${TENANT_ID}`, { method: 'DELETE' });
    setConfirmDel(null);
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
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => runWorker(false)} title="Process stages due now (as the daily cron does)"
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:'none', color:'var(--text-primary)', border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
              <Play size={13} /> Run Worker
            </button>
            <button onClick={() => runWorker(true)} title="Fast-forward: run all active enrolments to completion now (testing)"
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:'none', color:'var(--text-primary)', border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
              <FastForward size={13} /> Fast-forward
            </button>
            <button
              onClick={() => { setError(''); setForm(emptyJourney()); setModal(true); }}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background:'var(--brand-accent)', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
              <Plus size={14} /> New Journey
            </button>
          </div>
        )}
      </div>

      {worker && (
        <div style={{ background:'var(--bg-panel)', border:'1px solid var(--border)', borderLeft:'3px solid var(--brand-accent)', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13, color:'var(--text-secondary)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>{worker}</span>
          <button onClick={() => setWorker('')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={14} /></button>
        </div>
      )}

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
                      {enrollCounts[j.id] && (
                        <span title="active / completed / exited enrolments" style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, background:'rgba(34,197,94,0.12)', color:'#16a34a' }}>
                          {enrollCounts[j.id].active}▶ · {enrollCounts[j.id].completed}✓ · {enrollCounts[j.id].exited}⤬
                        </span>
                      )}
                      <button onClick={e => { e.stopPropagation(); setEnrollFor({ id:j.id, name:j.name }); setEnrollIds(''); }} title="Enroll customers" style={{ padding:4, background:'none', border:'none', cursor:'pointer', color:'var(--brand-accent)' }}><UserPlus size={14} /></button>
                      <button onClick={e => { e.stopPropagation(); setAudit({ id:j.id, name:j.name }); }} title="Audit history" style={{ padding:4, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><History size={13} /></button>
                      <button onClick={e => { e.stopPropagation(); openEdit(j); }} title="Edit" style={{ padding:4, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><Edit2 size={13} /></button>
                      <button onClick={e => { e.stopPropagation(); setConfirmDel({ id:j.id, name:j.name }); }} title="Delete" style={{ padding:4, background:'none', border:'none', cursor:'pointer', color:'#ef4444' }}><Trash2 size={13} /></button>
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
          <div style={{ background:'var(--bg-panel)', border:'1px solid var(--border)', borderRadius:12, padding:28, width:'100%', maxWidth:780, maxHeight:'90vh', overflowY:'auto' }}>
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

            {/* Stage editor */}
            <div style={{ marginTop:22 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Stages ({form.stages?.length ?? 0})</div>
                <button onClick={addStage} style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px', borderRadius:6, border:'1px solid var(--border)', background:'none', color:'var(--brand-accent)', cursor:'pointer', fontSize:12, fontWeight:600 }}><Plus size={12} /> Add stage</button>
              </div>
              {(form.stages ?? []).length === 0 ? (
                <div style={{ fontSize:12, color:'var(--text-muted)', fontStyle:'italic', padding:'8px 0' }}>No stages yet. Add stages, or start from a template below.</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {(form.stages ?? []).map((stage, idx) => {
                    const stageTreatments = treatments.filter(t => t.action_id === stage.action_id && (t.channel === stage.channel || !t.channel));
                    return (
                      <div key={stage.id ?? idx} style={{ border:'1px solid var(--border)', borderRadius:8, padding:12, background:'var(--bg)' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                          <span style={{ width:22, height:22, borderRadius:'50%', background:'rgba(99,102,241,0.12)', color:'var(--brand-accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>{idx+1}</span>
                          <input value={stage.name} onChange={e => updateStage(idx, { name: e.target.value })} placeholder="Stage name (e.g. Welcome Email)" style={{ ...inputStyle, flex:1 }} />
                          <button onClick={() => moveStage(idx, -1)} disabled={idx===0} style={miniBtn(idx===0)}>↑</button>
                          <button onClick={() => moveStage(idx, 1)} disabled={idx===(form.stages?.length ?? 0)-1} style={miniBtn(idx===(form.stages?.length ?? 0)-1)}>↓</button>
                          <button onClick={() => removeStage(idx)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', padding:2 }}><Trash2 size={13} /></button>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8 }}>
                          <div>
                            <FieldLabel label="Day" />
                            <input type="number" value={stage.day} onChange={e => updateStage(idx, { day: Number(e.target.value) })} style={inputStyle} />
                          </div>
                          <div>
                            <FieldLabel label="Channel" />
                            <select value={stage.channel} onChange={e => updateStage(idx, { channel: e.target.value, treatment_id: undefined })} style={inputStyle}>
                              {STAGE_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div>
                            <FieldLabel label="Action" />
                            <select value={stage.action_id ?? ''} onChange={e => {
                              const a = actions.find(x => x.id === e.target.value);
                              updateStage(idx, { action_id: e.target.value || undefined, action_name: a?.name ?? '', treatment_id: undefined });
                            }} style={inputStyle}>
                              <option value="">— Arbitrate (any eligible) —</option>
                              {actions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <FieldLabel label="Treatment" />
                            <select value={stage.treatment_id ?? ''} onChange={e => updateStage(idx, { treatment_id: e.target.value || undefined })} style={inputStyle} disabled={!stage.action_id}>
                              <option value="">{stage.action_id ? 'Auto (by channel)' : 'Select an action first'}</option>
                              {stageTreatments.map(t => <option key={t.id} value={t.id}>{t.name}{t.variant_label ? ` (${t.variant_label})` : ''}</option>)}
                            </select>
                          </div>
                          <div>
                            <FieldLabel label="Condition" />
                            <input value={stage.condition} onChange={e => updateStage(idx, { condition: e.target.value })} placeholder="e.g. first_deposit = false" style={inputStyle} />
                          </div>
                          <div>
                            <FieldLabel label="Wait days (to next)" />
                            <input type="number" value={stage.wait_days} onChange={e => updateStage(idx, { wait_days: Number(e.target.value) })} style={inputStyle} />
                          </div>
                          <div style={{ gridColumn:'span 2' }}>
                            <FieldLabel label="Exit on (comma-separated events)" />
                            <input value={(stage.exit_on ?? []).join(', ')} onChange={e => updateStage(idx, { exit_on: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="converted, opted_out" style={inputStyle} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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

      {/* Enroll Modal */}
      {enrollFor && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }} onClick={e => e.target === e.currentTarget && setEnrollFor(null)}>
          <div style={{ background:'var(--bg-panel)', border:'1px solid var(--border)', borderRadius:12, padding:26, width:460, maxWidth:'92vw' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:'var(--text-primary)' }}>Enroll into “{enrollFor.name}”</h2>
              <button onClick={() => setEnrollFor(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:5 }}>Customer IDs</label>
            <textarea value={enrollIds} onChange={e => setEnrollIds(e.target.value)} rows={3} placeholder="CUST-001, CUST-002 …  (leave blank to enroll all customers)" style={{ ...inputStyle, resize:'vertical', fontFamily:'monospace', fontSize:12 }} />
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>Stage 1 becomes due at its Day offset from enrollment. Use “Fast-forward” to run immediately.</div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:18 }}>
              <button onClick={() => setEnrollFor(null)} style={{ padding:'7px 16px', borderRadius:6, border:'1px solid var(--border)', background:'none', color:'var(--text-secondary)', cursor:'pointer', fontSize:13 }}>Cancel</button>
              <button onClick={enrollCustomers} disabled={enrollBusy} style={{ padding:'7px 16px', borderRadius:6, border:'none', background:'var(--brand-accent)', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, opacity: enrollBusy ? 0.6 : 1 }}>{enrollBusy ? 'Enrolling…' : 'Enroll'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Audit History Drawer */}
      {audit && (
        <AuditDrawer entityType="journey" entityId={audit.id} entityName={audit.name} onClose={() => setAudit(null)} />
      )}

      {/* Delete Confirmation */}
      {confirmDel && (
        <ConfirmDialog
          title="Delete journey?"
          message={`"${confirmDel.name}" will be archived and removed from active lists. This action is recorded in the audit log.`}
          onConfirm={() => deleteJourney(confirmDel.id)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box',
};

function miniBtn(disabled: boolean): React.CSSProperties {
  return { width:26, height:26, borderRadius:6, border:'1px solid var(--border)', background:'none', color:'var(--text-muted)', cursor: disabled ? 'not-allowed' : 'pointer', fontSize:13, opacity: disabled ? 0.4 : 1, flexShrink:0 };
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>
      {label}{required && <span style={{ color:'#ef4444' }}> *</span>}
    </label>
  );
}
