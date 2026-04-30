import { extractBearerToken, jsonResponse } from './_externalApiKeyCore.js'

const ALLOWLISTED_EMAIL = 'tbauer+allied@alliedrestoration.com'

export async function requireExternalApiAdmin(event, supabase) {
  const token = extractBearerToken(event.headers)
  if (!token) return { response: jsonResponse(401, { error: 'Unauthorized' }) }

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return { response: jsonResponse(401, { error: 'Unauthorized' }) }

  if (user.email?.toLowerCase() !== ALLOWLISTED_EMAIL) {
    return { response: jsonResponse(403, { error: 'Forbidden' }) }
  }

  const [{ data: appAccess }, { data: superAdmin }, { data: adminMember }] = await Promise.all([
    supabase
      .from('user_app_access')
      .select('id')
      .eq('user_id', user.id)
      .eq('app_name', 'fupm')
      .maybeSingle(),
    supabase
      .from('super_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('company_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle(),
  ])

  if (!appAccess || (!superAdmin && !adminMember)) {
    return { response: jsonResponse(403, { error: 'Forbidden' }) }
  }

  return { user }
}
