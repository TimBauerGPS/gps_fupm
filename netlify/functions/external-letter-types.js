import { createClient } from '@supabase/supabase-js'
import { authenticateExternalApiKey } from './_externalApiAuth.js'
import { jsonResponse } from './_externalApiKeyCore.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method Not Allowed' })
  }

  const auth = await authenticateExternalApiKey(event, supabase)
  if (auth.response) return auth.response

  const { data, error } = await supabase
    .from('letter_templates')
    .select('api_slug, name')
    .eq('company_id', auth.companyId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) return jsonResponse(500, { error: error.message })

  return jsonResponse(200, {
    letterTypes: (data || [])
      .filter((template) => template.api_slug)
      .map((template) => ({
        slug: template.api_slug,
        label: template.name,
      })),
  })
}
