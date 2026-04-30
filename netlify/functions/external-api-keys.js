import { createClient } from '@supabase/supabase-js'
import {
  generateExternalApiKey,
  getExternalApiKeyPrefix,
  hashExternalApiKey,
  jsonResponse,
} from './_externalApiKeyCore.js'
import { requireExternalApiAdmin } from './_externalApiAdminAuth.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function mapKey(row, creatorEmailById = new Map()) {
  return {
    id: row.id,
    name: row.name,
    companyId: row.company_id,
    companyName: row.companies?.name || null,
    keyPrefix: row.key_prefix,
    createdBy: row.created_by,
    createdByEmail: creatorEmailById.get(row.created_by) || null,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at,
    lastUsedIp: row.last_used_ip,
  }
}

async function listKeysAndCompanies() {
  const [keysResult, companiesResult] = await Promise.all([
    supabase
      .from('external_api_keys')
      .select('id, name, company_id, key_prefix, created_by, created_at, revoked_at, last_used_at, last_used_ip, companies(name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('companies')
      .select('id, name')
      .order('name', { ascending: true }),
  ])

  if (keysResult.error) return { response: jsonResponse(500, { error: keysResult.error.message }) }
  if (companiesResult.error) return { response: jsonResponse(500, { error: companiesResult.error.message }) }

  const creatorEmailById = await loadCreatorEmails(keysResult.data || [])

  return {
    keys: (keysResult.data || []).map((row) => mapKey(row, creatorEmailById)),
    companies: (companiesResult.data || []).map((company) => ({
      id: company.id,
      name: company.name,
    })),
  }
}

async function loadCreatorEmails(rows) {
  const creatorIds = [...new Set(rows.map((row) => row.created_by).filter(Boolean))]
  const entries = await Promise.all(creatorIds.map(async (id) => {
    const { data, error } = await supabase.auth.admin.getUserById(id)
    if (error) {
      console.error(`external-api-keys creator lookup failed for ${id}:`, error)
      return [id, null]
    }
    return [id, data?.user?.email || null]
  }))
  return new Map(entries)
}

export const handler = async (event) => {
  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return jsonResponse(405, { error: 'Method Not Allowed' })
  }

  const auth = await requireExternalApiAdmin(event, supabase)
  if (auth.response) return auth.response

  if (event.httpMethod === 'GET') {
    const result = await listKeysAndCompanies()
    if (result.response) return result.response
    return jsonResponse(200, result)
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' })
  }

  const name = String(body.name || '').trim()
  const companyId = String(body.companyId || '').trim()

  if (!name) return jsonResponse(400, { error: 'Name is required' })
  if (!companyId) return jsonResponse(400, { error: 'Company is required' })

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, name')
    .eq('id', companyId)
    .maybeSingle()

  if (companyError) return jsonResponse(500, { error: companyError.message })
  if (!company) return jsonResponse(400, { error: 'Company not found' })

  const apiKey = generateExternalApiKey()
  const keyPrefix = getExternalApiKeyPrefix(apiKey)

  const { data: key, error: insertError } = await supabase
    .from('external_api_keys')
    .insert({
      company_id: companyId,
      name,
      key_hash: hashExternalApiKey(apiKey),
      key_prefix: keyPrefix,
      created_by: auth.user.id,
    })
    .select('id, name, company_id, key_prefix, created_at, revoked_at, last_used_at, last_used_ip')
    .single()

  if (insertError) return jsonResponse(500, { error: insertError.message })

  return jsonResponse(200, {
    ok: true,
    apiKey,
    key: {
      id: key.id,
      name: key.name,
      companyId: key.company_id,
      companyName: company.name,
      keyPrefix: key.key_prefix,
      createdBy: auth.user.id,
      createdByEmail: auth.user.email || null,
      createdAt: key.created_at,
      revokedAt: key.revoked_at,
      lastUsedAt: key.last_used_at,
      lastUsedIp: key.last_used_ip,
    },
  })
}
