import { hashExternalApiKey, extractBearerToken, jsonResponse } from './_externalApiKeyCore.js'

function getClientIp(event) {
  const headers = event.headers || {}
  return (
    headers['x-nf-client-connection-ip'] ||
    headers['client-ip'] ||
    headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    null
  )
}

export async function authenticateExternalApiKey(event, supabase) {
  const token = extractBearerToken(event.headers || {})
  if (!token) {
    return { response: jsonResponse(401, { error: 'Unauthorized' }) }
  }

  const keyHash = hashExternalApiKey(token)
  const { data: apiKey, error } = await supabase
    .from('external_api_keys')
    .select('id, company_id, name, key_prefix, revoked_at')
    .eq('key_hash', keyHash)
    .is('revoked_at', null)
    .maybeSingle()

  if (error || !apiKey) {
    return { response: jsonResponse(401, { error: 'Unauthorized' }) }
  }

  const updates = {
    last_used_at: new Date().toISOString(),
    last_used_ip: getClientIp(event),
  }

  try {
    const { error: updateError } = await supabase
      .from('external_api_keys')
      .update(updates)
      .eq('id', apiKey.id)

    if (updateError) {
      console.error('Failed to update external API key last-used metadata:', updateError)
    }
  } catch (updateError) {
    console.error('Failed to update external API key last-used metadata:', updateError)
  }

  return {
    apiKey,
    companyId: apiKey.company_id,
  }
}
