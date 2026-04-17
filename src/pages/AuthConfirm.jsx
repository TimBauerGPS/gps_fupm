import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

function getSafeRedirectTarget(rawRedirect) {
  if (!rawRedirect) return '/dashboard'

  try {
    const url = new URL(rawRedirect, window.location.origin)

    if (url.origin === window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}`
    }

    return url.toString()
  } catch {
    return '/dashboard'
  }
}

export default function AuthConfirm() {
  const location = useLocation()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function confirmAuthAction() {
      const params = new URLSearchParams(location.search)
      const tokenHash = params.get('token_hash')
      const type = params.get('type')
      const redirectTo = getSafeRedirectTarget(params.get('redirect_to'))

      if (!tokenHash || !type) {
        setError('This invite link is missing required information.')
        return
      }

      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      })

      if (!active) return

      if (verifyError) {
        setError(verifyError.message)
        return
      }

      if (redirectTo.startsWith('http')) {
        window.location.replace(redirectTo)
        return
      }

      navigate(redirectTo, { replace: true })
    }

    confirmAuthAction()

    return () => {
      active = false
    }
  }, [location.search, navigate])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--color-bg)' }}>
      <div className="card" style={{ width: 420, padding: 36 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10, color: 'var(--color-primary)' }}>Confirming your invite</h1>

        {error ? (
          <>
            <p style={{ color: 'var(--color-danger)', marginBottom: 18, lineHeight: 1.6 }}>
              {error}
            </p>
            <Link to="/login" className="btn-secondary" style={{ display: 'inline-flex', textDecoration: 'none' }}>
              Return to login
            </Link>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--color-text-muted)' }}>
            <div className="spinner" />
            <span>Signing you in and finishing setup…</span>
          </div>
        )}
      </div>
    </div>
  )
}
