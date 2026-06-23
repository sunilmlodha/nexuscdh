'use client';
import { useState } from 'react';
import { Copy, CheckCircle, ChevronDown, ChevronRight, Zap, Send, FileJson } from 'lucide-react';

const TENANT = 'f0000000-0000-4000-a000-000000000001';
const BASE    = typeof window !== 'undefined' ? window.location.origin : 'https://nexuscdh.vercel.app';

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  title: string;
  description: string;
  pegaEquivalent?: string;
  body?: string;
  params?: string;
  response?: string;
  category: string;
}

const ENDPOINTS: Endpoint[] = [
  // ── Pega-compatible ──────────────────────────────────────────────────────────
  {
    category: 'Pega CDH Compatible',
    method: 'POST',
    path: '/api/v4/containers/PrimaryContainer',
    title: 'V4 Real-Time Container API',
    pegaEquivalent: 'POST /prweb/api/v4/containers/{name}',
    description: 'Get next best actions for a customer in a named container. Returns ranked actions in Pega CDH V4 format. Use PrimaryContainer, SalesContainer, RetentionContainer, or OnboardingContainer.',
    body: JSON.stringify({
      context: {
        customer: {
          CustomerID: 'cust-001',
          Age: 38,
          Segment: 'affluent',
          has_mortgage: true,
        },
      },
      channel: 'web',
      tenantId: TENANT,
      maxActions: 3,
    }, null, 2),
    response: JSON.stringify({
      container: 'PrimaryContainer',
      decisions: [{
        rank: 1,
        issue: 'Sales',
        group: 'Home Insurance',
        name: 'Home Insurance Upsell',
        direction: 'Outbound',
        propensity: 0.62,
        context: {
          pyName: 'Home Insurance Upsell',
          pyIssue: 'Sales',
          pyPropensity: 0.62,
          pyChannel: 'web',
          pxInteractionID: 'INT-A1B2C3D4',
          Headline: 'Protect your home from $12/month',
          OfferCode: 'HOME2024',
          ExpectedValue: 480,
        },
      }],
      pxInteractionID: 'INT-A1B2C3D4',
      pxObjClass: 'CDH-NBAResult',
      latencyMs: 48,
    }, null, 2),
  },
  {
    category: 'Pega CDH Compatible',
    method: 'POST',
    path: '/api/v1/interactions/INT-A1B2C3D4/responses',
    title: 'Capture Response API',
    pegaEquivalent: 'POST /prweb/api/v1/interactions/{id}/responses',
    description: 'Record customer responses (Clicked, Accepted, Dismissed, etc.) back to NexusCDH. Triggers adaptive propensity update. Accepted → +0.02 propensity nudge, Rejected → −0.01.',
    body: JSON.stringify({
      responses: [{
        rank: 1,
        pyName: 'Home Insurance Upsell',
        pyOutcome: 'Clicked',
        pyChannel: 'web',
        CustomerID: 'cust-001',
        tenantId: TENANT,
      }],
    }, null, 2),
    response: JSON.stringify({
      pxInteractionID: 'INT-A1B2C3D4',
      recorded: 1,
      total: 1,
      results: [{ pyName: 'Home Insurance Upsell', pyOutcome: 'Clicked', nexusOutcome: 'accepted', status: 'recorded' }],
    }, null, 2),
  },
  {
    category: 'Pega CDH Compatible',
    method: 'GET',
    path: `/api/v1/customers/cust-001?tenantId=${TENANT}`,
    title: 'Customer Profile API',
    pegaEquivalent: 'GET /prweb/api/v1/customers/{id}',
    description: 'Fetch a customer profile with all attributes, segments, and recent decision history in Pega-shaped format.',
    response: JSON.stringify({
      CustomerID: 'cust-001',
      pyCustomer: { pyCustomerID: 'cust-001', pyInteractions: 3, pySegments: [] },
      attributes: { name: 'Sarah Mitchell', age: 38, has_mortgage: true },
      recentDecisions: [{ pyName: 'Home Insurance Upsell', pyOutcome: 'accepted', pyPropensity: 0.62 }],
      pxObjClass: 'Data-Customer',
    }, null, 2),
  },
  {
    category: 'Pega CDH Compatible',
    method: 'PUT',
    path: '/api/v1/customers/cust-001',
    title: 'Update Customer Profile',
    pegaEquivalent: 'PUT /prweb/api/v1/customers/{id}',
    description: 'Update customer attributes. Partial merge — only provided fields are updated.',
    body: JSON.stringify({
      tenantId: TENANT,
      attributes: { monthly_spend: 3500, credit_score: 790, last_product_viewed: 'home_insurance' },
    }, null, 2),
  },
  {
    category: 'Pega CDH Compatible',
    method: 'POST',
    path: '/api/v1/events',
    title: 'Event API',
    pegaEquivalent: 'POST /prweb/api/v1/events (Event Strategy)',
    description: 'Fire a business event. NexusCDH matches it against event triggers, runs linked strategies, and returns the winning action in real time.',
    body: JSON.stringify({
      eventType: 'mortgage.approved',
      CustomerID: 'cust-001',
      payload: { status: 'approved', loan_amount: 450000 },
      channel: 'web',
      tenantId: TENANT,
    }, null, 2),
    response: JSON.stringify({
      matched: true,
      eventType: 'mortgage.approved',
      triggersMatched: [{ name: 'Mortgage Application Approved' }],
      decision: {
        pyName: 'Home Insurance Upsell',
        pyPropensity: 0.62,
        Headline: 'Protect your home from $12/month',
        OfferCode: 'HOME2024',
      },
      pxInteractionID: 'EVT-F4A2B1C3',
    }, null, 2),
  },
  // ── NexusCDH native ──────────────────────────────────────────────────────────
  {
    category: 'NexusCDH Native',
    method: 'POST',
    path: '/api/decide',
    title: 'Single Strategy Decision',
    description: 'Run a specific strategy for a customer. Full 7-gate evaluation: consent → status → dates → fatigue → suppression → actions → eligibility.',
    body: JSON.stringify({
      customerId: 'cust-001',
      strategyId: 'e5000001-0000-4000-a000-000000000001',
      tenantId: TENANT,
      attributes: { has_mortgage: true, age: 38 },
    }, null, 2),
  },
  {
    category: 'NexusCDH Native',
    method: 'GET',
    path: `/api/decide?customerId=cust-001&tenantId=${TENANT}`,
    title: 'Global NBA (Next Best Action)',
    description: 'Run all active strategies for a customer and return the single best action across all of them.',
  },
  {
    category: 'NexusCDH Native',
    method: 'GET',
    path: `/api/strategies?tenantId=${TENANT}`,
    title: 'List Strategies',
    description: 'Returns all strategies for a tenant with full configuration.',
  },
  {
    category: 'NexusCDH Native',
    method: 'GET',
    path: `/api/profile?customerId=cust-001&tenantId=${TENANT}`,
    title: 'Customer Profile + Decision History',
    description: 'Fetch a customer profile with their last 20 decisions.',
  },
  {
    category: 'NexusCDH Native',
    method: 'POST',
    path: '/api/outcome',
    title: 'Record Outcome',
    description: 'Record a decision outcome (accepted / rejected / ignored) directly by decisionId.',
    body: JSON.stringify({
      decisionId: 'uuid-of-decision',
      customerId: 'cust-001',
      outcome: 'accepted',
      tenantId: TENANT,
    }, null, 2),
  },
  {
    category: 'NexusCDH Native',
    method: 'GET',
    path: `/api/seed`,
    title: 'Seed Data Counts',
    description: 'Returns current record counts for all seeded tables.',
  },
  {
    category: 'NexusCDH Native',
    method: 'GET',
    path: `/api/v1/events?tenantId=${TENANT}`,
    title: 'List Event Triggers',
    description: 'List all registered event types and their linked strategies.',
  },
];

