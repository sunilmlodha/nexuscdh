'use client';
import { useStore, Channel, ChannelId } from '@/lib/store';
import { usePermission } from '@/lib/auth';
import { Save, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

export default function ChannelsPage() {
  const { channels, updateChannel } = useStore();
  const canWrite = usePermission('channels:write');
  const [saved, setSaved] = useState<ChannelId|null>(null);

  const owned = channels.filter(c=>c.type==='owned');
  const paid  = channels.filter(c=>c.type==='paid');

  const ChannelRow = ({ ch }: { ch: Channel }) => (
    <div style={{ display:'grid', gridTemplateColumns:'48px 1fr 90px 100px 100px 90px', gap:12, alignItems:'center', padding:'12px 16px', borderBottom:'1px solid #F3F4F6' }}>
      <div style={{ fontSize:22, textAlign:'center' }}>{ch.icon}</div>
      <div><div style={{ fontWeight:600, fontSize:13 }}>{ch.name}</div>
           <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'capitalize' }}>{ch.latency.replace(/_/g,' ')}</div></div>
      <div>
        <button onClick={()=>canWrite&&updateChannel(ch.id,{enabled:!ch.enabled})}
          style={{ width:40, height:22, borderRadius:100, background:ch.enabled?'var(--brand-accent)':'var(--border)', position:'relative', cursor:canWrite?'pointer':'default', border:'none', transition:'background 0.2s' }}>
          <div style={{ position:'absolute', top:2, left:ch.enabled?20:2, width:18, height:18, borderRadius:'50%', background:'white', transition:'left 0.2s' }} />
        </button>
      </div>
      <div>
        <label className="label" style={{ fontSize:10, marginBottom:2 }}>Max/day</label>
        <input type="number" min={1} value={ch.dailyCap} disabled={!canWrite}
          onChange={e=>updateChannel(ch.id,{dailyCap:+e.target.value})}
          className="input" style={{ padding:'4px 8px', fontSize:12 }} />
      </div>
      <div>
        <label className="label" style={{ fontSize:10, marginBottom:2 }}>Max/week</label>
        <input type="number" min={1} value={ch.weeklyCap} disabled={!canWrite}
          onChange={e=>updateChannel(ch.id,{weeklyCap:+e.target.value})}
          className="input" style={{ padding:'4px 8px', fontSize:12 }} />
      </div>
      <span className={`badge ${ch.enabled?'badge-green':'badge-gray'}`}>{ch.enabled?'Enabled':'Disabled'}</span>
    </div>
  );

  return (
    <div className="animate-in">
      <div className="page-header"><h1 className="page-title">Channels</h1>
        <p className="page-subtitle">Configure owned and paid media channels. Contact limits apply per customer across all strategies.</p></div>
      <div style={{ padding:'0 24px 24px', display:'flex', flexDirection:'column', gap:20 }}>
        {[{label:'Owned Channels', data:owned}, {label:'Paid Media Channels', data:paid}].map(g=>(
          <div key={g.label} className="card" style={{ padding:0, overflow:'hidden' }}>
            <div className="card-header"><span className="card-title">{g.label}</span>
              <span style={{ fontSize:12, color:'var(--text-muted)' }}>{g.data.filter(c=>c.enabled).length}/{g.data.length} enabled</span></div>
            <div style={{ display:'grid', gridTemplateColumns:'48px 1fr 90px 100px 100px 90px', gap:12, padding:'8px 16px', background:'var(--bg)' }}>
              {['','Channel','Enabled','Cap/day','Cap/week','Status'].map(h=><div key={h} style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.4px', textTransform:'uppercase' }}>{h}</div>)}
            </div>
            {g.data.map(ch=><ChannelRow key={ch.id} ch={ch} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
