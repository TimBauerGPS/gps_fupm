import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) }
  }

  const token = event.headers.authorization?.replace('Bearer ', '')
  if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }

    const [{ data: superAdmin }, { data: member }] = await Promise.all([
      supabase.from('super_admins').select('user_id').eq('user_id', user.id).maybeSingle(),
      supabase.from('company_members').select('company_id, role').eq('user_id', user.id).maybeSingle(),
    ])

    if (!superAdmin && member?.role !== 'admin') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) }
    }

    const companyId = member?.company_id
    if (!companyId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No company found for this user' }) }
    }

    const { data: members, error: memberError } = await supabase
      .from('company_members')
      .select('*')
      .eq('company_id', companyId)
      .order('display_name')

    if (memberError) {
      return { statusCode: 500, body: JSON.stringify({ error: memberError.message }) }
    }

    const enrichedMembers = await Promise.all((members || []).map(async (companyMember) => {
      const { data: authData, error } = await supabase.auth.admin.getUserById(companyMember.user_id)

      if (error) {
        console.error(`company-members auth lookup failed for ${companyMember.user_id}:`, error)
      }

      const authUser = authData?.user

      return {
        ...companyMember,
        auth_email: authUser?.email || null,
        confirmation_sent_at: authUser?.confirmation_sent_at || null,
        invited_at: authUser?.invited_at || null,
        email_confirmed_at: authUser?.email_confirmed_at || authUser?.confirmed_at || null,
        last_sign_in_at: authUser?.last_sign_in_at || null,
        registered_at: authUser?.created_at || null,
      }
    }))

    return { statusCode: 200, body: JSON.stringify({ members: enrichedMembers }) }
  } catch (err) {
    console.error('company-members error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
