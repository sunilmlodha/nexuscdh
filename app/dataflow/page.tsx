'use client';

import { useState } from 'react';
import {
  Zap, GitBranch, Shield, Brain, Radio, Target, ArrowRight,
  CheckCircle, Database, Users, FlaskConical, Activity,
} from 'lucide-react';

type FlowStep = {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  page: string;
  description: string;
  inputs: string[];
  outputs: string[];
  keyPoints: string[];
};

const FLOW_STEPS: FlowStep[] = [
  {
    id: 'event',
    label: 'Customer Event',
    sublabel: 'Event Source',
    icon: Zap,
    color: '#6c63ff',
    bg: '#f0eeff',
    page: '/triggers',
    description: 'A real-time customer event arrives — a login, purchase, app open, or CDP webhook. This is the trigger signal that initiates the decisioning flow.',
    inputs: ['Web/app interaction', 'CDP webhook (Segment, mParticle)', 'CRM update', 'Transaction event', 'Scheduled batch job'],
    outputs: ['Event payload with context', 'Customer ID', 'Event type + attributes'],
    keyPoints: ['Events fire the decisioning pipeline in real time', 'Batch mode supported for overnight campaigns', 'All events are logged for audit'],
  },
  {
    id: 'car',
    label: 'Customer Profile',
    sublabel: 'Attribute Repository',
    icon: Database,
    color: '#0288d1',
    bg: '#e1f5fe',
    page: '/car',
    description: 'The event triggers a profile lookup in the Customer Attribute Repository (CAR). The full profile — demographics, products, behavioural signals — is loaded for the decision context.',
    inputs: ['Customer ID from event', 'Inbound CDP profile sync', 'Batch CSV ingestion'],
    outputs: ['Complete attribute set', 'Segment classification', 'Propensity model features'],
    keyPoints: ['GDPR-compliant attribute store', 'Custom attributes supported alongside standard schema', 'Profile is enriched after each decision outcome'],
  },
  {
    id: 'trigger',
    label: 'Event Trigger',
    sublabel: 'Rule Matching',
    icon: Zap,
    color: '#ef6c00',
    bg: '#fff3e0',
    page: '/triggers',
    description: 'Event triggers match the inbound event type and evaluate conditions against the payload and profile. Matched triggers activate linked strategies.',
    inputs: ['Event type', 'Customer attributes', 'Trigger conditions (op rules)'],
    outputs: ['Matched strategy IDs', 'Decision context object'],
    keyPoints: ['Multiple triggers can fire from one event', 'Conditions use the same rule DSL as eligibility', 'Unmatched events are still logged'],
  },
  {
    id: 'strategy',
    label: 'Strategy Engine',
    sublabel: 'Eligibility & Filtering',
    icon: GitBranch,
    color: '#2e7d32',
    bg: '#e8f5e9',
    page: '/strategies',
    description: 'Active strategies are evaluated. Each strategy checks eligibility rules against the customer profile, applies audience membership, and filters by channel availability.',
    inputs: ['Customer profile attributes', 'Eligibility rules (per strategy)', 'Audience segments', 'Channel filter'],
    outputs: ['Eligible actions', 'Suppressed actions (with reason)', 'Eligibility trace'],
    keyPoints: ['Eligibility rules: attribute comparisons (>, <, =, IN, CONTAINS)', 'Audience membership adds an extra filter layer', 'All rule evaluations are recorded in the decision trace'],
  },
  {
    id: 'policy',
    label: 'Engagement Policy',
    sublabel: 'Suppression & Limits',
    icon: Shield,
    color: '#c62828',
    bg: '#ffebee',
    page: '/policies',
    description: 'Before an action is served, it passes through the engagement policy: contact frequency limits, fatigue windows, opt-out suppression, and fairness constraints.',
    inputs: ['Eligible action set', 'Contact history (frequency counts)', 'Consent & opt-out status', 'Fairness attribute'],
    outputs: ['Policy-approved actions', 'Suppressed actions + reasons', 'Contact limit increment'],
    keyPoints: ['Per-day / per-week / per-month contact caps', 'Conversion cooldown prevents re-serving accepted offers', 'Fairness guard ensures equitable treatment across segments'],
  },
  {
    id: 'model',
    label: 'Adaptive Model',
    sublabel: 'Propensity Scoring',
    icon: Brain,
    color: '#7b1fa2',
    bg: '#f3e5f5',
    page: '/models',
    description: 'Each eligible action receives a propensity score from its adaptive model. Scores update via a Bayesian nudge every time an outcome (accepted/rejected) is recorded.',
    inputs: ['Action IDs + base propensity', 'Customer attributes (model features)', 'Historical outcome feedback'],
    outputs: ['Scored action set (propensity 0–1)', 'Expected value estimates'],
    keyPoints: ['Bayesian update: accepted → p += (1-p)×0.05', 'Rejected → p -= p×0.05', 'Models personalise over time per customer segment'],
  },
  {
    id: 'arbitration',
    label: 'NBA Arbitration',
    sublabel: 'Best Action Selection',
    icon: Target,
    color: '#00838f',
    bg: '#e0f7fa',
    page: '/simulator',
    description: 'The arbitration engine ranks all eligible, policy-approved, scored actions and selects the single Next-Best-Action (or ranked list). Arbitration mode is set per strategy.',
    inputs: ['Scored action set', 'Strategy arbitration mode', 'Expected value weights'],
    outputs: ['Ranked action list', 'Winning action + score', 'Arbitration rationale'],
    keyPoints: ['Modes: propensity | expected value | weighted blend | champion/challenger', 'Challenger experiment variants can override champion', 'Ties broken by priority tier then lexical order'],
  },
  {
    id: 'channel',
    label: 'Channel Delivery',
    sublabel: 'Outbound Dispatch',
    icon: Radio,
    color: '#1565c0',
    bg: '#e3f2fd',
    page: '/channels',
    description: 'The winning action is dispatched via the configured channel: email, SMS, push, web personalisation, paid media sync, or API response for real-time use cases.',
    inputs: ['Winning action + headline/offer', 'Channel configuration', 'Customer contact details'],
    outputs: ['Delivered message / API response', 'Delivery receipt', 'Decision log entry'],
    keyPoints: ['Real-time API: synchronous JSON response in <100ms', 'Email/SMS: queued for dispatch', 'Paid media: customer hashed to platform audience via SHA-256'],
  },
  {
    id: 'outcome',
    label: 'Outcome & Learning',
    sublabel: 'Feedback Loop',
    icon: CheckCircle,
    color: '#2e7d32',
    bg: '#e8f5e9',
    page: '/analytics',
    description: 'After delivery, the customer\'s response is captured (accepted, rejected, or ignored). This outcome feeds back into the adaptive model, updates contact history, and enriches the customer profile.',
    inputs: ['Customer response signal', 'Conversion event from CRM/CDP', 'Manual outcome recording'],
    outputs: ['Updated propensity scores', 'Contact history increment', 'Enriched customer profile', 'Experiment result tallies'],
    keyPoints: ['Closed-loop learning — every interaction improves future decisions', 'Outcomes drive champion/challenger experiment promotion', 'Analytics dashboard aggregates all outcome data'],
  },
];

