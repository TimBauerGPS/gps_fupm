import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }
  const token = event.headers.authorization?.replace('Bearer ', '')
  if (!token) return { statusCode: 401, body: 'Unauthorized' }
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return { statusCode: 401, body: 'Unauthorized' }

  const { address, companyId } = JSON.parse(event.body)
  const { data: settings } = await supabase.from('company_settings')
    .select('postgrid_api_key').eq('company_id', companyId).maybeSingle()
  const apiKey = settings?.postgrid_api_key || process.env.POSTGRID_API_KEY

  try {
    const res = await fetch('https://api.postgrid.com/print-mail/v1/addrs/verify', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        line1: address.line1,
        city: address.city,
        provinceOrState: address.state,
        postalOrZip: address.zip,
        country: 'US',
      }),
    })
    const data = await res.json()
    return { statusCode: 200, body: JSON.stringify(data) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
