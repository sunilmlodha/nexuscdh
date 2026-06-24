'use client';

import { useState, useEffect, useCallback } from 'react';
import { Scale, Plus, Trash2, Save, Play, Shield, CheckCircle2, XCircle, Zap, ChevronRight } from 'lucide-react';

const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';
const OPS = ['=', '!=', '>=', '<=', '>', '<', 'IN', 'NOT IN'];

interface Rule { attribute: string; op: string; value: string; }
interface Lever { id?: string; label: string; multiplier: number; condition?: Rule | null; enabled?: boolean; }

interface Strategy {
  id: string;
  name: string;
  arbitration: string;
  eligibility_rules?: Rule[];
  applicability_rules?: Rule[];
  suitability_rules?: Rule[];
  context_weight?: number;
  business_levers?: Lever[];
  control_group_pct?: number;
}

interface Breakdown { P: number; C: number; V: number; L: number; priority: number; appliedLevers: string[]; actionId?: string; actionName?: string; strategyName?: string; }
interface DecideResult {
  served: boolean;
  action?: { name: string; headline?: string };
  suppressionReason?: string;
  arbitration?: { formula: string; winner: Breakdown; ranked: Breakdown[] };
  engagementPolicy?: { passed: boolean; failedLayer?: string; layers: Array<{ layer: string; passed: boolean; rulesEvaluated: number; failedRule?: Rule }> };
  trace?: Array<{ step: string; outcome: string }>;
}

const LAYER_META: Record<string, { label: string; desc: string; color: string }> = {
  eligibility:   { label: 'Eligibility',   desc: 'Can we ever offer this? (hard rules)',          color: '#ef4444' },
  applicability: { label: 'Applicability', desc: 'Is it relevant right now? (situational)',        color: '#f59e0b' },
  suitability:   { label: 'Suitability',   desc: 'Is it right for the customer? (their interest)', color: '#22c55e' },
};

