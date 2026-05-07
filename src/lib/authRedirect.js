export const DEFAULT_AUTH_NEXT = '/dashboard'
export const AUTH_SIGN_IN_PATH = '/auth/sign-in'

const SUPPORTED_AUTH_TYPES = new Set(['magiclink', 'invite'])

export function getSafeNextPath(rawNext, fallback = DEFAULT_AUTH_NEXT) {
  if (!rawNext) return fallback

  try {
    const decoded = decodeURIComponent(String(rawNext))
    if (!decoded.startsWith('/') || decoded.startsWith('//')) return fallback

    const url = new URL(decoded, 'https://fupm.local')
    if (url.origin !== 'https://fupm.local') return fallback

    return `${url.pathname}${url.search}${url.hash}` || fallback
  } catch {
    return fallback
  }
}

export function buildAuthSignInUrl(siteUrl, next = DEFAULT_AUTH_NEXT) {
  const url = new URL(AUTH_SIGN_IN_PATH, String(siteUrl).replace(/\/+$/, ''))
  url.searchParams.set('next', decodeURI(getSafeNextPath(next)))
  return url.toString()
}

export function appendAuthParams(path, sourceParams) {
  const url = new URL(path, 'https://fupm.local')

  for (const [key, value] of sourceParams.entries()) {
    if (!url.searchParams.has(key)) {
      url.searchParams.set(key, value)
    }
  }

  return `${url.pathname}${url.search}${url.hash}`
}

export function normalizeAuthType(type) {
  const normalized = String(type || '').toLowerCase()
  return SUPPORTED_AUTH_TYPES.has(normalized) ? normalized : ''
}

export function getFriendlyAuthError(error) {
  const message = error?.message || String(error || '')
  const lower = message.toLowerCase()

  if (
    lower.includes('expired') ||
    lower.includes('invalid') ||
    lower.includes('token') ||
    lower.includes('otp')
  ) {
    return 'This sign-in link is invalid or has expired. Please request a fresh link and try again.'
  }

  if (lower.includes('fetch') || lower.includes('network')) {
    return 'We could not reach the sign-in service. Please check your connection and try again.'
  }

  return message || 'We could not sign you in. Please request a fresh link and try again.'
}

export function isAuthTokenUrl(pathname, search = '', hash = '') {
  const publicAuthPaths = new Set(['/auth/sign-in', '/auth/callback', '/auth/confirm', '/login'])
  if (!publicAuthPaths.has(pathname)) return false

  const params = new URLSearchParams(`${search.replace(/^\?/, '')}&${hash.replace(/^#/, '')}`)
  return params.has('token_hash') || params.has('code') || params.has('access_token') || params.has('refresh_token')
}

export function getScannerSafeActionLink({ redirectTo, type, properties = {} }) {
  const tokenHash = properties.hashed_token || properties.token_hash
  const authType = normalizeAuthType(type)

  if (!tokenHash || !authType) {
    return properties.action_link || ''
  }

  const url = new URL(redirectTo)
  url.searchParams.set('token_hash', tokenHash)
  url.searchParams.set('type', authType)
  return url.toString()
}
