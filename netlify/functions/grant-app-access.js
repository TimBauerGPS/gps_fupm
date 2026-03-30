import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// All apps sharing this Supabase project — add 'fupm' here
const validApps = ['fupm', 'call-analyzer', 'hubspot-importer']

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  // Caller must be super admin
  const token = event.headers.authorization?.replace('Bearer ', '')
  if (!token) return { statusCode: 401, body: 'Unauthorized' }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return { statusCode: 401, body: 'Unauthorized' }

  const { data: sa } = await supabase
    .from('super_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!sa) return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) }

  const { targetUserId, appName } = JSON.parse(event.body)

  if (!validApps.includes(appName)) {
    return { statusCode: 400, body: JSON.stringify({ error: `Invalid app: ${appName}` }) }
  }

  const { error } = await supabase
    .from('user_app_access')
    .upsert({ user_id: targetUserId, app_name: appName }, { onConflict: 'user_id,app_name' })

  if (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) }
}
