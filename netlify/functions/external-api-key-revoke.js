import { createClient } from '@supabase/supabase-js'
import { jsonResponse } from './_externalApiKeyCore.js'
import { requireExternalApiAdmin } from './_externalApiAdminAuth.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method Not Allowed' })
  }

  const allowed = await requireExternalApiAdmin(event, supabase)
  if (allowed.response) return allowed.response

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' })
  }

  const keyId = String(body.keyId || '').trim()
  if (!keyId) return jsonResponse(400, { error: 'keyId is required' })

  const { data, error } = await supabase
    .from('external_api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .is('revoked_at', null)
    .select('id, revoked_at')
    .maybeSingle()

  if (error) return jsonResponse(500, { error: error.message })
  if (!data) return jsonResponse(404, { error: 'Active key not found' })

  return jsonResponse(200, { ok: true, keyId: data.id, revokedAt: data.revoked_at })
}
