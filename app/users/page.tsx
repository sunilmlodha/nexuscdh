'use client';
import { useState } from 'react';
import { useAuth, AppUser, ROLE_LABELS, Role, ROLE_PERMISSIONS } from '@/lib/auth';
import { usePermission } from '@/lib/auth';
import { Plus, Edit2, Trash2, X, Save, CheckCircle2, Shield, UserCheck } from 'lucide-react';

const ROLES: Role[] = ['super_admin','tenant_admin','strategy_manager','campaign_analyst','channel_manager','data_scientist','ops_manager','read_only'];
const STATUS_BADGE: Record<string, string> = { active:'badge-green', invited:'badge-blue', disabled:'badge-gray' };

function UserModal({ user, onClose }: { user?: AppUser; onClose: () => void }) {
  const { addUser, updateUser } = useAuth();
  const [name, setName]   = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole]   = useState<Role>(user?.role ?? 'campaign_analyst');
  const [status, setStatus] = useState<AppUser['status']>(user?.status ?? 'invited');
  const [saved, setSaved] = useState(false);

  const initials = name.split(' ').map(w=>w[0]??'').join('').toUpperCase().slice(0,2)||'??';

  const save = () => {
    if (!name.trim()||!email.trim()) return;
    if (user) updateUser(user.id, { name, email, role, status, avatarInitials: initials });
    else addUser({ name, email, role, status, avatarInitials: initials });
    setSaved(true); setTimeout(onClose, 500);
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{user ? 'Edit User' : 'Invite User'}</span>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)' }}><X size={16}/></button>
        </div>
        <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="field-group" style={{ marginBottom:0 }}><label className="label">Full Name *</label>
            <input className="input" value={name} onChange={e=>setName(e.target.value)} autoFocus /></div>
          <div className="field-group" style={{ marginBottom:0 }}><label className="label">Email *</label>
            <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} /></div>
          <div className="field-group" style={{ marginBottom:0 }}><label className="label">Role</label>
            <select className="input select" value={role} onChange={e=>setRole(e.target.value as Role)}>
              {ROLES.map(r=><option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <div className="field-hint">{ROLE_PERMISSIONS[role].length} permissions granted</div>
          </div>
          {user && <div className="field-group" style={{ marginBottom:0 }}><label className="label">Status</label>
            <select className="input select" value={status} onChange={e=>setStatus(e.target.value as any)}>
              <option value="active">Active</option><option value="invited">Invited</option><option value="disabled">Disabled</option>
            </select></div>}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={save} disabled={!name.trim()||!email.trim()||saved} className="btn btn-primary btn-sm">
            {saved?<><CheckCircle2 size={13}/>Saved</>:<><Save size={13}/>{user?'Save':'Send invite'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { users, removeUser, currentUser, authSettings } = useAuth();
  const canWrite = usePermission('users:write');
  const [modal, setModal] = useState<{data?:AppUser}|null>(null);
  const [showPerms, setShowPerms] = useState<Role|null>(null);

  return (
    <div className="animate-in">
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div><h1 className="page-title">Users & Roles</h1>
          <p className="page-subtitle">Manage team members and their access permissions</p></div>
        {canWrite && <div style={{ paddingTop:24 }}><button onClick={()=>setModal({})} className="btn btn-primary btn-sm"><Plus size={13}/>Invite user</button></div>}
      </div>

      <div style={{ padding:'0 24px 24px', display:'flex', flexDirection:'column', gap:20 }}>

        {!authSettings.authEnabled && (
          <div className="alert alert-warning">Authentication is disabled. Enable it in <strong>Settings → Authentication</strong> to enforce RBAC roles.</div>
        )}

        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <table className="table">
            <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last login</th><th>Permissions</th><th></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--brand-accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'white', flexShrink:0 }}>{u.avatarInitials}</div>
                      <div>
                        <div style={{ fontWeight:600, fontSize:13 }}>{u.name}{u.id===currentUser?.id&&<span className="badge badge-blue" style={{ marginLeft:6, fontSize:10 }}>You</span>}</div>
                        <div style={{ fontSize:12, color:'var(--text-muted)' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="badge badge-gray">{ROLE_LABELS[u.role]}</span></td>
                  <td><span className={`badge ${STATUS_BADGE[u.status]}`}>{u.status}</span></td>
                  <td style={{ fontSize:12, color:'var(--text-muted)' }}>{u.lastLogin?new Date(u.lastLogin).toLocaleDateString():'Never'}</td>
                  <td>
                    <button onClick={()=>setShowPerms(showPerms===u.role?null:u.role)} className="btn btn-ghost btn-sm" style={{ fontSize:11 }}>
                      <Shield size={11}/>{ROLE_PERMISSIONS[u.role].length} perms
                    </button>
                  </td>
                  <td>
                    {canWrite && u.id!==currentUser?.id && (
                      <div style={{ display:'flex', gap:4 }}>
                        <button onClick={()=>setModal({data:u})} className="btn btn-ghost btn-sm" style={{ padding:'4px 8px' }}><Edit2 size={12}/></button>
                        <button onClick={()=>confirm(`Remove ${u.name}?`)&&removeUser(u.id)} className="btn btn-ghost btn-sm" style={{ padding:'4px 8px', color:'var(--danger)' }}><Trash2 size={12}/></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Role permissions matrix */}
        {showPerms && (
          <div className="card card-body">
            <div style={{ fontWeight:700, marginBottom:12, fontSize:14 }}>{ROLE_LABELS[showPerms]} — Permissions</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {ROLE_PERMISSIONS[showPerms].map(p => (
                <span key={p} style={{ padding:'3px 8px', background:'var(--success-l)', color:'var(--success)', borderRadius:4, fontSize:11, fontWeight:600, fontFamily:'var(--font-mono)' }}>{p}</span>
              ))}
            </div>
          </div>
        )}

        {/* Role reference */}
        <div className="card card-body">
          <div style={{ fontWeight:700, marginBottom:14, fontSize:14 }}>Role Reference</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
            {ROLES.map(r => (
              <div key={r} style={{ padding:'10px 12px', border:'1px solid var(--border)', borderRadius:8 }}>
                <div style={{ fontWeight:700, fontSize:12, marginBottom:4 }}>{ROLE_LABELS[r]}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>{ROLE_PERMISSIONS[r].length} permissions</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {modal && <UserModal user={modal.data} onClose={()=>setModal(null)} />}
    </div>
  );
}
