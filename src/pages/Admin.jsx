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
  const [groups, setGroups]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  const [newGroupName, setNewGroupName]   = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    try {
      const data = await adminFetch('load')
      setCompanies(data.companies || [])
      setUsers(data.members || [])
      setGroups(data.groups || [])
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function createGroup(e) {
    e.preventDefault()
    if (!newGroupName.trim()) return
    setCreatingGroup(true)
    try {
      await adminFetch('createGroup', { name: newGroupName.trim() })
      setNewGroupName('')
      loadAll()
    } catch (err) {
      setError(err.message)
    }
    setCreatingGroup(false)
  }

  async function assignGroup(companyId, groupId) {
    try {
      await adminFetch('assignGroup', { companyId, groupId: groupId || null })
      loadAll()
    } catch (err) {
      setError(err.message)
    }
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

      {/* Groups */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Company Groups</h2>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 14 }}>
          Companies in the same group share templates. Each group is fully isolated from other groups.
        </p>

        {groups.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '6px 10px' }}>Group Name</th>
                <th style={{ padding: '6px 10px' }}>Companies</th>
                <th style={{ padding: '6px 10px' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(g => {
                const members = companies.filter(c => c.group_id === g.id)
                return (
                  <tr key={g.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{g.name}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)' }}>
                      {members.length === 0
                        ? <em>None assigned</em>
                        : members.map(c => c.name).join(', ')}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)' }}>
                      {new Date(g.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        <form onSubmit={createGroup} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>New Group Name</label>
            <input
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              placeholder="e.g. Allied Restoration Network"
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={creatingGroup}>
            {creatingGroup ? 'Creating…' : 'Create Group'}
          </button>
        </form>
      </div>

      {/* Companies */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Companies ({companies.length})</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '6px 10px' }}>Name</th>
              <th style={{ padding: '6px 10px' }}>Group</th>
              <th style={{ padding: '6px 10px' }}>Admins</th>
              <th style={{ padding: '6px 10px' }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {companies.map(c => {
              const admins = users.filter(u => u.company_id === c.id && u.role === 'admin')
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <select
                      value={c.group_id || ''}
                      onChange={e => assignGroup(c.id, e.target.value)}
                      style={{ fontSize: 12, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--color-border)' }}
                    >
                      <option value="">— No group —</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '8px 10px', color: admins.length === 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                    {admins.length === 0
                      ? '⚠ No admin'
                      : admins.map(a => a.display_name || '(unnamed)').join(', ')}
                  </td>
                  <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)' }}>
                    {new Date(c.created_at).toLocaleDateString()}
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
