import crypto from 'node:crypto'

const API_KEY_PREFIX = 'fupm_live_'

export function generateExternalApiKey() {
  return `${API_KEY_PREFIX}${crypto.randomBytes(32).toString('base64url')}`
}

export function hashExternalApiKey(apiKey) {
  return crypto
    .createHash('sha256')
    .update(String(apiKey || ''))
    .digest('hex')
}

export function getExternalApiKeyPrefix(apiKey) {
  const value = String(apiKey || '')
  return `${value.slice(0, API_KEY_PREFIX.length + 6)}...`
}

export function extractBearerToken(headers = {}) {
  const value = headers.authorization || headers.Authorization
  if (!value || typeof value !== 'string') return null

  const match = value.match(/^Bearer\s+(.+)$/)
  return match ? match[1].trim() : null
}

export function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}
