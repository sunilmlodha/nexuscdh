'use client';

import { useState, useEffect, useCallback } from 'react';
import { ListChecks, RefreshCw, Play, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';

const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';
const panel: React.CSSProperties = { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12 };

interface Job {
  id: string; type: string; ref_id: string; status: 'queued' | 'running' | 'completed' | 'failed';
  processed: number; served: number; suppressed: number; error?: string; created_at: string;
}
const STATUS: Record<string, { color: string; icon: React.ReactNode }> = {
  queued:    { color: '#6b7280', icon: <Clock size={14} /> },
  running:   { color: '#3b82f6', icon: <Loader2 size={14} /> },
  completed: { color: '#22c55e', icon: <CheckCircle2 size={14} /> },
  failed:    { color: '#ef4444', icon: <XCircle size={14} /> },
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const [j, c] = await Promise.all([
        fetch(`/api/jobs?tenantId=${TENANT_ID}`).then(r => r.json()),
        fetch(`/api/campaigns?tenantId=${TENANT_ID}`).then(r => r.json()),
      ]);
      if (j.configured === false) setErr('Supabase not configured.');
      else if (j.error) setErr(j.error.includes('decision_jobs') ? 'Run migration 0002_decision_jobs.sql to enable async jobs.' : j.error);
      else setJobs(j.data ?? []);
      setCampaigns((c.data ?? []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })));
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);

  async function enqueue(refId: string) {
    setNote('');
    const res = await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'campaign', refId, tenantId: TENANT_ID }) });
    const j = await res.json();
    setNote(res.ok ? 'Job queued.' : (j.error ?? 'Enqueue failed'));
    load();
  }
  async function processNext() {
    setWorking(true); setNote('');
    try {
      const res = await fetch(`/api/jobs/tick?tenantId=${TENANT_ID}`, { method: 'POST' });
      const j = await res.json();
      setNote(j.idle ? 'No active jobs.' : `Processed chunk: ${j.chunk ?? 0} (${j.status}) · served ${j.served ?? 0}`);
      load();
    } finally { setWorking(false); }
  }

  const cName = (id: string) => campaigns.find(c => c.id === id)?.name ?? id.slice(0, 8);

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ListChecks size={24} color="var(--brand-accent)" />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Decision Jobs</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Large campaign runs execute asynchronously in chunks — a worker advances them (every 5 min via cron, or process now).</p>
          </div>
        </div>
        <button onClick={processNext} disabled={working} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'var(--brand-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: working ? 0.7 : 1 }}>
          <Play size={14} /> {working ? 'Processing…' : 'Process next chunk'}
        </button>
      </div>

      {note && <div style={{ ...panel, padding: '8px 14px', margin: '12px 0', fontSize: 13, color: 'var(--text-secondary)' }}>{note}</div>}
      {err && <div style={{ ...panel, padding: 16, marginTop: 12, borderLeft: '3px solid #ef4444', fontSize: 13, color: 'var(--text-secondary)' }}>{err}</div>}

      {/* Enqueue */}
      <div style={{ ...panel, padding: 16, margin: '16px 0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Queue a campaign run</span>
        {campaigns.length === 0 ? <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No campaigns.</span> :
          campaigns.map(c => <button key={c.id} onClick={() => enqueue(c.id)} style={{ padding: '5px 12px', borderRadius: 16, border: '1px solid var(--border)', background: 'none', color: 'var(--brand-accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>+ {c.name}</button>)}
      </div>

      {loading && jobs.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading…</div> :
        jobs.length === 0 && !err ? <div style={{ ...panel, padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No jobs yet. Queue a campaign above to run it asynchronously.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {jobs.map(job => {
            const s = STATUS[job.status];
            return (
              <div key={job.id} style={{ ...panel, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: s.color, display: 'flex' }}>{s.icon}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{cName(job.ref_id)}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 16, fontSize: 11, fontWeight: 600, background: `${s.color}22`, color: s.color, textTransform: 'capitalize' }}>{job.status}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>{new Date(job.created_at).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', gap: 18, marginTop: 10, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>processed <strong style={{ color: 'var(--text-primary)' }}>{job.processed}</strong></span>
                  <span style={{ color: '#16a34a' }}>served <strong>{job.served}</strong></span>
                  <span style={{ color: '#f59e0b' }}>suppressed <strong>{job.suppressed}</strong></span>
                </div>
                {job.error && <div style={{ marginTop: 6, fontSize: 12, color: '#b91c1c' }}>{job.error}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
