'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, DEMO_USERS, ROLE_LABELS } from '@/lib/auth';
import { Zap, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, users } = useAuth();
  const [email, setEmail] = useState('alex@example.com');
  const [password, setPassword] = useState('demo1234');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    await new Promise(r => setTimeout(r, 600));
    const user = users.find(u => u.email === email && u.status === 'active');
    if (!user) { setError('Invalid email or password.'); setLoading(false); return; }
    login(user);
    router.push('/');
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:16, background:'var(--bg)' }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:48, height:48, borderRadius:12, background:'var(--brand-accent)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
            <Zap size={24} color="white" />
          </div>
          <div style={{ fontSize:22, fontWeight:800, letterSpacing:'-0.5px', color:'var(--text-primary)' }}>NexusCDH</div>
          <div style={{ fontSize:13, color:'var(--text-secondary)', marginTop:4 }}>Enterprise Customer Decision Hub</div>
        </div>

        {/* Form */}
        <div className="card" style={{ padding:28 }}>
          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div className="field-group" style={{ marginBottom:0 }}>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="field-group" style={{ marginBottom:0, position:'relative' }}>
              <label className="label">Password</label>
              <input className="input" type={showPw?'text':'password'} value={password}
                onChange={e => setPassword(e.target.value)} required style={{ paddingRight:40 }} />
              <button type="button" onClick={() => setShowPw(p=>!p)}
                style={{ position:'absolute', right:10, bottom:9, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {error && <div className="alert alert-danger" style={{ padding:'8px 12px', fontSize:12 }}>{error}</div>}
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width:'100%', justifyContent:'center', marginTop:4 }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Demo accounts */}
        <div style={{ marginTop:20 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8, textAlign:'center' }}>Demo accounts</div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {DEMO_USERS.slice(0,5).map(u => (
              <button key={u.id} onClick={() => { setEmail(u.email); setPassword('demo1234'); }}
                style={{ background:'white', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', cursor:'pointer', display:'flex', alignItems:'center', gap:10, textAlign:'left', transition:'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--brand-accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'white', flexShrink:0 }}>
                  {u.avatarInitials}
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>{u.name}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>{ROLE_LABELS[u.role]}</div>
                </div>
              </button>
            ))}
          </div>
          <p style={{ fontSize:11, color:'var(--text-muted)', textAlign:'center', marginTop:8 }}>Password: demo1234</p>
        </div>
      </div>
    </div>
  );
}
