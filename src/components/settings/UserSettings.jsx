import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { saveMemberProfile } from '../../lib/profile.js'

export default function UserSettings({ companyId }) {
  const [members, setMembers] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteDone, setInviteDone] = useState(false)
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [memberLoadError, setMemberLoadError] = useState('')

  useEffect(() => { loadMembers() }, [companyId])

  async function loadMembers() {
    setLoadingMembers(true)
    setMemberLoadError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/company-members', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unable to load team members')
      setMembers(data.members || [])
    } catch (err) {
      setMemberLoadError(err.message)
    }

    setLoadingMembers(false)
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
    try {
      const updatedMember = await saveMemberProfile({ userId, companyId, ...updates })
      setMembers(m => m.map(x => x.user_id === userId ? { ...x, ...updatedMember } : x))
      setMemberLoadError('')
    } catch (err) {
      setMemberLoadError(err.message)
    }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 20, background: '#f8fafc', border: '1px solid var(--color-border)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Role Permissions</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            {
              role: 'Member',
              badge: 'badge-pending',
              perms: [
                'Send letters, emails, and SMS',
                'Search jobs and view job details',
                'View communication history',
                'View reports',
                'Update their own name, phone, and email',
                'Upload CSV and trigger Albi sync',
              ],
            },
            {
              role: 'Admin',
              badge: 'badge-success',
              perms: [
                'Everything a Member can do',
                'Manage company branding & logo',
                'Configure API keys (Twilio, PostGrid, Resend)',
                'Create and edit letter templates',
                'Invite and manage team members, including account email visibility',
                'Import jobs via CSV or Albi sync',
              ],
            },
          ].map(({ role, badge, perms }) => (
            <div key={role} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span className={`badge ${badge}`}>{role}</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.2em', fontSize: 13, lineHeight: 1.8, color: 'var(--color-text)' }}>
                {perms.map(p => <li key={p}>{p}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>

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
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 14 }}>
          Account Email is the user’s login email. Rep Email controls the <code>{'{{RepEmail}}'}</code> merge tag in templates.
        </p>
        {memberLoadError && <p style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 12 }}>{memberLoadError}</p>}
        {loadingMembers ? (
          <div style={{ textAlign: 'center', padding: 24 }}><div className="spinner" /></div>
        ) : (
          members.map(m => {
            const accountStatus = getAccountStatus(m)

            return (
              <div key={m.user_id} style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span className={`badge ${m.role === 'admin' ? 'badge-success' : 'badge-pending'}`}>{m.role}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>
                    {m.display_name || m.auth_email || m.user_id}
                  </span>
                  <span className={`badge ${accountStatus.badge}`}>{accountStatus.label}</span>
                </div>
                <div className="form-row" style={{ marginBottom: 4 }}>
                  <ReadOnlyField label="Account Email" value={m.auth_email || '—'} />
                  <ReadOnlyField label="Account Status" value={accountStatus.detail} />
                  <ReadOnlyField label="Last Sign In" value={formatDateTime(m.last_sign_in_at)} />
                </div>
                <div className="form-row">
                  <EditField label="Display Name ({{Rep}})" value={m.display_name} onSave={v => updateMember(m.user_id, { display_name: v })} />
                  <EditField label="Rep Phone ({{RepPhone}})" value={m.rep_phone} onSave={v => updateMember(m.user_id, { rep_phone: v })} />
                  <EditField label="Rep Email ({{RepEmail}})" value={m.rep_email} onSave={v => updateMember(m.user_id, { rep_email: v })} />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

function getAccountStatus(member) {
  if (member.last_sign_in_at) {
    return { label: 'Active', badge: 'badge-success', detail: `Signed in ${formatDateTime(member.last_sign_in_at)}` }
  }

  if (member.email_confirmed_at) {
    return { label: 'Registered', badge: 'badge-success', detail: `Email confirmed ${formatDateTime(member.email_confirmed_at)}` }
  }

  if (member.invited_at || member.confirmation_sent_at) {
    const sentAt = member.invited_at || member.confirmation_sent_at
    return { label: 'Invite sent', badge: 'badge-pending', detail: `Invite sent ${formatDateTime(sentAt)}` }
  }

  return { label: 'Pending setup', badge: 'badge-pending', detail: 'No sign-in activity yet' }
}

function ReadOnlyField({ label, value }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <input value={value || ''} disabled />
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
