'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Route, Users, ShieldCheck, Target, HeartHandshake, Clock, Scale, Mail, Trophy,
  ChevronRight, X, Plus, Trash2, Play, CheckCircle2, XCircle, Circle, Save,
  type LucideIcon,
} from 'lucide-react';

const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';
const OPS = ['=', '!=', '>=', '<=', '>', '<', 'IN', 'NOT IN'];
const panel: React.CSSProperties = { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12 };
const input: React.CSSProperties = { width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 };

interface Rule { attribute: string; op: string; value: string; }
interface Lever { id?: string; label: string; multiplier: number; condition?: Rule | null; enabled?: boolean; }
interface Strategy {
  id: string; name: string; status: string; arbitration: string;
  action_ids: string[]; policy_id?: string;
  eligibility_rules?: Rule[]; applicability_rules?: Rule[]; suitability_rules?: Rule[];
  context_weight?: number; business_levers?: Lever[]; control_group_pct?: number;
}
interface Breakdown { P: number; C: number; V: number; L: number; priority: number; actionName?: string; }
interface DecideResult {
  served: boolean; action?: { name: string }; suppressionReason?: string;
  engagementPolicy?: { layers: Array<{ layer: string; passed: boolean; rulesEvaluated: number; failedRule?: Rule }> };
  arbitration?: { winner: Breakdown; ranked: Breakdown[] };
}

type StageKey = 'audience' | 'eligibility' | 'applicability' | 'suitability' | 'contact' | 'arbitration' | 'treatment';
const STAGES: { key: StageKey; name: string; tag: string; icon: LucideIcon; editor: 'rules' | 'arbitration' | 'readonly' }[] = [
  { key: 'audience',      name: 'Audience',       tag: 'Scope',             icon: Users,          editor: 'readonly' },
  { key: 'eligibility',   name: 'Eligibility',    tag: 'Engagement policy', icon: ShieldCheck,    editor: 'rules' },
  { key: 'applicability', name: 'Applicability',  tag: 'Engagement policy', icon: Target,         editor: 'rules' },
  { key: 'suitability',   name: 'Suitability',    tag: 'Engagement policy', icon: HeartHandshake, editor: 'rules' },
  { key: 'contact',       name: 'Contact policy', tag: 'Constraint',        icon: Clock,          editor: 'readonly' },
  { key: 'arbitration',   name: 'Prioritization',    tag: 'Prioritise',        icon: Scale,          editor: 'arbitration' },
  { key: 'treatment',     name: 'Treatment',      tag: 'Deliver',           icon: Mail,           editor: 'readonly' },
];
const RULE_FIELD: Record<string, 'eligibility_rules' | 'applicability_rules' | 'suitability_rules'> = {
  eligibility: 'eligibility_rules', applicability: 'applicability_rules', suitability: 'suitability_rules',
};

