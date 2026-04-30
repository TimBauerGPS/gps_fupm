import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

export default function ExternalApiKeySettings() {
  const [keys, setKeys] = useState([])
  const [companies, setCompanies] = useState([])
  const [name, setName] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [revokingId, setRevokingId] = useState('')
  const [error, setError] = useState('')
  const [createdKey, setCreatedKey] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => { loadKeys() }, [])

  async function request(path, options = {}) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Not signed in')

    const res = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...(options.headers || {}),
      },
    })
    const text = await res.text()
    let data = {}
    try { data = text ? JSON.parse(text) : {} } catch { data = { error: `Server error ${res.status}` } }
    if (!res.ok) throw new Error(data.error || `Request failed with ${res.status}`)
    return data
  }

  async function loadKeys() {
    setLoading(true)
    setError('')

    try {
      const data = await request('/api/external-api-keys')
      setKeys(data.keys || [])
      setCompanies(data.companies || [])
      setCompanyId(current => current || data.companies?.[0]?.id || '')
    } catch (err) {
      setError(err.message)
    }

    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    setError('')
    setCreatedKey('')

    try {
      const data = await request('/api/external-api-keys', {
        method: 'POST',
        body: JSON.stringify({ name, companyId }),
      })
      setKeys(current => [data.key, ...current])
      setCreatedKey(data.apiKey)
      setName('')
    } catch (err) {
      setError(err.message)
    }

    setCreating(false)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(createdKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRevoke(key) {
    if (!window.confirm(`Revoke "${key.name}"? This cannot be undone.`)) return

    setRevokingId(key.id)
    setError('')

    try {
      const data = await request('/api/external-api-key-revoke', {
        method: 'POST',
        body: JSON.stringify({ keyId: key.id }),
      })
      setKeys(current => current.map(existing => (
        existing.id === key.id ? { ...existing, revokedAt: data.revokedAt } : existing
      )))
    } catch (err) {
      setError(err.message)
    }

    setRevokingId('')
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 24 }}><div className="spinner" /></div>
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Create External API Key</h3>
        <form onSubmit={handleCreate}>
          <div className="form-row" style={{ alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="External App - Allied"
                required
              />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Company</label>
              <select value={companyId} onChange={e => setCompanyId(e.target.value)} required>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </div>
            <div>
              <button type="submit" className="btn-primary" disabled={creating || !companies.length}>
                {creating ? 'Creating...' : 'Create Key'}
              </button>
            </div>
          </div>
        </form>

        {createdKey && (
          <div style={{ marginTop: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius)', padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', marginBottom: 8 }}>
              Copy this key now. It will not be shown again.
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <code style={{
                flex: 1,
                background: '#fff',
                border: '1px solid #bbf7d0',
                borderRadius: 6,
                color: 'var(--color-text)',
                fontSize: 12,
                padding: '8px 10px',
                wordBreak: 'break-all',
              }}>
                {createdKey}
              </code>
              <button type="button" className="btn-secondary" style={{ fontSize: 12, flexShrink: 0 }} onClick={handleCopy}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {error && <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 12 }}>{error}</p>}
      </div>

      <div className="card">
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>External API Keys</h3>
        {keys.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>No external API keys have been created.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 860 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '8px 10px' }}>Name</th>
                  <th style={{ padding: '8px 10px' }}>Company</th>
                  <th style={{ padding: '8px 10px' }}>Prefix</th>
                  <th style={{ padding: '8px 10px' }}>Created By</th>
                  <th style={{ padding: '8px 10px' }}>Created</th>
                  <th style={{ padding: '8px 10px' }}>Last Used</th>
                  <th style={{ padding: '8px 10px' }}>Status</th>
                  <th style={{ padding: '8px 10px' }} />
                </tr>
              </thead>
              <tbody>
                {keys.map(key => {
                  const revoked = Boolean(key.revokedAt)

                  return (
                    <tr key={key.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '9px 10px', fontWeight: 600 }}>{key.name}</td>
                      <td style={{ padding: '9px 10px' }}>{key.companyName || '—'}</td>
                      <td style={{ padding: '9px 10px' }}><code>{key.keyPrefix}</code></td>
                      <td style={{ padding: '9px 10px' }}>{key.createdByEmail || key.createdBy || '—'}</td>
                      <td style={{ padding: '9px 10px' }}>{formatDateTime(key.createdAt)}</td>
                      <td style={{ padding: '9px 10px' }}>
                        {formatDateTime(key.lastUsedAt)}
                        {key.lastUsedIp && (
                          <div style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{key.lastUsedIp}</div>
                        )}
                      </td>
                      <td style={{ padding: '9px 10px' }}>
                        <span className={`badge ${revoked ? 'badge-error' : 'badge-success'}`}>
                          {revoked ? 'revoked' : 'active'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                        {!revoked && (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ fontSize: 12, color: 'var(--color-danger)' }}
                            disabled={revokingId === key.id}
                            onClick={() => handleRevoke(key)}
                          >
                            {revokingId === key.id ? 'Revoking...' : 'Revoke'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : '—'
}
