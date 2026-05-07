import { Navigate, useLocation } from 'react-router-dom'
import { appendAuthParams } from '../lib/authRedirect.js'

export default function AuthConfirm() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''))

  for (const [key, value] of hashParams.entries()) {
    if (!params.has(key)) params.set(key, value)
  }

  if (!params.has('next')) {
    const legacyRedirect = params.get('redirect_to')
    params.set('next', legacyRedirect || '/dashboard')
    params.delete('redirect_to')
  }

  return <Navigate to={appendAuthParams('/auth/sign-in', params)} replace />
}
