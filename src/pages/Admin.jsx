import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

async function adminFetch(action, payload = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/admin-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ action, ...payload }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}

export default function Admin() {
  const [companies, setCompanies] = useState([])
  const [users, setUsers]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  // Invite form
  const [inviteEmail, setInviteEmail]       = useState('')
  const [inviteCompany, setInviteCompany]   = useState('')
  const [inviteRole, setInviteRole]         = useState('member')
  const [inviting, setInviting]             = useState(false)
  const [inviteResult, setInviteResult]     = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    try {
      const data = await adminFetch('load')
      setCompanies(data.companies || [])
      setUsers(data.members || [])
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function handleInvite(e) {
    e.preventDefault()
    setInviting(true)
    setInviteResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin-invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          email:     inviteEmail,
          role:      inviteRole,
          companyId: inviteCompany,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invite failed')
      setInviteResult({ ok: true })
      setInviteEmail('')
      loadAll()
    } catch (err) {
      setInviteResult({ error: err.message })
    }
    setInviting(false)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Super Admin</h1>
      </div>

      {error && (
        <div style={{ color: 'var(--color-danger)', marginBottom: 16, fontSize: 13 }}>{error}</div>
      )}

      {/* Invite User to Any Company */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Invite User</h2>
        <form onSubmit={handleInvite}>
          <div className="form-row" style={{ alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                required
              />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Company</label>
              <select value={inviteCompany} onChange={e => setInviteCompany(e.target.value)} required>
                <option value="">Select company…</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
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
          {inviteResult?.ok && <p style={{ color: 'var(--color-success)', fontSize: 13, marginTop: 8 }}>✓ Invite sent</p>}
          {inviteResult?.error && <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 8 }}>{inviteResult.error}</p>}
        </form>
      </div>

      {/* Companies */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Companies ({companies.length})</h2>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 14 }}>
          Each company is fully isolated — separate templates, settings, jobs, and users.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '6px 10px' }}>Name</th>
              <th style={{ padding: '6px 10px' }}>Admins</th>
              <th style={{ padding: '6px 10px' }}>Members</th>
              <th style={{ padding: '6px 10px' }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {companies.map(c => {
              const companyUsers = users.filter(u => u.company_id === c.id)
              const admins  = companyUsers.filter(u => u.role === 'admin')
              const members = companyUsers.filter(u => u.role === 'member')
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: '8px 10px', color: admins.length === 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                    {admins.length === 0
                      ? '⚠ No admin'
                      : admins.map(a => a.display_name || '(unnamed)').join(', ')}
                  </td>
                  <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)' }}>
                    {members.length === 0
                      ? '—'
                      : members.map(m => m.display_name || '(unnamed)').join(', ')}
                  </td>
                  <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)' }}>
                    {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Users */}
      <div className="card">
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>All Users ({users.length})</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '6px 10px' }}>Name</th>
              <th style={{ padding: '6px 10px' }}>Role</th>
              <th style={{ padding: '6px 10px' }}>Company</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '8px 10px' }}>{u.display_name || '—'}</td>
                <td style={{ padding: '8px 10px' }}>
                  <span className={`badge ${u.role === 'admin' ? 'badge-success' : 'badge-pending'}`}>{u.role}</span>
                </td>
                <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)' }}>{u.companies?.name || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