const panel: React.CSSProperties = { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12 };
const input: React.CSSProperties = { padding: '6px 9px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 12, boxSizing: 'border-box' };

export default function ArbitrationPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selId, setSelId] = useState<string>('');
  const [draft, setDraft] = useState<Strategy | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  // tester
  const [testCustomer, setTestCustomer] = useState('CUST-001');
  const [testAttrs, setTestAttrs] = useState('{\n  "age": 34,\n  "income_band": "high",\n  "consentGiven": true\n}');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<DecideResult | null>(null);
  const [testError, setTestError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/strategies?tenantId=${TENANT_ID}`);
    const json = await res.json();
    setConfigured(json.configured !== false);
    const list: Strategy[] = json.data ?? [];
    setStrategies(list);
    if (list.length && !selId) { setSelId(list[0].id); setDraft(structuredClone(list[0])); }
  }, [selId]);

  useEffect(() => { load(); }, [load]);

  function selectStrategy(id: string) {
    setSelId(id);
    const s = strategies.find(x => x.id === id);
    setDraft(s ? structuredClone(s) : null);
    setResult(null);
  }

  function patchLayer(layer: 'applicability_rules' | 'suitability_rules', rules: Rule[]) {
    setDraft(d => d ? { ...d, [layer]: rules } : d);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch('/api/strategies', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: draft.id, name: draft.name, tenantId: TENANT_ID, changedBy: 'arbitration-ui',
          applicability_rules: draft.applicability_rules ?? [],
          suitability_rules:   draft.suitability_rules ?? [],
          context_weight:      draft.context_weight ?? 1,
          business_levers:     draft.business_levers ?? [],
          control_group_pct:   draft.control_group_pct ?? 0,
        }),
      });
      if (res.ok) { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 2500); load(); }
    } finally { setSaving(false); }
  }

  async function runTest() {
    if (!draft) return;
    setTesting(true); setTestError(''); setResult(null);
    let attributes: Record<string, unknown> = {};
    try { attributes = JSON.parse(testAttrs); } catch { setTestError('Attributes must be valid JSON'); setTesting(false); return; }
    try {
      const res = await fetch('/api/decide', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: testCustomer, strategyId: draft.id, tenantId: TENANT_ID, attributes }),
      });
      const json = await res.json();
      if (!res.ok) { setTestError(json.error || json.message || 'Decision failed'); return; }
      setResult(json);
    } catch (e: unknown) {
      setTestError(e instanceof Error ? e.message : 'Request failed');
    } finally { setTesting(false); }
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Scale size={24} color="var(--brand-accent)" />
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Prioritization &amp; Decision Guardrails</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Configure the four engagement-policy layers and the <strong>Priority = P × C × V × L</strong> arbitration formula, then test why an action wins.</p>
        </div>
      </div>

      {/* Formula banner */}
      <div style={{ ...panel, padding: '14px 20px', margin: '18px 0 24px', display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        {[
          { k: 'P', label: 'Propensity', desc: 'Likelihood to accept', color: '#3b82f6' },
          { k: 'C', label: 'Context', desc: 'Situational weight', color: '#8b5cf6' },
          { k: 'V', label: 'Value', desc: 'Expected business value', color: '#22c55e' },
          { k: 'L', label: 'Levers', desc: 'Strategic boosts', color: '#f59e0b' },
        ].map((f, i) => (
          <div key={f.k} style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: `${f.color}22`, color: f.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>{f.k}</div>
              <div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{f.label}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.desc}</div></div>
            </div>
            {i < 3 && <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-muted)' }}>×</span>}
          </div>
        ))}
      </div>

      {configured === false && (
        <div style={{ ...panel, padding: 16, marginBottom: 20, borderLeft: '3px solid #f59e0b', fontSize: 13, color: 'var(--text-secondary)' }}>
          Supabase isn’t configured — strategies can’t be loaded or tested. The formula and editor still illustrate the model.
        </div>
      )}

      {/* Strategy selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Strategy</span>
        <select value={selId} onChange={e => selectStrategy(e.target.value)} style={{ ...input, fontSize: 13, minWidth: 280, padding: '8px 10px' }}>
          {strategies.length === 0 && <option value="">No strategies found</option>}
          {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {draft && (
          <button onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'var(--brand-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
            <Save size={14} /> {saving ? 'Saving…' : savedFlash ? '✓ Saved' : 'Save Configuration'}
          </button>
        )}
      </div>

      {!draft && (
        <div style={{ ...panel, padding: 48, textAlign: 'center' }}>
          <Scale size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No strategies to arbitrate yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 460, margin: '0 auto' }}>
            Create a strategy first (Workspace → Strategies). Once you have one, select it here to configure its engagement-policy layers and P × C × V × L arbitration, then test why an action wins.
            {configured === true && strategies.length === 0 && ' (If you expected strategies here, the database may be unreachable — check your Supabase connection.)'}
          </div>
        </div>
      )}

      {draft && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          {/* LEFT — configuration */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Engagement policy layers */}
            <div style={{ ...panel, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Shield size={16} color="var(--brand-accent)" />
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Engagement Policies</span>
              </div>
              <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text-muted)' }}>Four ordered gates. An action must clear all to enter arbitration.</p>

              {/* Eligibility (read-only — managed on the strategy/taxonomy) */}
              <LayerEditor layer="eligibility" rules={draft.eligibility_rules ?? []} readOnly
                onChange={() => {}} note="Managed in the Strategy editor" />
              <LayerEditor layer="applicability" rules={draft.applicability_rules ?? []}
                onChange={(r) => patchLayer('applicability_rules', r)} />
              <LayerEditor layer="suitability" rules={draft.suitability_rules ?? []}
                onChange={(r) => patchLayer('suitability_rules', r)} />

              <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
                <strong style={{ color: 'var(--text-secondary)' }}>Contact Policy</strong> (frequency &amp; suppression) is enforced separately on the Engagement Policies page.
              </div>
            </div>

            {/* Context weight */}
            <div style={{ ...panel, padding: 20 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Context Weight (C)</div>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' }}>Situational multiplier applied to every action in this strategy.</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <input type="range" min={0} max={2} step={0.1} value={draft.context_weight ?? 1}
                  onChange={e => setDraft(d => d ? { ...d, context_weight: Number(e.target.value) } : d)} style={{ flex: 1 }} />
                <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: 'var(--brand-accent)', minWidth: 38, textAlign: 'right' }}>{(draft.context_weight ?? 1).toFixed(1)}×</span>
              </div>
            </div>

            {/* Control group */}
            <div style={{ ...panel, padding: 20 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Control Group (hold-out)</div>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' }}>Randomly withhold this fraction of customers (deterministic per customer) to measure lift against a no-action baseline.</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <input type="range" min={0} max={0.5} step={0.05} value={draft.control_group_pct ?? 0}
                  onChange={e => setDraft(d => d ? { ...d, control_group_pct: Number(e.target.value) } : d)} style={{ flex: 1 }} />
                <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#f59e0b', minWidth: 44, textAlign: 'right' }}>{Math.round((draft.control_group_pct ?? 0) * 100)}%</span>
              </div>
            </div>

            {/* Business levers */}
            <div style={{ ...panel, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Zap size={16} color="#f59e0b" /><span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Business Levers (L)</span></div>
                <button onClick={() => setDraft(d => d ? { ...d, business_levers: [...(d.business_levers ?? []), { label: 'New lever', multiplier: 1.5, enabled: true, condition: null }] } : d)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--brand-accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}><Plus size={12} /> Add lever</button>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' }}>Manual strategic boosts — e.g. “push mortgages this quarter”. Multipliers stack.</p>
              {(draft.business_levers ?? []).length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>No levers — every action gets L = 1.0</div>
              ) : (draft.business_levers ?? []).map((lev, i) => (
                <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 10, background: 'var(--bg)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <input value={lev.label} onChange={e => updateLever(setDraft, i, { label: e.target.value })} placeholder="Lever name" style={{ ...input, flex: 1 }} />
                    <input type="number" step={0.1} value={lev.multiplier} onChange={e => updateLever(setDraft, i, { multiplier: Number(e.target.value) })} style={{ ...input, width: 70 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>×</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                      <input type="checkbox" checked={lev.enabled !== false} onChange={e => updateLever(setDraft, i, { enabled: e.target.checked })} /> on
                    </label>
                    <button onClick={() => setDraft(d => d ? { ...d, business_levers: (d.business_levers ?? []).filter((_, j) => j !== i) } : d)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}><Trash2 size={13} /></button>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 60 }}>when (opt.)</span>
                    <input value={lev.condition?.attribute ?? ''} onChange={e => updateLever(setDraft, i, { condition: { ...(lev.condition ?? { op: '=', value: '' }), attribute: e.target.value } as Rule })} placeholder="attribute" style={{ ...input, flex: 1 }} />
                    <select value={lev.condition?.op ?? '='} onChange={e => updateLever(setDraft, i, { condition: { ...(lev.condition ?? { attribute: '', value: '' }), op: e.target.value } as Rule })} style={{ ...input, width: 64 }}>{OPS.map(o => <option key={o}>{o}</option>)}</select>
                    <input value={lev.condition?.value ?? ''} onChange={e => updateLever(setDraft, i, { condition: { ...(lev.condition ?? { attribute: '', op: '=' }), value: e.target.value } as Rule })} placeholder="value" style={{ ...input, flex: 1 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — explainability tester */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 24 }}>
            <div style={{ ...panel, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}><Play size={16} color="var(--brand-accent)" /><span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Why This Action? — Tester</span></div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={miniLabel}>Customer ID</label>
                  <input value={testCustomer} onChange={e => setTestCustomer(e.target.value)} style={{ ...input, width: '100%', padding: '8px 10px', fontSize: 13 }} />
                </div>
              </div>
              <label style={miniLabel}>Attributes (JSON, overrides profile)</label>
              <textarea value={testAttrs} onChange={e => setTestAttrs(e.target.value)} rows={5} style={{ ...input, width: '100%', fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }} />
              <button onClick={runTest} disabled={testing} style={{ marginTop: 12, width: '100%', padding: 10, borderRadius: 8, background: 'var(--brand-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: testing ? 0.7 : 1 }}>{testing ? 'Running decision…' : 'Run Decision'}</button>
              {testError && <div style={{ marginTop: 10, fontSize: 12, color: '#b91c1c' }}>{testError}</div>}
            </div>

            {result && <ResultPanel result={result} />}
          </div>
        </div>
      )}
    </div>
  );
}

function updateLever(setDraft: React.Dispatch<React.SetStateAction<Strategy | null>>, i: number, patch: Partial<Lever>) {
  setDraft(d => {
    if (!d) return d;
    const levers = [...(d.business_levers ?? [])];
    levers[i] = { ...levers[i], ...patch };
    return { ...d, business_levers: levers };
  });
}

function LayerEditor({ layer, rules, onChange, readOnly, note }: { layer: string; rules: Rule[]; onChange: (r: Rule[]) => void; readOnly?: boolean; note?: string }) {
  const meta = LAYER_META[layer];
  return (
    <div style={{ marginBottom: 14, paddingLeft: 12, borderLeft: `3px solid ${meta.color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{meta.label}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{meta.desc}</span>
        </div>
        {!readOnly && (
          <button onClick={() => onChange([...rules, { attribute: '', op: '=', value: '' }])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-accent)', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}><Plus size={11} /> rule</button>
        )}
      </div>
      {readOnly && note && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 4 }}>{note}{rules.length ? ` · ${rules.length} rule(s)` : ' · none'}</div>}
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rules.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input disabled={readOnly} value={r.attribute} onChange={e => { const n = [...rules]; n[i] = { ...r, attribute: e.target.value }; onChange(n); }} placeholder="attribute" style={{ ...input, flex: 1, opacity: readOnly ? 0.6 : 1 }} />
            <select disabled={readOnly} value={r.op} onChange={e => { const n = [...rules]; n[i] = { ...r, op: e.target.value }; onChange(n); }} style={{ ...input, width: 64, opacity: readOnly ? 0.6 : 1 }}>{OPS.map(o => <option key={o}>{o}</option>)}</select>
            <input disabled={readOnly} value={r.value} onChange={e => { const n = [...rules]; n[i] = { ...r, value: e.target.value }; onChange(n); }} placeholder="value" style={{ ...input, flex: 1, opacity: readOnly ? 0.6 : 1 }} />
            {!readOnly && <button onClick={() => onChange(rules.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}><Trash2 size={12} /></button>}
          </div>
        ))}
      </div>
    </div>
  );
}

