import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { getFriendlyAuthError, getSafeNextPath, normalizeAuthType } from '../lib/authRedirect.js'

function getAuthParams(search, hash) {
  const params = new URLSearchParams(search)
  const hashParams = new URLSearchParams(hash.replace(/^#/, ''))

  for (const [key, value] of hashParams.entries()) {
    if (!params.has(key)) params.set(key, value)
  }

  return params
}

export default function AuthSignIn() {
  const location = useLocation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const authParams = useMemo(() => getAuthParams(location.search, location.hash), [location.search, location.hash])
  const code = authParams.get('code') || ''
  const tokenHash = authParams.get('token_hash') || ''
  const type = normalizeAuthType(authParams.get('type'))
  const next = getSafeNextPath(authParams.get('next'))
  const canContinue = Boolean(code || (tokenHash && type))

  async function handleContinue() {
    setLoading(true)
    setError('')

    try {
      let result
      if (code) {
        result = await supabase.auth.exchangeCodeForSession(code)
      } else if (tokenHash && type) {
        result = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        })
      } else {
        throw new Error('This sign-in link is missing required information.')
      }

      if (result?.error) throw result.error
      window.location.replace(next)
    } catch (err) {
      setError(getFriendlyAuthError(err))
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--color-bg)' }}>
      <div className="card" style={{ width: 420, padding: 36 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10, color: 'var(--color-primary)' }}>Sign in to FUPM</h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
          Continue when you are ready. This keeps your secure link from being used by automatic email checks.
        </p>

        {error && (
          <div className="badge badge-danger" style={{ display: 'block', padding: '12px 14px', borderRadius: 6, fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        {!canContinue && !error && (
          <div className="badge badge-danger" style={{ display: 'block', padding: '12px 14px', borderRadius: 6, fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
            This sign-in link is missing required information. Please request a fresh link.
          </div>
        )}

        <button
          type="button"
          className="btn-primary"
          style={{ width: '100%', marginBottom: 12 }}
          onClick={handleContinue}
          disabled={loading || !canContinue}
        >
          {loading ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Continue'}
        </button>

        <Link to="/login" className="btn-secondary" style={{ width: '100%', display: 'inline-flex', justifyContent: 'center', textDecoration: 'none' }}>
          Request a fresh login link
        </Link>
      </div>
    </div>
  )
}
