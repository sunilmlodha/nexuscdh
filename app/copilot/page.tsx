'use client';
import { useState, type ReactNode } from 'react';
import { Sparkles, Send, Wand2, Shield, FileText, GitBranch, AlertTriangle } from 'lucide-react';

type Tool = 'campaign' | 'rules' | 'suppression' | 'critique';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  data?: unknown;
  tool?: Tool;
}

const TOOLS: { id: Tool; label: string; icon: ReactNode; placeholder: string; description: string }[] = [
  {
    id: 'campaign',
    label: 'Campaign → Strategy',
    icon: <GitBranch size={15} />,
    placeholder: 'e.g. "Launch a home insurance upsell campaign targeting existing car insurance customers aged 35-55 in Q3, using email and mobile push"',
    description: 'Convert a campaign brief into a full NexusCDH strategy scaffold with actions, audiences, and eligibility rules.',
  },
  {
    id: 'rules',
    label: 'Text → Eligibility Rules',
    icon: <Wand2 size={15} />,
    placeholder: 'e.g. "Customers who have held an account for more than 12 months, have a credit score above 650, and have not received an offer in the last 30 days"',
    description: 'Convert plain-English eligibility criteria into structured rules you can paste directly into a strategy.',
  },
  {
    id: 'suppression',
    label: 'Text → Suppression Policy',
    icon: <Shield size={15} />,
    placeholder: 'e.g. "Do not contact customers who are in arrears, have opted out of marketing, or have received a message in the past 7 days"',
    description: 'Convert plain-English suppression requirements into structured conditions and contact limit suggestions.',
  },
  {
    id: 'critique',
    label: 'Strategy Critique',
    icon: <FileText size={15} />,
    placeholder: 'Paste a strategy name or describe what you want reviewed...',
    description: 'Paste a strategy configuration (as JSON) and get an AI quality score, issues, and improvement recommendations.',
  },
];

function RulesOutput({ rules }: { rules: { attribute: string; op: string; value: string }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rules.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontFamily: 'monospace' }}>
          <span style={{ color: '#6b7280' }}>{r.attribute}</span>
          <span style={{ color: '#2563eb', fontWeight: 700 }}>{r.op}</span>
          <span style={{ color: '#16a34a' }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function CampaignOutput({ data }: { data: Record<string, unknown> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { label: 'Strategy Name', value: data.name as string },
          { label: 'Category', value: data.suggestedCategory as string },
          { label: 'Arbitration', value: data.arbitration as string },
          { label: 'Priority', value: data.priority as string },
        ].map(f => (
          <div key={f.label} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{f.label}</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{f.value}</div>
          </div>
        ))}
      </div>
      {!!data.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{data.description as string}</p>}
      {(data.suggestedActions as unknown[])?.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Suggested Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(data.suggestedActions as { name: string; headline: string; suggestedPropensity: number }[]).map((a, i) => (
              <div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.headline}</div>
                </div>
                <div style={{ fontSize: 11, background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>p={a.suggestedPropensity}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {(data.suggestedEligibilityRules as unknown[])?.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Eligibility Rules</div>
          <RulesOutput rules={data.suggestedEligibilityRules as { attribute: string; op: string; value: string }[]} />
        </div>
      )}
      {!!data.rationale && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: 10, fontSize: 12, color: '#166534' }}>
          <strong>Rationale:</strong> {data.rationale as string}
        </div>
      )}
    </div>
  );
}

function SuppressionOutput({ data }: { data: Record<string, unknown> }) {
  const conditions = data.suppressionConditions as { attribute: string; op: string; value: string; reason: string }[];
  const limits = data.contactLimitSuggestion as { maxPerDay: number | null; maxPerWeek: number | null; maxPerMonth: number | null } | null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {conditions?.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Suppression Conditions</div>
          {conditions.map((c, i) => (
            <div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', marginBottom: 6 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
                <span style={{ color: '#6b7280' }}>{c.attribute}</span> <span style={{ color: '#dc2626', fontWeight: 700 }}>{c.op}</span> <span style={{ color: '#16a34a' }}>{c.value}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{c.reason}</div>
            </div>
          ))}
        </div>
      )}
      {limits && (
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: 'Per Day', value: limits.maxPerDay },
            { label: 'Per Week', value: limits.maxPerWeek },
            { label: 'Per Month', value: limits.maxPerMonth },
          ].filter(l => l.value !== null).map(l => (
            <div key={l.label} style={{ flex: 1, background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#92400e' }}>{l.value}</div>
              <div style={{ fontSize: 11, color: '#92400e' }}>Max {l.label}</div>
            </div>
          ))}
        </div>
      )}
      {!!data.explanation && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{data.explanation as string}</p>}
    </div>
  );
}

