'use client';

import { useEffect, useState } from 'react';
import { X, History, Plus, Edit2, Trash2, Play, Pause, ArrowUp } from 'lucide-react';

const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';

interface AuditRecord {
  id: string;
  entity_name: string | null;
  action: string;
  changed_by: string | null;
  created_at: string;
}

const ACTION_META: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  created:   { color: '#22c55e', icon: <Plus size={12} />,   label: 'Created' },
  updated:   { color: '#3b82f6', icon: <Edit2 size={12} />,  label: 'Updated' },
  deleted:   { color: '#ef4444', icon: <Trash2 size={12} />, label: 'Deleted' },
  activated: { color: '#16a34a', icon: <Play size={12} />,   label: 'Activated' },
  paused:    { color: '#f59e0b', icon: <Pause size={12} />,  label: 'Paused' },
  promoted:  { color: '#8b5cf6', icon: <ArrowUp size={12} />, label: 'Promoted' },
};

export function AuditDrawer({
  entityType,
  entityId,
  entityName,
  onClose,
}: {
  entityType: string;
  entityId?: string;
  entityName: string;
  onClose: () => void;
}) {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ tenantId: TENANT_ID, entityType, limit: '100' });
    if (entityId) params.set('entityId', entityId);
    fetch(`/api/audit?${params}`)
      .then(r => r.json())
      .then(j => { setRecords(j.data ?? []); setConfigured(j.configured !== false); setLoading(false); })
      .catch(() => setLoading(false));
  }, [entityType, entityId]);

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', justifyContent:'flex-end', zIndex:1100 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--bg-panel)', borderLeft:'1px solid var(--border)', width:'100%', maxWidth:440, height:'100%', display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'18px 22px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <History size={16} color="var(--brand-accent)" />
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>Audit History</div>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>{entityName}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }}><X size={16} /></button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'18px 22px' }}>
          {loading ? (
            <div style={{ textAlign:'center', padding:32, color:'var(--text-muted)', fontSize:13 }}>Loading…</div>
          ) : !configured ? (
            <div style={{ textAlign:'center', padding:32, color:'var(--text-muted)', fontSize:13 }}>Audit logging requires Supabase to be configured.</div>
          ) : records.length === 0 ? (
            <div style={{ textAlign:'center', padding:32, color:'var(--text-muted)', fontSize:13 }}>No history recorded yet.</div>
          ) : (
            <div style={{ position:'relative' }}>
              {records.map((r, i) => {
                const meta = ACTION_META[r.action] ?? { color:'var(--text-muted)', icon:<Edit2 size={12} />, label:r.action };
                return (
                  <div key={r.id} style={{ display:'flex', gap:12, paddingBottom: i < records.length-1 ? 18 : 0, position:'relative' }}>
                    {/* timeline rail */}
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                      <div style={{ width:26, height:26, borderRadius:'50%', background:`${meta.color}20`, color:meta.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:`1.5px solid ${meta.color}55` }}>{meta.icon}</div>
                      {i < records.length-1 && <div style={{ width:2, flex:1, background:'var(--border)', marginTop:2 }} />}
                    </div>
                    <div style={{ flex:1, paddingTop:2 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>
                        <span style={{ color:meta.color }}>{meta.label}</span>
                        {r.entity_name && <span style={{ color:'var(--text-secondary)' }}> · {r.entity_name}</span>}
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                        {new Date(r.created_at).toLocaleString()} · {r.changed_by ?? 'system'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  destructive = true,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1200 }}
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{ background:'var(--bg-panel)', border:'1px solid var(--border)', borderRadius:12, padding:24, width:'100%', maxWidth:420 }}>
        <h3 style={{ margin:'0 0 8px', fontSize:16, fontWeight:700, color:'var(--text-primary)' }}>{title}</h3>
        <p style={{ margin:'0 0 20px', fontSize:13, color:'var(--text-secondary)', lineHeight:1.5 }}>{message}</p>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onCancel} style={{ padding:'7px 16px', borderRadius:6, border:'1px solid var(--border)', background:'none', color:'var(--text-secondary)', cursor:'pointer', fontSize:13 }}>Cancel</button>
          <button
            onClick={() => { setBusy(true); onConfirm(); }}
            disabled={busy}
            style={{ padding:'7px 16px', borderRadius:6, border:'none', background: destructive ? '#ef4444' : 'var(--brand-accent)', color:'white', cursor:'pointer', fontSize:13, fontWeight:600, opacity: busy ? 0.7 : 1 }}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