export default function NbaDesignerPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [actions, setActions] = useState<{ id: string; name: string }[]>([]);
  const [policies, setPolicies] = useState<{ id: string; name: string }[]>([]);
  const [selId, setSelId] = useState('');
  const [draft, setDraft] = useState<Strategy | null>(null);
  const [openStage, setOpenStage] = useState<StageKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // test
  const [testCustomer, setTestCustomer] = useState('CUST-001');
  const [testAttrs, setTestAttrs] = useState('{\n  "age": 40,\n  "consentGiven": true,\n  "has_mortgage": true,\n  "has_home_insurance": false\n}');
  const [result, setResult] = useState<DecideResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [testErr, setTestErr] = useState('');

  const load = useCallback(async () => {
    const [s, h] = await Promise.all([
      fetch(`/api/strategies?tenantId=${TENANT_ID}`).then(r => r.json()),
      fetch(`/api/hydrate?tenantId=${TENANT_ID}`).then(r => r.json()),
    ]);
    const list: Strategy[] = s.data ?? [];
    setStrategies(list);
    setActions((h.actions ?? []).map((a: { id: string; name: string }) => ({ id: a.id, name: a.name })));
    setPolicies((h.policies ?? []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
    if (list.length && !selId) { setSelId(list[0].id); setDraft(structuredClone(list[0])); }
  }, [selId]);
  useEffect(() => { load(); }, [load]);

  function selectStrategy(id: string) {
    setSelId(id); const s = strategies.find(x => x.id === id); setDraft(s ? structuredClone(s) : null);
    setResult(null); setOpenStage(null);
  }

  async function save(patch: Partial<Strategy>) {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch('/api/strategies', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draft.id, name: draft.name, tenantId: TENANT_ID, changedBy: 'nba-designer', ...patch }),
      });
      if (res.ok) { setDraft(d => d ? { ...d, ...patch } : d); setSavedFlash(true); setTimeout(() => setSavedFlash(false), 2000); load(); }
    } finally { setSaving(false); }
  }

  async function runTest() {
    if (!draft) return;
    setTesting(true); setTestErr(''); setResult(null);
    let attributes: Record<string, unknown> = {};
    try { attributes = JSON.parse(testAttrs); } catch { setTestErr('Attributes must be valid JSON'); setTesting(false); return; }
    try {
      const res = await fetch('/api/decide', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: testCustomer, strategyId: draft.id, tenantId: TENANT_ID, attributes }),
      });
      const j = await res.json();
      if (!res.ok) { setTestErr(j.error || j.message || 'Decision failed'); return; }
      setResult(j);
    } catch (e: unknown) { setTestErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setTesting(false); }
  }

  // ── derive per-stage summary + status (config-time, and test-time when a result exists) ──
  function layer(k: StageKey) { return result?.engagementPolicy?.layers.find(l => l.layer === k); }
  function stageSummary(s: Strategy, key: StageKey): string {
    switch (key) {
      case 'audience': return `${s.action_ids?.length ?? 0} candidate actions`;
      case 'eligibility': return ruleSummary(s.eligibility_rules);
      case 'applicability': return ruleSummary(s.applicability_rules);
      case 'suitability': return ruleSummary(s.suitability_rules);
      case 'contact': return s.policy_id ? (policies.find(p => p.id === s.policy_id)?.name ?? 'Linked policy') : 'No policy (defaults)';
      case 'arbitration': return `P × C × V × L · C=${(s.context_weight ?? 1).toFixed(1)} · ${(s.business_levers ?? []).length} lever(s)${s.control_group_pct ? ` · ${Math.round(s.control_group_pct * 100)}% control` : ''}`;
      case 'treatment': return `${s.action_ids?.length ?? 0} action(s) → channel treatment`;
    }
  }
  function ruleSummary(r?: Rule[]) { return (r?.length ?? 0) === 0 ? 'No rules (always passes)' : `${r!.length} rule(s)`; }
  function configured(s: Strategy, key: StageKey): boolean {
    if (key === 'eligibility' || key === 'applicability' || key === 'suitability') return ((s[RULE_FIELD[key]] ?? []).length > 0) || key !== 'eligibility';
    return true;
  }
  // test-time status: pass / fail / not-reached / winner
  function testStatus(key: StageKey): 'pass' | 'fail' | 'idle' | 'winner' | 'na' {
    if (!result) return 'idle';
    const l = layer(key);
    if (l) return l.passed ? 'pass' : 'fail';
    if (key === 'audience') return 'pass';
    if (key === 'contact') return result.suppressionReason && /limit|consent|suppress/i.test(result.suppressionReason) ? 'fail' : 'pass';
    if (key === 'arbitration' || key === 'treatment') return result.served ? 'winner' : 'na';
    return 'idle';
  }

  if (!draft) {
    return (
      <div style={{ padding: '32px 36px', maxWidth: 1080, margin: '0 auto' }}>
        <Header strategies={strategies} selId={selId} onSelect={selectStrategy} />
        <div style={{ ...panel, padding: 48, textAlign: 'center', marginTop: 20, color: 'var(--text-muted)' }}>
          {strategies.length === 0 ? 'No strategies yet. Create one in Strategies, then design its NBA flow here.' : 'Select a scenario above.'}
        </div>
      </div>
    );
  }

  const winner = result?.arbitration?.winner;

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1080, margin: '0 auto' }}>
      <Header strategies={strategies} selId={selId} onSelect={selectStrategy} saving={saving} savedFlash={savedFlash} />

      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 20, alignItems: 'start', marginTop: 20 }}>
        {/* Funnel */}
        <div>
          <div style={{ ...panel, padding: '12px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Route size={18} color="var(--brand-accent)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{draft.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{draft.action_ids?.length ?? 0} candidate actions · {draft.status}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {STAGES.map(st => {
              const ts = testStatus(st.key);
              const dotColor = ts === 'fail' ? '#ef4444' : ts === 'winner' ? '#8b5cf6' : ts === 'pass' ? '#22c55e' : configured(draft, st.key) ? '#22c55e' : '#f59e0b';
              const Icon = st.icon;
              const l = layer(st.key);
              return (
                <div key={st.key} onClick={() => setOpenStage(st.key)}
                  style={{ ...panel, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', opacity: ts === 'idle' || ts === 'pass' || ts === 'winner' || !result ? 1 : ts === 'fail' ? 1 : 0.5, borderColor: ts === 'winner' ? '#8b5cf6' : ts === 'fail' ? '#ef4444' : 'var(--border)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                  <Icon size={18} color="var(--text-secondary)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{st.name}<span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}> · {st.tag}</span></div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {result && l && !l.passed ? <span style={{ color: '#ef4444' }}>failed: {l.failedRule?.attribute} {l.failedRule?.op} {l.failedRule?.value}</span> : stageSummary(draft, st.key)}
                    </div>
                  </div>
                  {result && (
                    <span style={{ flexShrink: 0 }}>
                      {ts === 'pass' ? <CheckCircle2 size={15} color="#22c55e" /> : ts === 'fail' ? <XCircle size={15} color="#ef4444" /> : ts === 'winner' ? <Trophy size={15} color="#8b5cf6" /> : <Circle size={13} color="var(--text-muted)" />}
                    </span>
                  )}
                  <ChevronRight size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                </div>
              );
            })}
          </div>

          {/* Winner */}
          {result && (
            <div style={{ ...panel, padding: '12px 16px', marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, borderLeft: `3px solid ${result.served ? '#8b5cf6' : '#ef4444'}` }}>
              {result.served ? <Trophy size={18} color="#8b5cf6" /> : <XCircle size={18} color="#ef4444" />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{result.served ? `Next best action — ${result.action?.name}` : 'No action served'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{result.served && winner ? `priority ${winner.priority.toFixed(0)} = P ${winner.P.toFixed(2)} × C ${winner.C.toFixed(1)} × V ${winner.V.toFixed(0)} × L ${winner.L.toFixed(1)}` : result.suppressionReason}</div>
              </div>
            </div>
          )}
        </div>

        {/* Test panel */}
        <div style={{ ...panel, padding: 18, position: 'sticky', top: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><Play size={15} color="var(--brand-accent)" /><span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Test a customer</span></div>
          <label style={lbl}>Customer ID</label>
          <input value={testCustomer} onChange={e => setTestCustomer(e.target.value)} style={input} />
          <label style={{ ...lbl, marginTop: 10 }}>Attributes (JSON)</label>
          <textarea value={testAttrs} onChange={e => setTestAttrs(e.target.value)} rows={6} style={{ ...input, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }} />
          <button onClick={runTest} disabled={testing} style={{ marginTop: 12, width: '100%', padding: 10, borderRadius: 8, background: 'var(--brand-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: testing ? 0.7 : 1 }}>{testing ? 'Running…' : 'Run through flow'}</button>
          {testErr && <div style={{ marginTop: 10, fontSize: 12, color: '#b91c1c' }}>{testErr}</div>}
          {result?.arbitration && result.arbitration.ranked.length > 1 && (
            <div style={{ marginTop: 14 }}>
              <div style={lbl}>Ranked candidates</div>
              {result.arbitration.ranked.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: i < result.arbitration!.ranked.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: i === 0 ? 700 : 400 }}>#{i + 1} {r.actionName}</span>
                  <span style={{ fontFamily: 'monospace', color: i === 0 ? 'var(--brand-accent)' : 'var(--text-muted)' }}>{r.priority.toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stage config drawer */}
      {openStage && (
        <StageDrawer
          stageKey={openStage} draft={draft} policies={policies} actions={actions}
          onClose={() => setOpenStage(null)} onSave={save} saving={saving}
        />
      )}
    </div>
  );
}

function Header({ strategies, selId, onSelect, saving, savedFlash }: { strategies: Strategy[]; selId: string; onSelect: (id: string) => void; saving?: boolean; savedFlash?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Route size={24} color="var(--brand-accent)" />
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>NBA Designer</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Configure a strategy as a decisioning funnel — click any stage to edit, then test a customer through it.</p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {savedFlash && <span style={{ fontSize: 12, color: '#16a34a' }}>✓ Saved</span>}
        {saving && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Saving…</span>}
        <select value={selId} onChange={e => onSelect(e.target.value)} style={{ ...input, minWidth: 240, padding: '8px 10px', width: 'auto' }}>
          {strategies.length === 0 && <option value="">No scenarios</option>}
          {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
    </div>
  );
}

function StageDrawer({ stageKey, draft, policies, actions, onClose, onSave, saving }: {
  stageKey: StageKey; draft: Strategy; policies: { id: string; name: string }[]; actions: { id: string; name: string }[];
  onClose: () => void; onSave: (patch: Partial<Strategy>) => void; saving: boolean;
}) {
  const meta = STAGES.find(s => s.key === stageKey)!;
  const [rules, setRules] = useState<Rule[]>(meta.editor === 'rules' ? [...(draft[RULE_FIELD[stageKey as 'eligibility']] ?? [])] : []);
  const [ctx, setCtx] = useState(draft.context_weight ?? 1);
  const [levers, setLevers] = useState<Lever[]>([...(draft.business_levers ?? [])]);
  const [control, setControl] = useState(draft.control_group_pct ?? 0);
  const [policyId, setPolicyId] = useState(draft.policy_id ?? '');

  function saveRules() { onSave({ [RULE_FIELD[stageKey as 'eligibility']]: rules } as Partial<Strategy>); onClose(); }
  function saveArb() { onSave({ context_weight: ctx, business_levers: levers, control_group_pct: control }); onClose(); }
  function savePolicy() { onSave({ policy_id: policyId || undefined }); onClose(); }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'flex-end', zIndex: 1100 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg-panel)', borderLeft: '1px solid var(--border)', width: '100%', maxWidth: 460, height: '100%', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{meta.name}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
        <p style={{ margin: '0 0 18px', fontSize: 12, color: 'var(--text-muted)' }}>{meta.tag}</p>

        {meta.editor === 'rules' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={lbl}>{meta.name} rules (all must pass)</span>
              <button onClick={() => setRules(r => [...r, { attribute: '', op: '=', value: '' }])} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--brand-accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}><Plus size={12} /> rule</button>
            </div>
            {rules.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 10 }}>No rules — this gate always passes.</div>}
            {rules.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input value={r.attribute} onChange={e => { const n = [...rules]; n[i] = { ...r, attribute: e.target.value }; setRules(n); }} placeholder="attribute" style={{ ...input, flex: 1 }} />
                <select value={r.op} onChange={e => { const n = [...rules]; n[i] = { ...r, op: e.target.value }; setRules(n); }} style={{ ...input, width: 64 }}>{OPS.map(o => <option key={o}>{o}</option>)}</select>
                <input value={r.value} onChange={e => { const n = [...rules]; n[i] = { ...r, value: e.target.value }; setRules(n); }} placeholder="value" style={{ ...input, flex: 1 }} />
                <button onClick={() => setRules(rules.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={13} /></button>
              </div>
            ))}
            <DrawerSave onSave={saveRules} saving={saving} />
          </>
        )}

        {meta.editor === 'arbitration' && (
          <>
            <label style={lbl}>Context weight (C): {ctx.toFixed(1)}×</label>
            <input type="range" min={0} max={2} step={0.1} value={ctx} onChange={e => setCtx(Number(e.target.value))} style={{ width: '100%' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 8px' }}>
              <span style={lbl}>Business levers (L)</span>
              <button onClick={() => setLevers(l => [...l, { label: 'New lever', multiplier: 1.5, enabled: true, condition: null }])} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--brand-accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}><Plus size={12} /> lever</button>
            </div>
            {levers.map((lev, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                <input value={lev.label} onChange={e => { const n = [...levers]; n[i] = { ...lev, label: e.target.value }; setLevers(n); }} style={{ ...input, flex: 1 }} />
                <input type="number" step={0.1} value={lev.multiplier} onChange={e => { const n = [...levers]; n[i] = { ...lev, multiplier: Number(e.target.value) }; setLevers(n); }} style={{ ...input, width: 64 }} />
                <button onClick={() => setLevers(levers.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={13} /></button>
              </div>
            ))}
            <label style={{ ...lbl, marginTop: 16 }}>Control group hold-out: {Math.round(control * 100)}%</label>
            <input type="range" min={0} max={0.5} step={0.05} value={control} onChange={e => setControl(Number(e.target.value))} style={{ width: '100%' }} />
            <DrawerSave onSave={saveArb} saving={saving} />
          </>
        )}

        {stageKey === 'contact' && (
          <>
            <label style={lbl}>Contact policy</label>
            <select value={policyId} onChange={e => setPolicyId(e.target.value)} style={input}>
              <option value="">— defaults (2/day, 5/week) —</option>
              {policies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Frequency caps and suppression rules are managed in Decision Guardrails.</p>
            <DrawerSave onSave={savePolicy} saving={saving} />
          </>
        )}

        {stageKey === 'audience' && (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>This scenario evaluates its <strong>{draft.action_ids?.length ?? 0}</strong> candidate action(s) for everyone who reaches it. Audience scoping (segments) is managed in Audiences; bind them on the Strategies page.</p>
        )}
        {stageKey === 'treatment' && (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>The winning action is delivered via its channel-specific treatment (managed in Treatments &amp; Bundles). Candidate actions in this scenario:</p>
            {(draft.action_ids ?? []).map(id => <div key={id} style={{ fontSize: 13, padding: '6px 10px', background: 'var(--bg)', borderRadius: 6, marginBottom: 4, color: 'var(--text-primary)' }}>{actions.find(a => a.id === id)?.name ?? id.slice(0, 8)}</div>)}
          </>
        )}
      </div>
    </div>
  );
}

function DrawerSave({ onSave, saving }: { onSave: () => void; saving: boolean }) {
  return (
    <button onClick={onSave} disabled={saving} style={{ marginTop: 20, width: '100%', padding: 10, borderRadius: 8, background: 'var(--brand-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
      <Save size={14} /> {saving ? 'Saving…' : 'Save stage'}
    </button>
  );
}
