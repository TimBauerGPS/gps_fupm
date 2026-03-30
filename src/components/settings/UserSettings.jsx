import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

export default function UserSettings({ companyId }) {
  const [members, setMembers] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteDone, setInviteDone] = useState(false)

  useEffect(() => { loadMembers() }, [companyId])

  async function loadMembers() {
    const { data } = await supabase
      .from('company_members')
      .select('*')
      .eq('company_id', companyId)
    setMembers(data || [])
  }

  async function handleInvite(e) {
    e.preventDefault()
    setInviting(true)
    setInviteError('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin-invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole, companyId }),
    })
    const text = await res.text()
    let data
    try { data = JSON.parse(text) } catch { data = { error: `Server error ${res.status}` } }
    setInviting(false)
    if (!res.ok) { setInviteError(data.error || 'Invite failed'); return }
    setInviteEmail('')
    setInviteDone(true)
    setTimeout(() => setInviteDone(false), 3000)
    loadMembers()
  }

  async function updateMember(userId, updates) {
    await supabase.from('company_members').update(updates).eq('user_id', userId).eq('company_id', companyId)
    setMembers(m => m.map(x => x.user_id === userId ? { ...x, ...updates } : x))
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Invite User</h3>
        <form onSubmit={handleInvite}>
          <div className="form-row" style={{ alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Email</label>
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Role</label>
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <button type="submit" className="btn-primary" disabled={inviting}>
                {inviting ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </div>
          {inviteError && <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 8 }}>{inviteError}</p>}
          {inviteDone && <p style={{ color: 'var(--color-success)', fontSize: 13, marginTop: 8 }}>✓ Invite sent</p>}
        </form>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Team Members</h3>
        {members.map(m => (
          <div key={m.user_id} style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <span className={`badge ${m.role === 'admin' ? 'badge-success' : 'badge-pending'}`}>{m.role}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--color-text-muted)' }}>{m.display_name || m.user_id}</span>
              {m.role !== 'admin' && (
                <button className="btn-secondary" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={() => updateMember(m.user_id, { role: 'admin' })}>
                  Make Admin
                </button>
              )}
            </div>
            <div className="form-row">
              <EditField label="Display Name ({{Rep}})" value={m.display_name} onSave={v => updateMember(m.user_id, { display_name: v })} />
              <EditField label="Rep Phone ({{RepPhone}})" value={m.rep_phone} onSave={v => updateMember(m.user_id, { rep_phone: v })} />
              <EditField label="Rep Email ({{RepEmail}})" value={m.rep_email} onSave={v => updateMember(m.user_id, { rep_email: v })} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EditField({ label, value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value || '')

  function handleBlur() {
    setEditing(false)
    if (val !== value) onSave(val)
  }

  return (
    <div className="form-group">
      <label>{label}</label>
      <input
        value={editing ? val : (value || '')}
        onFocus={() => { setVal(value || ''); setEditing(true) }}
        onChange={e => setVal(e.target.value)}
        onBlur={handleBlur}
      />
    </div>
  )
}
