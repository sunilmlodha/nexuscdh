'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, DEMO_USERS, ROLE_LABELS } from '@/lib/auth';
import { Zap, Eye, EyeOff } from 'lucide-react';
import { createClient, AUTH_AVAILABLE } from '@/lib/supabase-browser';

export default function LoginPage() {
  const router = useRouter();
  const { login, users } = useAuth();
  const [email, setEmail] = useState('alex@example.com');
  const [password, setPassword] = useState('demo1234');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [ssoLoading, setSsoLoading] = useState<string | null>(null);
  const signInWith = async (provider: 'google' | 'azure') => {
    setSsoLoading(provider); setError('');
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          ...(provider === 'azure' ? { scopes: 'email openid profile' } : {}),
        },
      });
      if (error) { setError(error.message); setSsoLoading(null); }
      // on success the browser redirects to the provider
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'SSO failed'); setSsoLoading(null); }
  };

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
          <div style={{ fontSize:22, fontWeight:800, letterSpacing:'-0.5px', color:'var(--text-primary)' }}>Stratcheck</div>
          <div style={{ fontSize:13, color:'var(--text-secondary)', marginTop:4 }}>Enterprise Customer Decision Hub</div>
        </div>

        {/* SSO */}
        {AUTH_AVAILABLE && (
          <div className="card" style={{ padding:28, marginBottom:16 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <button onClick={() => signInWith('google')} disabled={!!ssoLoading}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, width:'100%', padding:'10px 14px', borderRadius:8, border:'1px solid var(--border)', background:'white', color:'#1f2937', cursor:'pointer', fontSize:14, fontWeight:600 }}>
                <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.1 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.2 13.2 17.6 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7C43.9 38 46.5 31.8 46.5 24.5z"/><path fill="#FBBC05" d="M10.4 28.3c-.5-1.4-.7-2.9-.7-4.3s.3-2.9.7-4.3l-7.8-6.1C1 16.9 0 20.3 0 24s1 7.1 2.6 10.4l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.5l-7.3-5.7c-2 1.4-4.7 2.3-7.7 2.3-6.4 0-11.8-3.7-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
                {ssoLoading === 'google' ? 'Redirecting…' : 'Continue with Google'}
              </button>
              <button onClick={() => signInWith('azure')} disabled={!!ssoLoading}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, width:'100%', padding:'10px 14px', borderRadius:8, border:'1px solid var(--border)', background:'white', color:'#1f2937', cursor:'pointer', fontSize:14, fontWeight:600 }}>
                <svg width="16" height="16" viewBox="0 0 23 23"><path fill="#f25022" d="M1 1h10v10H1z"/><path fill="#7fba00" d="M12 1h10v10H12z"/><path fill="#00a4ef" d="M1 12h10v10H1z"/><path fill="#ffb900" d="M12 12h10v10H12z"/></svg>
                {ssoLoading === 'azure' ? 'Redirecting…' : 'Continue with Microsoft'}
              </button>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10, margin:'16px 0 0' }}>
              <div style={{ flex:1, height:1, background:'var(--border)' }} /><span style={{ fontSize:11, color:'var(--text-muted)' }}>or demo sign-in</span><div style={{ flex:1, height:1, background:'var(--border)' }} />
            </div>
          </div>
        )}

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