export default function DataflowPage() {
  const [selected, setSelected] = useState<string | null>('event');
  const step = FLOW_STEPS.find(s => s.id === selected);

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1300 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Activity size={22} style={{ color: 'var(--accent)' }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Decision Dataflow</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          End-to-end visualisation of how a customer event flows through NexusCDH — from inbound signal to Next-Best-Action delivery and outcome learning.
          Click any step to explore its inputs, outputs, and configuration.
        </p>
      </div>

      {/* Flow diagram */}
      <div className="card" style={{ padding: '28px 24px', marginBottom: 24, overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 900 }}>
          {FLOW_STEPS.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: i < FLOW_STEPS.length - 1 ? 1 : 'none' }}>
              <button
                onClick={() => setSelected(s.id === selected ? null : s.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '14px 10px', borderRadius: 12, border: `2px solid ${selected === s.id ? s.color : 'transparent'}`,
                  background: selected === s.id ? s.bg : 'var(--bg-secondary)',
                  cursor: 'pointer', transition: 'all 0.15s', minWidth: 90,
                  boxShadow: selected === s.id ? `0 2px 12px ${s.color}33` : 'none',
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: selected === s.id ? s.color : 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${s.color}` }}>
                  <s.icon size={18} style={{ color: selected === s.id ? 'white' : s.color }} />
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, textAlign: 'center', color: selected === s.id ? s.color : 'var(--text)', lineHeight: 1.3, whiteSpace: 'nowrap' }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {s.sublabel}
                </div>
              </button>
              {i < FLOW_STEPS.length - 1 && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 2px' }}>
                  <div style={{ flex: 1, height: 2, background: 'var(--border)' }} />
                  <ArrowRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {step && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Left */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: step.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${step.color}` }}>
                <step.icon size={22} style={{ color: step.color }} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{step.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{step.sublabel}</div>
              </div>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7, marginBottom: 20 }}>{step.description}</p>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8 }}>Key behaviours</div>
              {step.keyPoints.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                  <span style={{ color: step.color, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>•</span>
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{p}</span>
                </div>
              ))}
            </div>
            <a href={step.page}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: step.color, color: 'white', borderRadius: 6, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
              Configure → {step.label}
            </a>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--text)' }}>
                Inputs to this step
              </div>
              {step.inputs.map((inp, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < step.inputs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: step.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13 }}>{inp}</span>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--text)' }}>
                Outputs from this step
              </div>
              {step.outputs.map((out, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < step.outputs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <ArrowRight size={12} style={{ color: step.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13 }}>{out}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Swimlane legend */}
      <div className="card" style={{ padding: 20, marginTop: 24 }}>
        <div style={{ fontWeight: 700, marginBottom: 14 }}>System Components</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {[
            { icon: Zap, label: 'Event Triggers', desc: 'Inbound event matching & routing', color: '#ef6c00', page: '/triggers' },
            { icon: Database, label: 'CAR', desc: 'Customer Attribute Repository', color: '#0288d1', page: '/car' },
            { icon: GitBranch, label: 'Strategies', desc: 'Eligibility rules & action sets', color: '#2e7d32', page: '/strategies' },
            { icon: Shield, label: 'Policies', desc: 'Contact limits & suppression', color: '#c62828', page: '/policies' },
            { icon: Brain, label: 'Adaptive Models', desc: 'Bayesian propensity scoring', color: '#7b1fa2', page: '/models' },
            { icon: Users, label: 'Audiences', desc: 'Segment definitions', color: '#1565c0', page: '/audiences' },
            { icon: Radio, label: 'Channels', desc: 'Email, SMS, push, web, paid', color: '#00838f', page: '/channels' },
            { icon: FlaskConical, label: 'Experiments', desc: 'Champion / Challenger A/B', color: '#6c63ff', page: '/experiments' },
          ].map(({ icon: Icon, label, desc, color, page }) => (
            <a key={label} href={page} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, textDecoration: 'none', color: 'var(--text)', transition: 'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={14} style={{ color }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