function CritiqueOutput({ data }: { data: Record<string, unknown> }) {
  const issues = data.issues as { severity: string; field: string; issue: string; fix: string }[];
  const score = data.score as number;
  const scoreColor = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', border: `4px solid ${scoreColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: scoreColor }}>{score}</span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>{data.summary as string}</p>
      </div>
      {issues?.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Issues</div>
          {issues.map((iss, i) => (
            <div key={i} style={{ background: 'var(--bg)', border: `1px solid ${iss.severity === 'high' ? '#fecaca' : iss.severity === 'medium' ? '#fde68a' : 'var(--border)'}`, borderRadius: 6, padding: '8px 10px', marginBottom: 6 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                <AlertTriangle size={12} style={{ color: iss.severity === 'high' ? '#dc2626' : iss.severity === 'medium' ? '#d97706' : '#6b7280' }} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: iss.severity === 'high' ? '#dc2626' : iss.severity === 'medium' ? '#d97706' : '#6b7280' }}>{iss.severity}</span>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{iss.field}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{iss.issue}</div>
              <div style={{ fontSize: 12, color: '#16a34a', marginTop: 3 }}>Fix: {iss.fix}</div>
            </div>
          ))}
        </div>
      )}
      {(data.recommendations as string[])?.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Recommendations</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(data.recommendations as string[]).map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function AssistantMessage({ msg }: { msg: Message }) {
  if (!msg.data) {
    return <p style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap' }}>{msg.content}</p>;
  }
  const d = msg.data as Record<string, unknown>;
  switch (msg.tool) {
    case 'rules':       return <RulesOutput rules={d as unknown as { attribute: string; op: string; value: string }[]} />;
    case 'campaign':    return <CampaignOutput data={d} />;
    case 'suppression': return <SuppressionOutput data={d} />;
    case 'critique':    return <CritiqueOutput data={d} />;
    default: return <p style={{ margin: 0, fontSize: 13 }}>{msg.content}</p>;
  }
}

export default function CopilotPage() {
  const [tool, setTool] = useState<Tool>('campaign');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const activeTool = TOOLS.find(t => t.id === tool)!;

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setError('');
    setMessages(m => [...m, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const bodyMap: Record<Tool, Record<string, unknown>> = {
        rules:       { action: 'rules_from_text', text },
        campaign:    { action: 'campaign_to_strategy', brief: text, availableCategories: ['Retail Banking', 'Insurance', 'Telco', 'Wealth Management'], availableChannels: ['email', 'sms', 'mobile_app', 'web', 'push'] },
        suppression: { action: 'suggest_suppression', text },
        critique:    { action: 'strategy_critique', strategy: (() => { try { return JSON.parse(text); } catch { return { description: text }; } })() },
      };

      const r = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyMap[tool]),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? 'AI call failed'); setLoading(false); return; }

      const dataMap: Record<Tool, unknown> = {
        rules: j.rules,
        campaign: j,
        suppression: j,
        critique: j,
      };

      setMessages(m => [...m, {
        role: 'assistant',
        content: '',
        data: dataMap[tool],
        tool,
      }]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <div className="page-header" style={{ flexShrink: 0 }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={20} style={{ color: '#7c3aed' }} /> AI Co-pilot
        </h1>
        <p className="page-subtitle">Claude-powered strategy authoring, rule generation, and decision explanation</p>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '0 24px 24px', gap: 20 }}>
        {/* Tool selector sidebar */}
        <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Capabilities</div>
          {TOOLS.map(t => (
            <button
              key={t.id}
              onClick={() => { setTool(t.id); setMessages([]); setError(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                borderRadius: 8, border: `1px solid ${tool === t.id ? '#7c3aed' : 'var(--border)'}`,
                background: tool === t.id ? '#f5f3ff' : 'var(--bg-panel)',
                color: tool === t.id ? '#7c3aed' : 'var(--text-primary)',
                fontWeight: tool === t.id ? 600 : 400,
                fontSize: 13, cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.15s',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}

          <div style={{ marginTop: 16, padding: 12, background: '#f5f3ff', border: '1px solid #e9d5ff', borderRadius: 8, fontSize: 12, color: '#6d28d9', lineHeight: 1.5 }}>
            <strong>Powered by</strong><br />Claude Sonnet 4.6<br />
            <span style={{ opacity: 0.7 }}>Anthropic</span>
          </div>
        </div>

        {/* Chat area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Tool description bar */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ color: '#7c3aed' }}>{activeTool.icon}</span>
            <strong>{activeTool.label}</strong>
            <span style={{ color: 'var(--text-muted)' }}>—</span>
            <span style={{ color: 'var(--text-muted)' }}>{activeTool.description}</span>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
                <Sparkles size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.2, color: '#7c3aed' }} />
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Start a conversation</div>
                <div style={{ fontSize: 13 }}>{activeTool.placeholder}</div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {msg.role === 'user' ? 'You' : 'Claude'}
                </div>
                <div style={{
                  maxWidth: '85%', padding: '10px 14px', borderRadius: 10,
                  background: msg.role === 'user' ? '#7c3aed' : 'var(--bg)',
                  border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                  fontSize: 13,
                }}>
                  {msg.role === 'user' ? msg.content : <AssistantMessage msg={msg} />}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
                <div style={{ display: 'flex', gap: 3 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', opacity: 0.6, animation: `bounce 1s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
                Claude is thinking…
              </div>
            )}
            {error && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: '#dc2626', fontSize: 13, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6 }}>
                <AlertTriangle size={13} /> {error}
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={activeTool.placeholder}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 13, resize: 'none',
                minHeight: 56, maxHeight: 140, lineHeight: 1.5, fontFamily: 'inherit',
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              style={{
                padding: '8px 14px', borderRadius: 8, border: 'none', cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                background: !input.trim() || loading ? 'var(--border)' : '#7c3aed',
                color: !input.trim() || loading ? 'var(--text-muted)' : '#fff',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
                alignSelf: 'flex-end',
              }}
            >
              <Send size={13} /> Send
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
