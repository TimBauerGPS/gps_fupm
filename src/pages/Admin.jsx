import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Admin() {
  const [companies, setCompanies] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('companies').select('*').order('name'),
      supabase.from('company_members').select('*, companies(name)').order('display_name'),
    ]).then(([c, u]) => {
      setCompanies(c.data || [])
      setUsers(u.data || [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Super Admin</h1>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Companies ({companies.length})</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '6px 10px' }}>Name</th>
              <th style={{ padding: '6px 10px' }}>ID</th>
              <th style={{ padding: '6px 10px' }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {companies.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '8px 10px', fontWeight: 600 }}>{c.name}</td>
                <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)', fontFamily: 'monospace', fontSize: 11 }}>{c.id}</td>
                <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)' }}>{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