const miniLabel: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 };

function ResultPanel({ result }: { result: DecideResult }) {
  const b = result.arbitration?.winner;
  return (
    <div style={{ ...panel, padding: 20 }}>
      {/* Outcome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        {result.served ? <CheckCircle2 size={20} color="#22c55e" /> : <XCircle size={20} color="#ef4444" />}
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{result.served ? result.action?.name : 'No action served'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{result.served ? (result.action?.headline ?? 'Action selected') : result.suppressionReason}</div>
        </div>
      </div>

      {/* Engagement policy layers */}
      {result.engagementPolicy && (
        <div style={{ marginBottom: 16 }}>
          <div style={miniLabel}>Engagement Policy Gates</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.engagementPolicy.layers.map(l => (
              <div key={l.layer} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                {l.passed ? <CheckCircle2 size={14} color="#22c55e" /> : <XCircle size={14} color="#ef4444" />}
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize', width: 110 }}>{l.layer}</span>
                <span style={{ color: 'var(--text-muted)' }}>{l.passed ? `${l.rulesEvaluated} rule(s) passed` : `failed: ${l.failedRule?.attribute} ${l.failedRule?.op} ${l.failedRule?.value}`}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* P×C×V×L breakdown */}
      {b && (
        <div style={{ marginBottom: 16 }}>
          <div style={miniLabel}>Priority = P × C × V × L</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            {([['P', b.P, '#3b82f6'], ['C', b.C, '#8b5cf6'], ['V', b.V, '#22c55e'], ['L', b.L, '#f59e0b']] as const).map(([k, v, c]) => (
              <div key={k} style={{ flex: 1, textAlign: 'center', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 6px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: c }}>{k}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>=</div>
            <div style={{ flex: 1.2, textAlign: 'center', background: 'rgba(99,102,241,0.1)', border: '1px solid var(--brand-accent)', borderRadius: 8, padding: '10px 6px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand-accent)' }}>PRIORITY</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--brand-accent)', fontFamily: 'monospace' }}>{b.priority.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
            </div>
          </div>
          {b.appliedLevers.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>Levers applied: {b.appliedLevers.map((l, i) => <span key={i} style={{ background: '#f59e0b22', color: '#b45309', borderRadius: 4, padding: '1px 6px', marginRight: 4 }}>{l}</span>)}</div>
          )}
        </div>
      )}

      {/* Ranked candidates */}
      {result.arbitration && result.arbitration.ranked.length > 1 && (
        <div>
          <div style={miniLabel}>Ranked Candidates</div>
          {result.arbitration.ranked.map((r, i) => (
            <div key={r.actionId ?? i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < result.arbitration!.ranked.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 18 }}>#{i + 1}</span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: i === 0 ? 700 : 500, color: 'var(--text-primary)' }}>{r.actionName}{r.strategyName ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {r.strategyName}</span> : null}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: i === 0 ? 'var(--brand-accent)' : 'var(--text-muted)', fontWeight: 700 }}>{r.priority.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