const OUTCOME_MAP: Record<string, string> = {
  Clicked: 'accepted', Accepted: 'accepted', Converted: 'accepted', Purchased: 'accepted',
  Dismissed: 'rejected', Rejected: 'rejected', OptedOut: 'rejected',
  Impressed: 'ignored', Viewed: 'ignored', Opened: 'ignored',
};

const METHOD_COLORS: Record<string, string> = {
  GET: '#16a34a', POST: '#2563eb', PUT: '#d97706', DELETE: '#dc2626',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--success)' : 'var(--text-muted)', padding: '2px 4px' }}>
      {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
    </button>
  );
}

function EndpointCard({ ep }: { ep: Endpoint }) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [liveResult, setLiveResult] = useState<string | null>(null);
  const [editBody, setEditBody] = useState(ep.body ?? '');

  async function tryIt() {
    setRunning(true); setLiveResult(null);
    try {
      const isGet = ep.method === 'GET';
      const res = await fetch(ep.path, isGet ? undefined : {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
        body: editBody || undefined,
      });
      const data = await res.json();
      setLiveResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setLiveResult(`Error: ${e instanceof Error ? e.message : 'fetch failed'}`);
    }
    setRunning(false);
  }

  const curlCmd = ep.method === 'GET'
    ? `curl "${BASE}${ep.path}"`
    : `curl -X ${ep.method} "${BASE}${ep.path}" \\\n  -H "Content-Type: application/json" \\\n  -d '${ep.body ?? '{}'}'`;

  return (
    <div className="card" style={{ marginBottom: 10, overflow: 'hidden' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: `${METHOD_COLORS[ep.method]}20`, color: METHOD_COLORS[ep.method], minWidth: 40, textAlign: 'center' }}>
          {ep.method}
        </span>
        <code style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1, fontFamily: 'monospace' }}>{ep.path}</code>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 2 }}>{ep.title}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </div>

      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '16px 16px 0' }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{ep.description}</p>

          {ep.pegaEquivalent && (
            <div style={{ fontSize: 11, background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={10} style={{ color: '#7c3aed' }} />
              <span style={{ color: 'var(--text-muted)' }}>Pega equivalent: </span>
              <code style={{ color: '#7c3aed' }}>{ep.pegaEquivalent}</code>
            </div>
          )}

          {ep.body && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                REQUEST BODY <CopyButton text={ep.body} />
              </div>
              <textarea
                value={editBody}
                onChange={e => setEditBody(e.target.value)}
                style={{ width: '100%', fontSize: 11, fontFamily: 'monospace', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text-primary)', minHeight: 140, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
          )}

          {ep.response && !liveResult && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>EXAMPLE RESPONSE</div>
              <pre style={{ fontSize: 11, background: 'var(--bg-secondary)', borderRadius: 6, padding: '8px 10px', overflow: 'auto', margin: 0 }}>{ep.response}</pre>
            </div>
          )}

          {liveResult && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                LIVE RESPONSE <CopyButton text={liveResult} />
              </div>
              <pre style={{ fontSize: 11, background: '#f0fdf4', borderRadius: 6, padding: '8px 10px', overflow: 'auto', margin: 0, maxHeight: 300, color: '#166534' }}>{liveResult}</pre>
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
              CURL <CopyButton text={curlCmd} />
            </div>
            <pre style={{ fontSize: 11, background: 'var(--bg-secondary)', borderRadius: 6, padding: '8px 10px', overflow: 'auto', margin: 0 }}>{curlCmd}</pre>
          </div>

          <div style={{ paddingBottom: 16 }}>
            <button onClick={tryIt} disabled={running}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, opacity: running ? 0.6 : 1 }}>
              <Send size={12} />
              {running ? 'Running…' : 'Try it live'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApiRefPage() {
  const allCats = ENDPOINTS.map(e => e.category);
  const categories = allCats.filter((c, i) => allCats.indexOf(c) === i);

  return (
    <div style={{ padding: '32px 36px', maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>API Reference</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          NexusCDH exposes a Pega CDH-compatible API surface. Existing Pega integrations work without client changes.
          All endpoints require <code style={{ background: 'var(--bg-secondary)', padding: '1px 5px', borderRadius: 4 }}>tenantId</code> for multi-tenant scoping.
        </p>
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 12 }}>
          <strong>Base URL:</strong> <code>{BASE}</code> &nbsp;·&nbsp;
          <strong>Demo Tenant:</strong> <code>{TENANT}</code>
        </div>
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <a href="/api/openapi" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, background: 'var(--brand-accent)', color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
            <FileJson size={13} /> OpenAPI 3.1 spec
          </a>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Import into Postman/Insomnia or generate an SDK. Auth: <code style={{ background: 'var(--bg-secondary)', padding: '1px 5px', borderRadius: 4 }}>X-API-Key</code> header.
          </span>
          <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: '#eef2ff', color: '#4338ca', fontWeight: 600 }}>
            Rate limit: 120 req/min · X-RateLimit-* headers
          </span>
        </div>
      </div>

      {/* Pega outcome map */}
      <div className="card" style={{ padding: 16, marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Pega pyOutcome → NexusCDH outcome mapping</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.entries(OUTCOME_MAP).map(([pega, nexus]) => (
            <div key={pega} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: nexus === 'accepted' ? '#dcfce7' : nexus === 'rejected' ? '#fee2e2' : '#f3f4f6', color: nexus === 'accepted' ? '#166534' : nexus === 'rejected' ? '#991b1b' : '#6b7280' }}>
              {pega} → {nexus}
            </div>
          ))}
        </div>
      </div>

      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>{cat}</div>
          {ENDPOINTS.filter(e => e.category === cat).map(ep => (
            <EndpointCard key={ep.path + ep.method} ep={ep} />
          ))}
        </div>
      ))}
    </div>
  );
}
